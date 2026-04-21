import asyncio
import os
import time
import eel
import threading
from telethon import TelegramClient
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from .config import (
    API_ID, API_HASH, SCOPES, WATCHDOG_TIMEOUT, WATCHDOG_CHECK_INTERVAL,
    CONN_CHECK_INTERVAL, MAX_RETRIES_ARQUIVO, FILA_MAX, parar_evento
)
import backend.config as config
from .utils import _garantir_pasta_temp
from .drive import _upload_sync, _ler_ordem_drive, _salvar_ordem_drive, _mesclar_ordem

@eel.expose
def parar_transferencia_python():
    parar_evento.set()
    try:
        eel.addLogVisual("⏳ Parada registrada — cancelando download atual...")()
    except Exception:
        pass
    try:
        if config._download_task_atual and config._event_loop_atual and not config._download_task_atual.done():
            config._event_loop_atual.call_soon_threadsafe(config._download_task_atual.cancel)
    except Exception as e:
        try:
            eel.addLogVisual(f"⚠️ Falha ao cancelar download atual: {e}")()
        except Exception:
            pass

def _remover_arquivo_parcial(caminho):
    try:
        if caminho and os.path.exists(caminho):
            os.remove(caminho)
            return True
    except Exception:
        pass
    return False

async def _check_connection(client):
    try:
        while not parar_evento.is_set():
            await asyncio.sleep(CONN_CHECK_INTERVAL)
            try:
                if not client.is_connected():
                    try:
                        eel.addLogVisual("🔌 Telegram desconectado — reconectando...")()
                    except Exception:
                        pass
                    try:
                        await client.connect()
                        try:
                            eel.addLogVisual("🔌 Telegram reconectado.")()
                        except Exception:
                            pass
                    except Exception as e:
                        try:
                            eel.addLogVisual(f"⚠️ Falha ao reconectar Telegram: {e}")()
                        except Exception:
                            pass
            except Exception:
                pass
    except asyncio.CancelledError:
        pass

async def _watchdog(cancelador):
    try:
        while not parar_evento.is_set():
            await asyncio.sleep(WATCHDOG_CHECK_INTERVAL)
            if config._ultimo_progresso_ts == 0:
                continue
            delta = time.time() - config._ultimo_progresso_ts
            if delta > WATCHDOG_TIMEOUT:
                try:
                    eel.addLogVisual(
                        f"🐕 Watchdog: {int(delta)}s sem progresso — cancelando arquivo atual."
                    )()
                except Exception:
                    pass
                try:
                    cancelador()
                except Exception:
                    pass
                config._ultimo_progresso_ts = 0
    except asyncio.CancelledError:
        pass

async def _produtor(client, mensagens, ordens, total_bytes, total, fila):
    bytes_acumulados = 0
    concluidos = 0

    for msg in mensagens:
        if parar_evento.is_set():
            break

        nome_original = msg.file.name if (msg.file and msg.file.name) else f"Aula_{msg.id}.mp4"
        ordem_msg = ordens.get(str(msg.id), msg.id)
        bytes_arquivo = msg.file.size if (msg.file and msg.file.size) else 0

        pasta_temp = _garantir_pasta_temp()
        caminho_temp = os.path.join(pasta_temp, nome_original)

        sucesso = False
        for tentativa in range(1, MAX_RETRIES_ARQUIVO + 1):
            if parar_evento.is_set():
                break

            ultimo_tick = [0.0]
            marcos_emitidos = set()
            inicio_ts = [time.monotonic()]

            def _progress_cb(current, _total_bruto,
                             base_acum=bytes_acumulados, conc=concluidos,
                             tick=ultimo_tick, marcos=marcos_emitidos,
                             nome=nome_original, tam=bytes_arquivo, inicio=inicio_ts):
                config._ultimo_progresso_ts = time.time()

                agora = time.monotonic()

                if tam > 0:
                    pct = int((current / tam) * 100)
                    marco = (pct // 25) * 25
                    if 25 <= marco <= 100 and marco not in marcos:
                        marcos.add(marco)
                        decorrido = max(agora - inicio[0], 0.001)
                        mb_s = (current / (1024 * 1024)) / decorrido
                        try:
                            eel.addLogVisual(
                                f"⬇️ {nome} — {marco}% "
                                f"({current/(1024*1024):.1f} / {tam/(1024*1024):.1f} MB) — "
                                f"{mb_s:.2f} MB/s"
                            )()
                        except Exception:
                            pass

                if agora - tick[0] < 0.15 and current < _total_bruto:
                    return
                tick[0] = agora
                try:
                    eel.progressoBytesVisual(
                        base_acum + current, total_bytes, conc, total
                    )()
                except Exception:
                    pass

            try:
                try:
                    eel.addLogVisual(
                        f"⬇️ Baixando ({tentativa}/{MAX_RETRIES_ARQUIVO}): {nome_original}"
                    )()
                except Exception:
                    pass

                config._ultimo_progresso_ts = time.time()

                task = asyncio.ensure_future(
                    client.download_media(msg, file=caminho_temp, progress_callback=_progress_cb)
                )
                config._download_task_atual = task
                caminho_local = await task
                config._download_task_atual = None
                config._ultimo_progresso_ts = 0.0

                bytes_acumulados += bytes_arquivo
                concluidos += 1
                try:
                    eel.progressoBytesVisual(bytes_acumulados, total_bytes, concluidos, total)()
                except Exception:
                    pass

                await fila.put((caminho_local, nome_original, int(ordem_msg)))
                sucesso = True
                break

            except asyncio.CancelledError:
                config._download_task_atual = None
                _remover_arquivo_parcial(caminho_temp)
                if parar_evento.is_set():
                    try:
                        eel.addLogVisual(
                            f"🛑 Download cancelado. Arquivo parcial removido: {nome_original}"
                        )()
                    except Exception:
                        pass
                    return
                try:
                    eel.addLogVisual(
                        f"♻️ Reiniciando {nome_original} (tentativa {tentativa}/{MAX_RETRIES_ARQUIVO})..."
                    )()
                except Exception:
                    pass
                await asyncio.sleep(2)
                continue

            except Exception as e:
                config._download_task_atual = None
                _remover_arquivo_parcial(caminho_temp)
                try:
                    eel.addLogVisual(
                        f"❌ Erro no download de {nome_original}: {e} "
                        f"(tentativa {tentativa}/{MAX_RETRIES_ARQUIVO})"
                    )()
                except Exception:
                    pass
                await asyncio.sleep(2)
                continue

        if not sucesso and not parar_evento.is_set():
            try:
                eel.addLogVisual(
                    f"⏭️ Pulando {nome_original} após {MAX_RETRIES_ARQUIVO} tentativas falhas."
                )()
            except Exception:
                pass

async def _consumidor(drive_service, id_pasta_destino, fila, resultados_ref):
    loop = asyncio.get_event_loop()
    while True:
        item = await fila.get()
        try:
            if item is None:
                break
            caminho_local, nome_original, ordem_msg = item
            try:
                eel.addLogVisual(f"☁️ Subindo: {nome_original}")()
            except Exception:
                pass
            resultado = await loop.run_in_executor(
                config._POOL_UPLOAD, _upload_sync,
                drive_service, caminho_local, nome_original, id_pasta_destino
            )
            if isinstance(resultado, dict) and not resultado.get('erro'):
                resultados_ref.append({'nome': nome_original, 'ordem': ordem_msg})
                try:
                    eel.addLogVisual(f"✅ {nome_original}")()
                except Exception:
                    pass
            else:
                erro = resultado.get('erro') if isinstance(resultado, dict) else str(resultado)
                try:
                    eel.addLogVisual(f"⚠️ Falhou no upload de {nome_original}: {erro}")()
                except Exception:
                    pass

            for _ in range(3):
                try:
                    if os.path.exists(caminho_local):
                        os.remove(caminho_local)
                    break
                except Exception:
                    await asyncio.sleep(0.3)
        finally:
            fila.task_done()

async def _motor_transferencia(nome_canal, id_pasta_raiz, lista_ids, ordens):
    try:
        try:
            eel.addLogVisual("🔄 Conectando ao Google Drive...")()
        except Exception:
            pass
        if not os.path.exists('token.json'):
            try:
                eel.addLogVisual("❌ Erro: token.json não encontrado.")()
                eel.finalizarTransferenciaVisual()()
            except Exception:
                pass
            return

        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        drive_service = build('drive', 'v3', credentials=creds)
        try:
            eel.addLogVisual("✅ Drive conectado!")()
        except Exception:
            pass

        try:
            eel.addLogVisual(f"📁 Configurando pasta '{nome_canal}' no Drive...")()
        except Exception:
            pass
        query_pasta = (
            f"'{id_pasta_raiz}' in parents and name='{nome_canal}' "
            f"and mimeType='application/vnd.google-apps.folder' and trashed=false"
        )
        res_pasta = drive_service.files().list(q=query_pasta, fields="files(id, name)").execute()
        pastas_encontradas = res_pasta.get('files', [])

        if not pastas_encontradas:
            metadados_pasta = {
                'name': nome_canal,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [id_pasta_raiz],
            }
            pasta_curso = drive_service.files().create(body=metadados_pasta, fields='id').execute()
            id_pasta_destino = pasta_curso.get('id')
            try:
                eel.addLogVisual(f"✅ Nova pasta '{nome_canal}' criada!")()
            except Exception:
                pass
        else:
            id_pasta_destino = pastas_encontradas[0].get('id')
            try:
                eel.addLogVisual(f"✅ Pasta '{nome_canal}' encontrada.")()
            except Exception:
                pass

        ordem_data, ordem_file_id = _ler_ordem_drive(drive_service, id_pasta_destino)
        if not ordem_data:
            ordem_data = {'curso': nome_canal, 'arquivos': []}

        async with TelegramClient(
            'sessao_estudos', API_ID, API_HASH,
            timeout=30,
            connection_retries=10,
            request_retries=5,
            retry_delay=5,
            auto_reconnect=True,
            sequential_updates=False,
        ) as client:
            client.flood_sleep_threshold = 60

            canal_alvo = None
            async for conversa in client.iter_dialogs():
                if conversa.name and conversa.name.strip().lower() == nome_canal.strip().lower():
                    canal_alvo = conversa
                    break

            if not canal_alvo:
                try:
                    eel.addLogVisual("❌ Canal não encontrado no Telegram.")()
                    eel.finalizarTransferenciaVisual()()
                except Exception:
                    pass
                return

            ids_inteiros = [int(i) for i in lista_ids]
            mensagens_raw = await client.get_messages(canal_alvo, ids=ids_inteiros)
            mensagens = [m for m in mensagens_raw if m is not None]
            mensagens.sort(key=lambda m: m.id)

            total = len(mensagens)
            if total == 0:
                try:
                    eel.addLogVisual("❌ Nenhuma das mensagens selecionadas foi encontrada.")()
                    eel.finalizarTransferenciaVisual()()
                except Exception:
                    pass
                return

            total_bytes = sum(
                (m.file.size if m.file and m.file.size else 0) for m in mensagens
            )
            try:
                eel.addLogVisual(
                    f"🚀 Iniciando {total} arquivo(s) ({total_bytes / (1024*1024):.1f} MB totais)..."
                )()
                eel.progressoBytesVisual(0, total_bytes, 0, total)()
            except Exception:
                pass

            fila = asyncio.Queue(maxsize=FILA_MAX)
            resultados_ref = []

            def _cancelar_download_atual():
                t = config._download_task_atual
                if t and not t.done():
                    t.cancel()

            watchdog_task = asyncio.create_task(_watchdog(_cancelar_download_atual))
            conn_task = asyncio.create_task(_check_connection(client))
            consumidor_task = asyncio.create_task(
                _consumidor(drive_service, id_pasta_destino, fila, resultados_ref)
            )

            try:
                await _produtor(client, mensagens, ordens, total_bytes, total, fila)
                await fila.put(None)
                await consumidor_task
            finally:
                watchdog_task.cancel()
                conn_task.cancel()
                for t in (watchdog_task, conn_task):
                    try:
                        await t
                    except Exception:
                        pass

            if resultados_ref:
                try:
                    ordem_data['curso'] = nome_canal
                    ordem_data['arquivos'] = _mesclar_ordem(ordem_data, resultados_ref)
                    _salvar_ordem_drive(drive_service, id_pasta_destino, ordem_data, ordem_file_id)
                    eel.addLogVisual(
                        f"🗂️ Ordem salva em _ordem.json ({len(resultados_ref)} novos)."
                    )()
                except Exception as e_ord:
                    try:
                        eel.addLogVisual(f"⚠️ Não foi possível salvar _ordem.json: {e_ord}")()
                    except Exception:
                        pass

            try:
                if parar_evento.is_set():
                    eel.addLogVisual(
                        f"🛑 Download parado. {len(resultados_ref)} arquivo(s) concluído(s) de {total}."
                    )()
                else:
                    eel.addLogVisual("🏁 Fim da fila de transferência!")()
                eel.finalizarTransferenciaVisual()()
            except Exception:
                pass
    except Exception as erro_fatal:
        try:
            eel.addLogVisual(f"❌ Erro fatal: {erro_fatal}")()
            eel.finalizarTransferenciaVisual()()
        except Exception:
            pass

@eel.expose
def iniciar_transferencia_real(nome_canal, id_pasta_raiz, lista_ids, ordens=None):
    parar_evento.clear()
    ordens = ordens or {}

    if config._download_thread and config._download_thread.is_alive():
        try:
            eel.addLogVisual("⚠️ Já existe um download em andamento.")()
        except Exception:
            pass
        return

    def tarefa_em_background():
        try:
            eel.addLogVisual(
                "⚙️ Download rodando em background (thread dedicada). A Library segue responsiva."
            )()
        except Exception:
            pass

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        config._event_loop_atual = loop
        config._download_task_atual = None
        config._ultimo_progresso_ts = 0.0

        try:
            loop.run_until_complete(
                _motor_transferencia(nome_canal, id_pasta_raiz, lista_ids, ordens)
            )
        except Exception as erro_fatal:
            try:
                eel.addLogVisual(f"❌ Erro fatal: {erro_fatal}")()
                eel.finalizarTransferenciaVisual()()
            except Exception:
                pass
        finally:
            try:
                loop.close()
            except Exception:
                pass
            config._event_loop_atual = None
            config._download_task_atual = None
            config._ultimo_progresso_ts = 0.0

    config._download_thread = threading.Thread(
        target=tarefa_em_background,
        daemon=True,
        name='gerenciador-download',
    )
    config._download_thread.start()
