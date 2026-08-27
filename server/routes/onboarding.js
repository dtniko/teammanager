const express = require('express');
const { query, getClient } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const { createBulkNotifications } = require('./notifications');

const router = express.Router();

// Stato onboarding dell'utente corrente
router.get('/status', async (req, res) => {
    try {
        const { id: userId, role } = req.user;

        if (role !== 'athlete' && role !== 'parent') {
            return res.json({ needsOnboarding: false, state: 'done' });
        }

        if (role === 'athlete') {
            const linkedResult = await query(
                'SELECT id FROM athletes WHERE user_id = $1',
                [userId]
            );

            if (linkedResult.rows.length > 0) {
                return res.json({ needsOnboarding: false, state: 'done' });
            }

            const pendingResult = await query(`
        SELECT plr.*, a.first_name, a.last_name
        FROM profile_link_requests plr
        JOIN athletes a ON a.id = plr.athlete_id
        WHERE plr.user_id = $1 AND plr.context = 'athlete' AND plr.status = 'pending'
      `, [userId]);

            if (pendingResult.rows.length > 0) {
                return res.json({
                    needsOnboarding: true,
                    state: 'pending',
                    request: pendingResult.rows[0]
                });
            }

            return res.json({ needsOnboarding: true, state: 'select' });
        }

        // role === 'parent'
        const linkedResult = await query(
            'SELECT id FROM parent_athlete WHERE parent_id = $1',
            [userId]
        );

        if (linkedResult.rows.length > 0) {
            return res.json({ needsOnboarding: false, state: 'done' });
        }

        const pendingResult = await query(`
      SELECT plr.*, a.first_name, a.last_name
      FROM profile_link_requests plr
      JOIN athletes a ON a.id = plr.athlete_id
      WHERE plr.user_id = $1 AND plr.context = 'parent' AND plr.status = 'pending'
    `, [userId]);

        if (pendingResult.rows.length > 0) {
            return res.json({
                needsOnboarding: true,
                state: 'pending',
                request: pendingResult.rows[0]
            });
        }

        return res.json({ needsOnboarding: true, state: 'select' });

    } catch (error) {
        console.error('Errore nel recupero dello stato di onboarding:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Atleti disponibili per il collegamento
router.get('/available-athletes', async (req, res) => {
    try {
        const { context, search = '' } = req.query;

        if (context !== 'athlete' && context !== 'parent') {
            return res.status(400).json({ error: 'Parametro context non valido' });
        }

        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        if (context === 'athlete') {
            whereConditions.push('user_id IS NULL');
        }

        if (search) {
            whereConditions.push(`(
        LOWER(first_name) LIKE LOWER($${paramIndex}) OR
        LOWER(last_name) LIKE LOWER($${paramIndex})
      )`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const athletesResult = await query(`
      SELECT id, first_name, last_name, date_of_birth
      FROM athletes
      ${whereClause}
      ORDER BY last_name, first_name
      LIMIT 50
    `, queryParams);

        res.json({ athletes: athletesResult.rows });

    } catch (error) {
        console.error('Errore nel recupero degli atleti disponibili:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Richiesta di collegamento a un profilo esistente
router.post('/link-existing', async (req, res) => {
    try {
        const userId = req.user.id;
        const { athleteId, context, relationship } = req.body;

        if (!athleteId || !context) {
            return res.status(400).json({ error: 'athleteId e context sono obbligatori' });
        }

        if (context !== 'athlete' && context !== 'parent') {
            return res.status(400).json({ error: 'Parametro context non valido' });
        }

        if (context === 'parent' && !['parent', 'guardian', 'tutor'].includes(relationship)) {
            return res.status(400).json({ error: 'relationship obbligatoria e deve essere parent, guardian o tutor' });
        }

        const existingPendingResult = await query(
            "SELECT id FROM profile_link_requests WHERE user_id = $1 AND context = $2 AND status = 'pending'",
            [userId, context]
        );

        if (existingPendingResult.rows.length > 0) {
            return res.status(409).json({ error: 'Esiste già una richiesta in attesa per questo utente' });
        }

        if (context === 'athlete') {
            const athleteResult = await query(
                'SELECT id, user_id FROM athletes WHERE id = $1',
                [athleteId]
            );

            if (athleteResult.rows.length === 0) {
                return res.status(404).json({ error: 'Atleta non trovato' });
            }

            if (athleteResult.rows[0].user_id !== null) {
                return res.status(409).json({ error: 'Profilo già collegato a un altro account' });
            }
        }

        const insertResult = await query(`
      INSERT INTO profile_link_requests (user_id, athlete_id, context, relationship, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING *
    `, [userId, athleteId, context, context === 'parent' ? relationship : null]);

        const linkRequest = insertResult.rows[0];

        try {
            const athleteNameResult = await query(
                'SELECT first_name, last_name FROM athletes WHERE id = $1',
                [athleteId]
            );
            const athlete = athleteNameResult.rows[0];

            const adminCoachResult = await query(
                "SELECT id FROM users WHERE role IN ('admin', 'coach') AND is_active = true"
            );
            const adminCoachIds = adminCoachResult.rows.map(r => r.id);

            if (adminCoachIds.length > 0) {
                const title = 'Nuova richiesta di collegamento profilo';
                const message = `${req.user.firstName} ${req.user.lastName} ha richiesto il collegamento al profilo di ${athlete ? `${athlete.first_name} ${athlete.last_name}` : 'un atleta'}`;

                await createBulkNotifications(
                    adminCoachIds,
                    title,
                    message,
                    'info',
                    'profile_link_request',
                    linkRequest.id
                );
            }
        } catch (notificationError) {
            console.error('Errore nell\'invio delle notifiche di collegamento profilo:', notificationError);
        }

        res.status(201).json({
            success: true,
            request: linkRequest
        });

    } catch (error) {
        console.error('Errore nella creazione della richiesta di collegamento:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Creazione di un nuovo profilo atleta con collegamento immediato
router.post('/create-profile', async (req, res) => {
    const client = await getClient();

    try {
        const userId = req.user.id;
        const { context, relationship, athleteData = {} } = req.body;

        if (context !== 'athlete' && context !== 'parent') {
            client.release();
            return res.status(400).json({ error: 'Parametro context non valido' });
        }

        if (context === 'parent' && !['parent', 'guardian', 'tutor'].includes(relationship)) {
            client.release();
            return res.status(400).json({ error: 'relationship obbligatoria e deve essere parent, guardian o tutor' });
        }

        const {
            firstName, lastName, dateOfBirth, fiscalCode, placeOfBirth,
            address, phone, email, emergencyContactName, emergencyContactPhone
        } = athleteData;

        if (!firstName || !lastName || !dateOfBirth) {
            client.release();
            return res.status(400).json({
                error: 'Nome, cognome e data di nascita sono obbligatori'
            });
        }

        await client.query('BEGIN');

        if (context === 'athlete') {
            const athleteResult = await client.query(`
        INSERT INTO athletes (
          first_name, last_name, date_of_birth, fiscal_code, place_of_birth,
          address, phone, email, emergency_contact_name, emergency_contact_phone, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
                firstName, lastName, dateOfBirth, fiscalCode, placeOfBirth,
                address, phone, email, emergencyContactName, emergencyContactPhone, userId
            ]);

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                athlete: athleteResult.rows[0]
            });
        }

        // context === 'parent'
        const athleteResult = await client.query(`
      INSERT INTO athletes (
        first_name, last_name, date_of_birth, fiscal_code, place_of_birth,
        address, phone, email, emergency_contact_name, emergency_contact_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
            firstName, lastName, dateOfBirth, fiscalCode, placeOfBirth,
            address, phone, email, emergencyContactName, emergencyContactPhone
        ]);

        const athlete = athleteResult.rows[0];

        await client.query(`
      INSERT INTO parent_athlete (parent_id, athlete_id, relationship)
      VALUES ($1, $2, $3)
    `, [userId, athlete.id, relationship]);

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            athlete
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nella creazione del profilo atleta:', error);

        if (error.code === '23505') {
            res.status(400).json({ error: 'Codice fiscale già esistente' });
        } else {
            res.status(500).json({ error: 'Errore nella creazione del profilo atleta' });
        }
    } finally {
        client.release();
    }
});

// Lista richieste pending (solo admin/coach)
router.get('/pending-requests', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const requestsResult = await query(`
      SELECT
        plr.id, plr.context, plr.relationship, plr.status, plr.created_at,
        u.id as user_id, u.email as user_email, u.first_name as user_first_name, u.last_name as user_last_name,
        a.id as athlete_id, a.first_name as athlete_first_name, a.last_name as athlete_last_name
      FROM profile_link_requests plr
      JOIN users u ON u.id = plr.user_id
      JOIN athletes a ON a.id = plr.athlete_id
      WHERE plr.status = 'pending'
      ORDER BY plr.created_at
    `);

        res.json({ requests: requestsResult.rows });

    } catch (error) {
        console.error('Errore nel recupero delle richieste pending:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Approvazione richiesta (solo admin/coach)
router.post('/requests/:id/approve', requireRole(['admin', 'coach']), async (req, res) => {
    const client = await getClient();

    try {
        const { id } = req.params;

        await client.query('BEGIN');

        const requestResult = await client.query(
            'SELECT * FROM profile_link_requests WHERE id = $1',
            [id]
        );

        if (requestResult.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ error: 'Richiesta non trovata' });
        }

        const request = requestResult.rows[0];

        if (request.status !== 'pending') {
            await client.query('ROLLBACK');
            client.release();
            return res.status(409).json({ error: 'La richiesta non è più in attesa' });
        }

        if (request.context === 'athlete') {
            const athleteResult = await client.query(
                'SELECT id, user_id FROM athletes WHERE id = $1',
                [request.athlete_id]
            );

            if (athleteResult.rows.length === 0 || athleteResult.rows[0].user_id !== null) {
                await client.query('ROLLBACK');
                client.release();
                return res.status(409).json({ error: 'Il profilo è già stato collegato ad un altro account' });
            }

            await client.query(
                'UPDATE athletes SET user_id = $1 WHERE id = $2',
                [request.user_id, request.athlete_id]
            );
        } else {
            await client.query(`
        INSERT INTO parent_athlete (parent_id, athlete_id, relationship)
        VALUES ($1, $2, $3)
      `, [request.user_id, request.athlete_id, request.relationship]);
        }

        const updatedRequestResult = await client.query(`
      UPDATE profile_link_requests
      SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [req.user.id, id]);

        await client.query('COMMIT');

        res.json({
            success: true,
            request: updatedRequestResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nell\'approvazione della richiesta:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    } finally {
        client.release();
    }
});

// Rifiuto richiesta (solo admin/coach)
router.post('/requests/:id/reject', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { id } = req.params;

        const requestResult = await query(
            'SELECT * FROM profile_link_requests WHERE id = $1',
            [id]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Richiesta non trovata' });
        }

        if (requestResult.rows[0].status !== 'pending') {
            return res.status(409).json({ error: 'La richiesta non è più in attesa' });
        }

        const updatedRequestResult = await query(`
      UPDATE profile_link_requests
      SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [req.user.id, id]);

        res.json({
            success: true,
            request: updatedRequestResult.rows[0]
        });

    } catch (error) {
        console.error('Errore nel rifiuto della richiesta:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

module.exports = router;
