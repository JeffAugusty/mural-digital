// ======================================================
// MURAL DIGITAL - FIREBASE COMPATÍVEL
// Mantém: clima, eventos, QR Code, contagem, imagens, vídeos e músicas do YouTube
// ======================================================

const firebaseConfig = {
    apiKey: 'AIzaSyBxD5x__EVbG06U4_wz4VRil_e1t-cB3EY',
    authDomain: 'mural-digital-uniube.firebaseapp.com',
    projectId: 'mural-digital-uniube',
    storageBucket: 'mural-digital-uniube.firebasestorage.app',
    messagingSenderId: '942785678797',
    appId: '1:942785678797:web:e349801af7aa24a582c884'
};

let db = null;

try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        db = firebase.firestore();
    }
} catch (erro) {
    console.error('Erro ao iniciar o Firebase:', erro);
}

const LAT = '-18.98';
const LON = '-49.46';

const TEMPO_CLIMA = 25000;
const TEMPO_EVENTO = 25000;
const TEMPO_COMUNICADO = 15000;
const CHAVE_CACHE_EVENTOS = 'mural-eventos-firebase-v1';
const CHAVE_CACHE_COMUNICADOS = 'mural-comunicados-firebase-v1';
const CHAVE_CACHE_MIDIAS_YOUTUBE = 'mural-midias-youtube-firebase-v1';
const ID_CONFIGURACAO_IMAGENS = 'configuracao-imagens-mural';
const ID_CONFIGURACAO_MIDIAS_YOUTUBE = 'configuracao-videos-mural';
const MODO_PREVIA_ADMIN =
    new URLSearchParams(window.location.search).get('previewAdmin') === '1';

let telas = [];
let step = 0;
let timerRotacao = null;
let midiasYoutube = [];
let playersYoutube = new Map();
let promessaApiYoutube = null;
let playersSpotify = new Map();
let promessaApiSpotify = null;
let apiSpotify = null;
let liveFixaId = '';
let assinaturaMidiasYoutube = '';
let geracaoMidiasYoutube = 0;
let somPreviaAdminAtivo = false;
let idMusicaDaRodada = '';


// ======================================================
// RELÓGIO
// ======================================================

function atualizarRelogio() {
    const agora = new Date();

    document.getElementById('relogio').textContent =
        agora.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

    document.getElementById('data-extenso').textContent =
        agora.toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
}


// ======================================================
// CLIMA
// ======================================================

function escolherClima(codigo, isDay) {
    const code = Number(codigo);
    const dia = Number(isDay) === 1;
    const tempestade = code >= 95;
    const chuva =
        (code >= 51 && code <= 82) ||
        code === 85 ||
        code === 86;
    const nublado = [2, 3, 45, 48].includes(code);

    if (!dia) {
        if (tempestade) {
            return {
                video: 'assets/noite-tempestade.mp4',
                descricao: 'Tempestade'
            };
        }

        if (chuva) {
            return {
                video: 'assets/noite-chuvosa.mp4',
                descricao: 'Chuva'
            };
        }

        if (nublado) {
            return {
                video: 'assets/noite-nublada.mp4',
                descricao: code >= 45 ? 'Neblina' : 'Nublado'
            };
        }

        return {
            video: 'assets/noite-estrelada.mp4',
            descricao: 'Céu Limpo'
        };
    }

    if (tempestade) {
        return {
            video: 'assets/ceu-nublado.mp4',
            descricao: 'Tempestade'
        };
    }

    if (chuva) {
        return {
            video: 'assets/ceu-nublado.mp4',
            descricao: 'Chuva'
        };
    }

    if (nublado) {
        return {
            video: 'assets/ceu-nublado.mp4',
            descricao: code >= 45 ? 'Neblina' : 'Nublado'
        };
    }

    if (code === 1) {
        return {
            video: 'assets/ceu-ensolarado.mp4',
            descricao: 'Ensolarado'
        };
    }

    return {
        video: 'assets/ceu-limpo.mp4',
        descricao: 'Céu Limpo'
    };
}


async function atualizarClima() {
    try {
        const url =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${LAT}` +
            `&longitude=${LON}` +
            `&current=temperature_2m,weather_code,is_day` +
            `&daily=temperature_2m_max,temperature_2m_min` +
            `&timezone=America%2FSao_Paulo`;

        const resposta = await fetch(url, {
            cache: 'no-store'
        });

        if (!resposta.ok) {
            throw new Error(`Erro HTTP ${resposta.status}`);
        }

        const dados = await resposta.json();

        const clima = escolherClima(
            dados.current.weather_code,
            dados.current.is_day
        );

        document.getElementById('temp-valor').textContent =
            `${Math.round(dados.current.temperature_2m)}°C`;

        document.getElementById('temp-max').textContent =
            `Máx: ${Math.round(dados.daily.temperature_2m_max[0])}°C`;

        document.getElementById('temp-min').textContent =
            `Mín: ${Math.round(dados.daily.temperature_2m_min[0])}°C`;

        document.getElementById('condicao').textContent =
            clima.descricao;

        document.getElementById('cidade').textContent =
            'ITUIUTABA';

        trocarVideoClima(clima.video);

    } catch (erro) {
        console.error('Erro ao carregar o clima:', erro);

        document.getElementById('condicao').textContent =
            'CLIMA INDISPONÍVEL';
    }
}


function trocarVideoClima(novoVideo) {
    const video =
        document.getElementById('weather-video');

    const source =
        video.querySelector('source');

    if (source.getAttribute('src') === novoVideo) {
        return;
    }

    source.setAttribute('src', novoVideo);
    video.load();

    if (
        document
            .getElementById('tela-tempo')
            .classList.contains('ativa')
    ) {
        video.play().catch(() => {});
    }
}


// ======================================================
// DATAS
// ======================================================

function normalizarData(dataTexto) {
    const texto = String(dataTexto || '').trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return texto;
    }

    const resultado =
        texto.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);

    if (!resultado) {
        return '';
    }

    return (
        `${resultado[3]}-` +
        `${String(Number(resultado[2])).padStart(2, '0')}-` +
        `${String(Number(resultado[1])).padStart(2, '0')}`
    );
}


function formatarDataBR(dataTexto) {
    const data = normalizarData(dataTexto);

    if (!data) {
        return String(dataTexto || '');
    }

    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}


function converterData(
    dataTexto,
    horaTexto = '00:00:00',
    fimDoDia = false
) {
    const data = normalizarData(dataTexto);

    if (!data) {
        return null;
    }

    const numerosHora =
        String(horaTexto || '').match(/\d+/g) || [];

    const hora =
        fimDoDia ? 23 : Number(numerosHora[0] || 0);

    const minuto =
        fimDoDia ? 59 : Number(numerosHora[1] || 0);

    const segundo =
        fimDoDia ? 59 : Number(numerosHora[2] || 0);

    if (
        hora > 23 ||
        minuto > 59 ||
        segundo > 59
    ) {
        return null;
    }

    const horario =
        `${String(hora).padStart(2, '0')}:` +
        `${String(minuto).padStart(2, '0')}:` +
        `${String(segundo).padStart(2, '0')}`;

    const timestamp =
        Date.parse(`${data}T${horario}-03:00`);

    return Number.isFinite(timestamp)
        ? timestamp
        : null;
}


function eventoEstaVisivel(evento) {
    if (evento.ativo === false) {
        return false;
    }

    const agora = Date.now();

    const inicio = evento.exibirDesde
        ? converterData(evento.exibirDesde)
        : null;

    const fim = evento.exibirAte
        ? converterData(evento.exibirAte, '00:00:00', true)
        : null;

    if (inicio !== null && agora < inicio) {
        return false;
    }

    if (fim !== null && agora > fim) {
        return false;
    }

    return true;
}


// ======================================================
// CORES E SEGURANÇA
// ======================================================

function validarCor(valor, padrao) {
    const cor = String(valor || '').trim();

    if (/^#[0-9a-f]{6}$/i.test(cor)) {
        return cor.toUpperCase();
    }

    return padrao;
}


function corDeContraste(cor) {
    const hexadecimal = cor.replace('#', '');

    const vermelho = parseInt(hexadecimal.substring(0, 2), 16);
    const verde = parseInt(hexadecimal.substring(2, 4), 16);
    const azul = parseInt(hexadecimal.substring(4, 6), 16);

    const luminosidade =
        (vermelho * 299 + verde * 587 + azul * 114) / 1000;

    return luminosidade >= 150
        ? '#171717'
        : '#FFFFFF';
}


function aplicarCoresEvento(section, evento) {
    const principal =
        validarCor(evento.corPrincipal, '#FFB000');

    const secundaria =
        validarCor(evento.corSecundaria, '#EE2B0B');

    const destaque =
        validarCor(evento.corDestaque, '#FFD400');

    const texto =
        validarCor(evento.corTexto, '#FFFFFF');

    section.style.setProperty(
        '--evento-cor-principal',
        principal
    );

    section.style.setProperty(
        '--evento-cor-secundaria',
        secundaria
    );

    section.style.setProperty(
        '--evento-cor-destaque',
        destaque
    );

    section.style.setProperty(
        '--evento-cor-texto',
        texto
    );

    section.style.setProperty(
        '--evento-cor-destaque-texto',
        corDeContraste(destaque)
    );

    section.style.setProperty(
        'background',
        `linear-gradient(135deg, ${principal}, ${secundaria})`,
        'important'
    );
}


function escaparHTML(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function validarLink(valor) {
    try {
        const url = new URL(
            String(valor || '').trim()
        );

        if (
            url.protocol === 'https:' ||
            url.protocol === 'http:'
        ) {
            return url.href;
        }

        return '';

    } catch {
        return '';
    }
}


function obterDominio(link) {
    try {
        return new URL(link)
            .hostname
            .replace(/^www\./, '');

    } catch {
        return '';
    }
}


// ======================================================
// EVENTOS DO FIREBASE
// ======================================================

function salvarCacheEventos(eventos) {
    try {
        localStorage.setItem(
            CHAVE_CACHE_EVENTOS,
            JSON.stringify(eventos)
        );
    } catch (erro) {
        console.warn('Não foi possível salvar o cache:', erro);
    }
}


function carregarCacheEventos() {
    try {
        const dados =
            localStorage.getItem(CHAVE_CACHE_EVENTOS);

        return dados
            ? JSON.parse(dados)
            : [];

    } catch {
        return [];
    }
}


function renderizarEventos(lista) {
    const idAtivo = obterIdTelaAtiva();

    const eventos = lista
        .filter(eventoEstaVisivel)
        .sort((a, b) =>
            (Number(a.ordem || 0) - Number(b.ordem || 0)) ||
            String(a.data || '').localeCompare(String(b.data || ''))
        );

    const container =
        document.getElementById('container-eventos');

    const novasTelas = [];

    eventos.forEach(evento => {
        const destino =
            converterData(evento.data, evento.hora);

        if (destino === null) {
            console.error(
                'Data ou horário inválido:',
                evento.data,
                evento.hora
            );

            return;
        }

        const section =
            document.createElement('section');

        section.className =
            'tela tela-evento';

        section.id =
            `tela-evento-${evento.id}`;

        const segundos =
            Math.max(5, Number(evento.duracao || 25));

        section.dataset.duration =
            String(segundos * 1000);

        aplicarCoresEvento(section, evento);

        const titulo =
            escaparHTML(evento.titulo);

        const data =
            escaparHTML(formatarDataBR(evento.data));

        const hora =
            escaparHTML(evento.hora);

        const local =
            escaparHTML(evento.local);

        const chamada =
            escaparHTML(evento.chamada);

        const link =
            validarLink(evento.link);

        const dominio =
            escaparHTML(obterDominio(link));

        section.innerHTML = `
            <div class="evento-fundo"></div>

            <div class="evento-card">

                <div class="evento-conteudo">

                    <div class="evento-etiqueta">
                        PRÓXIMO EVENTO
                    </div>

                    <h1 class="evento-titulo">
                        ${titulo}
                    </h1>

                    <div class="evento-informacoes">

                        <div class="evento-informacao">
                            <span>DATA</span>
                            <strong>${data}</strong>
                        </div>

                        <div class="evento-informacao">
                            <span>HORÁRIO</span>
                            <strong>${hora}</strong>
                        </div>

                        <div class="evento-informacao evento-local">
                            <span>LOCAL</span>
                            <strong>${local}</strong>
                        </div>

                    </div>

                    <div class="evento-chamada">
                        ${chamada}
                    </div>

                    <div
                        class="evento-contagem"
                        data-destino="${destino}"
                    >
                        <div class="evento-contagem-titulo">
                            O EVENTO COMEÇA EM
                        </div>

                        <div class="contador">

                            <div class="contador-bloco">
                                <strong data-unidade="dias">00</strong>
                                <span>DIAS</span>
                            </div>

                            <div class="contador-separador">:</div>

                            <div class="contador-bloco">
                                <strong data-unidade="horas">00</strong>
                                <span>HORAS</span>
                            </div>

                            <div class="contador-separador">:</div>

                            <div class="contador-bloco">
                                <strong data-unidade="minutos">00</strong>
                                <span>MIN</span>
                            </div>

                            <div class="contador-separador">:</div>

                            <div class="contador-bloco">
                                <strong data-unidade="segundos">00</strong>
                                <span>SEG</span>
                            </div>

                        </div>
                    </div>

                </div>

                <div class="evento-lateral">

                    <aside class="evento-acao">

                        <div class="evento-qr-titulo">
                            APONTE A CÂMERA
                        </div>

                        <div class="evento-qr-code"></div>

                        <div class="evento-qr-texto">
                            Inscrições e informações
                        </div>

                        <div class="evento-dominio">
                            ${dominio}
                        </div>

                    </aside>

                    <img
                        src="logo-uniube.png"
                        class="evento-logo"
                        alt="Uniube"
                    >

                </div>

            </div>

            <div class="credito-desenvolvedor">
                Desenvolvido por
                <span>Jeferson Augusto</span>
            </div>
        `;

        novasTelas.push({
            section,
            link
        });
    });

    container.replaceChildren(
        ...novasTelas.map(item => item.section)
    );

    atualizarContagens();

    novasTelas.forEach(item => {
        criarQRCode(
            item.section,
            item.link
        );
    });

    sincronizarTelas(idAtivo);
    agendarRotacao();
}


function iniciarEventosFirebase() {
    const cache = carregarCacheEventos();

    if (cache.length) {
        renderizarEventos(cache);
    }

    if (!db) {
        console.error('Firebase indisponível. O restante do mural continuará funcionando.');

        if (!cache.length) {
            renderizarEventos([]);
        }

        return;
    }

    db.collection('eventos').onSnapshot(
        snapshot => {
            const eventos = snapshot.docs
                .map(documento => ({
                    id: documento.id,
                    ...documento.data()
                }))
                .filter(evento =>
                    evento.id !== ID_CONFIGURACAO_IMAGENS &&
                    evento.id !== ID_CONFIGURACAO_MIDIAS_YOUTUBE &&
                    evento.tipo !== 'configuracao-imagens' &&
                    evento.tipo !== 'configuracao-videos'
                );

            salvarCacheEventos(eventos);
            renderizarEventos(eventos);

            console.info(
                `${eventos.length} evento(s) recebido(s) do Firebase.`
            );
        },
        erro => {
            console.error(
                'Erro ao receber eventos do Firebase:',
                erro
            );

            if (!cache.length) {
                renderizarEventos([]);
            }
        }
    );
}


// ======================================================
// QR CODE
// ======================================================

function criarQRCode(section, link) {
    const area =
        section.querySelector('.evento-qr-code');

    const lateral =
        section.querySelector('.evento-lateral');

    if (!link) {
        lateral.style.display = 'none';
        return;
    }

    if (typeof window.QRCode === 'undefined') {
        area.textContent = 'QR indisponível';
        return;
    }

    try {
        area.innerHTML = '';

        new window.QRCode(area, {
            text: link,
            width: 260,
            height: 260,
            colorDark: '#101010',
            colorLight: '#FFFFFF',
            correctLevel:
                window.QRCode.CorrectLevel.M
        });

    } catch (erro) {
        console.error('Erro ao criar QR Code:', erro);
        area.textContent = 'QR indisponível';
    }
}


// ======================================================
// CONTAGEM REGRESSIVA
// ======================================================

function atualizarContagens() {
    const contagens =
        document.querySelectorAll('.evento-contagem');

    contagens.forEach(contagem => {
        const destino =
            Number(contagem.dataset.destino);

        const titulo =
            contagem.querySelector('.evento-contagem-titulo');

        const campo = unidade =>
            contagem.querySelector(
                `[data-unidade="${unidade}"]`
            );

        if (!Number.isFinite(destino)) {
            titulo.textContent = 'DATA INDISPONÍVEL';
            campo('dias').textContent = '--';
            campo('horas').textContent = '--';
            campo('minutos').textContent = '--';
            campo('segundos').textContent = '--';
            return;
        }

        const diferenca =
            destino - Date.now();

        if (diferenca <= 0) {
            titulo.textContent = 'EVENTO EM ANDAMENTO';
            campo('dias').textContent = '00';
            campo('horas').textContent = '00';
            campo('minutos').textContent = '00';
            campo('segundos').textContent = '00';
            return;
        }

        const dias =
            Math.floor(diferenca / 86400000);

        const horas =
            Math.floor(
                (diferenca % 86400000) / 3600000
            );

        const minutos =
            Math.floor(
                (diferenca % 3600000) / 60000
            );

        const segundos =
            Math.floor(
                (diferenca % 60000) / 1000
            );

        titulo.textContent = 'O EVENTO COMEÇA EM';
        campo('dias').textContent = String(dias).padStart(2, '0');
        campo('horas').textContent = String(horas).padStart(2, '0');
        campo('minutos').textContent = String(minutos).padStart(2, '0');
        campo('segundos').textContent = String(segundos).padStart(2, '0');
    });
}


// ======================================================
// VÍDEOS E TRANSMISSÕES DO YOUTUBE
// ======================================================

function extrairIdYoutube(valor) {
    const texto = String(valor || '').trim();

    if (/^[a-zA-Z0-9_-]{11}$/.test(texto)) {
        return texto;
    }

    try {
        const url = new URL(texto);
        const dominio = url.hostname.replace(/^www\./, '').toLowerCase();
        let id = '';

        if (dominio === 'youtu.be') {
            id = url.pathname.split('/').filter(Boolean)[0] || '';
        } else if (
            dominio === 'youtube.com' ||
            dominio === 'm.youtube.com' ||
            dominio === 'music.youtube.com'
        ) {
            id = url.searchParams.get('v') || '';

            if (!id) {
                const partes = url.pathname.split('/').filter(Boolean);
                if (['embed', 'live', 'shorts'].includes(partes[0])) {
                    id = partes[1] || '';
                }
            }
        }

        return /^[a-zA-Z0-9_-]{11}$/.test(id)
            ? id
            : '';
    } catch {
        return '';
    }
}


function converterAgendaYoutube(valor, fimDoDia = false) {
    const texto = String(valor || '').trim();

    if (!texto) {
        return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return converterData(
            texto,
            fimDoDia ? '23:59:59' : '00:00:00',
            fimDoDia
        );
    }

    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(texto)) {
        return null;
    }

    const comSegundos = texto.length === 16
        ? `${texto}:00`
        : texto;

    const timestamp = Date.parse(`${comSegundos}-03:00`);

    return Number.isFinite(timestamp)
        ? timestamp
        : null;
}


function midiaYoutubeEstaVisivel(item) {
    if (item.ativo === false) {
        return false;
    }

    const link = item.url || item.link;
    const linkValido = Boolean(extrairIdYoutube(link));

    if (!linkValido) {
        return false;
    }

    const agora = Date.now();
    const inicio = item.inicio
        ? converterAgendaYoutube(item.inicio)
        : null;
    const fim = item.fim
        ? converterAgendaYoutube(item.fim, true)
        : null;

    if (inicio !== null && agora < inicio) {
        return false;
    }

    if (fim !== null && agora > fim) {
        return false;
    }

    return true;
}


function carregarCacheMidiasYoutube() {
    try {
        const dados = JSON.parse(
            localStorage.getItem(CHAVE_CACHE_MIDIAS_YOUTUBE) || '[]'
        );

        return Array.isArray(dados)
            ? dados
            : [];
    } catch (erro) {
        console.warn('Não foi possível ler o cache do YouTube:', erro);
        return [];
    }
}


function salvarCacheMidiasYoutube(lista) {
    try {
        localStorage.setItem(
            CHAVE_CACHE_MIDIAS_YOUTUBE,
            JSON.stringify(lista)
        );
    } catch (erro) {
        console.warn('Não foi possível salvar o cache do YouTube:', erro);
    }
}


function carregarApiYoutube() {
    if (window.YT && typeof window.YT.Player === 'function') {
        return Promise.resolve(window.YT);
    }

    if (promessaApiYoutube) {
        return promessaApiYoutube;
    }

    promessaApiYoutube = new Promise((resolve, reject) => {
        const callbackAnterior = window.onYouTubeIframeAPIReady;
        const limite = window.setTimeout(() => {
            document
                .querySelector('script[data-api-youtube]')
                ?.remove();
            promessaApiYoutube = null;
            reject(new Error('A API do YouTube não respondeu.'));
        }, 20000);

        window.onYouTubeIframeAPIReady = () => {
            window.clearTimeout(limite);

            if (typeof callbackAnterior === 'function') {
                try {
                    callbackAnterior();
                } catch (erro) {
                    console.warn('Callback anterior do YouTube falhou:', erro);
                }
            }

            resolve(window.YT);
        };

        if (!document.querySelector('script[data-api-youtube]')) {
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            script.dataset.apiYoutube = 'true';
            script.onerror = () => {
                window.clearTimeout(limite);
                script.remove();
                promessaApiYoutube = null;
                reject(new Error('Não foi possível carregar o YouTube.'));
            };
            document.head.appendChild(script);
        }
    });

    return promessaApiYoutube;
}


function destruirPlayersYoutube() {
    playersYoutube.forEach(registro => {
        try {
            registro.player.destroy();
        } catch {
            // O iframe pode já ter sido removido pelo navegador.
        }
    });

    playersYoutube.clear();
}


function linkSpotifyValido(valor) {
    const texto = String(valor || '').trim();

    if (/^spotify:track:[a-zA-Z0-9]+$/i.test(texto)) {
        return true;
    }

    try {
        const url = new URL(texto);
        const dominio = url.hostname.replace(/^www\./, '').toLowerCase();
        const partes = url.pathname.split('/').filter(Boolean);

        if (dominio === 'open.spotify.com') {
            const indiceTrack = partes.indexOf('track');
            return indiceTrack >= 0 && /^[a-zA-Z0-9]+$/.test(partes[indiceTrack + 1] || '');
        }

        return dominio === 'spotify.link' && partes.length > 0;
    } catch {
        return false;
    }
}


function carregarApiSpotify() {
    if (apiSpotify) {
        return Promise.resolve(apiSpotify);
    }

    if (promessaApiSpotify) {
        return promessaApiSpotify;
    }

    promessaApiSpotify = new Promise((resolve, reject) => {
        const callbackAnterior = window.onSpotifyIframeApiReady;
        const limite = window.setTimeout(() => {
            document
                .querySelector('script[data-api-spotify]')
                ?.remove();
            promessaApiSpotify = null;
            reject(new Error('A API do Spotify não respondeu.'));
        }, 20000);

        window.onSpotifyIframeApiReady = iframeApi => {
            window.clearTimeout(limite);
            apiSpotify = iframeApi;

            if (typeof callbackAnterior === 'function') {
                try {
                    callbackAnterior(iframeApi);
                } catch (erro) {
                    console.warn('Callback anterior do Spotify falhou:', erro);
                }
            }

            resolve(iframeApi);
        };

        if (!document.querySelector('script[data-api-spotify]')) {
            const script = document.createElement('script');
            script.src = 'https://open.spotify.com/embed/iframe-api/v1';
            script.async = true;
            script.dataset.apiSpotify = 'true';
            script.onerror = () => {
                window.clearTimeout(limite);
                script.remove();
                promessaApiSpotify = null;
                reject(new Error('Não foi possível carregar o Spotify.'));
            };
            document.head.appendChild(script);
        }
    });

    return promessaApiSpotify;
}


function destruirPlayersSpotify() {
    playersSpotify.forEach(registro => {
        cancelarFalhaInicioSpotify(registro);

        try {
            registro.controller.destroy();
        } catch {
            // O iframe pode já ter sido removido pelo navegador.
        }
    });

    playersSpotify.clear();
}


function cancelarFalhaInicioSpotify(registro) {
    if (!registro) return;

    window.clearTimeout(registro.timerAvisoInicio);
    window.clearTimeout(registro.timerPularInicio);
    registro.timerAvisoInicio = null;
    registro.timerPularInicio = null;
}


function mostrarAvisoSomSpotify(section, mostrar) {
    section
        .querySelector('.spotify-aviso-som')
        ?.classList.toggle('visivel', Boolean(mostrar));
}


function aplicarCapaSpotify(section, url) {
    if (!url) return;

    const capa = section.querySelector('.musica-capa-imagem');
    const fundo = section.querySelector('.musica-fundo-imagem');

    [capa, fundo].filter(Boolean).forEach(imagem => {
        imagem.classList.remove('carregada');
        imagem.onload = () => imagem.classList.add('carregada');
        imagem.onerror = () => imagem.classList.remove('carregada');
        imagem.src = url;
    });
}


async function carregarCapaSpotify(section, item, geracao) {
    if (item.capaUrl) {
        aplicarCapaSpotify(section, item.capaUrl);
        return;
    }

    try {
        const resposta = await fetch(
            `https://open.spotify.com/oembed?url=${encodeURIComponent(item.url || item.link || '')}`,
            { cache: 'force-cache' }
        );

        if (!resposta.ok) {
            throw new Error(`Erro HTTP ${resposta.status}`);
        }

        const dados = await resposta.json();

        if (
            geracao === geracaoMidiasYoutube &&
            document.body.contains(section) &&
            dados.thumbnail_url
        ) {
            aplicarCapaSpotify(section, dados.thumbnail_url);
        }
    } catch (erro) {
        console.warn('Não foi possível carregar a capa da música:', erro);
    }
}


function mostrarAvisoSom(section, mostrar) {
    const aviso = section.querySelector('.youtube-aviso-som');

    if (aviso) {
        aviso.classList.toggle('visivel', Boolean(mostrar));
    }
}


function configurarSomYoutube(registro, forcarSilencio = false) {
    const deveTerSom =
        registro.item.comSom === true &&
        !forcarSilencio &&
        (!MODO_PREVIA_ADMIN || somPreviaAdminAtivo);

    try {
        if (deveTerSom) {
            registro.player.unMute();
            registro.player.setVolume(100);
            mostrarAvisoSom(registro.section, false);
        } else {
            registro.player.mute();
            mostrarAvisoSom(
                registro.section,
                forcarSilencio && registro.item.comSom === true
            );
        }
    } catch (erro) {
        console.warn('Não foi possível ajustar o áudio do YouTube:', erro);
    }
}


function configurarLegendasYoutube(registro) {
    if (!registro?.player) return;

    const exibirLegendas = registro.item.comLegenda === true;

    try {
        if (exibirLegendas) {
            return;
        }

        // O primeiro comando desmarca a faixa de legendas quando o módulo
        // já está disponível. O segundo funciona como reforço em versões do
        // player que expõem o descarregamento do módulo de legendas.
        registro.player.setOption?.('captions', 'track', {});

        if (typeof registro.player.unloadModule === 'function') {
            registro.player.unloadModule('captions');
        }
    } catch (erro) {
        console.warn('Não foi possível ajustar as legendas do YouTube:', erro);
    }
}


function aplicarSomPreviaAdmin() {
    if (!MODO_PREVIA_ADMIN) return;

    document.querySelectorAll('video, audio').forEach(elemento => {
        elemento.muted = !somPreviaAdminAtivo;
        if (somPreviaAdminAtivo) elemento.volume = 1;
    });

    playersYoutube.forEach(registro => {
        configurarSomYoutube(registro, !somPreviaAdminAtivo);
    });

    playersSpotify.forEach(registro => {
        if (!registro.pronto) return;

        try {
            if (
                somPreviaAdminAtivo &&
                registro.section.classList.contains('ativa')
            ) {
                iniciarPlayerSpotify(registro.section);
            } else {
                registro.controller.pause();
            }
        } catch {
            // O controle pode estar terminando a inicialização.
        }
    });
}


window.addEventListener('message', evento => {
    if (
        !MODO_PREVIA_ADMIN ||
        evento.source !== window.parent ||
        evento.origin !== window.location.origin ||
        evento.data?.tipo !== 'mural-preview-audio'
    ) {
        return;
    }

    somPreviaAdminAtivo = evento.data.ativo === true;
    aplicarSomPreviaAdmin();
});


function agendarSegurancaYoutube(registro) {
    window.clearTimeout(timerRotacao);

    if (registro.item.tipo === 'live') {
        return;
    }

    if (registro.item.tipo === 'musica') {
        if (MODO_PREVIA_ADMIN && !somPreviaAdminAtivo) {
            timerRotacao = window.setTimeout(() => {
                if (registro.section.classList.contains('ativa') && !liveFixaId) {
                    rotacionarTela();
                }
            }, TEMPO_COMUNICADO);
        }

        return;
    }

    let espera = 5 * 60 * 1000;

    try {
        const duracao = Number(registro.player.getDuration());
        const posicao = Number(registro.player.getCurrentTime());

        if (duracao > 0) {
            espera = Math.max(15000, (duracao - posicao + 15) * 1000);
        }
    } catch {
        // O evento de término continua sendo a referência principal.
    }

    timerRotacao = window.setTimeout(() => {
        if (registro.section.classList.contains('ativa') && !liveFixaId) {
            rotacionarTela();
        }
    }, espera);
}


function agendarFalhaInicioYoutube(registro, tentativaSilenciosa = false) {
    window.clearTimeout(timerRotacao);

    timerRotacao = window.setTimeout(() => {
        if (!registro.section.classList.contains('ativa')) {
            return;
        }

        let reproduzindo = false;

        try {
            reproduzindo =
                registro.player.getPlayerState() ===
                window.YT.PlayerState.PLAYING;
        } catch {
            reproduzindo = false;
        }

        if (reproduzindo) {
            agendarSegurancaYoutube(registro);
            return;
        }

        if (registro.item.comSom === true && !tentativaSilenciosa) {
            configurarSomYoutube(registro, true);

            try {
                registro.player.playVideo();
                agendarFalhaInicioYoutube(registro, true);
                return;
            } catch {
                // A falha será tratada abaixo.
            }
        }

        if (registro.item.tipo === 'live') {
            encerrarLiveYoutube(
                registro.section.id,
                'A transmissão não pôde ser iniciada.'
            );
        } else {
            rotacionarTela();
        }
    }, 15000);
}


function iniciarPlayerYoutube(section) {
    const registro = playersYoutube.get(section.id);

    window.clearTimeout(timerRotacao);

    if (!registro || !registro.pronto) {
        timerRotacao = window.setTimeout(() => {
            if (!section.classList.contains('ativa')) {
                return;
            }

            if (section.dataset.tipoMidia === 'live') {
                encerrarLiveYoutube(section.id, 'A transmissão não pôde ser iniciada.');
            } else {
                rotacionarTela();
            }
        }, 25000);
        return;
    }

    configurarSomYoutube(registro);
    configurarLegendasYoutube(registro);

    try {
        if (
            registro.player.getPlayerState() ===
            window.YT.PlayerState.ENDED
        ) {
            registro.player.seekTo(0, true);
        }

        registro.player.playVideo();
        agendarFalhaInicioYoutube(registro);
    } catch (erro) {
        console.error('Não foi possível iniciar o vídeo do YouTube:', erro);

        if (registro.item.tipo === 'live') {
            encerrarLiveYoutube(section.id, 'A transmissão está indisponível.');
        } else {
            rotacionarTela();
        }
    }
}


function pausarPlayersYoutubeExceto(idAtivo) {
    playersYoutube.forEach((registro, id) => {
        if (id === idAtivo || !registro.pronto) {
            return;
        }

        try {
            registro.player.pauseVideo();
            registro.section.classList.remove('tocando');
        } catch {
            // O player ainda pode estar mudando de estado.
        }
    });
}


function encerrarLiveYoutube(sectionId, motivo = '') {
    if (liveFixaId !== sectionId) {
        return;
    }

    const section = document.getElementById(sectionId);
    liveFixaId = '';

    if (motivo) {
        console.warn(motivo);
    }

    if (section) {
        section.remove();
    }

    sincronizarTelas('tela-tempo');
    agendarRotacao();
}


function tratarEstadoYoutube(sectionId, estado) {
    const registro = playersYoutube.get(sectionId);

    if (!registro || !registro.section.classList.contains('ativa')) {
        return;
    }

    if (estado === window.YT.PlayerState.PLAYING) {
        registro.section.classList.add('tocando');
        configurarLegendasYoutube(registro);
        agendarSegurancaYoutube(registro);
        return;
    }

    registro.section.classList.remove('tocando');

    if (estado === window.YT.PlayerState.ENDED) {
        if (registro.item.tipo === 'live') {
            encerrarLiveYoutube(sectionId);
        } else if (!liveFixaId) {
            rotacionarTela();
        }
    }
}


function tratarErroYoutube(sectionId, codigo) {
    const registro = playersYoutube.get(sectionId);

    console.error(
        `O YouTube não conseguiu reproduzir “${registro?.item?.titulo || sectionId}” (erro ${codigo}).`
    );

    if (!registro || !registro.section.classList.contains('ativa')) {
        return;
    }

    if (registro.item.tipo === 'live') {
        encerrarLiveYoutube(sectionId, 'A live foi ignorada porque o YouTube recusou a reprodução.');
    } else {
        window.setTimeout(() => {
            if (registro.section.classList.contains('ativa')) {
                rotacionarTela();
            }
        }, 2000);
    }
}


function tratarAutoplayBloqueado(sectionId) {
    const registro = playersYoutube.get(sectionId);

    if (!registro || !registro.section.classList.contains('ativa')) {
        return;
    }

    configurarSomYoutube(registro, true);

    try {
        registro.player.playVideo();
        agendarFalhaInicioYoutube(registro, true);
    } catch (erro) {
        console.warn('O navegador bloqueou a reprodução automática:', erro);
    }
}


async function criarPlayersYoutube(sections, geracao) {
    if (!sections.length) {
        return;
    }

    try {
        await carregarApiYoutube();

        if (geracao !== geracaoMidiasYoutube) {
            return;
        }

        sections.forEach(({ section, item, videoId }) => {
            const elemento = section.querySelector('.youtube-player-alvo');

            if (!elemento || !document.body.contains(section)) {
                return;
            }

            const registro = {
                section,
                item,
                pronto: false,
                player: null
            };

            const player = new window.YT.Player(elemento, {
                videoId,
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    cc_load_policy: item.comLegenda === true ? 1 : 0,
                    cc_lang_pref: 'pt',
                    disablekb: 1,
                    fs: 0,
                    hl: 'pt-BR',
                    iv_load_policy: 3,
                    playsinline: 1,
                    rel: 0,
                    origin: window.location.origin
                },
                events: {
                    onReady: () => {
                        registro.pronto = true;
                        configurarLegendasYoutube(registro);
                        section
                            .querySelector('.youtube-carregando')
                            ?.remove();

                        if (section.classList.contains('ativa')) {
                            iniciarPlayerYoutube(section);
                        } else {
                            try {
                                player.pauseVideo();
                            } catch {
                                // Player ainda concluindo a inicialização.
                            }
                        }
                    },
                    onStateChange: evento => {
                        tratarEstadoYoutube(section.id, evento.data);
                    },
                    onError: evento => {
                        tratarErroYoutube(section.id, evento.data);
                    },
                    onAutoplayBlocked: () => {
                        tratarAutoplayBloqueado(section.id);
                    }
                }
            });

            registro.player = player;
            playersYoutube.set(section.id, registro);
        });
    } catch (erro) {
        console.error('Erro ao preparar o YouTube:', erro);

        const ativa = document.querySelector('.tela-youtube.ativa, .tela-musica.ativa');
        if (ativa?.dataset.tipoMidia === 'live') {
            encerrarLiveYoutube(ativa.id, 'A API do YouTube está indisponível.');
        } else if (ativa) {
            rotacionarTela();
        }
    }
}


function atualizarVisualSpotify(section, estado = {}) {
    const posicao = Math.max(0, Number(estado.position) || 0);
    const duracao = Math.max(0, Number(estado.duration) || 0);
    const percentual = duracao > 0
        ? Math.min(100, (posicao / duracao) * 100)
        : 0;

    section
        .querySelector('.musica-progresso-preenchimento')
        ?.style.setProperty('width', `${percentual}%`);

    const tempoAtual = section.querySelector('.musica-tempo-atual');
    const tempoTotal = section.querySelector('.musica-tempo-total');

    if (tempoAtual) {
        tempoAtual.textContent = formatarTempoMusica(posicao / 1000);
    }

    if (tempoTotal) {
        tempoTotal.textContent = formatarTempoMusica(duracao / 1000);
    }
}


function finalizarMusicaSpotify(registro) {
    if (registro.finalizando || liveFixaId) return;

    cancelarFalhaInicioSpotify(registro);
    registro.finalizando = true;
    registro.terminou = true;
    registro.section.classList.remove('tocando');

    try {
        registro.controller.pause();
    } catch {
        // A faixa já pode ter encerrado por conta própria.
    }

    window.clearTimeout(timerRotacao);
    timerRotacao = window.setTimeout(() => {
        if (registro.section.classList.contains('ativa') && !liveFixaId) {
            rotacionarTela();
        }
    }, 350);
}


function agendarFalhaInicioSpotify(registro) {
    cancelarFalhaInicioSpotify(registro);

    registro.timerAvisoInicio = window.setTimeout(() => {
        registro.timerAvisoInicio = null;

        if (
            !registro.section.classList.contains('ativa') ||
            registro.iniciadoNestaExibicao
        ) {
            return;
        }

        mostrarAvisoSomSpotify(registro.section, true);

        registro.timerPularInicio = window.setTimeout(() => {
            registro.timerPularInicio = null;

            if (
                registro.section.classList.contains('ativa') &&
                !registro.iniciadoNestaExibicao &&
                !liveFixaId
            ) {
                registro.terminou = true;
                rotacionarTela();
            }
        }, 15000);
    }, 10000);
}


function iniciarPlayerSpotify(section) {
    const registro = playersSpotify.get(section.id);

    window.clearTimeout(timerRotacao);

    if (!registro || !registro.pronto) {
        timerRotacao = window.setTimeout(() => {
            if (section.classList.contains('ativa') && !liveFixaId) {
                rotacionarTela();
            }
        }, 25000);
        return;
    }

    cancelarFalhaInicioSpotify(registro);

    if (MODO_PREVIA_ADMIN && !somPreviaAdminAtivo) {
        try {
            registro.controller.pause();
        } catch {
            // O controle pode estar concluindo a inicialização.
        }

        section.classList.remove('tocando');
        mostrarAvisoSomSpotify(section, false);
        timerRotacao = window.setTimeout(() => {
            if (section.classList.contains('ativa') && !liveFixaId) {
                rotacionarTela();
            }
        }, TEMPO_COMUNICADO);
        return;
    }

    if (section.classList.contains('tocando')) {
        return;
    }

    registro.iniciadoNestaExibicao = false;
    registro.finalizando = false;
    mostrarAvisoSomSpotify(section, false);

    try {
        if (registro.terminou) {
            registro.terminou = false;
            registro.controller.restart();
        } else {
            registro.controller.play();
        }

        agendarFalhaInicioSpotify(registro);
    } catch (erro) {
        console.error('Não foi possível iniciar a música do Spotify:', erro);
        mostrarAvisoSomSpotify(section, true);
        agendarFalhaInicioSpotify(registro);
    }
}


function pausarPlayersSpotifyExceto(idAtivo) {
    playersSpotify.forEach((registro, id) => {
        if (id === idAtivo || !registro.pronto) {
            return;
        }

        cancelarFalhaInicioSpotify(registro);

        try {
            registro.controller.pause();
            registro.section.classList.remove('tocando');
        } catch {
            // O controle pode estar mudando de estado.
        }
    });
}


function tratarAtualizacaoSpotify(sectionId, estado = {}) {
    const registro = playersSpotify.get(sectionId);

    if (!registro) return;

    registro.ultimoEstado = estado;
    atualizarVisualSpotify(registro.section, estado);

    if (!registro.section.classList.contains('ativa')) {
        return;
    }

    const tocando = estado.isPaused === false && estado.isBuffering !== true;
    registro.section.classList.toggle('tocando', tocando);

    if (tocando) {
        cancelarFalhaInicioSpotify(registro);
        registro.iniciadoNestaExibicao = true;
        mostrarAvisoSomSpotify(registro.section, false);
    }

    const duracao = Math.max(0, Number(estado.duration) || 0);
    const posicao = Math.max(0, Number(estado.position) || 0);

    if (
        registro.iniciadoNestaExibicao &&
        duracao > 0 &&
        posicao >= duracao - 750
    ) {
        finalizarMusicaSpotify(registro);
        return;
    }

}


async function criarPlayersSpotify(registros, geracao) {
    const musicas = registros.filter(
        registro =>
            registro.item.tipo === 'musica' &&
            linkSpotifyValido(registro.item.url || registro.item.link)
    );

    if (!musicas.length) return;

    musicas.forEach(({ section, item }) => {
        carregarCapaSpotify(section, item, geracao);
    });

    try {
        const iframeApi = await carregarApiSpotify();

        if (geracao !== geracaoMidiasYoutube) {
            return;
        }

        musicas.forEach(({ section, item }) => {
            const elemento = section.querySelector('.spotify-embed-alvo');

            if (!elemento || !document.body.contains(section)) {
                return;
            }

            iframeApi.createController(
                elemento,
                {
                    url: item.url || item.link,
                    width: 520,
                    height: 152
                },
                controller => {
                    const registro = {
                        section,
                        item,
                        controller,
                        pronto: false,
                        terminou: false,
                        finalizando: false,
                        iniciadoNestaExibicao: false,
                        ultimoEstado: null,
                        timerAvisoInicio: null,
                        timerPularInicio: null
                    };

                    playersSpotify.set(section.id, registro);

                    controller.addListener('ready', () => {
                        registro.pronto = true;
                        section
                            .querySelector('.spotify-carregando')
                            ?.remove();

                        if (section.classList.contains('ativa')) {
                            iniciarPlayerSpotify(section);
                        } else {
                            try {
                                controller.pause();
                            } catch {
                                // O controle ainda está sendo inicializado.
                            }
                        }
                    });

                    controller.addListener('playback_started', () => {
                        if (!section.classList.contains('ativa')) return;

                        cancelarFalhaInicioSpotify(registro);
                        registro.iniciadoNestaExibicao = true;
                        registro.finalizando = false;
                        section.classList.add('tocando');
                        mostrarAvisoSomSpotify(section, false);
                    });

                    controller.addListener('playback_update', evento => {
                        tratarAtualizacaoSpotify(section.id, evento.data || {});
                    });
                }
            );
        });
    } catch (erro) {
        console.error('Erro ao preparar o Spotify:', erro);

        const ativa = document.querySelector('.tela-musica.ativa');
        if (ativa && !liveFixaId) {
            rotacionarTela();
        }
    }
}


function tentarAtivarSomSpotify() {
    const section = document.querySelector('.tela-musica.ativa');

    if (!section) return;

    iniciarPlayerSpotify(section);
}


function assinaturaYoutube(listaVisivel) {
    return JSON.stringify(
        listaVisivel.map(item => ({
            id: item.id,
            titulo: item.titulo,
            url: item.url || item.link,
            tipo: item.tipo,
            artista: item.artista,
            capaUrl: item.capaUrl,
            comSom: item.comSom === true,
            comLegenda: item.comLegenda === true,
            ordem: Number(item.ordem || 0),
            corPrincipal: item.corPrincipal,
            corSecundaria: item.corSecundaria,
            atualizadoEm: item.atualizadoEm
        }))
    );
}


function criarIdTelaYoutube(item, index) {
    const identificador = String(item.id || index)
        .replace(/[^a-zA-Z0-9_-]/g, '');

    const prefixo = item.tipo === 'musica'
        ? 'tela-musica'
        : 'tela-youtube';

    return `${prefixo}-${identificador || index}`;
}


function renderizarMidiasYoutube(lista, forcar = false) {
    midiasYoutube = Array.isArray(lista)
        ? lista
        : [];

    const visiveis = midiasYoutube
        .filter(midiaYoutubeEstaVisivel)
        .filter(item =>
            item.tipo !== 'musica' ||
            Boolean(extrairIdYoutube(item.url || item.link))
        )
        .sort((a, b) =>
            (Number(a.ordem || 0) - Number(b.ordem || 0)) ||
            String(a.titulo || '').localeCompare(String(b.titulo || ''))
        );

    const novaAssinatura = assinaturaYoutube(visiveis);

    if (!forcar && novaAssinatura === assinaturaMidiasYoutube) {
        return;
    }

    assinaturaMidiasYoutube = novaAssinatura;
    geracaoMidiasYoutube += 1;
    const geracao = geracaoMidiasYoutube;
    const idAtivoAnterior = obterIdTelaAtiva();

    destruirPlayersYoutube();
    destruirPlayersSpotify();

    const live = visiveis.find(item => item.tipo === 'live');
    const musicas = visiveis.filter(item => item.tipo === 'musica');
    const musicaDaRodada =
        musicas.find(item => criarIdTelaYoutube(item, 0) === idMusicaDaRodada) ||
        musicas[0] ||
        null;

    idMusicaDaRodada = musicaDaRodada
        ? criarIdTelaYoutube(musicaDaRodada, 0)
        : '';

    const itensParaExibir = [
        ...visiveis.filter(item => item.tipo !== 'live' && item.tipo !== 'musica'),
        ...musicas,
        ...(live ? [live] : [])
    ];

    const registros = itensParaExibir.map((item, index) => {
        const section = document.createElement('section');
        const videoId = extrairIdYoutube(item.url || item.link);
        const principal = validarCor(
            item.corPrincipal,
            item.tipo === 'musica' ? '#121212' : '#004A8F'
        );
        const secundaria = validarCor(
            item.corSecundaria,
            item.tipo === 'musica' ? '#1DB954' : '#0077C8'
        );
        const tipo = item.tipo === 'live'
            ? 'live'
            : item.tipo === 'musica'
                ? 'musica'
                : 'video';
        const musicaSelecionada =
            tipo === 'musica' &&
            item === musicaDaRodada;
        const capaMusica = tipo === 'musica' && videoId
            ? validarLink(item.capaUrl) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            : '';

        section.className = tipo === 'musica'
            ? `tela-musica${musicaSelecionada ? ' tela' : ' tela-musica-espera'}`
            : 'tela tela-youtube';
        section.id = criarIdTelaYoutube(item, index);
        section.dataset.tipoMidia = tipo;
        section.dataset.comSom = tipo === 'musica' || item.comSom === true ? 'true' : 'false';
        section.style.setProperty('--midia-cor-principal', principal);
        section.style.setProperty('--midia-cor-secundaria', secundaria);

        if (tipo === 'musica') {
            section.innerHTML = `
                <div class="musica-fundo">
                    <img class="musica-fundo-imagem carregada" src="${escaparHTML(capaMusica)}" alt="">
                </div>

                <div class="musica-card">
                    <div class="musica-capa-area">
                        <div class="musica-capa-fallback" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M9 18V5l10-2v13M9 9l10-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="6" cy="18" r="3" fill="currentColor"/>
                                <circle cx="16" cy="16" r="3" fill="currentColor"/>
                            </svg>
                        </div>
                        <img class="musica-capa-imagem carregada" src="${escaparHTML(capaMusica)}" alt="Capa de ${escaparHTML(item.titulo || 'música')}">
                    </div>

                    <div class="musica-painel">
                        <div class="musica-topo">
                            <div class="spotify-identidade" aria-label="YouTube Music">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                                    <path d="m10 8 6 4-6 4V8Z" fill="currentColor"/>
                                </svg>
                                <span>YouTube Music</span>
                            </div>

                            <img src="/logo-mural-digital.png?v=2" class="musica-marca" alt="Mural Digital">
                        </div>

                        <div class="musica-selo">
                            <span></span>
                            Tocando agora
                        </div>

                        <h1 class="musica-titulo">${escaparHTML(item.titulo || 'Música')}</h1>
                        <p class="musica-artista">${escaparHTML(item.artista || 'Artista não informado')}</p>

                        <div class="musica-progresso" aria-hidden="true">
                            <span class="musica-progresso-preenchimento"></span>
                        </div>
                        <div class="musica-tempos">
                            <span class="musica-tempo-atual">0:00</span>
                            <span class="musica-tempo-total">0:00</span>
                        </div>

                        <div class="musica-equalizador" aria-hidden="true">
                            <span></span><span></span><span></span><span></span><span></span>
                        </div>

                        <div class="spotify-embed-oficial">
                            <div class="youtube-carregando spotify-carregando">Preparando YouTube...</div>
                            <div class="youtube-player-alvo spotify-embed-alvo"></div>
                        </div>
                    </div>
                </div>

                <div class="credito-desenvolvedor">
                    Desenvolvido por <span>Jeferson Augusto</span>
                </div>
            `;
        } else {
            section.innerHTML = `
            <div class="youtube-fundo"></div>

            <div class="youtube-card">
                <div class="youtube-carregando">Carregando YouTube...</div>
                <div class="youtube-player">
                    <div class="youtube-player-alvo"></div>
                </div>

                <div class="youtube-selo ${tipo === 'live' ? 'youtube-selo-live' : ''}">
                    ${tipo === 'live' ? 'AO VIVO' : 'VÍDEO EM DESTAQUE'}
                </div>

                <div class="youtube-aviso-som">
                    Toque na tela para ativar o som
                </div>

                <div class="youtube-titulo">
                    ${escaparHTML(item.titulo || 'Transmissão')}
                </div>
            </div>

            <img
                src="logo-uniube.png"
                class="youtube-logo"
                alt="Uniube"
            >

            <div class="credito-desenvolvedor">
                Desenvolvido por <span>Jeferson Augusto</span>
            </div>
            `;
        }

        return {
            section,
            item: {
                ...item,
                tipo,
                comSom: tipo === 'musica' ? true : item.comSom
            },
            videoId
        };
    });

    document
        .getElementById('container-midias-youtube')
        .replaceChildren(
            ...registros
                .filter(registro => registro.item.tipo !== 'musica')
                .map(registro => registro.section)
        );

    document
        .getElementById('container-musicas-youtube')
        .replaceChildren(
            ...registros
                .filter(registro => registro.item.tipo === 'musica')
                .map(registro => registro.section)
        );

    liveFixaId = live
        ? registros.find(registro => registro.item.tipo === 'live')?.section.id || ''
        : '';

    sincronizarTelas(
        liveFixaId || idAtivoAnterior
    );
    agendarRotacao();
    criarPlayersYoutube(registros, geracao);
}


function iniciarMidiasYoutubeFirebase() {
    const cache = carregarCacheMidiasYoutube();

    if (cache.length) {
        renderizarMidiasYoutube(cache, true);
    }

    if (!db) {
        console.error('Firebase indisponível para carregar as mídias.');
        return;
    }

    db.collection('eventos')
        .doc(ID_CONFIGURACAO_MIDIAS_YOUTUBE)
        .onSnapshot(
            documento => {
                const dados = documento.exists
                    ? documento.data()
                    : {};

                const lista = Array.isArray(dados.midias)
                    ? dados.midias
                    : [];

                salvarCacheMidiasYoutube(lista);
                renderizarMidiasYoutube(lista, true);

                console.info(
                    `${lista.length} mídia(s) recebida(s) do painel.`
                );
            },
            erro => {
                console.error(
                    'Erro ao receber as mídias do Firebase:',
                    erro
                );

                if (!cache.length) {
                    renderizarMidiasYoutube([], true);
                }
            }
        );
}


function tentarAtivarSomYoutube() {
    const section = document.querySelector('.tela-youtube.ativa, .tela-musica.ativa');

    if (!section || section.dataset.comSom !== 'true') {
        return;
    }

    const registro = playersYoutube.get(section.id);

    if (!registro || !registro.pronto) {
        return;
    }

    configurarSomYoutube(registro);

    try {
        registro.player.playVideo();
    } catch {
        // Uma nova interação do usuário poderá liberar o áudio.
    }
}


function formatarTempoMusica(segundos) {
    const total = Math.max(0, Math.floor(Number(segundos) || 0));
    const minutos = Math.floor(total / 60);
    const restante = total % 60;

    return `${minutos}:${String(restante).padStart(2, '0')}`;
}


function atualizarProgressoMusica() {
    const section = document.querySelector('.tela-musica.ativa');

    if (!section) return;

    const registro = playersYoutube.get(section.id);

    if (!registro?.pronto) return;

    try {
        atualizarVisualSpotify(section, {
            position: Number(registro.player.getCurrentTime() || 0) * 1000,
            duration: Number(registro.player.getDuration() || 0) * 1000
        });
    } catch {
        // O player pode estar mudando de faixa.
    }
}


function selecionarProximaMusicaDaRodada() {
    const musicas = Array.from(document.querySelectorAll('.tela-musica'));

    if (!musicas.length) {
        idMusicaDaRodada = '';
        return;
    }

    const indiceEncontrado = musicas.findIndex(
        section => section.id === idMusicaDaRodada
    );
    const atual = indiceEncontrado >= 0
        ? indiceEncontrado
        : -1;
    const proximo = musicas.length > 1
        ? (atual + 1) % musicas.length
        : 0;

    musicas.forEach((section, index) => {
        section.classList.toggle('tela', index === proximo);
        section.classList.toggle('tela-musica-espera', index !== proximo);
    });

    idMusicaDaRodada = musicas[proximo].id;

    const ativa = document.querySelector('.tela.ativa');
    telas = Array.from(document.querySelectorAll('.tela'));
    step = Math.max(0, telas.findIndex(tela => tela === ativa));
}


// ======================================================
// IMAGENS ENVIADAS PELO PAINEL
// ======================================================

function carregarCacheComunicados() {
    try {
        const dados = JSON.parse(
            localStorage.getItem(CHAVE_CACHE_COMUNICADOS) || '[]'
        );

        return Array.isArray(dados)
            ? dados
            : [];
    } catch (erro) {
        console.warn('Não foi possível ler o cache dos comunicados:', erro);
        return [];
    }
}


function salvarCacheComunicados(imagens) {
    try {
        localStorage.setItem(
            CHAVE_CACHE_COMUNICADOS,
            JSON.stringify(imagens)
        );
    } catch (erro) {
        console.warn('Não foi possível salvar o cache dos comunicados:', erro);
    }
}


function comunicadoEstaVisivel(item) {
    if (item.ativo === false) {
        return false;
    }

    const agora = Date.now();
    const inicio = item.exibirDesde
        ? converterData(item.exibirDesde)
        : null;
    const fim = item.exibirAte
        ? converterData(item.exibirAte, '00:00:00', true)
        : null;

    if (inicio !== null && agora < inicio) {
        return false;
    }

    if (fim !== null && agora > fim) {
        return false;
    }

    return Boolean(validarLink(item.url));
}


function renderizarComunicados(imagens) {
    const idAtivo = obterIdTelaAtiva();

    const visiveis = imagens
        .filter(comunicadoEstaVisivel)
        .sort((a, b) =>
            (Number(a.ordem || 0) - Number(b.ordem || 0)) ||
            String(a.nome || '').localeCompare(String(b.nome || ''))
        );

    const novasTelas = visiveis.map((item, index) => {
        const section =
            document.createElement('section');

        section.className =
            'tela tela-comunicado';

        section.id =
            `tela-imagem-${item.id || index}`;

        section.dataset.duration =
            String(
                Math.max(5, Number(item.duracao || 15)) * 1000
            );

        const imagem =
            document.createElement('img');

        imagem.src = item.url;
        imagem.alt = item.nome || 'Comunicado';
        imagem.className = 'imagem-comunicado';
        imagem.decoding = 'async';

        imagem.addEventListener('error', () => {
            console.error(
                'Não foi possível exibir a imagem:',
                item.nome || item.id
            );
        });

        section.appendChild(imagem);

        return section;
    });

    document
        .getElementById('container-imagens-dinamicas')
        .replaceChildren(...novasTelas);

    sincronizarTelas(idAtivo);
    agendarRotacao();
}

function iniciarComunicadosFirebase() {
    const cache = carregarCacheComunicados();

    if (cache.length) {
        renderizarComunicados(cache);
    }

    if (!db) {
        console.error(
            'Firebase indisponível para carregar as imagens do mural.'
        );
        return;
    }

    db.collection('eventos')
        .doc(ID_CONFIGURACAO_IMAGENS)
        .onSnapshot(
            documento => {
                const dados = documento.exists
                    ? documento.data()
                    : {};

                const imagens = Array.isArray(dados.imagens)
                    ? dados.imagens
                    : [];

                salvarCacheComunicados(imagens);
                renderizarComunicados(imagens);

                console.info(
                    `${imagens.length} imagem(ns) recebida(s) do painel.`
                );
            },
            erro => {
                console.error(
                    'Erro ao receber imagens do Firebase:',
                    erro
                );

                if (!cache.length) {
                    renderizarComunicados([]);
                }
            }
        );
}


// ======================================================
// ROTAÇÃO
// ======================================================

function obterIdTelaAtiva() {
    const ativa =
        document.querySelector('.tela.ativa');

    return ativa
        ? ativa.id
        : 'tela-tempo';
}


function sincronizarTelas(
    idPreferido = 'tela-tempo'
) {
    telas =
        Array.from(
            document.querySelectorAll('.tela')
        );

    if (!telas.length) {
        return;
    }

    telas.forEach(tela => {
        tela.classList.remove('ativa');
    });

    const idDesejado =
        liveFixaId && document.getElementById(liveFixaId)
            ? liveFixaId
            : idPreferido;

    const encontrado =
        telas.findIndex(
            tela => tela.id === idDesejado
        );

    step = encontrado >= 0
        ? encontrado
        : 0;

    telas[step].classList.add('ativa');
    controlarVideoClima();
}


function agendarRotacao() {
    window.clearTimeout(timerRotacao);

    if (liveFixaId) {
        const live = document.getElementById(liveFixaId);

        if (live) {
            if (!live.classList.contains('ativa')) {
                sincronizarTelas(liveFixaId);
            }

            iniciarPlayerYoutube(live);
            return;
        }

        liveFixaId = '';
    }

    if (telas.length <= 1) {
        return;
    }

    const telaAtual = telas[step];

    if (telaAtual?.classList.contains('tela-musica')) {
        iniciarPlayerYoutube(telaAtual);
        return;
    }

    if (telaAtual?.classList.contains('tela-youtube')) {
        iniciarPlayerYoutube(telaAtual);
        return;
    }

    const duracao =
        Number(telaAtual.dataset.duration) ||
        TEMPO_COMUNICADO;

    timerRotacao =
        window.setTimeout(
            rotacionarTela,
            duracao
        );
}


function rotacionarTela() {
    if (liveFixaId || telas.length <= 1) {
        return;
    }

    const telaAnterior = telas[step];
    const terminouMusica = telaAnterior.classList.contains('tela-musica');

    telaAnterior.classList.remove('ativa', 'tocando');

    step =
        (step + 1) % telas.length;

    telas[step].classList.add('ativa');

    controlarVideoClima();

    if (terminouMusica) {
        selecionarProximaMusicaDaRodada();
    }

    agendarRotacao();
}


function controlarVideoClima() {
    const video =
        document.getElementById('weather-video');

    const climaAtivo =
        document
            .getElementById('tela-tempo')
            .classList.contains('ativa');

    if (climaAtivo) {
        video.play().catch(() => {});
    } else {
        video.pause();
    }

    const youtubeAtivo =
        document.querySelector('.tela-youtube.ativa, .tela-musica.ativa');

    pausarPlayersYoutubeExceto(
        youtubeAtivo ? youtubeAtivo.id : ''
    );

}


// ======================================================
// INICIALIZAÇÃO
// ======================================================

function iniciarMural() {
    document.documentElement.setAttribute(
        'data-versao-mural',
        '9.5.0-musicas-youtube'
    );

    atualizarRelogio();
    atualizarClima();

    window.setInterval(
        atualizarRelogio,
        1000
    );

    window.setInterval(
        atualizarContagens,
        1000
    );

    window.setInterval(
        atualizarClima,
        600000
    );

    iniciarEventosFirebase();
    iniciarComunicadosFirebase();
    iniciarMidiasYoutubeFirebase();

    sincronizarTelas(
        obterIdTelaAtiva()
    );

    agendarRotacao();

    window.setInterval(
        () => renderizarMidiasYoutube(midiasYoutube),
        30000
    );

    window.setInterval(
        atualizarProgressoMusica,
        500
    );

    document.addEventListener(
        'pointerdown',
        tentarAtivarSomYoutube,
        { passive: true }
    );

}


if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        iniciarMural
    );
} else {
    iniciarMural();
}
