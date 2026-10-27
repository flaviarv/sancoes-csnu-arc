"""
api/check-names.py — Serverless Function dedicada na Vercel para /api/check-names.
Isso dispensa dependência de rewrites internos e responde diretamente na URL exata da chamada.
"""
import os
import sys

# Adiciona raiz do projeto ao path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(CURRENT_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from main import app
