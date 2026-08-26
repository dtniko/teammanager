import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Components
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import ChangePassword from './components/Auth/ChangePassword';
import Dashboard from './components/Dashboard/Dashboard';
import Athletes from './components/Athletes/Athletes';
import AthleteDetail from './components/Athletes/AthleteDetail';
import AthleteForm from './components/Athletes/AthleteForm';
import CalendarPage from './components/Calendar/CalendarPage';
import EventDetail from './components/Calendar/EventDetail';
import Users from './components/Users/Users';
import Groups from './components/Groups/Groups';
import GroupDetail from './components/Groups/GroupDetail';
import AttendanceReport from './components/Reports/AttendanceReport';
import LoadingSpinner from './components/Common/LoadingSpinner';

// Services
import { registerServiceWorker } from './utils/serviceWorker';

function App() {
    useEffect(() => {
        if (process.env.NODE_ENV === 'production') {
            registerServiceWorker();
        }
    }, []);

    return (
        <AuthProvider>
            <NotificationProvider>
                <Router>
                    <div className="App min-h-screen bg-gray-50">
                        <AppRoutes />
                        <ToastContainer
                            position="top-right"
                            autoClose={8000}
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
    const location = useLocation();

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

    // Forza il cambio password obbligatorio al primo accesso prima di qualsiasi altra pagina
    if (user.mustChangePassword && location.pathname !== '/change-password') {
        return <Navigate to="/change-password" replace />;
    }

    if (!user.mustChangePassword && location.pathname === '/change-password') {
        return <Navigate to="/dashboard" replace />;
    }

    if (user.mustChangePassword) {
        return <ChangePassword />;
    }

    return (
        <Layout user={user} onLogout={logout}>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/athletes" element={<Athletes />} />
                <Route path="/athletes/new" element={<AthleteForm />} />
                <Route path="/athletes/:athleteId/edit" element={<AthleteForm />} />
                <Route path="/athletes/:athleteId" element={<AthleteDetail />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/calendar/:eventId" element={<EventDetail />} />
                <Route path="/users" element={user.role === 'admin' ? <Users /> : <Navigate to="/dashboard" replace />} />
                <Route path="/groups" element={(user.role === 'admin' || user.role === 'coach') ? <Groups /> : <Navigate to="/dashboard" replace />} />
                <Route path="/groups/:groupId" element={(user.role === 'admin' || user.role === 'coach') ? <GroupDetail /> : <Navigate to="/dashboard" replace />} />
                <Route path="/reports/attendance" element={(user.role === 'admin' || user.role === 'coach') ? <AttendanceReport /> : <Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Layout>
    );
}

export default App;
