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

    // Inizializza autenticazione
    useEffect(() => {
        initializeAuth();
    }, []);

    const initializeAuth = async () => {
        const storedToken = localStorage.getItem('sportclub_token');

        if (storedToken) {
            try {
                apiService.setAuthToken(storedToken);
                const response = await apiService.verifyToken();

                if (response.valid) {
                    setUser(response.user);
                    setToken(storedToken);
                } else {
                    // Token non valido
                    localStorage.removeItem('sportclub_token');
                    apiService.setAuthToken(null);
                }
            } catch (error) {
                console.error('Errore nella verifica del token:', error);
                localStorage.removeItem('sportclub_token');
                apiService.setAuthToken(null);
            }
        }

        setLoading(false);
    };

    // Login con Google
    const loginWithGoogle = async (googleToken) => {
        try {
            setLoading(true);

            const response = await apiService.loginWithGoogle(googleToken);

            if (response.success) {
                const { token: newToken, user: userData } = response;

                // Salva token e imposta auth
                localStorage.setItem('sportclub_token', newToken);
                apiService.setAuthToken(newToken);
                setToken(newToken);
                setUser(userData);

                toast.success(`Benvenuto, ${userData.firstName}!`);
                return { success: true };
            } else {
                throw new Error(response.error || 'Errore nel login');
            }
        } catch (error) {
            console.error('Errore nel login:', error);
            toast.error(error.message || 'Errore nel login con Google');
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    // Login con email e password
    const login = async (email, password) => {
        try {
            setLoading(true);

            const response = await apiService.login(email, password);

            if (response.success) {
                const { token: newToken, user: userData, mustChangePassword } = response;

                // Salva token e imposta auth
                localStorage.setItem('sportclub_token', newToken);
                apiService.setAuthToken(newToken);
                setToken(newToken);
                setUser({ ...userData, mustChangePassword: !!mustChangePassword });

                toast.success(`Benvenuto, ${userData.firstName}!`);
                return { success: true };
            } else {
                throw new Error(response.error || 'Errore nel login');
            }
        } catch (error) {
            console.error('Errore nel login:', error);
            toast.error(error.message || 'Credenziali non valide');
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    // Logout
    const logout = async () => {
        try {
            // Chiamata API per logout (opzionale, per logging)
            await apiService.logout().catch(() => {
                // Ignora errori nel logout API
            });
        } catch (error) {
            console.error('Errore nel logout:', error);
        } finally {
            // Pulisci sempre i dati locali
            localStorage.removeItem('sportclub_token');
            apiService.setAuthToken(null);
            setToken(null);
            setUser(null);
            toast.info('Disconnesso con successo');
        }
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
