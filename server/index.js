const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const athleteRoutes = require('./routes/athletes');
const groupRoutes = require('./routes/groups');
const eventRoutes = require('./routes/events');
const documentRoutes = require('./routes/documents');
const communicationRoutes = require('./routes/communications');
const { router: notificationRoutes } = require('./routes/notifications');

const { authenticateToken } = require('./middleware/auth');
const { initializeDatabase } = require('./config/database');
const schedulerService = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/athletes', authenticateToken, athleteRoutes);
app.use('/api/groups', authenticateToken, groupRoutes);
app.use('/api/events', authenticateToken, eventRoutes);
app.use('/api/documents', authenticateToken, documentRoutes);
app.use('/api/communications', authenticateToken, communicationRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../build')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../build', 'index.html'));
    });
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Qualcosa è andato storto!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route non trovata' });
});

// Initialize database and start server
const startServer = async () => {
    try {
        await initializeDatabase();

        // Inizializza il servizio di scheduling
        if (process.env.NODE_ENV !== 'test') {
            schedulerService.initialize();
        }

        app.listen(PORT, () => {
            console.log(`Server in esecuzione sulla porta ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('Errore nell\'avvio del server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
