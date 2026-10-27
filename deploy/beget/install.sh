#!/usr/bin/env bash
# «Поехали!» on Beget shared hosting (Passenger): install or update. In the hosting terminal:
#   git clone https://github.com/nestjest/poekhali ~/poekhali && bash ~/poekhali/deploy/beget/install.sh
#   update: cd ~/poekhali && git pull && bash deploy/beget/install.sh
# Argument: the site folder (default ~/<login>.beget.tech). Data and settings: ~/poekhali-data (env, bureau.db).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SITE="${1:-$HOME/$(whoami).beget.tech}"
DATA="$HOME/poekhali-data"
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
npm ci --no-audit --no-fund
npm run build

echo "== 3/4 Python packages"
[ -x "$REPO/.venv/bin/python" ] || python3 -m venv "$REPO/.venv"
"$REPO/.venv/bin/pip" install -q --upgrade pip
"$REPO/.venv/bin/pip" install -q "fastapi>=0.115" "a2wsgi>=1.10" "psycopg[binary]>=3.2"

echo "== 4/4 site $SITE"
mkdir -p "$DATA" && chmod 700 "$DATA"
[ -f "$DATA/env" ] || printf 'BUREAU_PUBLIC_URL=https://%s\n' "$(basename "$SITE")" > "$DATA/env"
chmod 600 "$DATA/env"
PUB="$SITE/public_html"
mkdir -p "$PUB"
# Beget's placeholder page goes to the data folder once (index.php would win over index.html).
[ -f "$PUB/index.php" ] && mv "$PUB/index.php" "$DATA/index.php.beget"
find "$PUB" -mindepth 1 -maxdepth 1 ! -name cgi-bin ! -name .htaccess -exec rm -rf {} +
cp -a "$REPO/frontend/dist/." "$PUB/"
cat > "$PUB/.htaccess" <<EOF
PassengerEnabled On
PassengerPython $REPO/.venv/bin/python
EOF
sed -e "s#@REPO@#$REPO#g" -e "s#@DATA@#$DATA#g" "$REPO/deploy/beget/passenger_wsgi.py" > "$SITE/passenger_wsgi.py"
mkdir -p "$SITE/tmp" && touch "$SITE/tmp/restart.txt"

# The teacher password lives in the database; a new SQLite database gets a generated one (shown once).
cd "$SITE"
"$REPO/.venv/bin/python" - <<'EOF'
import passenger_wsgi as app
from bureau_server.__main__ import readable_password

store = app.asgi.state.store
if not store.has_password():
    pw = readable_password()
    store.set_password(pw)
    print(f"\n  Пароль преподавателя: {pw}\n  (запишите; сменить: cd ~/poekhali/server && ../.venv/bin/python -m bureau_server --db ~/poekhali-data/bureau.db --set-password)")
EOF
echo
echo "  Готово. Ученикам: https://$(basename "$SITE")/   Преподавателю: https://$(basename "$SITE")/#/teacher"
