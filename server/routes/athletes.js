const express = require('express');
const { query, getClient } = require('../config/database');
const { requireRole, canAccessAthlete } = require('../middleware/auth');

const router = express.Router();

// Ottieni tutti gli atleti (solo admin e coach)
router.get('/', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', groupId, active = 'true' } = req.query;
        const offset = (page - 1) * limit;

        let whereConditions = ['a.is_active = $1'];
        let queryParams = [active === 'true'];
        let paramIndex = 2;

        // Filtro per ricerca
        if (search) {
            whereConditions.push(`(
        LOWER(a.first_name) LIKE LOWER($${paramIndex}) OR 
        LOWER(a.last_name) LIKE LOWER($${paramIndex}) OR
        LOWER(a.fiscal_code) LIKE LOWER($${paramIndex})
      )`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        // Filtro per gruppo
        if (groupId) {
            whereConditions.push(`ag.group_id = $${paramIndex} AND ag.is_active = true`);
            queryParams.push(groupId);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const athletesQuery = `
      SELECT 
        a.id, a.first_name, a.last_name, a.date_of_birth, 
        a.fiscal_code, a.email, a.phone, a.is_active,
        u.email as user_email,
        COUNT(DISTINCT ag.group_id) as groups_count,
        STRING_AGG(DISTINCT g.name, ', ') as groups_names
      FROM athletes a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN athlete_group ag ON a.id = ag.athlete_id AND ag.is_active = true
      LEFT JOIN groups g ON ag.group_id = g.id AND g.is_active = true
      WHERE ${whereClause}
      GROUP BY a.id, u.email
      ORDER BY a.last_name, a.first_name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        queryParams.push(limit, offset);

        const athletesResult = await query(athletesQuery, queryParams);

        // Conta il totale per la paginazione
        const countQuery = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM athletes a
      LEFT JOIN athlete_group ag ON a.id = ag.athlete_id AND ag.is_active = true
      WHERE ${whereClause}
    `;

        const countResult = await query(countQuery, queryParams.slice(0, -2));

        res.json({
            athletes: athletesResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                pages: Math.ceil(countResult.rows[0].total / limit)
            }
        });

    } catch (error) {
        console.error('Errore nel recupero degli atleti:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Ottieni gli atleti per un genitore
router.get('/my-athletes', async (req, res) => {
    try {
        const userId = req.user.id;

        if (req.user.role !== 'parent') {
            return res.status(403).json({ error: 'Solo i genitori possono accedere a questa risorsa' });
        }

        const athletesResult = await query(`
      SELECT 
        a.id, a.first_name, a.last_name, a.date_of_birth,
        a.fiscal_code, a.email, a.phone, a.emergency_contact_name,
        a.emergency_contact_phone, a.is_active,
        pa.relationship, pa.can_edit,
        COUNT(DISTINCT ag.group_id) as groups_count,
        STRING_AGG(DISTINCT g.name, ', ') as groups_names
      FROM athletes a
      JOIN parent_athlete pa ON a.id = pa.athlete_id
      LEFT JOIN athlete_group ag ON a.id = ag.athlete_id AND ag.is_active = true
      LEFT JOIN groups g ON ag.group_id = g.id AND g.is_active = true
      WHERE pa.parent_id = $1 AND a.is_active = true
      GROUP BY a.id, pa.relationship, pa.can_edit
      ORDER BY a.first_name, a.last_name
    `, [userId]);

        res.json({ athletes: athletesResult.rows });

    } catch (error) {
        console.error('Errore nel recupero degli atleti del genitore:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Ottieni dettagli di un atleta
router.get('/:athleteId', canAccessAthlete, async (req, res) => {
    try {
        const { athleteId } = req.params;

        const athleteResult = await query(`
      SELECT 
        a.*, u.email as user_email,
        CASE WHEN u.id IS NOT NULL THEN true ELSE false END as has_account
      FROM athletes a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = $1
    `, [athleteId]);

        if (athleteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Atleta non trovato' });
        }

        const athlete = athleteResult.rows[0];

        // Ottieni i gruppi dell'atleta
        const groupsResult = await query(`
      SELECT g.id, g.name, g.description, g.age_group,
             ag.joined_date, ag.is_active
      FROM groups g
      JOIN athlete_group ag ON g.id = ag.group_id
      WHERE ag.athlete_id = $1
      ORDER BY ag.joined_date DESC
    `, [athleteId]);

        athlete.groups = groupsResult.rows;

        // Ottieni i genitori/tutori
        const parentsResult = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
             pa.relationship, pa.can_edit
      FROM users u
      JOIN parent_athlete pa ON u.id = pa.parent_id
      WHERE pa.athlete_id = $1
    `, [athleteId]);

        athlete.parents = parentsResult.rows;

        res.json({ athlete });

    } catch (error) {
        console.error('Errore nel recupero dei dettagli dell\'atleta:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Crea un nuovo atleta
router.post('/', requireRole(['admin', 'coach']), async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const {
            firstName, lastName, dateOfBirth, fiscalCode, placeOfBirth,
            address, phone, email, emergencyContactName, emergencyContactPhone,
            parentEmails = [], groupIds = []
        } = req.body;

        // Validazione
        if (!firstName || !lastName || !dateOfBirth) {
            return res.status(400).json({
                error: 'Nome, cognome e data di nascita sono obbligatori'
            });
        }

        // Crea l'atleta
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

        // Associa ai gruppi
        for (const groupId of groupIds) {
            await client.query(`
        INSERT INTO athlete_group (athlete_id, group_id)
        VALUES ($1, $2)
      `, [athlete.id, groupId]);
        }

        // Associa ai genitori
        for (const parentEmail of parentEmails) {
            const parentResult = await client.query(
                'SELECT id FROM users WHERE email = $1 AND role = $2',
                [parentEmail, 'parent']
            );

            if (parentResult.rows.length > 0) {
                await client.query(`
          INSERT INTO parent_athlete (parent_id, athlete_id, relationship)
          VALUES ($1, $2, 'parent')
          ON CONFLICT (parent_id, athlete_id) DO NOTHING
        `, [parentResult.rows[0].id, athlete.id]);
            }
        }

        await client.query('COMMIT');

        console.log(`👶 Nuovo atleta creato: ${athlete.first_name} ${athlete.last_name}`);

        res.status(201).json({
            success: true,
            athlete,
            message: 'Atleta creato con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nella creazione dell\'atleta:', error);

        if (error.code === '23505') { // Unique constraint violation
            res.status(400).json({ error: 'Codice fiscale già esistente' });
        } else {
            res.status(500).json({ error: 'Errore nella creazione dell\'atleta' });
        }
    } finally {
        client.release();
    }
});

// Aggiorna un atleta
router.put('/:athleteId', canAccessAthlete, async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const { athleteId } = req.params;
        const {
            firstName, lastName, dateOfBirth, fiscalCode, placeOfBirth,
            address, phone, email, emergencyContactName, emergencyContactPhone
        } = req.body;

        // Verifica permessi di modifica per i genitori
        if (req.user.role === 'parent') {
            const permissionResult = await client.query(
                'SELECT can_edit FROM parent_athlete WHERE parent_id = $1 AND athlete_id = $2',
                [req.user.id, athleteId]
            );

            if (permissionResult.rows.length === 0 || !permissionResult.rows[0].can_edit) {
                return res.status(403).json({ error: 'Non hai i permessi per modificare questo atleta' });
            }
        }

        const updateResult = await client.query(`
      UPDATE athletes SET
        first_name = $1, last_name = $2, date_of_birth = $3, fiscal_code = $4,
        place_of_birth = $5, address = $6, phone = $7, email = $8,
        emergency_contact_name = $9, emergency_contact_phone = $10,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `, [
            firstName, lastName, dateOfBirth, fiscalCode, placeOfBirth,
            address, phone, email, emergencyContactName, emergencyContactPhone,
            athleteId
        ]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Atleta non trovato' });
        }

        await client.query('COMMIT');

        console.log(`✏️ Atleta aggiornato: ${updateResult.rows[0].first_name} ${updateResult.rows[0].last_name}`);

        res.json({
            success: true,
            athlete: updateResult.rows[0],
            message: 'Atleta aggiornato con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nell\'aggiornamento dell\'atleta:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento dell\'atleta' });
    } finally {
        client.release();
    }
});

// Disattiva un atleta
router.delete('/:athleteId', requireRole(['admin']), async (req, res) => {
    try {
        const { athleteId } = req.params;

        const result = await query(
            'UPDATE athletes SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING first_name, last_name',
            [athleteId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Atleta non trovato' });
        }

        console.log(`🗑️ Atleta disattivato: ${result.rows[0].first_name} ${result.rows[0].last_name}`);

        res.json({
            success: true,
            message: 'Atleta disattivato con successo'
        });

    } catch (error) {
        console.error('Errore nella disattivazione dell\'atleta:', error);
        res.status(500).json({ error: 'Errore nella disattivazione dell\'atleta' });
    }
});

module.exports = router;
