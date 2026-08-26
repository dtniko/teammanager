const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/email');

const router = express.Router();

// Ottieni profilo utente corrente
router.get('/profile', async (req, res) => {
    try {
        const userResult = await query(`
      SELECT id, email, first_name, last_name, role, phone, avatar_url, created_at
      FROM users 
      WHERE id = $1 AND is_active = true
    `, [req.user.id]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        const user = userResult.rows[0];

        // Aggiungi informazioni specifiche per ruolo
        if (user.role === 'parent') {
            const athletesResult = await query(`
        SELECT a.id, a.first_name, a.last_name, a.date_of_birth,
               pa.relationship, pa.can_edit
        FROM athletes a
        JOIN parent_athlete pa ON a.id = pa.athlete_id
        WHERE pa.parent_id = $1 AND a.is_active = true
      `, [user.id]);

            user.athletes = athletesResult.rows;
        } else if (user.role === 'athlete') {
            const athleteResult = await query(
                'SELECT id, first_name, last_name, date_of_birth FROM athletes WHERE user_id = $1 AND is_active = true',
                [user.id]
            );

            if (athleteResult.rows.length > 0) {
                user.athleteProfile = athleteResult.rows[0];
            }
        } else if (user.role === 'coach') {
            const groupsResult = await query(`
        SELECT g.id, g.name, g.description, sg.role as group_role, sg.can_manage
        FROM groups g
        JOIN staff_group sg ON g.id = sg.group_id
        WHERE sg.user_id = $1 AND g.is_active = true
      `, [user.id]);

            user.managedGroups = groupsResult.rows;
        }

        res.json({ user });

    } catch (error) {
        console.error('Errore nel recupero del profilo:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Aggiorna profilo utente
router.put('/profile', async (req, res) => {
    try {
        const { firstName, lastName, phone } = req.body;

        const updateResult = await query(`
      UPDATE users SET
        first_name = $1, last_name = $2, phone = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND is_active = true
      RETURNING id, email, first_name, last_name, role, phone, avatar_url
    `, [firstName, lastName, phone, req.user.id]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        console.log(`✏️ Profilo aggiornato: ${updateResult.rows[0].first_name} ${updateResult.rows[0].last_name}`);

        res.json({
            success: true,
            user: updateResult.rows[0],
            message: 'Profilo aggiornato con successo'
        });

    } catch (error) {
        console.error('Errore nell\'aggiornamento del profilo:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento del profilo' });
    }
});

// Crea nuovo utente (solo admin)
router.post('/', requireRole(['admin']), async (req, res) => {
    try {
        const { email, firstName, lastName, role, phone } = req.body;

        if (!email || !firstName || !lastName || !role) {
            return res.status(400).json({ error: 'Email, nome, cognome e ruolo sono obbligatori' });
        }

        if (!['admin', 'coach', 'parent', 'athlete'].includes(role)) {
            return res.status(400).json({ error: 'Ruolo non valido' });
        }

        const existingResult = await query('SELECT id FROM users WHERE email = $1', [email]);

        if (existingResult.rows.length > 0) {
            return res.status(409).json({ error: 'Email già registrata' });
        }

        const temporaryPassword = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);

        const insertResult = await query(`
      INSERT INTO users (email, first_name, last_name, role, phone, password_hash, must_change_password)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, email, first_name, last_name, role, phone, is_active, created_at
    `, [email, firstName, lastName, role, phone || null, passwordHash]);

        const user = insertResult.rows[0];

        console.log(`👤 Nuovo utente creato da admin: ${user.email} (${user.role})`);

        const result = await sendWelcomeEmail({ to: email, firstName, temporaryPassword });

        res.status(201).json({
            success: true,
            user,
            emailSent: result.sent,
            temporaryPassword: result.sent ? undefined : temporaryPassword
        });

    } catch (error) {
        console.error('Errore nella creazione dell\'utente:', error);
        res.status(500).json({ error: 'Errore nella creazione dell\'utente' });
    }
});

// Ottieni tutti gli utenti (solo admin)
router.get('/', requireRole(['admin']), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            role = '',
            search = '',
            active = 'true'
        } = req.query;

        const offset = (page - 1) * limit;

        let whereConditions = ['u.is_active = $1'];
        let queryParams = [active === 'true'];
        let paramIndex = 2;

        // Filtro per ruolo
        if (role) {
            whereConditions.push(`u.role = $${paramIndex}`);
            queryParams.push(role);
            paramIndex++;
        }

        // Filtro per ricerca
        if (search) {
            whereConditions.push(`(
        LOWER(u.first_name) LIKE LOWER($${paramIndex}) OR 
        LOWER(u.last_name) LIKE LOWER($${paramIndex}) OR
        LOWER(u.email) LIKE LOWER($${paramIndex})
      )`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const usersResult = await query(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.role, u.phone,
        u.is_active, u.created_at,
        CASE u.role
          WHEN 'parent' THEN (
            SELECT COUNT(*) FROM parent_athlete pa 
            JOIN athletes a ON pa.athlete_id = a.id 
            WHERE pa.parent_id = u.id AND a.is_active = true
          )
          WHEN 'coach' THEN (
            SELECT COUNT(*) FROM staff_group sg 
            JOIN groups g ON sg.group_id = g.id 
            WHERE sg.user_id = u.id AND g.is_active = true
          )
          ELSE 0
        END as related_count
      FROM users u
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset]);

        // Conta totale per paginazione
        const countResult = await query(`
      SELECT COUNT(*) as total
      FROM users u
      WHERE ${whereClause}
    `, queryParams);

        res.json({
            users: usersResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                pages: Math.ceil(countResult.rows[0].total / limit)
            }
        });

    } catch (error) {
        console.error('Errore nel recupero degli utenti:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Ottieni dettagli di un utente (solo admin)
router.get('/:userId', requireRole(['admin']), async (req, res) => {
    try {
        const { userId } = req.params;

        const userResult = await query(`
      SELECT u.*, 
             COUNT(DISTINCT n.id) as notification_count,
             COUNT(DISTINCT CASE WHEN n.is_read = false THEN n.id END) as unread_notifications
      FROM users u
      LEFT JOIN notifications n ON u.id = n.user_id
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        const user = userResult.rows[0];

        // Aggiungi dettagli specifici per ruolo
        if (user.role === 'parent') {
            const athletesResult = await query(`
        SELECT a.id, a.first_name, a.last_name, a.date_of_birth,
               pa.relationship, pa.can_edit
        FROM athletes a
        JOIN parent_athlete pa ON a.id = pa.athlete_id
        WHERE pa.parent_id = $1
      `, [userId]);

            user.athletes = athletesResult.rows;
        } else if (user.role === 'coach') {
            const groupsResult = await query(`
        SELECT g.id, g.name, g.description, sg.role as group_role, sg.can_manage
        FROM groups g
        JOIN staff_group sg ON g.id = sg.group_id
        WHERE sg.user_id = $1
      `, [userId]);

            user.managedGroups = groupsResult.rows;
        } else if (user.role === 'athlete') {
            const athleteResult = await query(
                'SELECT * FROM athletes WHERE user_id = $1',
                [userId]
            );

            if (athleteResult.rows.length > 0) {
                user.athleteProfile = athleteResult.rows[0];
            }
        }

        res.json({ user });

    } catch (error) {
        console.error('Errore nel recupero dei dettagli utente:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Aggiorna ruolo utente (solo admin)
router.patch('/:userId/role', requireRole(['admin']), async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const { userId } = req.params;
        const { role } = req.body;

        if (!['admin', 'coach', 'parent', 'athlete'].includes(role)) {
            return res.status(400).json({ error: 'Ruolo non valido' });
        }

        // Non permettere di modificare il proprio ruolo
        if (userId == req.user.id) {
            return res.status(400).json({ error: 'Non puoi modificare il tuo stesso ruolo' });
        }

        const updateResult = await client.query(`
      UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND is_active = true
      RETURNING first_name, last_name, email
    `, [role, userId]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        await client.query('COMMIT');

        console.log(`🔄 Ruolo cambiato per ${updateResult.rows[0].first_name} ${updateResult.rows[0].last_name}: ${role}`);

        res.json({
            success: true,
            message: 'Ruolo aggiornato con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nell\'aggiornamento del ruolo:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento del ruolo' });
    } finally {
        client.release();
    }
});

// Attiva/Disattiva utente (solo admin)
router.patch('/:userId/status', requireRole(['admin']), async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;

        // Non permettere di disattivare se stessi
        if (userId == req.user.id && !isActive) {
            return res.status(400).json({ error: 'Non puoi disattivare il tuo stesso account' });
        }

        const updateResult = await query(`
      UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING first_name, last_name, email
    `, [isActive, userId]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        console.log(`${isActive ? '✅' : '❌'} Utente ${isActive ? 'attivato' : 'disattivato'}: ${updateResult.rows[0].first_name} ${updateResult.rows[0].last_name}`);

        res.json({
            success: true,
            message: `Utente ${isActive ? 'attivato' : 'disattivato'} con successo`
        });

    } catch (error) {
        console.error('Errore nel cambio di stato dell\'utente:', error);
        res.status(500).json({ error: 'Errore nel cambio di stato dell\'utente' });
    }
});

// Cerca utenti per email (per associazioni)
router.get('/search/email', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { email } = req.query;

        if (!email || email.length < 3) {
            return res.status(400).json({ error: 'Email deve avere almeno 3 caratteri' });
        }

        const usersResult = await query(`
      SELECT id, email, first_name, last_name, role
      FROM users 
      WHERE LOWER(email) LIKE LOWER($1) AND is_active = true
      ORDER BY email
      LIMIT 10
    `, [`%${email}%`]);

        res.json({ users: usersResult.rows });

    } catch (error) {
        console.error('Errore nella ricerca utenti:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Ottieni statistiche utenti (solo admin)
router.get('/stats/overview', requireRole(['admin']), async (req, res) => {
    try {
        const statsResult = await query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'coach' THEN 1 END) as coaches,
        COUNT(CASE WHEN role = 'parent' THEN 1 END) as parents,
        COUNT(CASE WHEN role = 'athlete' THEN 1 END) as athletes,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_users,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_this_month
      FROM users
    `);

        const recentActivityResult = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as registrations
      FROM users 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

        res.json({
            overview: statsResult.rows[0],
            recentActivity: recentActivityResult.rows
        });

    } catch (error) {
        console.error('Errore nel recupero delle statistiche:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Elimina utente (solo admin, soft delete)
router.delete('/:userId', requireRole(['admin']), async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const { userId } = req.params;

        // Non permettere di eliminare se stessi
        if (userId == req.user.id) {
            return res.status(400).json({ error: 'Non puoi eliminare il tuo stesso account' });
        }

        // Disattiva l'utente invece di eliminare
        const updateResult = await client.query(`
      UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING first_name, last_name, email
    `, [userId]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        // Rimuovi da tutte le associazioni attive
        await client.query('DELETE FROM staff_group WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM parent_athlete WHERE parent_id = $1', [userId]);

        await client.query('COMMIT');

        console.log(`🗑️ Utente eliminato: ${updateResult.rows[0].first_name} ${updateResult.rows[0].last_name}`);

        res.json({
            success: true,
            message: 'Utente eliminato con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nell\'eliminazione dell\'utente:', error);
        res.status(500).json({ error: 'Errore nell\'eliminazione dell\'utente' });
    } finally {
        client.release();
    }
});

module.exports = router;
