import React, { useEffect } from 'react';
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
import LoadingSpinner from './components/Common/LoadingSpinner';

// Services
import { registerServiceWorker } from './utils/serviceWorker';

function App() {
    useEffect(() => {
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
                <Route path="/athletes" element={<Athletes />} />
                <Route path="/athletes/:athleteId" element={<AthleteDetail />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Layout>
    );
}

export default App;
