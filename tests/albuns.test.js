const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const raiz=path.join(__dirname,'..');
const fonte=fs.readFileSync(path.join(raiz,'albuns.js'),'utf8');
const album={id:'a',nome:'Aula prática',tempoFoto:7,fotos:Array.from({length:5},(_,i)=>({id:String(i),url:`https://example.com/${i}.jpg`,legenda:''}))};
const p=require('../albuns.js');
test('abertura e legendas são opcionais e todas as fotos aparecem na ordem',()=>{
    const q=p.quadros(album);
    assert.deepEqual(q.map(f=>f.fotos.length),[1,2,1,1]);
    assert.deepEqual(q.flatMap(f=>f.fotos.map(i=>i.id)),['0','1','2','3','4']);
    assert.ok(q.every(f=>f.duracao===7000&&!f.abertura));
    assert.deepEqual(p.quadros({...album,layout:'individual'}).map(f=>f.fotos.length),[1,1,1,1,1]);
});
test('abertura dura três segundos apenas quando habilitada com título',()=>{
    assert.equal(p.quadros({...album,abertura:true,tituloAbertura:'Aula prática'})[0].duracao,3000);
    assert.equal(p.quadros({...album,abertura:true,tituloAbertura:''})[0].fotos.length,1);
    assert.equal(p.quadros({...album,abertura:false,tituloAbertura:'Não mostrar'})[0].fotos.length,1);
});
test('datas, desativação, arquivos inválidos e álbum vazio são respeitados',()=>{
    const agora=new Date('2026-10-18T12:00:00').getTime();
    assert.equal(p.visivel({...album,exibirDesde:'2026-10-18',exibirAte:'2026-10-18'},agora),true);
    assert.equal(p.visivel({...album,exibirDesde:'2026-10-19'},agora),false);
    assert.equal(p.visivel({...album,exibirAte:'2026-10-17'},agora),false);
    assert.equal(p.visivel({...album,ativo:false},agora),false);
    assert.equal(p.visivel({...album,fotos:[{url:'javascript:alert(1)'}]},agora),false);
    assert.deepEqual(p.quadros({...album,fotos:[],abertura:true,tituloAbertura:'Oi'}),[]);
});
function ambiente() {
    let tempo=0,id=0; const tarefas=new Map();
    function node(tag) {
        const e={tag,className:'',dataset:{},children:[],style:{setProperty(){}},setAttribute(){},addEventListener(){},
            append(...ns){for(const n of ns){n.parent=this;this.children.push(n);}},
            replaceChildren(...ns){this.children=[];this.append(...ns);},
            remove(){this.parent.children=this.parent.children.filter(n=>n!==this);},
            get firstElementChild(){return this.children[0];},
            querySelector(sel){return this.children.find(n=>n.className.split(' ').includes(sel.slice(1)))||this.children.map(n=>n.querySelector(sel)).find(Boolean);}
        };
        e.classList={contains:c=>e.className.split(' ').includes(c),add:c=>{e.className+=' '+c;}};
        return e;
    }
    const ctx=vm.createContext({URL,module:{exports:{}},document:{createElement:node},
        setTimeout:(f,ms)=>{tarefas.set(++id,{f,t:tempo+ms});return id;},clearTimeout:i=>tarefas.delete(i)});
    vm.runInContext(fonte,ctx);
    const avanca=ms=>{const alvo=tempo+ms;while(true){const proxima=[...tarefas].filter(([,v])=>v.t<=alvo).sort((a,b)=>a[1].t-b[1].t)[0];if(!proxima)break;tempo=proxima[1].t;tarefas.delete(proxima[0]);proxima[1].f();}tempo=alvo;};
    return {p:ctx.module.exports,avanca};
}
test('álbum termina uma única vez após todas as fotos e não reinicia ao reagendar',()=>{
    const {p,avanca}=ambiente();const section=p.criar({...album,abertura:true,tituloAbertura:'Aula'});section.classList.add('ativa');let terminou=0;
    p.iniciar(section,()=>terminou++);
    assert.equal(section.dataset.programacaoChave,'album:a');
    assert.equal(section.querySelector('.album-abertura').textContent,'Aula');
    avanca(3000);p.iniciar(section,()=>terminou++);
    avanca(27999);assert.equal(terminou,0);avanca(1);assert.equal(terminou,1);avanca(10000);assert.equal(terminou,1);
});
test('pausa cancela callbacks e novo início recomeça pela primeira foto',()=>{
    const {p,avanca}=ambiente();const section=p.criar(album);section.classList.add('ativa');let terminou=0;
    p.iniciar(section,()=>terminou++);avanca(8000);p.parar();avanca(60000);assert.equal(terminou,0);
    p.iniciar(section,()=>terminou++);assert.equal(section.querySelector('.album-foto-frente').src,album.fotos[0].url);
    avanca(28000);assert.equal(terminou,1);
});

function editor(opcoes={}) {
    const campos=new Map();let sequencia=0;
    const obter=id=>{
        if(!campos.has(id))campos.set(id,{value:'',checked:false,disabled:false,dataset:{},eventos:{},classList:{add(){},remove(){},toggle(){}},focus(){},reset(){},addEventListener(n,f){this.eventos[n]=f;}});
        return campos.get(id);
    };
    const ctx=vm.createContext({window:{},URL:{createObjectURL:f=>'blob:'+f.name,revokeObjectURL(){}},crypto:{randomUUID:()=>String(++sequencia)},confirm:()=>true});
    vm.runInContext(fs.readFileSync(path.join(raiz,'albuns-admin.js'),'utf8'),ctx);
    const salvos=[],removidos=[];
    const instancia=ctx.window.criarEditorAlbuns({raiz:{querySelector:obter},podeEditar:()=>true,
        otimizar:async f=>f,validar:()=>'',enviar:async f=>({url:'https://example.com/'+f.name,chave:'imagens/'+f.name}),
        salvar:async(id,item)=>salvos.push({id,item}),excluirArquivo:async f=>removidos.push(f.imagemR2Chave),...opcoes});
    obter('#album-nome').value='Aula';obter('#album-tempo').value='7';obter('#album-layout').value='alternado';obter('#album-ativo').checked=true;
    const adicionar=nomes=>obter('#album-arquivos').eventos.change({target:{files:nomes.map(name=>({name})),value:''}});
    const enviar=()=>obter('#album-form').eventos.submit({preventDefault(){}});
    return {obter,instancia,adicionar,enviar,salvos,removidos};
}
test('cadastro em lote salva fotos na ordem escolhida, sem exigir abertura ou legenda',async()=>{
    const e=editor();e.adicionar(['a.jpg','b.jpg']);
    e.obter('#album-fotos').eventos.click({target:{closest:()=>({dataset:{mover:'1',direcao:'-1'}})}});
    await e.enviar();
    assert.equal(e.salvos.length,1);
    const a=e.salvos[0].item;
    assert.deepEqual(Array.from(a.fotos,f=>f.url),['https://example.com/b.jpg','https://example.com/a.jpg']);
    assert.equal(a.abertura,false);assert.ok(a.fotos.every(f=>f.legenda===''));
    assert.equal(e.removidos.length,0);
});
test('falha no cadastro limpa só uploads novos e permite tentar novamente',async()=>{
    const e=editor({salvar:async()=>{throw new Error('Sem conexão');}});e.adicionar(['a.jpg','b.jpg']);await e.enviar();
    assert.deepEqual(e.removidos,['imagens/a.jpg','imagens/b.jpg']);
    assert.equal(e.obter('#album-campos').disabled,false);
    assert.match(e.obter('#album-mensagem').textContent,/Sem conexão/);
});
test('falha no segundo envio limpa primeiro e não grava álbum incompleto',async()=>{
    let n=0;
    const e=editor({enviar:async()=>{if(++n===2)throw new Error('Upload recusado');return {url:'https://example.com/a.jpg',chave:'imagens/a.jpg'};}});
    e.adicionar(['a.jpg','b.jpg']);await e.enviar();
    assert.equal(e.salvos.length,0);assert.deepEqual(e.removidos,['imagens/a.jpg']);
});
