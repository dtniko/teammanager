const webpush = require('web-push');
const { query } = require('../config/database');

// Configura le VAPID solo se presente la chiave pubblica: web-push
// lancia un errore a load-time se una di subject/publicKey/privateKey
// e' vuota, e non vogliamo che un'opzione manchi fermi l'intero server.
// Se non sono configurate, le push restano disabilitate (coerente con
// il frontend, che gia' gestisce l'assenza della public key con un warning).
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@localhost',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    console.warn('⚠️ Chiavi VAPID non configurate: push notification disabilitate');
}

// Invia una push a tutte le subscription di un utente.
// Isola i fallimenti per singola subscription (Promise.allSettled): un
// endpoint scaduto/revocato non deve impedire l'invio agli altri device.
const vapidConfigured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

async function sendPushToUser(userId, payload) {
    if (!vapidConfigured) {
        return;
    }
    try {
        const subscriptionsResult = await query(
            'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
            [userId]
        );

        if (subscriptionsResult.rows.length === 0) {
            return;
        }

        const results = await Promise.allSettled(
            subscriptionsResult.rows.map((sub) =>
                webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth }
                    },
                    JSON.stringify(payload)
                )
            )
        );

        await Promise.all(
            results.map(async (result, index) => {
                if (result.status !== 'rejected') {
                    return;
                }

                const statusCode = result.reason?.statusCode;
                if (statusCode === 404 || statusCode === 410) {
                    const endpoint = subscriptionsResult.rows[index].endpoint;
                    await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
                } else {
                    console.error('Errore nell\'invio della push notification:', result.reason);
                }
            })
        );
    } catch (error) {
        console.error(`Errore nell'invio push all'utente ${userId}:`, error);
    }
}

async function sendPushToUsers(userIds, payload) {
    await Promise.allSettled(userIds.map((userId) => sendPushToUser(userId, payload)));
}

module.exports = { sendPushToUser, sendPushToUsers };
