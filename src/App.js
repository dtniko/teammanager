import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';
// import { NotificationProvider } from './contexts/NotificationContext'; // COMMENTATO per ora

// Components
import Login from './components/Auth/Login';
import LoadingSpinner from './components/Common/LoadingSpinner';

// Componente Welcome semplice
const Welcome = ({ user, onLogout }) => {
    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <h1 className="text-xl font-bold text-gray-900">SportClub Manager</h1>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-700">
                                Benvenuto, {user.firstName} {user.lastName}
                            </span>
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                {user.role}
                            </span>
                            <button
                                onClick={onLogout}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
                        <div className="text-center">
                            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
                                🎉 Login effettuato con successo!
                            </h2>
                            <p className="text-lg text-gray-600 mb-8">
                                Benvenuto in SportClub Manager. L'applicazione è in fase di sviluppo.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                                <div className="bg-white p-6 rounded-lg shadow">
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">👤 Il tuo profilo</h3>
                                    <p className="text-sm text-gray-600">
                                        <strong>Email:</strong> {user.email}<br/>
                                        <strong>Ruolo:</strong> {user.role}<br/>
                                        <strong>ID:</strong> {user.id}
                                    </p>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow">
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">🔗 Backend Status</h3>
                                    <p className="text-sm text-green-600">
                                        ✅ Connessione attiva<br/>
                                        API: http://localhost:8000
                                    </p>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow">
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">🚧 Prossimi step</h3>
                                    <p className="text-sm text-gray-600">
                                        Dashboard<br/>
                                        Gestione atleti<br/>
                                        Calendario eventi
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 text-sm text-gray-500">
                                <p>🐳 Applicazione in esecuzione su Docker</p>
                                <p>Frontend: localhost:3000 | Backend: localhost:8000</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

// Services
import { registerServiceWorker } from './utils/serviceWorker';

function App() {
    useEffect(() => {
        // Registra il service worker per PWA
        registerServiceWorker();
    }, []);

    return (
        <AuthProvider>
            {/* <NotificationProvider> // COMMENTATO per ora */}
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
            {/* </NotificationProvider> // COMMENTATO per ora */}
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
        <Routes>
            {/* Route principale - Welcome page */}
            <Route path="/" element={<Welcome user={user} onLogout={logout} />} />

            {/* TUTTE LE ALTRE ROUTE COMMENTATE PER ORA */}
            {/*
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/athletes" element={<Athletes />} />
            <Route path="/athletes/:athleteId" element={<AthleteDetail />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/documents/:athleteId" element={<Documents />} />
            <Route path="/communications" element={<Communications />} />
            {['admin', 'coach'].includes(user.role) && (
                <Route path="/groups" element={<Groups />} />
            )}
            {user.role === 'admin' && (
                <Route path="/users" element={<Users />} />
            )}
            <Route path="/profile" element={<Profile />} />
            */}

            {/* Redirect per route non trovate */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;
