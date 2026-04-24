// NAVEGAÇÃO E LOGS
function showView(viewName) {
    // 1. Antes de esconder, capturamos a posição do scroll atual.
    _salvarScrolls();

    // 2. Esconde tudo — nunca destruímos o DOM, só alteramos display.
    document.getElementById('view-download').style.display = 'none';
    document.getElementById('view-library').style.display = 'none';
    document.getElementById('view-player').style.display = 'none';
    document.getElementById('view-settings').style.display = 'none';

    // 3. Exibe a view solicitada. 'library' delega para o subview salvo.
    if (viewName === 'download') {
        document.getElementById('view-download').style.display = 'block';
    } else if (viewName === 'settings') {
        document.getElementById('view-settings').style.display = 'block';
    } else if (viewName === 'player') {
        document.getElementById('view-player').style.display = 'grid';
        libraryState.subview = 'player';
    } else if (viewName === 'library') {
        if (libraryState.subview === 'player' && libraryState.cursoAtivo) {
            // Usuário estava no player antes de sair — volta para ele intacto.
            document.getElementById('view-player').style.display = 'grid';
        } else {
            document.getElementById('view-library').style.display = 'block';
            libraryState.subview = 'grid';
            // Só carrega cursos na primeira visita — revisitas reaproveitam o DOM.
            if (!libraryState.gridLoaded) renderLibrary();
        }
    }

    // 4. Menu lateral: player é um subview da Library, então highlight vai no item Library.
    const navKey = (viewName === 'player') ? 'library' : viewName;
    document.querySelectorAll('.nav-item').forEach(el => {
        el.className = "nav-item flex items-center gap-4 px-4 py-3 rounded-lg text-[#e5e2e1]/50 hover:text-on-surface hover:bg-surface-container-high transition-all";
    });
    const activeNav = document.getElementById('nav-' + navKey);
    if(activeNav) activeNav.className = "nav-item flex items-center gap-4 px-4 py-3 rounded-lg text-primary font-bold border-r-2 border-primary bg-gradient-to-r from-primary/10 to-transparent transition-all";

    if (viewName === 'settings') renderSettings();

    _restaurarScrolls();
}

// Botão "Voltar à Biblioteca" no player: volta explicitamente pra grade.
function voltarParaGrid() {
    // P2 — última chance de capturar a posição antes de sair do player.
    _tentarCapturarPosicao();
    libraryState.subview = 'grid';
    showView('library');
    // Reflete imediatamente qualquer marcação feita no player sem refazer consulta ao Drive.
    _atualizarProgressoCards();
}

// Settings: mostra pasta temp vinda do Python
async function renderSettings() {
    const el = document.getElementById('settings-temp-path');
    el.innerText = 'Carregando...';
    try {
        const path = await eel.obter_pasta_temp()();
        el.innerText = path || '(indisponível)';
    } catch (e) {
        el.innerText = 'Erro ao obter caminho da pasta temp.';
    }
    // Limpa status antigo do reindex ao reabrir Settings
    const st = document.getElementById('reindex-status');
    if (st) { st.classList.add('hidden'); st.innerText = ''; }
    // M3: pré-preenche os inputs de sincronia com o que já existe no Download Center.
    const syncCanal = document.getElementById('sync-canal');
    const syncDrive = document.getElementById('sync-drive');
    if (syncCanal && !syncCanal.value) {
        syncCanal.value = document.getElementById('input-canal').value || '';
    }
    if (syncDrive && !syncDrive.value) {
        syncDrive.value = document.getElementById('input-drive').value
            || localStorage.getItem('rootDriveRootId') || '';
    }
}

async function reindexarCursos() {
    const rootId = document.getElementById('input-drive').value || localStorage.getItem('rootDriveRootId');
    const status = document.getElementById('reindex-status');
    const btn = document.getElementById('btn-reindexar');

    if (!rootId) {
        status.classList.remove('hidden');
        status.innerText = '⚠️ Defina o ID da pasta raiz em Download Center primeiro.';
        return;
    }

    btn.disabled = true; btn.classList.add('opacity-60');
    status.classList.remove('hidden');
    status.innerText = 'Reindexando... pode levar alguns segundos.';

    try {
        const resp = await eel.reindexar_cursos_drive(rootId)();
        if (resp.erro) {
            status.innerText = `❌ ${resp.mensagem || resp.erro}`;
        } else {
            const feitos = (resp.reindexados || []).length;
            const pulados = (resp.ja_tinham || []).length;
            status.innerText = `✅ ${feitos} curso(s) reindexado(s). ${pulados} já tinham _ordem.json.`;
        }
    } catch (e) {
        status.innerText = '❌ Falha ao conectar com o Python.';
    } finally {
        btn.disabled = false; btn.classList.remove('opacity-60');
    }
}

// M3: guarda a última verificação pra que "Baixar faltantes" saiba quais
// IDs pré-selecionar no Download Center.
let _syncFaltandoCache = null;

function _escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

async function verificarSincronia() {
    const canal = document.getElementById('sync-canal').value.trim();
    const drive = document.getElementById('sync-drive').value.trim();
    if (!canal || !drive) {
        alert('Preencha o canal e o ID da pasta do Drive.');
        return;
    }

    const btn = document.getElementById('btn-sync');
    const status = document.getElementById('sync-status');
    const boxF = document.getElementById('sync-faltando-box');
    const boxE = document.getElementById('sync-extra-box');

    btn.disabled = true; btn.classList.add('opacity-60');
    status.classList.remove('hidden');
    status.innerText = '🔎 Consultando Telegram e Drive...';
    boxF.classList.add('hidden');
    boxE.classList.add('hidden');

    let resp;
    try {
        resp = await eel.verificar_sincronia(canal, drive)();
    } catch (e) {
        resp = { erro: 'Falha ao conectar com o Python.' };
    }

    btn.disabled = false; btn.classList.remove('opacity-60');

    if (!resp || resp.erro) {
        status.innerText = '❌ ' + ((resp && resp.erro) || 'Erro desconhecido.');
        return;
    }

    const faltando = resp.faltando_no_drive || [];
    const extra = resp.extra_no_drive || [];
    _syncFaltandoCache = { canal, drive, faltando };

    status.innerText = `✅ ${resp.total_telegram} no Telegram • ${faltando.length} faltam no Drive • ${extra.length} extra(s) no Drive.`;

    // Lista faltantes
    document.getElementById('sync-faltando-count').innerText = faltando.length;
    const listF = document.getElementById('sync-faltando-list');
    listF.innerHTML = faltando.length === 0
        ? '<li class="text-on-surface-variant/60">Nenhum — seu Drive está em dia.</li>'
        : faltando.map(f => `<li class="text-on-surface">• ${_escapeHtml(f.nome_arquivo)} <span class="text-on-surface-variant/60">(${_escapeHtml(f.tamanho)})</span></li>`).join('');
    document.getElementById('btn-baixar-faltantes').classList.toggle('hidden', faltando.length === 0);
    boxF.classList.remove('hidden');

    // Lista extras (meramente informativo)
    document.getElementById('sync-extra-count').innerText = extra.length;
    const listE = document.getElementById('sync-extra-list');
    listE.innerHTML = extra.length === 0
        ? '<li class="text-on-surface-variant/60">Nenhum — tudo veio do Telegram.</li>'
        : extra.map(e => `<li class="text-on-surface">• ${_escapeHtml(e.nome)}</li>`).join('');
    boxE.classList.remove('hidden');
}

function baixarTodosFaltantes() {
    if (!_syncFaltandoCache || !_syncFaltandoCache.faltando.length) return;
    const { canal, drive, faltando } = _syncFaltandoCache;

    // Pré-preenche o Download Center e sinaliza a pré-seleção pra busca.
    document.getElementById('input-canal').value = canal;
    document.getElementById('input-drive').value = drive;
    window._sincroniaPreselect = new Set(faltando.map(f => String(f.id)));

    showView('download');
    // Dispara a busca automaticamente — ao renderizar, a pré-seleção é aplicada.
    buscarAulasBotao();
}

async function limparNomesDrive() {
    const rootId = document.getElementById('input-drive').value || localStorage.getItem('rootDriveRootId');
    const status = document.getElementById('limpar-nomes-status');
    const btn = document.getElementById('btn-limpar-nomes');

    if (!rootId) {
        status.classList.remove('hidden');
        status.innerText = '⚠️ Defina o ID da pasta raiz em Download Center primeiro.';
        return;
    }

    btn.disabled = true; btn.classList.add('opacity-60');
    status.classList.remove('hidden');
    status.innerText = '🧹 Limpando formatação dos nomes...';

    try {
        const resp = await eel.limpar_nomes_drive(rootId)();
        if (resp.erro) {
            status.innerText = `❌ ${resp.erro}`;
        } else {
            const renomeados = resp.renomeados || 0;
            const pastas = resp.pastas_processadas || 0;
            status.innerText = `✅ ${renomeados} arquivo(s) renomeado(s) em ${pastas} pasta(s).`;
        }
    } catch (e) {
        status.innerText = '❌ Falha ao conectar com o Python.';
    } finally {
        btn.disabled = false; btn.classList.remove('opacity-60');
    }
}

async function renomearCursoDrive() {
    const idPastaCurso = document.getElementById('input-renomear-curso').value.trim();
    const status = document.getElementById('renomear-curso-status');
    const btn = document.getElementById('btn-renomear-curso');

    if (!idPastaCurso) {
        status.classList.remove('hidden');
        status.innerText = '⚠️ Cole o ID da pasta do curso.';
        return;
    }

    btn.disabled = true; btn.classList.add('opacity-60');
    status.classList.remove('hidden');
    status.innerText = '✏️ Renomeando arquivos...';

    try {
        const resp = await eel.renomear_curso_drive(idPastaCurso)();
        if (resp.erro) {
            status.innerText = `❌ ${resp.erro}`;
        } else {
            status.innerText = `✅ ${resp.renomeados}/${resp.total} arquivo(s) renomeado(s).`;
        }
    } catch (e) {
        status.innerText = '❌ Falha ao conectar com o Python.';
    } finally {
        btn.disabled = false; btn.classList.remove('opacity-60');
    }
}
