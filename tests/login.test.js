const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const fonte = fs.readFileSync(path.join(__dirname, '../api/usuarios.js'), 'utf8');
const permissoes = ['visao-geral', 'programacao', 'eventos', 'imagens', 'midias', 'musicas', 'usuarios'];
function ambiente({ owner = false, missing = false, stale = false, disabled = false, revoked = false, first = false } = {}) {
    const perfil = { uid: 'u1', nome: 'Teste', email: owner ? 'owner@example.com' : 'aluno@example.com',
        papel: owner ? 'superadmin' : 'usuario', permissoes: owner ? permissoes : ['visao-geral', 'eventos'],
        primeiroAcesso: first, ativo: !disabled };
    const decoded = { ...perfil, permissoes: [...perfil.permissoes] };
    if (stale) { decoded.permissoes = ['usuarios']; delete decoded.ativo; }
    const writes = [], claims = [], verifications = [];
    const authAdmin = {
        async verifyIdToken(token, checkRevoked) { verifications.push(checkRevoked); if (revoked) throw Error('revoked'); return decoded; },
        async setCustomUserClaims(uid, data) { claims.push({uid, data}); }
    };
    const dbAdmin = { collection() { return { doc() { return {
        async get() { return { exists: !missing, data: () => missing ? undefined : perfil }; },
        async set(data, options) { writes.push({data, options}); }
    }; } }; } };
    const context = { module: {exports: {}}, console: {error(){}}, require(name) {
        if (name === 'firebase-admin/firestore') return { FieldValue: {serverTimestamp: () => 'timestamp'} };
        if (name === './_firebase-admin') return {obterFirebaseAdmin: () => ({authAdmin, dbAdmin}), emailSuperadminInicial: () => 'owner@example.com'};
        throw Error(name);
    }};
    vm.runInNewContext(fonte, context);
    const res = { setHeader(){}, status(code){this.code=code;return this;}, json(data){this.data=data;} };
    return { writes, claims, verifications, res, async login() {
        await context.module.exports({method:'POST',headers:{authorization:'Bearer test'},body:{acao:'me'}},res);
    }};
}
for (const owner of [false, true]) test(`login ${owner ? 'administrador' : 'usuário'} sem alterações evita regravar claims e perfil`, async () => {
    const a = ambiente({owner}); await a.login();
    assert.equal(a.res.code,200); assert.equal(a.res.data.renovarToken,false);
    assert.equal(a.claims.length,0); assert.equal(a.writes.length,1);
    assert.deepEqual(Object.keys(a.writes[0].data), ['ultimoAcesso']);
    assert.deepEqual(a.verifications,[true]);
});
test('claims ausentes ou antigos são substituídos pelas permissões do banco',async()=>{
    const a=ambiente({stale:true});await a.login();
    assert.equal(a.res.code,200);assert.equal(a.res.data.renovarToken,true);
    assert.equal(a.claims.length,1);
    assert.deepEqual(Array.from(a.claims[0].data.permissoes),['visao-geral','eventos']);
});
for(const options of [{disabled:true},{missing:true},{revoked:true}]) test(`acesso recusado: ${JSON.stringify(options)}`,async()=>{
    const a=ambiente(options);await a.login();
    assert.equal(a.res.code,options.revoked?401:403);assert.equal(a.writes.length,0);assert.equal(a.claims.length,0);
});
test('primeiro acesso continua obrigatório',async()=>{
    const a=ambiente({first:true});await a.login();assert.equal(a.res.data.usuario.primeiroAcesso,true);
});
test('cadastro inicial do administrador preservado em uma escrita',async()=>{
    const a=ambiente({owner:true,missing:true,stale:true});await a.login();
    assert.equal(a.res.code,200);assert.equal(a.writes.length,1);assert.equal(a.claims.length,1);
    assert.equal(a.writes[0].data.criadoPor,'configuracao-inicial');assert.equal(a.writes[0].data.ultimoAcesso,'timestamp');
});
