function addLog(text) {
    const logBox = document.getElementById('system-log');
    logBox.innerHTML += `> ${text}<br>`;
    logBox.scrollTop = logBox.scrollHeight;
}

// PONTE PYTHON -> HTML
eel.expose(addLogVisual);
function addLogVisual(texto) { addLog(texto); }

eel.expose(atualizarBarraVisual);
function atualizarBarraVisual(porcentagem) {
    document.getElementById('progress-bar-dl').style.width = porcentagem + '%';
    document.getElementById('progress-percent-dl').innerText = Math.round(porcentagem) + '%';
}

// M2: barra reflete bytes reais (não contagem de arquivos). Contador "X/Y arquivos"
// fica ao lado pra dar a noção de itens concluídos.
eel.expose(progressoBytesVisual);
function progressoBytesVisual(bytesBaixados, bytesTotais, concluidos, total) {
    const pct = bytesTotais > 0 ? Math.min(100, (bytesBaixados / bytesTotais) * 100) : 0;
    document.getElementById('progress-bar-dl').style.width = pct + '%';
    document.getElementById('progress-percent-dl').innerText = Math.round(pct) + '%';
    const contador = document.getElementById('progress-arquivos-dl');
    if (contador) contador.innerText = `${concluidos}/${total} arquivos`;
}

eel.expose(finalizarTransferenciaVisual);
function finalizarTransferenciaVisual() {
    const btnParar = document.getElementById('btn-parar');
    btnParar.disabled = true;
    btnParar.classList.add('opacity-50', 'cursor-not-allowed');
    // M1: restaura o label original após uma parada cooperativa.
    const label = btnParar.querySelector('.btn-parar-label');
    if (label) label.innerText = 'Parar';
    document.getElementById('btn-transferir').disabled = false;
    document.getElementById('btn-transferir').classList.remove('opacity-50', 'cursor-not-allowed');
}

// Guarda o resultado da busca para mandar o índice de ordem junto na transferência.
let _aulasEncontradas = [];

// COMANDOS DE DOWNLOAD
async function buscarAulasBotao() {
    const canal = document.getElementById('input-canal').value;
    if(!canal) return alert("Digite o nome do canal!");
    // Pasta do Drive é opcional na busca, mas sem ela não dá pra marcar "já no Drive".
    const pasta = document.getElementById('input-drive').value || localStorage.getItem('rootDriveRootId') || null;
    const btnBuscar = document.getElementById('btn-buscar');
    btnBuscar.innerText = "Buscando...";
    addLog(`🔎 Lendo canal '${canal}'...`);

    try {
        let resposta = await eel.buscar_aulas_real(canal, pasta)();
        if (resposta.erro) { addLog(`❌ ERRO: ${resposta.erro}`); btnBuscar.innerText = "Buscar Aulas"; return; }
        const list = document.getElementById('download-list'); list.innerHTML = ''; list.classList.remove('items-center', 'justify-center');
        if (resposta.aulas.length === 0) { list.innerHTML = '<span>Nenhuma aula encontrada.</span>'; btnBuscar.innerText = "Buscar Aulas"; return; }

        _aulasEncontradas = resposta.aulas;
        let contadorJaNoDrive = 0;

        resposta.aulas.slice().reverse().forEach(aula => {
            if (aula.ja_no_drive) contadorJaNoDrive++;
            // Visual diferenciado para quem já está no Drive.
            const baseClasses = 'flex items-center justify-between p-4 rounded-lg transition-colors group';
            const rowClasses = aula.ja_no_drive
                ? `${baseClasses} bg-surface-container opacity-60 dl-item-ja-drive`
                : `${baseClasses} bg-surface-container hover:bg-surface-container-low`;
            const iconCell = aula.ja_no_drive
                ? `<span class="material-symbols-outlined text-tertiary" style="font-variation-settings: 'FILL' 1;">check_circle</span>`
                : `<span class="material-symbols-outlined text-on-surface-variant">video_file</span>`;
            const statusCell = aula.ja_no_drive
                ? `<span class="text-xs font-mono text-tertiary flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">cloud_done</span>Já no Drive</span>`
                : `<span class="text-xs font-mono text-tertiary">Pronto</span>`;
            const checkboxAttrs = aula.ja_no_drive
                ? `disabled`
                : `checked`;

            list.innerHTML += `
                <div class="${rowClasses}">
                    <div class="flex items-center gap-4">
                        <input type="checkbox" value="${aula.id}" onchange="atualizarContadorSelecionados()" class="dl-check w-5 h-5 rounded border-outline-variant text-primary bg-surface-container-highest focus:ring-primary/50" ${checkboxAttrs}>
                        ${iconCell}
                        <div class="flex flex-col"><span class="text-sm font-medium text-on-surface">${aula.nome}</span><span class="text-xs text-on-surface-variant/70">${aula.tamanho}</span></div>
                    </div>${statusCell}
                </div>`;
        });
        // M3: se chegamos aqui vindos de "Baixar faltantes" (Settings), a
        // pré-seleção já foi calculada lá — aplicamos antes do contador.
        if (window._sincroniaPreselect) {
            document.querySelectorAll('.dl-check').forEach(cb => {
                if (cb.disabled) return;
                cb.checked = window._sincroniaPreselect.has(String(cb.value));
            });
            const quantos = window._sincroniaPreselect.size;
            window._sincroniaPreselect = null;
            addLog(`🎯 ${quantos} arquivo(s) pré-selecionado(s) a partir da verificação de sincronia.`);
        }
        atualizarContadorSelecionados();
        btnBuscar.innerText = "Buscar Novamente";
        if (typeof _salvarCanalNoHistorico === 'function') _salvarCanalNoHistorico(canal);
        const novos = resposta.aulas.length - contadorJaNoDrive;
        addLog(`✅ Sucesso! ${resposta.aulas.length} encontrados — ${novos} novo(s), ${contadorJaNoDrive} já no Drive.`);
        document.getElementById('check-all').disabled = false;
        document.getElementById('check-all').checked = novos > 0;
        document.getElementById('btn-transferir').disabled = false;
        document.getElementById('btn-transferir').classList.remove('opacity-50', 'cursor-not-allowed');
        const btnAgendar = document.getElementById('btn-agendar');
        if (btnAgendar) {
            btnAgendar.disabled = false;
            btnAgendar.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        // Aplica o estado atual do toggle "Ocultar já baixados".
        toggleOcultarBaixados();
    } catch (erro) { addLog("❌ Erro de conexão."); btnBuscar.innerText = "Buscar Aulas"; }
}

function toggleOcultarBaixados() {
    const el = document.getElementById('toggle-ocultar-baixados');
    if (!el) return;
    const ocultar = el.checked;
    document.querySelectorAll('.dl-item-ja-drive').forEach(row => {
        row.style.display = ocultar ? 'none' : '';
    });
    atualizarContadorSelecionados();
}

// M3: mostra "X selecionado(s)" em tempo real ao lado dos botões. Só conta
// checkboxes visíveis e habilitados — itens "já no Drive" nunca entram.
function atualizarContadorSelecionados() {
    const contador = document.getElementById('contador-selecionados');
    if (!contador) return;
    const selecionados = document.querySelectorAll('.dl-check:checked:not([disabled])').length;
    if (selecionados === 0) {
        contador.classList.add('hidden');
    } else {
        contador.classList.remove('hidden');
        contador.innerText = `${selecionados} selecionado${selecionados === 1 ? '' : 's'}`;
    }
}

async function iniciarTransferencia() {
    const canal = document.getElementById('input-canal').value;
    const pasta = document.getElementById('input-drive').value;

    if(!canal || !pasta) { alert("Preencha o Canal e a Pasta do Drive!"); return; }

    const checkboxes = document.querySelectorAll('.dl-check:checked');
    let ids_para_baixar = [];
    checkboxes.forEach(cb => ids_para_baixar.push(cb.value));

    if(ids_para_baixar.length === 0) { alert("Selecione pelo menos um arquivo!"); return; }

    // Mapa {msg_id -> ordem} — a posição real no canal capturada durante a busca.
    const ordens = {};
    _aulasEncontradas.forEach(a => { ordens[String(a.id)] = a.ordem; });

    document.getElementById('btn-transferir').disabled = true; document.getElementById('btn-transferir').classList.add('opacity-50', 'cursor-not-allowed');
    document.getElementById('btn-parar').disabled = false; document.getElementById('btn-parar').classList.remove('opacity-50', 'cursor-not-allowed');
    atualizarBarraVisual(0);

    // Salva o ID da pasta na memória para a Library usar depois
    localStorage.setItem('rootDriveRootId', pasta);

    await eel.iniciar_transferencia_real(canal, pasta, ids_para_baixar, ordens)();
}

async function pararTransferencia() {
    // M1: feedback imediato — não dependemos do retorno do Python pra
    // mudar o visual. A flag já foi setada do lado do Python; o arquivo
    // atual termina e aí finalizarTransferenciaVisual() restaura tudo.
    const btn = document.getElementById('btn-parar');
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    const label = btn.querySelector('.btn-parar-label');
    if (label) label.innerText = 'Parando...';
    addLog('⏳ Parada registrada — finalizando arquivo atual...');
    try { await eel.parar_transferencia_python()(); } catch (e) {}
}

function toggleSelectAll(source) {
    // Só afeta checkboxes habilitados — os "já no Drive" ficam sempre desmarcados.
    document.querySelectorAll('.dl-check:not([disabled])').forEach(cb => cb.checked = source.checked);
    atualizarContadorSelecionados();
}

// =========================================================
// AGENDAMENTO DE TRANSFERÊNCIAS
// =========================================================
const AGENDAMENTOS_KEY = 'agendamentosTransferencia';

function _getAgendamentos() {
    try { return JSON.parse(localStorage.getItem(AGENDAMENTOS_KEY) || '[]'); }
    catch (e) { return []; }
}

function _setAgendamentos(lista) {
    localStorage.setItem(AGENDAMENTOS_KEY, JSON.stringify(lista));
}

function _renderizarAgendamentos() {
    const wrap = document.getElementById('lista-agendamentos-wrap');
    const ul = document.getElementById('lista-agendamentos');
    if (!wrap || !ul) return;
    const lista = _getAgendamentos().filter(a => !a.disparado);
    if (lista.length === 0) {
        wrap.classList.add('hidden');
        wrap.classList.remove('flex');
        return;
    }
    wrap.classList.remove('hidden');
    wrap.classList.add('flex');
    ul.innerHTML = lista.map(a => {
        const dt = new Date(a.quando).toLocaleString();
        return `<li class="flex items-center gap-2 bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-2 text-xs">
            <span class="flex-1 text-on-surface truncate">${dt} — ${a.canal} (${(a.ids || []).length} arq.)</span>
            <button onclick="_deletarAgendamento('${a.id}')" class="text-on-surface-variant hover:text-error transition-colors p-1"><span class="material-symbols-outlined text-[16px]">delete</span></button>
        </li>`;
    }).join('');
}

function abrirModalAgendar() {
    const modal = document.getElementById('modal-agendar');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function fecharModalAgendar() {
    const modal = document.getElementById('modal-agendar');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

function _salvarAgendamento() {
    const dtInput = document.getElementById('input-agendar-datahora');
    if (!dtInput || !dtInput.value) { alert('Defina a data e hora.'); return; }
    const quando = new Date(dtInput.value).getTime();
    if (!isFinite(quando) || quando <= Date.now()) { alert('Escolha uma data/hora futura.'); return; }

    const canal = document.getElementById('input-canal').value.trim();
    const pasta = document.getElementById('input-drive').value.trim() || localStorage.getItem('rootDriveRootId') || '';
    if (!canal || !pasta) { alert('Preencha o canal e a pasta do Drive antes de agendar.'); return; }

    const ids = Array.from(document.querySelectorAll('.dl-check:checked:not([disabled])')).map(cb => cb.value);
    if (ids.length === 0) { alert('Selecione pelo menos um arquivo antes de agendar.'); return; }

    const ordens = {};
    (_aulasEncontradas || []).forEach(a => { ordens[String(a.id)] = a.ordem; });

    const lista = _getAgendamentos();
    lista.push({
        id: 'ag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        quando, canal, pasta, ids, ordens, disparado: false
    });
    _setAgendamentos(lista);
    addLog(`📅 Agendado para ${new Date(quando).toLocaleString()} — ${ids.length} arquivo(s).`);
    _renderizarAgendamentos();
    fecharModalAgendar();
}

function _deletarAgendamento(id) {
    const lista = _getAgendamentos().filter(a => a.id !== id);
    _setAgendamentos(lista);
    _renderizarAgendamentos();
}

async function _verificarAgendamento() {
    const lista = _getAgendamentos();
    const agora = Date.now();
    let mudou = false;
    for (const ag of lista) {
        if (ag.disparado) continue;
        if (ag.quando > agora) continue;
        ag.disparado = true;
        mudou = true;
        try {
            addLog(`⏰ Disparando agendamento de ${new Date(ag.quando).toLocaleString()} — canal '${ag.canal}'.`);
            localStorage.setItem('rootDriveRootId', ag.pasta);
            await eel.iniciar_transferencia_real(ag.canal, ag.pasta, ag.ids, ag.ordens || {})();
        } catch (e) {
            addLog(`❌ Falha ao disparar agendamento: ${e}`);
        }
    }
    if (mudou) _setAgendamentos(lista);
}

setInterval(_verificarAgendamento, 60000);
