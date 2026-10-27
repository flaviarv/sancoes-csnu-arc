"""
app.py — Entrypoint para o Hugging Face Spaces.
Usa o servidor FastAPI interno do próprio Gradio para servir o Frontend React
na raiz (/) e a API em /check-names e /api/check-names, sem conflito de porta 7860.
"""
import os
import gradio as gr
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.routing import Route, Mount
from main_docker import (
    load_csnu_dataset,
    check_names,
    CheckNamesRequest,
    CheckNamesResponse,
)

# Carrega o dataset Parquet imediatamente
load_csnu_dataset("csnu_list.parquet")

with gr.Blocks(title="CSNU Sanctions Checker") as demo:
    gr.Markdown("CSNU Sanctions Checker")

# O Gradio possui uma instância FastAPI interna (demo.app).
# Registramos nossas rotas da API diretamente nela:
fastapi_app = demo.app
fastapi_app.post("/check-names", response_model=CheckNamesResponse)(check_names)
fastapi_app.post("/api/check-names", response_model=CheckNamesResponse)(check_names)

STATIC_DIR = "static"
if os.path.isdir(STATIC_DIR):
    async def serve_spa_index(request):
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

    # Insere a rota "/" e "/assets" no TOPO da lista de rotas do FastAPI do Gradio
    # para que ao acessar a URL principal, abra o nosso Frontend React e não a tela do Gradio!
    fastapi_app.router.routes.insert(
        0, Mount("/assets", app=StaticFiles(directory=f"{STATIC_DIR}/assets"), name="react_assets")
    )
    fastapi_app.router.routes.insert(
        0, Route("/", endpoint=serve_spa_index, methods=["GET"])
    )

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
