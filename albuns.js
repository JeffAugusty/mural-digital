/* Álbum animado: uma etapa da programação, sem alterar a reprodução de mídias. */
const MuralAlbuns = (() => {
    let timer = null;
    let retirada = null;
    let atual = null;
    const urlSegura = valor => {
        try { const u = new URL(valor); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
    };
    const segundos = valor => Math.min(30, Math.max(4, Number(valor) || 7));
    function quadros(album) {
        const fotos = (Array.isArray(album.fotos) ? album.fotos : []).filter(f => urlSegura(f.url));
        const lista = [];
        if (album.abertura === true && String(album.tituloAbertura || '').trim()) {
            lista.push({ abertura: String(album.tituloAbertura).trim(), fotos: [], duracao: 3000 });
        }
        for (let i = 0, n = 0; i < fotos.length; n += 1) {
            const quantidade = album.layout !== 'individual' && n % 2 === 1 && i + 1 < fotos.length ? 2 : 1;
            lista.push({ fotos: fotos.slice(i, i + quantidade), duracao: segundos(album.tempoFoto) * 1000 });
            i += quantidade;
        }
        return fotos.length ? lista : [];
    }
    function visivel(album, agora = Date.now()) {
        if (album.ativo === false || !quadros(album).length) return false;
        const inicio = album.exibirDesde ? new Date(`${album.exibirDesde}T00:00:00`).getTime() : -Infinity;
        const fim = album.exibirAte ? new Date(`${album.exibirAte}T23:59:59.999`).getTime() : Infinity;
        return agora >= inicio && agora <= fim;
    }
    function elemento(tag, classe, texto) {
        const e = document.createElement(tag); e.className = classe;
        if (texto) e.textContent = texto;
        return e;
    }
    function criar(album) {
        const section = elemento('section', 'tela tela-album');
        section.id = `tela-album-${album.id}`;
        section.dataset.programacaoChave = `album:${album.id}`;
        section.dataset.programacaoTipo = 'imagem';
        section.dataset.ordemCategoria = String(Number(album.ordem) || 0);
        section._album = album;
        const card = elemento('div', 'album-card');
        const palco = elemento('div', 'album-palco');
        const progresso = elemento('div', 'album-progresso'); progresso.setAttribute('aria-hidden', 'true');
        progresso.append(elemento('span', 'album-progresso-valor'));
        card.append(palco, progresso);
        const credito = elemento('div', 'credito-desenvolvedor', 'Desenvolvido por ');
        credito.append(elemento('span', '', 'Jeferson Augusto'));
        section.append(card, credito);
        return section;
    }
    function parar() {
        clearTimeout(timer); clearTimeout(retirada); timer = retirada = null;
        atual = null;
    }
    function iniciar(section, finalizar) {
        if (atual === section) return;
        parar(); atual = section;
        const lista = quadros(section._album);
        let indice = 0;
        const palco = section.querySelector('.album-palco');
        palco.replaceChildren();
        const preCarregadas = [];
        const barra = section.querySelector('.album-progresso-valor');
        function mostrar() {
            if (atual !== section || !section.classList.contains('ativa')) { parar(); return; }
            if (indice >= lista.length) { parar(); finalizar(); return; }
            const quadro = lista[indice++];
            const anterior = palco.firstElementChild;
            const frame = elemento('div', `album-quadro${quadro.fotos.length === 2 ? ' album-dupla' : ''}`);
            frame.style.setProperty('--album-tempo', `${quadro.duracao}ms`);
            if (quadro.abertura) frame.append(elemento('h1', 'album-abertura', quadro.abertura));
            for (const foto of quadro.fotos) {
                const figura = elemento('figure', 'album-foto');
                const fundo = elemento('img', 'album-foto-fundo'); fundo.src = urlSegura(foto.url); fundo.alt = ''; fundo.setAttribute('aria-hidden', 'true');
                const img = elemento('img', 'album-foto-frente'); img.src = urlSegura(foto.url); img.alt = foto.legenda || ''; img.decoding = 'async';
                img.addEventListener('error', () => { figura.classList.add('album-foto-erro'); });
                figura.append(fundo, img);
                if (String(foto.legenda || '').trim()) figura.append(elemento('figcaption', 'album-legenda', foto.legenda));
                frame.append(figura);
            }
            palco.append(frame);
            preCarregadas.length = 0;
            for (const foto of (lista[indice]?.fotos || [])) {
                const img = document.createElement('img'); img.src = urlSegura(foto.url); preCarregadas.push(img);
            }
            if (anterior) { clearTimeout(retirada); retirada = setTimeout(() => anterior.remove(), 800); }
            barra.style.width = `${indice / lista.length * 100}%`;
            timer = setTimeout(mostrar, quadro.duracao);
        }
        mostrar();
    }
    return { quadros, visivel, criar, iniciar, parar, segundos };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MuralAlbuns;
