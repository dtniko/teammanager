const webpush = require('web-push');
const { query } = require('../config/database');

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Invia una push a tutte le subscription di un utente.
// Isola i fallimenti per singola subscription (Promise.allSettled): un
// endpoint scaduto/revocato non deve impedire l'invio agli altri device.
async function sendPushToUser(userId, payload) {
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
