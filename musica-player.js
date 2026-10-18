/* Apresentação da música e histórico da sessão. Não controla áudio nem rotação. */
const MuralMusicas = (() => {
    let sequencia = [];
    let historico = [];
    const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
    const chave = (item, indice = 0) => String(item.id || indice);
    const imagemSegura = valor => {
        try {
            const url = new URL(String(valor || ''));
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch { return ''; }
    };
    const nota = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18V5l10-2v13M9 9l10-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="6" cy="18" r="3" fill="currentColor"/><circle cx="16" cy="16" r="3" fill="currentColor"/></svg>';

    function configurar(itens) {
        sequencia = itens.map((item, indice) => ({ ...item, filaId: chave(item, indice) }));
    }

    function obterFila(id) {
        const indice = sequencia.findIndex(item => item.filaId === String(id));
        if (indice < 0) return [];
        const proximas = [];
        // Com poucas faixas, não preencher a fila com duplicatas artificiais.
        for (let passo = 1; passo <= Math.min(2, sequencia.length - 1); passo += 1) {
            proximas.push(sequencia[(indice + passo) % sequencia.length]);
        }
        return [
            { estado: 'anterior', rotulo: 'Tocou antes', item: historico[historico.length - 2] || null },
            { estado: 'anterior', rotulo: 'Última música', item: historico[historico.length - 1] || null },
            { estado: 'atual', rotulo: 'Agora', item: sequencia[indice] },
            { estado: 'proxima', rotulo: 'Próxima rodada', item: proximas[0] || null },
            { estado: 'proxima', rotulo: 'Depois', item: proximas[1] || null }
        ];
    }

    function renderizarFila(id) {
        return obterFila(id).map(({ estado, rotulo, item }, indice) => {
            const capa = imagemSegura(item?.capaUrl);
            const vazio = estado === 'anterior' ? 'Aguardando o histórico' : 'Nenhuma outra música';
            return `<li class="musica-fila-item ${estado}${item ? '' : ' vazia'}" style="--fila-indice:${indice}" ${estado === 'atual' ? 'aria-current="true"' : ''}>
                <div class="musica-fila-capa">${nota}${capa ? `<img data-musica-imagem src="${escapar(capa)}" alt="" decoding="async">` : ''}</div>
                <div class="musica-fila-texto">
                    <span class="musica-fila-rotulo">${rotulo}</span>
                    <strong>${escapar(item?.titulo || vazio)}</strong>
                    <span class="musica-fila-artista">${escapar(item ? item.artista || 'Artista não informado' : estado === 'anterior' ? 'As músicas tocadas aparecem aqui' : 'A sequência continua nas próximas rodadas')}</span>
                </div>
                ${estado === 'atual' ? '<div class="musica-fila-ondas" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' : '<span class="musica-fila-marcador" aria-hidden="true"></span>'}
            </li>`;
        }).join('');
    }

    function prepararImagens(elemento) {
        elemento.querySelectorAll('img[data-musica-imagem]').forEach(img => {
            const falha = () => { img.hidden = true; };
            img.addEventListener('error', falha, { once: true });
            if (img.complete && !img.naturalWidth) falha();
        });
    }

    function atualizarFila(section) {
        const lista = section.querySelector('.musica-fila-lista');
        if (!lista) return;
        const html = renderizarFila(section.dataset.musicaChave);
        if (lista.dataset.assinatura === html) return;
        lista.innerHTML = html;
        lista.dataset.assinatura = html;
        prepararImagens(lista);
    }

    function registrarSaida(section) {
        if (section.dataset.musicaReproduzida !== 'true') return;
        const item = sequencia.find(item => item.filaId === section.dataset.musicaChave);
        if (item) historico = [...historico, { ...item }].slice(-2);
        delete section.dataset.musicaReproduzida;
    }

    function criarPlayer(item, { capa, audio, videoId }) {
        return `
            <div class="musica-fundo" aria-hidden="true">
                <img data-musica-imagem class="musica-fundo-imagem carregada" src="${escapar(capa)}" alt="">
            </div>
            <div class="musica-card musica-card-sequencia">
                ${videoId
                    ? '<div class="musica-youtube-audio"><div class="youtube-player-alvo"></div></div>'
                    : `<audio class="musica-audio" src="${escapar(audio)}" preload="metadata"></audio>`}
                <div class="musica-destaque">
                    <div class="musica-destaque-topo">
                        <span class="musica-selo"><span></span><b class="musica-status-espera">Preparando música</b><b class="musica-status-tocando">Tocando agora</b></span>
                        <span class="musica-destaque-legenda">Uma pausa para ouvir</span>
                    </div>
                    <div class="musica-arte">
                        <div class="musica-arte-fallback">${nota}</div>
                        <img data-musica-imagem class="musica-arte-ambiente" src="${escapar(capa)}" alt="" aria-hidden="true">
                        <img data-musica-imagem class="musica-capa-imagem carregada" src="${escapar(capa)}" alt="Capa de ${escapar(item.titulo || 'música')}">
                    </div>
                    <div class="musica-identificacao">
                        <h1 class="musica-titulo">${escapar(item.titulo || 'Música')}</h1>
                        <p class="musica-artista">${escapar(item.artista || 'Artista não informado')}</p>
                    </div>
                    <div class="musica-andamento">
                        <div class="musica-progresso" aria-hidden="true"><span class="musica-progresso-preenchimento"></span></div>
                        <div class="musica-tempos"><span class="musica-tempo-atual">0:00</span><span class="musica-tempo-total">0:00</span></div>
                    </div>
                </div>
                <aside class="musica-sequencia" aria-label="Histórico e próximas músicas">
                    <div class="musica-sequencia-cabecalho"><span>SEU INTERVALO MUSICAL</span><h2>Na sequência<span aria-hidden="true"> ↗</span></h2></div>
                    <ol class="musica-fila-lista"></ol>
                    <p class="musica-sequencia-nota">Uma música completa a cada rodada de avisos.</p>
                </aside>
                <div class="musica-aviso-audio" role="status">O navegador bloqueou o áudio. Verifique a permissão de reprodução automática.</div>
            </div>
            <div class="credito-desenvolvedor">Desenvolvido por <span>Jeferson Augusto</span></div>`;
    }
    return { chave, configurar, obterFila, criarPlayer, atualizarFila, registrarSaida, prepararImagens };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MuralMusicas;
