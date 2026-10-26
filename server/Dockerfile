# «Поехали!» — lesson server + game in one image. Build from the repository root:
#   docker compose up --build        (see docker-compose.yml)
# The same image runs the isolated checker service: python -m bureau_server.checker --serve

# ---- 1. game (React + Pyodide, all assets local, no CDN)
FROM node:22-slim AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY frontend/ ./
COPY content/ /src/content/
COPY packages/ /src/packages/
COPY assets/ /src/assets/
RUN npm run build

# ---- 2. Python: lesson server, judge, content
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir "fastapi>=0.115" "uvicorn[standard]>=0.30"
COPY server/bureau_server server/bureau_server
COPY packages/judge packages/judge
COPY content content
COPY --from=web /src/frontend/dist frontend/dist
RUN useradd --create-home --uid 10001 bureau && mkdir -p /app/server/data && chown bureau /app/server/data
USER bureau
WORKDIR /app/server
EXPOSE 8000
CMD ["python", "-m", "bureau_server", "--host", "0.0.0.0", "--port", "8000"]
