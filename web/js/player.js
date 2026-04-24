let currentLessonId = null;

// Refresh da lista de aulas SEM tocar no vídeo em reprodução.
// Re-consulta o Drive, reordena via _ordem.json e re-renderiza apenas a aside.
async function refreshAulasDoCurso() {
    if (!libraryState.cursoAtivo) return;
    const courseId = libraryState.cursoAtivo.id;
    const btn = document.getElementById('btn-refresh-lessons');
    const icon = btn && btn.querySelector('.material-symbols-outlined');

    if (icon) icon.classList.add('animate-spin');
    if (btn) btn.disabled = true;

    const inicio = Date.now();

    try {
        const promessaDrive = eel.carregar_aulas_curso(courseId)();
        const promessaTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000));
        const resp = await Promise.race([promessaDrive, promessaTimeout]);

        if (resp && !resp.erro) {
            currentCourseLessons = resp.aulas;
            // renderPlayerUI usa libraryState.aulaAtiva.id (via currentLessonId)
            // pra recolocar o highlight na aula que está tocando.
            // O iframe NÃO é reatribuído aqui — o vídeo continua intacto.
            renderPlayerUI();
        } else {
            console.warn('Falha ao atualizar aulas:', resp && (resp.mensagem || resp.erro));
        }
    } catch (e) {
        console.warn('Erro ao atualizar aulas:', e);
    } finally {
        // Mantém o ícone girando por no mínimo 800ms para dar feedback visível
        // mesmo quando a resposta do Drive chega quase instantânea.
        const decorrido = Date.now() - inicio;
        const restante = Math.max(0, 800 - decorrido);
        setTimeout(() => {
            if (icon) icon.classList.remove('animate-spin');
            if (btn) btn.disabled = false;
        }, restante);
    }
}

function renderPlayerUI() {
    const listContainer = document.getElementById('lesson-list');
    listContainer.innerHTML = '';
    const progressData = getProgress();
    let watchedCount = 0;

    currentCourseLessons.forEach((lesson, index) => {
        const isWatched = progressData[lesson.id] || false;
        if(isWatched) watchedCount++;

        const checkIcon = isWatched ? 'check_circle' : 'radio_button_unchecked';
        const checkColor = isWatched ? 'text-tertiary' : 'text-on-surface-variant/50';
        const opacity = isWatched ? 'opacity-60' : 'opacity-100';
        const activeStyle = currentLessonId === lesson.id ? 'bg-surface-container-highest border border-primary/30' : 'hover:bg-surface-container';
        const noteIcon = (typeof _temNotaAula === 'function' && _temNotaAula(lesson.id))
            ? `<span title="Esta aula tem anotações" class="material-symbols-outlined text-[16px] text-primary/80 flex-shrink-0">edit_note</span>`
            : '';

        listContainer.innerHTML += `
            <div class="lesson-row group flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${activeStyle} ${opacity}" data-lesson-id="${lesson.id}" data-lesson-title="${lesson.title.replace(/"/g, '&quot;')}">
                <div class="flex-shrink-0 w-8 flex justify-center" onclick="playLesson('${lesson.id}', '${lesson.title.replace(/'/g, "\\'")}')">
                    <span class="font-label text-sm text-on-surface-variant font-bold">${index + 1}</span>
                </div>
                <div class="flex-1 flex flex-col min-w-0" onclick="playLesson('${lesson.id}', '${lesson.title.replace(/'/g, "\\'")}')">
                    <div class="flex items-center gap-1.5">
                        <span class="text-sm font-medium ${isWatched ? 'text-on-surface-variant' : 'text-on-surface'} transition-colors truncate">${lesson.title}</span>
                        ${noteIcon}
                    </div>
                    <span class="text-xs text-on-surface-variant/60 mt-0.5">${lesson.type.toUpperCase()}</span>
                </div>
                <div class="flex-shrink-0 p-2 rounded-full hover:bg-surface-container-high transition-colors" onclick="toggleLessonWatched('${lesson.id}')">
                    <span class="material-symbols-outlined ${checkColor} text-[24px]" style="${isWatched ? "font-variation-settings: 'FILL' 1;" : ""}">${checkIcon}</span>
                </div>
            </div>`;
    });

    const total = currentCourseLessons.length;
    const percent = total > 0 ? (watchedCount / total) * 100 : 0;
    document.getElementById('progress-text').innerText = `${watchedCount}/${total} Aulas Assistidas`;
    document.getElementById('progress-percent').innerText = `${Math.round(percent)}% Concluído`;
    document.getElementById('progress-bar').style.width = `${percent}%`;

    // Re-aplica o filtro atual pra não perdê-lo ao re-renderizar (ex: após marcar uma aula).
    const search = document.getElementById('search-lessons');
    if (search && search.value) filtrarAulas();
}

function filtrarAulas() {
    const input = document.getElementById('search-lessons');
    if (!input) return;
    const termo = input.value.trim().toLowerCase();
    const list = document.getElementById('lesson-list');
    const empty = document.getElementById('lesson-list-empty');
    let visiveis = 0;
    list.querySelectorAll('.lesson-row').forEach(el => {
        const titulo = (el.getAttribute('data-lesson-title') || '').toLowerCase();
        const match = !termo || titulo.includes(termo);
        el.style.display = match ? '' : 'none';
        if (match) visiveis++;
    });
    if (empty) empty.classList.toggle('hidden', visiveis > 0);
}

// Estado do player usado para fallback em cascata
let _playerTentativaTimer = null;
let _playerInfo = null;

function _mostrarPlayerFallback(mensagem) {
    const placeholder = document.getElementById('player-placeholder');
    const iframe = document.getElementById('video-iframe');
    const fallback = document.getElementById('player-fallback');
    const fallbackMsg = document.getElementById('player-fallback-msg');
    const fallbackLink = document.getElementById('player-fallback-link');
    const card = document.getElementById('video-card');
    const processing = document.getElementById('player-processing');

    placeholder.classList.add('hidden');
    iframe.classList.add('hidden');
    iframe.src = "";
    if (card) card.classList.add('hidden');
    if (processing) processing.classList.add('hidden');
    fallback.classList.remove('hidden');
    fallbackMsg.innerText = mensagem || 'Tente abri-lo direto no Google Drive.';
    fallbackLink.href = (_playerInfo && _playerInfo.drive_url) || '#';
}

function _mostrarPlayerProcessando() {
    clearTimeout(_playerTentativaTimer);
    const placeholder = document.getElementById('player-placeholder');
    const iframe = document.getElementById('video-iframe');
    const fallback = document.getElementById('player-fallback');
    const card = document.getElementById('video-card');
    const video = document.getElementById('video-player');
    const processing = document.getElementById('player-processing');
    const link = document.getElementById('player-processing-link');

    placeholder.classList.add('hidden');
    iframe.classList.add('hidden');
    iframe.src = "";
    fallback.classList.add('hidden');
    if (card) card.classList.add('hidden');
    video.classList.add('hidden');
    processing.classList.remove('hidden');
    link.href = (_playerInfo && _playerInfo.drive_url) || '#';
}

function playHLS(fileId, driveUrl) {
    const video = document.getElementById('video-player');
    const iframe = document.getElementById('video-iframe');
    const placeholder = document.getElementById('player-placeholder');

    // Placeholder some imediatamente — não esperar manifest/onload
    placeholder.classList.add('hidden');

    if (!Hls.isSupported()) {
        // Fallback para iframe se HLS não suportado
        iframe.src = driveUrl;
        iframe.classList.remove('hidden');
        video.classList.add('hidden');
        return;
    }

    // Para qualquer stream anterior
    if (window._hlsInstance) {
        fetch(`http://localhost:8765/stop/${window._hlsFileId}`)
            .catch(() => {});
        window._hlsInstance.destroy();
        window._hlsInstance = null;
    }

    window._hlsFileId = fileId;
    const src = `http://localhost:8765/stream/${fileId}/playlist.m3u8`
        + `?url=${encodeURIComponent(driveUrl)}`;

    const hls = new Hls({ maxBufferLength: 60 });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play();
        // Restaurar posição salva
        const prefixo = typeof _getPrefixo === 'function' ? _getPrefixo() : '';
        const t = localStorage.getItem(prefixo + 'lessonTime_' + fileId);
        if (t) video.currentTime = parseInt(t);
    });
    hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
            // Fallback para iframe — placeholder já escondido
            video.classList.add('hidden');
            iframe.classList.remove('hidden');
            iframe.src = driveUrl;
            placeholder.classList.add('hidden');
        }
    });

    // Salvar posição a cada 5s
    video.ontimeupdate = () => {
        const prefixo = typeof _getPrefixo === 'function' ? _getPrefixo() : '';
        localStorage.setItem(
            prefixo + 'lessonTime_' + fileId,
            Math.floor(video.currentTime)
        );
    };

    video.classList.remove('hidden');
    iframe.classList.add('hidden');
    window._hlsInstance = hls;
}

function _tentarMetodoEmbed(url, tentativaAtual) {
    const iframe = document.getElementById('video-iframe');
    const video = document.getElementById('video-player');
    const placeholder = document.getElementById('player-placeholder');
    const fallback = document.getElementById('player-fallback');
    const card = document.getElementById('video-card');
    const processing = document.getElementById('player-processing');

    // Visibilidade SÍNCRONA — não esperar onload.
    placeholder.classList.add('hidden');
    fallback.classList.add('hidden');
    video.classList.add('hidden');
    if (card) card.classList.add('hidden');
    if (processing) processing.classList.add('hidden');
    iframe.classList.remove('hidden');
    iframe.src = url;

    // onload + timeout 20s existem SÓ para detectar falha (acionar fallback),
    // nunca para controlar visibilidade. Iframes cross-origin não disparam
    // onerror confiável — usamos ausência de onload como sinal de falha.
    let carregou = false;
    iframe.onload = () => { carregou = true; };

    clearTimeout(_playerTentativaTimer);
    _playerTentativaTimer = setTimeout(() => {
        if (carregou) return;
        if (tentativaAtual === 1 && _playerInfo) {
            // Método 1 (preview) falhou — tenta método 2 (uc?export=download)
            _tentarMetodoEmbed(_playerInfo.download_url, 2);
        } else {
            _mostrarPlayerFallback('Nenhum método de reprodução funcionou. Abra o arquivo diretamente no Google Drive.');
        }
    }, 20000);
}

function _ehVideo(lessonId, title) {
    const lesson = (currentCourseLessons || []).find(l => l.id === lessonId);
    if (lesson && lesson.type === 'video') return true;
    const t = (title || '').toLowerCase();
    return /\.(mp4|mkv|avi|mov|webm|m4v|wmv|flv)$/.test(t);
}

function _mostrarVideoCard(lessonId, title, driveUrl) {
    document.getElementById('player-placeholder').classList.add('hidden');
    document.getElementById('player-fallback').classList.add('hidden');
    document.getElementById('video-iframe').classList.add('hidden');
    document.getElementById('video-iframe').src = "";
    document.getElementById('video-player').classList.add('hidden');

    const card = document.getElementById('video-card');
    const copied = document.getElementById('video-card-copied');

    document.getElementById('video-card-title').innerText = title;
    copied.classList.add('hidden');

    document.getElementById('video-card-open').onclick = () => {
        if (typeof eel !== 'undefined' && eel.abrir_no_browser) {
            eel.abrir_no_browser(driveUrl)();
        } else {
            window.open(driveUrl, '_blank');
        }
    };
    document.getElementById('video-card-copy').onclick = async () => {
        try {
            await navigator.clipboard.writeText(driveUrl);
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = driveUrl;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (_) {}
            document.body.removeChild(ta);
        }
        copied.classList.remove('hidden');
        setTimeout(() => copied.classList.add('hidden'), 2000);
    };

    card.classList.remove('hidden');
}

async function playLesson(lessonId, title) {
    if (libraryState.aulaAtiva && libraryState.aulaAtiva.id === lessonId) {
        renderPlayerUI();
        return;
    }

    if (typeof _tentarCapturarPosicao === 'function') _tentarCapturarPosicao();

    libraryState.aulaAtiva = { id: lessonId, title: title, tempoAtual: 0 };
    currentLessonId = lessonId;
    if (currentCourseId && typeof saveLastLesson === 'function') saveLastLesson(currentCourseId, lessonId, title);
    document.getElementById('video-title').innerText = title;
    document.getElementById('player-warn').classList.add('hidden');
    if (typeof _carregarNotasNoCampo === 'function') _carregarNotasNoCampo(lessonId);
    clearTimeout(_playerTentativaTimer);

    // Reset estado do player
    document.getElementById('player-placeholder').classList.remove('hidden');
    document.getElementById('player-fallback').classList.add('hidden');
    document.getElementById('player-processing').classList.add('hidden');
    document.getElementById('video-iframe').classList.add('hidden');
    document.getElementById('video-iframe').src = "";
    document.getElementById('video-card').classList.add('hidden');
    document.getElementById('video-player').classList.add('hidden');

    const driveViewUrl = `https://drive.google.com/file/d/${lessonId}/view`;
    const previewUrlBase = `https://drive.google.com/file/d/${lessonId}/preview?embedded=true`;

    _playerInfo = {
        preview_url: previewUrlBase,
        download_url: `https://drive.google.com/uc?export=download&id=${lessonId}`,
        drive_url: driveViewUrl,
        is_public: null
    };

    const lessonAtivoId = lessonId;
    // Backend em paralelo — is_public + is_processing + URLs oficiais
    eel.obter_link_aula(lessonId)().then(info => {
        if (!info || info.erro) return;
        // Usuário já pode ter clicado em outra aula — ignora resposta tardia.
        if (currentLessonId !== lessonAtivoId) return;
        _playerInfo = info;
        if (info.is_processing) {
            _mostrarPlayerProcessando();
            return;
        }
        if (info.is_public === false) {
            document.getElementById('player-warn').classList.remove('hidden');
        }
    }).catch(() => {});

    _tentarMetodoEmbed(previewUrlBase, 1);
    renderPlayerUI();
}
