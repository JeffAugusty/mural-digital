// ======================================================
// MURAL DIGITAL - FIREBASE COMPATÍVEL
// Mantém: clima, eventos, QR Code, contagem e imagens do painel
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
const ID_CONFIGURACAO_IMAGENS = 'configuracao-imagens-mural';

let telas = [];
let step = 0;
let timerRotacao = null;


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
                    evento.tipo !== 'configuracao-imagens'
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

    const encontrado =
        telas.findIndex(
            tela => tela.id === idPreferido
        );

    step = encontrado >= 0
        ? encontrado
        : 0;

    telas[step].classList.add('ativa');
    controlarVideoClima();
}


function agendarRotacao() {
    window.clearTimeout(timerRotacao);

    if (telas.length <= 1) {
        return;
    }

    const duracao =
        Number(telas[step].dataset.duration) ||
        TEMPO_COMUNICADO;

    timerRotacao =
        window.setTimeout(
            rotacionarTela,
            duracao
        );
}


function rotacionarTela() {
    if (telas.length <= 1) {
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
}


// ======================================================
// INICIALIZAÇÃO
// ======================================================

function iniciarMural() {
    document.documentElement.setAttribute(
        'data-versao-mural',
        '8.0-upload-painel'
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

    sincronizarTelas(
        obterIdTelaAtiva()
    );

    agendarRotacao();
}


if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        iniciarMural
    );
} else {
    iniciarMural();
}
