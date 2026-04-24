const DB_KEY = (typeof _getPrefixo === 'function' ? _getPrefixo() : '') + 'gerenciador_cursos_progresso';
const LAST_LESSON_KEY = (typeof _getPrefixo === 'function' ? _getPrefixo() : '') + 'gerenciador_cursos_last_lesson';
const LESSONS_MAP_KEY = (typeof _getPrefixo === 'function' ? _getPrefixo() : '') + 'gerenciador_cursos_lessons_map';
let currentCourseLessons = [];
let currentCourseId = null;
let _retomandoTimer = null;

function getProgress() { return JSON.parse(localStorage.getItem(DB_KEY) || '{}'); }

function getLastLessons() { return JSON.parse(localStorage.getItem(LAST_LESSON_KEY) || '{}'); }
function saveLastLesson(courseId, lessonId, lessonTitle) {
    const data = getLastLessons();
    data[courseId] = { lessonId, lessonTitle };
    localStorage.setItem(LAST_LESSON_KEY, JSON.stringify(data));
}
function getLastLesson(courseId) { return getLastLessons()[courseId] || null; }

function getLessonsMap() { return JSON.parse(localStorage.getItem(LESSONS_MAP_KEY) || '{}'); }
function saveLessonsMap(courseId, aulas) {
    const data = getLessonsMap();
    data[courseId] = aulas.map(a => a.id);
    localStorage.setItem(LESSONS_MAP_KEY, JSON.stringify(data));
}

function _mostrarRetomando(texto) {
    const el = document.getElementById('retomando-msg');
    if (!el) return;
    document.getElementById('retomando-texto').innerText = texto;
    el.classList.remove('hidden');
    clearTimeout(_retomandoTimer);
    _retomandoTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// P2 — auto-save silencioso de posição da aula.
// O player preview do Drive é cross-origin, então não dá pra ler
// currentTime diretamente. Mandamos {event:"listening"} (protocolo YT,
// que alguns embeds seguem) e esperamos o iframe devolver currentTime
// via postMessage. Na prática, o Drive normalmente não responde — e
// é por isso que ZERO elementos visuais foram adicionados; se um dia
// começarem a responder, a captura passa a acontecer automaticamente.
const LESSON_TIME_PREFIX = (typeof _getPrefixo === 'function' ? _getPrefixo() : '') + 'lessonTime_';

function _formatTime(seg) {
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function _getLessonTime(lessonId) {
    try { return JSON.parse(localStorage.getItem(LESSON_TIME_PREFIX + lessonId) || 'null'); }
    catch (e) { return null; }
}

function _setLessonTime(lessonId, seg) {
    localStorage.setItem(
        LESSON_TIME_PREFIX + lessonId,
        JSON.stringify({ time: seg, savedAt: Date.now() })
    );
}

// Listener global: qualquer mensagem vinda do iframe que traga um
// currentTime numérico é persistida na aula ativa. Registrado uma
// única vez na carga do script — não acumula handlers.
window.addEventListener('message', (ev) => {
    if (!libraryState.aulaAtiva) return;
    let data = ev.data;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (_e) { return; }
    }
    if (!data || typeof data !== 'object') return;
    const t = (typeof data.currentTime === 'number') ? data.currentTime
            : (typeof data.time === 'number') ? data.time
            : (data.info && typeof data.info.currentTime === 'number') ? data.info.currentTime
            : null;
    if (t !== null && t > 0 && isFinite(t)) {
        _setLessonTime(libraryState.aulaAtiva.id, Math.floor(t));
    }
});

// Pede o tempo atual ao iframe. Chamada antes de trocar de aula ou
// sair da Library — se o Drive responder, o listener acima salva.
function _tentarCapturarPosicao() {
    const iframe = document.getElementById('video-iframe');
    if (!iframe || !iframe.contentWindow) return;
    try {
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*');
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getCurrentTime' }), '*');
    } catch (_e) { /* silencioso — sem feedback UI */ }
}

function _mostrarModalConfirmacao(mensagem, onSim, onNao) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-modal-msg').innerText = mensagem;
    modal.classList.remove('hidden');
    const btnSim = document.getElementById('confirm-modal-yes');
    const btnNao = document.getElementById('confirm-modal-no');
    const fechar = () => {
        modal.classList.add('hidden');
        btnSim.onclick = null;
        btnNao.onclick = null;
    };
    btnSim.onclick = () => { fechar(); onSim && onSim(); };
    btnNao.onclick = () => { fechar(); onNao && onNao(); };
}

function _persistirProgresso(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    if (currentCourseId && typeof renderPlayerUI === 'function') renderPlayerUI();
}

function toggleLessonWatched(lessonId) {
    const data = getProgress();
    const novoEstado = !data[lessonId];

    // Só pergunta ao MARCAR (não ao desmarcar) e quando há anteriores não marcadas.
    if (novoEstado && currentCourseLessons && currentCourseLessons.length) {
        const idx = currentCourseLessons.findIndex(a => a.id === lessonId);
        if (idx > 0) {
            const anterioresNaoMarcadas = currentCourseLessons
                .slice(0, idx)
                .filter(a => !data[a.id]);
            if (anterioresNaoMarcadas.length > 0) {
                _mostrarModalConfirmacao(
                    `Marcar as ${anterioresNaoMarcadas.length} aulas anteriores como assistidas também?`,
                    () => {
                        anterioresNaoMarcadas.forEach(a => { data[a.id] = true; });
                        data[lessonId] = true;
                        _persistirProgresso(data);
                    },
                    () => {
                        data[lessonId] = true;
                        _persistirProgresso(data);
                    }
                );
                return;
            }
        }
    }

    data[lessonId] = novoEstado;
    _persistirProgresso(data);
}
