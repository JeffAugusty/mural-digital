// Configurações Globais
const URL_API_DRIVE = 'https://script.google.com/macros/s/AKfycbwt1akQ3NLHgea6VPNo_XdFjP0-ncBeve1ATsRbabLgq_djN3qYCn3Uuzl5K7EWDoSS/exec';
const LAT = '-18.98'; 
const LON = '-49.46';

let telas = [];
let step = 0;

// 1. RELÓGIO COM SEGUNDOS
function updateClock() {
    const agora = new Date();
    document.getElementById('relogio').innerText = agora.toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    document.getElementById('data-extenso').innerText = agora.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

// 2. SINCRONIZAÇÃO DE CLIMA (Open-Meteo)
async function syncWeather() {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=America%2FSao_Paulo`;
        const res = await fetch(url);
        const data = await res.json();
        
        const code = data.current_weather.weathercode;
        const temp = data.current_weather.temperature;
        const hora = new Date().getHours();
        const isDay = hora >= 6 && hora < 18; 
        
        const video = document.getElementById('weather-video');
        const source = video.querySelector('source');

        document.getElementById('temp-valor').innerText = `${Math.round(temp)}°C`;
        document.getElementById('temp-max').innerText = `Máx: ${Math.round(data.daily.temperature_2m_max[0])}°C`;
        document.getElementById('temp-min').innerText = `Min: ${Math.round(data.daily.temperature_2m_min[0])}°C`;

        let novoVideo = "";
        let desc = "";

        if (!isDay) {
            novoVideo = "assets/noite-estrelada.mp4";
            desc = "Céu Estrelado";
        } else if (code === 0) {
            novoVideo = "assets/ceu-limpo.mp4";
            desc = "Céu Limpo";
        } else if (code === 1) {
            novoVideo = "assets/ceu-ensolarado.mp4";
            desc = "Ensolarado";
        } else if (code === 2 || code === 3) {
            novoVideo = "assets/ceu-nublado.mp4";
            desc = "Nublado";
        } else if (code >= 95) {
            novoVideo = "assets/ceu-tempestade.mp4";
            desc = "Tempestade";
        } else if ((code >= 63 && code <= 67) || code === 81 || code === 82) {
            novoVideo = "assets/ceu-chuvoso.mp4";
            desc = "Chuva";
        } else {
            novoVideo = "assets/ceu-nublado.mp4";
            desc = "Nublado";
        }

        console.clear();
        console.log("%c--- MONITORAMENTO MURAL DIGITAL ---", "color: #00a8ff; font-weight: bold;");
        console.table({
            "Horário": new Date().toLocaleTimeString(),
            "Código API": code,
            "Condição Real": desc,
            "Temperatura": temp + "°C",
            "Vídeo": novoVideo
        });

        if (!source.src.includes(novoVideo)) {
            source.src = novoVideo;
            video.load();
        }

        document.getElementById('condicao').innerText = desc;
        document.getElementById('cidade').innerText = "ITUIUTABA";

    } catch (e) {
        console.error("Erro na API de Clima: " + e.message);
    }
}

// 3. BUSCAR IMAGENS DO GOOGLE DRIVE
async function carregarImagensDoDrive() {
    try {
        const resposta = await fetch(URL_API_DRIVE);
        const imagens = await resposta.json();
        
        const container = document.getElementById('container-imagens-dinamicas');
        
        // Mantém as imagens atuais se a API falhar ou vier vazia
        if (!imagens || imagens.length === 0) return;

        container.innerHTML = ''; 

        imagens.forEach((img, index) => {
            const section = document.createElement('section');
            section.className = 'tela';
            section.id = `tela-drive-${index}`;
            section.innerHTML = `<img src="${img.url}" alt="${img.nome}" style="width: 100vw; height: 100vh; object-fit: cover;">`;
            container.appendChild(section);
        });

        // Atualiza a lista global de seções (Tempo + Novas do Drive)
        telas = document.querySelectorAll('.tela');
    } catch (erro) {
        console.error("Erro ao carregar imagens do Drive:", erro);
    }
}

// 4. ROTAÇÃO DINÂMICA
function rotate() {
    if (telas.length === 0) return;

    telas[step].classList.remove('ativa');
    step = (step + 1) % telas.length;
    telas[step].classList.add('ativa');

    // Sempre que voltar para a tela de Clima (step 0), tenta atualizar as imagens do Drive
    if (step === 0) {
        carregarImagensDoDrive();
    }
}

// INICIALIZAÇÃO E INTERVALOS
updateClock();
setInterval(updateClock, 1000);

syncWeather();
setInterval(syncWeather, 600000); // 10 min

// Carrega as imagens e inicia a rotação
carregarImagensDoDrive().then(() => {
    telas = document.querySelectorAll('.tela'); // Captura inicial
    setInterval(rotate, 1800000); // 30 minutos
});