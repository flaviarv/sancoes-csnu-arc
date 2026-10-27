"""
api/index.py — Serverless Function Python para a Vercel.
"""
import os
import sys

# Garante que a raiz do projeto esteja no sys.path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from main_docker import app, load_csnu_dataset

# Carrega o Parquet a partir da raiz do projeto
PARQUET_PATH = os.path.join(ROOT_DIR, "csnu_list.parquet")
load_csnu_dataset(PARQUET_PATH)
