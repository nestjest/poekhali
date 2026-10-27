#!/usr/bin/env bash
# «Поехали!» on Beget shared hosting (Passenger): install or update. In the hosting terminal:
#   S=~/$(whoami).beget.tech; git clone https://github.com/nestjest/poekhali $S/poekhali && bash $S/poekhali/deploy/beget/install.sh
#   update: cd ~/<site>/poekhali && git pull && bash deploy/beget/install.sh   (SKIP_BUILD=1 — keep the built game)
# The repository lives in the site folder (next to public_html, not in it): the site runs as its own user, and only
# the site folder gives that user access (default ACL; setfacl is not allowed). Data and settings: <site>/poekhali-data.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SITE="$(dirname "$REPO")"
DATA="$SITE/poekhali-data"
[ -d "$SITE/public_html" ] || { echo "Склонируйте репозиторий в папку сайта (рядом с public_html), см. начало $0"; exit 1; }
NODE_VERSION=22.14.0
NODE_DIR="$HOME/.local/node-v$NODE_VERSION-linux-x64"

echo "== 1/4 Node.js $NODE_VERSION (only to build the game)"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  mkdir -p "$HOME/.local"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" | tar -xJ -C "$HOME/.local"
fi
export PATH="$NODE_DIR/bin:$PATH"

echo "== 2/4 game build"
cd "$REPO/frontend"
if [ "${SKIP_BUILD:-}" = 1 ] && [ -f dist/index.html ]; then
  echo "   skipped (SKIP_BUILD=1)"
else
  npm ci --no-audit --no-fund
  npm run build
fi

echo "== 3/4 Python packages"
# No venv on the hosting (no ensurepip, no symlinks): packages go to .pydeps, passenger_wsgi.py adds it to sys.path.
PY=/usr/bin/python3
"$PY" -m pip install -q --upgrade --timeout 120 --retries 10 --target "$REPO/.pydeps" "fastapi>=0.115" "uvicorn>=0.30" "a2wsgi>=1.10" "psycopg[binary]>=3.2"

echo "== 4/4 site $SITE"
# No chmod here: it would reset the ACL mask, and the site user would lose access (others get nothing anyway).
mkdir -p "$DATA"
[ -f "$DATA/env" ] || printf 'BUREAU_PUBLIC_URL=http://%s\n' "$(basename "$SITE")" > "$DATA/env"
PUB="$SITE/public_html"
mkdir -p "$PUB"
# Beget's placeholder page goes to the data folder once (index.php would win over index.html).
[ -f "$PUB/index.php" ] && mv "$PUB/index.php" "$DATA/index.php.beget"
find "$PUB" -mindepth 1 -maxdepth 1 ! -name cgi-bin ! -name .htaccess -exec rm -rf {} +
cp -a "$REPO/frontend/dist/." "$PUB/"
cat > "$PUB/.htaccess" <<EOF
PassengerEnabled On
PassengerPython $PY
EOF
sed -e "s#@REPO@#$REPO#g" -e "s#@DATA@#$DATA#g" "$REPO/deploy/beget/passenger_wsgi.py" > "$SITE/passenger_wsgi.py"
ln -sfn public_html "$SITE/public"          # Passenger's static folder

# The teacher password lives in the database; a new SQLite database gets a generated one (shown once).
cd "$SITE"
PYTHONPATH="$REPO/.pydeps" "$PY" - <<'EOF'
import passenger_wsgi as app
from bureau_server.__main__ import readable_password

store = app.asgi.state.store
if not store.has_password():
    pw = readable_password()
    store.set_password(pw)
    print(f"\n  Пароль преподавателя: {pw}\n  (запишите; сменить: cd <сайт>/poekhali/server && PYTHONPATH=../.pydeps python3 -m bureau_server --db ../../poekhali-data/bureau.db --set-password)")
EOF
mkdir -p "$SITE/tmp" && touch "$SITE/tmp/restart.txt"
echo
echo "  Готово. Ученикам: http://$(basename "$SITE")/   Преподавателю: http://$(basename "$SITE")/#/teacher"
