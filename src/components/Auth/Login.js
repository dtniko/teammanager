import React, { useState, useEffect } from 'react';
import { Shield, Users, Calendar, FileText, Bell, Smartphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../Common/LoadingSpinner';

const Login = () => {
    const { loginWithGoogle } = useAuth();
    const [loading, setLoading] = useState(false);
    const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

    useEffect(() => {
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
                                    <h1 className="text-2xl font-bold text-white">SportClub Manager</h1>
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
                <div className="flex-1 flex flex-col justify-center px-8 py-16 lg:px-12">
                    <div className="w-full max-w-md mx-auto">
                        {/* Mobile Logo */}
                        <div className="lg:hidden flex items-center justify-center mb-8">
                            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
                                <Shield className="h-8 w-8 text-white" />
                            </div>
                        </div>

                        {/* Header */}
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">
                                Accedi alla piattaforma
                            </h2>
                            <p className="text-gray-600">
                                Effettua il login con il tuo account Google per continuare
                            </p>
                        </div>

                        {/* Login Form */}
                        <div className="space-y-6">
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
                    Prima volta qui?
                  </span>
                                </div>
                            </div>

                            {/* Info per nuovi utenti */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h3 className="text-sm font-medium text-blue-900 mb-2">
                                    Nuovo utente?
                                </h3>
                                <p className="text-sm text-blue-700 mb-3">
                                    Effettua il login con Google per creare automaticamente il tuo account.
                                    Verrà creato come "Genitore" e potrai essere associato ai tuoi atleti dall'amministratore.
                                </p>
                                <ul className="text-xs text-blue-600 space-y-1">
                                    <li>• Account sicuro con Google OAuth</li>
                                    <li>• Nessuna password da ricordare</li>
                                    <li>• Accesso immediato alle funzionalità</li>
                                </ul>
                            </div>

                            {/* Support Info */}
                            <div className="text-center">
                                <p className="text-sm text-gray-500">
                                    Problemi di accesso?{' '}
                                    <a href="mailto:supporto@sportclub.it" className="text-blue-600 hover:text-blue-500">
                                        Contatta il supporto
                                    </a>
                                </p>
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
