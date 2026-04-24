// Skeleton para a Library — mesmos contornos dos cards reais.
function renderLibrarySkeleton(qtd = 6) {
    const grid = document.getElementById('course-grid');
    let html = '';
    for (let i = 0; i < qtd; i++) {
        html += `
            <div class="bg-surface-container-low rounded-xl p-4 flex flex-col h-full border border-outline-variant/10">
                <div class="w-full aspect-video rounded-lg overflow-hidden mb-6 skeleton"></div>
                <div class="flex-1 flex flex-col px-2 pb-2 gap-3">
                    <div class="h-3 w-24 skeleton"></div>
                    <div class="h-5 w-3/4 skeleton"></div>
                    <div class="h-4 w-1/2 skeleton mt-auto"></div>
                </div>
            </div>`;
    }
    grid.innerHTML = html;
}

// Library rodando de forma independente do Download Center: usa lock reentrante
// para não duplicar chamadas se o usuário clicar refresh em rajada.
async function renderLibrary(forcarRefresh = false) {
    const grid = document.getElementById('course-grid');

    // ID do Drive: prioriza input; senão usa memória
    let rootId = document.getElementById('input-drive').value || localStorage.getItem('rootDriveRootId');

    if(!rootId) {
        grid.innerHTML = '<div class="col-span-full p-8 bg-surface-container-low rounded-xl text-center border border-outline-variant/20"><p class="text-on-surface-variant mb-4">Para visualizar sua Library, cole o ID da Pasta Principal do seu Drive na aba "Download Center" primeiro.</p><button onclick="showView(\'download\')" class="px-6 py-2 bg-primary text-[#001a42] font-bold rounded-full text-sm">Ir para Download</button></div>';
        return;
    }

    if (_libraryCarregando) return;
    _libraryCarregando = true;

    localStorage.setItem('rootDriveRootId', rootId);
    renderLibrarySkeleton();

    const btn = document.getElementById('btn-refresh-library');
    if (btn) { btn.disabled = true; btn.classList.add('opacity-60'); }

    // Timeout no frontend como rede de segurança. Backend também tem timeout de 15s.
    const promessaDrive = eel.carregar_cursos_drive(rootId)();
    const promessaTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000));

    let resposta;
    try {
        resposta = await Promise.race([promessaDrive, promessaTimeout]);
    } catch (e) {
        resposta = { erro: 'timeout', mensagem: 'A consulta ao Google Drive demorou demais (>15s).' };
    } finally {
        _libraryCarregando = false;
        if (btn) { btn.disabled = false; btn.classList.remove('opacity-60'); }
    }

    if(resposta && resposta.erro) {
        const msg = resposta.erro === 'timeout'
            ? (resposta.mensagem || 'A consulta ao Google Drive demorou demais.')
            : `Erro ao ler o Drive: ${resposta.erro}`;
        grid.innerHTML = `
            <div class="col-span-full p-8 bg-surface-container-low rounded-xl text-center border border-outline-variant/20 flex flex-col items-center gap-4">
                <span class="material-symbols-outlined text-4xl text-error">cloud_off</span>
                <p class="text-on-surface-variant">${msg}</p>
                <button onclick="renderLibrary(true)" class="px-6 py-2 bg-primary text-[#001a42] font-bold rounded-full text-sm flex items-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">refresh</span>
                    Tentar Novamente
                </button>
            </div>`;
        return;
    }

    grid.innerHTML = '';
    const cursos = (resposta && resposta.cursos) || [];

    if(cursos.length === 0) {
         grid.innerHTML = '<div class="col-span-full text-on-surface-variant">Nenhuma pasta (curso) encontrada dentro do ID fornecido.</div>';
         return;
    }

    const progressData = getProgress();
    const lessonsMap = getLessonsMap();

    cursos.forEach(course => {
        // Fonte do total: backend (contagem real no Drive) é a verdade.
        // Fonte do watched: interseção com as aulas já vistas (lessonsMap).
        // Cursos nunca abertos não têm lessonsMap — ficam em "Não iniciado".
        const mapped = lessonsMap[course.id] || [];
        const total = course.total_lessons || mapped.length;
        const watched = mapped.filter(id => progressData[id]).length;
        const percent = total > 0 ? Math.min(100, (watched / total) * 100) : 0;

        let statusHtml;
        if (watched === 0) {
            statusHtml = `<p class="card-progresso-status text-xs font-label uppercase tracking-widest text-on-surface-variant/60">Não iniciado</p>`;
        } else if (percent >= 100) {
            statusHtml = `<p class="card-progresso-status text-xs font-label uppercase tracking-widest text-tertiary flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>Concluído</p>`;
        } else {
            statusHtml = `<p class="card-progresso-status text-xs font-label uppercase tracking-widest text-on-surface-variant">${watched}/${total} aulas assistidas</p>`;
        }

        grid.innerHTML += `
            <article data-course-id="${course.id}" data-total-lessons="${total}" data-course-title="${course.title.replace(/"/g, '&quot;')}" onclick="openCourse('${course.id}', '${course.title.replace(/'/g, "\\'")}')" class="group bg-surface-container-low rounded-xl p-4 cursor-pointer hover:bg-surface-container-highest transition-all duration-500 flex flex-col h-full hover:-translate-y-1 shadow-[0px_10px_20px_rgba(0,0,0,0.2)] border border-outline-variant/10">
                <div class="w-full aspect-video rounded-lg overflow-hidden relative mb-6">
                    <img src="${course.image}" class="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-all duration-700">
                </div>
                <div class="flex-1 flex flex-col px-2 pb-2">
                    <span class="font-label text-[0.65rem] uppercase tracking-[0.1em] text-primary mb-2 font-semibold">${course.tag}</span>
                    <h3 class="font-headline text-xl font-bold text-on-surface mb-2 leading-tight group-hover:text-primary transition-colors">${course.title}</h3>
                    <p class="font-body text-sm text-on-surface-variant">${course.total_lessons} arquivos disponíveis</p>
                    <div class="mt-auto pt-4 flex flex-col gap-2">
                        ${statusHtml}
                        <div class="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                            <div class="card-progresso-bar h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-500" style="width: ${percent}%;"></div>
                        </div>
                    </div>
                </div>
            </article>`;
    });

    // Sinaliza que a grade já foi populada — próximas visitas reaproveitam o DOM.
    libraryState.gridLoaded = true;

    // Se o usuário já tinha digitado um termo antes do refresh, re-aplica o filtro.
    const searchBox = document.getElementById('search-courses');
    if (searchBox && searchBox.value) filtrarCursos();

    // Sincroniza capas que faltam localmente buscando no Drive
    try {
        await eel.sincronizar_capas(rootId, cursos.map(c => c.title))();
    } catch(e) {}
    // M1: busca fotos dos canais do Telegram em background — não bloqueia a grade.
    // Usa a imagem fallback até a resposta chegar; trocamos uma a uma por data-course-title.
    carregarFotosCanais(cursos.map(c => c.title), rootId);
}

async function carregarFotosCanais(titulos, id_pasta_raiz = null) {
    if (!titulos || titulos.length === 0) return;
    try {
        const mapa = await eel.obter_fotos_canais(titulos, id_pasta_raiz)();
        if (!mapa) return;
        // Iteração por atributo — robusto a títulos com aspas/especiais que
        // quebrariam um querySelector interpolado.
        document.querySelectorAll('[data-course-title]').forEach(article => {
            const titulo = article.getAttribute('data-course-title');
            if (mapa[titulo]) {
                const img = article.querySelector('img');
                if (img) img.src = mapa[titulo];
            }
        });
    } catch (e) {
        // Silencioso — fallback visual já está aplicado.
    }
}

function filtrarCursos() {
    const input = document.getElementById('search-courses');
    if (!input) return;
    const termo = input.value.trim().toLowerCase();
    const grid = document.getElementById('course-grid');
    const empty = document.getElementById('course-grid-empty');
    let visiveis = 0;
    grid.querySelectorAll('[data-course-id]').forEach(card => {
        const titulo = (card.getAttribute('data-course-title') || '').toLowerCase();
        const match = !termo || titulo.includes(termo);
        card.style.display = match ? '' : 'none';
        if (match) visiveis++;
    });
    if (empty) empty.classList.toggle('hidden', visiveis > 0);
}

// Atualiza apenas a seção de progresso de cada card sem refazer a consulta ao Drive.
// Usado ao voltar do player pra grade — reflete marcações novas imediatamente.
function _atualizarProgressoCards() {
    const progressData = getProgress();
    const lessonsMap = getLessonsMap();
    document.querySelectorAll('[data-course-id]').forEach(card => {
        const courseId = card.getAttribute('data-course-id');
        const total = parseInt(card.getAttribute('data-total-lessons')) || 0;
        const mapped = lessonsMap[courseId] || [];
        const watched = mapped.filter(id => progressData[id]).length;
        const percent = total > 0 ? Math.min(100, (watched / total) * 100) : 0;

        const statusEl = card.querySelector('.card-progresso-status');
        const barEl = card.querySelector('.card-progresso-bar');
        if (barEl) barEl.style.width = `${percent}%`;
        if (statusEl) {
            if (watched === 0) {
                statusEl.className = 'card-progresso-status text-xs font-label uppercase tracking-widest text-on-surface-variant/60';
                statusEl.innerHTML = 'Não iniciado';
            } else if (percent >= 100) {
                statusEl.className = 'card-progresso-status text-xs font-label uppercase tracking-widest text-tertiary flex items-center gap-1.5';
                statusEl.innerHTML = '<span class="material-symbols-outlined text-[16px]" style="font-variation-settings: \'FILL\' 1;">check_circle</span>Concluído';
            } else {
                statusEl.className = 'card-progresso-status text-xs font-label uppercase tracking-widest text-on-surface-variant';
                statusEl.innerHTML = `${watched}/${total} aulas assistidas`;
            }
        }
    });
}

async function openCourse(courseId, courseTitle) {
    // Se o usuário clicou no mesmo curso que já estava aberto, apenas mostra
    // o player — não recarrega aulas nem zera o vídeo.
    if (libraryState.cursoAtivo && libraryState.cursoAtivo.id === courseId && currentCourseLessons && currentCourseLessons.length) {
        showView('player');
        return;
    }

    // Curso diferente: atualizamos o estado e carregamos aulas do zero.
    libraryState.cursoAtivo = { id: courseId, nome: courseTitle };
    libraryState.aulaAtiva = null;
    libraryState.scrollLessonList = 0;
    libraryState.scrollPlayer = 0;

    showView('player');
    currentCourseId = courseId;
    document.getElementById('course-title-header').innerText = courseTitle;

    // Limpa o filtro de busca ao trocar de curso pra não herdar termo de outro curso.
    const search = document.getElementById('search-lessons');
    if (search) search.value = '';
    const emptyBox = document.getElementById('lesson-list-empty');
    if (emptyBox) emptyBox.classList.add('hidden');

    // Campo de notas volta ao estado inicial enquanto nenhuma aula estiver selecionada.
    const notesTa = document.getElementById('lesson-notes');
    if (notesTa) { notesTa.value = ''; notesTa.disabled = true; }
    const notesInd = document.getElementById('notes-saved-indicator');
    if (notesInd) { notesInd.classList.add('hidden'); notesInd.classList.remove('flex'); }

    const listContainer = document.getElementById('lesson-list');
    // Skeleton da lista de aulas — mantém o visual da coluna sem tela em branco.
    let sk = '';
    for (let i = 0; i < 6; i++) {
        sk += `
            <div class="flex items-center gap-4 p-4 rounded-xl">
                <div class="w-8 h-5 skeleton"></div>
                <div class="flex-1 flex flex-col gap-2">
                    <div class="h-4 w-3/4 skeleton"></div>
                    <div class="h-3 w-1/4 skeleton"></div>
                </div>
                <div class="w-6 h-6 rounded-full skeleton"></div>
            </div>`;
    }
    listContainer.innerHTML = sk;

    document.getElementById('video-iframe').classList.add('hidden');
    document.getElementById('video-iframe').src = "";
    document.getElementById('player-placeholder').classList.remove('hidden');
    document.getElementById('player-fallback').classList.add('hidden');
    const procEl = document.getElementById('player-processing');
    if (procEl) procEl.classList.add('hidden');
    document.getElementById('player-warn').classList.add('hidden');
    document.getElementById('video-title').innerText = "Selecione uma aula na lista...";

    const promessaDrive = eel.carregar_aulas_curso(courseId)();
    const promessaTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000));

    let resposta;
    try {
        resposta = await Promise.race([promessaDrive, promessaTimeout]);
    } catch (e) {
        resposta = { erro: 'timeout', mensagem: 'Leitura do curso excedeu 15s.' };
    }

    if(resposta.erro) {
        const msg = resposta.erro === 'timeout' ? (resposta.mensagem || 'Leitura demorou demais.') : resposta.erro;
        listContainer.innerHTML = `
            <div class="p-4 flex flex-col items-center gap-3 text-center">
                <span class="material-symbols-outlined text-3xl text-error">cloud_off</span>
                <div class="text-error text-sm">${msg}</div>
                <button onclick="openCourse('${courseId}', '${courseTitle.replace(/'/g, "\\'")}')" class="px-4 py-2 bg-primary text-[#001a42] font-bold rounded-full text-xs flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px]">refresh</span>
                    Tentar Novamente
                </button>
            </div>`;
        return;
    }

    currentCourseLessons = resposta.aulas;
    if (typeof saveLessonsMap === 'function') saveLessonsMap(courseId, currentCourseLessons);
    if (typeof renderPlayerUI === 'function') renderPlayerUI();

    // Retoma automaticamente a última aula aberta neste curso (se houver).
    const last = typeof getLastLesson === 'function' ? getLastLesson(courseId) : null;
    if (last && currentCourseLessons.find(a => a.id === last.lessonId)) {
        if (typeof _mostrarRetomando === 'function') _mostrarRetomando(`Retomando: ${last.lessonTitle}`);
        if (typeof playLesson === 'function') playLesson(last.lessonId, last.lessonTitle);
        // Scroll da lista lateral até a aula ativa — rAF pra esperar o DOM re-renderizar.
        requestAnimationFrame(() => {
            const alvo = document.querySelector(`[data-lesson-id="${last.lessonId}"]`);
            if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }
}