const express = require('express');
const { query, getClient } = require('../config/database');
const { requireRole, canAccessGroup } = require('../middleware/auth');

const router = express.Router();

// Ottieni eventi del calendario
router.get('/', async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            groupId,
            eventType,
            limit = 50
        } = req.query;

        let whereConditions = ['e.is_active = true'];
        let queryParams = [];
        let paramIndex = 1;

        // Filtro per date
        if (startDate) {
            whereConditions.push(`e.start_datetime >= $${paramIndex}`);
            queryParams.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            whereConditions.push(`e.start_datetime <= $${paramIndex}`);
            queryParams.push(endDate);
            paramIndex++;
        }

        // Filtro per gruppo - verifica accesso
        if (groupId) {
            // Verifica che l'utente possa accedere al gruppo
            if (req.user.role === 'parent' || req.user.role === 'athlete') {
                let canAccess = false;

                if (req.user.role === 'parent') {
                    const accessResult = await query(`
            SELECT 1 FROM parent_athlete pa
            JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
            WHERE pa.parent_id = $1 AND ag.group_id = $2 AND ag.is_active = true
          `, [req.user.id, groupId]);
                    canAccess = accessResult.rows.length > 0;
                } else if (req.user.role === 'athlete') {
                    const accessResult = await query(`
            SELECT 1 FROM athletes a
            JOIN athlete_group ag ON a.id = ag.athlete_id
            WHERE a.user_id = $1 AND ag.group_id = $2 AND ag.is_active = true
          `, [req.user.id, groupId]);
                    canAccess = accessResult.rows.length > 0;
                }

                if (!canAccess) {
                    return res.status(403).json({ error: 'Non puoi accedere agli eventi di questo gruppo' });
                }
            } else if (req.user.role === 'coach') {
                const accessResult = await query(
                    'SELECT 1 FROM staff_group WHERE user_id = $1 AND group_id = $2',
                    [req.user.id, groupId]
                );
                if (accessResult.rows.length === 0) {
                    return res.status(403).json({ error: 'Non puoi accedere agli eventi di questo gruppo' });
                }
            }

            whereConditions.push(`e.group_id = $${paramIndex}`);
            queryParams.push(groupId);
            paramIndex++;
        } else {
            // Se non è specificato un gruppo, filtra per i gruppi accessibili all'utente
            if (req.user.role === 'parent') {
                whereConditions.push(`e.group_id IN (
          SELECT DISTINCT ag.group_id 
          FROM parent_athlete pa
          JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
          WHERE pa.parent_id = $${paramIndex} AND ag.is_active = true
        )`);
                queryParams.push(req.user.id);
                paramIndex++;
            } else if (req.user.role === 'athlete') {
                whereConditions.push(`e.group_id IN (
          SELECT DISTINCT ag.group_id 
          FROM athletes a
          JOIN athlete_group ag ON a.id = ag.athlete_id
          WHERE a.user_id = $${paramIndex} AND ag.is_active = true
        )`);
                queryParams.push(req.user.id);
                paramIndex++;
            } else if (req.user.role === 'coach') {
                whereConditions.push(`e.group_id IN (
          SELECT group_id FROM staff_group WHERE user_id = $${paramIndex}
        )`);
                queryParams.push(req.user.id);
                paramIndex++;
            }
        }

        // Filtro per tipo di evento
        if (eventType) {
            whereConditions.push(`e.event_type = $${paramIndex}`);
            queryParams.push(eventType);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const eventsQuery = `
      SELECT 
        e.id, e.title, e.description, e.event_type, 
        e.start_datetime, e.end_datetime, e.location,
        e.is_recurring, e.recurring_pattern,
        g.id as group_id, g.name as group_name,
        u.first_name as creator_first_name, u.last_name as creator_last_name,
        (
          SELECT COUNT(*) 
          FROM attendance a 
          WHERE a.event_id = e.id AND a.status = 'present'
        ) as present_count,
        (
          SELECT COUNT(*) 
          FROM attendance a 
          WHERE a.event_id = e.id AND a.status = 'absent'
        ) as absent_count,
        (
          SELECT COUNT(*) 
          FROM attendance a 
          WHERE a.event_id = e.id AND a.status = 'pending'
        ) as pending_count
      FROM events e
      LEFT JOIN groups g ON e.group_id = g.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE ${whereClause}
      ORDER BY e.start_datetime ASC
      LIMIT $${paramIndex}
    `;

        queryParams.push(limit);

        const eventsResult = await query(eventsQuery, queryParams);

        res.json({ events: eventsResult.rows });

    } catch (error) {
        console.error('Errore nel recupero degli eventi:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Ottieni dettagli di un evento con presenze
router.get('/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;

        // Ottieni dettagli evento
        const eventResult = await query(`
      SELECT 
        e.*, 
        g.name as group_name,
        u.first_name as creator_first_name, u.last_name as creator_last_name
      FROM events e
      LEFT JOIN groups g ON e.group_id = g.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = $1 AND e.is_active = true
    `, [eventId]);

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ error: 'Evento non trovato' });
        }

        const event = eventResult.rows[0];

        // Verifica accesso al gruppo dell'evento
        if (event.group_id && req.user.role !== 'admin') {
            let canAccess = false;

            if (req.user.role === 'coach') {
                const accessResult = await query(
                    'SELECT 1 FROM staff_group WHERE user_id = $1 AND group_id = $2',
                    [req.user.id, event.group_id]
                );
                canAccess = accessResult.rows.length > 0;
            } else if (req.user.role === 'parent') {
                const accessResult = await query(`
          SELECT 1 FROM parent_athlete pa
          JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
          WHERE pa.parent_id = $1 AND ag.group_id = $2 AND ag.is_active = true
        `, [req.user.id, event.group_id]);
                canAccess = accessResult.rows.length > 0;
            } else if (req.user.role === 'athlete') {
                const accessResult = await query(`
          SELECT 1 FROM athletes a
          JOIN athlete_group ag ON a.id = ag.athlete_id
          WHERE a.user_id = $1 AND ag.group_id = $2 AND ag.is_active = true
        `, [req.user.id, event.group_id]);
                canAccess = accessResult.rows.length > 0;
            }

            if (!canAccess) {
                return res.status(403).json({ error: 'Non puoi accedere a questo evento' });
            }
        }

        // Ottieni le presenze
        const attendanceResult = await query(`
      SELECT 
        a.id, a.status, a.notes, a.marked_at,
        athlete.id as athlete_id, athlete.first_name, athlete.last_name,
        marker.first_name as marked_by_first_name, marker.last_name as marked_by_last_name
      FROM attendance a
      JOIN athletes athlete ON a.athlete_id = athlete.id
      LEFT JOIN users marker ON a.marked_by = marker.id
      WHERE a.event_id = $1
      ORDER BY athlete.last_name, athlete.first_name
    `, [eventId]);

        event.attendance = attendanceResult.rows;

        res.json({ event });

    } catch (error) {
        console.error('Errore nel recupero dei dettagli dell\'evento:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Crea un nuovo evento
router.post('/', requireRole(['admin', 'coach']), async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const {
            title, description, eventType, startDatetime, endDatetime,
            location, groupId, isRecurring = false, recurringPattern = null
        } = req.body;

        // Validazione
        if (!title || !startDatetime || !endDatetime || !eventType) {
            return res.status(400).json({
                error: 'Titolo, date e tipo evento sono obbligatori'
            });
        }

        // Verifica accesso al gruppo per i coach
        if (req.user.role === 'coach' && groupId) {
            const accessResult = await client.query(
                'SELECT 1 FROM staff_group WHERE user_id = $1 AND group_id = $2',
                [req.user.id, groupId]
            );

            if (accessResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi creare eventi per questo gruppo' });
            }
        }

        // Crea l'evento
        const eventResult = await client.query(`
      INSERT INTO events (
        title, description, event_type, start_datetime, end_datetime,
        location, group_id, created_by, is_recurring, recurring_pattern
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
            title, description, eventType, startDatetime, endDatetime,
            location, groupId, req.user.id, isRecurring, recurringPattern
        ]);

        const event = eventResult.rows[0];

        // Se l'evento è associato a un gruppo, crea le presenze per tutti gli atleti del gruppo
        if (groupId) {
            await client.query(`
        INSERT INTO attendance (event_id, athlete_id, status)
        SELECT $1, ag.athlete_id, 'pending'
        FROM athlete_group ag
        WHERE ag.group_id = $2 AND ag.is_active = true
      `, [event.id, groupId]);
        }

        await client.query('COMMIT');

        console.log(`📅 Nuovo evento creato: ${event.title} per il ${event.start_datetime}`);

        res.status(201).json({
            success: true,
            event,
            message: 'Evento creato con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nella creazione dell\'evento:', error);
        res.status(500).json({ error: 'Errore nella creazione dell\'evento' });
    } finally {
        client.release();
    }
});

// Aggiorna un evento
router.put('/:eventId', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { eventId } = req.params;
        const {
            title, description, eventType, startDatetime, endDatetime,
            location, isRecurring, recurringPattern
        } = req.body;

        // Verifica proprietà/accesso per i coach
        if (req.user.role === 'coach') {
            const accessResult = await query(`
        SELECT 1 FROM events e
        LEFT JOIN staff_group sg ON e.group_id = sg.group_id
        WHERE e.id = $1 AND (e.created_by = $2 OR sg.user_id = $2)
      `, [eventId, req.user.id]);

            if (accessResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi modificare questo evento' });
            }
        }

        const updateResult = await query(`
      UPDATE events SET
        title = $1, description = $2, event_type = $3,
        start_datetime = $4, end_datetime = $5, location = $6,
        is_recurring = $7, recurring_pattern = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 AND is_active = true
      RETURNING *
    `, [
            title, description, eventType, startDatetime, endDatetime,
            location, isRecurring, recurringPattern, eventId
        ]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Evento non trovato' });
        }

        console.log(`✏️ Evento aggiornato: ${updateResult.rows[0].title}`);

        res.json({
            success: true,
            event: updateResult.rows[0],
            message: 'Evento aggiornato con successo'
        });

    } catch (error) {
        console.error('Errore nell\'aggiornamento dell\'evento:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento dell\'evento' });
    }
});

// Segna presenza/assenza a un evento
router.post('/:eventId/attendance', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { athleteId, status, notes = '' } = req.body;

        if (!['present', 'absent', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Status non valido' });
        }

        // Verifica accesso all'atleta
        let canMark = false;

        if (req.user.role === 'admin' || req.user.role === 'coach') {
            canMark = true;
        } else if (req.user.role === 'parent') {
            const parentResult = await query(
                'SELECT 1 FROM parent_athlete WHERE parent_id = $1 AND athlete_id = $2',
                [req.user.id, athleteId]
            );
            canMark = parentResult.rows.length > 0;
        } else if (req.user.role === 'athlete') {
            const athleteResult = await query(
                'SELECT 1 FROM athletes WHERE id = $1 AND user_id = $2',
                [athleteId, req.user.id]
            );
            canMark = athleteResult.rows.length > 0;
        }

        if (!canMark) {
            return res.status(403).json({ error: 'Non puoi segnare la presenza per questo atleta' });
        }

        // Aggiorna o inserisci la presenza
        const attendanceResult = await query(`
      INSERT INTO attendance (event_id, athlete_id, status, notes, marked_by, marked_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (event_id, athlete_id)
      DO UPDATE SET 
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        marked_by = EXCLUDED.marked_by,
        marked_at = EXCLUDED.marked_at
      RETURNING *
    `, [eventId, athleteId, status, notes, req.user.id]);

        console.log(`✅ Presenza segnata: atleta ${athleteId} -> ${status} per evento ${eventId}`);

        res.json({
            success: true,
            attendance: attendanceResult.rows[0],
            message: 'Presenza segnata con successo'
        });

    } catch (error) {
        console.error('Errore nella segnalazione della presenza:', error);
        res.status(500).json({ error: 'Errore nella segnalazione della presenza' });
    }
});

// Elimina un evento
router.delete('/:eventId', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { eventId } = req.params;

        // Verifica proprietà/accesso per i coach
        if (req.user.role === 'coach') {
            const accessResult = await query(`
        SELECT 1 FROM events e
        LEFT JOIN staff_group sg ON e.group_id = sg.group_id
        WHERE e.id = $1 AND (e.created_by = $2 OR sg.user_id = $2)
      `, [eventId, req.user.id]);

            if (accessResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi eliminare questo evento' });
            }
        }

        const result = await query(
            'UPDATE events SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING title',
            [eventId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Evento non trovato' });
        }

        console.log(`🗑️ Evento eliminato: ${result.rows[0].title}`);

        res.json({
            success: true,
            message: 'Evento eliminato con successo'
        });

    } catch (error) {
        console.error('Errore nell\'eliminazione dell\'evento:', error);
        res.status(500).json({ error: 'Errore nell\'eliminazione dell\'evento' });
    }
});

module.exports = router;
