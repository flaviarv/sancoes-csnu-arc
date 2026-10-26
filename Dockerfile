# ─────────────────────────────────────────────
# Stage 1 — build do frontend React/Vite
# ─────────────────────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /app

# Instala bun
RUN npm install -g bun@1

# Copia dependências e instala
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copia código fonte
COPY index.html vite.config.ts tsconfig.json tailwind.config.js postcss.config.js ./
COPY src/ ./src/

# Build de produção (sem proxy — o FastAPI serve os arquivos estáticos)
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
COPY sancoes-csnu-arc/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir fastapi uvicorn pandas pyarrow aiofiles

# Código do backend (versão Docker com static files)
COPY main_docker.py ./main.py
COPY sancoes-csnu-arc/csnu_list.parquet ./csnu_list.parquet

# Frontend compilado (copiado do stage anterior)
COPY --from=frontend-build /app/dist ./static

# Entrypoint
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 7860

CMD ["./entrypoint.sh"]
