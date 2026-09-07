// ======================================================
// MURAL DIGITAL - FIREBASE COMPATÍVEL
// Mantém: clima, eventos, QR Code, contagem, imagens e YouTube
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

let telas = [];
let step = 0;
let timerRotacao = null;
let midiasYoutube = [];
let playersYoutube = new Map();
let promessaApiYoutube = null;
let liveFixaId = '';
let assinaturaMidiasYoutube = '';
let geracaoMidiasYoutube = 0;


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
    if (item.ativo === false || !extrairIdYoutube(item.url || item.link)) {
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


function mostrarAvisoSom(section, mostrar) {
    const aviso = section.querySelector('.youtube-aviso-som');

    if (aviso) {
        aviso.classList.toggle('visivel', Boolean(mostrar));
    }
}


function configurarSomYoutube(registro, forcarSilencio = false) {
    const deveTerSom = registro.item.comSom === true && !forcarSilencio;

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


function agendarSegurancaYoutube(registro) {
    window.clearTimeout(timerRotacao);

    if (registro.item.tipo === 'live') {
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
        agendarSegurancaYoutube(registro);
        return;
    }

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
                    disablekb: 1,
                    fs: 0,
                    playsinline: 1,
                    rel: 0,
                    origin: window.location.origin
                },
                events: {
                    onReady: () => {
                        registro.pronto = true;
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

        const ativa = document.querySelector('.tela-youtube.ativa');
        if (ativa?.dataset.tipoMidia === 'live') {
            encerrarLiveYoutube(ativa.id, 'A API do YouTube está indisponível.');
        } else if (ativa) {
            rotacionarTela();
        }
    }
}


function assinaturaYoutube(listaVisivel) {
    return JSON.stringify(
        listaVisivel.map(item => ({
            id: item.id,
            titulo: item.titulo,
            url: item.url || item.link,
            tipo: item.tipo,
            comSom: item.comSom === true,
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

    return `tela-youtube-${identificador || index}`;
}


function renderizarMidiasYoutube(lista, forcar = false) {
    midiasYoutube = Array.isArray(lista)
        ? lista
        : [];

    const visiveis = midiasYoutube
        .filter(midiaYoutubeEstaVisivel)
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

    const live = visiveis.find(item => item.tipo === 'live');
    const itensParaExibir = [
        ...visiveis.filter(item => item.tipo !== 'live'),
        ...(live ? [live] : [])
    ];

    const registros = itensParaExibir.map((item, index) => {
        const section = document.createElement('section');
        const videoId = extrairIdYoutube(item.url || item.link);
        const principal = validarCor(item.corPrincipal, '#004A8F');
        const secundaria = validarCor(item.corSecundaria, '#0077C8');
        const tipo = item.tipo === 'live' ? 'live' : 'video';

        section.className = 'tela tela-youtube';
        section.id = criarIdTelaYoutube(item, index);
        section.dataset.tipoMidia = tipo;
        section.dataset.comSom = item.comSom === true ? 'true' : 'false';
        section.style.setProperty('--midia-cor-principal', principal);
        section.style.setProperty('--midia-cor-secundaria', secundaria);

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

        return {
            section,
            item: {
                ...item,
                tipo
            },
            videoId
        };
    });

    document
        .getElementById('container-midias-youtube')
        .replaceChildren(...registros.map(registro => registro.section));

    liveFixaId = live
        ? criarIdTelaYoutube(live, itensParaExibir.indexOf(live))
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
        console.error('Firebase indisponível para carregar vídeos e lives.');
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
                    `${lista.length} vídeo(s)/live(s) recebido(s) do painel.`
                );
            },
            erro => {
                console.error(
                    'Erro ao receber vídeos e lives do Firebase:',
                    erro
                );

                if (!cache.length) {
                    renderizarMidiasYoutube([], true);
                }
            }
        );
}


function tentarAtivarSomYoutube() {
    const section = document.querySelector('.tela-youtube.ativa');

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

    telas[step].classList.remove('ativa');

    step =
        (step + 1) % telas.length;

    telas[step].classList.add('ativa');

    controlarVideoClima();
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
        document.querySelector('.tela-youtube.ativa');

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
        '9.0-youtube'
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
