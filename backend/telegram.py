import eel
import asyncio
import os
from telethon import TelegramClient
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from .config import API_ID, API_HASH, SCOPES, PASTA_CACHE_FOTOS
from .utils import _normalizar_nome, _slug_canal, _sanitizar_nome_arquivo, _limpar_markdown
from .drive import _listar_nomes_no_drive, _garantir_pasta_capas, _upload_capa_drive

@eel.expose
def buscar_aulas_real(nome_canal, id_pasta_raiz=None):
    print(f"\\n[COMANDO] Buscando: '{nome_canal}'")

    nomes_no_drive = set()
    if id_pasta_raiz:
        try:
            nomes_no_drive = _listar_nomes_no_drive(id_pasta_raiz, nome_canal)
        except Exception as e:
            print(f"[WARN] Falha ao listar arquivos no Drive: {e}")

    async def buscar():
        async with TelegramClient('sessao_estudos', API_ID, API_HASH) as client:
            canal_alvo = None
            async for conversa in client.iter_dialogs():
                if conversa.name and conversa.name.strip().lower() == nome_canal.strip().lower():
                    canal_alvo = conversa
                    break

            if not canal_alvo:
                return {"erro": "Canal não encontrado no Telegram."}

            aulas_encontradas = []
            ordem_idx = 0
            async for msg in client.iter_messages(canal_alvo):
                if (msg.video or msg.document) and not (msg.file and msg.file.ext == '.webp'):
                    texto_bruto = msg.text[:60].replace('\\n', ' ') if msg.text else (msg.file.name if msg.file and msg.file.name else f"Arquivo_{msg.id}")
                    txt = _limpar_markdown(texto_bruto)
                    tamanho = f"{msg.file.size / (1024 * 1024):.1f} MB" if msg.file and msg.file.size else "Desconhecido"
                    nome_arquivo = msg.file.name if (msg.file and msg.file.name) else f"Aula_{msg.id}.mp4"
                    nome_limpo = _sanitizar_nome_arquivo(nome_arquivo)
                    chave = _normalizar_nome(nome_limpo)
                    ja_no_drive = chave in nomes_no_drive
                    aulas_encontradas.append({
                        'id': msg.id,
                        'nome': txt,
                        'tamanho': tamanho,
                        'ordem': ordem_idx,
                        'nome_arquivo': nome_arquivo,
                        'nome_arquivo_limpo': nome_limpo,
                        'ja_no_drive': ja_no_drive,
                    })
                    ordem_idx += 1
            return {"sucesso": True, "aulas": aulas_encontradas}

    try:
        return asyncio.run(buscar())
    except Exception as e:
        return {"erro": str(e)}

@eel.expose
def verificar_sincronia(nome_canal, id_pasta_raiz):
    resp = buscar_aulas_real(nome_canal, id_pasta_raiz)
    if resp.get('erro'):
        return {'erro': resp['erro']}
    aulas_tg = resp.get('aulas', [])
    nomes_tg = {_normalizar_nome(a.get('nome_arquivo_limpo') or a['nome_arquivo']) for a in aulas_tg}

    faltando = [
        {
            'id': a['id'],
            'nome_arquivo': a['nome_arquivo'],
            'nome_arquivo_limpo': a.get('nome_arquivo_limpo') or a['nome_arquivo'],
            'tamanho': a['tamanho'],
            'ordem': a['ordem'],
        }
        for a in aulas_tg if not a.get('ja_no_drive')
    ]

    extra = []
    try:
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        drive_service = build('drive', 'v3', credentials=creds)
        query_pasta = (
            f"'{id_pasta_raiz}' in parents and name='{nome_canal}' "
            f"and mimeType='application/vnd.google-apps.folder' and trashed=false"
        )
        res = drive_service.files().list(q=query_pasta, fields='files(id, name)').execute()
        pastas = res.get('files', [])
        if pastas:
            id_pasta_curso = pastas[0]['id']
            arq_res = drive_service.files().list(
                q=f"'{id_pasta_curso}' in parents and trashed=false",
                fields='files(id, name)'
            ).execute()
            for a in arq_res.get('files', []):
                if _limpar_markdown(a['name']).startswith('_'):
                    continue
                if _normalizar_nome(a['name']) not in nomes_tg:
                    extra.append({'nome': a['name']})
    except Exception as e:
        return {'erro': f'Falha ao listar Drive: {e}'}

    return {
        'sucesso': True,
        'total_telegram': len(aulas_tg),
        'faltando_no_drive': faltando,
        'extra_no_drive': extra,
    }

@eel.expose
def obter_fotos_canais(lista_nomes, id_pasta_raiz=None):
    os.makedirs(PASTA_CACHE_FOTOS, exist_ok=True)
    resultado = {}
    pendentes = []
    for nome in lista_nomes:
        slug = _slug_canal(nome)
        caminho = os.path.join(PASTA_CACHE_FOTOS, f"{slug}.jpg")
        if os.path.exists(caminho) and os.path.getsize(caminho) > 0:
            resultado[nome] = f"/cache_fotos/{slug}.jpg"
        else:
            pendentes.append(nome)

    if not pendentes:
        return resultado

    drive_service = None
    id_pasta_capas = None
    if id_pasta_raiz:
        try:
            creds = Credentials.from_authorized_user_file('token.json', SCOPES)
            drive_service = build('drive', 'v3', credentials=creds)
            id_pasta_capas = _garantir_pasta_capas(drive_service, id_pasta_raiz)
        except Exception:
            drive_service = None

    async def baixar_todos():
        async with TelegramClient(
            'sessao_estudos', API_ID, API_HASH,
            connection_retries=5, request_retries=5
        ) as client:
            mapa_dialogs = {}
            async for conversa in client.iter_dialogs():
                if conversa.name:
                    mapa_dialogs[conversa.name.strip().lower()] = conversa

            for nome in pendentes:
                conversa = mapa_dialogs.get(nome.strip().lower())
                if not conversa:
                    continue
                slug = _slug_canal(nome)
                caminho = os.path.join(PASTA_CACHE_FOTOS, f"{slug}.jpg")
                try:
                    path = await client.download_profile_photo(conversa, file=caminho)
                    if path and os.path.exists(caminho) and os.path.getsize(caminho) > 0:
                        resultado[nome] = f"/cache_fotos/{slug}.jpg"
                        # Upload para Drive após baixar do Telegram
                        if drive_service and id_pasta_capas:
                            _upload_capa_drive(drive_service, caminho, id_pasta_capas, nome)
                except Exception:
                    pass

    try:
        asyncio.run(baixar_todos())
    except Exception as e:
        print(f"[WARN] Falha ao baixar fotos de canais: {e}")
    return resultado
