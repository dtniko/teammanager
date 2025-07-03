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

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/athletes', authenticateToken, athleteRoutes);
app.use('/api/groups', authenticateToken, groupRoutes);
app.use('/api/events', authenticateToken, eventRoutes);
app.use('/api/documents', authenticateToken, documentRoutes);
app.use('/api/communications', authenticateToken, communicationRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

// Serve React app
app.use(express.static(path.join(__dirname, '../build')));

// Serve React app for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Qualcosa è andato storto!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Initialize database and start server
const startServer = async () => {
    try {
        await initializeDatabase();

        app.listen(PORT, '0.0.0.0', () => {
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
