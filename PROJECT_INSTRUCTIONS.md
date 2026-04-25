Projeto: Gerenciador de Cursos — app desktop Windows que baixa vídeos de canais Telegram e faz upload para Google Drive, com biblioteca integrada para assistir aulas com progresso, notas e perfis.
Repositório: github.com/gabrielndcarvalho/gerenciador-cursos (privado)
Local Windows: C:\gerenciador-cursos
Local WSL2: /mnt/c/gerenciador-cursos

Stack:
- Python 3.12 (OBRIGATÓRIO — nunca outra versão)
- Eel (bridge Python ↔ Chromium embutido)
- Telethon (client Telegram MTProto assíncrono)
- Google Drive API v3 (google-api-python-client)
- aiohttp + ffmpeg (servidor HLS local porta 8765)
- Frontend: HTML + Tailwind CDN + Vanilla JS + hls.js CDN

Fluxo IA (Claude sempre indica qual modelo usar ao final da resposta ou ao sugerir próximo passo):
- JS/CSS/HTML, backend Python geral, features, bugs, Drive, Telegram, Eel, pequenas refatorações → MiniMax 2.7 (Claude Code) — preferir sempre
- Refatorações críticas, threading/asyncio, bugs que MiniMax não resolveu → Sonnet 4.6 (Claude Code)
- Arquitetura muito complexa, problemas que Sonnet não resolveu → Opus 4.7 (Claude Code)
- Componentes visuais Tailwind, UI completa → Gemini 3.1 Pro (Antigravity)
- Performance, completions rápidos, experimentos → qwen3-coder
- Decisões arquiteturais, debug difícil, trade-offs → Claude.ai

Regras fixas:
- Python 3.12 obrigatório (iniciar.bat usa `py -3.12`)
- NUNCA recriar sessao_estudos.session sem rodar fluxo de auth Telethon — arquivo é machine-specific (PC principal ≠ PC secundário)
- iter_messages SEM reverse=True — ordem mais novo→mais antigo é intencional; transfer.py re-ordena por msg.id antes do download
- Arquivos/pastas com nome iniciando em _ são internos (ex: _ordem.json, _capas/) — NUNCA mostrar ao usuário; filtrar com `not name.startswith('_')`
- Sempre git commit antes de alterar arquivos com IA
- Nunca commitar: sessao_estudos.session, token.json, credentials.json, web/cache_fotos/
- Nunca recriar arquivo sem ler antes — lógica threading/asyncio em transfer.py é frágil
- localStorage: dados de usuário SEMPRE com prefixo _getPrefixo() → "perfil_NOME_"

Funcionalidades implementadas:
- Download Center: busca canal Telegram, seleciona arquivos, transfere para Drive com retry/watchdog/progress
- Agendamento de transferências (polling a cada 60s via localStorage)
- Library: grade de cursos do Drive com capas dos canais Telegram
- Player: HLS local → iframe Drive → video-card (fallback em cascata)
- Progresso por aula, retomada automática, notas por aula (debounce 1s)
- Multi-perfil (localStorage isolado por perfil)
- Verificação de sincronia Telegram ↔ Drive bidirecional
- Reindexar cursos (_ordem.json), limpar markdown nos nomes, renomear por pasta
- Histórico de canais pesquisados

Decisões já tomadas:
- DOM nunca destruído ao trocar de view — só display:none (preserva vídeo tocando)
- _ordem.json salvo dentro de cada pasta de curso no Drive (ordem real capturada no download)
- Sem banco de dados — tudo localStorage com prefixo de perfil
- ffmpeg não é instalado pelo instalar.bat — usuário instala manualmente e adiciona ao PATH

Problemas conhecidos:
- Posição de vídeo no iframe Drive não capturável (cross-origin) — funciona só com HLS
- ffmpeg precisa estar no PATH (não instalado automaticamente)
- sessao_estudos.session machine-specific — PC secundário precisa de auth Telethon separado

Skills e plugins:
- Gabriel anexa arquivos de skills, plugins e referências na conversa
- Ler e usar ativamente qualquer anexo fornecido
- Sugerir proativamente quando um skill/plugin seria útil para a tarefa atual — não esperar ser pedido

Backlog:
- Refresh automático do token Google sem intervenção manual
- Exportar notas por curso
- Dashboard de progresso geral
- Suporte melhorado a documentos PDF no player
