/* Editor de álbuns. Reutiliza a autenticação e o upload de imagens do painel. */
window.criarEditorAlbuns = function ({ raiz, salvar, enviar, otimizar, validar, excluirArquivo, podeEditar }) {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const $ = s => raiz.querySelector(s);
    let albuns = [], fotos = [], editando = '', ocupado = false, arrastada = -1;
    raiz.innerHTML = `
        <div class="card-cabecalho"><h2>Álbuns de aulas</h2><button type="button" class="botao botao-primario" id="album-novo">Novo álbum</button></div>
        <div id="album-mensagem" role="status" class="mensagem oculto"></div>
        <form id="album-form" class="album-editor oculto">
            <fieldset id="album-campos">
                <h3 id="album-form-titulo">Novo álbum</h3>
                <div class="grade">
                    <div class="campo campo-largo"><label for="album-nome">Nome do álbum</label><input id="album-nome" required maxlength="100" placeholder="Ex.: Aula prática de Agronomia"></div>
                    <div class="campo"><label for="album-tempo">Tempo por foto ou par (segundos)</label><input id="album-tempo" type="number" min="4" max="30" value="7" required></div>
                    <div class="campo"><label for="album-layout">Apresentação</label><select id="album-layout"><option value="alternado">Alternar uma e duas fotos</option><option value="individual">Uma foto por vez</option></select></div>
                    <div class="campo"><label for="album-inicio">Exibir a partir de (opcional)</label><input id="album-inicio" type="date"></div>
                    <div class="campo"><label for="album-fim">Exibir até (opcional)</label><input id="album-fim" type="date"></div>
                    <div class="campo campo-largo"><label class="linha-check"><input id="album-ativo" type="checkbox" checked> Exibir álbum na TV</label></div>
                    <div class="campo campo-largo"><label class="linha-check"><input id="album-abertura" type="checkbox"> Exibir abertura</label></div>
                    <div class="campo campo-largo oculto" id="album-abertura-campo"><label for="album-titulo">Título da abertura</label><input id="album-titulo" maxlength="140"></div>
                    <div class="campo campo-largo"><label for="album-arquivos">Adicionar fotos (JPG, PNG ou WebP · até 8 MB cada)</label><input id="album-arquivos" type="file" accept="image/jpeg,image/png,image/webp" multiple></div>
                </div>
                <div id="album-fotos" class="album-fotos-editor"></div>
                <div class="botoes"><button id="album-cancelar" class="botao botao-secundario" type="button">Cancelar</button><button id="album-salvar" class="botao botao-primario" type="submit">Salvar álbum</button></div>
            </fieldset>
        </form>
        <div id="album-lista" class="album-lista"></div>`;
    function mensagem(texto, erro = false) {
        const el = $('#album-mensagem'); el.textContent = texto; el.className = `mensagem ${erro ? 'mensagem-erro' : 'mensagem-sucesso'}`;
    }
    function liberar() { fotos.forEach(f=>{ if(f.file) URL.revokeObjectURL(f.url); }); }
    function fechar() {
        liberar(); fotos=[]; editando=''; $('#album-form').reset(); $('#album-form').classList.add('oculto');
        $('#album-abertura-campo').classList.add('oculto'); $('#album-titulo').required=false;
    }
    function renderFotos() {
        $('#album-fotos').innerHTML = fotos.length ? fotos.map((f,i)=>`<article class="album-foto-editor" data-foto="${i}">
            <div class="album-editor-miniatura"><img src="${esc(f.url)}" alt="Foto ${i+1}"><span>${i+1}</span></div>
            <label>Legenda (opcional)<input data-legenda="${i}" maxlength="180" value="${esc(f.legenda)}"></label>
            <div class="album-foto-acoes"><button type="button" draggable="true" data-arrastar="${i}" aria-label="Arrastar foto ${i+1}" title="Arrastar">⠿</button><button type="button" data-mover="${i}" data-direcao="-1" ${i===0?'disabled':''} aria-label="Mover foto ${i+1} para antes">↑</button><button type="button" data-mover="${i}" data-direcao="1" ${i===fotos.length-1?'disabled':''} aria-label="Mover foto ${i+1} para depois">↓</button><button type="button" data-remover="${i}">Remover</button></div>
        </article>`).join('') : '<div class="vazio">Adicione as fotos do álbum.</div>';
    }
    function renderLista() {
        $('#album-lista').innerHTML = albuns.length ? albuns.map(a=>`<article class="album-item">
            <img src="${esc(a.fotos?.[0]?.url || '')}" alt="" loading="lazy">
            <div><h3>${esc(a.nome)}</h3><span>${a.fotos?.length || 0} fotos · ${Number(a.tempoFoto)||7}s · ${a.ativo===false?'Inativo':'Ativo'}</span></div>
            <div class="imagem-acoes"><button type="button" data-editar="${esc(a.id)}">Editar</button><button type="button" data-alternar="${esc(a.id)}">${a.ativo===false?'Ativar':'Desativar'}</button><button type="button" class="excluir" data-excluir="${esc(a.id)}">Excluir</button></div>
        </article>`).join('') : '<div class="vazio">Nenhum álbum cadastrado.</div>';
    }
    function abrir(album) {
        if (ocupado || !podeEditar()) return;
        fechar(); $('#album-mensagem').classList.add('oculto');
        editando = album?.id || '';
        fotos = (album?.fotos || []).map(f=>({...f}));
        $('#album-nome').value=album?.nome || '';
        $('#album-tempo').value=album?.tempoFoto || 7;
        $('#album-layout').value=album?.layout || 'alternado';
        $('#album-inicio').value=album?.exibirDesde || '';
        $('#album-fim').value=album?.exibirAte || '';
        $('#album-ativo').checked=album?.ativo !== false;
        $('#album-abertura').checked=album?.abertura === true;
        $('#album-titulo').value=album?.tituloAbertura || '';
        $('#album-abertura-campo').classList.toggle('oculto', !$('#album-abertura').checked);
        $('#album-titulo').required=$('#album-abertura').checked;
        $('#album-form-titulo').textContent=album?'Editar álbum':'Novo álbum';
        $('#album-form').classList.remove('oculto'); renderFotos(); $('#album-nome').focus();
    }
    function bloquear(valor) { ocupado=valor; $('#album-campos').disabled=valor; $('#album-novo').disabled=valor; }
    async function limparArquivos(lista) {
        const erros = await Promise.allSettled(lista.filter(f=>f.imagemR2Chave).map(excluirArquivo));
        return erros.some(r=>r.status==='rejected');
    }
    $('#album-novo').addEventListener('click',()=>abrir());
    $('#album-cancelar').addEventListener('click',()=>{ if(!ocupado) fechar(); });
    $('#album-abertura').addEventListener('change',()=>{
        $('#album-abertura-campo').classList.toggle('oculto',!$('#album-abertura').checked);
        $('#album-titulo').required=$('#album-abertura').checked;
    });
    $('#album-arquivos').addEventListener('change',e=>{
        const arquivos=Array.from(e.target.files);
        for(const arquivo of arquivos) { const erro=validar(arquivo); if(erro) { mensagem(`${arquivo.name}: ${erro}`,true); e.target.value=''; return; } }
        fotos.push(...arquivos.map(file=>({id:crypto.randomUUID(),url:URL.createObjectURL(file),file,legenda:''})));
        e.target.value=''; renderFotos();
    });
    $('#album-fotos').addEventListener('input',e=>{ if(e.target.dataset.legenda!==undefined) fotos[Number(e.target.dataset.legenda)].legenda=e.target.value; });
    function mover(origem,destino) {
        if(ocupado || origem<0 || destino<0 || destino>=fotos.length || origem===destino) return;
        fotos.splice(destino,0,fotos.splice(origem,1)[0]); renderFotos();
    }
    $('#album-fotos').addEventListener('click',e=>{
        const b=e.target.closest('button'); if(!b||ocupado)return;
        if(b.dataset.mover!==undefined) mover(Number(b.dataset.mover),Number(b.dataset.mover)+Number(b.dataset.direcao));
        if(b.dataset.remover!==undefined) { const [f]=fotos.splice(Number(b.dataset.remover),1); if(f.file) URL.revokeObjectURL(f.url); renderFotos(); }
    });
    $('#album-fotos').addEventListener('dragstart',e=>{
        const alca=e.target.closest('[data-arrastar]'); if(!alca||ocupado){e.preventDefault();return;}
        arrastada=Number(alca.dataset.arrastar); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',String(arrastada));
    });
    $('#album-fotos').addEventListener('dragover',e=>{if(arrastada>=0)e.preventDefault();});
    $('#album-fotos').addEventListener('drop',e=>{e.preventDefault();const alvo=e.target.closest('[data-foto]');if(alvo)mover(arrastada,Number(alvo.dataset.foto));arrastada=-1;});
    $('#album-fotos').addEventListener('dragend',()=>{arrastada=-1;});
    $('#album-form').addEventListener('submit',async e=>{
        e.preventDefault(); if(ocupado||!podeEditar())return;
        if(!$('#album-nome').value.trim()){mensagem('Informe o nome do álbum.',true);return;}
        if(!fotos.length){mensagem('Adicione pelo menos uma foto.',true);return;}
        const inicio=$('#album-inicio').value, fim=$('#album-fim').value;
        if(inicio&&fim&&fim<inicio){mensagem('A data final deve ser igual ou posterior à inicial.',true);return;}
        bloquear(true); const enviados=[]; let salvo=false;
        const anterior=albuns.find(a=>a.id===editando);
        try {
            const prontas=[];
            for(let i=0;i<fotos.length;i++) {
                const f=fotos[i];
                if(f.file) {
                    mensagem(`Enviando foto ${i+1} de ${fotos.length}…`);
                    const r=await enviar(await otimizar(f.file));
                    const nova={id:f.id,url:r.url,imagemR2Chave:r.chave,legenda:f.legenda||''};
                    enviados.push(nova); prontas.push(nova);
                } else prontas.push({id:f.id,url:f.url,imagemR2Chave:f.imagemR2Chave||'',legenda:f.legenda||''});
            }
            const item={id:editando||crypto.randomUUID(),nome:$('#album-nome').value.trim(),ativo:$('#album-ativo').checked,
                abertura:$('#album-abertura').checked,tituloAbertura:$('#album-titulo').value.trim(),
                tempoFoto:Number($('#album-tempo').value)||7,layout:$('#album-layout').value,exibirDesde:inicio,exibirAte:fim,
                fotos:prontas,ordem:anterior?.ordem||0,atualizadoEm:new Date().toISOString()};
            await salvar(item.id,item); salvo=true;
            const removidas=(anterior?.fotos||[]).filter(f=>!prontas.some(n=>n.imagemR2Chave===f.imagemR2Chave));
            fechar();
            const pendente=await limparArquivos(removidas);
            mensagem(pendente?'Álbum salvo. Alguns arquivos removidos aguardam limpeza no armazenamento.':'Álbum salvo.');
        } catch(erro) {
            const pendente=!salvo && await limparArquivos(enviados);
            mensagem(`Não foi possível salvar: ${erro.message}${pendente?' Alguns envios aguardam limpeza no armazenamento.':''}`,true);
        } finally {bloquear(false);}
    });
    $('#album-lista').addEventListener('click',async e=>{
        const b=e.target.closest('button');if(!b||ocupado||!podeEditar())return;
        const id=b.dataset.editar||b.dataset.alternar||b.dataset.excluir;
        const a=albuns.find(a=>a.id===id);if(!a)return;
        if(b.dataset.editar){abrir(a);return;}
        if(b.dataset.excluir&&!confirm(`Excluir o álbum “${a.nome}” e suas fotos?`))return;
        bloquear(true);
        try {
            if(b.dataset.excluir){await salvar(id,null);if(editando===id)fechar();const pendente=await limparArquivos(a.fotos||[]);mensagem(pendente?'Álbum excluído. Alguns arquivos aguardam limpeza.':'Álbum excluído.');}
            else {await salvar(id,{...a,ativo:a.ativo===false});mensagem(a.ativo===false?'Álbum ativado.':'Álbum desativado.');}
        }catch(erro){mensagem(erro.message,true);}finally{bloquear(false);}
    });
    renderLista();
    return { carregar(lista){albuns=Array.isArray(lista)?lista:[];renderLista();}, limpar(){if(!ocupado){fechar();albuns=[];renderLista();}} };
};
