const express = require('express');
const { query, getClient } = require('../config/database');
const { sendPushToUser, sendPushToUsers } = require('../services/webPush');

const router = express.Router();

// Ottieni notifiche per l'utente corrente
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            unreadOnly = 'false',
            type = '',
            includeResolved = 'false'
        } = req.query;

        const offset = (page - 1) * limit;

        let whereConditions = ['n.user_id = $1'];
        let queryParams = [req.user.id];
        let paramIndex = 2;

        // Filtro solo non lette
        if (unreadOnly === 'true') {
            whereConditions.push('n.is_read = false');
        }

        // Filtro per tipo
        if (type) {
            whereConditions.push(`n.type = $${paramIndex}`);
            queryParams.push(type);
            paramIndex++;
        }

        // Vista di default: nasconde le notifiche già lette e le richieste di
        // collegamento profilo già evase (approvate/rifiutate). "Mostra tutte"
        // (includeResolved=true) toglie entrambi i filtri e mostra anche lo storico.
        if (includeResolved !== 'true') {
            whereConditions.push('n.is_read = false');
            whereConditions.push("(n.related_type != 'profile_link_request' OR plr.status = 'pending')");
        }

        const whereClause = whereConditions.join(' AND ');
        const joinClause = "LEFT JOIN profile_link_requests plr ON n.related_type = 'profile_link_request' AND n.related_id = plr.id";

        const notificationsResult = await query(`
      SELECT
        n.id, n.title, n.message, n.type, n.related_type, n.related_id,
        n.is_read, n.sent_at
      FROM notifications n
      ${joinClause}
      WHERE ${whereClause}
      ORDER BY n.sent_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset]);

        // Conta totale per paginazione
        const countResult = await query(`
      SELECT COUNT(*) as total, COUNT(CASE WHEN n.is_read = false THEN 1 END) as unread
      FROM notifications n
      ${joinClause}
      WHERE ${whereClause}
    `, queryParams);

        res.json({
            notifications: notificationsResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                unread: parseInt(countResult.rows[0].unread),
                pages: Math.ceil(countResult.rows[0].total / limit)
            }
        });

    } catch (error) {
        console.error('Errore nel recupero delle notifiche:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Segna notifica come letta
router.patch('/:notificationId/read', async (req, res) => {
    try {
        const { notificationId } = req.params;

        const updateResult = await query(`
      UPDATE notifications 
      SET is_read = true 
      WHERE id = $1 AND user_id = $2 
      RETURNING *
    `, [notificationId, req.user.id]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Notifica non trovata' });
        }

        res.json({
            success: true,
            notification: updateResult.rows[0],
            message: 'Notifica segnata come letta'
        });

    } catch (error) {
        console.error('Errore nella marcatura della notifica:', error);
        res.status(500).json({ error: 'Errore nella marcatura della notifica' });
    }
});

// Segna tutte le notifiche come lette
router.patch('/mark-all-read', async (req, res) => {
    try {
        const updateResult = await query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false RETURNING id',
            [req.user.id]
        );

        res.json({
            success: true,
            marked: updateResult.rows.length,
            message: 'Tutte le notifiche sono state segnate come lette'
        });

    } catch (error) {
        console.error('Errore nella marcatura delle notifiche:', error);
        res.status(500).json({ error: 'Errore nella marcatura delle notifiche' });
    }
});

// Elimina notifica
router.delete('/:notificationId', async (req, res) => {
    try {
        const { notificationId } = req.params;

        const deleteResult = await query(
            'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING title',
            [notificationId, req.user.id]
        );

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Notifica non trovata' });
        }

        res.json({
            success: true,
            message: 'Notifica eliminata con successo'
        });

    } catch (error) {
        console.error('Errore nell\'eliminazione della notifica:', error);
        res.status(500).json({ error: 'Errore nell\'eliminazione della notifica' });
    }
});

// Elimina tutte le notifiche lette
router.delete('/read', async (req, res) => {
    try {
        const deleteResult = await query(
            'DELETE FROM notifications WHERE user_id = $1 AND is_read = true RETURNING id',
            [req.user.id]
        );

        res.json({
            success: true,
            deleted: deleteResult.rows.length,
            message: 'Notifiche lette eliminate con successo'
        });

    } catch (error) {
        console.error('Errore nell\'eliminazione delle notifiche:', error);
        res.status(500).json({ error: 'Errore nell\'eliminazione delle notifiche' });
    }
});

// Salva/aggiorna una subscription Web Push per l'utente corrente
router.post('/push-subscribe', async (req, res) => {
    try {
        const { endpoint, keys } = req.body;

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({ error: 'Subscription non valida' });
        }

        const userAgent = req.headers['user-agent'] || null;

        const upsertResult = await query(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (endpoint) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            user_agent = EXCLUDED.user_agent
      RETURNING *
    `, [req.user.id, endpoint, keys.p256dh, keys.auth, userAgent]);

        res.status(201).json({
            success: true,
            subscription: upsertResult.rows[0]
        });

    } catch (error) {
        console.error('Errore nel salvataggio della push subscription:', error);
        res.status(500).json({ error: 'Errore nel salvataggio della push subscription' });
    }
});

// Rimuove una subscription Web Push dell'utente corrente
router.delete('/push-subscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint obbligatorio' });
        }

        await query(
            'DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2',
            [endpoint, req.user.id]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('Errore nella rimozione della push subscription:', error);
        res.status(500).json({ error: 'Errore nella rimozione della push subscription' });
    }
});

// Funzioni helper per creare notifiche (usate da altri moduli)
const createNotification = async (userId, title, message, type = 'info', relatedType = null, relatedId = null) => {
    try {
        const result = await query(`
      INSERT INTO notifications (user_id, title, message, type, related_type, related_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [userId, title, message, type, relatedType, relatedId]);

        sendPushToUser(userId, { title, body: message, url: '/notifications' })
            .catch((err) => console.error('Errore nell\'invio della push notification:', err));

        return result.rows[0];
    } catch (error) {
        console.error('Errore nella creazione della notifica:', error);
        throw error;
    }
};

const createBulkNotifications = async (userIds, title, message, type = 'info', relatedType = null, relatedId = null) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const values = userIds.map((userId, index) => {
            const baseIndex = index * 6;
            return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
        }).join(', ');

        const params = userIds.flatMap(userId => [userId, title, message, type, relatedType, relatedId]);

        await client.query(`
      INSERT INTO notifications (user_id, title, message, type, related_type, related_id)
      VALUES ${values}
    `, params);

        await client.query('COMMIT');

        console.log(`📱 ${userIds.length} notifiche create in bulk: ${title}`);

        sendPushToUsers(userIds, { title, body: message, url: '/notifications' })
            .catch((err) => console.error('Errore nell\'invio delle push notification in bulk:', err));

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nella creazione delle notifiche in bulk:', error);
        throw error;
    } finally {
        client.release();
    }
};

// Soglie di preavviso scadenza documento (giorni rimanenti -> type/label)
const DOCUMENT_EXPIRY_THRESHOLDS = [
    { days: 90, type: 'info', label: '3 mesi' },
    { days: 60, type: 'notice', label: '2 mesi' },
    { days: 30, type: 'warning', label: '1 mese' },
    { days: 14, type: 'high', label: '2 settimane' },
    { days: 7, type: 'urgent', label: '1 settimana' },
    { days: 0, type: 'expired', label: 'scaduto' }
];

const DOCUMENT_TYPE_LABELS = {
    payment: 'Attestazione di Pagamento',
    medical_certificate: 'Certificato Medico',
    other: 'Altro Documento'
};

// Notifica scadenza documenti (6 soglie: 90/60/30/14/7/0 giorni rimanenti)
const notifyDocumentExpiry = async () => {
    try {
        console.log('🔔 Controllo scadenze documenti...');

        let totalProcessed = 0;

        for (const threshold of DOCUMENT_EXPIRY_THRESHOLDS) {
            const expiringResult = await query(`
        SELECT
          d.id, d.title, d.expiry_date, d.document_type,
          a.id as athlete_id, a.first_name, a.last_name
        FROM documents d
        JOIN athletes a ON d.athlete_id = a.id
        WHERE d.expiry_date = CURRENT_DATE + INTERVAL '${threshold.days} days'
          AND d.is_valid = true
          AND a.is_active = true
      `);

            for (const doc of expiringResult.rows) {
                const recipientsResult = await query(`
          SELECT DISTINCT user_id FROM (
            SELECT a.user_id
            FROM athletes a
            WHERE a.id = $1 AND a.user_id IS NOT NULL

            UNION

            SELECT pa.parent_id AS user_id
            FROM parent_athlete pa
            WHERE pa.athlete_id = $1

            UNION

            SELECT sg.user_id
            FROM athlete_group ag
            JOIN staff_group sg ON sg.group_id = ag.group_id
            WHERE ag.athlete_id = $1
              AND sg.role IN ('coach', 'manager', 'assistant')
          ) recipients
          WHERE user_id IS NOT NULL
        `, [doc.athlete_id]);

                const userIds = recipientsResult.rows.map(r => r.user_id);
                if (userIds.length === 0) continue;

                const athleteName = `${doc.first_name} ${doc.last_name}`;
                const documentLabel = DOCUMENT_TYPE_LABELS[doc.document_type] || doc.title;

                const title = threshold.type === 'expired'
                    ? 'Documento scaduto'
                    : 'Documento in scadenza';

                const message = threshold.type === 'expired'
                    ? `${documentLabel} di ${athleteName} è scaduto`
                    : `${documentLabel} di ${athleteName} scade tra ${threshold.label}`;

                await createBulkNotifications(userIds, title, message, threshold.type, 'document', doc.id);
                totalProcessed++;
            }
        }

        console.log(`✅ Processate ${totalProcessed} notifiche di scadenza documento`);

    } catch (error) {
        console.error('Errore nel controllo scadenze documenti:', error);
    }
};

// Notifica nuovi eventi
const notifyNewEvent = async (eventId, groupId) => {
    try {
        const eventResult = await query(`
      SELECT e.*, g.name as group_name
      FROM events e
      LEFT JOIN groups g ON e.group_id = g.id
      WHERE e.id = $1
    `, [eventId]);

        if (eventResult.rows.length === 0) return;

        const event = eventResult.rows[0];
        const title = `Nuovo evento: ${event.title}`;
        const message = `È stato programmato un nuovo ${event.event_type === 'training' ? 'allenamento' : 'evento'} per il ${new Date(event.start_datetime).toLocaleDateString('it-IT')}`;

        if (groupId) {
            // Notifica genitori degli atleti del gruppo
            const parentsResult = await query(`
        SELECT DISTINCT pa.parent_id
        FROM parent_athlete pa
        JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
        WHERE ag.group_id = $1 AND ag.is_active = true
      `, [groupId]);

            const parentIds = parentsResult.rows.map(r => r.parent_id);
            if (parentIds.length > 0) {
                await createBulkNotifications(parentIds, title, message, 'info', 'event', eventId);
            }

            // Notifica atleti con account del gruppo
            const athletesResult = await query(`
        SELECT DISTINCT a.user_id
        FROM athletes a
        JOIN athlete_group ag ON a.id = ag.athlete_id
        WHERE ag.group_id = $1 AND ag.is_active = true AND a.user_id IS NOT NULL
      `, [groupId]);

            const athleteUserIds = athletesResult.rows.map(r => r.user_id);
            if (athleteUserIds.length > 0) {
                await createBulkNotifications(athleteUserIds, title, message, 'info', 'event', eventId);
            }
        }

        console.log(`📅 Notifiche inviate per nuovo evento: ${event.title}`);

    } catch (error) {
        console.error('Errore nell\'invio notifiche nuovo evento:', error);
    }
};

// Endpoint per admin per inviare notifiche di sistema
router.post('/system', async (req, res) => {
    try {
        const { title, message, targetRole, isUrgent = false } = req.body;

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Solo gli admin possono inviare notifiche di sistema' });
        }

        if (!title || !message) {
            return res.status(400).json({ error: 'Titolo e messaggio sono obbligatori' });
        }

        let whereClause = 'WHERE u.is_active = true';
        let queryParams = [];

        if (targetRole && targetRole !== 'all') {
            whereClause += ' AND u.role = $1';
            queryParams.push(targetRole);
        }

        const usersResult = await query(`
      SELECT id FROM users u ${whereClause}
    `, queryParams);

        const userIds = usersResult.rows.map(r => r.id);
        const notificationType = isUrgent ? 'urgent' : 'info';

        if (userIds.length > 0) {
            await createBulkNotifications(userIds, title, message, notificationType, 'system', null);
        }

        res.json({
            success: true,
            sent: userIds.length,
            message: 'Notifiche di sistema inviate con successo'
        });

    } catch (error) {
        console.error('Errore nell\'invio delle notifiche di sistema:', error);
        res.status(500).json({ error: 'Errore nell\'invio delle notifiche di sistema' });
    }
});

module.exports = {
    router,
    createNotification,
    createBulkNotifications,
    notifyDocumentExpiry,
    notifyNewEvent
};
