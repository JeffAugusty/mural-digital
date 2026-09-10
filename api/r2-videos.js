const crypto = require('node:crypto');
const {
    S3Client,
    PutObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { obterFirebaseAdmin } = require('./_firebase-admin');

const TIPOS_PERMITIDOS = new Set(['video/mp4', 'video/webm']);
const TAMANHO_MAXIMO = 500 * 1024 * 1024;
let clienteR2;

function responder(res, status, dados) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(dados);
}

function obterConfiguracaoR2() {
    const configuracao = {
        endpoint: String(process.env.R2_ENDPOINT || '').replace(/\/$/, ''),
        accessKeyId: String(process.env.R2_ACCESS_KEY_ID || ''),
        secretAccessKey: String(process.env.R2_SECRET_ACCESS_KEY || ''),
        bucket: String(process.env.R2_BUCKET_NAME || ''),
        publicUrl: String(process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
    };

    const ausentes = Object.entries(configuracao)
        .filter(([, valor]) => !valor)
        .map(([chave]) => chave);

    if (ausentes.length) {
        const erro = new Error('A configuração do armazenamento de vídeos está incompleta na Vercel.');
        erro.status = 503;
        throw erro;
    }

    return configuracao;
}

function obterClienteR2(configuracao) {
    if (!clienteR2) {
        clienteR2 = new S3Client({
            region: 'auto',
            endpoint: configuracao.endpoint,
            credentials: {
                accessKeyId: configuracao.accessKeyId,
                secretAccessKey: configuracao.secretAccessKey
            }
        });
    }

    return clienteR2;
}

async function validarAdministrador(req) {
    const cabecalho = String(req.headers.authorization || '');
    const token = cabecalho.startsWith('Bearer ')
        ? cabecalho.slice(7).trim()
        : '';

    if (!token) {
        const erro = new Error('Sua sessão expirou. Entre novamente no painel.');
        erro.status = 401;
        throw erro;
    }

    let usuario;
    try {
        usuario = await obterFirebaseAdmin().authAdmin.verifyIdToken(token, true);
    } catch {
        const erro = new Error('Sua sessão expirou. Entre novamente no painel.');
        erro.status = 401;
        throw erro;
    }

    if (usuario.ativo === false) {
        const erro = new Error('Este usuário está desativado.');
        erro.status = 403;
        throw erro;
    }

    if (usuario.primeiroAcesso === true) {
        const erro = new Error('Defina sua nova senha antes de enviar arquivos.');
        erro.status = 403;
        throw erro;
    }

    const administrador = usuario.papel === 'superadmin';
    const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
    if (!administrador && !permissoes.includes('midias')) {
        const erro = new Error('Seu usuário não tem permissão para enviar vídeos.');
        erro.status = 403;
        throw erro;
    }

    return usuario;
}

function nomeSeguro(nome) {
    return String(nome || 'video.mp4')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120) || 'video.mp4';
}

function chaveSegura(valor) {
    const chave = String(valor || '');
    return /^videos\/[a-zA-Z0-9._/-]{1,240}$/.test(chave) && !chave.includes('..')
        ? chave
        : '';
}

function urlPublica(configuracao, chave) {
    const caminho = chave.split('/').map(encodeURIComponent).join('/');
    return `${configuracao.publicUrl}/${caminho}`;
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
        await validarAdministrador(req);
        const configuracao = obterConfiguracaoR2();
        const r2 = obterClienteR2(configuracao);
        const corpo = req.body && typeof req.body === 'object' ? req.body : {};

        if (corpo.acao === 'solicitar-upload') {
            const tipo = String(corpo.tipo || '');
            const tamanho = Number(corpo.tamanho || 0);

            if (!TIPOS_PERMITIDOS.has(tipo)) {
                responder(res, 400, { erro: 'Utilize um vídeo MP4 ou WebM.' });
                return;
            }

            if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > TAMANHO_MAXIMO) {
                responder(res, 400, { erro: 'O vídeo deve ter no máximo 500 MB.' });
                return;
            }

            const arquivo = nomeSeguro(corpo.nomeArquivo);
            const chave = `videos/${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${arquivo}`;
            const comando = new PutObjectCommand({
                Bucket: configuracao.bucket,
                Key: chave,
                ContentType: tipo
            });
            const urlUpload = await getSignedUrl(r2, comando, { expiresIn: 900 });

            responder(res, 200, {
                chave,
                urlUpload,
                urlPublica: urlPublica(configuracao, chave)
            });
            return;
        }

        if (corpo.acao === 'confirmar-upload') {
            const chave = chaveSegura(corpo.chave);
            if (!chave) {
                responder(res, 400, { erro: 'Identificador do vídeo inválido.' });
                return;
            }

            const objeto = await r2.send(new HeadObjectCommand({
                Bucket: configuracao.bucket,
                Key: chave
            }));
            const tamanho = Number(objeto.ContentLength || 0);
            const tipo = String(objeto.ContentType || '').split(';')[0];

            if (!TIPOS_PERMITIDOS.has(tipo) || tamanho <= 0 || tamanho > TAMANHO_MAXIMO) {
                await r2.send(new DeleteObjectCommand({
                    Bucket: configuracao.bucket,
                    Key: chave
                }));
                responder(res, 400, { erro: 'O arquivo enviado não é um vídeo válido de até 500 MB.' });
                return;
            }

            responder(res, 200, {
                chave,
                url: urlPublica(configuracao, chave),
                tamanho,
                tipo
            });
            return;
        }

        if (corpo.acao === 'excluir-upload') {
            const chave = chaveSegura(corpo.chave);
            if (!chave) {
                responder(res, 400, { erro: 'Identificador do vídeo inválido.' });
                return;
            }

            await r2.send(new DeleteObjectCommand({
                Bucket: configuracao.bucket,
                Key: chave
            }));
            responder(res, 200, { excluido: true });
            return;
        }

        responder(res, 400, { erro: 'Operação de vídeo inválida.' });
    } catch (erro) {
        console.error('Falha na API de vídeos do R2:', erro);
        responder(res, erro.status || 500, {
            erro: erro.status
                ? erro.message
                : 'Não foi possível acessar o armazenamento de vídeos.'
        });
    }
};
