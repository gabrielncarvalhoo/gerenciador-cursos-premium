// Funções de histórico de canais
function _carregarHistoricoCanais() {
    const historyContainer = document.getElementById('canal-history');
    if (!historyContainer) return;

    let historico = [];
    try {
        const historicoStr = localStorage.getItem('canaisHistorico');
        if (historicoStr) {
            historico = JSON.parse(historicoStr);
        }
    } catch (e) {
        console.warn('Erro ao carregar histórico de canais:', e);
        historico = [];
    }

    // Limpa o container
    historyContainer.innerHTML = '';

    // Renderiza os chips
    historico.forEach(canal => {
        const canalEsc = canal.replace(/'/g, "\\'");
        const chip = document.createElement('div');
        chip.className = 'flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-highest border border-outline-variant/20 text-xs text-primary cursor-pointer hover:brightness-110 transition-all';
        chip.innerHTML = `
            <span onclick="_preencherCanal('${canalEsc}')" class="flex-1">${canal}</span>
            <span onclick="_removerCanalDoHistorico('${canalEsc}')" class="text-on-surface-variant hover:text-error ml-1 font-bold leading-none">×</span>
        `;
        historyContainer.appendChild(chip);
    });
}

function _preencherCanal(canal) {
    const input = document.getElementById('input-canal');
    if (input) {
        input.value = canal;
    }
}

function _salvarCanalNoHistorico(nome) {
    if (!nome) return;

    let historico = [];
    try {
        const historicoStr = localStorage.getItem('canaisHistorico');
        if (historicoStr) {
            historico = JSON.parse(historicoStr);
        }
    } catch (e) {
        historico = [];
    }

    // Remove se já existir para não duplicar
    const index = historico.indexOf(nome);
    if (index !== -1) {
        historico.splice(index, 1);
    }

    // Adiciona no início
    historico.unshift(nome);

    // Limita a 10 itens
    if (historico.length > 10) {
        historico = historico.slice(0, 10);
    }

    try {
        localStorage.setItem('canaisHistorico', JSON.stringify(historico));
    } catch (e) {
        console.warn('Erro ao salvar histórico de canais:', e);
    }
}

function _removerCanalDoHistorico(nome) {
    if (!nome) return;

    let historico = [];
    try {
        const historicoStr = localStorage.getItem('canaisHistorico');
        if (historicoStr) {
            historico = JSON.parse(historicoStr);
        }
    } catch (e) {
        historico = [];
    }

    // Remove o canal
    const index = historico.indexOf(nome);
    if (index !== -1) {
        historico.splice(index, 1);
    }

    try {
        localStorage.setItem('canaisHistorico', JSON.stringify(historico));
    } catch (e) {
        console.warn('Erro ao remover canal do histórico:', e);
    }
}
