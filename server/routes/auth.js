const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { verifyGoogleToken, authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Login con email e password
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e password sono obbligatorie' });
        }

        const userResult = await query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email]
        );

        if (userResult.rows.length === 0 || !userResult.rows[0].password_hash) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        const user = userResult.rows[0];

        const passwordMatches = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatches) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`🔑 Login utente (email/password): ${user.email} (${user.role})`);

        res.json({
            success: true,
            token,
            mustChangePassword: user.must_change_password,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Errore nel login:', error);
        res.status(500).json({
            error: 'Errore nel login',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Cambio password
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'La nuova password deve avere almeno 8 caratteri' });
        }

        const userResult = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        const user = userResult.rows[0];

        if (!user.must_change_password) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Password attuale richiesta' });
            }

            const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash || '');

            if (!passwordMatches) {
                return res.status(401).json({ error: 'Password attuale non valida' });
            }
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        await query(
            'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newPasswordHash, user.id]
        );

        console.log(`🔐 Password cambiata per: ${user.email}`);

        res.json({
            success: true,
            message: 'Password aggiornata con successo'
        });

    } catch (error) {
        console.error('Errore nel cambio password:', error);
        res.status(500).json({ error: 'Errore nel cambio password' });
    }
});

// Login con Google
router.post('/google', async (req, res) => {
    try {
        const { googleToken } = req.body;

        if (!googleToken) {
            return res.status(400).json({ error: 'Token Google richiesto' });
        }

        // Verifica il token Google
        const googleUser = await verifyGoogleToken(googleToken);

        // Cerca l'utente nel database
        let userResult = await query(
            'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE google_id = $1 OR email = $2',
            [googleUser.googleId, googleUser.email]
        );

        let user;

        if (userResult.rows.length === 0) {
            // Nuovo utente - crea un account come genitore di default
            const insertResult = await query(`
        INSERT INTO users (google_id, email, first_name, last_name, role, avatar_url) 
        VALUES ($1, $2, $3, $4, 'parent', $5) 
        RETURNING id, email, first_name, last_name, role, is_active
      `, [
                googleUser.googleId,
                googleUser.email,
                googleUser.firstName,
                googleUser.lastName,
                googleUser.avatarUrl
            ]);

            user = insertResult.rows[0];
            console.log(`👤 Nuovo utente registrato: ${user.email} (${user.role})`);
        } else {
            user = userResult.rows[0];

            // Aggiorna il google_id se mancante
            if (!user.google_id) {
                await query(
                    'UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3',
                    [googleUser.googleId, googleUser.avatarUrl, user.id]
                );
            }

            console.log(`🔑 Login utente: ${user.email} (${user.role})`);
        }

        // Verifica che l'utente sia attivo
        if (!user.is_active) {
            return res.status(401).json({ error: 'Account disattivato. Contatta l\'amministratore.' });
        }

        // Genera JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Ottieni informazioni aggiuntive in base al ruolo
        let additionalData = {};

        if (user.role === 'parent') {
            // Ottieni gli atleti associati al genitore
            const athletesResult = await query(`
        SELECT a.id, a.first_name, a.last_name, a.date_of_birth
        FROM athletes a
        JOIN parent_athlete pa ON a.id = pa.athlete_id
        WHERE pa.parent_id = $1 AND a.is_active = true
      `, [user.id]);

            additionalData.athletes = athletesResult.rows;
        } else if (user.role === 'athlete') {
            // Ottieni i dati dell'atleta
            const athleteResult = await query(
                'SELECT id, first_name, last_name, date_of_birth FROM athletes WHERE user_id = $1 AND is_active = true',
                [user.id]
            );

            if (athleteResult.rows.length > 0) {
                additionalData.athleteProfile = athleteResult.rows[0];
            }
        } else if (user.role === 'coach') {
            // Ottieni i gruppi gestiti dal coach
            const groupsResult = await query(`
        SELECT g.id, g.name, g.description
        FROM groups g
        JOIN staff_group sg ON g.id = sg.group_id
        WHERE sg.user_id = $1 AND g.is_active = true
      `, [user.id]);

            additionalData.managedGroups = groupsResult.rows;
        }

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                ...additionalData
            }
        });

    } catch (error) {
        console.error('Errore nel login Google:', error);
        res.status(500).json({
            error: 'Errore nel login',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Verifica del token
router.get('/verify', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token mancante' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verifica che l'utente esista ancora
        const userResult = await query(
            'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
            return res.status(401).json({ error: 'Utente non valido' });
        }

        const user = userResult.rows[0];

        // Ottieni informazioni aggiuntive in base al ruolo
        let additionalData = {};

        if (user.role === 'parent') {
            // Ottieni gli atleti associati al genitore
            const athletesResult = await query(`
        SELECT a.id, a.first_name, a.last_name, a.date_of_birth
        FROM athletes a
        JOIN parent_athlete pa ON a.id = pa.athlete_id
        WHERE pa.parent_id = $1 AND a.is_active = true
      `, [user.id]);

            additionalData.athletes = athletesResult.rows;
        } else if (user.role === 'athlete') {
            // Ottieni i dati dell'atleta
            const athleteResult = await query(
                'SELECT id, first_name, last_name, date_of_birth FROM athletes WHERE user_id = $1 AND is_active = true',
                [user.id]
            );

            if (athleteResult.rows.length > 0) {
                additionalData.athleteProfile = athleteResult.rows[0];
            }
        } else if (user.role === 'coach') {
            // Ottieni i gruppi gestiti dal coach
            const groupsResult = await query(`
        SELECT g.id, g.name, g.description
        FROM groups g
        JOIN staff_group sg ON g.id = sg.group_id
        WHERE sg.user_id = $1 AND g.is_active = true
      `, [user.id]);

            additionalData.managedGroups = groupsResult.rows;
        }

        res.json({
            valid: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                ...additionalData
            }
        });

    } catch (error) {
        console.error('Errore nella verifica del token:', error);
        res.status(401).json({ error: 'Token non valido' });
    }
});

// Logout (lato client, invalida il token)
router.post('/logout', (req, res) => {
    // Nel caso di JWT, il logout avviene principalmente lato client
    // Qui possiamo loggare l'evento o invalidare il token se necessario
    res.json({ success: true, message: 'Logout effettuato' });
});

// Refresh token
router.post('/refresh', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token mancante' });
    }

    try {
        // Verifica il token anche se scaduto (per il refresh)
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });

        // Verifica che l'utente esista ancora
        const userResult = await query(
            'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
            return res.status(401).json({ error: 'Utente non valido' });
        }

        const user = userResult.rows[0];

        // Genera nuovo token
        const newToken = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Ottieni informazioni aggiuntive in base al ruolo
        let additionalData = {};

        if (user.role === 'parent') {
            const athletesResult = await query(`
        SELECT a.id, a.first_name, a.last_name, a.date_of_birth
        FROM athletes a
        JOIN parent_athlete pa ON a.id = pa.athlete_id
        WHERE pa.parent_id = $1 AND a.is_active = true
      `, [user.id]);
            additionalData.athletes = athletesResult.rows;
        } else if (user.role === 'athlete') {
            const athleteResult = await query(
                'SELECT id, first_name, last_name, date_of_birth FROM athletes WHERE user_id = $1 AND is_active = true',
                [user.id]
            );
            if (athleteResult.rows.length > 0) {
                additionalData.athleteProfile = athleteResult.rows[0];
            }
        }

        res.json({
            success: true,
            token: newToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                ...additionalData
            }
        });

    } catch (error) {
        console.error('Errore nel refresh del token:', error);
        res.status(401).json({ error: 'Impossibile rinnovare il token' });
    }
});

module.exports = router;
