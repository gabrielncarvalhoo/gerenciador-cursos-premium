import ctypes
import os

app_id = 'GerenciadorCursos.App.1.0'
ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(app_id)

import eel
import threading

# Inicializa Eel ANTES de importar os módulos que usam @eel.expose
eel.init('web')

# Importa os módulos para registrar as funções @eel.expose
import backend.telegram
import backend.library
import backend.transfer
import backend.settings

# HLS Server Integration
try:
    from hls_server import iniciar_servidor as _iniciar_hls
    _hls_disponivel = True
except ImportError:
    _hls_disponivel = False

if _hls_disponivel:
    t = threading.Thread(target=_iniciar_hls, daemon=True)
    t.start()
    print('[HLS] Thread do servidor iniciada.')

if __name__ == '__main__':
    print("🚀 Servidor Python rodando! Abrindo interface...")
    eel.start(
        'index.html',
        size=(1280, 850),
        cmdline_args=[
            '--disable-http-cache',
            '--user-data-dir=' + os.path.join(
                os.path.expanduser('~'),
                'AppData', 'Local', 'GerenciadorCursos', 'ChromeProfile'
            )
        ]
    )