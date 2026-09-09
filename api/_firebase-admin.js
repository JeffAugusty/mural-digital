const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const EMAIL_SUPERADMIN_INICIAL = 'jefersona555@gmail.com';

function lerCredencial() {
    const valor = String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();

    if (!valor) {
        const erro = new Error(
            'O gerenciamento de usuários ainda não foi configurado no servidor. ' +
            'Adicione FIREBASE_SERVICE_ACCOUNT nas variáveis da Vercel.'
        );
        erro.status = 503;
        throw erro;
    }

    try {
        const json = valor.startsWith('{')
            ? valor
            : Buffer.from(valor, 'base64').toString('utf8');
        const credencial = JSON.parse(json);

        if (credencial.private_key) {
            credencial.private_key = credencial.private_key.replace(/\\n/g, '\n');
        }

        return credencial;
    } catch {
        const erro = new Error(
            'A variável FIREBASE_SERVICE_ACCOUNT da Vercel não contém um JSON válido.'
        );
        erro.status = 503;
        throw erro;
    }
}

function obterFirebaseAdmin() {
    if (!getApps().length) {
        initializeApp({ credential: cert(lerCredencial()) });
    }

    return {
        authAdmin: getAuth(),
        dbAdmin: getFirestore()
    };
}

function emailSuperadminInicial() {
    return String(
        process.env.SUPERADMIN_EMAIL || EMAIL_SUPERADMIN_INICIAL
    ).trim().toLowerCase();
}

module.exports = {
    obterFirebaseAdmin,
    emailSuperadminInicial
};
