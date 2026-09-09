const DATO_API = 'https://site-api.datocms.com';
const { obterFirebaseAdmin } = require('./_firebase-admin');
const TIPOS_PERMITIDOS = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'video/mp4',
    'video/webm'
]);

function responder(res, status, dados) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(dados);
}

function mensagemDoDato(dados, alternativa) {
    const erros = Array.isArray(dados && dados.data)
        ? dados.data
        : [];
    const primeiro = erros.find(item => item && item.type === 'api_error');
    return primeiro?.attributes?.details?.message ||
        primeiro?.attributes?.message ||
        dados?.error ||
        alternativa;
}

async function validarAdministrador(req, permissoesAceitas = []) {
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

    const superadmin = usuario.papel === 'superadmin';
    const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
    const autorizado = !permissoesAceitas.length ||
        superadmin ||
        permissoesAceitas.some(permissao => permissoes.includes(permissao));

    if (!autorizado) {
        const erro = new Error('Seu usuário não tem permissão para enviar este conteúdo.');
        erro.status = 403;
        throw erro;
    }

    return usuario;
}

function permissoesDaOperacao(corpo) {
    if (corpo.acao === 'solicitar-upload') {
        const tipo = String(corpo.tipo || '');
        if (tipo.startsWith('audio/')) return ['musicas'];
        if (tipo.startsWith('video/')) return ['midias'];
        return ['imagens', 'musicas'];
    }

    if (corpo.acao === 'finalizar-upload') {
        if (corpo.categoria === 'audio') return ['musicas'];
        if (corpo.categoria === 'video') return ['midias'];
        return ['imagens', 'musicas'];
    }

    return ['imagens', 'midias', 'musicas'];
}

async function chamarDato(caminho, opcoes = {}) {
    const token = process.env.DATOCMS_API_TOKEN;

    if (!token) {
        const erro = new Error('A variável DATOCMS_API_TOKEN não foi encontrada no Vercel.');
        erro.status = 503;
        throw erro;
    }

    const resposta = await fetch(`${DATO_API}${caminho}`, {
        ...opcoes,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'X-Api-Version': '3',
            ...(opcoes.body ? { 'Content-Type': 'application/vnd.api+json' } : {}),
            ...(opcoes.headers || {})
        }
    });

    const dados = await resposta.json().catch(() => ({}));
    return { resposta, dados };
}

function nomeSeguro(nome) {
    return String(nome || 'arquivo')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100) || 'arquivo';
}

function idSeguro(valor) {
    const id = String(valor || '');
    return /^[a-zA-Z0-9_-]{1,160}$/.test(id) ? id : '';
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
        const corpo = req.body && typeof req.body === 'object' ? req.body : {};
        const usuario = await validarAdministrador(req, permissoesDaOperacao(corpo));
        const acao = corpo.acao;

        if (acao === 'solicitar-upload') {
            const tipo = String(corpo.tipo || '');
            if (!TIPOS_PERMITIDOS.has(tipo)) {
                responder(res, 400, { erro: 'Formato de arquivo não permitido.' });
                return;
            }

            const arquivo = nomeSeguro(corpo.nomeArquivo);
            const { resposta, dados } = await chamarDato('/upload-requests', {
                method: 'POST',
                body: JSON.stringify({
                    data: {
                        type: 'upload_request',
                        attributes: { filename: arquivo }
                    }
                })
            });

            if (!resposta.ok) {
                responder(res, resposta.status, {
                    erro: mensagemDoDato(dados, 'O DatoCMS recusou a preparação do upload.')
                });
                return;
            }

            responder(res, 200, {
                caminho: dados.data.id,
                urlUpload: dados.data.attributes.url,
                headers: dados.data.attributes.request_headers || {}
            });
            return;
        }

        if (acao === 'finalizar-upload') {
            const caminho = String(corpo.caminho || '');
            const nome = String(corpo.nome || 'Arquivo do mural').trim().slice(0, 100);
            const categoria = ['audio', 'video'].includes(corpo.categoria)
                ? corpo.categoria
                : 'imagem';

            if (!caminho.startsWith('/') || caminho.length > 500) {
                responder(res, 400, { erro: 'Caminho temporário inválido.' });
                return;
            }

            const { resposta, dados } = await chamarDato('/uploads', {
                method: 'POST',
                body: JSON.stringify({
                    data: {
                        type: 'upload',
                        attributes: {
                            path: caminho,
                            author: usuario.email || 'Administrador do mural',
                            notes: `${categoria === 'audio' ? 'Áudio' : categoria === 'video' ? 'Vídeo' : 'Imagem'} do mural: ${nome}`,
                            tags: ['mural-digital', categoria]
                        }
                    }
                })
            });

            if (!resposta.ok) {
                responder(res, resposta.status, {
                    erro: mensagemDoDato(dados, 'O DatoCMS não conseguiu processar o arquivo.')
                });
                return;
            }

            responder(res, 200, { jobId: dados.data.id });
            return;
        }

        if (acao === 'consultar-upload') {
            const jobId = idSeguro(corpo.jobId);
            if (!jobId) {
                responder(res, 400, { erro: 'Identificador do processamento inválido.' });
                return;
            }

            const { resposta, dados } = await chamarDato(`/job-results/${encodeURIComponent(jobId)}`);

            if (resposta.status === 404) {
                responder(res, 200, { processando: true });
                return;
            }

            if (!resposta.ok) {
                const payloadErro = dados?.data?.attributes?.payload;
                responder(res, resposta.status, {
                    erro: mensagemDoDato(
                        payloadErro,
                        'O DatoCMS não conseguiu concluir o processamento do arquivo.'
                    )
                });
                return;
            }

            const upload = dados?.data?.attributes?.payload?.data;
            const atributos = upload?.attributes || {};

            if (!upload?.id || !atributos.url) {
                responder(res, 502, { erro: 'O DatoCMS concluiu o envio sem retornar o arquivo.' });
                return;
            }

            responder(res, 200, {
                processando: false,
                arquivo: {
                    id: upload.id,
                    caminho: atributos.path || '',
                    url: atributos.url,
                    tamanho: atributos.size || 0,
                    largura: atributos.width || 0,
                    altura: atributos.height || 0
                }
            });
            return;
        }

        if (acao === 'excluir-upload') {
            const uploadId = idSeguro(corpo.uploadId);
            if (!uploadId) {
                responder(res, 400, { erro: 'Identificador do arquivo inválido.' });
                return;
            }

            const { resposta, dados } = await chamarDato(`/uploads/${encodeURIComponent(uploadId)}`, {
                method: 'DELETE'
            });

            if (!resposta.ok && resposta.status !== 404) {
                responder(res, resposta.status, {
                    erro: mensagemDoDato(dados, 'Não foi possível excluir o arquivo do DatoCMS.')
                });
                return;
            }

            responder(res, 200, { sucesso: true });
            return;
        }

        responder(res, 400, { erro: 'Ação inválida.' });
    } catch (erro) {
        console.error('Erro na integração com o DatoCMS:', erro);
        responder(res, erro.status || 500, {
            erro: erro.message || 'Erro interno ao acessar o DatoCMS.'
        });
    }
};
