"""
app.py — Entrypoint para o Hugging Face Spaces (SDK Gradio gratuito).
Inicia o servidor FastAPI (com o frontend compilado em static/) na porta 7860.
"""
import uvicorn
from main_docker import app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
