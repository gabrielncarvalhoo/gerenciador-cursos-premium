// =========================================================
// PERFIS
// =========================================================
const PERFIS_KEY = 'listaPerfis';

function _getPerfis() {
    try {
        const arr = JSON.parse(localStorage.getItem(PERFIS_KEY) || '[]');
        if (!arr.length) return ['default'];
        return arr;
    } catch (e) { return ['default']; }
}

function _setPerfis(perfis) {
    localStorage.setItem(PERFIS_KEY, JSON.stringify(perfis));
}

function _getPerfilAtivo() {
    return localStorage.getItem('perfilAtivo') || 'default';
}

function _atualizarNomePerfilAtivo() {
    const el = document.getElementById('perfil-nome-ativo');
    if (el) el.innerText = _getPerfilAtivo();
}

function _renderizarListaPerfis() {
    const ul = document.getElementById('lista-perfis');
    if (!ul) return;
    const perfis = _getPerfis();
    const ativo = _getPerfilAtivo();
    ul.innerHTML = perfis.map(p => {
        const pEsc = p.replace(/'/g, "\\'");
        const isAtivo = p === ativo;
        const podeDeletar = perfis.length > 1 && p !== 'default';
        const btnDel = podeDeletar
            ? `<button onclick="deletarPerfil('${pEsc}')" class="text-on-surface-variant hover:text-error transition-colors p-1"><span class="material-symbols-outlined text-[18px]">delete</span></button>`
            : '';
        const highlight = isAtivo
            ? 'bg-primary/10 border-primary/40 text-primary'
            : 'bg-surface-container-highest border-outline-variant/20 text-on-surface hover:brightness-110';
        return `<li class="flex items-center gap-2 border rounded-lg px-4 py-2.5 ${highlight} transition-all">
            <span onclick="selecionarPerfil('${pEsc}')" class="flex-1 cursor-pointer text-sm font-medium">${p}${isAtivo ? ' (ativo)' : ''}</span>
            ${btnDel}
        </li>`;
    }).join('');
}

function abrirModalPerfis() {
    _renderizarListaPerfis();
    const input = document.getElementById('input-novo-perfil');
    if (input) input.value = '';
    document.getElementById('modal-perfis').classList.remove('hidden');
}

function fecharModalPerfis() {
    document.getElementById('modal-perfis').classList.add('hidden');
}

function criarPerfil() {
    const input = document.getElementById('input-novo-perfil');
    if (!input) return;
    const nome = input.value.trim();
    if (!nome) { alert('Digite um nome para o perfil.'); return; }
    const perfis = _getPerfis();
    if (perfis.includes(nome)) { alert('Já existe um perfil com esse nome.'); return; }
    perfis.push(nome);
    _setPerfis(perfis);
    input.value = '';
    _renderizarListaPerfis();
}

function selecionarPerfil(nome) {
    if (!nome) return;
    localStorage.setItem('perfilAtivo', nome);
    _atualizarNomePerfilAtivo();
    fecharModalPerfis();
    location.reload();
}

function deletarPerfil(nome) {
    if (!nome || nome === 'default') return;
    const perfis = _getPerfis().filter(p => p !== nome);
    if (!perfis.length) perfis.push('default');
    _setPerfis(perfis);
    if (_getPerfilAtivo() === nome) {
        localStorage.setItem('perfilAtivo', perfis[0]);
        _atualizarNomePerfilAtivo();
        location.reload();
        return;
    }
    _renderizarListaPerfis();
}
