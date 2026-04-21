// ============ NOTAS POR AULA ============
const NOTES_PREFIX = typeof _getPrefixo === 'function' ? _getPrefixo() + 'notes_' : 'notes_';
let _notesSaveTimer = null;
let _notesIndicatorTimer = null;

function _getNotaAula(lessonId) {
    const prefixo = typeof _getPrefixo === 'function' ? _getPrefixo() : '';
    return localStorage.getItem(prefixo + 'notes_' + lessonId) || '';
}

function _setNotaAula(lessonId, texto) {
    const prefixo = typeof _getPrefixo === 'function' ? _getPrefixo() : '';
    if (texto && texto.trim()) localStorage.setItem(prefixo + 'notes_' + lessonId, texto);
    else localStorage.removeItem(prefixo + 'notes_' + lessonId);
}

function _temNotaAula(lessonId) {
    const prefixo = typeof _getPrefixo === 'function' ? _getPrefixo() : '';
    const v = localStorage.getItem(prefixo + 'notes_' + lessonId);
    return !!(v && v.trim());
}

function _carregarNotasNoCampo(lessonId) {
    const ta = document.getElementById('lesson-notes');
    if (!ta) return;
    // Cancela qualquer save pendente da aula anterior antes de trocar o conteúdo.
    clearTimeout(_notesSaveTimer);
    ta.value = _getNotaAula(lessonId);
    ta.disabled = false;
    const ind = document.getElementById('notes-saved-indicator');
    if (ind) { ind.classList.add('hidden'); ind.classList.remove('flex'); }
}

// Debounce de 1s — grava só quando o usuário pausa de digitar.
function _agendarSalvarNotas() {
    if (!libraryState.aulaAtiva) return;
    const lessonId = libraryState.aulaAtiva.id;
    clearTimeout(_notesSaveTimer);
    _notesSaveTimer = setTimeout(() => {
        const ta = document.getElementById('lesson-notes');
        if (!ta) return;
        _setNotaAula(lessonId, ta.value);
        _mostrarIndicadorSalvo();
        // Refresh da lista pra aparecer/sumir o ícone de nota na linha da aula.
        if (typeof renderPlayerUI === 'function') renderPlayerUI();
    }, 1000);
}

function _mostrarIndicadorSalvo() {
    const ind = document.getElementById('notes-saved-indicator');
    if (!ind) return;
    ind.classList.remove('hidden');
    ind.classList.add('flex');
    clearTimeout(_notesIndicatorTimer);
    _notesIndicatorTimer = setTimeout(() => {
        ind.classList.add('hidden');
        ind.classList.remove('flex');
    }, 2000);
}
