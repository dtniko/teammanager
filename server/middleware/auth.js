const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../config/database');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verifica del token JWT
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Token di accesso richiesto' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verifica che l'utente esista ancora nel database
        const userResult = await query(
            'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = $1 AND is_active = true',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Utente non trovato o disattivato' });
        }

        req.user = {
            id: decoded.userId,
            email: userResult.rows[0].email,
            firstName: userResult.rows[0].first_name,
            lastName: userResult.rows[0].last_name,
            role: userResult.rows[0].role
        };

        next();
    } catch (error) {
        console.error('Errore nella verifica del token:', error);
        return res.status(403).json({ error: 'Token non valido' });
    }
};

// Verifica del token Google
const verifyGoogleToken = async (googleToken) => {
    try {
        const ticket = await client.verifyIdToken({
            idToken: googleToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        return {
            googleId: payload.sub,
            email: payload.email,
            firstName: payload.given_name,
            lastName: payload.family_name,
            avatarUrl: payload.picture,
            emailVerified: payload.email_verified
        };
    } catch (error) {
        console.error('Errore nella verifica del token Google:', error);
        throw new Error('Token Google non valido');
    }
};

// Middleware per verificare i ruoli
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Autenticazione richiesta' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Permessi insufficienti',
                required: allowedRoles,
                current: req.user.role
            });
        }

        next();
    };
};

// Middleware per verificare l'accesso agli atleti
const canAccessAthlete = async (req, res, next) => {
    const athleteId = req.params.athleteId || req.body.athleteId;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!athleteId) {
        return res.status(400).json({ error: 'ID atleta richiesto' });
    }

    try {
        // Admin e coach possono accedere a tutti gli atleti
        if (userRole === 'admin' || userRole === 'coach') {
            return next();
        }

        // Gli atleti possono accedere solo ai propri dati
        if (userRole === 'athlete') {
            const athleteResult = await query(
                'SELECT id FROM athletes WHERE id = $1 AND user_id = $2',
                [athleteId, userId]
            );

            if (athleteResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi accedere a questo atleta' });
            }

            return next();
        }

        // I genitori possono accedere solo ai propri figli
        if (userRole === 'parent') {
            const parentResult = await query(
                'SELECT id FROM parent_athlete WHERE parent_id = $1 AND athlete_id = $2',
                [userId, athleteId]
            );

            if (parentResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi accedere a questo atleta' });
            }

            return next();
        }

        return res.status(403).json({ error: 'Accesso negato' });
    } catch (error) {
        console.error('Errore nella verifica dell\'accesso all\'atleta:', error);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
};

// Middleware per verificare l'accesso ai gruppi
const canAccessGroup = async (req, res, next) => {
    const groupId = req.params.groupId || req.body.groupId;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!groupId) {
        return res.status(400).json({ error: 'ID gruppo richiesto' });
    }

    try {
        // Admin possono accedere a tutti i gruppi
        if (userRole === 'admin') {
            return next();
        }

        // Coach possono accedere solo ai gruppi che gestiscono
        if (userRole === 'coach') {
            const staffResult = await query(
                'SELECT id FROM staff_group WHERE user_id = $1 AND group_id = $2',
                [userId, groupId]
            );

            if (staffResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi accedere a questo gruppo' });
            }

            return next();
        }

        // Genitori e atleti possono accedere solo ai gruppi dei loro atleti
        if (userRole === 'parent' || userRole === 'athlete') {
            let athleteIds = [];

            if (userRole === 'parent') {
                const parentAthletesResult = await query(
                    'SELECT athlete_id FROM parent_athlete WHERE parent_id = $1',
                    [userId]
                );
                athleteIds = parentAthletesResult.rows.map(row => row.athlete_id);
            } else {
                const athleteResult = await query(
                    'SELECT id FROM athletes WHERE user_id = $1',
                    [userId]
                );
                athleteIds = athleteResult.rows.map(row => row.id);
            }

            if (athleteIds.length === 0) {
                return res.status(403).json({ error: 'Nessun atleta associato' });
            }

            const groupAccessResult = await query(
                'SELECT id FROM athlete_group WHERE athlete_id = ANY($1) AND group_id = $2 AND is_active = true',
                [athleteIds, groupId]
            );

            if (groupAccessResult.rows.length === 0) {
                return res.status(403).json({ error: 'Non puoi accedere a questo gruppo' });
            }

            return next();
        }

        return res.status(403).json({ error: 'Accesso negato' });
    } catch (error) {
        console.error('Errore nella verifica dell\'accesso al gruppo:', error);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
};

module.exports = {
    authenticateToken,
    verifyGoogleToken,
    requireRole,
    canAccessAthlete,
    canAccessGroup
};
