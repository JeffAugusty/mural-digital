const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');

function api({ usuario = { permissoes: ['imagens'] }, objeto = { ContentLength: 100, ContentType: 'image/webp' }, semConfig = false } = {}) {
    const chamadas = [];
    class PutObjectCommand { constructor(input) { this.input = input; } }
    class HeadObjectCommand { constructor(input) { this.input = input; } }
    class DeleteObjectCommand { constructor(input) { this.input = input; } }
    class S3Client { async send(command) { chamadas.push(command); return objeto; } }
    const contexto = vm.createContext({
        module: { exports: {} }, console: { error() {} },
        process: { env: semConfig ? {} : {
            R2_ENDPOINT: 'https://example.r2.cloudflarestorage.com', R2_ACCESS_KEY_ID: 'test',
            R2_SECRET_ACCESS_KEY: 'test', R2_BUCKET_NAME: 'bucket-videos', R2_PUBLIC_URL: 'https://example.r2.dev'
        } },
        require(nome) {
            if (nome === 'node:crypto') return require(nome);
            if (nome === '@aws-sdk/client-s3') return { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand };
            if (nome === '@aws-sdk/s3-request-presigner') return { getSignedUrl: async (_, command) => { chamadas.push(command); return 'https://upload.test'; } };
            if (nome === './_firebase-admin') return { obterFirebaseAdmin: () => ({ authAdmin: { verifyIdToken: async (_, revoked) => { assert.equal(revoked, true); return usuario; } } }) };
            throw Error(nome);
        }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'api/r2-imagens.js'), 'utf8'), contexto);
    return { chamadas, async chamar(body, token = 'test', method = 'POST') {
        const res = { statusCode: 0, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; }, end() {} };
        await contexto.module.exports({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
        return res;
    } };
}
const pedido = { acao: 'solicitar-upload', tipo: 'image/webp', tamanho: 100, nomeArquivo: 'Comunicado.webp' };

test('upload usa o mesmo bucket dos vídeos e a pasta imagens, aceitando JPG/PNG/WebP', async () => {
    for (const tipo of ['image/jpeg', 'image/png', 'image/webp']) {
        const a = api(); const res = await a.chamar({ ...pedido, tipo });
        assert.equal(res.statusCode, 200);
        assert.match(res.body.chave, /^imagens\//);
        assert.equal(a.chamadas[0].input.Bucket, 'bucket-videos');
        assert.equal(a.chamadas[0].input.ContentLength, 100);
        assert.equal(res.body.urlPublica, `https://example.r2.dev/${res.body.chave}`);
    }
});
test('exige sessão, permissão imagens e troca de senha concluída', async () => {
    assert.equal((await api().chamar(pedido, '')).statusCode, 401);
    for (const usuario of [{ permissoes: ['midias'] }, { permissoes: ['imagens'], ativo: false }, { permissoes: ['imagens'], primeiroAcesso: true }]) {
        const a = api({ usuario }); assert.equal((await a.chamar(pedido)).statusCode, 403); assert.equal(a.chamadas.length, 0);
    }
    assert.equal((await api({ usuario: { papel: 'superadmin' } }).chamar(pedido)).statusCode, 200);
});
test('rejeita arquivos não suportados, tamanho inválido e configuração ausente', async () => {
    for (const ajuste of [{ tipo: 'video/mp4' }, { tipo: 'image/svg+xml' }, { tamanho: 0 }, { tamanho: 8 * 1024 * 1024 + 1 }, { tamanho: 1.5 }]) {
        const a = api(); assert.equal((await a.chamar({ ...pedido, ...ajuste })).statusCode, 400); assert.equal(a.chamadas.length, 0);
    }
    assert.equal((await api({ semConfig: true }).chamar(pedido)).statusCode, 503);
});
test('não permite confirmar ou excluir vídeos nem caminhos externos', async () => {
    for (const acao of ['confirmar-upload', 'excluir-upload']) for (const chave of ['videos/arquivo.mp4', 'imagens/../videos/arquivo.mp4', '/imagens/a.webp', 'imagens/%2e%2e/a']) {
        const a = api(); assert.equal((await a.chamar({ acao, chave })).statusCode, 400); assert.equal(a.chamadas.length, 0);
    }
});
test('confirma URL pública somente após verificar tipo e tamanho no R2', async () => {
    const a = api(); const res = await a.chamar({ acao: 'confirmar-upload', chave: 'imagens/a.webp' });
    assert.equal(res.statusCode, 200); assert.equal(res.body.url, 'https://example.r2.dev/imagens/a.webp');
    for (const objeto of [{ ContentLength: 0, ContentType: 'image/webp' }, { ContentLength: 100, ContentType: 'video/mp4' }, { ContentLength: 9 * 1024 * 1024, ContentType: 'image/png' }]) {
        const b = api({ objeto }); assert.equal((await b.chamar({ acao: 'confirmar-upload', chave: 'imagens/a.webp' })).statusCode, 400);
        assert.equal(b.chamadas[1].constructor.name, 'DeleteObjectCommand');
    }
});

function cliente({ anterior, arquivo = true, falhaSalvar = false, falhaUpload = false, falhaConfirmar = false } = {}) {
    const chamadas = []; let salvo; let submit;
    const entradas = new Map();
    const valores = { 'imagem-id': anterior?.id || '', 'imagem-nome': 'Comunicado', 'imagem-duracao': '15', 'imagem-ordem': '0' };
    const file = { name: 'arte.webp', type: 'image/webp', size: 100 };
    const contexto = vm.createContext({
        AbortController, console: { warn() {} }, window: { setTimeout, clearTimeout },
        auth: { currentUser: { getIdToken: async () => 'token' } },
        imagens: anterior ? [anterior] : [],
        $(selector) { if (!entradas.has(selector)) entradas.set(selector, { value: valores[selector.slice(1)] || '', files: arquivo ? [file] : [], checked: true }); return entradas.get(selector); },
        imagemForm: { addEventListener(_, fn) { submit = fn; } },
        esconderMensagem() {}, mostrarMensagem(_, mensagem) { chamadas.push(['mensagem', mensagem]); },
        validarArquivoImagem() { return ''; }, criarIdImagem() { return 'nova'; },
        otimizarImagemParaTv: async a => a, limparFormularioImagem() {},
        async salvarListaImagens(lista) { chamadas.push(['salvar']); if (falhaSalvar) throw Error('Firestore indisponível'); salvo = lista; },
        async excluirArquivoDato(id) { chamadas.push(['dato-excluir', id]); },
        async fetch(url, options) {
            if (options.method === 'PUT') { chamadas.push(['put', url]); return { ok: !falhaUpload, status: falhaUpload ? 500 : 200 }; }
            const body = JSON.parse(options.body); chamadas.push([body.acao, url, body.chave]);
            assert.equal(options.headers.Authorization, 'Bearer token');
            const data = body.acao === 'solicitar-upload' ? { chave: 'imagens/nova.webp', urlUpload: 'https://upload.test' } : { chave: 'imagens/nova.webp', url: 'https://example.r2.dev/imagens/nova.webp' };
            return { ok: !(falhaConfirmar && body.acao === 'confirmar-upload'), status: 500, json: async () => data };
        }
    });
    const transport = html.slice(html.indexOf('        async function chamarApiR2('), html.indexOf('        async function enviarVideoParaR2('));
    const helpers = html.slice(html.indexOf('        async function chamarApiImagensR2('), html.indexOf('        async function excluirArquivoDato('));
    const form = html.slice(html.indexOf("        imagemForm.addEventListener('submit'"), html.indexOf("        midiaForm.addEventListener('submit'"));
    vm.runInContext(transport + helpers + form, contexto);
    return { chamadas, contexto, get salvo() { return salvo; }, enviar: () => submit({ preventDefault() {} }) };
}
test('cadastro salva a URL R2 no mesmo formato usado pela TV sem chamar Dato', async () => {
    const c = cliente(); await c.enviar();
    assert.equal(c.salvo[0].provedor, 'r2'); assert.equal(c.salvo[0].url, 'https://example.r2.dev/imagens/nova.webp');
    assert.equal(c.salvo[0].imagemR2Chave, 'imagens/nova.webp'); assert.equal(c.salvo[0].datoId, '');
    assert.ok(c.chamadas.some(x => x[0] === 'solicitar-upload' && x[1] === '/api/r2-imagens'));
    assert.ok(!c.chamadas.some(x => x[0].includes('excluir')));
});
test('editar metadados preserva imagens antigas e R2 sem reenviar o arquivo', async () => {
    for (const anterior of [{ id: 'old', url: 'https://dato.test/a.webp', datoId: 'old-dato', provedor: 'datocms' }, { id: 'old', url: 'https://example.r2.dev/imagens/old.webp', imagemR2Chave: 'imagens/old.webp', provedor: 'r2' }]) {
        const c = cliente({ anterior, arquivo: false }); await c.enviar();
        assert.equal(c.salvo[0].url, anterior.url); assert.equal(c.salvo[0].provedor, anterior.provedor);
        assert.ok(!c.chamadas.some(x => x[0] === 'solicitar-upload' || x[0].includes('excluir')));
    }
});
test('substituir só remove a imagem antiga depois que o cadastro foi salvo', async () => {
    for (const anterior of [{ id: 'old', url: 'https://dato.test/a.webp', datoId: 'old-dato' }, { id: 'old', imagemR2Chave: 'imagens/old.webp', url: 'https://example.r2.dev/imagens/old.webp' }]) {
        const c = cliente({ anterior }); await c.enviar();
        assert.equal(c.salvo[0].id, 'old');
        assert.ok(c.chamadas.findIndex(x => x[0].includes('excluir')) > c.chamadas.findIndex(x => x[0] === 'salvar'));
    }
});
test('falha ao salvar remove só o novo envio e preserva a imagem antiga', async () => {
    const c = cliente({ anterior: { id: 'old', datoId: 'old-dato', url: 'https://dato.test/a.webp' }, falhaSalvar: true }); await c.enviar();
    assert.equal(c.salvo, undefined); assert.ok(c.chamadas.some(x => x[0] === 'excluir-upload' && x[2] === 'imagens/nova.webp'));
    assert.ok(!c.chamadas.some(x => x[0] === 'dato-excluir'));
});
test('falha no PUT ou na confirmação não grava cadastro nem deixa envio sem limpeza', async () => {
    for (const opcoes of [{ falhaUpload: true }, { falhaConfirmar: true }]) {
        const c = cliente(opcoes); await c.enviar(); assert.equal(c.salvo, undefined);
        assert.ok(c.chamadas.some(x => x[0] === 'excluir-upload'));
    }
});
test('transporte dos vídeos continua usando a rota original', async () => {
    const c = cliente(); await vm.runInContext("chamarApiR2({ acao: 'solicitar-upload' })", c.contexto);
    assert.equal(c.chamadas[0][1], '/api/r2-videos');
});
