import re
import os
from .config import PASTA_TEMP

def _slug_canal(nome):
    return re.sub(r'[^\w\-]+', '_', (nome or '')).strip('_').lower() or 'canal'

def _limpar_markdown(texto):
    """Remove formatação Markdown (bold, italic, code, links) de textos."""
    if not texto:
        return texto
    texto = re.sub(r'\*\*(.*?)\*\*', r'\1', texto)
    texto = re.sub(r'__(.*?)__', r'\1', texto)
    texto = re.sub(r'\*(.*?)\*', r'\1', texto)
    texto = re.sub(r'_(.*?)_', r'\1', texto)
    texto = re.sub(r'`(.*?)`', r'\1', texto)
    texto = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', texto)
    return texto.strip()

def _normalizar_nome(s):
    texto = _limpar_markdown(s)
    return re.sub(r'\s+', ' ', (texto or '').strip()).lower()

def _sanitizar_nome_arquivo(nome):
    """Remove caracteres especiais que quebram queries do Drive API ou nomes de arquivo."""
    if not nome:
        return nome
    # Primeiro limpa os problemáticos para API do Drive / filesystem
    limpo = re.sub(r'[\\/*?:"<>|]', '', nome)
    # Espaços múltiplos → single space
    limpo = re.sub(r'\s+', ' ', limpo.strip())
    return limpo

def _garantir_pasta_temp():
    os.makedirs(PASTA_TEMP, exist_ok=True)
    return PASTA_TEMP

def _extrair_numero_ordem(nome):
    match = re.search(r'\d+', nome)
    return int(match.group()) if match else 0
