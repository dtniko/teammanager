import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Components
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import Dashboard from './components/Dashboard/Dashboard';
import Athletes from './components/Athletes/Athletes';
import AthleteDetail from './components/Athletes/AthleteDetail';
import Calendar from './components/Calendar/Calendar';
import Documents from './components/Documents/Documents';
import Communications from './components/Communications/Communications';
import Groups from './components/Groups/Groups';
import Users from './components/Users/Users';
import Profile from './components/Profile/Profile';
import LoadingSpinner from './components/Common/LoadingSpinner';

// Services
import { registerServiceWorker } from './utils/serviceWorker';

function App() {
    useEffect(() => {
        // Registra il service worker per PWA
        registerServiceWorker();
    }, []);

    return (
        <AuthProvider>
            <NotificationProvider>
                <Router>
                    <div className="App min-h-screen bg-gray-50">
                        <AppRoutes />
                        <ToastContainer
                            position="top-right"
                            autoClose={5000}
                            hideProgressBar={false}
                            newestOnTop={false}
                            closeOnClick
                            rtl={false}
                            pauseOnFocusLoss
                            draggable
                            pauseOnHover
                            theme="light"
                        />
                    </div>
                </Router>
            </NotificationProvider>
        </AuthProvider>
    );
}

function AppRoutes() {
    const { user, loading, logout } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="large" />
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }

    return (
        <Layout user={user} onLogout={logout}>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />

                {/* Atleti */}
                <Route path="/athletes" element={<Athletes />} />
                <Route path="/athletes/:athleteId" element={<AthleteDetail />} />

                {/* Calendario */}
                <Route path="/calendar" element={<Calendar />} />

                {/* Documenti */}
                <Route path="/documents" element={<Documents />} />
                <Route path="/documents/:athleteId" element={<Documents />} />

                {/* Comunicazioni */}
                <Route path="/communications" element={<Communications />} />

                {/* Gruppi (solo admin e coach) */}
                {['admin', 'coach'].includes(user.role) && (
                    <Route path="/groups" element={<Groups />} />
                )}

                {/* Utenti (solo admin) */}
                {user.role === 'admin' && (
                    <Route path="/users" element={<Users />} />
                )}

                {/* Profilo */}
                <Route path="/profile" element={<Profile />} />

                {/* Redirect per route non trovate */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Layout>
    );
}

export default App;
