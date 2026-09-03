// ======================================================
// CONFIGURAÇÕES
// ======================================================

const URL_API_DRIVE =
    'https://script.google.com/macros/s/AKfycbwt1akQ3NLHgea6VPNo_XdFjP0-ncBeve1ATsRbabLgq_djN3qYCn3Uuzl5K7EWDoSS/exec';

const URL_API_EVENTOS =
    'https://script.google.com/macros/s/AKfycbz_bGph_C6Cp_Ht9dMn4GJW0WJEtMEoKNyK8-kmgJl7Kz1beFkT8cn7b4DYaE-f-2dn/exec';

const LAT = '-18.98';
const LON = '-49.46';

const TEMPO_CLIMA = 25000;
const TEMPO_EVENTO = 25000;
const TEMPO_COMUNICADO = 15000;

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

    const nublado =
        code === 2 ||
        code === 3 ||
        code === 45 ||
        code === 48;

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
                descricao: code >= 45
                    ? 'Neblina'
                    : 'Nublado'
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
            descricao: code >= 45
                ? 'Neblina'
                : 'Nublado'
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

        const resposta = await fetch(
            url,
            { cache: 'no-store' }
        );

        if (!resposta.ok) {
            throw new Error(
                `Erro HTTP ${resposta.status}`
            );
        }

        const dados = await resposta.json();

        if (!dados.current || !dados.daily) {
            throw new Error(
                'Resposta do clima incompleta'
            );
        }

        const clima = escolherClima(
            dados.current.weather_code,
            dados.current.is_day
        );

        document.getElementById(
            'temp-valor'
        ).textContent =
            `${Math.round(
                dados.current.temperature_2m
            )}°C`;

        document.getElementById(
            'temp-max'
        ).textContent =
            `Máx: ${Math.round(
                dados.daily.temperature_2m_max[0]
            )}°C`;

        document.getElementById(
            'temp-min'
        ).textContent =
            `Mín: ${Math.round(
                dados.daily.temperature_2m_min[0]
            )}°C`;

        document.getElementById(
            'condicao'
        ).textContent =
            clima.descricao;

        document.getElementById(
            'cidade'
        ).textContent =
            'ITUIUTABA';

        trocarVideoClima(clima.video);

    } catch (erro) {
        console.error(
            'Erro ao carregar o clima:',
            erro
        );

        document.getElementById(
            'condicao'
        ).textContent =
            'CLIMA INDISPONÍVEL';
    }
}


function trocarVideoClima(novoVideo) {
    const video =
        document.getElementById(
            'weather-video'
        );

    const source =
        video.querySelector('source');

    if (
        source.getAttribute('src') ===
        novoVideo
    ) {
        return;
    }

    source.setAttribute(
        'src',
        novoVideo
    );

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

function converterDataBR(
    dataTexto,
    horaTexto = '00:00:00',
    fimDoDia = false
) {
    const data =
        String(dataTexto || '').trim();

    const resultadoData = data.match(
        /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/
    );

    if (!resultadoData) {
        return null;
    }

    const dia =
        String(Number(resultadoData[1]))
            .padStart(2, '0');

    const mes =
        String(Number(resultadoData[2]))
            .padStart(2, '0');

    const ano =
        resultadoData[3];

    let hora = 0;
    let minuto = 0;
    let segundo = 0;

    if (fimDoDia) {
        hora = 23;
        minuto = 59;
        segundo = 59;
    } else {
        const numerosHora =
            String(horaTexto || '')
                .match(/\d+/g) || [];

        hora =
            Number(numerosHora[0] || 0);

        minuto =
            Number(numerosHora[1] || 0);

        segundo =
            Number(numerosHora[2] || 0);
    }

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

    const timestamp = Date.parse(
        `${ano}-${mes}-${dia}` +
        `T${horario}-03:00`
    );

    return Number.isFinite(timestamp)
        ? timestamp
        : null;
}


function eventoEstaVisivel(evento) {
    const ativo =
        String(evento.ativo || 'SIM')
            .trim()
            .toUpperCase();

    if (ativo !== 'SIM') {
        return false;
    }

    const agora = Date.now();

    const inicio =
        evento.exibirDesde
            ? converterDataBR(
                evento.exibirDesde
            )
            : null;

    const fim =
        evento.exibirAte
            ? converterDataBR(
                evento.exibirAte,
                '00:00:00',
                true
            )
            : null;

    if (
        inicio !== null &&
        agora < inicio
    ) {
        return false;
    }

    if (
        fim !== null &&
        agora > fim
    ) {
        return false;
    }

    return true;
}


// ======================================================
// CORES
// ======================================================

function validarCor(valor, padrao) {
    const cor =
        String(valor || '').trim();

    const corValida =
        /^#[0-9a-f]{3}([0-9a-f]{3})?$/i
            .test(cor);

    return corValida
        ? cor.toUpperCase()
        : padrao;
}


function corDeContraste(cor) {
    let hexadecimal =
        cor.replace('#', '');

    if (hexadecimal.length === 3) {
        hexadecimal =
            hexadecimal
                .split('')
                .map(letra => letra + letra)
                .join('');
    }

    const vermelho =
        parseInt(
            hexadecimal.substring(0, 2),
            16
        );

    const verde =
        parseInt(
            hexadecimal.substring(2, 4),
            16
        );

    const azul =
        parseInt(
            hexadecimal.substring(4, 6),
            16
        );

    const luminosidade =
        (
            vermelho * 299 +
            verde * 587 +
            azul * 114
        ) / 1000;

    return luminosidade >= 150
        ? '#171717'
        : '#FFFFFF';
}


function aplicarCoresEvento(
    section,
    evento
) {
    const principal =
        validarCor(
            evento.corPrincipal,
            '#FFB000'
        );

    const secundaria =
        validarCor(
            evento.corSecundaria,
            '#EE2B0B'
        );

    const destaque =
        validarCor(
            evento.corDestaque,
            '#FFD400'
        );

    const texto =
        validarCor(
            evento.corTexto,
            '#FFFFFF'
        );

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
}


// ======================================================
// SEGURANÇA DOS DADOS
// ======================================================

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
// CARREGAR EVENTOS
// ======================================================

async function carregarEventos() {
    try {
        const resposta = await fetch(
            `${URL_API_EVENTOS}` +
            `?atualizacao=${Date.now()}`,
            {
                cache: 'no-store'
            }
        );

        if (!resposta.ok) {
            throw new Error(
                `Erro HTTP ${resposta.status}`
            );
        }

        const dados =
            await resposta.json();

        if (dados.sucesso === false) {
            throw new Error(
                dados.erro ||
                'Erro na API de eventos'
            );
        }

        const lista =
            Array.isArray(dados)
                ? dados
                : dados.eventos;

        const eventos =
            Array.isArray(lista)
                ? lista.filter(
                    eventoEstaVisivel
                )
                : [];

        const container =
            document.getElementById(
                'container-eventos'
            );

        const novasTelas = [];

        eventos.forEach(
            (evento, index) => {
                const destino =
                    converterDataBR(
                        evento.data,
                        evento.hora
                    );

                if (destino === null) {
                    console.error(
                        'Data ou horário inválido:',
                        evento.data,
                        evento.hora
                    );

                    return;
                }

                const section =
                    document.createElement(
                        'section'
                    );

                section.className =
                    'tela tela-evento';

                section.id =
                    `tela-evento-${index}`;

                section.dataset.duration =
                    String(TEMPO_EVENTO);

                aplicarCoresEvento(
                    section,
                    evento
                );

                const titulo =
                    escaparHTML(
                        evento.titulo
                    );

                const data =
                    escaparHTML(
                        evento.data
                    );

                const hora =
                    escaparHTML(
                        evento.hora
                    );

                const local =
                    escaparHTML(
                        evento.local
                    );

                const chamada =
                    escaparHTML(
                        evento.chamada
                    );

                const link =
                    validarLink(
                        evento.link
                    );

                const dominio =
                    escaparHTML(
                        obterDominio(link)
                    );

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
                                        <strong data-unidade="dias">
                                            00
                                        </strong>
                                        <span>DIAS</span>
                                    </div>

                                    <div class="contador-separador">
                                        :
                                    </div>

                                    <div class="contador-bloco">
                                        <strong data-unidade="horas">
                                            00
                                        </strong>
                                        <span>HORAS</span>
                                    </div>

                                    <div class="contador-separador">
                                        :
                                    </div>

                                    <div class="contador-bloco">
                                        <strong data-unidade="minutos">
                                            00
                                        </strong>
                                        <span>MIN</span>
                                    </div>

                                    <div class="contador-separador">
                                        :
                                    </div>

                                    <div class="contador-bloco">
                                        <strong data-unidade="segundos">
                                            00
                                        </strong>
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
            }
        );

        container.replaceChildren(
            ...novasTelas.map(
                item => item.section
            )
        );

        atualizarContagens();

        novasTelas.forEach(item => {
            criarQRCode(
                item.section,
                item.link
            );
        });

    } catch (erro) {
        console.error(
            'Erro ao carregar eventos:',
            erro
        );
    }
}


// ======================================================
// QR CODE
// ======================================================

function criarQRCode(section, link) {
    const area =
        section.querySelector(
            '.evento-qr-code'
        );

    const lateral =
        section.querySelector(
            '.evento-lateral'
        );

    if (!link) {
        lateral.style.display = 'none';
        return;
    }

    if (typeof QRCode === 'undefined') {
        area.textContent =
            'QR indisponível';

        return;
    }

    try {
        area.innerHTML = '';

        new QRCode(area, {
            text: link,
            width: 260,
            height: 260,
            colorDark: '#101010',
            colorLight: '#FFFFFF',
            correctLevel:
                QRCode.CorrectLevel.M
        });

    } catch (erro) {
        console.error(
            'Erro ao criar QR Code:',
            erro
        );

        area.textContent =
            'QR indisponível';
    }
}


// ======================================================
// CONTAGEM REGRESSIVA
// ======================================================

function atualizarContagens() {
    const contagens =
        document.querySelectorAll(
            '.evento-contagem'
        );

    contagens.forEach(contagem => {
        const destino =
            Number(
                contagem.dataset.destino
            );

        const titulo =
            contagem.querySelector(
                '.evento-contagem-titulo'
            );

        const diasElemento =
            contagem.querySelector(
                '[data-unidade="dias"]'
            );

        const horasElemento =
            contagem.querySelector(
                '[data-unidade="horas"]'
            );

        const minutosElemento =
            contagem.querySelector(
                '[data-unidade="minutos"]'
            );

        const segundosElemento =
            contagem.querySelector(
                '[data-unidade="segundos"]'
            );

        if (!Number.isFinite(destino)) {
            titulo.textContent =
                'DATA INDISPONÍVEL';

            diasElemento.textContent = '--';
            horasElemento.textContent = '--';
            minutosElemento.textContent = '--';
            segundosElemento.textContent = '--';

            return;
        }

        const diferenca =
            destino - Date.now();

        if (diferenca <= 0) {
            titulo.textContent =
                'EVENTO EM ANDAMENTO';

            diasElemento.textContent = '00';
            horasElemento.textContent = '00';
            minutosElemento.textContent = '00';
            segundosElemento.textContent = '00';

            return;
        }

        titulo.textContent =
            'O EVENTO COMEÇA EM';

        const dias =
            Math.floor(
                diferenca /
                86400000
            );

        const horas =
            Math.floor(
                (
                    diferenca %
                    86400000
                ) /
                3600000
            );

        const minutos =
            Math.floor(
                (
                    diferenca %
                    3600000
                ) /
                60000
            );

        const segundos =
            Math.floor(
                (
                    diferenca %
                    60000
                ) /
                1000
            );

        diasElemento.textContent =
            String(dias)
                .padStart(2, '0');

        horasElemento.textContent =
            String(horas)
                .padStart(2, '0');

        minutosElemento.textContent =
            String(minutos)
                .padStart(2, '0');

        segundosElemento.textContent =
            String(segundos)
                .padStart(2, '0');
    });
}


// ======================================================
// IMAGENS DO GOOGLE DRIVE
// ======================================================

async function carregarImagensDoDrive() {
    try {
        const resposta = await fetch(
            `${URL_API_DRIVE}` +
            `?atualizacao=${Date.now()}`,
            {
                cache: 'no-store'
            }
        );

        if (!resposta.ok) {
            throw new Error(
                `Erro HTTP ${resposta.status}`
            );
        }

        const imagens =
            await resposta.json();

        if (!Array.isArray(imagens)) {
            throw new Error(
                'Formato de imagens inválido'
            );
        }

        const container =
            document.getElementById(
                'container-imagens-dinamicas'
            );

        const novasTelas =
            imagens.map(
                (item, index) => {
                    const section =
                        document.createElement(
                            'section'
                        );

                    section.className =
                        'tela tela-comunicado';

                    section.id =
                        `tela-drive-${index}`;

                    section.dataset.duration =
                        String(
                            TEMPO_COMUNICADO
                        );

                    const imagem =
                        document.createElement(
                            'img'
                        );

                    imagem.src =
                        item.url;

                    imagem.alt =
                        item.nome ||
                        'Comunicado';

                    imagem.className =
                        'imagem-comunicado';

                    imagem.decoding =
                        'async';

                    section.appendChild(
                        imagem
                    );

                    return section;
                }
            );

        container.replaceChildren(
            ...novasTelas
        );

    } catch (erro) {
        console.error(
            'Erro ao carregar imagens do Drive:',
            erro
        );
    }
}


// ======================================================
// ROTAÇÃO DAS TELAS
// ======================================================

function obterIdTelaAtiva() {
    const ativa =
        document.querySelector(
            '.tela.ativa'
        );

    return ativa
        ? ativa.id
        : 'tela-tempo';
}


function sincronizarTelas(
    idPreferido = 'tela-tempo'
) {
    telas = Array.from(
        document.querySelectorAll(
            '.tela'
        )
    );

    if (telas.length === 0) {
        return;
    }

    telas.forEach(tela => {
        tela.classList.remove('ativa');
    });

    const encontrado =
        telas.findIndex(
            tela =>
                tela.id ===
                idPreferido
        );

    step =
        encontrado >= 0
            ? encontrado
            : 0;

    telas[step]
        .classList.add('ativa');

    controlarVideoClima();
}


function agendarRotacao() {
    window.clearTimeout(
        timerRotacao
    );

    if (telas.length <= 1) {
        return;
    }

    const duracao =
        Number(
            telas[step].dataset.duration
        ) ||
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

    telas[step]
        .classList.remove('ativa');

    step =
        (step + 1) %
        telas.length;

    telas[step]
        .classList.add('ativa');

    controlarVideoClima();
    agendarRotacao();
}


function controlarVideoClima() {
    const video =
        document.getElementById(
            'weather-video'
        );

    const climaAtivo =
        document
            .getElementById(
                'tela-tempo'
            )
            .classList
            .contains('ativa');

    if (climaAtivo) {
        video.play().catch(() => {});
    } else {
        video.pause();
    }
}


async function atualizarConteudo(
    carregador
) {
    const idAtivo =
        obterIdTelaAtiva();

    await carregador();

    sincronizarTelas(
        idAtivo
    );

    agendarRotacao();
}


// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function iniciarMural() {
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

    await Promise.allSettled([
        carregarEventos(),
        carregarImagensDoDrive()
    ]);

    sincronizarTelas(
        'tela-tempo'
    );

    agendarRotacao();

    // Atualiza eventos a cada 10 minutos.
    window.setInterval(() => {
        atualizarConteudo(
            carregarEventos
        );
    }, 600000);

    // Atualiza comunicados a cada 30 minutos.
    window.setInterval(() => {
        atualizarConteudo(
            carregarImagensDoDrive
        );
    }, 1800000);
}


if (
    document.readyState ===
    'loading'
) {
    document.addEventListener(
        'DOMContentLoaded',
        iniciarMural
    );
} else {
    iniciarMural();
}