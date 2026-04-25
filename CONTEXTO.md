# Gerenciador de Cursos — Contexto do Projeto
> Atualizado em: Abril 2026

## O que é
App desktop Windows para download e gestão de cursos. Baixa vídeos/arquivos de canais do Telegram e faz upload organizado para o Google Drive. Tem uma biblioteca integrada para assistir as aulas com controle de progresso, notas e perfis de usuário. Não é SaaS, não tem backend web — roda 100% local na máquina do usuário.

## Desenvolvedor
- **Nome:** Gabriel
- **Background:** Java
- **Ambiente principal:** Windows 11 + Python 3.12
- **Ambiente secundário:** outro PC (sessão Telegram diferente — `sessao_estudos.session` específica por máquina)

## Stack Tecnológica
| Camada | Tecnologia | Versão/Detalhe |
|---|---|---|
| Runtime | Python | 3.12 (obrigatório) |
| Bridge desktop | Eel | Python → Chromium embutido |
| Telegram client | Telethon | MTProto assíncrono |
| Google Drive | google-api-python-client | Drive API v3 |
| Streaming HLS | aiohttp + ffmpeg | Servidor local porta 8765 |
| Frontend | HTML + Tailwind (CDN) + Vanilla JS | Dark mode, Material Icons |
| Build | PyInstaller | GerenciadorCursos.exe |

## Fluxo de trabalho com IA

Claude deve **sempre indicar qual modelo usar** ao final de cada resposta ou quando sugerir próximo passo.

| Tarefa | Modelo | Ferramenta |
|---|---|---|
| JS/CSS/HTML, backend Python geral, features, bugs, Drive, Telegram, Eel, pequenas refatorações | MiniMax 2.7 | Claude Code |
| Refatorações críticas, threading/asyncio, bugs que MiniMax não resolveu | Sonnet 4.6 | Claude Code |
| Arquitetura muito complexa, problemas que Sonnet não resolveu | Opus 4.7 | Claude Code |
| Componentes visuais Tailwind, UI completa | Gemini 3.1 Pro | Antigravity |
| Performance, experimentos rápidos | qwen3-coder | — |
| Decisões, debug difícil, trade-offs | Claude.ai | — |

Regra: preferir MiniMax sempre — escalar para Sonnet/Opus só quando a complexidade exigir.

## Estrutura completa
```
gerenciador-cursos/
├── main.py                  # Entry point — inicia Eel + thread HLS
├── hls_server.py            # Servidor aiohttp para streaming via ffmpeg
├── GerenciadorCursos.spec   # Config PyInstaller
├── iniciar.bat              # py -3.12 main.py
├── instalar.bat             # pip install de todas as deps
├── build.bat                # gera dist/GerenciadorCursos/
├── atualizar.bat            # atualização do app
│
├── sessao_estudos.session   # [GIT IGNORE] Sessão Telethon — por máquina
├── token.json               # [GIT IGNORE] OAuth2 Google
├── credentials.json         # [GIT IGNORE] Credenciais Google API
├── .env.example             # Documenta arquivos que não estão no git
│
├── backend/
│   ├── config.py            # API_ID, API_HASH, pools de threads, timeouts, evento parar_evento
│   ├── utils.py             # Utilitários puros: slug, sanitizar, normalizar, limpar markdown
│   ├── drive.py             # Toda interação com Drive API: upload, _ordem.json, capas, rename
│   ├── library.py           # Eel: carregar_cursos_drive, carregar_aulas_curso, obter_link_aula
│   ├── telegram.py          # Eel: buscar_aulas_real, verificar_sincronia, obter_fotos_canais
│   ├── transfer.py          # Eel: motor de download/upload com watchdog, retry, progress
│   └── settings.py          # Eel: reindexar, renomear_curso, limpar_nomes, obter_pasta_temp
│
└── web/
    ├── index.html           # SPA completa (4 views em DOM único)
    ├── css/style.css        # Customizações além do Tailwind
    ├── cache_fotos/         # [GIT IGNORE] Fotos de perfil dos canais (jpg)
    └── js/
        ├── state.js         # libraryState, _getPrefixo(), scroll save/restore
        ├── profiles.js      # Sistema de perfis multi-usuário
        ├── history.js       # Histórico de canais pesquisados
        ├── navigation.js    # showView(), renderSettings(), verify sync, reindex
        ├── library.js       # Grade de cursos, openCourse(), fotos dos canais
        ├── player.js        # playLesson(), HLS, fallback iframe, video-card
        ├── progress.js      # Progresso por aula, last lesson, posição de vídeo
        ├── notes.js         # Anotações por aula (debounce 1s)
        └── download.js      # Busca Telegram, transferência, agendamentos
```

## Funcionalidades implementadas ✅

**Download Center**
- ✅ Busca aulas de canal Telegram por nome exato
- ✅ Marcação visual de arquivos já no Drive (cinza + ícone)
- ✅ Seleção múltipla com "Selecionar Todos"
- ✅ Toggle "Ocultar já baixados"
- ✅ Transferência Telegram → Drive com progresso em bytes
- ✅ Parada cooperativa (arquivo atual termina antes de parar)
- ✅ Retry automático por arquivo (3 tentativas)
- ✅ Watchdog de 300s — cancela download parado
- ✅ Reconexão automática ao Telegram
- ✅ Agendamento de transferências (localStorage, polling 60s)
- ✅ Histórico de canais pesquisados (chips clicáveis)

**Library**
- ✅ Grade de cursos lida do Google Drive
- ✅ Fotos de capa dos canais Telegram (cache local + Drive _capas/)
- ✅ Ordem das aulas por `_ordem.json` (ou número no nome como fallback)
- ✅ Busca em tempo real por título de curso e aula
- ✅ Player com fallback em cascata: HLS local → iframe Drive → video-card
- ✅ Retomada automática da última aula por curso
- ✅ Progresso por aula (marcador manual, barra por curso)
- ✅ Modal de confirmação para marcar aulas anteriores em lote
- ✅ Anotações por aula (localStorage, auto-save debounce 1s, ícone na lista)
- ✅ Refresh de lista de aulas sem interromper vídeo em reprodução
- ✅ Múltiplos perfis (progresso e notas isolados por perfil)

**Settings**
- ✅ Reindexar cursos (gera `_ordem.json` onde não existe)
- ✅ Limpar formatação markdown dos nomes de arquivos no Drive
- ✅ Renomeador de curso (por ID de pasta)
- ✅ Verificação de sincronia Telegram ↔ Drive (bidirecional)
- ✅ "Baixar todos faltantes" (integração Settings → Download Center com pré-seleção)

## Decisões arquiteturais importantes

**Eel como bridge desktop**
Escolhido por simplicidade: Python como backend, Chromium embutido como frontend. Alternativa seria Electron (muito mais pesado) ou PyQt (visual menos moderno).

**HLS local via ffmpeg**
Drive API não dá URL direta de stream — o iframe de preview funciona para documentos mas não é confiável para vídeos. Solução: transcodar via ffmpeg on-the-fly numa thread daemon e servir via aiohttp. Requer ffmpeg instalado manualmente.

**`_ordem.json` por pasta de curso**
Ordem real das aulas no canal não pode ser derivada apenas do nome do arquivo (cursos não têm numeração consistente). Arquivo JSON salvo dentro da pasta do curso no Drive preserva a ordem correta capturada no momento do download.

**Sem `reverse=True` no iter_messages**
Telethon retorna mensagens da mais nova para a mais antiga por padrão. `ordem_idx=0` para a mais nova. Na transferência, mensagens são re-ordenadas por `msg.id` antes do download. Comportamento foi ajustado e não deve ser alterado sem testar o impacto na _ordem.json.

**DOM nunca destruído — só hidden**
`showView()` esconde views com `display:none`, nunca remove do DOM. Preserva estado do player (vídeo continua tocando ao trocar de aba).

**Multi-perfil via localStorage prefix**
Sem banco de dados. `_getPrefixo()` retorna `perfil_NOME_` e todo dado de usuário usa esse prefixo. Permite múltiplos usuários na mesma máquina.

## Skills e plugins

Gabriel anexa arquivos de skills, plugins e referências diretamente na conversa. Claude deve:
- Ler e usar ativamente qualquer anexo fornecido
- Sugerir proativamente quando um skill/plugin já visto seria útil para a tarefa em andamento (sem esperar ser pedido)

## Problemas conhecidos
- Posição do vídeo no iframe Drive não é capturável (cross-origin) — `postMessage` enviado mas Drive raramente responde; funciona com HLS
- ffmpeg precisa estar no PATH do sistema (não é instalado pelo `instalar.bat`)
- `sessao_estudos.session` específica por máquina — ao usar no PC secundário, precisa rodar auth Telethon separado

## Backlog pendente
- Login automático Google (refresh token sem intervenção manual)
- Download de PDFs/documentos (hoje filtra `.webp` mas aceita qualquer `document`)
- Exportar notas por curso para arquivo
- Estatísticas de progresso geral (dashboard)
- Atualização automática via `atualizar.bat` mais robusta
