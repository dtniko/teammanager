import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import apiService from '../services/apiService';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications deve essere usato all\'interno di NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [pushSubscription, setPushSubscription] = useState(null);

    // Carica notifiche quando l'utente è autenticato
    useEffect(() => {
        if (isAuthenticated) {
            fetchNotifications();
            setupPushNotifications();
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [isAuthenticated]);

    // Setup push notifications
    const setupPushNotifications = async () => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                const registration = await navigator.serviceWorker.ready;

                // Controlla se già sottoscritto
                const subscription = await registration.pushManager.getSubscription();

                if (subscription) {
                    setPushSubscription(subscription);
                } else {
                    // Richiedi permesso per le notifiche
                    await requestNotificationPermission();
                }
            } catch (error) {
                console.error('Errore nel setup delle push notifications:', error);
            }
        }
    };

    // Richiedi permesso per notifiche push
    const requestNotificationPermission = async () => {
        try {
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();

                if (permission === 'granted') {
                    await subscribeToPushNotifications();
                }
            }
        } catch (error) {
            console.error('Errore nella richiesta di permesso notifiche:', error);
        }
    };

    // Sottoscrivi alle push notifications
    const subscribeToPushNotifications = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;

            // Qui dovresti usare le tue chiavi VAPID
            const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;

            if (!vapidPublicKey) {
                console.warn('Chiave VAPID non configurata');
                return;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            setPushSubscription(subscription);

            // Invia la sottoscrizione al server (implementare API)
            // await apiService.savePushSubscription(subscription);

            console.log('Push notifications attivate');
        } catch (error) {
            console.error('Errore nella sottoscrizione push:', error);
        }
    };

    // Utility per convertire VAPID key
    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    // Carica notifiche dal server
    const fetchNotifications = async (options = {}) => {
        try {
            setLoading(true);

            const response = await apiService.getNotifications({
                page: 1,
                limit: 50,
                ...options
            });

            if (response.notifications) {
                setNotifications(response.notifications);
                setUnreadCount(response.pagination?.unread || 0);
            }
        } catch (error) {
            console.error('Errore nel caricamento delle notifiche:', error);
            toast.error('Errore nel caricamento delle notifiche');
        } finally {
            setLoading(false);
        }
    };

    // Segna notifica come letta
    const markAsRead = async (notificationId) => {
        try {
            const response = await apiService.markNotificationAsRead(notificationId);

            if (response.success) {
                setNotifications(prev =>
                    prev.map(notification =>
                        notification.id === notificationId
                            ? { ...notification, is_read: true }
                            : notification
                    )
                );

                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Errore nella marcatura della notifica:', error);
            toast.error('Errore nella marcatura della notifica');
        }
    };

    // Segna tutte come lette
    const markAllAsRead = async () => {
        try {
            const response = await apiService.markAllNotificationsAsRead();

            if (response.success) {
                setNotifications(prev =>
                    prev.map(notification => ({ ...notification, is_read: true }))
                );
                setUnreadCount(0);
                toast.success('Tutte le notifiche sono state segnate come lette');
            }
        } catch (error) {
            console.error('Errore nella marcatura delle notifiche:', error);
            toast.error('Errore nella marcatura delle notifiche');
        }
    };

    // Elimina notifica
    const deleteNotification = async (notificationId) => {
        try {
            const response = await apiService.deleteNotification(notificationId);

            if (response.success) {
                const deletedNotification = notifications.find(n => n.id === notificationId);

                setNotifications(prev =>
                    prev.filter(notification => notification.id !== notificationId)
                );

                if (deletedNotification && !deletedNotification.is_read) {
                    setUnreadCount(prev => Math.max(0, prev - 1));
                }

                toast.success('Notifica eliminata');
            }
        } catch (error) {
            console.error('Errore nell\'eliminazione della notifica:', error);
            toast.error('Errore nell\'eliminazione della notifica');
        }
    };

    // Elimina tutte le notifiche lette
    const deleteReadNotifications = async () => {
        try {
            const response = await apiService.deleteReadNotifications();

            if (response.success) {
                setNotifications(prev =>
                    prev.filter(notification => !notification.is_read)
                );
                toast.success(`${response.deleted} notifiche eliminate`);
            }
        } catch (error) {
            console.error('Errore nell\'eliminazione delle notifiche:', error);
            toast.error('Errore nell\'eliminazione delle notifiche');
        }
    };

    // Mostra notifica browser (per notifiche in tempo reale)
    const showBrowserNotification = (title, options = {}) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                icon: '/logo192.png',
                badge: '/logo192.png',
                tag: 'sportclub-notification',
                ...options
            });

            // Auto-chiudi dopo 5 secondi
            setTimeout(() => {
                notification.close();
            }, 5000);

            return notification;
        }
    };

    // Aggiungi notifica locale (per simulare notifiche in tempo reale)
    const addNotification = (notification) => {
        setNotifications(prev => [notification, ...prev]);

        if (!notification.is_read) {
            setUnreadCount(prev => prev + 1);
        }

        // Mostra notifica browser se permesso
        if (!notification.is_read) {
            showBrowserNotification(notification.title, {
                body: notification.message,
                data: { notificationId: notification.id }
            });
        }
    };

    // Filtra notifiche per tipo
    const getNotificationsByType = (type) => {
        return notifications.filter(notification => notification.type === type);
    };

    // Ottieni notifiche non lette
    const getUnreadNotifications = () => {
        return notifications.filter(notification => !notification.is_read);
    };

    // Ottieni notifiche recenti (ultime 24 ore)
    const getRecentNotifications = () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return notifications.filter(notification =>
            new Date(notification.sent_at) > yesterday
        );
    };

    // Ottieni conteggio per tipo
    const getTypeCount = (type) => {
        return getNotificationsByType(type).length;
    };

    // Ottieni conteggio non lette per tipo
    const getUnreadTypeCount = (type) => {
        return getNotificationsByType(type).filter(n => !n.is_read).length;
    };

    const value = {
        notifications,
        unreadCount,
        loading,
        pushSubscription,

        // Actions
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteReadNotifications,
        addNotification,
        requestNotificationPermission,

        // Getters
        getNotificationsByType,
        getUnreadNotifications,
        getRecentNotifications,
        getTypeCount,
        getUnreadTypeCount,

        // States
        hasUnread: unreadCount > 0,
        isPushEnabled: !!pushSubscription
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};
