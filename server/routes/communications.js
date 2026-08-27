const express = require('express');
const { query, getClient } = require('../config/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Ottieni comunicazioni per l'utente corrente
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = 'false', sentAfter = '' } = req.query;
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        // Filtro per utente e ruolo
        if (req.user.role === 'admin') {
            // Admin vede tutte le comunicazioni
            whereConditions.push('c.id IS NOT NULL');
        } else if (req.user.role === 'coach') {
            // Coach vede comunicazioni per i suoi gruppi o globali
            whereConditions.push(`(
        c.target_type = 'all' OR 
        (c.target_type = 'group' AND c.target_group_id IN (
          SELECT group_id FROM staff_group WHERE user_id = $${paramIndex}
        ))
      )`);
            queryParams.push(req.user.id);
            paramIndex++;
        } else if (req.user.role === 'parent') {
            // Genitori vedono comunicazioni per i loro gruppi o globali
            whereConditions.push(`(
        c.target_type = 'all' OR 
        c.target_type = 'parents' OR
        (c.target_type = 'group' AND c.target_group_id IN (
          SELECT DISTINCT ag.group_id 
          FROM parent_athlete pa
          JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
          WHERE pa.parent_id = $${paramIndex} AND ag.is_active = true
        ))
      )`);
            queryParams.push(req.user.id);
            paramIndex++;
        } else if (req.user.role === 'athlete') {
            // Atleti vedono comunicazioni per i loro gruppi o globali
            whereConditions.push(`(
        c.target_type = 'all' OR 
        c.target_type = 'athletes' OR
        (c.target_type = 'group' AND c.target_group_id IN (
          SELECT DISTINCT ag.group_id 
          FROM athletes a
          JOIN athlete_group ag ON a.id = ag.athlete_id
          WHERE a.user_id = $${paramIndex} AND ag.is_active = true
        ))
      )`);
            queryParams.push(req.user.id);
            paramIndex++;
        }

        // Filtro per data di invio (es. "ultima settimana")
        if (sentAfter) {
            whereConditions.push(`c.sent_at >= $${paramIndex}`);
            queryParams.push(sentAfter);
            paramIndex++;
        }

        // Filtro solo non lette
        if (unreadOnly === 'true') {
            whereConditions.push(`c.id NOT IN (
        SELECT communication_id FROM communication_reads WHERE user_id = $${paramIndex}
      )`);
            queryParams.push(req.user.id);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        const communicationsQuery = `
      SELECT 
        c.id, c.title, c.content, c.target_type, c.is_urgent, c.sent_at,
        u.first_name as sender_first_name, u.last_name as sender_last_name,
        g.name as target_group_name,
        CASE WHEN cr.id IS NOT NULL THEN true ELSE false END as is_read,
        cr.read_at
      FROM communications c
      LEFT JOIN users u ON c.sender_id = u.id
      LEFT JOIN groups g ON c.target_group_id = g.id
      LEFT JOIN communication_reads cr ON c.id = cr.communication_id AND cr.user_id = $${paramIndex}
      ${whereClause}
      ORDER BY c.is_urgent DESC, c.sent_at DESC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;

        queryParams.push(req.user.id, limit, offset);

        const communicationsResult = await query(communicationsQuery, queryParams);

        // Conta totale per paginazione
        const countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM communications c
      LEFT JOIN groups g ON c.target_group_id = g.id
      ${whereClause}
    `;

        const countResult = await query(countQuery, queryParams.slice(0, -3));

        res.json({
            communications: communicationsResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                pages: Math.ceil(countResult.rows[0].total / limit)
            }
        });

    } catch (error) {
        console.error('Errore nel recupero delle comunicazioni:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Ottieni dettagli di una comunicazione
router.get('/:communicationId', async (req, res) => {
    try {
        const { communicationId } = req.params;

        const communicationResult = await query(`
      SELECT 
        c.*,
        u.first_name as sender_first_name, u.last_name as sender_last_name,
        g.name as target_group_name
      FROM communications c
      LEFT JOIN users u ON c.sender_id = u.id
      LEFT JOIN groups g ON c.target_group_id = g.id
      WHERE c.id = $1
    `, [communicationId]);

        if (communicationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Comunicazione non trovata' });
        }

        const communication = communicationResult.rows[0];

        // Verifica accesso alla comunicazione
        let canRead = false;

        if (req.user.role === 'admin') {
            canRead = true;
        } else if (req.user.role === 'coach') {
            if (communication.target_type === 'all' ||
                (communication.target_type === 'group' && communication.target_group_id)) {
                const accessResult = await query(
                    'SELECT 1 FROM staff_group WHERE user_id = $1 AND group_id = $2',
                    [req.user.id, communication.target_group_id]
                );
                canRead = communication.target_type === 'all' || accessResult.rows.length > 0;
            }
        } else if (req.user.role === 'parent') {
            if (['all', 'parents'].includes(communication.target_type)) {
                canRead = true;
            } else if (communication.target_type === 'group') {
                const accessResult = await query(`
          SELECT 1 FROM parent_athlete pa
          JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
          WHERE pa.parent_id = $1 AND ag.group_id = $2 AND ag.is_active = true
        `, [req.user.id, communication.target_group_id]);
                canRead = accessResult.rows.length > 0;
            }
        } else if (req.user.role === 'athlete') {
            if (['all', 'athletes'].includes(communication.target_type)) {
                canRead = true;
            } else if (communication.target_type === 'group') {
                const accessResult = await query(`
          SELECT 1 FROM athletes a
          JOIN athlete_group ag ON a.id = ag.athlete_id
          WHERE a.user_id = $1 AND ag.group_id = $2 AND ag.is_active = true
        `, [req.user.id, communication.target_group_id]);
                canRead = accessResult.rows.length > 0;
            }
        }

        if (!canRead) {
            return res.status(403).json({ error: 'Non puoi accedere a questa comunicazione' });
        }

        // Segna come letta
        await query(`
      INSERT INTO communication_reads (communication_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (communication_id, user_id) DO NOTHING
    `, [communicationId, req.user.id]);

        res.json({ communication });

    } catch (error) {
        console.error('Errore nel recupero della comunicazione:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Crea una nuova comunicazione
router.post('/', requireRole(['admin', 'coach']), async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const { title, content, targetType, targetGroupId, isUrgent = false } = req.body;

        // Validazione
        if (!title || !content || !targetType) {
            return res.status(400).json({
                error: 'Titolo, contenuto e tipo destinatario sono obbligatori'
            });
        }

        if (!['all', 'group', 'parents', 'athletes'].includes(targetType)) {
            return res.status(400).json({ error: 'Tipo destinatario non valido' });
        }

        if (targetType === 'group' && !targetGroupId) {
            return res.status(400).json({ error: 'ID gruppo richiesto per comunicazioni di gruppo' });
        }

        // Verifica accesso al gruppo per i coach
        if (req.user.role === 'coach' && targetType === 'group') {
            const accessResult = await client.query(
                'SELECT 1 FROM staff_group WHERE user_id = $1 AND group_id = $2',
                [req.user.id, targetGroupId]
            );

            if (accessResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi inviare comunicazioni a questo gruppo' });
            }
        }

        // Crea la comunicazione
        const communicationResult = await client.query(`
      INSERT INTO communications (title, content, sender_id, target_type, target_group_id, is_urgent)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [title, content, req.user.id, targetType, targetGroupId, isUrgent]);

        await client.query('COMMIT');

        console.log(`📢 Nuova comunicazione inviata: ${title} (${targetType})`);

        res.status(201).json({
            success: true,
            communication: communicationResult.rows[0],
            message: 'Comunicazione inviata con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nell\'invio della comunicazione:', error);
        res.status(500).json({ error: 'Errore nell\'invio della comunicazione' });
    } finally {
        client.release();
    }
});

// Segna comunicazione come letta
router.post('/:communicationId/read', async (req, res) => {
    try {
        const { communicationId } = req.params;

        await query(`
      INSERT INTO communication_reads (communication_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (communication_id, user_id) DO NOTHING
    `, [communicationId, req.user.id]);

        res.json({
            success: true,
            message: 'Comunicazione segnata come letta'
        });

    } catch (error) {
        console.error('Errore nella marcatura della comunicazione:', error);
        res.status(500).json({ error: 'Errore nella marcatura della comunicazione' });
    }
});

// Segna tutte le comunicazioni come lette
router.post('/mark-all-read', async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Ottieni tutte le comunicazioni non lette accessibili dall'utente
        let accessibleCommunications = [];

        if (req.user.role === 'admin') {
            const result = await client.query('SELECT id FROM communications');
            accessibleCommunications = result.rows.map(r => r.id);
        } else if (req.user.role === 'coach') {
            const result = await client.query(`
        SELECT DISTINCT c.id
        FROM communications c
        WHERE c.target_type = 'all' OR 
              (c.target_type = 'group' AND c.target_group_id IN (
                SELECT group_id FROM staff_group WHERE user_id = $1
              ))
      `, [req.user.id]);
            accessibleCommunications = result.rows.map(r => r.id);
        } else if (req.user.role === 'parent') {
            const result = await client.query(`
        SELECT DISTINCT c.id
        FROM communications c
        WHERE c.target_type IN ('all', 'parents') OR 
              (c.target_type = 'group' AND c.target_group_id IN (
                SELECT DISTINCT ag.group_id 
                FROM parent_athlete pa
                JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
                WHERE pa.parent_id = $1 AND ag.is_active = true
              ))
      `, [req.user.id]);
            accessibleCommunications = result.rows.map(r => r.id);
        } else if (req.user.role === 'athlete') {
            const result = await client.query(`
        SELECT DISTINCT c.id
        FROM communications c
        WHERE c.target_type IN ('all', 'athletes') OR 
              (c.target_type = 'group' AND c.target_group_id IN (
                SELECT DISTINCT ag.group_id 
                FROM athletes a
                JOIN athlete_group ag ON a.id = ag.athlete_id
                WHERE a.user_id = $1 AND ag.is_active = true
              ))
      `, [req.user.id]);
            accessibleCommunications = result.rows.map(r => r.id);
        }

        // Segna come lette
        if (accessibleCommunications.length > 0) {
            await client.query(`
        INSERT INTO communication_reads (communication_id, user_id)
        SELECT unnest($1::int[]), $2
        ON CONFLICT (communication_id, user_id) DO NOTHING
      `, [accessibleCommunications, req.user.id]);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            marked: accessibleCommunications.length,
            message: 'Tutte le comunicazioni sono state segnate come lette'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nella marcatura delle comunicazioni:', error);
        res.status(500).json({ error: 'Errore nella marcatura delle comunicazioni' });
    } finally {
        client.release();
    }
});

// Elimina comunicazione (solo admin)
router.delete('/:communicationId', requireRole(['admin']), async (req, res) => {
    try {
        const { communicationId } = req.params;

        const result = await query(
            'DELETE FROM communications WHERE id = $1 RETURNING title',
            [communicationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Comunicazione non trovata' });
        }

        console.log(`🗑️ Comunicazione eliminata: ${result.rows[0].title}`);

        res.json({
            success: true,
            message: 'Comunicazione eliminata con successo'
        });

    } catch (error) {
        console.error('Errore nell\'eliminazione della comunicazione:', error);
        res.status(500).json({ error: 'Errore nell\'eliminazione della comunicazione' });
    }
});

// Ottieni statistiche letture per una comunicazione (admin/coach)
router.get('/:communicationId/stats', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { communicationId } = req.params;

        // Verifica accesso alla comunicazione
        const communicationResult = await query(
            'SELECT * FROM communications WHERE id = $1',
            [communicationId]
        );

        if (communicationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Comunicazione non trovata' });
        }

        const communication = communicationResult.rows[0];

        // Verifica che il coach possa vedere le statistiche
        if (req.user.role === 'coach' && communication.target_type === 'group') {
            const accessResult = await query(
                'SELECT 1 FROM staff_group WHERE user_id = $1 AND group_id = $2',
                [req.user.id, communication.target_group_id]
            );

            if (accessResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi vedere le statistiche di questa comunicazione' });
            }
        }

        // Calcola statistiche
        const statsResult = await query(`
      SELECT 
        COUNT(DISTINCT target_users.user_id) as total_recipients,
        COUNT(DISTINCT cr.user_id) as read_count,
        COUNT(DISTINCT target_users.user_id) - COUNT(DISTINCT cr.user_id) as unread_count
      FROM (
        SELECT u.id as user_id
        FROM users u
        WHERE u.is_active = true
        AND (
          $2 = 'all' OR
          ($2 = 'parents' AND u.role = 'parent') OR
          ($2 = 'athletes' AND u.role = 'athlete') OR
          ($2 = 'group' AND (
            (u.role = 'parent' AND u.id IN (
              SELECT DISTINCT pa.parent_id 
              FROM parent_athlete pa
              JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
              WHERE ag.group_id = $3 AND ag.is_active = true
            )) OR
            (u.role = 'athlete' AND u.id IN (
              SELECT DISTINCT a.user_id 
              FROM athletes a
              JOIN athlete_group ag ON a.id = ag.athlete_id
              WHERE ag.group_id = $3 AND ag.is_active = true AND a.user_id IS NOT NULL
            )) OR
            (u.role IN ('admin', 'coach') AND u.id IN (
              SELECT user_id FROM staff_group WHERE group_id = $3
            ))
          ))
        )
      ) target_users
      LEFT JOIN communication_reads cr ON target_users.user_id = cr.user_id AND cr.communication_id = $1
    `, [communicationId, communication.target_type, communication.target_group_id]);

        res.json({
            stats: statsResult.rows[0],
            communication: {
                id: communication.id,
                title: communication.title,
                target_type: communication.target_type,
                sent_at: communication.sent_at
            }
        });

    } catch (error) {
        console.error('Errore nel recupero delle statistiche:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

module.exports = router;
