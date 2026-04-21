import re
import os
from .config import PASTA_TEMP

def _slug_canal(nome):
    return re.sub(r'[^\w\-]+', '_', (nome or '')).strip('_').lower() or 'canal'

def _normalizar_nome(s):
    return re.sub(r'\s+', ' ', (s or '').strip()).lower()

def _garantir_pasta_temp():
    os.makedirs(PASTA_TEMP, exist_ok=True)
    return PASTA_TEMP

def _extrair_numero_ordem(nome):
    match = re.search(r'\d+', nome)
    return int(match.group()) if match else 0
