const express = require('express');
const crypto = require('crypto');
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
        ) as pending_count,
        (
          SELECT COUNT(*)
          FROM attendance a
          WHERE a.event_id = e.id AND a.status = 'called_up'
        ) as called_up_count
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

// Report riepilogo presenze per atleta
router.get('/reports/attendance-summary', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { groupId, startDate, endDate } = req.query;

        // Verifica accesso al gruppo per i coach
        if (req.user.role === 'coach' && groupId) {
            const accessResult = await query(
                'SELECT 1 FROM staff_group WHERE user_id = $1 AND group_id = $2',
                [req.user.id, groupId]
            );

            if (accessResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi accedere ai report di questo gruppo' });
            }
        }

        let groupFilterClause = '';
        const queryParams = [];
        let paramIndex = 1;

        if (groupId) {
            groupFilterClause = `AND ag.group_id = $${paramIndex}`;
            queryParams.push(groupId);
            paramIndex++;
        } else if (req.user.role === 'coach') {
            groupFilterClause = `AND ag.group_id IN (SELECT group_id FROM staff_group WHERE user_id = $${paramIndex})`;
            queryParams.push(req.user.id);
            paramIndex++;
        }

        let dateFilterClause;
        if (startDate) {
            dateFilterClause = `e.start_datetime >= $${paramIndex}`;
            queryParams.push(startDate);
            paramIndex++;
        } else {
            dateFilterClause = `e.start_datetime >= CURRENT_DATE - INTERVAL '90 days'`;
        }

        if (endDate) {
            dateFilterClause += ` AND e.start_datetime <= $${paramIndex}`;
            queryParams.push(endDate);
            paramIndex++;
        } else {
            dateFilterClause += ` AND e.start_datetime <= CURRENT_DATE + INTERVAL '1 day'`;
        }

        const summaryResult = await query(`
      SELECT
        athlete.id as athlete_id, athlete.first_name, athlete.last_name,
        COUNT(*) FILTER (WHERE a.status = 'absent') as notified_absences,
        COUNT(*) FILTER (WHERE a.actual_status = 'absent' AND a.status IN ('present', 'called_up', 'pending')) as unnotified_absences,
        COUNT(*) FILTER (WHERE a.actual_status = 'present') as confirmed_present,
        COUNT(DISTINCT a.event_id) as total_events
      FROM athletes athlete
      JOIN athlete_group ag ON ag.athlete_id = athlete.id AND ag.is_active = true
      JOIN attendance a ON a.athlete_id = athlete.id
      JOIN events e ON e.id = a.event_id AND e.is_active = true
      WHERE ${dateFilterClause} ${groupFilterClause}
      GROUP BY athlete.id, athlete.first_name, athlete.last_name
      ORDER BY athlete.last_name, athlete.first_name
    `, queryParams);

        res.json({ summary: summaryResult.rows });

    } catch (error) {
        console.error('Errore nel recupero del report presenze:', error);
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
        a.actual_status, a.actual_marked_at,
        athlete.id as athlete_id, athlete.first_name, athlete.last_name, athlete.user_id as athlete_user_id,
        marker.first_name as marked_by_first_name, marker.last_name as marked_by_last_name,
        actual_marker.first_name as actual_marked_by_first_name, actual_marker.last_name as actual_marked_by_last_name
      FROM attendance a
      JOIN athletes athlete ON a.athlete_id = athlete.id
      LEFT JOIN users marker ON a.marked_by = marker.id
      LEFT JOIN users actual_marker ON a.actual_marked_by = actual_marker.id
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
            location, groupId, isRecurring = false, recurringPattern = null,
            recurringUntil = null
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

        // Calcola le date di inizio/fine per ciascuna occorrenza
        const occurrenceDates = [];
        const startDate = new Date(startDatetime);
        const endDate = new Date(endDatetime);
        const duration = endDate.getTime() - startDate.getTime();

        if (isRecurring && recurringUntil) {
            const untilDate = new Date(`${recurringUntil}T23:59:59`);
            const MAX_OCCURRENCES = 104; // ~2 anni

            let currentStart = new Date(startDate.getTime());
            let count = 0;

            while (currentStart.getTime() <= untilDate.getTime() && count < MAX_OCCURRENCES) {
                occurrenceDates.push({
                    start: new Date(currentStart.getTime()),
                    end: new Date(currentStart.getTime() + duration)
                });
                currentStart = new Date(currentStart.getTime() + 7 * 24 * 60 * 60 * 1000);
                count++;
            }
        } else {
            occurrenceDates.push({ start: startDate, end: endDate });
        }

        const recurringGroupId = (isRecurring && recurringUntil) ? crypto.randomUUID() : null;
        const finalRecurringPattern = (isRecurring && recurringUntil)
            ? JSON.stringify({ frequency: 'weekly', until: recurringUntil })
            : recurringPattern;

        const createdEvents = [];

        for (const occurrence of occurrenceDates) {
            const eventResult = await client.query(`
        INSERT INTO events (
          title, description, event_type, start_datetime, end_datetime,
          location, group_id, created_by, is_recurring, recurring_pattern, recurring_group_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
                title, description, eventType, occurrence.start, occurrence.end,
                location, groupId, req.user.id, isRecurring, finalRecurringPattern, recurringGroupId
            ]);

            const event = eventResult.rows[0];

            // Se l'evento è associato a un gruppo, crea le presenze per tutti gli atleti del gruppo
            // Per gli allenamenti sono sempre tutti convocati; per gli altri tipi di evento
            // (partita, riunione) restano da convocare esplicitamente
            if (groupId) {
                const initialStatus = eventType === 'training' ? 'called_up' : 'pending';
                await client.query(`
          INSERT INTO attendance (event_id, athlete_id, status)
          SELECT $1, ag.athlete_id, $3
          FROM athlete_group ag
          WHERE ag.group_id = $2 AND ag.is_active = true
        `, [event.id, groupId, initialStatus]);
            }

            createdEvents.push(event);
        }

        await client.query('COMMIT');

        console.log(`📅 ${createdEvents.length} evento/i creato/i: ${createdEvents[0].title} per il ${createdEvents[0].start_datetime}`);

        res.status(201).json({
            success: true,
            event: createdEvents[0],
            events: createdEvents,
            count: createdEvents.length,
            message: createdEvents.length > 1
                ? `${createdEvents.length} eventi creati con successo`
                : 'Evento creato con successo'
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

        if (!['present', 'absent', 'pending', 'called_up'].includes(status)) {
            return res.status(400).json({ error: 'Status non valido' });
        }

        if (status === 'called_up' && (req.user.role === 'parent' || req.user.role === 'athlete')) {
            return res.status(403).json({ error: 'Solo lo staff può convocare gli atleti' });
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

// Convoca in blocco gli atleti di un evento
router.post('/:eventId/convene', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { eventId } = req.params;
        const { athleteIds } = req.body;

        const eventResult = await query(
            'SELECT id, group_id FROM events WHERE id = $1 AND is_active = true',
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ error: 'Evento non trovato' });
        }

        const event = eventResult.rows[0];

        if (!event.group_id) {
            return res.status(400).json({ error: 'Evento non associato a un gruppo' });
        }

        // Verifica accesso al gruppo per i coach
        if (req.user.role === 'coach') {
            const accessResult = await query(
                'SELECT 1 FROM staff_group WHERE user_id = $1 AND group_id = $2',
                [req.user.id, event.group_id]
            );

            if (accessResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi convocare atleti per questo gruppo' });
            }
        }

        let convenedResult;

        if (Array.isArray(athleteIds) && athleteIds.length > 0) {
            convenedResult = await query(`
        INSERT INTO attendance (event_id, athlete_id, status, marked_by, marked_at)
        SELECT $1, athlete_id, 'called_up', $2, CURRENT_TIMESTAMP
        FROM UNNEST($3::int[]) AS athlete_id
        ON CONFLICT (event_id, athlete_id)
        DO UPDATE SET
          status = 'called_up',
          marked_by = EXCLUDED.marked_by,
          marked_at = EXCLUDED.marked_at
        WHERE attendance.status = 'pending'
        RETURNING *
      `, [eventId, req.user.id, athleteIds]);
        } else {
            convenedResult = await query(`
        INSERT INTO attendance (event_id, athlete_id, status, marked_by, marked_at)
        SELECT $1, ag.athlete_id, 'called_up', $2, CURRENT_TIMESTAMP
        FROM athlete_group ag
        WHERE ag.group_id = $3 AND ag.is_active = true
        ON CONFLICT (event_id, athlete_id)
        DO UPDATE SET
          status = 'called_up',
          marked_by = EXCLUDED.marked_by,
          marked_at = EXCLUDED.marked_at
        WHERE attendance.status = 'pending'
        RETURNING *
      `, [eventId, req.user.id, event.group_id]);
        }

        console.log(`📣 Convocazione: ${convenedResult.rows.length} atleti convocati per evento ${eventId}`);

        res.json({
            success: true,
            convened: convenedResult.rows.length
        });

    } catch (error) {
        console.error('Errore nella convocazione degli atleti:', error);
        res.status(500).json({ error: 'Errore nella convocazione degli atleti' });
    }
});

// Segna la presenza reale confermata dal coach (indipendente dall'RSVP)
router.post('/:eventId/actual-attendance', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { eventId } = req.params;
        const { athleteId, actualStatus } = req.body;

        if (!['present', 'absent'].includes(actualStatus)) {
            return res.status(400).json({ error: 'Status non valido' });
        }

        const eventResult = await query(
            'SELECT id, group_id FROM events WHERE id = $1 AND is_active = true',
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ error: 'Evento non trovato' });
        }

        const event = eventResult.rows[0];

        // Verifica accesso al gruppo per i coach
        if (req.user.role === 'coach') {
            const accessResult = await query(
                'SELECT 1 FROM staff_group WHERE user_id = $1 AND group_id = $2',
                [req.user.id, event.group_id]
            );

            if (accessResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi segnare la presenza per questo gruppo' });
            }
        }

        const attendanceResult = await query(`
      INSERT INTO attendance (event_id, athlete_id, status, actual_status, actual_marked_by, actual_marked_at)
      VALUES ($1, $2, 'pending', $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (event_id, athlete_id)
      DO UPDATE SET
        actual_status = EXCLUDED.actual_status,
        actual_marked_by = EXCLUDED.actual_marked_by,
        actual_marked_at = EXCLUDED.actual_marked_at
      RETURNING *
    `, [eventId, athleteId, actualStatus, req.user.id]);

        console.log(`🎯 Presenza reale segnata: atleta ${athleteId} -> ${actualStatus} per evento ${eventId}`);

        res.json({
            success: true,
            attendance: attendanceResult.rows[0]
        });

    } catch (error) {
        console.error('Errore nella segnalazione della presenza reale:', error);
        res.status(500).json({ error: 'Errore nella segnalazione della presenza reale' });
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
