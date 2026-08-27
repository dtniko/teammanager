const express = require('express');
const multer = require('multer');
const path = require('path');
const { query, getClient } = require('../config/database');
const { requireRole, canAccessAthlete } = require('../middleware/auth');
const { supabase, DOCUMENTS_BUCKET } = require('../config/supabaseStorage');

const router = express.Router();

// Configurazione multer per upload documenti (in memoria, poi caricati su Supabase Storage)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Tipi di file accettati
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo di file non supportato. Sono accettati: JPEG, PNG, GIF, PDF, DOC, DOCX'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Ottieni documenti di un atleta
router.get('/athlete/:athleteId', canAccessAthlete, async (req, res) => {
    try {
        const { athleteId } = req.params;
        const { seasonId, documentType, includeExpired = 'false' } = req.query;

        let whereConditions = ['d.athlete_id = $1'];
        let queryParams = [athleteId];
        let paramIndex = 2;

        // Filtro per stagione
        if (seasonId) {
            whereConditions.push(`d.season_id = $${paramIndex}`);
            queryParams.push(seasonId);
            paramIndex++;
        }

        // Filtro per tipo documento
        if (documentType) {
            whereConditions.push(`d.document_type = $${paramIndex}`);
            queryParams.push(documentType);
            paramIndex++;
        }

        // Esclusione documenti scaduti se richiesto
        if (includeExpired === 'false') {
            whereConditions.push('(d.expiry_date IS NULL OR d.expiry_date > CURRENT_DATE)');
        }

        const whereClause = whereConditions.join(' AND ');

        const documentsResult = await query(`
      SELECT 
        d.id, d.title, d.filename, d.document_type, d.expiry_date,
        d.file_size, d.mime_type, d.notes, d.is_valid, d.created_at,
        s.name as season_name,
        u.first_name as uploaded_by_first_name, u.last_name as uploaded_by_last_name,
        CASE 
          WHEN d.expiry_date IS NOT NULL AND d.expiry_date <= CURRENT_DATE + INTERVAL '30 days' 
          THEN true 
          ELSE false 
        END as expiring_soon,
        CASE 
          WHEN d.expiry_date IS NOT NULL AND d.expiry_date < CURRENT_DATE 
          THEN true 
          ELSE false 
        END as expired
      FROM documents d
      LEFT JOIN seasons s ON d.season_id = s.id
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE ${whereClause}
      ORDER BY d.created_at DESC
    `, queryParams);

        res.json({ documents: documentsResult.rows });

    } catch (error) {
        console.error('Errore nel recupero dei documenti:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Upload documento
router.post('/upload', upload.single('document'), async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        if (!req.file) {
            return res.status(400).json({ error: 'Nessun file caricato' });
        }

        const {
            athleteId, seasonId, documentType, title, expiryDate, notes = ''
        } = req.body;

        // Validazione
        if (!athleteId || !documentType || !title) {
            return res.status(400).json({
                error: 'Atleta, tipo documento e titolo sono obbligatori'
            });
        }

        // Verifica accesso all'atleta
        let canUpload = false;

        if (req.user.role === 'admin' || req.user.role === 'coach') {
            canUpload = true;
        } else if (req.user.role === 'parent') {
            const parentResult = await client.query(
                'SELECT can_edit FROM parent_athlete WHERE parent_id = $1 AND athlete_id = $2',
                [req.user.id, athleteId]
            );
            canUpload = parentResult.rows.length > 0 && parentResult.rows[0].can_edit;
        } else if (req.user.role === 'athlete') {
            const athleteResult = await client.query(
                'SELECT 1 FROM athletes WHERE id = $1 AND user_id = $2',
                [athleteId, req.user.id]
            );
            canUpload = athleteResult.rows.length > 0;
        }

        if (!canUpload) {
            return res.status(403).json({ error: 'Non puoi caricare documenti per questo atleta' });
        }

        // Ottieni stagione corrente se non specificata
        let finalSeasonId = seasonId;
        if (!finalSeasonId) {
            const currentSeasonResult = await client.query(
                'SELECT id FROM seasons WHERE is_current = true'
            );
            if (currentSeasonResult.rows.length > 0) {
                finalSeasonId = currentSeasonResult.rows[0].id;
            }
        }

        // Carica il file su Supabase Storage
        const extension = path.extname(req.file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const storageKey = `athlete-${athleteId}/${uniqueSuffix}${extension}`;

        const { error: uploadError } = await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .upload(storageKey, req.file.buffer, { contentType: req.file.mimetype });

        if (uploadError) {
            await client.query('ROLLBACK');
            console.error('Errore nel caricamento del file su Supabase Storage:', uploadError);
            return res.status(500).json({ error: 'Errore nel caricamento del documento' });
        }

        // Salva il documento nel database
        const documentResult = await client.query(`
      INSERT INTO documents (
        athlete_id, season_id, document_type, title, filename, file_path,
        file_size, mime_type, expiry_date, notes, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
            athleteId, finalSeasonId, documentType, title, req.file.originalname, storageKey,
            req.file.size, req.file.mimetype, expiryDate || null, notes, req.user.id
        ]);

        await client.query('COMMIT');

        console.log(`📎 Documento caricato: ${title} per atleta ${athleteId}`);

        res.status(201).json({
            success: true,
            document: documentResult.rows[0],
            message: 'Documento caricato con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error('Errore nel caricamento del documento:', error);
        res.status(500).json({ error: 'Errore nel caricamento del documento' });
    } finally {
        client.release();
    }
});

// Download documento
router.get('/download/:documentId', async (req, res) => {
    try {
        const { documentId } = req.params;

        const documentResult = await query(`
      SELECT d.*, a.first_name, a.last_name
      FROM documents d
      JOIN athletes a ON d.athlete_id = a.id
      WHERE d.id = $1
    `, [documentId]);

        if (documentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Documento non trovato' });
        }

        const document = documentResult.rows[0];

        // Verifica accesso al documento
        let canDownload = false;

        if (req.user.role === 'admin' || req.user.role === 'coach') {
            canDownload = true;
        } else if (req.user.role === 'parent') {
            const parentResult = await query(
                'SELECT 1 FROM parent_athlete WHERE parent_id = $1 AND athlete_id = $2',
                [req.user.id, document.athlete_id]
            );
            canDownload = parentResult.rows.length > 0;
        } else if (req.user.role === 'athlete') {
            const athleteResult = await query(
                'SELECT 1 FROM athletes WHERE id = $1 AND user_id = $2',
                [document.athlete_id, req.user.id]
            );
            canDownload = athleteResult.rows.length > 0;
        }

        if (!canDownload) {
            return res.status(403).json({ error: 'Non puoi scaricare questo documento' });
        }

        // Scarica il file da Supabase Storage
        const { data, error: downloadError } = await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .download(document.file_path);

        if (downloadError || !data) {
            console.error('Errore nel download da Supabase Storage:', downloadError);
            return res.status(404).json({ error: 'File non trovato sul server' });
        }

        // Imposta gli header per il download
        res.setHeader('Content-Type', document.mime_type);
        res.setHeader('Content-Disposition', `attachment; filename="${document.title}"`);

        // Invia il file
        res.send(Buffer.from(await data.arrayBuffer()));

    } catch (error) {
        console.error('Errore nel download del documento:', error);
        res.status(500).json({ error: 'Errore nel download del documento' });
    }
});

// Elimina documento
router.delete('/:documentId', async (req, res) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const { documentId } = req.params;

        const documentResult = await client.query(
            'SELECT * FROM documents WHERE id = $1',
            [documentId]
        );

        if (documentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Documento non trovato' });
        }

        const document = documentResult.rows[0];

        // Verifica permessi
        let canDelete = false;

        if (req.user.role === 'admin') {
            canDelete = true;
        } else if (req.user.role === 'coach') {
            canDelete = true; // I coach possono eliminare documenti
        } else if (req.user.role === 'parent') {
            const parentResult = await client.query(
                'SELECT can_edit FROM parent_athlete WHERE parent_id = $1 AND athlete_id = $2',
                [req.user.id, document.athlete_id]
            );
            canDelete = parentResult.rows.length > 0 && parentResult.rows[0].can_edit;
        } else if (req.user.role === 'athlete') {
            const athleteResult = await client.query(
                'SELECT 1 FROM athletes WHERE id = $1 AND user_id = $2',
                [document.athlete_id, req.user.id]
            );
            canDelete = athleteResult.rows.length > 0;
        }

        if (!canDelete) {
            return res.status(403).json({ error: 'Non puoi eliminare questo documento' });
        }

        // Elimina dal database
        await client.query('DELETE FROM documents WHERE id = $1', [documentId]);

        await client.query('COMMIT');

        // Elimina il file da Supabase Storage (non blocca la cancellazione se fallisce)
        try {
            const { error: removeError } = await supabase.storage
                .from(DOCUMENTS_BUCKET)
                .remove([document.file_path]);
            if (removeError) {
                console.error('Errore nella rimozione del file da Supabase Storage:', removeError);
            }
        } catch (storageError) {
            console.error('Errore nella rimozione del file da Supabase Storage:', storageError);
        }

        console.log(`🗑️ Documento eliminato: ${document.title}`);

        res.json({
            success: true,
            message: 'Documento eliminato con successo'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore nell\'eliminazione del documento:', error);
        res.status(500).json({ error: 'Errore nell\'eliminazione del documento' });
    } finally {
        client.release();
    }
});

// Ottieni documenti in scadenza
router.get('/expiring', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { days = 30 } = req.query;

        const expiringResult = await query(`
      SELECT 
        d.id, d.title, d.document_type, d.expiry_date,
        a.id as athlete_id, a.first_name, a.last_name,
        s.name as season_name,
        CASE 
          WHEN d.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN d.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'urgent'
          ELSE 'warning'
        END as urgency_level
      FROM documents d
      JOIN athletes a ON d.athlete_id = a.id
      LEFT JOIN seasons s ON d.season_id = s.id
      WHERE d.expiry_date IS NOT NULL 
        AND d.expiry_date <= CURRENT_DATE + INTERVAL '${days} days'
        AND d.is_valid = true
        AND a.is_active = true
      ORDER BY d.expiry_date ASC, a.last_name, a.first_name
    `);

        res.json({ expiringDocuments: expiringResult.rows });

    } catch (error) {
        console.error('Errore nel recupero dei documenti in scadenza:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Aggiorna validità documento
router.patch('/:documentId/validity', requireRole(['admin', 'coach']), async (req, res) => {
    try {
        const { documentId } = req.params;
        const { isValid } = req.body;

        const updateResult = await query(
            'UPDATE documents SET is_valid = $1 WHERE id = $2 RETURNING title',
            [isValid, documentId]
        );

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Documento non trovato' });
        }

        console.log(`✅ Validità documento aggiornata: ${updateResult.rows[0].title} -> ${isValid}`);

        res.json({
            success: true,
            message: `Documento ${isValid ? 'validato' : 'invalidato'} con successo`
        });

    } catch (error) {
        console.error('Errore nell\'aggiornamento della validità:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento della validità' });
    }
});

module.exports = router;
