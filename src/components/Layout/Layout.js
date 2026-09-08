import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    Menu,
    X,
    Home,
    Users,
    Calendar,
    FileText,
    MessageSquare,
    Bell,
    Settings,
    LogOut,
    UserCircle,
    Shield,
    ChevronDown,
    ClipboardList,
    ClipboardCheck,
    Download,
    Smartphone,
    Share,
    RefreshCw,
    CheckCircle
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import usePWAInstall from '../../hooks/usePWAInstall';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import { checkForSWUpdate, applySWUpdate } from '../../utils/swUpdateCheck';
import { fetchServerVersion } from '../../utils/versionCheck';
import { showUpdateBanner } from '../../utils/serviceWorker';
import apiService from '../../services/apiService';

// Rileva iOS (stesso test di PWAInstallCard: su Safari il prompt nativo
// beforeinstallprompt non viene mai emesso)
const isIOS = () => {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const Layout = ({ user, onLogout, children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [showInstallHelp, setShowInstallHelp] = useState(false);
    const [showPushPrompt, setShowPushPrompt] = useState(false);
    // Verifica aggiornamenti SW: 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'unsupported'
    const [updateCheck, setUpdateCheck] = useState('idle');
    // Versione del deployment corrente (dal server), mostrata nel footer del menu
    const [serverVersion, setServerVersion] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { unreadCount, isPushEnabled, activatePushNotifications } = useNotifications();
    const { canInstall, installed, install } = usePWAInstall();
    const headerRef = useRef(null);

    // Click outside to close dropdowns (no overlay needed)
    useEffect(() => {
        const handleClick = (e) => {
            if (headerRef.current && !headerRef.current.contains(e.target)) {
                setUserMenuOpen(false);
                setNotificationsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Al chiudere il menu utente azzera lo stato della verifica aggiornamenti
    // (così il prossimo click riparte da 'idle' e rilancia il check)
    useEffect(() => {
        if (!userMenuOpen) {
            setUpdateCheck('idle');
        }
    }, [userMenuOpen]);

    // Prompt push al primo utilizzo: una tantum (flag in localStorage), solo
    // se push disattivate, permesso non negato e browser con Web Push
    // (es. Safari non-PWA: nessun web push, non disturbare). Lo stato reale
    // è chiesto al server (le chiavi VAPID sono a runtime, non nel bundle).
    useEffect(() => {
        if (isPushEnabled) return;
        if (!user) return;
        if (localStorage.getItem('push_prompt_shown')) return;
        if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return;
        if (typeof window === 'undefined' || !('PushManager' in window)) return;

        const timeout = setTimeout(async () => {
            try {
                const status = await apiService.getPushStatus();
                if (status?.enabled) {
                    setShowPushPrompt(true);
                }
            } catch {
                // Chiamata fallita: nessun modal (silenzioso)
            }
        }, 2000);

        return () => clearTimeout(timeout);
    }, [isPushEnabled, user]);

    // Configurazione menu di navigazione nell'ORDINE CORRETTO
    const navigationItems = [
        {
            name: 'Dashboard',
            href: '/dashboard',
            icon: Home,
            roles: ['admin', 'coach', 'parent', 'athlete']
        },
        {
            name: 'Gruppi',
            href: '/groups',
            icon: Shield,
            roles: ['admin', 'coach']
        },
        {
            name: 'Stagioni',
            href: '/seasons',
            icon: Calendar,
            roles: ['admin', 'coach']
        },
        {
            name: 'Atleti',
            href: '/athletes',
            icon: Users,
            roles: ['admin', 'coach', 'parent']
        },
        {
            name: 'Calendario',
            href: '/calendar',
            icon: Calendar,
            roles: ['admin', 'coach', 'parent', 'athlete']
        },
        {
            name: 'Documenti',
            href: '/documents',
            icon: FileText,
            roles: ['admin', 'coach', 'parent', 'athlete']
        },
        {
            name: 'Comunicazioni',
            href: '/communications',
            icon: MessageSquare,
            roles: ['admin', 'coach', 'parent', 'athlete']
        },
        {
            name: 'Notifica',
            href: '/notifications/broadcast',
            icon: Bell,
            roles: ['admin', 'coach']
        },
        {
            name: 'Report Presenze',
            href: '/reports/attendance',
            icon: ClipboardList,
            roles: ['admin', 'coach']
        },
        {
            name: 'Utenti',
            href: '/users',
            icon: UserCircle,
            roles: ['admin']
        },
        {
            name: 'Richieste da approvare',
            href: '/pending-approvals',
            icon: ClipboardCheck,
            roles: ['admin', 'coach']
        }
    ];

    // Filtra elementi di navigazione in base al ruolo
    const allowedNavItems = navigationItems.filter(item =>
        item.roles.includes(user.role)
    );

    const isActiveRoute = (href) => {
        return location.pathname === href ||
            (href !== '/dashboard' && location.pathname.startsWith(href));
    };

    const getRoleBadgeColor = (role) => {
        const colors = {
            admin: 'bg-red-100 text-red-800',
            coach: 'bg-blue-100 text-blue-800',
            parent: 'bg-green-100 text-green-800',
            athlete: 'bg-purple-100 text-purple-800'
        };
        return colors[role] || 'bg-gray-100 text-gray-800';
    };

    const getRoleLabel = (role) => {
        const labels = {
            admin: 'Amministratore',
            coach: 'Dirigente/Allenatore',
            parent: 'Genitore',
            athlete: 'Atleta'
        };
        return labels[role] || role;
    };

    // Apre il prompt nativo di installazione; se il browser non lo espone
    // (es. iOS/Safari) mostra le istruzioni manuali
    const handleInstallClick = async () => {
        setUserMenuOpen(false);
        const r = canInstall ? await install() : null;
        if (r === 'accepted') {
            toast.success('App installata');
            // User gesture: qui Notification.requestPermission è permesso,
            // quindi attiviamo subito le push (la flag push_prompt_shown non
            // viene toccata: il primo-login resta coerente con l'esito)
            handlePushActivationResult(await activatePushNotifications());
        } else if (!r) {
            setShowInstallHelp(true);
        }
        // dismissed/cancelled: nessun feedback, la voce resta
    };

    // Toast a seconda dell'esito di activatePushNotifications
    // (riusato dal menu utente, dal prompt dopo install e dal modal primo utilizzo)
    const handlePushActivationResult = (result) => {
        switch (result) {
            case 'ok':
                toast.success('Notifiche push attivate');
                break;
            case 'denied':
                toast.error('Notifiche bloccate: attivali dalle impostazioni del browser e ricarica la pagina');
                break;
            case 'default':
                toast.warning('Permesso non concesso: le notifiche restano disattivate');
                break;
            case 'no-vapid':
                toast.warning('Notifiche push non disponibili su questa versione dell\'app');
                break;
            case 'unsupported':
                toast.warning('Il browser non supporta le notifiche push');
                break;
            default:
                toast.error('Errore nell\'attivazione delle notifiche push');
        }
    };

    // Attiva le notifiche push con feedback sull'esito
    const handlePushClick = async () => {
        setUserMenuOpen(false);
        handlePushActivationResult(await activatePushNotifications());
    };

    // "Attiva" nel modal primo utilizzo
    const handlePushPromptActivate = async () => {
        handlePushActivationResult(await activatePushNotifications());
        localStorage.setItem('push_prompt_shown', '1');
        setShowPushPrompt(false);
    };

    // "Più tardi" nel modal primo utilizzo (non verrà più mostrato;
    // le push si possono comunque attivare dal menu utente)
    const handlePushPromptLater = () => {
        localStorage.setItem('push_prompt_shown', '1');
        setShowPushPrompt(false);
    };

    // Verifica se c'è una nuova versione dell'app (service worker + versione
    // del deployment: l'SW può non avere byte diversi mentre il bundle è cambiato)
    const handleUpdateCheck = async () => {
        setUpdateCheck('checking');
        const [swResult, remote] = await Promise.all([
            checkForSWUpdate(),
            fetchServerVersion(),
        ]);
        setServerVersion(remote);
        setUpdateCheck(swResult);
        const buildV = window.__BUILD_VERSION__;
        if (swResult === 'up-to-date') {
            if (remote && buildV && buildV !== 'dev' && remote !== buildV) {
                // SW identico (niente reload automatico) ma bundle cambiato:
                // banner con "Aggiorna ora" (dedup interno via DOM id)
                showUpdateBanner();
            } else {
                toast.success('Sei già all\'ultima versione.');
            }
        } else if (swResult === 'unsupported') {
            toast.info('Aggiornamenti non disponibili in questo browser.');
        }
        // 'update-available': la conferma è nel mini-panel dentro il menu
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Sidebar Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:fixed lg:inset-y-0 lg:left-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="flex items-center justify-between h-20 px-4 border-b border-gray-200">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">SM</span>
                            </div>
                        </div>
                        <div className="ml-3">
                            <h1 className="text-lg font-semibold text-gray-900">Sport</h1>
                            <p className="text-xs text-gray-500">Manager</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                    {allowedNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = isActiveRoute(item.href);

                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`
                  group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150
                  ${isActive
                                    ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-600'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }
                `}
                            >
                                <Icon className={`
                  mr-3 h-5 w-5 transition-colors duration-150
                  ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
                `} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Info in Sidebar */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            {user.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
                                    alt={`${user.firstName} ${user.lastName}`}
                                    className="w-8 h-8 rounded-full"
                                />
                            ) : (
                                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                                    <UserCircle className="h-5 w-5 text-gray-600" />
                                </div>
                            )}
                        </div>
                        <div className="ml-3 min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {user.firstName} {user.lastName}
                            </p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                {getRoleLabel(user.role)}
              </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="lg:pl-64 flex flex-col min-h-screen">
                {/* Top Navigation */}
                <header ref={headerRef} className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0 sticky top-0">
                    <div className="flex items-center justify-between h-20 px-4 sm:px-6 lg:px-8">
                        {/* Mobile menu button */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                        >
                            <Menu className="h-6 w-6" />
                        </button>

                        {/* Page title */}
                        <div className="flex-1 lg:flex-none">
                            <h2 className="text-lg font-semibold text-gray-900 lg:hidden">
                                Sport Manager
                            </h2>
                        </div>

                        {/* Right side actions */}
                        <div className="flex items-center space-x-4">
                            {/* Notifications */}
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        if (window.matchMedia('(max-width: 1023px)').matches) {
                                            navigate('/notifications');
                                        } else {
                                            setNotificationsOpen(!notificationsOpen);
                                        }
                                    }}
                                    className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 relative"
                                >
                                    <Bell className="h-6 w-6" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                                    )}
                                </button>

                                {notificationsOpen && (
                                    <NotificationDropdown onClose={() => setNotificationsOpen(false)} />
                                )}
                            </div>

                            {/* User menu */}
                            <div className="relative">
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center space-x-2 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                                >
                                    {user.avatarUrl ? (
                                        <img
                                            src={user.avatarUrl}
                                            alt={`${user.firstName} ${user.lastName}`}
                                            className="w-8 h-8 rounded-full"
                                        />
                                    ) : (
                                        <UserCircle className="h-8 w-8" />
                                    )}
                                    <ChevronDown className="h-4 w-4" />
                                </button>

                                {/* User dropdown menu */}
                                {userMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                                        <div className="px-4 py-2 border-b border-gray-100">
                                            <p className="text-sm font-medium text-gray-900">
                                                {user.firstName} {user.lastName}
                                            </p>
                                            <p className="text-sm text-gray-500">{user.email}</p>
                                        </div>

                                        <Link
                                            to="/profile"
                                            onClick={() => setUserMenuOpen(false)}
                                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            <Settings className="mr-3 h-4 w-4" />
                                            Profilo
                                        </Link>

                                        {!installed && (
                                            <button
                                                type="button"
                                                onClick={handleInstallClick}
                                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                <Download className="mr-3 h-4 w-4" />
                                                Installa app sul dispositivo
                                            </button>
                                        )}

                                        {/* Verifica aggiornamenti (service worker) */}
                                        <button
                                            type="button"
                                            onClick={handleUpdateCheck}
                                            disabled={updateCheck === 'checking'}
                                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                        >
                                            <RefreshCw
                                                className={`mr-3 h-4 w-4 ${updateCheck === 'checking' ? 'animate-spin' : ''}`}
                                            />
                                            {updateCheck === 'checking'
                                                ? 'Verifica in corso...'
                                                : 'Verifica aggiornamenti'}
                                        </button>

                                        {/* Esito della verifica: mini-panel di conferma inline nel menu */}
                                        {updateCheck === 'update-available' && (
                                            <div className="px-4 py-2 border-t border-gray-100">
                                                <p className="text-sm text-gray-700">
                                                    È disponibile una nuova versione. Vuoi aggiornare ora?
                                                </p>
                                                <div className="flex space-x-2 mt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setUserMenuOpen(false);
                                                            applySWUpdate();
                                                        }}
                                                        className="flex-1 px-2 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition-colors"
                                                    >
                                                        Aggiorna ora
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setUpdateCheck('idle')}
                                                        className="flex-1 px-2 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-md hover:bg-gray-300 transition-colors"
                                                    >
                                                        Annulla
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {updateCheck === 'up-to-date' && (
                                            <div className="px-4 py-2 border-t border-gray-100 flex items-center">
                                                <CheckCircle className="mr-2 h-4 w-4 text-green-600 flex-shrink-0" />
                                                <p className="text-sm text-gray-500">Sei già all'ultima versione.</p>
                                            </div>
                                        )}

                                        {updateCheck === 'unsupported' && (
                                            <div className="px-4 py-2 border-t border-gray-100">
                                                <p className="text-sm text-gray-400">
                                                    Aggiornamenti non disponibili in questo browser.
                                                </p>
                                            </div>
                                        )}

                                        {!isPushEnabled && (
                                            <button
                                                type="button"
                                                onClick={handlePushClick}
                                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                <Bell className="mr-3 h-4 w-4" />
                                                Attiva notifiche push
                                            </button>
                                        )}

                                        {serverVersion && (
                                            <div className="px-4 py-2 text-xs text-gray-400 border-t">
                                                Versione {serverVersion}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                onLogout();
                                                setUserMenuOpen(false);
                                            }}
                                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            <LogOut className="mr-3 h-4 w-4" />
                                            Disconnetti
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="p-4 sm:p-6 lg:p-8">
                        {children}
                    </div>
                </main>
            </div>

            {/* Modal istruzioni installazione app (prompt nativo non disponibile) */}
            {showInstallHelp && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Installa l'app sul dispositivo</h3>
                            <button
                                onClick={() => setShowInstallHelp(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="flex items-start space-x-3">
                                <Smartphone className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                {isIOS() ? (
                                    <div className="text-sm text-gray-700 space-y-2">
                                        <p>
                                            <Share className="inline h-4 w-4 mr-1 align-[-2px]" />
                                            In <strong>Safari</strong> tocca <strong>Condividi</strong> (icona di
                                            condivisione nella barra) e poi seleziona{' '}
                                            <strong>"Aggiungi alla schermata Home"</strong>.
                                        </p>
                                        <p className="text-gray-500">
                                            Nota: le notifiche push sull'iPhone arrivano solo con l'app installata.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-700">
                                        Usa <strong>Chrome</strong> o <strong>Edge</strong>: cerca l'icona di
                                        installazione nella barra degli indirizzi (o Menu ⋮ →{" "}
                                        <strong>"Installa app"</strong>).
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="p-4 pt-0">
                            <button
                                type="button"
                                onClick={() => setShowInstallHelp(false)}
                                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors"
                            >
                                Chiuso
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal "Attiva le notifiche push" al primo utilizzo */}
            {showPushPrompt && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Attiva le notifiche push</h3>
                            <button
                                onClick={handlePushPromptLater}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="flex items-start space-x-3">
                                <Bell className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-700">
                                    Ricevi avvisi su allenamenti, partite e aggiornamenti direttamente sul tuo dispositivo.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 pt-0 flex flex-col-reverse sm:flex-row gap-2">
                            <button
                                type="button"
                                onClick={handlePushPromptLater}
                                className="w-full px-4 py-2 bg-gray-200 text-gray-700 text-sm font-semibold rounded-md hover:bg-gray-300 transition-colors"
                            >
                                Più tardi
                            </button>
                            <button
                                type="button"
                                onClick={handlePushPromptActivate}
                                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors"
                            >
                                Attiva
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Layout;
