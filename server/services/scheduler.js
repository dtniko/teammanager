const cron = require('node-cron');
const { notifyDocumentExpiry } = require('../routes/notifications');
const { query } = require('../config/database');

class SchedulerService {
    constructor() {
        this.tasks = new Map();
    }

    // Inizializza tutti i task schedulati
    initialize() {
        console.log('🕐 Inizializzazione servizio di scheduling...');

        // Controllo scadenze documenti - ogni giorno alle 09:00
        this.scheduleTask('document-expiry-check', '0 9 * * *', async () => {
            console.log('🔔 Controllo scadenze documenti...');
            await notifyDocumentExpiry();
        });

        // Promemoria eventi del giorno - ogni giorno alle 08:00
        this.scheduleTask('daily-events-reminder', '0 8 * * *', async () => {
            console.log('📅 Invio promemoria eventi del giorno...');
            await this.sendDailyEventsReminder();
        });

        // Cleanup notifiche vecchie - ogni domenica alle 02:00
        this.scheduleTask('cleanup-old-notifications', '0 2 * * 0', async () => {
            console.log('🧹 Pulizia notifiche vecchie...');
            await this.cleanupOldNotifications();
        });

        // Backup dati - ogni giorno alle 03:00 (solo log per ora)
        this.scheduleTask('daily-backup', '0 3 * * *', async () => {
            console.log('💾 Esecuzione backup giornaliero...');
            await this.performDailyBackup();
        });

        // Report settimanale per admin - ogni lunedì alle 09:00
        this.scheduleTask('weekly-report', '0 9 * * 1', async () => {
            console.log('📊 Generazione report settimanale...');
            await this.generateWeeklyReport();
        });

        console.log('✅ Servizio di scheduling inizializzato con successo');
    }

    // Schedula un nuovo task
    scheduleTask(name, cronExpression, taskFunction) {
        try {
            const task = cron.schedule(cronExpression, taskFunction, {
                scheduled: false,
                timezone: 'Europe/Rome'
            });

            this.tasks.set(name, task);
            task.start();

            console.log(`⏰ Task "${name}" schedulato: ${cronExpression}`);
        } catch (error) {
            console.error(`❌ Errore nella schedulazione del task "${name}":`, error);
        }
    }

    // Ferma un task
    stopTask(name) {
        const task = this.tasks.get(name);
        if (task) {
            task.stop();
            console.log(`⏹️ Task "${name}" fermato`);
        }
    }

    // Ferma tutti i task
    stopAllTasks() {
        for (const [name, task] of this.tasks) {
            task.stop();
            console.log(`⏹️ Task "${name}" fermato`);
        }
        this.tasks.clear();
    }

    // Promemoria eventi del giorno
    async sendDailyEventsReminder() {
        try {
            const today = new Date().toISOString().split('T')[0];

            const eventsResult = await query(`
        SELECT 
          e.id, e.title, e.event_type, e.start_datetime, e.location,
          g.id as group_id, g.name as group_name
        FROM events e
        LEFT JOIN groups g ON e.group_id = g.id
        WHERE DATE(e.start_datetime) = $1 
          AND e.is_active = true
        ORDER BY e.start_datetime
      `, [today]);

            if (eventsResult.rows.length === 0) {
                console.log('📅 Nessun evento programmato per oggi');
                return;
            }

            for (const event of eventsResult.rows) {
                await this.notifyEventParticipants(event);
            }

            console.log(`✅ Promemoria inviati per ${eventsResult.rows.length} eventi`);

        } catch (error) {
            console.error('❌ Errore nell\'invio dei promemoria eventi:', error);
        }
    }

    // Notifica partecipanti a un evento
    async notifyEventParticipants(event) {
        try {
            const { createBulkNotifications } = require('../routes/notifications');

            const eventTime = new Date(event.start_datetime).toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const title = `Promemoria: ${event.title}`;
            const message = `${event.event_type === 'training' ? 'Allenamento' : 'Evento'} oggi alle ${eventTime}${event.location ? ` presso ${event.location}` : ''}`;

            if (event.group_id) {
                // Notifica genitori degli atleti del gruppo
                const parentsResult = await query(`
          SELECT DISTINCT pa.parent_id
          FROM parent_athlete pa
          JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
          WHERE ag.group_id = $1 AND ag.is_active = true
        `, [event.group_id]);

                if (parentsResult.rows.length > 0) {
                    const parentIds = parentsResult.rows.map(r => r.parent_id);
                    await createBulkNotifications(parentIds, title, message, 'reminder', 'event', event.id);
                }

                // Notifica atleti con account del gruppo
                const athletesResult = await query(`
          SELECT DISTINCT a.user_id
          FROM athletes a
          JOIN athlete_group ag ON a.id = ag.athlete_id
          WHERE ag.group_id = $1 AND ag.is_active = true AND a.user_id IS NOT NULL
        `, [event.group_id]);

                if (athletesResult.rows.length > 0) {
                    const athleteUserIds = athletesResult.rows.map(r => r.user_id);
                    await createBulkNotifications(athleteUserIds, title, message, 'reminder', 'event', event.id);
                }

                // Notifica staff del gruppo
                const staffResult = await query(`
          SELECT user_id FROM staff_group WHERE group_id = $1
        `, [event.group_id]);

                if (staffResult.rows.length > 0) {
                    const staffIds = staffResult.rows.map(r => r.user_id);
                    await createBulkNotifications(staffIds, title, message, 'reminder', 'event', event.id);
                }
            }

            console.log(`📅 Promemoria inviato per evento: ${event.title}`);

        } catch (error) {
            console.error('❌ Errore nell\'invio del promemoria evento:', error);
        }
    }

    // Pulizia notifiche vecchie
    async cleanupOldNotifications() {
        try {
            // Elimina notifiche lette più vecchie di 30 giorni
            const readResult = await query(`
        DELETE FROM notifications 
        WHERE is_read = true 
          AND sent_at < CURRENT_DATE - INTERVAL '30 days'
        RETURNING id
      `);

            // Elimina notifiche non lette più vecchie di 90 giorni
            const unreadResult = await query(`
        DELETE FROM notifications 
        WHERE is_read = false 
          AND sent_at < CURRENT_DATE - INTERVAL '90 days'
        RETURNING id
      `);

            console.log(`🧹 Pulizia completata: ${readResult.rows.length} notifiche lette eliminate, ${unreadResult.rows.length} non lette eliminate`);

        } catch (error) {
            console.error('❌ Errore nella pulizia delle notifiche:', error);
        }
    }

    // Backup giornaliero (placeholder)
    async performDailyBackup() {
        try {
            // Qui implementeresti la logica di backup
            // Per ora solo statistiche giornaliere

            const statsResult = await query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(DISTINCT a.id) as total_athletes,
          COUNT(DISTINCT g.id) as total_groups,
          COUNT(CASE WHEN e.start_datetime >= CURRENT_DATE THEN 1 END) as upcoming_events
        FROM users u
        CROSS JOIN athletes a
        CROSS JOIN groups g  
        CROSS JOIN events e
        WHERE u.is_active = true 
          AND a.is_active = true 
          AND g.is_active = true 
          AND e.is_active = true
      `);

            console.log('💾 Statistiche giornaliere:', statsResult.rows[0]);

            // Qui potresti aggiungere:
            // - Export database su file
            // - Upload su cloud storage
            // - Invio email di conferma agli admin

        } catch (error) {
            console.error('❌ Errore nel backup giornaliero:', error);
        }
    }

    // Report settimanale per amministratori
    async generateWeeklyReport() {
        try {
            const { createBulkNotifications } = require('../routes/notifications');

            // Statistiche della settimana
            const weeklyStatsResult = await query(`
        SELECT 
          COUNT(DISTINCT CASE WHEN u.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN u.id END) as new_users,
          COUNT(DISTINCT CASE WHEN a.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN a.id END) as new_athletes,
          COUNT(DISTINCT CASE WHEN e.start_datetime >= CURRENT_DATE - INTERVAL '7 days' 
                              AND e.start_datetime < CURRENT_DATE THEN e.id END) as events_last_week,
          COUNT(DISTINCT CASE WHEN e.start_datetime >= CURRENT_DATE 
                              AND e.start_datetime < CURRENT_DATE + INTERVAL '7 days' THEN e.id END) as events_next_week,
          COUNT(DISTINCT CASE WHEN d.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN d.id END) as new_documents,
          COUNT(DISTINCT CASE WHEN d.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' 
                              THEN d.id END) as expiring_documents
        FROM users u
        CROSS JOIN athletes a
        CROSS JOIN events e
        CROSS JOIN documents d
      `);

            const stats = weeklyStatsResult.rows[0];

            const title = '📊 Report Settimanale SportClub Manager';
            const message = `
Settimana del ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT')} - ${new Date().toLocaleDateString('it-IT')}

📈 Nuovi iscritti: ${stats.new_users}
👶 Nuovi atleti: ${stats.new_athletes}
📅 Eventi della settimana scorsa: ${stats.events_last_week}
📅 Eventi della prossima settimana: ${stats.events_next_week}
📎 Nuovi documenti: ${stats.new_documents}
⚠️ Documenti in scadenza (30 giorni): ${stats.expiring_documents}
      `.trim();

            // Invia agli amministratori
            const adminsResult = await query(
                'SELECT id FROM users WHERE role = $1 AND is_active = true',
                ['admin']
            );

            if (adminsResult.rows.length > 0) {
                const adminIds = adminsResult.rows.map(r => r.id);
                await createBulkNotifications(adminIds, title, message, 'info', 'system', null);
            }

            console.log('📊 Report settimanale generato e inviato agli amministratori');

        } catch (error) {
            console.error('❌ Errore nella generazione del report settimanale:', error);
        }
    }

    // Ottieni status di tutti i task
    getTasksStatus() {
        const status = {};
        for (const [name, task] of this.tasks) {
            status[name] = {
                running: task.running,
                scheduled: task.scheduled
            };
        }
        return status;
    }
}

// Crea istanza singleton
const schedulerService = new SchedulerService();

// Gestione graceful shutdown
process.on('SIGINT', () => {
    console.log('📞 Ricevuto SIGINT, fermando scheduler...');
    schedulerService.stopAllTasks();
});

process.on('SIGTERM', () => {
    console.log('📞 Ricevuto SIGTERM, fermando scheduler...');
    schedulerService.stopAllTasks();
});

module.exports = schedulerService;
