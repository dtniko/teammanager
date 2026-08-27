const express = require('express');
const { query, getClient } = require('../config/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Ottieni tutte le stagioni
router.get('/', async (req, res) => {
    try {
        const seasonsResult = await query(`
      SELECT id, name, start_date, end_date, is_current, created_at
      FROM seasons
      ORDER BY id DESC
    `);

        res.json({ seasons: seasonsResult.rows });

    } catch (error) {
        console.error('Errore nel recupero delle stagioni:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Crea nuova stagione
router.post('/', requireRole(['admin', 'coach']), async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const { name, startDate, endDate, isCurrent = false } = req.body;

        if (!name) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Il nome della stagione è obbligatorio' });
        }

        if (isCurrent) {
            await client.query('UPDATE seasons SET is_current = false');
        }

        const seasonResult = await client.query(`
      INSERT INTO seasons (name, start_date, end_date, is_current)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, startDate || null, endDate || null, isCurrent]);

        await client.query('COMMIT');

        console.log(`📅 Stagione creata: ${name}`);

        res.status(201).json({
            success: true,
            season: seasonResult.rows[0],
            message: 'Stagione creata con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nella creazione della stagione:', error);
        res.status(500).json({ error: 'Errore nella creazione della stagione' });
    } finally {
        client.release();
    }
});

// Imposta stagione corrente
router.patch('/:seasonId/set-current', requireRole(['admin', 'coach']), async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const { seasonId } = req.params;

        const seasonResult = await client.query('SELECT id FROM seasons WHERE id = $1', [seasonId]);

        if (seasonResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Stagione non trovata' });
        }

        await client.query('UPDATE seasons SET is_current = false');
        const updateResult = await client.query(
            'UPDATE seasons SET is_current = true WHERE id = $1 RETURNING *',
            [seasonId]
        );

        await client.query('COMMIT');

        console.log(`📅 Stagione corrente impostata: ${updateResult.rows[0].name}`);

        res.json({
            success: true,
            season: updateResult.rows[0],
            message: 'Stagione corrente aggiornata con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nell\'impostazione della stagione corrente:', error);
        res.status(500).json({ error: 'Errore nell\'impostazione della stagione corrente' });
    } finally {
        client.release();
    }
});

// Aggiorna una stagione esistente
router.patch('/:seasonId', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { seasonId } = req.params;
        const { name, startDate, endDate } = req.body;

        const existingResult = await query('SELECT * FROM seasons WHERE id = $1', [seasonId]);

        if (existingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Stagione non trovata' });
        }

        const existing = existingResult.rows[0];

        const updateResult = await query(`
      UPDATE seasons
      SET name = $1, start_date = $2, end_date = $3
      WHERE id = $4
      RETURNING *
    `, [
            name !== undefined ? name : existing.name,
            startDate !== undefined ? startDate : existing.start_date,
            endDate !== undefined ? endDate : existing.end_date,
            seasonId
        ]);

        console.log(`📅 Stagione aggiornata: ${updateResult.rows[0].name}`);

        res.json({
            success: true,
            season: updateResult.rows[0],
            message: 'Stagione aggiornata con successo'
        });

    } catch (error) {
        console.error('Errore nell\'aggiornamento della stagione:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento della stagione' });
    }
});

module.exports = router;
