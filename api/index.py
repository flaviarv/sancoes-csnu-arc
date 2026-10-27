"""
api/index.py — Serverless Function Python para a Vercel.
Responde às chamadas POST /api/check-names e /check-names.
"""
import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from main import app
