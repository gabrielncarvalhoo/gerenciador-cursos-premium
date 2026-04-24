import eel
from concurrent.futures import TimeoutError as FuturesTimeoutError
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from .config import SCOPES, _POOL_BIBLIOTECA, DRIVE_TIMEOUT
from .utils import _extrair_numero_ordem, _limpar_markdown
from .drive import _ler_ordem_drive

def _rodar_com_timeout(funcao, timeout=DRIVE_TIMEOUT):
    future = _POOL_BIBLIOTECA.submit(funcao)
    return future.result(timeout=timeout)

@eel.expose
def carregar_cursos_drive(id_pasta_raiz):
    def consulta():
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        drive_service = build('drive', 'v3', credentials=creds)

        query = f"'{id_pasta_raiz}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        pastas_all = []
        page_token = None
        while True:
            res = drive_service.files().list(
                q=query, fields='files(id, name), nextPageToken',
                pageSize=500, pageToken=page_token
            ).execute()
            pastas_all.extend(res.get('files', []))
            page_token = res.get('nextPageToken')
            if not page_token:
                break
        pastas = [p for p in pastas_all if not p['name'].startswith('_')]

        cursos = []
        for pasta in pastas:
            query_aulas = f"'{pasta['id']}' in parents and trashed=false"
            aulas_all = []
            page_token = None
            while True:
                res = drive_service.files().list(
                    q=query_aulas, fields='files(id, name), nextPageToken',
                    pageSize=500, pageToken=page_token
                ).execute()
                aulas_all.extend(res.get('files', []))
                page_token = res.get('nextPageToken')
                if not page_token:
                    break
            aulas_visiveis = [a for a in aulas_all if not _limpar_markdown(a['name']).startswith('_')]
            cursos.append({
                'id': pasta['id'],
                'title': _limpar_markdown(pasta['name']),
                'tag': 'CURSO SALVO',
                'total_lessons': len(aulas_visiveis),
                'image': 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=800'
            })
        return cursos

    try:
        cursos = _rodar_com_timeout(consulta)
        return {"sucesso": True, "cursos": cursos}
    except FuturesTimeoutError:
        return {"erro": "timeout", "mensagem": f"A consulta ao Google Drive demorou mais que {DRIVE_TIMEOUT}s."}
    except Exception as e:
        return {"erro": str(e)}

@eel.expose
def carregar_aulas_curso(id_pasta_curso):
    def consulta():
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        drive_service = build('drive', 'v3', credentials=creds)

        query = f"'{id_pasta_curso}' in parents and trashed=false"
        arquivos = []
        page_token = None
        while True:
            res = drive_service.files().list(
                q=query, fields='files(id, name, mimeType), nextPageToken',
                pageSize=500, pageToken=page_token
            ).execute()
            arquivos.extend(res.get('files', []))
            page_token = res.get('nextPageToken')
            if not page_token:
                break
        ordem_data, _ = _ler_ordem_drive(drive_service, id_pasta_curso)
        return arquivos, ordem_data

    try:
        arquivos, ordem_data = _rodar_com_timeout(consulta)

        arquivos = [a for a in arquivos if not _limpar_markdown(a['name']).startswith('_')]

        if ordem_data and ordem_data.get('arquivos'):
            mapa_ordem = {e['nome']: e['ordem'] for e in ordem_data['arquivos']}
            pos_faltante = max(mapa_ordem.values(), default=-1) + 1
            def chave(a):
                return mapa_ordem.get(a['name'], pos_faltante)
            arquivos.sort(key=chave)
        else:
            arquivos.sort(key=lambda x: _extrair_numero_ordem(x['name']))

        aulas = []
        for i, arq in enumerate(arquivos):
            aulas.append({
                'id': arq['id'],
                'num': str(i + 1).zfill(3),
                'title': _limpar_markdown(arq['name']),
                'type': 'video' if 'video' in arq['mimeType'] else 'document',
                'link': f"https://drive.google.com/file/d/{arq['id']}/preview"
            })
        return {"sucesso": True, "aulas": aulas}
    except FuturesTimeoutError:
        return {"erro": "timeout", "mensagem": f"Leitura do curso excedeu {DRIVE_TIMEOUT}s."}
    except Exception as e:
        return {"erro": str(e)}

@eel.expose
def obter_link_aula(file_id):
    preview = f"https://drive.google.com/file/d/{file_id}/preview"
    download = f"https://drive.google.com/uc?export=download&id={file_id}"
    drive_url = f"https://drive.google.com/file/d/{file_id}/view"

    def checar_e_corrigir():
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        drive_service = build('drive', 'v3', credentials=creds)

        is_processing = False
        try:
            meta = drive_service.files().get(
                fileId=file_id, fields='mimeType,videoMediaMetadata'
            ).execute()
            if (meta.get('mimeType') or '').startswith('video/'):
                if not meta.get('videoMediaMetadata'):
                    is_processing = True
        except Exception:
            pass

        perms = drive_service.permissions().list(
            fileId=file_id, fields='permissions(id,type,role)'
        ).execute()
        publico = any(p.get('type') == 'anyone' for p in perms.get('permissions', []))
        if publico:
            return {'is_public': True, 'is_processing': is_processing}
        try:
            drive_service.permissions().create(
                fileId=file_id,
                body={'type': 'anyone', 'role': 'reader'},
            ).execute()
            return {'is_public': True, 'is_processing': is_processing}
        except Exception:
            return {'is_public': False, 'is_processing': is_processing}

    try:
        info = _rodar_com_timeout(checar_e_corrigir)
        is_public = info.get('is_public')
        is_processing = info.get('is_processing', False)
    except Exception:
        is_public = None
        is_processing = False

    return {
        "sucesso": True,
        "is_public": is_public,
        "is_processing": is_processing,
        "preview_url": preview,
        "download_url": download,
        "drive_url": drive_url,
    }
