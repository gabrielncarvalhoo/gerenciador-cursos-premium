import io
import json
import os
import eel
import asyncio
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload

from .config import SCOPES, DRIVE_CHUNKSIZE, ORDEM_FILENAME, PASTA_CACHE_FOTOS
from .utils import _normalizar_nome, _sanitizar_nome_arquivo, _slug_canal

CAPAS_FOLDER_NAME = '_capas'


def _garantir_pasta_capas(drive_service, id_pasta_raiz):
    query = (
        f"'{id_pasta_raiz}' in parents and name='{CAPAS_FOLDER_NAME}' "
        f"and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )
    res = drive_service.files().list(q=query, fields='files(id, name)').execute()
    pastas = res.get('files', [])
    if pastas:
        return pastas[0]['id']
    metadados = {
        'name': CAPAS_FOLDER_NAME,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [id_pasta_raiz],
    }
    nova = drive_service.files().create(body=metadados, fields='id').execute()
    return nova.get('id')


def _listar_capas_drive(drive_service, id_pasta_capas):
    res = drive_service.files().list(
        q=f"'{id_pasta_capas}' in parents and trashed=false",
        fields='files(name, id)'
    ).execute()
    return {a['name']: a['id'] for a in res.get('files', [])}


def _baixar_capa_drive(drive_service, file_id, caminho_local):
    try:
        os.makedirs(os.path.dirname(caminho_local), exist_ok=True)
        media = drive_service.files().get_media(fileId=file_id)
        with open(caminho_local, 'wb') as f:
            f.write(media.execute())
        return True
    except Exception:
        return False


def _upload_capa_drive(drive_service, caminho_local, id_pasta_capas, nome_curso):
    if not os.path.exists(caminho_local) or os.path.getsize(caminho_local) == 0:
        return False
    slug = _slug_canal(nome_curso)
    nome_arquivo = f"{slug}_capa.jpg"
    try:
        metadados = {'name': nome_arquivo, 'parents': [id_pasta_capas]}
        media = MediaFileUpload(caminho_local, mimetype='image/jpeg', resumable=False)
        drive_service.files().create(body=metadados, media_body=media, fields='id').execute()
        return True
    except Exception:
        return False


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
        _normalizar_nome(_sanitizar_nome_arquivo(a['name']))
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


@eel.expose
def sincronizar_capas(id_pasta_raiz, nomes_cursos):
    """Para cada curso sem capa local, tenta baixar do Drive. Retorna quantos sincronizou."""
    try:
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        drive_service = build('drive', 'v3', credentials=creds)
    except Exception as e:
        return {'erro': str(e), 'sincronizados': 0}

    try:
        id_pasta_capas = _garantir_pasta_capas(drive_service, id_pasta_raiz)
    except Exception as e:
        return {'erro': f'Falha ao criar/acesser pasta _capas: {e}', 'sincronizados': 0}

    capas_no_drive = _listar_capas_drive(drive_service, id_pasta_capas)
    sincronizados = 0

    for nome_curso in nomes_cursos:
        slug = _slug_canal(nome_curso)
        caminho_local = os.path.join(PASTA_CACHE_FOTOS, f"{slug}.jpg")

        # a) já existe local? pular
        if os.path.exists(caminho_local) and os.path.getsize(caminho_local) > 0:
            continue

        # b) existe no Drive?
        nome_arquivo = f"{slug}_capa.jpg"
        if nome_arquivo not in capas_no_drive:
            continue

        if _baixar_capa_drive(drive_service, capas_no_drive[nome_arquivo], caminho_local):
            sincronizados += 1

    return {'sincronizados': sincronizados, 'total': len(nomes_cursos)}
