// Coordenadas de Ituiutaba, MG
const LAT = '-18.98'; 
const LON = '-49.46';

// 1. FUNÇÃO DO RELÓGIO (COM SEGUNDOS)
function updateClock() {
    const agora = new Date();
    document.getElementById('relogio').innerText = agora.toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    document.getElementById('data-extenso').innerText = agora.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

// 2. SINCRONIZAÇÃO DO CLIMA E VÍDEOS LOCAIS
async function syncWeather() {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=America%2FSao_Paulo`;
        const res = await fetch(url);
        const data = await res.json();
        
        const code = data.current_weather.weathercode;
        const temp = data.current_weather.temperature;
        const hora = new Date().getHours();
        const isDay = hora >= 6 && hora < 18; // Lógica de dia/noite
        
        const video = document.getElementById('weather-video');
        const source = video.querySelector('source');

        // Atualiza textos na interface
        document.getElementById('temp-valor').innerText = `${Math.round(temp)}°C`;
        document.getElementById('temp-max').innerText = `Máx: ${Math.round(data.daily.temperature_2m_max[0])}°C`;
        document.getElementById('temp-min').innerText = `Min: ${Math.round(data.daily.temperature_2m_min[0])}°C`;

        // Lógica de seleção de vídeo baseada nos seus arquivos
        let novoVideo = "";
        let desc = "";

        if (!isDay) {
            novoVideo = "assets/noite-estrelada.mp4";
            desc = "Céu Estrelado";
        } else if (code === 0) {
            novoVideo = "assets/ceu-limpo.mp4";
            desc = "Céu Limpo";
        } else if (code >= 1 && code <= 3) {
            novoVideo = (code === 1) ? "assets/ceu-ensolarado.mp4" : "assets/ceu-nublado.mp4";
            desc = (code === 1) ? "Ensolarado" : "Nublado";
        } else if (code >= 95) {
            novoVideo = "assets/ceu-tempestade.mp4";
            desc = "Tempestade";
        } else if (code >= 51) {
            novoVideo = "assets/ceu-chuvoso.mp4";
            desc = "Chuva";
        }

        // --- MONITORAMENTO NO CONSOLE (F12) ---
        console.clear();
        console.log("%c--- MONITORAMENTO MURAL DIGITAL ---", "color: #00a8ff; font-weight: bold; font-size: 14px;");
        console.table({
            "Horário": new Date().toLocaleTimeString(),
            "Cidade": "Ituiutaba",
            "Estado": isDay ? "Dia" : "Noite",
            "Código Weather": code,
            "Condição": desc,
            "Temperatura": temp + "°C",
            "Arquivo Ativo": novoVideo
        });

        // Troca o vídeo apenas se a condição mudar
        if (!source.src.includes(novoVideo)) {
            console.log("%c[SISTEMA] Trocando fundo para: " + novoVideo, "color: #ffa500;");
            source.src = novoVideo;
            video.load();
        }

        document.getElementById('condicao').innerText = desc;

    } catch (e) { 
        console.error("%c[ERRO] Falha ao buscar clima: " + e.message, "color: #ff0000;");
    }
}

// 3. ROTAÇÃO DE TELAS (20 segundos cada)
let step = 0;
const sections = document.querySelectorAll('.tela');
function rotate() {
    sections[step].classList.remove('ativa');
    step = (step + 1) % sections.length;
    sections[step].classList.add('ativa');
    console.log("%c[MURAL] Mudando para tela: " + sections[step].id, "color: #00ff00;");
}

// INICIALIZAÇÃO
setInterval(updateClock, 1000);
updateClock();
syncWeather();
setInterval(syncWeather, 600000); // Sincroniza clima a cada 10 min
setInterval(rotate, 20000); // Troca de tela a cada 20 segundos