import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    Check,
    AlertTriangle,
    Calendar,
    FileText,
    MessageSquare,
    Info,
    CheckCheck,
    Trash2
} from 'lucide-react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useNotifications } from '../../contexts/NotificationContext';
import apiService from '../../services/apiService';
import LoadingSpinner, { TableSkeleton } from '../Common/LoadingSpinner';

const getNotificationIcon = (type, relatedType) => {
    if (relatedType === 'event') return Calendar;
    if (relatedType === 'document') return FileText;
    if (relatedType === 'communication') return MessageSquare;

    switch (type) {
        case 'urgent':
            return AlertTriangle;
        case 'warning':
            return AlertTriangle;
        case 'info':
            return Info;
        default:
            return Bell;
    }
};

const getNotificationColor = (type) => {
    switch (type) {
        case 'urgent':
            return 'text-red-600 bg-red-100';
        case 'warning':
            return 'text-yellow-600 bg-yellow-100';
        case 'reminder':
            return 'text-blue-600 bg-blue-100';
        case 'info':
            return 'text-gray-600 bg-gray-100';
        default:
            return 'text-gray-600 bg-gray-100';
    }
};

const NotificationsPage = () => {
    const navigate = useNavigate();
    const { markAsRead, markAllAsRead, deleteNotification, unreadCount } = useNotifications();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [showAll, setShowAll] = useState(false);

    const loadNotifications = useCallback(async (targetPage = 1, includeResolved = false) => {
        try {
            setLoading(true);
            const response = await apiService.getNotifications({
                page: targetPage,
                limit: 20,
                includeResolved: includeResolved ? 'true' : 'false'
            });
            setNotifications(response.notifications || []);
            setPagination(response.pagination || null);
            setPage(targetPage);
        } catch (error) {
            console.error('Errore nel caricamento delle notifiche:', error);
            toast.error('Errore nel caricamento delle notifiche');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadNotifications(1, showAll);
    }, [loadNotifications, showAll]);

    const handleMarkAsRead = async (notification) => {
        if (!notification.is_read) {
            await markAsRead(notification.id);
            setNotifications(prev =>
                showAll
                    ? prev.map(n => (n.id === notification.id ? { ...n, is_read: true } : n))
                    : prev.filter(n => n.id !== notification.id)
            );
        }
    };

    const handleNotificationClick = async (notification) => {
        await handleMarkAsRead(notification);

        if (notification.related_type === 'profile_link_request') {
            navigate('/pending-approvals');
        }
    };

    const handleDelete = async (e, notificationId) => {
        e.stopPropagation();
        await deleteNotification(notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsRead();
        setNotifications(prev => (showAll ? prev.map(n => ({ ...n, is_read: true })) : []));
    };

    if (loading && notifications.length === 0) {
        return <TableSkeleton rows={10} />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Notifiche</h1>
                    <p className="text-gray-600 mt-1">Tutte le tue notifiche</p>
                </div>

                <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                    <button
                        onClick={() => setShowAll(prev => !prev)}
                        className={`flex items-center px-4 py-2 text-sm font-medium border rounded-md ${
                            showAll
                                ? 'text-white bg-blue-600 border-blue-600 hover:bg-blue-700'
                                : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        {showAll ? 'Mostra solo attive' : 'Mostra tutte'}
                    </button>
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllAsRead}
                            className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
                        >
                            <CheckCheck className="h-4 w-4 mr-2" />
                            Segna tutte come lette
                        </button>
                    )}
                </div>
            </div>

            {/* Notifications List */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                {notifications.length === 0 ? (
                    <div className="text-center py-12">
                        <Bell className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna notifica</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Tutte le notifiche appariranno qui
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {notifications.map((notification) => {
                            const Icon = getNotificationIcon(notification.type, notification.related_type);
                            const colorClass = getNotificationColor(notification.type);

                            return (
                                <div
                                    key={notification.id}
                                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                                        !notification.is_read ? 'bg-blue-50' : ''
                                    }`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex items-start space-x-3">
                                        <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
                                            <Icon className="h-4 w-4" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <h4 className={`text-sm font-medium ${
                                                        !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                                                    }`}>
                                                        {notification.title}
                                                    </h4>
                                                    <p className={`text-sm mt-1 ${
                                                        !notification.is_read ? 'text-gray-700' : 'text-gray-500'
                                                    }`}>
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        {format(new Date(notification.sent_at), 'dd/MM/yyyy HH:mm', { locale: it })}
                                                    </p>
                                                </div>

                                                <div className="flex items-center space-x-1 ml-2">
                                                    {!notification.is_read && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleMarkAsRead(notification);
                                                            }}
                                                            className="text-blue-600 hover:text-blue-700 p-1"
                                                            title="Segna come letta"
                                                        >
                                                            <Check className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => handleDelete(e, notification.id)}
                                                        className="text-gray-400 hover:text-red-600 p-1"
                                                        title="Elimina"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {loading && notifications.length > 0 && (
                    <div className="flex items-center justify-center p-4">
                        <LoadingSpinner size="small" />
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-center space-x-2">
                    <button
                        onClick={() => loadNotifications(page - 1, showAll)}
                        disabled={page <= 1}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Precedente
                    </button>
                    <span className="text-sm text-gray-600">
                        Pagina {page} di {pagination.pages}
                    </span>
                    <button
                        onClick={() => loadNotifications(page + 1, showAll)}
                        disabled={page >= pagination.pages}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Successiva
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
