// =========================================================
// GLOBAIS — precisam existir antes de qualquer uso
// =========================================================
function _getPrefixo() {
    const perfil = localStorage.getItem('perfilAtivo') || 'default';
    return 'perfil_' + perfil + '_';
}

let _libraryCarregando = false;

// Sanitiza valor inválido persistido em versões antigas (ex: ".")
if (localStorage.getItem('rootDriveRootId') === '.') {
    localStorage.setItem('rootDriveRootId', '1Q19UVnVgV9BApx-V9Aj_tV_1NHM2fC6i');
}

// =========================================================
// ESTADO PERSISTENTE DA LIBRARY (não destruir DOM, só ocultar)
// =========================================================
const libraryState = {
    subview: 'grid',          // 'grid' | 'player'
    cursoAtivo: null,         // { id, nome }
    aulaAtiva: null,          // { id, title, tempoAtual }
    scrollGrid: 0,            // scroll da grade de cursos
    scrollPlayer: 0,          // scroll da view do player (geral)
    scrollLessonList: 0,      // scroll da lista de aulas dentro do player
    gridLoaded: false,        // evita recarregar cursos a cada revisita
};

function _salvarScrolls() {
    const vLib = document.getElementById('view-library');
    const vPlayer = document.getElementById('view-player');
    const lessonList = document.getElementById('lesson-list');
    if (vLib && vLib.style.display !== 'none') libraryState.scrollGrid = vLib.scrollTop;
    if (vPlayer && vPlayer.style.display !== 'none') libraryState.scrollPlayer = vPlayer.scrollTop;
    if (lessonList) libraryState.scrollLessonList = lessonList.scrollTop;
}

function _restaurarScrolls() {
    // rAF para garantir que o display já foi aplicado antes de escrever scrollTop.
    requestAnimationFrame(() => {
        const vLib = document.getElementById('view-library');
        const vPlayer = document.getElementById('view-player');
        const lessonList = document.getElementById('lesson-list');
        if (vLib) vLib.scrollTop = libraryState.scrollGrid;
        if (vPlayer) vPlayer.scrollTop = libraryState.scrollPlayer;
        if (lessonList) lessonList.scrollTop = libraryState.scrollLessonList;
    });
}
