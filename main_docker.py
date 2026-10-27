"""
main_docker.py — versão Docker/Vercel da API.
"""
from main import (
    app,
    load_csnu_dataset,
    check_names,
    CheckNamesRequest,
    CheckNamesResponse,
    NameResult,
)
