const express = require('express');
const { query, getClient } = require('../config/database');
const { requireRole, canAccessGroup } = require('../middleware/auth');

const router = express.Router();

// Ottieni tutti i gruppi
router.get('/', async (req, res) => {
    try {
        const { seasonId, active = 'true' } = req.query;

        let whereConditions = ['g.is_active = $1'];
        let queryParams = [active === 'true'];
        let paramIndex = 2;

        // Filtro per stagione
        if (seasonId) {
            whereConditions.push(`g.season_id = $${paramIndex}`);
            queryParams.push(seasonId);
            paramIndex++;
        } else {
            // Se non specificata, usa la stagione corrente
            whereConditions.push(`g.season_id = (SELECT id FROM seasons WHERE is_current = true)`);
        }

        // Filtro per ruolo utente
        if (req.user.role === 'coach') {
            whereConditions.push(`g.id IN (
        SELECT group_id FROM staff_group WHERE user_id = $${paramIndex}
      )`);
            queryParams.push(req.user.id);
            paramIndex++;
        } else if (req.user.role === 'parent') {
            whereConditions.push(`g.id IN (
        SELECT DISTINCT ag.group_id 
        FROM parent_athlete pa
        JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
        WHERE pa.parent_id = $${paramIndex} AND ag.is_active = true
      )`);
            queryParams.push(req.user.id);
            paramIndex++;
        } else if (req.user.role === 'athlete') {
            whereConditions.push(`g.id IN (
        SELECT DISTINCT ag.group_id 
        FROM athletes a
        JOIN athlete_group ag ON a.id = ag.athlete_id
        WHERE a.user_id = $${paramIndex} AND ag.is_active = true
      )`);
            queryParams.push(req.user.id);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const groupsResult = await query(`
      SELECT 
        g.id, g.name, g.description, g.age_group,
        s.name as season_name,
        COUNT(DISTINCT ag.athlete_id) as athletes_count,
        COUNT(DISTINCT sg.user_id) as staff_count
      FROM groups g
      LEFT JOIN seasons s ON g.season_id = s.id
      LEFT JOIN athlete_group ag ON g.id = ag.group_id AND ag.is_active = true
      LEFT JOIN staff_group sg ON g.id = sg.group_id
      WHERE ${whereClause}
      GROUP BY g.id, s.name
      ORDER BY g.name
    `, queryParams);

        res.json({ groups: groupsResult.rows });

    } catch (error) {
        console.error('Errore nel recupero dei gruppi:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Ottieni dettagli di un gruppo
router.get('/:groupId', canAccessGroup, async (req, res) => {
    try {
        const { groupId } = req.params;

        // Dettagli gruppo
        const groupResult = await query(`
      SELECT g.*, s.name as season_name
      FROM groups g
      LEFT JOIN seasons s ON g.season_id = s.id
      WHERE g.id = $1 AND g.is_active = true
    `, [groupId]);

        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'Gruppo non trovato' });
        }

        const group = groupResult.rows[0];

        // Atleti del gruppo
        const athletesResult = await query(`
      SELECT 
        a.id, a.first_name, a.last_name, a.date_of_birth,
        ag.joined_date, ag.is_active as is_active_in_group
      FROM athletes a
      JOIN athlete_group ag ON a.id = ag.athlete_id
      WHERE ag.group_id = $1 AND a.is_active = true
      ORDER BY a.last_name, a.first_name
    `, [groupId]);

        group.athletes = athletesResult.rows;

        // Staff del gruppo
        const staffResult = await query(`
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.role,
        sg.role as group_role, sg.can_manage
      FROM users u
      JOIN staff_group sg ON u.id = sg.user_id
      WHERE sg.group_id = $1 AND u.is_active = true
      ORDER BY u.last_name, u.first_name
    `, [groupId]);

        group.staff = staffResult.rows;

        res.json({ group });

    } catch (error) {
        console.error('Errore nel recupero dei dettagli del gruppo:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Crea un nuovo gruppo
router.post('/', requireRole(['admin']), async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const { name, description, ageGroup, seasonId } = req.body;

        // Validazione
        if (!name) {
            return res.status(400).json({ error: 'Nome del gruppo è obbligatorio' });
        }

        // Usa stagione corrente se non specificata
        let finalSeasonId = seasonId;
        if (!finalSeasonId) {
            const currentSeasonResult = await client.query(
                'SELECT id FROM seasons WHERE is_current = true'
            );
            if (currentSeasonResult.rows.length > 0) {
                finalSeasonId = currentSeasonResult.rows[0].id;
            }
        }

        const groupResult = await client.query(`
      INSERT INTO groups (name, description, age_group, season_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, description, ageGroup, finalSeasonId]);

        await client.query('COMMIT');

        console.log(`👥 Nuovo gruppo creato: ${groupResult.rows[0].name}`);

        res.status(201).json({
            success: true,
            group: groupResult.rows[0],
            message: 'Gruppo creato con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nella creazione del gruppo:', error);

        if (error.code === '23505') {
            res.status(400).json({ error: 'Nome gruppo già esistente per questa stagione' });
        } else {
            res.status(500).json({ error: 'Errore nella creazione del gruppo' });
        }
    } finally {
        client.release();
    }
});

// Aggiorna un gruppo
router.put('/:groupId', requireRole(['admin']), async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, description, ageGroup } = req.body;

        const updateResult = await query(`
      UPDATE groups SET
        name = $1, description = $2, age_group = $3
      WHERE id = $4 AND is_active = true
      RETURNING *
    `, [name, description, ageGroup, groupId]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Gruppo non trovato' });
        }

        console.log(`✏️ Gruppo aggiornato: ${updateResult.rows[0].name}`);

        res.json({
            success: true,
            group: updateResult.rows[0],
            message: 'Gruppo aggiornato con successo'
        });

    } catch (error) {
        console.error('Errore nell\'aggiornamento del gruppo:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento del gruppo' });
    }
});

// Aggiungi atleta al gruppo
router.post('/:groupId/athletes', requireRole(['admin', 'coach']), async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const { groupId } = req.params;
        const { athleteId } = req.body;

        // Verifica che il coach possa gestire il gruppo
        if (req.user.role === 'coach') {
            const accessResult = await client.query(
                'SELECT can_manage FROM staff_group WHERE user_id = $1 AND group_id = $2',
                [req.user.id, groupId]
            );

            if (accessResult.rows.length === 0 || !accessResult.rows[0].can_manage) {
                return res.status(403).json({ error: 'Non puoi gestire questo gruppo' });
            }
        }

        // Verifica che l'atleta esista ed è attivo
        const athleteResult = await client.query(
            'SELECT first_name, last_name FROM athletes WHERE id = $1 AND is_active = true',
            [athleteId]
        );

        if (athleteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Atleta non trovato' });
        }

        // Aggiungi al gruppo (o riattiva se già esistente)
        const addResult = await client.query(`
      INSERT INTO athlete_group (athlete_id, group_id, joined_date, is_active)
      VALUES ($1, $2, CURRENT_DATE, true)
      ON CONFLICT (athlete_id, group_id, joined_date)
      DO UPDATE SET is_active = true
      RETURNING *
    `, [athleteId, groupId]);

        await client.query('COMMIT');

        console.log(`➕ Atleta ${athleteResult.rows[0].first_name} ${athleteResult.rows[0].last_name} aggiunto al gruppo ${groupId}`);

        res.json({
            success: true,
            athleteGroup: addResult.rows[0],
            message: 'Atleta aggiunto al gruppo con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nell\'aggiunta dell\'atleta al gruppo:', error);
        res.status(500).json({ error: 'Errore nell\'aggiunta dell\'atleta al gruppo' });
    } finally {
        client.release();
    }
});

// Rimuovi atleta dal gruppo
router.delete('/:groupId/athletes/:athleteId', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { groupId, athleteId } = req.params;

        // Verifica che il coach possa gestire il gruppo
        if (req.user.role === 'coach') {
            const accessResult = await query(
                'SELECT can_manage FROM staff_group WHERE user_id = $1 AND group_id = $2',
                [req.user.id, groupId]
            );

            if (accessResult.rows.length === 0 || !accessResult.rows[0].can_manage) {
                return res.status(403).json({ error: 'Non puoi gestire questo gruppo' });
            }
        }

        const removeResult = await query(`
      UPDATE athlete_group 
      SET is_active = false, left_date = CURRENT_DATE
      WHERE athlete_id = $1 AND group_id = $2 AND is_active = true
      RETURNING *
    `, [athleteId, groupId]);

        if (removeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Atleta non trovato nel gruppo' });
        }

        console.log(`➖ Atleta ${athleteId} rimosso dal gruppo ${groupId}`);

        res.json({
            success: true,
            message: 'Atleta rimosso dal gruppo con successo'
        });

    } catch (error) {
        console.error('Errore nella rimozione dell\'atleta dal gruppo:', error);
        res.status(500).json({ error: 'Errore nella rimozione dell\'atleta dal gruppo' });
    }
});

// Aggiungi staff al gruppo
router.post('/:groupId/staff', requireRole(['admin']), async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const { groupId } = req.params;
        const { userId, role = 'coach', canManage = true } = req.body;

        // Verifica che l'utente esista ed è coach/admin
        const userResult = await client.query(
            'SELECT first_name, last_name, role FROM users WHERE id = $1 AND is_active = true',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        if (!['admin', 'coach'].includes(userResult.rows[0].role)) {
            return res.status(400).json({ error: 'Solo admin e coach possono gestire gruppi' });
        }

        // Aggiungi allo staff del gruppo
        const addResult = await client.query(`
      INSERT INTO staff_group (user_id, group_id, role, can_manage)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, group_id)
      DO UPDATE SET role = EXCLUDED.role, can_manage = EXCLUDED.can_manage
      RETURNING *
    `, [userId, groupId, role, canManage]);

        await client.query('COMMIT');

        console.log(`👨‍🏫 Staff ${userResult.rows[0].first_name} ${userResult.rows[0].last_name} aggiunto al gruppo ${groupId}`);

        res.json({
            success: true,
            staffGroup: addResult.rows[0],
            message: 'Staff aggiunto al gruppo con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nell\'aggiunta dello staff al gruppo:', error);
        res.status(500).json({ error: 'Errore nell\'aggiunta dello staff al gruppo' });
    } finally {
        client.release();
    }
});

// Rimuovi staff dal gruppo
router.delete('/:groupId/staff/:userId', requireRole(['admin']), async (req, res) => {
    try {
        const { groupId, userId } = req.params;

        const removeResult = await query(
            'DELETE FROM staff_group WHERE user_id = $1 AND group_id = $2 RETURNING *',
            [userId, groupId]
        );

        if (removeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Staff non trovato nel gruppo' });
        }

        console.log(`➖ Staff ${userId} rimosso dal gruppo ${groupId}`);

        res.json({
            success: true,
            message: 'Staff rimosso dal gruppo con successo'
        });

    } catch (error) {
        console.error('Errore nella rimozione dello staff dal gruppo:', error);
        res.status(500).json({ error: 'Errore nella rimozione dello staff dal gruppo' });
    }
});

// Disattiva gruppo
router.delete('/:groupId', requireRole(['admin']), async (req, res) => {
    try {
        const { groupId } = req.params;

        const result = await query(
            'UPDATE groups SET is_active = false WHERE id = $1 RETURNING name',
            [groupId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Gruppo non trovato' });
        }

        console.log(`🗑️ Gruppo disattivato: ${result.rows[0].name}`);

        res.json({
            success: true,
            message: 'Gruppo disattivato con successo'
        });

    } catch (error) {
        console.error('Errore nella disattivazione del gruppo:', error);
        res.status(500).json({ error: 'Errore nella disattivazione del gruppo' });
    }
});

module.exports = router;
