// Configurações Globais
const URL_API_DRIVE = 'https://script.google.com/macros/s/AKfycbwt1akQ3NLHgea6VPNo_XdFjP0-ncBeve1ATsRbabLgq_djN3qYCn3Uuzl5K7EWDoSS/exec';

const LAT = '-18.98';
const LON = '-49.46';

let telas = [];
let step = 0;


// 1. RELÓGIO COM SEGUNDOS
function updateClock() {
    const agora = new Date();

    document.getElementById('relogio').innerText =
        agora.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

    document.getElementById('data-extenso').innerText =
        agora.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
}


// 2. SINCRONIZAÇÃO DE CLIMA (OPEN-METEO)
async function syncWeather() {
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
            throw new Error(`Falha na API: ${resposta.status}`);
        }

        const data = await resposta.json();

        const code = data.current.weather_code;
        const temp = data.current.temperature_2m;
        const isDay = data.current.is_day === 1;

        const video = document.getElementById('weather-video');
        const source = video.querySelector('source');

        document.getElementById('temp-valor').innerText =
            `${Math.round(temp)}°C`;

        document.getElementById('temp-max').innerText =
            `Máx: ${Math.round(data.daily.temperature_2m_max[0])}°C`;

        document.getElementById('temp-min').innerText =
            `Min: ${Math.round(data.daily.temperature_2m_min[0])}°C`;

        let novoVideo;
        let desc;

        const codigosChuva = [
            51, 53, 55,
            56, 57,
            61, 63, 65,
            66, 67,
            80, 81, 82
        ];

        const codigosNeve = [
            71, 73, 75, 77,
            85, 86
        ];


        // TEMPESTADE
        if (code === 95 || code === 96 || code === 99) {
            desc = 'Tempestade';

            novoVideo = isDay
                ? 'assets/ceu-nublado.mp4'
                : 'assets/noite-tempestade.mp4';
        }


        // CHUVA OU GAROA
        else if (codigosChuva.includes(code)) {
            desc = 'Chuva';

            novoVideo = isDay
                ? 'assets/ceu-nublado.mp4'
                : 'assets/noite-chuvosa.mp4';
        }


        // NEBLINA
        else if (code === 45 || code === 48) {
            desc = 'Neblina';

            novoVideo = isDay
                ? 'assets/ceu-nublado.mp4'
                : 'assets/noite-nublada.mp4';
        }


        // NEVE - IMPROVÁVEL EM ITUIUTABA
        else if (codigosNeve.includes(code)) {
            desc = 'Tempo Nublado';

            novoVideo = isDay
                ? 'assets/ceu-nublado.mp4'
                : 'assets/noite-nublada.mp4';
        }


        // PARCIALMENTE NUBLADO OU NUBLADO
        else if (code === 2 || code === 3) {
            desc = 'Nublado';

            novoVideo = isDay
                ? 'assets/ceu-nublado.mp4'
                : 'assets/noite-nublada.mp4';
        }


        // PREDOMINANTEMENTE LIMPO
        else if (code === 1) {
            desc = isDay
                ? 'Ensolarado'
                : 'Céu Limpo';

            novoVideo = isDay
                ? 'assets/ceu-ensolarado.mp4'
                : 'assets/noite-estrelada.mp4';
        }


        // CÉU LIMPO
        else {
            desc = 'Céu Limpo';

            novoVideo = isDay
                ? 'assets/ceu-limpo.mp4'
                : 'assets/noite-estrelada.mp4';
        }


        // TROCA O VÍDEO APENAS QUANDO NECESSÁRIO
        if (source.getAttribute('src') !== novoVideo) {
            source.setAttribute('src', novoVideo);

            video.load();

            video.play().catch(() => {
                console.warn('O navegador bloqueou a reprodução automática.');
            });
        }

        document.getElementById('condicao').innerText = desc;
        document.getElementById('cidade').innerText = 'ITUIUTABA';

        console.log('Clima atualizado:', {
            periodo: isDay ? 'Dia' : 'Noite',
            codigo: code,
            condicao: desc,
            temperatura: `${temp}°C`,
            video: novoVideo
        });

    } catch (erro) {
        console.error('Erro na API de Clima:', erro);

        document.getElementById('condicao').innerText =
            'Clima indisponível';
    }
}


// 3. BUSCAR IMAGENS DO GOOGLE DRIVE
async function carregarImagensDoDrive() {
    try {
        const resposta = await fetch(URL_API_DRIVE);
        const imagens = await resposta.json();

        const container =
            document.getElementById('container-imagens-dinamicas');

        if (!imagens || imagens.length === 0) {
            return;
        }

        container.innerHTML = '';

        imagens.forEach((img, index) => {
            const section = document.createElement('section');

            section.className = 'tela';
            section.id = `tela-drive-${index}`;

            section.innerHTML = `
                <img
                    src="${img.url}"
                    alt="${img.nome}"
                    style="
                        width: 100vw;
                        height: 100vh;
                        object-fit: cover;
                    "
                >
            `;

            container.appendChild(section);
        });

        telas = document.querySelectorAll('.tela');

    } catch (erro) {
        console.error(
            'Erro ao carregar imagens do Drive:',
            erro
        );
    }
}


// 4. ROTAÇÃO DINÂMICA
function rotate() {
    if (telas.length === 0) {
        return;
    }

    telas[step].classList.remove('ativa');

    step = (step + 1) % telas.length;

    telas[step].classList.add('ativa');
}


// EXECUÇÃO DOS TIMERS
updateClock();
setInterval(updateClock, 1000);

syncWeather();
setInterval(syncWeather, 600000);

carregarImagensDoDrive().then(() => {
    telas = document.querySelectorAll('.tela');

    setInterval(rotate, 300000);
});

setInterval(carregarImagensDoDrive, 1800000);