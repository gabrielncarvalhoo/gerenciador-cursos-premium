import io
import json
import os
import eel
import asyncio
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload

from .config import SCOPES, DRIVE_CHUNKSIZE, ORDEM_FILENAME
from .utils import _normalizar_nome

def _listar_nomes_no_drive(id_pasta_raiz, nome_canal):
    creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    drive_service = build('drive', 'v3', credentials=creds)

    query_pasta = (
        f"'{id_pasta_raiz}' in parents and name='{nome_canal}' "
        f"and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )
    res = drive_service.files().list(q=query_pasta, fields='files(id, name)').execute()
    pastas = res.get('files', [])
    if not pastas:
        return set()
    id_pasta_curso = pastas[0]['id']

    arq_res = drive_service.files().list(
        q=f"'{id_pasta_curso}' in parents and trashed=false",
        fields='files(name)'
    ).execute()
    return {
        _normalizar_nome(a['name'])
        for a in arq_res.get('files', [])
        if not a['name'].startswith('_')
    }

def _ler_ordem_drive(drive_service, id_pasta_curso):
    query = f"'{id_pasta_curso}' in parents and name='{ORDEM_FILENAME}' and trashed=false"
    res = drive_service.files().list(q=query, fields='files(id, name)').execute()
    arquivos = res.get('files', [])
    if not arquivos:
        return None, None
    file_id = arquivos[0]['id']
    try:
        conteudo = drive_service.files().get_media(fileId=file_id).execute()
        return json.loads(conteudo.decode('utf-8')), file_id
    except Exception:
        return None, file_id

def _salvar_ordem_drive(drive_service, id_pasta_curso, data, file_id=None):
    conteudo = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
    media = MediaIoBaseUpload(io.BytesIO(conteudo), mimetype='application/json', resumable=False)

    if file_id:
        drive_service.files().update(fileId=file_id, media_body=media).execute()
    else:
        metadata = {'name': ORDEM_FILENAME, 'parents': [id_pasta_curso], 'mimeType': 'application/json'}
        drive_service.files().create(body=metadata, media_body=media, fields='id').execute()

def _mesclar_ordem(ordem_existente, novas_entradas):
    atual = ordem_existente.get('arquivos', []) if ordem_existente else []
    nomes_existentes = {e['nome'] for e in atual}
    for entrada in novas_entradas:
        if entrada['nome'] not in nomes_existentes:
            atual.append({'nome': entrada['nome'], 'ordem': entrada['ordem']})
            nomes_existentes.add(entrada['nome'])
    return atual

def _upload_sync(drive_service, caminho_local, nome_original, id_pasta_destino):
    try:
        metadados_arquivo = {'name': nome_original, 'parents': [id_pasta_destino]}
        media = MediaFileUpload(caminho_local, resumable=True, chunksize=DRIVE_CHUNKSIZE)
        try:
            arquivo_criado = drive_service.files().create(
                body=metadados_arquivo, media_body=media, fields='id'
            ).execute()
            novo_file_id = arquivo_criado.get('id')
        finally:
            del media

        try:
            drive_service.permissions().create(
                fileId=novo_file_id,
                body={'type': 'anyone', 'role': 'reader'},
            ).execute()
        except Exception as e_perm:
            try:
                eel.addLogVisual(f"⚠️ Permissão pública falhou em {nome_original}: {e_perm}")()
            except Exception:
                pass

        return {'nome': nome_original, 'file_id': novo_file_id}
    except Exception as e:
        return {'erro': str(e), 'nome': nome_original, 'caminho': caminho_local}
