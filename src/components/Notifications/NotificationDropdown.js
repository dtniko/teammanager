import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Bell,
    X,
    Check,
    AlertTriangle,
    AlertCircle,
    AlertOctagon,
    Calendar,
    FileText,
    MessageSquare,
    Info,
    CheckCheck,
    Trash2
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const NotificationDropdown = ({ onClose }) => {
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        getUnreadNotifications
    } = useNotifications();

    // Chiudi dropdown quando si clicca fuori
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const getNotificationIcon = (type, relatedType) => {
        if (relatedType === 'event') return Calendar;
        if (relatedType === 'document') return FileText;
        if (relatedType === 'communication') return MessageSquare;

        switch (type) {
            case 'expired':
                return AlertOctagon;
            case 'urgent':
                return AlertTriangle;
            case 'high':
                return AlertTriangle;
            case 'warning':
                return AlertTriangle;
            case 'notice':
                return AlertCircle;
            case 'info':
                return Info;
            default:
                return Bell;
        }
    };

    const getNotificationColor = (type) => {
        switch (type) {
            case 'expired':
                return 'text-red-100 bg-red-900';
            case 'urgent':
                return 'text-red-600 bg-red-100';
            case 'high':
                return 'text-orange-600 bg-orange-100';
            case 'warning':
                return 'text-yellow-600 bg-yellow-100';
            case 'notice':
                return 'text-teal-600 bg-teal-100';
            case 'reminder':
                return 'text-blue-600 bg-blue-100';
            case 'info':
                return 'text-gray-600 bg-gray-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    };

    const handleMarkAsRead = async (notification) => {
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }
    };

    const handleNotificationClick = async (notification) => {
        await handleMarkAsRead(notification);

        if (notification.related_type === 'profile_link_request' || notification.related_type === 'role_change_request') {
            onClose();
            navigate('/pending-approvals');
        }
    };

    const handleDelete = async (e, notificationId) => {
        e.stopPropagation();
        await deleteNotification(notificationId);
    };

    const recentNotifications = notifications.slice(0, 10);
    const unreadNotifications = getUnreadNotifications();

    return (
        <div
            ref={dropdownRef}
            className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                    <Bell className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Notifiche</h3>
                    {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {unreadCount}
            </span>
                    )}
                </div>

                <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                            title="Segna tutte come lette"
                        >
                            <CheckCheck className="h-4 w-4 mr-1" />
                            Tutte lette
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    </div>
                ) : recentNotifications.length === 0 ? (
                    <div className="text-center p-8">
                        <Bell className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna notifica</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Tutte le notifiche appariranno qui
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {recentNotifications.map((notification) => {
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
                                        {/* Icon */}
                                        <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
                                            <Icon className="h-4 w-4" />
                                        </div>

                                        {/* Content */}
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
                                                        {format(new Date(notification.sent_at), 'dd/MM/yyyy HH:mm')}
                                                    </p>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center space-x-1 ml-2">
                                                    {!notification.is_read && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                markAsRead(notification.id);
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

                                            {/* Unread indicator */}
                                            {!notification.is_read && (
                                                <div className="absolute left-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            {recentNotifications.length > 0 && (
                <div className="border-t border-gray-200 p-3">
                    <Link
                        to="/notifications"
                        onClick={onClose}
                        className="block w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Vedi tutte le notifiche
                    </Link>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
