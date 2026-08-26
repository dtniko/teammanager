const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Configurazione del pool di connessioni PostgreSQL
// Se DATABASE_URL e' impostata (es. Supabase) ha priorita' sulle variabili singole DB_*
const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    })
    : new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'sportclub_manager',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
        max: 20, // Numero massimo di connessioni nel pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

// Test della connessione
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Connessione al database PostgreSQL riuscita');
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Errore nella connessione al database:', error.message);
        return false;
    }
};

// Inizializzazione del database con lo schema
const initializeDatabase = async () => {
    try {
        const client = await pool.connect();

        // Controlla se le tabelle esistono già
        const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);

        if (tableCheck.rows.length === 0) {
            console.log('📦 Inizializzazione del database...');

            // Leggi e esegui lo schema SQL
            const schemaPath = path.join(__dirname, '../../database/schema.sql');
            const schema = await fs.readFile(schemaPath, 'utf8');

            await client.query(schema);
            console.log('✅ Schema del database creato con successo');

            // Inserisci dati di esempio se in development
            if (process.env.NODE_ENV === 'development') {
                await insertSampleData(client);
            }
        } else {
            console.log('✅ Database già inizializzato');
        }

        client.release();
    } catch (error) {
        console.error('❌ Errore nell\'inizializzazione del database:', error);
        throw error;
    }
};

// Inserimento dati di esempio per sviluppo
const insertSampleData = async (client) => {
    try {
        console.log('📝 Inserimento dati di esempio...');

        // Stagione corrente
        await client.query(`
      INSERT INTO seasons (name, start_date, end_date, is_current) 
      VALUES ('Stagione 2024/2025', '2024-09-01', '2025-06-30', true)
      ON CONFLICT DO NOTHING
    `);

        // Gruppi di esempio
        await client.query(`
      INSERT INTO groups (name, description, age_group, season_id) 
      VALUES 
        ('Esordienti', 'Categoria Esordienti', '8-10 anni', 1),
        ('Pulcini', 'Categoria Pulcini', '6-8 anni', 1),
        ('Giovanissimi', 'Categoria Giovanissimi', '12-14 anni', 1)
      ON CONFLICT DO NOTHING
    `);

        console.log('✅ Dati di esempio inseriti');
    } catch (error) {
        console.error('❌ Errore nell\'inserimento dei dati di esempio:', error);
    }
};

// Funzione per eseguire query con gestione errori
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;

        if (process.env.LOG_QUERIES === 'true') {
            console.log('📊 Query eseguita:', { text, duration, rows: res.rowCount });
        }

        return res;
    } catch (error) {
        console.error('❌ Errore nella query:', { text, error: error.message });
        throw error;
    }
};

// Funzione per ottenere un client dal pool per transazioni
const getClient = async () => {
    return await pool.connect();
};

// Chiusura del pool (per cleanup)
const closePool = async () => {
    await pool.end();
    console.log('🔌 Pool di connessioni chiuso');
};

// Gestione della chiusura graceful
process.on('SIGINT', async () => {
    console.log('📞 Ricevuto SIGINT, chiusura del pool...');
    await closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('📞 Ricevuto SIGTERM, chiusura del pool...');
    await closePool();
    process.exit(0);
});

module.exports = {
    pool,
    query,
    getClient,
    testConnection,
    initializeDatabase,
    closePool
};
