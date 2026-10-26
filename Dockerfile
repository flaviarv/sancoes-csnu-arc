# ─────────────────────────────────────────────
# Stage 1 — build do frontend React/Vite
# ─────────────────────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /app

# Instala bun
RUN npm install -g bun@1

# Copia dependências e instala
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile

# Copia código fonte
COPY frontend/index.html frontend/vite.config.ts frontend/tsconfig.json frontend/tailwind.config.js frontend/postcss.config.js ./
COPY frontend/src/ ./src/

# Build de produção (FastAPI serve os arquivos estáticos)
RUN bunx vite build

# ─────────────────────────────────────────────
# Stage 2 — backend FastAPI + arquivos estáticos
# ─────────────────────────────────────────────
FROM python:3.13-slim

WORKDIR /app

# Dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Dependências Python
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Código do backend (versão Docker com static files)
COPY main_docker.py ./main.py
COPY csnu_list.parquet ./csnu_list.parquet

# Frontend compilado (copiado do stage anterior)
COPY --from=frontend-build /app/dist ./static

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
