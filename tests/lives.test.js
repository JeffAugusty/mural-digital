const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const fonte=fs.readFileSync(require('node:path').join(__dirname,'..','script.js'),'utf8');
function ambiente() {
    let tempo=0,id=0;const timers=new Map();
    const avisos=[];const classes=new Set(['ativa']);
    const section={id:'tela-youtube-live1',dataset:{tipoMidia:'live'},classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:c=>classes.delete(c)},remove(){classes.clear();},
        querySelector(sel){if(sel==='.live-aguardando')return avisos[0];if(sel==='.youtube-card')return {appendChild:e=>avisos.push(e)};if(sel==='.youtube-player')return {replaceChildren(){}};return null;}};
    const ctx=vm.createContext({URL,URLSearchParams,console:{warn(){},error(){},info(){}},
        window:{location:{search:''},addEventListener(){},YT:{PlayerState:{PLAYING:1,ENDED:0,BUFFERING:3,PAUSED:2}},setTimeout(f,ms){timers.set(++id,{f,t:tempo+ms});return id;},clearTimeout:id=>timers.delete(id)},
        document:{readyState:'loading',addEventListener(){},getElementById:id=>id===section.id?section:null,createElement:()=>({setAttribute(){},remove(){avisos.splice(0,1);}})},section});
    vm.runInContext(fonte,ctx);
    vm.runInContext(`
        globalThis.estado=-1;globalThis.recarregou=0;globalThis.recriou=0;globalThis.rotacoes=0;globalThis.agendamentos=0;
        globalThis.registro={section,item:{id:'live1',tipo:'live',ativo:true,url:'https://www.youtube.com/watch?v=abcdefghijk',comSom:true},pronto:true,
            player:{getPlayerState:()=>estado,loadVideoById:()=>{recarregou++;},playVideo(){},destroy(){}}};
        playersYoutube.set(section.id,registro);midiasYoutube=[registro.item];liveFixaId=section.id;
        configurarSomYoutube=()=>{};configurarLegendasYoutube=()=>{};
        rotacionarTela=()=>{rotacoes++;};sincronizarTelas=()=>{};agendarRotacao=()=>{agendamentos++;};
        criarPlayersYoutube=async()=>{recriou++;};
    `,ctx);
    const run=s=>vm.runInContext(s,ctx);
    const avanca=async ms=>{const limite=tempo+ms;while(true){const p=[...timers].filter(([,v])=>v.t<=limite).sort((a,b)=>a[1].t-b[1].t)[0];if(!p)break;tempo=p[1].t;timers.delete(p[0]);await p[1].f();}tempo=limite;};
    return {ctx,run,avanca,timers,avisos,section};
}
test('live aguarda mais de dez minutos sem voltar à programação e inicia quando disponível',async()=>{
    const a=ambiente();a.run('iniciarPlayerYoutube(section)');await a.avanca(11*60000);
    assert.equal(a.ctx.rotacoes,0);assert.equal(a.ctx.agendamentos,0);assert.equal(a.ctx.recarregou,11);
    assert.equal(a.run('liveFixaId'),a.section.id);
    a.run('estado=1;tratarEstadoYoutube(section.id,1)');assert.equal(a.avisos.length,0);assert.equal(a.timers.size,0);
});
test('erro e ENDED antes do início preservam live, enquanto término após PLAYING encerra',async()=>{
    const a=ambiente();a.run('tratarErroYoutube(section.id,100);tratarEstadoYoutube(section.id,0)');
    await a.avanca(60000);assert.equal(a.ctx.agendamentos,0);assert.equal(a.ctx.recarregou,1);
    a.run('estado=1;tratarEstadoYoutube(section.id,1);estado=0;tratarEstadoYoutube(section.id,0)');
    assert.equal(a.run('liveFixaId'),'');assert.equal(a.ctx.agendamentos,1);assert.equal(a.timers.size,0);
});
test('buffering prolongado usa um só timer e retoma sem descartar a live',async()=>{
    const a=ambiente();a.run('estado=1;tratarEstadoYoutube(section.id,1);estado=3;tratarEstadoYoutube(section.id,3);tratarEstadoYoutube(section.id,3)');
    assert.equal(a.timers.size,1);await a.avanca(60000);assert.equal(a.ctx.recarregou,1);assert.equal(a.ctx.agendamentos,0);
    a.run('estado=1;tratarEstadoYoutube(section.id,1)');assert.equal(a.timers.size,0);
});
test('iframe sem onReady é recriado sem encerrar a live; desativação cancela tentativa',async()=>{
    const a=ambiente();a.run('registro.pronto=false;iniciarPlayerYoutube(section)');await a.avanca(60000);
    assert.equal(a.ctx.recriou,1);assert.equal(a.ctx.agendamentos,0);
    a.run('destruirPlayersYoutube();liveFixaId=""');await a.avanca(120000);assert.equal(a.ctx.recriou,1);assert.equal(a.timers.size,0);
});
test('nova tentativa que inicia imediatamente não deixa aviso por cima da live',async()=>{
    const a=ambiente();a.run('registro.player.loadVideoById=()=>{estado=1;tratarEstadoYoutube(section.id,1);};iniciarPlayerYoutube(section)');
    await a.avanca(60000);assert.equal(a.avisos.length,0);assert.equal(a.timers.size,0);
});
