const express = require('express');
const { query, getClient } = require('../config/database');
const { sendPushToUser, sendPushToUsers, isVapidConfigured } = require('../services/webPush');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Stato configurazione push lato server (le chiavi VAPID sono a runtime,
// non a build-time: qui il frontend verifica davvero se le push funzionano).
// Auth: come tutti gli altri endpoint del router (authenticateToken è
// applicato al mount in server/index.js).
router.get('/push-status', (req, res) => {
    // La chiave pubblica VAPID non è segreta (è la privata che lo è): esporla
    // al client è sicuro ed è l'unico modo infallibile perché il browser
    // crei la subscription con la chiave accoppiata a quella con cui il
    // server firma le push (in produzione viene da Secret Manager, non dal
    // valore baked a build-time).
    res.json({
        enabled: isVapidConfigured(),
        publicKey: process.env.VAPID_PUBLIC_KEY || null
    });
});

// Test: invia una push all'utente corrente (verifica che la consegna funzioni)
router.post('/test-push', async (req, res) => {
    if (!isVapidConfigured()) {
        return res.status(400).json({ error: 'Push non configurate sul server' });
    }
    await sendPushToUser(req.user.id, {
        title: 'Sport Manager',
        body: 'Push di test: se la vedi, le notifiche funzionano.',
        url: '/'
    });
    res.json({ success: true, message: 'Push di test inviata' });
});

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

// Endpoint coach/admin per inviare una notifica push+in-app a tutti i
// genitori e gli atleti (con account) di un gruppo
router.post('/group', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { title, message, groupId } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Il titolo è obbligatorio' });
        }
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Il messaggio è obbligatorio' });
        }
        const parsedGroupId = Number(groupId);
        if (!Number.isInteger(parsedGroupId) || parsedGroupId <= 0) {
            return res.status(400).json({ error: 'ID gruppo non valido' });
        }

        // Il gruppo deve esistere (per entrambi i ruoli)
        const groupResult = await query(
            'SELECT 1 FROM groups WHERE id = $1',
            [parsedGroupId]
        );
        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'Gruppo non trovato' });
        }

        // Coach: verifica accesso al gruppo (admin: nessun check)
        if (req.user.role === 'coach') {
            const accessResult = await query(
                'SELECT 1 FROM staff_group WHERE user_id = $1 AND group_id = $2',
                [req.user.id, parsedGroupId]
            );
            if (accessResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi inviare notifiche a questo gruppo' });
            }
        }

        // Genitori degli atleti del gruppo
        const parentsResult = await query(`
      SELECT DISTINCT pa.parent_id
      FROM parent_athlete pa
      JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
      WHERE ag.group_id = $1 AND ag.is_active = true
    `, [parsedGroupId]);
        const parentIds = parentsResult.rows.map(r => r.parent_id);

        // Atleti con account del gruppo
        const athletesResult = await query(`
      SELECT DISTINCT a.user_id
      FROM athletes a
      JOIN athlete_group ag ON a.id = ag.athlete_id
      WHERE ag.group_id = $1 AND ag.is_active = true AND a.user_id IS NOT NULL
    `, [parsedGroupId]);
        const athleteUserIds = athletesResult.rows.map(r => r.user_id);

        // Union con dedup
        const userIds = [...new Set([...parentIds, ...athleteUserIds])];

        if (userIds.length === 0) {
            return res.json({
                success: true,
                sent: 0,
                note: 'Nessun destinatario con account attivo'
            });
        }

        await createBulkNotifications(userIds, title.trim(), message.trim(), 'info', null, null);

        res.json({
            success: true,
            sent: userIds.length
        });

    } catch (error) {
        console.error("Errore nell'invio delle notifiche di gruppo:", error);
        res.status(500).json({ error: "Errore nell'invio delle notifiche di gruppo" });
    }
});

// ── Notifica creazione/modifica evento ──────────────────────────────

/**
 * Notifica a tutti gli utenti pertinenti quando viene creato o aggiornato un evento.
 *
 * Destinatari:
 * - Admin e coach (tutti, escluso il creatore)
 * - Genitori degli atleti del gruppo (se associato)
 * - Atleti con account (se associato)
 */
const notifyEventCreatedOrUpdated = async (eventId, groupId, createdBy, eventType, previousEvent = null) => {
    try {
        const eventResult = await query(`
      SELECT e.*, g.name as group_name
      FROM events e
      LEFT JOIN groups g ON e.group_id = g.id
      WHERE e.id = $1
    `, [eventId]);

        if (eventResult.rows.length === 0) return;

        const event = eventResult.rows[0];
        const isTraining = event.event_type === 'training';
        const eventDate = new Date(event.start_datetime).toLocaleDateString('it-IT', {
            weekday: 'short', day: 'numeric', month: 'short'
        });
        const eventLabel = isTraining ? 'allenamento' :
            event.event_type === 'match' ? 'partita' :
                event.event_type === 'meeting' ? 'riunione' : 'evento';

        // Aggiornamento (stato precedente presente): costruisce la lista dei
        // cambiamenti (Data, Orario, Luogo) con i valori vecchio → nuovo
        const isUpdate = previousEvent !== null;
        const updateLabel = isTraining ? 'allenamento' : 'evento';
        let updateMessage = '';
        if (isUpdate) {
            const fmtDate = (d) => new Date(d).toLocaleDateString('it-IT');
            const fmtTime = (d) => new Date(d).toLocaleTimeString('it-IT', {
                hour: '2-digit', minute: '2-digit'
            });
            const normLocation = (l) => (l || '').trim().toLowerCase();
            const displayLocation = (l) => {
                const t = (l || '').trim();
                return t !== '' ? t : '–';
            };

            const changes = [];
            if (fmtDate(previousEvent.start_datetime) !== fmtDate(event.start_datetime)) {
                changes.push(`Data: ${fmtDate(previousEvent.start_datetime)} → ${fmtDate(event.start_datetime)}`);
            }
            const oldStart = fmtTime(previousEvent.start_datetime);
            const newStart = fmtTime(event.start_datetime);
            const oldEnd = fmtTime(previousEvent.end_datetime);
            const newEnd = fmtTime(event.end_datetime);
            if (oldStart !== newStart || oldEnd !== newEnd) {
                changes.push(`Orario: ${oldStart}–${oldEnd} → ${newStart}–${newEnd}`);
            }
            if (normLocation(previousEvent.location) !== normLocation(event.location)) {
                changes.push(`Luogo: ${displayLocation(previousEvent.location)} → ${displayLocation(event.location)}`);
            }

            updateMessage = changes.length > 0
                ? `${eventDate} — ${changes.join(' · ')}`
                : `${event.title} – ${eventDate}`;
        }

        // 1) Notifica admin e coach (escluso il creatore se è admin/coach)
        let recipientSql = 'SELECT id FROM users WHERE is_active = true AND role IN ($1, $2)';
        const recipientParams = ['admin', 'coach'];
        if (createdBy) {
            recipientSql += ' AND id != $3';
            recipientParams.push(createdBy);
        }
        const staffResult = await query(recipientSql, recipientParams);
        const staffUserIds = staffResult.rows.map(r => r.id);

        if (staffUserIds.length > 0) {
            const title = isUpdate
                ? `Modificato: ${event.title}`
                : (isTraining ? 'Nuovo allenamento programmato' : 'Nuovo evento programmato');
            const message = isUpdate
                ? updateMessage
                : `${event.title} – ${eventDate}`;
            await createBulkNotifications(
                staffUserIds, title, message, 'info', 'event', eventId
            );
        }

        // 2) Notifica genitori degli atleti del gruppo
        if (groupId) {
            const parentsResult = await query(`
        SELECT DISTINCT pa.parent_id
        FROM parent_athlete pa
        JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
        WHERE ag.group_id = $1 AND ag.is_active = true
      `, [groupId]);

            const parentIds = parentsResult.rows.map(r => r.parent_id);
            if (parentIds.length > 0) {
                const title = isUpdate
                    ? `${updateLabel} modificato: ${event.title}`
                    : `Nuovo ${eventLabel}: ${event.title}`;
                const message = isUpdate ? updateMessage : `${eventDate}`;
                await createBulkNotifications(
                    parentIds, title, message, 'info', 'event', eventId
                );
            }

            // 3) Notifica atleti con account del gruppo
            const athletesResult = await query(`
        SELECT DISTINCT a.user_id
        FROM athletes a
        JOIN athlete_group ag ON a.id = ag.athlete_id
        WHERE ag.group_id = $1 AND ag.is_active = true AND a.user_id IS NOT NULL
      `, [groupId]);

            const athleteUserIds = athletesResult.rows.map(r => r.user_id);
            if (athleteUserIds.length > 0) {
                const title = isUpdate
                    ? `${updateLabel} modificato: ${event.title}`
                    : `Nuovo ${eventLabel}: ${event.title}`;
                const message = isUpdate ? updateMessage : `${eventDate}`;
                await createBulkNotifications(
                    athleteUserIds, title, message, 'info', 'event', eventId
                );
            }
        }

        console.log(`📅 Notifiche inviate per evento: ${event.title}`);

    } catch (error) {
        console.error('Errore nell\'invio notifiche evento:', error);
    }
};

// ── Notifica cambiamento presenza ────────────────────────────────────

/**
 * Notifica admin e coach quando un atleta cambia stato di presenza.
 *
 * Trigger:
 * - Se diventa 'absent' → notifica admin e coach
 * - Se passa da 'absent' a qualcos'altro → notifica admin e coach
 *
 * @param {number} eventId
 * @param {number} athleteId
 * @param {string} newStatus - nuovo stato ('present', 'absent', 'pending', 'called_up')
 * @param {string|null} oldStatus - stato precedente (null se era una prima inserzione)
 * @param {number} userId - ID dell'utente che ha fatto il cambiamento
 */
const notifyAttendanceChanged = async (eventId, athleteId, newStatus, oldStatus, userId) => {
    try {
        if (oldStatus === newStatus) return; // Nessuna modifica reale

        // Determina il nome dell'atleta
        const athleteResult = await query(
            'SELECT first_name, last_name FROM athletes WHERE id = $1',
            [athleteId]
        );
        const athleteName = athleteResult.rows.length > 0
            ? `${athleteResult.rows[0].first_name} ${athleteResult.rows[0].last_name}`
            : `Atleta ${athleteId}`;

        // Determina il nome dell'utente che ha fatto il cambiamento
        const userResult = await query(
            'SELECT first_name, last_name, role FROM users WHERE id = $1',
            [userId]
        );
        const userName = userResult.rows.length > 0
            ? `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`
            : 'Utente';

        // Determina l'etichetta dello stato
        const statusLabels = {
            present: 'Presente',
            absent: 'Assente',
            pending: 'Da convocare',
            called_up: 'Convocato'
        };
        const oldLabel = statusLabels[oldStatus] || oldStatus;
        const newLabel = statusLabels[newStatus] || newStatus;

        // Determina se è il caso di notificare
        let shouldNotify = false;
        let title = '';
        let message = '';

        if (newStatus === 'absent' && oldStatus !== 'absent') {
            // Diventa assente → notifica admin e coach
            shouldNotify = true;
            title = `${athleteName} segna assenza`;
            message = `${userName} ha segnalato assenza per ${athleteName}`;
        } else if (oldStatus === 'absent' && newStatus !== 'absent') {
            // Passa da assente a qualcos'altro → notifica admin e coach
            shouldNotify = true;
            title = `${athleteName} torna presente`;
            message = `${userName} ha cambiato lo stato di ${athleteName}: ${newLabel}`;
        }

        if (!shouldNotify) return;

        // Recupera admin + coach (escluso chi ha fatto il cambiamento)
        let recipientSql = 'SELECT id FROM users WHERE is_active = true AND role IN ($1, $2)';
        const recipientParams = ['admin', 'coach'];
        if (userId) {
            recipientSql += ' AND id != $3';
            recipientParams.push(userId);
        }

        const staffResult = await query(recipientSql, recipientParams);
        const staffUserIds = staffResult.rows.map(r => r.id);

        if (staffUserIds.length > 0) {
            await createBulkNotifications(
                staffUserIds, title, message, 'warning', 'event', eventId
            );
        }

        console.log(`🔔 Notifica presenza: ${title}`);
    } catch (error) {
        console.error('Errore nella notifica cambiamento presenza:', error);
    }
};

module.exports = {
    router,
    createNotification,
    createBulkNotifications,
    notifyDocumentExpiry,
    notifyNewEvent,
    notifyEventCreatedOrUpdated,
    notifyAttendanceChanged
};
