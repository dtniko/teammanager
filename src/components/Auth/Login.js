import React, { useState, useEffect } from 'react';
import { Shield, Users, Calendar, FileText, Bell, Smartphone } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../Common/LoadingSpinner';

// Il client OAuth Google configurato e' stato eliminato lato Google Cloud Console:
// tenere il bottone attivo genera un loop di richieste fallite verso accounts.google.com.
// Riattivare non appena viene configurato un nuovo client valido in GOOGLE_CLIENT_ID.
const GOOGLE_SIGNIN_ENABLED = true;

const Login = () => {
    const { loginWithGoogle, login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [credentialsLoading, setCredentialsLoading] = useState(false);
    const [clearingCache, setClearingCache] = useState(false);

    // TODO temporaneo: pulsante di debug per svuotare service worker/cache durante lo sviluppo. Rimuovere quando non serve piu'.
    const handleClearCache = async () => {
        setClearingCache(true);
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map((r) => r.unregister()));
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
            }
        } catch (error) {
            console.error('Errore nella pulizia della cache:', error);
        } finally {
            window.location.reload();
        }
    };

    useEffect(() => {
        if (!GOOGLE_SIGNIN_ENABLED) {
            return;
        }

        // Inizializza Google Sign-In
        const initializeGoogleSignIn = () => {
            if (window.google) {
                window.google.accounts.id.initialize({
                    client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
                    callback: handleGoogleSignIn,
                    auto_select: false,
                    cancel_on_tap_outside: false
                });

                // Renderizza il pulsante
                window.google.accounts.id.renderButton(
                    document.getElementById('google-signin-button'),
                    {
                        theme: 'outline',
                        size: 'large',
                        width: '100%',
                        text: 'signin_with',
                        shape: 'rectangular',
                        locale: 'it'
                    }
                );

                setIsGoogleLoaded(true);
            }
        };

        // Controlla se lo script Google è già caricato
        if (window.google) {
            initializeGoogleSignIn();
        } else {
            // Attendi che lo script sia caricato
            const checkGoogleLoaded = setInterval(() => {
                if (window.google) {
                    initializeGoogleSignIn();
                    clearInterval(checkGoogleLoaded);
                }
            }, 100);

            // Cleanup
            return () => clearInterval(checkGoogleLoaded);
        }
    }, []);

    const handleGoogleSignIn = async (response) => {
        setLoading(true);

        try {
            const result = await loginWithGoogle(response.credential);

            if (!result.success) {
                console.error('Errore nel login:', result.error);
            }
        } catch (error) {
            console.error('Errore nel login Google:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCredentialsLogin = async (e) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Inserisci email e password');
            return;
        }

        setCredentialsLoading(true);

        try {
            const result = await login(email, password);

            if (!result.success) {
                // AuthContext.login mostra gia' un toast d'errore, non duplicarlo qui
            }
        } catch (error) {
            console.error('Errore nel login con email/password:', error);
            toast.error('Credenziali non valide');
        } finally {
            setCredentialsLoading(false);
        }
    };

    const features = [
        {
            icon: Users,
            title: 'Gestione Atleti',
            description: 'Anagrafica completa, documenti e informazioni personali'
        },
        {
            icon: Calendar,
            title: 'Calendario Eventi',
            description: 'Allenamenti, partite e presenze in tempo reale'
        },
        {
            icon: FileText,
            title: 'Documenti Digitali',
            description: 'Certificati medici, pagamenti e scadenze automatiche'
        },
        {
            icon: Bell,
            title: 'Notifiche Smart',
            description: 'Avvisi personalizzati per scadenze e comunicazioni'
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            <div className="flex min-h-screen">
                {/* Left Panel - Hero Section */}
                <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-blue-600 to-indigo-800 relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0" style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                        }} />
                    </div>

                    <div className="relative z-10 flex flex-col justify-center px-12 py-16">
                        <div className="max-w-md">
                            {/* Logo e Titolo */}
                            <div className="flex items-center mb-8">
                                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mr-4">
                                    <Shield className="h-7 w-7 text-blue-600" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-white">Sport Manager</h1>
                                    <p className="text-blue-100 text-sm">Gestionale per società sportive</p>
                                </div>
                            </div>

                            {/* Descrizione */}
                            <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
                                La piattaforma completa per la tua società sportiva
                            </h2>

                            <p className="text-xl text-blue-100 mb-12 leading-relaxed">
                                Gestisci atleti, documenti, calendario e comunicazioni in un'unica soluzione moderna e intuitiva.
                            </p>

                            {/* Features */}
                            <div className="space-y-6">
                                {features.map((feature, index) => {
                                    const Icon = feature.icon;
                                    return (
                                        <div key={index} className="flex items-start space-x-4">
                                            <div className="w-10 h-10 bg-blue-500 bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Icon className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                                                <p className="text-blue-100 text-sm">{feature.description}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* PWA Info */}
                            <div className="mt-12 p-4 bg-blue-500 bg-opacity-20 rounded-lg border border-blue-400 border-opacity-30">
                                <div className="flex items-center space-x-3">
                                    <Smartphone className="h-5 w-5 text-blue-200" />
                                    <div>
                                        <p className="text-white text-sm font-medium">App Web Progressiva</p>
                                        <p className="text-blue-100 text-xs">Installabile su smartphone e tablet</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Login Form */}
                <div className="flex-1 flex flex-col justify-center px-8 py-8 lg:py-16 lg:px-12">
                    <div className="w-full max-w-md mx-auto">
                        {/* Mobile Logo */}
                        <div className="lg:hidden flex flex-col items-center justify-center mb-6">
                            <span className="text-lg font-bold text-gray-900 mb-4">Team Sport Manager</span>
                            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
                                <Shield className="h-8 w-8 text-white" />
                            </div>
                        </div>

                        {/* Desktop Header */}
                        <div className="hidden lg:block text-center mb-8">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">
                                Accedi alla piattaforma
                            </h2>
                            <p className="text-gray-600">
                                Accedi con le tue credenziali per continuare
                            </p>
                        </div>

                        {/* Login Form */}
                        <div className="space-y-6">
                            {GOOGLE_SIGNIN_ENABLED && (
                                <>
                                    {/* Google Sign In Button */}
                                    <div className="relative">
                                        {loading && (
                                            <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center rounded-lg z-10">
                                                <LoadingSpinner size="small" text="Accesso in corso..." />
                                            </div>
                                        )}

                                        {!isGoogleLoaded && (
                                            <div className="flex items-center justify-center p-4 border border-gray-300 rounded-lg">
                                                <LoadingSpinner size="small" text="Caricamento..." />
                                            </div>
                                        )}

                                        <div id="google-signin-button" className={isGoogleLoaded ? '' : 'hidden'} />
                                    </div>

                                    {/* Divider */}
                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-gray-300" />
                                        </div>
                                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-500">
                            Oppure accedi con email e password
                          </span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Email/Password Login Form */}
                            <form onSubmit={handleCredentialsLogin} className="space-y-4 pb-6">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                        Email
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="nome@esempio.it"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                        Password
                                    </label>
                                    <input
                                        id="password"
                                        type="password"
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={credentialsLoading}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {credentialsLoading ? (
                                        <LoadingSpinner size="small" text="Accesso in corso..." />
                                    ) : (
                                        'Accedi'
                                    )}
                                </button>
                            </form>

                            {/* Mobile divider before PWA card */}
                            <div className="lg:hidden relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300" />
                                </div>
                            </div>

                            {/* Spacer — forza spazio su mobile (space-y sovrascrive mt) */}
                            <div className="lg:hidden h-8" />

                            {/* PWA Card — mobile only, shown below "Accendi" */}
                            <div className="lg:hidden p-5 bg-gradient-to-r from-blue-500 to-blue-700 rounded-2xl shadow-lg">
                                <div className="flex items-center space-x-3">
                                    <Smartphone className="h-5 w-5 text-white flex-shrink-0" />
                                    <div>
                                        <p className="text-white text-sm font-semibold">App Web Progressiva</p>
                                        <p className="text-blue-100 text-xs">Installabile su smartphone e tablet</p>
                                    </div>
                                </div>
                            </div>

                            {/* Desktop support & legal */}
                            <div className="hidden lg:block mt-6">
                                <div className="text-center">
                                    <p className="text-sm text-gray-500">
                                        Problemi di accesso?{' '}
                                        <a href="mailto:supporto@sportclub.it" className="text-blue-600 hover:text-blue-500">
                                            Contatta il supporto
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Footer Info */}
                        <div className="mt-12 text-center">
                            <p className="text-xs text-gray-400">
                                Utilizzando questa piattaforma accetti i{' '}
                                <a href="#" className="text-blue-600 hover:text-blue-500">
                                    Termini di Servizio
                                </a>{' '}
                                e la{' '}
                                <a href="#" className="text-blue-600 hover:text-blue-500">
                                    Privacy Policy
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
