const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const raiz = path.join(__dirname, '..');
const fonte = fs.readFileSync(path.join(raiz, 'musica-player.js'), 'utf8');
const principal = fs.readFileSync(path.join(raiz, 'script.js'), 'utf8');
const musicas = ['A','B','C','D','E'].map(id => ({ id, titulo: `Música ${id}`, artista: `Artista ${id}`, capaUrl: `https://example.com/${id}.jpg` }));
function player(random = () => 0.999) {
    const math = Object.create(Math); math.random = random;
    const ctx = vm.createContext({ URL, Math: math, module: { exports: {} } });
    vm.runInContext(fonte, ctx); return ctx.module.exports;
}
function sair(mod, id, tocou = true) {
    const section = { dataset: { musicaChave: id, musicaReproduzida: String(tocou) } };
    mod.registrarSaida(section); return section;
}
const ids = fila => Array.from(fila, linha => linha.item?.id || null);

test('primeira rodada tem histórico vazio e duas próximas reais', () => {
    const p = player(); p.configurar(musicas);
    assert.deepEqual(ids(p.obterFila('A')), [null,null,'A','B','C']);
});
test('fila usa as duas reproduzidas e retorna ao início ao final da lista', () => {
    const p = player(); p.configurar(musicas); sair(p,'C'); sair(p,'D');
    assert.deepEqual(ids(p.obterFila('E')), ['C','D','E','A','B']);
    sair(p,'E'); assert.deepEqual(ids(p.obterFila('A')), ['D','E','A','B','C']);
});
test('falha antes de tocar não entra no histórico; pausa/retomada não duplica a saída', () => {
    const p = player(); p.configurar(musicas); sair(p,'A',false);
    const section = sair(p,'B'); p.registrarSaida(section);
    assert.deepEqual(ids(p.obterFila('C')), [null,'B','C','D','E']);
});
test('zero, uma ou duas músicas não fabricam outras faixas', () => {
    const p = player(); p.configurar([]); assert.equal(p.obterFila('A').length,0);
    p.configurar(musicas.slice(0,1)); assert.deepEqual(ids(p.obterFila('A')), [null,null,'A',null,null]);
    p.configurar(musicas.slice(0,2)); assert.deepEqual(ids(p.obterFila('B')), [null,null,'B','A',null]);
});
test('atualização de cadastro preserva histórico e a fila sorteada', () => {
    const p = player(); p.configurar(musicas); sair(p,'A');
    p.configurar([musicas[2],musicas[4],musicas[1]]);
    assert.deepEqual(ids(p.obterFila('C')), [null,'A','C','E','B']);
});
test('títulos são escapados e links não seguros não entram nas capas da fila', () => {
    const p = player(); p.configurar([{id:'x',titulo:'<img src=x onerror=alert(1)>',artista:'A & B',capaUrl:'javascript:alert(1)'}]);
    const lista = { dataset:{},querySelectorAll:()=>[] };
    p.atualizarFila({dataset:{musicaChave:'x'},querySelector:()=>lista});
    assert.ok(lista.innerHTML.includes('&lt;img')); assert.ok(lista.innerHTML.includes('A &amp; B'));
    assert.ok(!lista.innerHTML.includes('src="javascript:'));
});
test('player preserva o áudio e o progresso, sem criar controles de reprodução novos', () => {
    const p = player();
    const yt = p.criarPlayer(musicas[0],{capa:musicas[0].capaUrl,audio:'',videoId:'abcdefghijk'});
    const local = p.criarPlayer(musicas[0],{capa:musicas[0].capaUrl,audio:'https://example.com/audio.mp3',videoId:''});
    assert.ok(yt.includes('youtube-player-alvo')); assert.ok(!yt.includes('<audio'));
    assert.ok(local.includes('class="musica-audio"')); assert.ok(!local.includes('youtube-player-alvo'));
    for (const html of [yt,local]) for(const classe of ['musica-progresso-preenchimento','musica-tempo-atual','musica-tempo-total','musica-aviso-audio']) assert.ok(html.includes(classe));
});

test('integração: fim da música volta aos avisos, registra histórico e seleciona só a próxima', () => {
    const math = Object.create(Math); math.random = () => 0.999;
    const ctx = vm.createContext({ URL, URLSearchParams, console, Math: math,
        window:{location:{search:''},addEventListener(){},clearTimeout(){},setTimeout(){return 1;}},
        document:{readyState:'loading',addEventListener(){}}
    });
    vm.runInContext(fonte + '\n' + principal,ctx);
    vm.runInContext(`
        function node(id, classes) {
            const set = new Set(classes);
            return { id, dataset:{}, classList:{contains:c=>set.has(c),add:(...cs)=>cs.forEach(c=>set.add(c)),remove:(...cs)=>cs.forEach(c=>set.delete(c)),toggle:(c,v)=>v?set.add(c):set.delete(c)} };
        }
        const clima = node('tela-tempo',['tela']);
        const a = node('tela-musica-A',['tela','tela-musica','ativa','tocando']);
        const b = node('tela-musica-B',['tela-musica','tela-musica-espera']);
        a.dataset={musicaChave:'A',musicaReproduzida:'true'};
        b.dataset={musicaChave:'B'};
        MuralMusicas.configurar([{id:'A',titulo:'A'},{id:'B',titulo:'B'}]);
        document.querySelectorAll = () => [a,b];
        document.querySelector = () => clima;
        obterTelasOrdenadas = () => [clima, ...[a,b].filter(s=>s.classList.contains('tela'))];
        controlarVideoClima = () => {};
        agendarRotacao = () => {};
        telas=[clima,a]; step=1; idMusicaDaRodada=a.id;
        rotacionarTela();
    `,ctx);
    assert.equal(vm.runInContext('clima.classList.contains("ativa")',ctx),true);
    assert.equal(vm.runInContext('idMusicaDaRodada',ctx),'tela-musica-B');
    assert.equal(vm.runInContext('a.classList.contains("tela")',ctx),false);
    assert.equal(vm.runInContext('b.classList.contains("tela")',ctx),true);
    assert.equal(vm.runInContext('MuralMusicas.obterFila("B")[1].item.id',ctx),'A');
});


test('playlist aleatória toca todas antes de repetir e a prévia acompanha a virada', () => {
    const p = player(() => 0);
    const ordem = Array.from(p.configurar(musicas), item => item.id);
    assert.notDeepEqual(ordem, musicas.map(item => item.id));
    assert.equal(new Set(ordem).size, musicas.length);
    let atual = ordem[0];
    for (let i = 0; i < 15; i += 1) {
        const previstas = ids(p.obterFila(atual)).slice(3);
        const proxima = p.avancar(atual);
        assert.equal(proxima, previstas[0]);
        assert.notEqual(proxima, atual);
        assert.equal(ids(p.obterFila(proxima))[3], previstas[1]);
        atual = proxima;
    }
});

test('recarregar cadastros não embaralha novamente a fila prevista', () => {
    const p = player(() => 0);
    const ordem = Array.from(p.configurar(musicas), item => item.id);
    const fila = ids(p.obterFila(ordem[0]));
    p.configurar([...musicas].reverse().map(item => ({...item, artista:'Atualizado'})));
    assert.deepEqual(ids(p.obterFila(ordem[0])), fila);
    assert.equal(p.obterFila(ordem[0])[2].item.artista, 'Atualizado');
});

test('playlist tem apenas o rótulo Próxima e não exibe comentários decorativos', () => {
    const p = player(); p.configurar(musicas);
    const lista = {dataset:{},querySelectorAll:()=>[]};
    p.atualizarFila({dataset:{musicaChave:'A'},querySelector:()=>lista});
    const html = p.criarPlayer(musicas[0],{capa:'',audio:'',videoId:''}) + lista.innerHTML;
    assert.ok(html.includes('<h2>Playlist</h2>'));
    assert.equal((html.match(/musica-fila-rotulo/g)||[]).length, 1);
    assert.ok(html.includes('Próxima'));
    for (const texto of ['SEU INTERVALO MUSICAL','Tocou antes','Última música','Depois','Uma pausa para ouvir','Uma música completa a cada rodada','Próxima rodada']) assert.ok(!html.includes(texto));
});

test('pausa global sincroniza, preserva estados individuais e não bloqueia vídeos/lives', () => {
    const cache = new Map();
    let receber;
    const ctx = vm.createContext({ URL, URLSearchParams, console:{info(){},error(){}},
        localStorage:{getItem:k=>cache.get(k)??null,setItem:(k,v)=>cache.set(k,v)},
        window:{location:{search:''},addEventListener(){}},
        document:{readyState:'loading',addEventListener(){}}
    });
    vm.runInContext(fonte+'\n'+principal,ctx);
    ctx.banco = {collection:()=>({doc:()=>({onSnapshot:fn=>{receber=fn;}})})};
    vm.runInContext(`
        db=banco;
        carregarCacheMidiasYoutube=()=>[];
        carregarCacheInteracaoMusica=()=>({});
        salvarCacheMidiasYoutube=()=>{};
        salvarCacheInteracaoMusica=()=>{};
        renderizarInteracaoMusica=()=>{};
        renderizarMidiasYoutube=(lista)=>{ globalThis.visiveis=lista.filter(midiaYoutubeEstaVisivel); };
        iniciarMidiasYoutubeFirebase();
    `,ctx);
    const items = [
        {id:'song',tipo:'musica',ativo:true,url:'https://www.youtube.com/watch?v=abcdefghijk',capaUrl:'https://example.com/capa.jpg'},
        {id:'off',tipo:'musica',ativo:false,url:'https://www.youtube.com/watch?v=abcdefghijk',capaUrl:'https://example.com/capa.jpg'},
        {id:'video',tipo:'video',ativo:true,url:'https://www.youtube.com/watch?v=abcdefghijk'},
        {id:'live',tipo:'live',ativo:true,url:'https://www.youtube.com/watch?v=abcdefghijk'}
    ];
    const original = JSON.stringify(items);
    receber({exists:true,data:()=>({midias:items,musicasHabilitadas:false})});
    assert.deepEqual(Array.from(ctx.visiveis,i=>i.id),['video','live']);
    assert.equal(cache.get('mural-musicas-habilitadas-v1'),'false');
    vm.runInContext('musicasHabilitadas=true; iniciarMidiasYoutubeFirebase();',ctx);
    assert.equal(vm.runInContext('musicasHabilitadas',ctx),false);
    receber({exists:true,data:()=>({midias:items,musicasHabilitadas:true})});
    assert.deepEqual(Array.from(ctx.visiveis,i=>i.id),['song','video','live']);
    assert.equal(JSON.stringify(items),original);
});


test('troca segue a reserva exibida mesmo com o seletor global desatualizado', () => {
    const ctx = vm.createContext({ URL, URLSearchParams, console,
        window:{location:{search:''},addEventListener(){}},
        document:{readyState:'loading',addEventListener(){}}
    });
    vm.runInContext(fonte+'\n'+principal,ctx);
    vm.runInContext(`
        const itens = ['A','B','C','D'].map(id=>({id,titulo:id}));
        const ordem = MuralMusicas.configurar(itens);
        const nodes = ordem.map(item=>({id:'tela-musica-'+item.id,dataset:{musicaChave:item.id},classList:{toggle(){}}}));
        const tocando = nodes[0];
        const lista = {dataset:{},querySelectorAll:()=>[]};
        tocando.querySelector=()=>lista;
        MuralMusicas.atualizarFila(tocando);
        globalThis.anunciada = tocando.dataset.musicaProxima;
        document.querySelectorAll=()=>nodes;
        document.querySelector=()=>null;
        obterTelasOrdenadas=()=>[];
        idMusicaDaRodada=nodes[1].id;
        selecionarProximaMusicaDaRodada(tocando);
    `,ctx);
    assert.equal(vm.runInContext('idMusicaDaRodada',ctx), 'tela-musica-'+ctx.anunciada);
});

test('reserva anunciada continua válida na virada do ciclo aleatório', () => {
    const p=player(()=>0);
    const ordem=Array.from(p.configurar(musicas),item=>item.id);
    const atual=ordem[ordem.length-1];
    const section={dataset:{musicaChave:atual},querySelector:()=>({dataset:{},querySelectorAll:()=>[]})};
    p.atualizarFila(section);
    assert.equal(p.avancar(atual,section.dataset.musicaProxima),section.dataset.musicaProxima);
});
