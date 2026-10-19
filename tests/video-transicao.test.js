const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function ambiente(){
 const classes=new Set(['ativa']);let id=0;const timers=new Map();
 const section={id:'video1',dataset:{tipoMidia:'video'},classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:c=>classes.delete(c)}};
 const ctx=vm.createContext({console,URL,URLSearchParams,section,
 window:{location:{search:''},addEventListener(){},YT:{PlayerState:{PLAYING:1,ENDED:0,BUFFERING:3}},setTimeout(f){timers.set(++id,f);return id;},clearTimeout:i=>timers.delete(i)},
 document:{readyState:'loading',addEventListener(){}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../script.js'),'utf8'),ctx);
 const run=s=>vm.runInContext(s,ctx);
 run(`globalThis.rotacoes=0;globalThis.reinicios=0;globalThis.plays=0;globalThis.estado=1;
 globalThis.registro={section,item:{tipo:'video',comSom:false},pronto:true,
 player:{getPlayerState:()=>estado,seekTo:()=>reinicios++,playVideo:()=>plays++,pauseVideo(){},getDuration:()=>60,getCurrentTime:()=>59},
 video:{ended:false,paused:true,duration:60,currentTime:59.9,play:()=>{plays++;return Promise.resolve();},pause(){}}};
 playersYoutube.set(section.id,registro);playersVideoArquivo.set(section.id,registro);
 configurarSomYoutube=()=>{};configurarLegendasYoutube=()=>{};configurarSomVideoArquivo=()=>{};
 rotacionarTela=()=>{rotacoes++;section.classList.remove('ativa');};`);
 return {run,ctx,classes,timers};
}
test('YouTube terminado avança em vez de rebobinar quando reagendado',()=>{
 const a=ambiente();a.run('tratarEstadoYoutube(section.id,1);estado=0;iniciarPlayerYoutube(section)');
 assert.equal(a.ctx.rotacoes,1);assert.equal(a.ctx.reinicios,0);assert.equal(a.ctx.plays,0);
 a.run('tratarEstadoYoutube(section.id,0)');assert.equal(a.ctx.rotacoes,1);
});
test('YouTube pode começar do início na rodada seguinte',()=>{
 const a=ambiente();a.run('registro.iniciadoNestaExibicao=true;pausarPlayersYoutubeExceto("");estado=0;iniciarPlayerYoutube(section)');
 assert.equal(a.ctx.reinicios,1);assert.equal(a.ctx.plays,1);assert.equal(a.ctx.rotacoes,0);
});
test('vídeo arquivo terminado avança sem repetir',()=>{
 const a=ambiente();a.run('registro.iniciadoNestaExibicao=true;registro.video.ended=true;iniciarPlayerVideoArquivo(section)');
 assert.equal(a.ctx.rotacoes,1);assert.equal(a.ctx.plays,0);assert.equal(a.ctx.registro.video.loop,false);
});
test('últimos quadros do arquivo não voltam ao início',()=>{
 const a=ambiente();a.run('iniciarPlayerVideoArquivo(section)');assert.equal(a.ctx.registro.video.currentTime,59.9);
});
test('eventos de vídeo inativo não cancelam o timer da tela atual',()=>{
 const a=ambiente();a.run('timerRotacao=window.setTimeout(()=>{},1000);section.classList.remove("ativa");agendarSegurancaVideoArquivo(registro);pularVideoArquivoComFalha(registro);agendarSegurancaYoutube(registro)');
 assert.equal(a.timers.size,1);assert.equal(a.ctx.rotacoes,0);
});
test('fim normal do YouTube libera a programação',()=>{
 const a=ambiente();a.run('tratarEstadoYoutube(section.id,1);tratarEstadoYoutube(section.id,0)');assert.equal(a.ctx.rotacoes,1);
});
