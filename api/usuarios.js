const { FieldValue } = require('firebase-admin/firestore');
const {
    obterFirebaseAdmin,
    emailSuperadminInicial
} = require('./_firebase-admin');

const PERMISSOES_VALIDAS = [
    'visao-geral',
    'programacao',
    'eventos',
    'imagens',
    'midias',
    'musicas'
];
const TODAS_PERMISSOES = [...PERMISSOES_VALIDAS, 'usuarios'];

function responder(res, status, dados) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(status).json(dados);
}

function erroHttp(mensagem, status = 400) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

function texto(valor, limite = 160) {
    return String(valor || '').trim().slice(0, limite);
}

function normalizarEmail(valor) {
    return texto(valor, 254).toLowerCase();
}

function normalizarPapel(valor) {
    return valor === 'admin' ? 'admin' : 'usuario';
}

function normalizarPermissoes(valor, papel) {
    if (papel === 'superadmin') return [...TODAS_PERMISSOES];

    const recebidas = Array.isArray(valor) ? valor : [];
    const filtradas = PERMISSOES_VALIDAS.filter(permissao =>
        recebidas.includes(permissao)
    );

    if (!filtradas.includes('visao-geral')) filtradas.unshift('visao-geral');
    return filtradas;
}

function dadosPublicos(documento, usuarioAuth = null) {
    const dados = documento || {};
    return {
        uid: dados.uid || usuarioAuth?.uid || '',
        nome: dados.nome || usuarioAuth?.displayName || '',
        email: dados.email || usuarioAuth?.email || '',
        papel: dados.papel || 'usuario',
        permissoes: normalizarPermissoes(dados.permissoes, dados.papel),
        primeiroAcesso: dados.primeiroAcesso === true,
        ativo: dados.ativo !== false,
        criadoEm: dados.criadoEm?.toDate?.()?.toISOString?.() || null,
        ultimoAcesso: dados.ultimoAcesso?.toDate?.()?.toISOString?.() || null
    };
}

async function autenticarRequisicao(req, authAdmin) {
    const cabecalho = String(req.headers.authorization || '');
    const token = cabecalho.startsWith('Bearer ')
        ? cabecalho.slice(7).trim()
        : '';

    if (!token) throw erroHttp('Sua sessão expirou. Entre novamente.', 401);

    try {
        return await authAdmin.verifyIdToken(token, true);
    } catch {
        throw erroHttp('Sua sessão expirou. Entre novamente.', 401);
    }
}

async function garantirPerfil(decoded, authAdmin, dbAdmin) {
    const referencia = dbAdmin.collection('usuarios').doc(decoded.uid);
    const registro = await referencia.get();
    const email = normalizarEmail(decoded.email);
    const superadminInicial = email && email === emailSuperadminInicial();

    if (superadminInicial) {
        const perfil = {
            uid: decoded.uid,
            nome: registro.data()?.nome || decoded.name || 'Administrador principal',
            email,
            papel: 'superadmin',
            permissoes: [...TODAS_PERMISSOES],
            primeiroAcesso: false,
            ativo: true
        };

        await Promise.all([
            authAdmin.setCustomUserClaims(decoded.uid, {
                papel: perfil.papel,
                permissoes: perfil.permissoes,
                primeiroAcesso: false,
                ativo: true
            }),
            referencia.set({
                ...perfil,
                atualizadoEm: FieldValue.serverTimestamp(),
                ...(!registro.exists ? {
                    criadoEm: FieldValue.serverTimestamp(),
                    criadoPor: 'configuracao-inicial'
                } : {})
            }, { merge: true })
        ]);

        return perfil;
    }

    if (!registro.exists) {
        throw erroHttp(
            'Esta conta ainda não foi cadastrada por um superadministrador.',
            403
        );
    }

    const perfil = dadosPublicos(registro.data());
    if (!perfil.ativo) throw erroHttp('Este usuário está desativado.', 403);
    await sincronizarClaims(authAdmin, decoded.uid, perfil);
    return perfil;
}

function exigirSuperadmin(perfil) {
    if (perfil.papel !== 'superadmin') {
        throw erroHttp('Somente o superadministrador pode gerenciar usuários.', 403);
    }
}

async function sincronizarClaims(authAdmin, uid, perfil) {
    await authAdmin.setCustomUserClaims(uid, {
        papel: perfil.papel,
        permissoes: perfil.permissoes,
        primeiroAcesso: perfil.primeiroAcesso === true,
        ativo: perfil.ativo !== false
    });
}

async function listarUsuarios(authAdmin, dbAdmin) {
    const registros = await dbAdmin.collection('usuarios').orderBy('nome').get();
    const usuarios = registros.docs.map(item => dadosPublicos(item.data()));

    if (!usuarios.length) return [];

    const authPorUid = new Map();
    for (let inicio = 0; inicio < usuarios.length; inicio += 100) {
        const lote = usuarios.slice(inicio, inicio + 100).map(item => ({ uid: item.uid }));
        const resultado = await authAdmin.getUsers(lote);
        resultado.users.forEach(item => authPorUid.set(item.uid, item));
    }

    return usuarios.map(item => ({
        ...item,
        ativo: item.ativo && authPorUid.get(item.uid)?.disabled !== true
    }));
}

async function criarUsuario(corpo, perfilAtual, authAdmin, dbAdmin) {
    exigirSuperadmin(perfilAtual);
    const nome = texto(corpo.nome, 100);
    const email = normalizarEmail(corpo.email);
    const senhaTemporaria = String(corpo.senhaTemporaria || '');
    const papel = normalizarPapel(corpo.papel);
    const permissoes = normalizarPermissoes(corpo.permissoes, papel);

    if (nome.length < 2) throw erroHttp('Informe o nome do usuário.');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw erroHttp('Informe um e-mail válido.');
    if (senhaTemporaria.length < 8) {
        throw erroHttp('A senha temporária precisa ter pelo menos 8 caracteres.');
    }

    let usuarioCriado;
    try {
        usuarioCriado = await authAdmin.createUser({
            email,
            password: senhaTemporaria,
            displayName: nome,
            disabled: false
        });
    } catch (erro) {
        if (erro.code === 'auth/email-already-exists') {
            throw erroHttp('Já existe uma conta com este e-mail.');
        }
        throw erro;
    }

    const perfil = {
        uid: usuarioCriado.uid,
        nome,
        email,
        papel,
        permissoes,
        primeiroAcesso: true,
        ativo: true
    };

    try {
        await Promise.all([
            sincronizarClaims(authAdmin, usuarioCriado.uid, perfil),
            dbAdmin.collection('usuarios').doc(usuarioCriado.uid).set({
                ...perfil,
                criadoEm: FieldValue.serverTimestamp(),
                criadoPor: perfilAtual.uid,
                atualizadoEm: FieldValue.serverTimestamp()
            })
        ]);
    } catch (erro) {
        await authAdmin.deleteUser(usuarioCriado.uid).catch(() => {});
        throw erro;
    }

    return dadosPublicos(perfil);
}

async function atualizarUsuario(corpo, perfilAtual, authAdmin, dbAdmin) {
    exigirSuperadmin(perfilAtual);
    const uid = texto(corpo.uid, 128);
    if (!uid) throw erroHttp('Usuário não informado.');

    const referencia = dbAdmin.collection('usuarios').doc(uid);
    const registro = await referencia.get();
    if (!registro.exists) throw erroHttp('Usuário não encontrado.', 404);

    const atual = dadosPublicos(registro.data());
    if (normalizarEmail(atual.email) === emailSuperadminInicial()) {
        throw erroHttp('A conta proprietária inicial não pode perder seu acesso total.');
    }

    const nome = texto(corpo.nome, 100);
    const papel = normalizarPapel(corpo.papel);
    const permissoes = normalizarPermissoes(corpo.permissoes, papel);
    if (nome.length < 2) throw erroHttp('Informe o nome do usuário.');

    const perfil = {
        ...atual,
        nome,
        papel,
        permissoes
    };

    await Promise.all([
        authAdmin.updateUser(uid, { displayName: nome }),
        sincronizarClaims(authAdmin, uid, perfil),
        referencia.set({
            nome,
            papel,
            permissoes,
            atualizadoEm: FieldValue.serverTimestamp()
        }, { merge: true })
    ]);

    return dadosPublicos(perfil);
}

async function alternarUsuario(corpo, perfilAtual, authAdmin, dbAdmin) {
    exigirSuperadmin(perfilAtual);
    const uid = texto(corpo.uid, 128);
    if (!uid) throw erroHttp('Usuário não informado.');
    if (uid === perfilAtual.uid) throw erroHttp('Você não pode desativar a própria conta.');

    const referencia = dbAdmin.collection('usuarios').doc(uid);
    const registro = await referencia.get();
    if (!registro.exists) throw erroHttp('Usuário não encontrado.', 404);
    const atual = dadosPublicos(registro.data());
    if (normalizarEmail(atual.email) === emailSuperadminInicial()) {
        throw erroHttp('A conta proprietária inicial não pode ser desativada.');
    }

    const ativo = corpo.ativo === true;
    const perfil = { ...atual, ativo };
    await Promise.all([
        authAdmin.updateUser(uid, { disabled: !ativo }),
        sincronizarClaims(authAdmin, uid, perfil),
        referencia.set({
            ativo,
            atualizadoEm: FieldValue.serverTimestamp()
        }, { merge: true })
    ]);
    if (!ativo) await authAdmin.revokeRefreshTokens(uid);
    return dadosPublicos(perfil);
}

async function redefinirSenha(corpo, perfilAtual, authAdmin, dbAdmin) {
    exigirSuperadmin(perfilAtual);
    const uid = texto(corpo.uid, 128);
    const senhaTemporaria = String(corpo.senhaTemporaria || '');
    if (!uid) throw erroHttp('Usuário não informado.');
    if (uid === perfilAtual.uid) {
        throw erroHttp('Use a recuperação de senha do login para alterar sua própria senha.');
    }
    if (senhaTemporaria.length < 8) {
        throw erroHttp('A senha temporária precisa ter pelo menos 8 caracteres.');
    }

    const referencia = dbAdmin.collection('usuarios').doc(uid);
    const registro = await referencia.get();
    if (!registro.exists) throw erroHttp('Usuário não encontrado.', 404);
    const atual = dadosPublicos(registro.data());
    const perfil = { ...atual, primeiroAcesso: true, ativo: true };

    await Promise.all([
        authAdmin.updateUser(uid, { password: senhaTemporaria, disabled: false }),
        sincronizarClaims(authAdmin, uid, perfil),
        referencia.set({
            primeiroAcesso: true,
            ativo: true,
            senhaRedefinidaEm: FieldValue.serverTimestamp(),
            atualizadoEm: FieldValue.serverTimestamp()
        }, { merge: true })
    ]);
    await authAdmin.revokeRefreshTokens(uid);
    return { sucesso: true };
}

async function concluirPrimeiroAcesso(decoded, perfil, authAdmin, dbAdmin) {
    if (!perfil.primeiroAcesso) return dadosPublicos(perfil);
    const atualizado = { ...perfil, primeiroAcesso: false, ativo: true };
    await Promise.all([
        sincronizarClaims(authAdmin, decoded.uid, atualizado),
        dbAdmin.collection('usuarios').doc(decoded.uid).set({
            primeiroAcesso: false,
            primeiroAcessoConcluidoEm: FieldValue.serverTimestamp(),
            ultimoAcesso: FieldValue.serverTimestamp(),
            atualizadoEm: FieldValue.serverTimestamp()
        }, { merge: true })
    ]);
    return dadosPublicos(atualizado);
}

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Allow', 'POST, OPTIONS');
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        responder(res, 405, { erro: 'Método não permitido.' });
        return;
    }

    try {
        const { authAdmin, dbAdmin } = obterFirebaseAdmin();
        const decoded = await autenticarRequisicao(req, authAdmin);
        const perfilAtual = await garantirPerfil(decoded, authAdmin, dbAdmin);
        const corpo = req.body && typeof req.body === 'object' ? req.body : {};
        const acao = corpo.acao || 'me';

        if (acao === 'me') {
            await dbAdmin.collection('usuarios').doc(decoded.uid).set({
                ultimoAcesso: FieldValue.serverTimestamp()
            }, { merge: true });
            responder(res, 200, { usuario: dadosPublicos(perfilAtual) });
            return;
        }

        if (acao === 'concluir-primeiro-acesso') {
            const usuario = await concluirPrimeiroAcesso(
                decoded,
                perfilAtual,
                authAdmin,
                dbAdmin
            );
            responder(res, 200, { usuario });
            return;
        }

        exigirSuperadmin(perfilAtual);

        if (acao === 'listar') {
            responder(res, 200, { usuarios: await listarUsuarios(authAdmin, dbAdmin) });
            return;
        }

        if (acao === 'criar') {
            responder(res, 201, {
                usuario: await criarUsuario(corpo, perfilAtual, authAdmin, dbAdmin)
            });
            return;
        }

        if (acao === 'atualizar') {
            responder(res, 200, {
                usuario: await atualizarUsuario(corpo, perfilAtual, authAdmin, dbAdmin)
            });
            return;
        }

        if (acao === 'alternar') {
            responder(res, 200, {
                usuario: await alternarUsuario(corpo, perfilAtual, authAdmin, dbAdmin)
            });
            return;
        }

        if (acao === 'redefinir-senha') {
            responder(res, 200, {
                resultado: await redefinirSenha(
                    corpo,
                    perfilAtual,
                    authAdmin,
                    dbAdmin
                )
            });
            return;
        }

        responder(res, 400, { erro: 'Ação inválida.' });
    } catch (erro) {
        console.error('Erro no gerenciamento de usuários:', erro);
        responder(res, erro.status || 500, {
            erro: erro.message || 'Não foi possível concluir a operação.'
        });
    }
};
