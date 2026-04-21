"""
Servidor HLS local para transmitir vídeos do Google Drive.

Usa ffmpeg para transcodificar on-the-fly a partir de uma URL do Drive
e expõe playlist/segmentos para o hls.js do front-end.

Endpoints:
    GET /stream/{file_id}/playlist.m3u8?url=<drive_url>
    GET /stream/{file_id}/{segment}
    GET /stop/{file_id}

Chamado em thread daemon pelo main.py via iniciar_servidor().
"""
import os
import shutil
import asyncio
import tempfile
import subprocess

from aiohttp import web

PORTA = 8765
_PASTA_BASE = os.path.join(tempfile.gettempdir(), 'hls_streams')
_processos = {}


def _pasta_video(file_id):
    return os.path.join(_PASTA_BASE, file_id)


async def handle_playlist(request):
    file_id = request.match_info['file_id']
    pasta = _pasta_video(file_id)
    playlist = os.path.join(pasta, 'playlist.m3u8')

    # Inicia ffmpeg se ainda não existir processo ativo
    proc = _processos.get(file_id)
    if proc is None or proc.returncode is not None:
        os.makedirs(pasta, exist_ok=True)
        # Obtém URL de streaming do Drive via parâmetro ?url=
        drive_url = request.rel_url.query.get('url', '')
        if not drive_url:
            raise web.HTTPBadRequest(text='Parâmetro url ausente')

        cmd = [
            'ffmpeg', '-y',
            '-i', drive_url,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-f', 'hls',
            '-hls_time', '4',
            '-hls_list_size', '3',
            '-hls_flags', 'delete_segments+temp_file',
            '-hls_segment_filename', os.path.join(pasta, '%03d.ts'),
            playlist,
        ]
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        _processos[file_id] = proc

    # Aguarda até 10s o primeiro segmento aparecer
    for _ in range(20):
        if os.path.exists(playlist):
            break
        await asyncio.sleep(0.5)

    if not os.path.exists(playlist):
        raise web.HTTPNotFound(text='Playlist não gerada')

    with open(playlist, 'rb') as f:
        content = f.read()
    return web.Response(
        body=content,
        content_type='application/vnd.apple.mpegurl',
        headers={'Access-Control-Allow-Origin': '*'},
    )


async def handle_segment(request):
    file_id = request.match_info['file_id']
    segment = request.match_info['segment']
    caminho = os.path.join(_pasta_video(file_id), segment)
    if not os.path.exists(caminho):
        raise web.HTTPNotFound()
    with open(caminho, 'rb') as f:
        data = f.read()
    return web.Response(
        body=data,
        content_type='video/mp2t',
        headers={'Access-Control-Allow-Origin': '*'},
    )


async def handle_options(request):
    return web.Response(
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        }
    )


async def handle_stop(request):
    file_id = request.match_info['file_id']
    if file_id in _processos:
        try:
            _processos[file_id].terminate()
            del _processos[file_id]
        except Exception:
            pass
    pasta = _pasta_video(file_id)
    if os.path.exists(pasta):
        shutil.rmtree(pasta, ignore_errors=True)
    return web.Response(
        text='ok',
        headers={'Access-Control-Allow-Origin': '*'},
    )


def criar_app():
    app = web.Application()
    app.router.add_get('/stream/{file_id}/playlist.m3u8', handle_playlist)
    app.router.add_route('HEAD', '/stream/{file_id}/playlist.m3u8', handle_playlist)
    app.router.add_get('/stream/{file_id}/{segment}', handle_segment)
    app.router.add_get('/stop/{file_id}', handle_stop)
    app.router.add_options('/{path_info:.*}', handle_options)
    return app


def iniciar_servidor():
    """Chamado em thread daemon pelo main.py."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    app = criar_app()
    runner = web.AppRunner(app)
    loop.run_until_complete(runner.setup())
    site = web.TCPSite(runner, 'localhost', PORTA)
    loop.run_until_complete(site.start())
    print(f'[HLS] Servidor rodando em http://localhost:{PORTA}')
    loop.run_forever()


if __name__ == '__main__':
    iniciar_servidor()
