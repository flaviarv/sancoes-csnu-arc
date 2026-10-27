"""
scripts/etl_csnu.py
Extrai a lista consolidada de sanções do CSNU diretamente da ONU,
normaliza nomes e aliases e atualiza os artefatos da aplicação.
"""
import os
import json
import urllib.request
import unicodedata
import xml.etree.ElementTree as ET
import pandas as pd

UN_XML_URL = "https://scsanctions.un.org/resources/xml/en/consolidated.xml"

# Diretórios base
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARQUET_OUTPUT = os.path.join(BASE_DIR, "csnu_list.parquet")
PUBLIC_JSON_OUTPUT = os.path.join(BASE_DIR, "public", "sanctioned_names.json")
STATIC_JSON_OUTPUT = os.path.join(BASE_DIR, "static", "sanctioned_names.json")


def normalize_text(text: str) -> str:
    """Normalização idêntica à usada no backend e frontend."""
    if not isinstance(text, str):
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(text.strip().lower().split())


def download_un_xml(url: str) -> bytes:
    print(f"Baixando lista oficial de sanções da ONU: {url}")
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CSNU-Checker/1.0"}
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read()


def run_etl():
    xml_data = download_un_xml(UN_XML_URL)
    root = ET.fromstring(xml_data)

    records = []
    extracted_names = set()

    # 1. Processar Indivíduos
    individuals = root.find("INDIVIDUALS")
    if individuals is not None:
        for ind in individuals.findall("INDIVIDUAL"):
            first_name = (ind.findtext("FIRST_NAME") or "").strip()
            second_name = (ind.findtext("SECOND_NAME") or "").strip()
            third_name = (ind.findtext("THIRD_NAME") or "").strip()
            fourth_name = (ind.findtext("FOURTH_NAME") or "").strip()
            original_script = (ind.findtext("NAME_ORIGINAL_SCRIPT") or "").strip()

            # Nome completo composto
            parts = [p for p in [first_name, second_name, third_name, fourth_name] if p]
            if parts:
                extracted_names.add(normalize_text(" ".join(parts)))

            if original_script:
                extracted_names.add(normalize_text(original_script))

            # Aliases de indivíduos
            individual_aliases = []
            for alias in ind.findall("INDIVIDUAL_ALIAS"):
                alias_name = (alias.findtext("ALIAS_NAME") or "").strip()
                if alias_name:
                    extracted_names.add(normalize_text(alias_name))
                    individual_aliases.append({"ALIAS_NAME": alias_name})

            records.append({
                "DATAID": ind.findtext("DATAID"),
                "FIRST_NAME": first_name,
                "SECOND_NAME": second_name,
                "THIRD_NAME": third_name,
                "FOURTH_NAME": fourth_name,
                "NAME_ORIGINAL_SCRIPT": original_script,
                "INDIVIDUAL_ALIAS": individual_aliases,
                "ENTITY_ALIAS": None,
                "RECORD_TYPE": "INDIVIDUAL"
            })

    # 2. Processar Entidades (Pessoas Jurídicas / Grupos)
    entities = root.find("ENTITIES")
    if entities is not None:
        for ent in entities.findall("ENTITY"):
            entity_name = (ent.findtext("FIRST_NAME") or "").strip()
            original_script = (ent.findtext("NAME_ORIGINAL_SCRIPT") or "").strip()

            if entity_name:
                extracted_names.add(normalize_text(entity_name))

            if original_script:
                extracted_names.add(normalize_text(original_script))

            # Aliases de entidades
            entity_aliases = []
            for alias in ent.findall("ENTITY_ALIAS"):
                alias_name = (alias.findtext("ALIAS_NAME") or "").strip()
                if alias_name:
                    extracted_names.add(normalize_text(alias_name))
                    entity_aliases.append({"ALIAS_NAME": alias_name})

            records.append({
                "DATAID": ent.findtext("DATAID"),
                "FIRST_NAME": entity_name,
                "SECOND_NAME": "",
                "THIRD_NAME": "",
                "FOURTH_NAME": "",
                "NAME_ORIGINAL_SCRIPT": original_script,
                "INDIVIDUAL_ALIAS": None,
                "ENTITY_ALIAS": entity_aliases,
                "RECORD_TYPE": "ENTITY"
            })

    # Limpeza final e ordenação
    sanctioned_names_sorted = sorted([n for n in extracted_names if n])
    print(f"ETL Concluído: {len(records)} registros processados.")
    print(f"Total de nomes/aliases únicos indexados: {len(sanctioned_names_sorted)}")

    # 3. Salvar JSON estático (para o Frontend)
    for path in [PUBLIC_JSON_OUTPUT, STATIC_JSON_OUTPUT]:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(sanctioned_names_sorted, f, ensure_ascii=False, indent=2)
        print(f"Arquivo salvo: {path}")

    # 4. Salvar Parquet (para o Backend)
    df = pd.DataFrame(records)
    df.to_parquet(PARQUET_OUTPUT, index=False)
    print(f"Arquivo Parquet salvo: {PARQUET_OUTPUT}")


if __name__ == "__main__":
    run_etl()
