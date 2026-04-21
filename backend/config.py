import os
import threading
from concurrent.futures import ThreadPoolExecutor

API_ID = 38758752
API_HASH = '3a639cac45cfa78c3d3277309610840f'
SCOPES = ['https://www.googleapis.com/auth/drive.file']
PASTA_TEMP = os.path.join(os.path.expanduser('~'), 'Downloads', 'GerenciadorTemp')
PASTA_CACHE_FOTOS = os.path.join('web', 'cache_fotos')

DRIVE_TIMEOUT = 15
DRIVE_CHUNKSIZE = 25 * 1024 * 1024

WATCHDOG_TIMEOUT = 300
WATCHDOG_CHECK_INTERVAL = 30
CONN_CHECK_INTERVAL = 60
MAX_RETRIES_ARQUIVO = 3
FILA_MAX = 2

_POOL_BIBLIOTECA = ThreadPoolExecutor(max_workers=4, thread_name_prefix='drive-library')
_POOL_UPLOAD = ThreadPoolExecutor(max_workers=2, thread_name_prefix='drive-upload')

parar_evento = threading.Event()
_download_thread = None
_download_task_atual = None
_event_loop_atual = None
_ultimo_progresso_ts = 0.0

ORDEM_FILENAME = '_ordem.json'
