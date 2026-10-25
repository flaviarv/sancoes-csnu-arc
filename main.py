import unicodedata
from typing import List, Set
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd

app = FastAPI(title="Verificador de Sanções CSNU")

# Variável global para armazenar o conjunto normalizado de nomes do CSNU
SANCTIONED_NAMES: Set[str] = set()


def normalize_text(text: str) -> str:
    """Normaliza texto: remove acentos, espaços extras e converte para minúsculas."""
    if not isinstance(text, str):
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(text.strip().lower().split())


def load_csnu_dataset(parquet_path: str = "csnu_list.parquet"):
    """
    Carrega o arquivo Parquet e extrai todos os nomes completos e aliases.
    Adapte as colunas conforme a estrutura exata do seu arquivo.
    """
    global SANCTIONED_NAMES
    try:
        df = pd.read_parquet(parquet_path)
    except Exception as e:
        print(f"Erro ao carregar arquivo Parquet: {e}")
        return

    extracted_names = set()

    for _, row in df.iterrows():
        # 1. Composição de nome de indivíduos (First, Second, Third, Fourth Name)
        parts = [
            str(row[col])
            for col in ["FIRST_NAME", "SECOND_NAME", "THIRD_NAME", "FOURTH_NAME"]
            if col in row and pd.notna(row[col]) and str(row[col]).strip()
        ]
        if parts:
            full_name = " ".join(parts)
            extracted_names.add(normalize_text(full_name))

        # 2. Nome original ou nomes de entidades
        for col in ["NAME_ORIGINAL_SCRIPT"]:
            if col in row and pd.notna(row[col]):
                extracted_names.add(normalize_text(str(row[col])))

        # 3. Aliases de indivíduos (listas de dicionários com ALIAS_NAME)
        if "INDIVIDUAL_ALIAS" in row and isinstance(row["INDIVIDUAL_ALIAS"], list):
            for alias in row["INDIVIDUAL_ALIAS"]:
                if isinstance(alias, dict) and "ALIAS_NAME" in alias and alias["ALIAS_NAME"]:
                    extracted_names.add(normalize_text(str(alias["ALIAS_NAME"])))

        # 4. Aliases de entidades
        if "ENTITY_ALIAS" in row and isinstance(row["ENTITY_ALIAS"], list):
            for alias in row["ENTITY_ALIAS"]:
                if isinstance(alias, dict) and "ALIAS_NAME" in alias and alias["ALIAS_NAME"]:
                    extracted_names.add(normalize_text(str(alias["ALIAS_NAME"])))

    # Remove entradas vazias
    SANCTIONED_NAMES = {name for name in extracted_names if name}
    print(f"Dataset carregado: {len(SANCTIONED_NAMES)} nomes únicos indexados.")


@app.on_event("startup")
def startup_event():
    load_csnu_dataset("csnu_list.parquet")


# Modelos da API
class CheckNamesRequest(BaseModel):
    raw_input: str  # Texto enviado pelo usuário contendo os nomes


class NameResult(BaseModel):
    name: str
    is_contained: bool
    message: str


class CheckNamesResponse(BaseModel):
    results: List[NameResult]


@app.post("/check-names", response_model=CheckNamesResponse)
def check_names(payload: CheckNamesRequest):
    """
    Recebe um texto com vários nomes (um por linha) e valida contra a lista do CSNU.
    """
    if not payload.raw_input.strip():
        raise HTTPException(status_code=400, detail="Nenhum nome fornecido.")

    # Divide o texto por linha
    raw_lines = payload.raw_input.splitlines()
    results = []

    for line in raw_lines:
        line_clean = line.strip()

        # Ignora linhas em branco
        if not line_clean:
            continue

        normalized_query = normalize_text(line_clean)

        # Regra 2 e 3: Analisa se o nome está na lista do CSNU
        is_in_csnu = normalized_query in SANCTIONED_NAMES

        if is_in_csnu:
            msg = f"O nome '{line_clean}' está contido na lista CSNU."
        else:
            msg = f"O nome '{line_clean}' não está contido na lista do CSNU."

        results.append(
            NameResult(
                name=line_clean,
                is_contained=is_in_csnu,
                message=msg
            )
        )

    return CheckNamesResponse(results=results)

# ======================================================
#               INTERFACE SWAGGER
# ======================================================

from fastapi.responses import HTMLResponse

@app.get("/", response_class=HTMLResponse)
def index():
    return """
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Consulta CSNU</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; }
            textarea { width: 100%; height: 180px; padding: 10px; font-size: 14px; box-sizing: border-box; }
            button { background-color: #007bff; color: white; border: none; padding: 10px 20px; font-size: 16px; cursor: pointer; margin-top: 10px; border-radius: 4px; }
            button:hover { background-color: #0056b3; }
            .result { margin-top: 20px; padding: 10px; border-radius: 4px; font-weight: bold; }
            .contained { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .not-contained { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        </style>
    </head>
    <body>
        <h2>Verificador de Sanções - CSNU</h2>
        <p>Cole ou digite os nomes abaixo (<strong>apenas 1 nome por linha</strong>):</p>
        <textarea id="namesInput" placeholder="Exemplo:&#10;Noor Wali Mehsud&#10;João da Silva&#10;Abubakar Swalleh"></textarea><br>
        <button onclick="verificar()">Verificar Nomes</button>

        <div id="output"></div>

        <script>
            async function verificar() {
                const text = document.getElementById('namesInput').value;
                const output = document.getElementById('output');
                output.innerHTML = 'Consultando...';

                try {
                    const response = await fetch('/check-names', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ raw_input: text })
                    });
                    const data = await response.json();
                    output.innerHTML = '';
                    
                    data.results.forEach(res => {
                        const div = document.createElement('div');
                        div.className = 'result ' + (res.is_contained ? 'contained' : 'not-contained');
                        div.innerText = res.message;
                        output.appendChild(div);
                    });
                } catch (e) {
                    output.innerHTML = '<p style="color:red">Erro ao consultar o servidor.</p>';
                }
            }
        </script>
    </body>
    </html>
    """

