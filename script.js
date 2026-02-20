// Coordenadas exatas de Ituiutaba, MG
const LAT = '-18.98'; 
const LON = '-49.46';

// 1. RELÓGIO COM SEGUNDOS (PRECISÃO PARA OS ALUNOS)
function updateClock() {
    const agora = new Date();
    document.getElementById('relogio').innerText = agora.toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    document.getElementById('data-extenso').innerText = agora.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

// 2. SINCRONIZAÇÃO DE CLIMA COM FILTRO DE SEGURANÇA
async function syncWeather() {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=America%2FSao_Paulo`;
        const res = await fetch(url);
        const data = await res.json();
        
        const code = data.current_weather.weathercode;
        const temp = data.current_weather.temperature;
        const hora = new Date().getHours();
        const isDay = hora >= 6 && hora < 18; // Lógica Dia/Noite
        
        const video = document.getElementById('weather-video');
        const source = video.querySelector('source');

        document.getElementById('temp-valor').innerText = `${Math.round(temp)}°C`;
        document.getElementById('temp-max').innerText = `Máx: ${Math.round(data.daily.temperature_2m_max[0])}°C`;
        document.getElementById('temp-min').innerText = `Min: ${Math.round(data.daily.temperature_2m_min[0])}°C`;

        let novoVideo = "";
        let desc = "";

        // --- LÓGICA DE DECISÃO REFINADA (ANTI-ERRO) ---
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
        } 
        // FILTRO: Somente códigos 63, 65, 67 (Chuva moderada/forte) 
        // ou 81, 82 (Pancadas fortes) ativam o vídeo de chuva.
        else if ((code >= 63 && code <= 67) || code === 81 || code === 82) {
            novoVideo = "assets/ceu-chuvoso.mp4";
            desc = "Chuva";
        } 
        // CÓDIGOS DE SEGURANÇA (51-61, 80): Se a API estiver em dúvida, mostramos "Nublado".
        else {
            novoVideo = "assets/ceu-nublado.mp4";
            desc = "Nublado";
        }

        // MONITORAMENTO PROFISSIONAL NO CONSOLE
        console.clear();
        console.log("%c--- MONITORAMENTO MURAL DIGITAL ---", "color: #00a8ff; font-weight: bold;");
        console.table({
            "Horário": new Date().toLocaleTimeString(),
            "Código API": code,
            "Condição Real": desc,
            "Temperatura": temp + "°C",
            "Vídeo": novoVideo
        });

        // Troca o vídeo suavemente se houver mudança
        if (!source.src.includes(novoVideo)) {
            source.src = novoVideo;
            video.load();
        }

        document.getElementById('condicao').innerText = desc;
        document.getElementById('cidade').innerText = "ITUIUTABA";

    } catch (e) {
        console.error("Erro na API: " + e.message);
    }
}

// 3. ROTAÇÃO DE TELAS (20 SEGUNDOS)
let step = 0;
const sections = document.querySelectorAll('.tela');
function rotate() {
    sections[step].classList.remove('ativa');
    step = (step + 1) % sections.length;
    sections[step].classList.add('ativa');
}

// INICIALIZAÇÃO
setInterval(updateClock, 1000);
updateClock();
syncWeather();
setInterval(syncWeather, 600000); // Atualiza clima a cada 10 min
setInterval(rotate, 20000); // Troca de tela a cada 20 segundos