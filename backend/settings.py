import eel
import webbrowser
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from .config import PASTA_TEMP, SCOPES
from .utils import _garantir_pasta_temp, _extrair_numero_ordem
from .drive import _ler_ordem_drive, _salvar_ordem_drive
from .library import _rodar_com_timeout
from concurrent.futures import TimeoutError as FuturesTimeoutError

@eel.expose
def obter_pasta_temp():
    _garantir_pasta_temp()
    return PASTA_TEMP

@eel.expose
def testar_ponte_python(mensagem_do_html):
    return "✅ Conexão perfeita! O Python assumiu o controle da nave."

@eel.expose
def abrir_no_browser(url):
    webbrowser.open(url)

@eel.expose
def reindexar_cursos_drive(id_pasta_raiz):
    def tarefa():
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        drive_service = build('drive', 'v3', credentials=creds)

        query_pastas = f"'{id_pasta_raiz}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        pastas = drive_service.files().list(q=query_pastas, fields='files(id, name)').execute().get('files', [])

        reindexados = []
        ja_tinham = []
        for pasta in pastas:
            existente, _ = _ler_ordem_drive(drive_service, pasta['id'])
            if existente:
                ja_tinham.append(pasta['name'])
                continue

            query_arq = f"'{pasta['id']}' in parents and trashed=false"
            arquivos = drive_service.files().list(q=query_arq, fields='files(id, name)').execute().get('files', [])
            arquivos = [a for a in arquivos if not a['name'].startswith('_')]
            arquivos.sort(key=lambda x: _extrair_numero_ordem(x['name']))

            entradas = [{'nome': a['name'], 'ordem': i} for i, a in enumerate(arquivos)]
            _salvar_ordem_drive(drive_service, pasta['id'], {
                'curso': pasta['name'],
                'arquivos': entradas,
            })
            reindexados.append(pasta['name'])

        return reindexados, ja_tinham

    try:
        reindexados, ja_tinham = _rodar_com_timeout(tarefa, timeout=60)
        return {"sucesso": True, "reindexados": reindexados, "ja_tinham": ja_tinham}
    except FuturesTimeoutError:
        return {"erro": "timeout", "mensagem": "A reindexação excedeu 60s. Tente de novo."}
    except Exception as e:
        return {"erro": str(e)}
