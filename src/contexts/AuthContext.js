import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import apiService from '../services/apiService';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve essere usato all\'interno di AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('sportclub_token'));
    const [onboardingStatus, setOnboardingStatus] = useState(null);

    // Inizializza autenticazione
    useEffect(() => {
        initializeAuth();
    }, []);

    const initializeAuth = async (retryOnNetworkError = true) => {
        const storedToken = localStorage.getItem('sportclub_token');

        if (storedToken) {
            try {
                apiService.setAuthToken(storedToken);
                const response = await apiService.verifyToken();

                if (response.valid) {
                    setUser(response.user);
                    setToken(storedToken);
                    fetchOnboardingStatus();
                } else {
                    // Token non valido: il server ha risposto ma la sessione non è valida
                    localStorage.removeItem('sportclub_token');
                    apiService.setAuthToken(null);
                }
            } catch (error) {
                console.error('Errore nella verifica del token:', error);

                // L'interceptor di apiService già gestisce il caso "token rifiutato dal
                // server" (401), disconnettendo l'utente. Qui arriviamo tipicamente per
                // errori di connettività (server irraggiungibile, riavvio in dev, timeout):
                // in quel caso NON disconnettere l'utente, altrimenti la sessione salta
                // ad ogni blip di rete pur restando sulla stessa pagina (es. /dashboard).
                const isNetworkError = !!(error && (
                    error.request ||
                    error.code === 'ERR_NETWORK' ||
                    error.code === 'ECONNABORTED' ||
                    error.message === 'Network Error'
                ));

                if (!isNetworkError) {
                    localStorage.removeItem('sportclub_token');
                    apiService.setAuthToken(null);
                } else if (retryOnNetworkError) {
                    // Un solo retry automatico dopo un breve delay: se il blip era
                    // transitorio (es. dev server che si riavvia) la sessione si
                    // ripristina da sola senza bisogno di un refresh manuale.
                    setTimeout(() => initializeAuth(false), 1500);
                    return;
                } else {
                    setToken(storedToken);
                }
            }
        }

        setLoading(false);
    };

    // Login con Google
    const loginWithGoogle = async (googleToken) => {
        try {
            const response = await apiService.loginWithGoogle(googleToken);

            if (response.success) {
                const { token: newToken, user: userData } = response;

                // Salva token e imposta auth
                localStorage.setItem('sportclub_token', newToken);
                apiService.setAuthToken(newToken);
                setToken(newToken);
                setUser(userData);
                fetchOnboardingStatus();

                toast.success(`Benvenuto, ${userData.firstName}!`);
                return { success: true };
            } else {
                throw new Error(response.error || 'Errore nel login');
            }
        } catch (error) {
            console.error('Errore nel login:', error);
            toast.error(error.message || 'Errore nel login con Google');
            return { success: false, error: error.message };
        }
    };

    // Login con email e password
    const login = async (email, password) => {
        try {
            const response = await apiService.login(email, password);

            if (response.success) {
                const { token: newToken, user: userData, mustChangePassword } = response;

                // Salva token e imposta auth
                localStorage.setItem('sportclub_token', newToken);
                apiService.setAuthToken(newToken);
                setToken(newToken);
                setUser({ ...userData, mustChangePassword: !!mustChangePassword });
                fetchOnboardingStatus();

                toast.success(`Benvenuto, ${userData.firstName}!`);
                return { success: true };
            } else {
                throw new Error(response.error || 'Errore nel login');
            }
        } catch (error) {
            console.error('Errore nel login:', error);
            toast.error(error.message || 'Credenziali non valide');
            return { success: false, error: error.message };
        }
    };

    // Logout — pulisci subito lo stato locale, poi notifica il server in background
    const logout = async () => {
        // Pulisci immediatamente — non aspettare il server
        localStorage.removeItem('sportclub_token');
        apiService.setAuthToken(null);
        setToken(null);
        setUser(null);
        setOnboardingStatus(null);
        toast.info('Disconnesso con successo');

        // Notifica il server in background (fire-and-forget)
        apiService.logout().catch((err) => {
            console.warn('Logout API notifica fallita (ignoring):', err);
        });
    };

    // Aggiorna profilo utente
    const updateUserProfile = async (profileData) => {
        try {
            const response = await apiService.updateProfile(profileData);

            if (response.success) {
                setUser(prevUser => ({
                    ...prevUser,
                    ...response.user
                }));
                toast.success('Profilo aggiornato con successo');
                return { success: true };
            } else {
                throw new Error(response.error || 'Errore nell\'aggiornamento');
            }
        } catch (error) {
            console.error('Errore nell\'aggiornamento del profilo:', error);
            toast.error(error.message || 'Errore nell\'aggiornamento del profilo');
            return { success: false, error: error.message };
        }
    };

    // Aggiorna il flag mustChangePassword nello stato locale (es. dopo il primo cambio password)
    const clearMustChangePassword = () => {
        setUser(prevUser => prevUser ? { ...prevUser, mustChangePassword: false } : prevUser);
    };

    // Recupera lo stato di onboarding (collegamento profilo atleta) dell'utente corrente
    const fetchOnboardingStatus = async () => {
        try {
            const response = await apiService.getOnboardingStatus();
            setOnboardingStatus(response);
            return response;
        } catch (error) {
            console.error('Errore nel recupero dello stato di onboarding:', error);
            return null;
        }
    };

    // Da richiamare dopo ogni azione di onboarding (collega/crea profilo) per aggiornare lo stato
    const refreshOnboardingStatus = () => fetchOnboardingStatus();

    // Controlla se l'utente ha un ruolo specifico
    const hasRole = (role) => {
        return user && user.role === role;
    };

    // Controlla se l'utente ha uno dei ruoli specificati
    const hasAnyRole = (roles) => {
        return user && roles.includes(user.role);
    };

    // Controlla se l'utente può accedere a una risorsa
    const canAccess = (requiredRoles) => {
        if (!user) return false;
        if (!requiredRoles || requiredRoles.length === 0) return true;
        return requiredRoles.includes(user.role);
    };

    // Refresh del token (se necessario)
    const refreshToken = async () => {
        try {
            const response = await apiService.refreshToken();

            if (response.success) {
                const { token: newToken, user: userData } = response;
                localStorage.setItem('sportclub_token', newToken);
                apiService.setAuthToken(newToken);
                setToken(newToken);
                setUser(userData);
                return { success: true };
            } else {
                throw new Error('Impossibile rinnovare la sessione');
            }
        } catch (error) {
            console.error('Errore nel refresh del token:', error);
            await logout();
            return { success: false };
        }
    };

    // Ottieni informazioni complete dell'utente
    const fetchUserProfile = async () => {
        try {
            const response = await apiService.getUserProfile();

            if (response.user) {
                setUser(response.user);
                return { success: true, user: response.user };
            } else {
                throw new Error('Impossibile recuperare il profilo');
            }
        } catch (error) {
            console.error('Errore nel recupero del profilo:', error);
            return { success: false, error: error.message };
        }
    };

    const value = {
        user,
        token,
        loading,
        loginWithGoogle,
        login,
        logout,
        updateUserProfile,
        clearMustChangePassword,
        onboardingStatus,
        refreshOnboardingStatus,
        hasRole,
        hasAnyRole,
        canAccess,
        refreshToken,
        fetchUserProfile,
        isAuthenticated: !!user,
        isAdmin: hasRole('admin'),
        isCoach: hasRole('coach'),
        isParent: hasRole('parent'),
        isAthlete: hasRole('athlete')
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
