# Gerenciador de Cursos — Instruções para Claude Code

## O que é
App desktop Windows (Python + Eel) que baixa vídeos/arquivos de canais do Telegram e faz upload para o Google Drive, com uma biblioteca integrada para assistir as aulas.

## Como rodar
```bat
REM Instalar dependências (primeira vez)
instalar.bat

REM Iniciar
iniciar.bat
REM equivale a: py -3.12 main.py
```

## Regras críticas

### Python
- **Python 3.12 obrigatório** — `iniciar.bat` usa `py -3.12`, nenhuma outra versão
- `sessao_estudos.session` é a sessão Telegram — **nunca recriar sem rodar fluxo de auth** — é machine-specific (arquivo diferente em cada PC)
- `token.json` e `credentials.json` — não estão no git, obtidos separadamente

### Arquivos internos
- Arquivos e pastas com nome começando em `_` são **internos do sistema** (ex: `_ordem.json`, `_capas/`)
- Nunca exibidos ao usuário na UI
- Filtro: `not name.startswith('_')` em todo lugar onde listamos arquivos do Drive

### Telegram — iter_messages
- `client.iter_messages(canal_alvo)` — **sem `reverse=True`** — retorna do mais novo para o mais antigo (padrão Telethon)
- `ordem_idx` começa em 0 para a mensagem mais nova
- Na transferência, mensagens são re-ordenadas por `msg.id` crescente antes do download
- Não alterar esse comportamento sem entender o impacto em `_ordem.json`

### Padrão Eel (Python ↔ JS)
```python
# Python → expõe para JS
@eel.expose
def minha_funcao(arg):
    return {"sucesso": True}

# Python → chama JS
eel.funcaoJavaScript(args)()
```
```js
// JS → chama Python
const resp = await eel.minha_funcao(arg)();

// JS → recebe do Python (precisa registrar)
eel.expose(minhaFuncaoJS);
function minhaFuncaoJS(dados) { ... }
```

### localStorage — prefixo de perfil
- Toda chave de progresso, notas e posição usa `_getPrefixo()` → `perfil_NOME_`
- Nunca salvar dados de usuário sem usar o prefixo
- Exceções (globais sem perfil): `rootDriveRootId`, `perfilAtivo`, `listaPerfis`, `canaisHistorico`, `agendamentosTransferencia`

### Nunca recriar arquivos sem ler antes
- Antes de editar qualquer arquivo Python ou JS, ler o arquivo completo
- A lógica de threading e asyncio em `transfer.py` é frágil — não refatorar sem entender o fluxo completo

## Quando usar cada modelo de IA

**Regra:** Ao final de cada resposta (ou quando a tarefa sugerir uma próxima ação), indicar qual modelo usar para o próximo passo.

| Situação | Modelo | Ferramenta |
|---|---|---|
| JS/CSS/HTML, backend Python geral, novas features, bugs, Drive API, Telegram, Eel, pequenas refatorações | MiniMax 2.7 | Claude Code |
| Refatorações críticas, threading/asyncio, bugs difíceis que MiniMax não resolveu | Sonnet 4.6 | Claude Code |
| Arquitetura muito complexa, problemas que Sonnet não resolveu | Opus 4.7 | Claude Code |
| Componentes visuais Tailwind, layout, UI completa | Gemini 3.1 Pro | Antigravity |
| Código de performance, completions rápidos, experimentos | qwen3-coder | — |
| Decisões arquiteturais, debug difícil, análise de trade-offs | Claude.ai | — |

**Regra:** Preferir MiniMax sempre que possível — escalar para Sonnet/Opus só quando a complexidade exigir.

**Exemplos de indicação ao final da resposta:**
- "Próximo passo → **MiniMax 2.7** no Claude Code"
- "Motor de transferência (threading) → **Sonnet 4.6** no Claude Code"
- "Novo componente visual → **Gemini 3.1 Pro** no Antigravity"

## Estrutura dos arquivos

```
gerenciador-cursos/
├── main.py                  # Entry point — inicializa Eel, importa módulos, sobe HLS thread
├── hls_server.py            # Servidor aiohttp local (porta 8765) para streaming HLS via ffmpeg
├── GerenciadorCursos.spec   # Config PyInstaller para gerar .exe
├── iniciar.bat              # py -3.12 main.py
├── instalar.bat             # pip install dependências
├── build.bat                # PyInstaller build
├── atualizar.bat            # git pull + restart (provavelmente)
├── sessao_estudos.session   # Sessão Telethon — machine-specific, fora do git
├── token.json               # Auth Google OAuth2 — fora do git
├── credentials.json         # Credenciais Google API — fora do git
├── backend/
│   ├── config.py            # Constantes globais: API_ID, API_HASH, pools, timeouts, evento de parada
│   ├── utils.py             # Funções puras: _slug_canal, _limpar_markdown, _normalizar_nome, _sanitizar_nome_arquivo
│   ├── drive.py             # Drive API: upload, _ordem.json, capas, renomear, limpar nomes
│   ├── library.py           # @eel.expose: carregar_cursos_drive, carregar_aulas_curso, obter_link_aula
│   ├── telegram.py          # @eel.expose: buscar_aulas_real, verificar_sincronia, obter_fotos_canais
│   ├── transfer.py          # @eel.expose: iniciar_transferencia_real, parar_transferencia_python + motor async
│   └── settings.py          # @eel.expose: reindexar_cursos_drive, renomear_curso_drive, obter_pasta_temp
└── web/
    ├── index.html           # SPA — 4 views: download, library, player, settings
    ├── css/style.css        # Estilos customizados (Tailwind é via CDN)
    ├── cache_fotos/         # Fotos de perfil dos canais Telegram — fora do git
    └── js/
        ├── state.js         # libraryState global, _getPrefixo(), scroll save/restore
        ├── profiles.js      # Sistema de perfis (múltiplos usuários por máquina)
        ├── history.js       # Histórico de canais pesquisados (localStorage)
        ├── navigation.js    # showView(), renderSettings(), verificarSincronia(), reindexar
        ├── library.js       # renderLibrary(), openCourse(), carregarFotosCanais()
        ├── player.js        # playLesson(), playHLS(), fallback em cascata (HLS → iframe → card)
        ├── progress.js      # toggleLessonWatched(), getProgress(), saveLastLesson(), notas de posição
        ├── notes.js         # Notas por aula (localStorage com debounce 1s)
        └── download.js      # buscarAulasBotao(), iniciarTransferencia(), agendamentos
```

## Padrões de código

### Backend — funções Eel
```python
@eel.expose
def nome_funcao(arg):
    def tarefa():
        # lógica pesada aqui
        return resultado
    try:
        resultado = _rodar_com_timeout(tarefa)   # ou _rodar_com_timeout(tarefa, timeout=60)
        return {"sucesso": True, "dados": resultado}
    except FuturesTimeoutError:
        return {"erro": "timeout", "mensagem": "..."}
    except Exception as e:
        return {"erro": str(e)}
```

### Drive — paginação obrigatória
```python
page_token = None
while True:
    res = drive_service.files().list(q=query, fields='files(id, name), nextPageToken',
                                     pageSize=500, pageToken=page_token).execute()
    items.extend(res.get('files', []))
    page_token = res.get('nextPageToken')
    if not page_token:
        break
```

### JS → Python e de volta
```js
// Padrão com timeout duplo (frontend + backend)
const promessaDrive = eel.funcao_python(args)();
const promessaTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000));
const resp = await Promise.race([promessaDrive, promessaTimeout]);
```

### localStorage com prefixo
```js
// SEMPRE assim para dados por perfil
const prefixo = _getPrefixo();  // → "perfil_default_"
localStorage.setItem(prefixo + 'minha_chave', valor);
localStorage.getItem(prefixo + 'minha_chave');
```

## Problemas frequentes

| Problema | Causa | Solução |
|---|---|---|
| Canal não encontrado no Telegram | Nome não bate exatamente (case-insensitive mas sem trim) | Verificar espaços no nome do canal |
| `token.json` expirado | OAuth2 refresh token inválido | Deletar token.json e re-autenticar via Google |
| HLS não inicia | ffmpeg não instalado | Instalar ffmpeg e adicionar ao PATH |
| Player não carrega vídeo | Drive ainda processando o vídeo | Aguardar; app detecta `videoMediaMetadata` ausente |
| `_ordem.json` desatualizado | Novos arquivos adicionados ao canal depois do download | Settings → Reindexar Cursos |
| Nomes com `**` no Drive | Telegram envia texto com markdown | Settings → Limpar Nomes |
| `sessao_estudos.session` inválida | Sessão expirou ou PC diferente | Rodar fluxo Telethon de auth no PC correto |
| Download para em 300s | Watchdog timeout | Normal — arquivo corrompido ou sem progresso; será pulado |

## Skills, plugins e arquivos anexados

Gabriel pode anexar arquivos de skills, plugins ou referências na conversa. Quando isso acontecer:
- Ler o conteúdo do anexo antes de responder
- Usar ativamente o que foi fornecido na tarefa em questão
- **Proativamente sugerir** quando um skill/plugin anexado seria útil para a tarefa atual — não esperar o usuário pedir

Exemplos de quando sugerir:
- Skill de geração de componente Tailwind → sugerir ao criar novo elemento de UI
- Plugin de integração Drive → sugerir ao trabalhar em `drive.py` ou `library.py`
- Referência de API Telethon → sugerir ao mexer em `telegram.py` ou `transfer.py`

## Fluxo git obrigatório
```bash
# Antes de qualquer alteração com IA
git commit -am "checkpoint: antes de <descrição>"

# Após alteração
git add backend/arquivo_alterado.py web/js/arquivo.js
git commit -m "fix/feat/refactor: descrição clara"
```
- Nunca commitar: `sessao_estudos.session`, `token.json`, `credentials.json`, `web/cache_fotos/`
- `.gitignore` já cobre tudo isso
