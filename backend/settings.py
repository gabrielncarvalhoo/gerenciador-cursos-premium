import eel
import asyncio
import os
import webbrowser
from telethon import TelegramClient
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from .config import API_ID, API_HASH, PASTA_TEMP, SCOPES
from .utils import _garantir_pasta_temp, _normalizar_nome, _sanitizar_nome_arquivo
from .drive import _ler_ordem_drive, _salvar_ordem_drive, renomear_curso_drive as _renomear_impl
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
def reindexar_curso_pelo_telegram(nome_canal, id_pasta_raiz):
    """
    Reindexa um curso usando a ordem real do Telegram.
    1. Coleta TODAS as mensagens com arquivo do canal (SEM reverse=True).
    2. Ordena por msg.id crescente → ordem cronológica real.
    3. Faz match com arquivos já no Drive.
    4. Salva novo _ordem.json na pasta do curso.
    """
    def tarefa():
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        drive_service = build('drive', 'v3', credentials=creds)

        # 1. Encontrar pasta do curso no Drive
        query_pasta = (
            f"'{id_pasta_raiz}' in parents and name='{nome_canal}' "
            f"and mimeType='application/vnd.google-apps.folder' and trashed=false"
        )
        pastas = drive_service.files().list(
            q=query_pasta, fields='files(id, name)'
        ).execute().get('files', [])
        if not pastas:
            return {'sucesso': False, 'erro': 'Pasta do curso não encontrada no Drive.'}
        id_pasta_curso = pastas[0]['id']

        # 2. Coletar mensagens do Telegram (SEM reverse=True → newest→oldest)
        #    ordenar por msg.id crescente = ordem cronológica real
        async def coletar_telegram():
            mapa = {}  # nome_normalizado → ordem_idx
            async with TelegramClient('sessao_estudos', API_ID, API_HASH) as client:
                canal_alvo = None
                async for conversa in client.iter_dialogs():
                    if conversa.name and conversa.name.strip().lower() == nome_canal.strip().lower():
                        canal_alvo = conversa
                        break
                if not canal_alvo:
                    return {}

                todas_msgs = []
                async for msg in client.iter_messages(canal_alvo):
                    if (msg.video or msg.document) and not (msg.file and msg.file.ext == '.webp'):
                        todas_msgs.append(msg)

                todas_msgs.sort(key=lambda m: m.id)

                for idx, msg in enumerate(todas_msgs):
                    nome_raw = msg.file.name if (msg.file and msg.file.name) else f"Aula_{msg.id}"
                    nome_limpo = _sanitizar_nome_arquivo(nome_raw)
                    chave = _normalizar_nome(nome_limpo)
                    if chave:
                        mapa[chave] = idx
                return mapa

        mapa_tg = asyncio.run(coletar_telegram())
        if not mapa_tg:
            return {'sucesso': False, 'erro': 'Nenhuma mensagem com arquivo encontrada no Telegram.'}

        # Ordenar mensagens por msg.id crescente → menor id = mais antigo = ordem 0
        nomes_ordenados = sorted(mapa_tg.keys(), key=lambda k: mapa_tg[k])

        # 3. Listar arquivos do Drive (paginação obrigatória, filtrar '_')
        arquivos_all = []
        page_token = None
        while True:
            res = drive_service.files().list(
                q=f"'{id_pasta_curso}' in parents and trashed=false",
                fields='files(name), nextPageToken',
                pageSize=500, pageToken=page_token
            ).execute()
            arquivos_all.extend(res.get('files', []))
            page_token = res.get('nextPageToken')
            if not page_token:
                break
        arquivos_drive = [a for a in arquivos_all if not a['name'].startswith('_')]

        # 4. Match: arquivo do Drive → posição na ordem do Telegram
        matched = 0
        sem_match = 0
        entradas = []

        for arq in arquivos_drive:
            nome_limpo = _sanitizar_nome_arquivo(arq['name'])
            chave = _normalizar_nome(nome_limpo)
            if chave in mapa_tg:
                pos = nomes_ordenados.index(chave)
                entradas.append({'nome': arq['name'], 'ordem': pos})
                matched += 1
            else:
                sem_match += 1

        # Arquivos sem match vão para o final (ordem = matched + idx)
        for i, arq in enumerate([a for a in arquivos_drive if _normalizar_nome(_sanitizar_nome_arquivo(a['name'])) not in mapa_tg]):
            nome_limpo = _sanitizar_nome_arquivo(arq['name'])
            entradas.append({'nome': arq['name'], 'ordem': matched + i})

        # 5. Buscar _ordem.json existente e deduplicar
        ordem_existente, file_id_existente = _ler_ordem_drive(drive_service, id_pasta_curso)

        arquivos_vistos = set()
        arquivos_unicos = []
        for arq in entradas:
            if arq['nome'] not in arquivos_vistos:
                arquivos_vistos.add(arq['nome'])
                arquivos_unicos.append(arq)
        entradas = arquivos_unicos

        # 6. Salvar _ordem.json (update se existe, create se não)
        ordem_data = {'curso': nome_canal, 'arquivos': entradas}
        _salvar_ordem_drive(drive_service, id_pasta_curso, ordem_data, file_id_existente)

        return {'sucesso': True, 'total': len(arquivos_drive), 'matched': matched, 'sem_match': sem_match}

    try:
        resultado = _rodar_com_timeout(tarefa, timeout=120)
        if isinstance(resultado, dict) and not resultado.get('sucesso') and resultado.get('erro'):
            return resultado
        return resultado
    except FuturesTimeoutError:
        return {'sucesso': False, 'erro': 'timeout', 'mensagem': 'Reindexação excedeu 120s.'}


@eel.expose
def renomear_curso_drive(id_pasta_curso):
    return _renomear_impl(id_pasta_curso)
