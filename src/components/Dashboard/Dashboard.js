import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Users,
    Calendar,
    FileText,
    MessageSquare,
    AlertTriangle,
    Clock,
    CheckCircle,
    TrendingUp,
    Plus,
    Eye,
    ArrowRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import apiService from '../../services/apiService';
import LoadingSpinner, { CardSkeleton } from '../Common/LoadingSpinner';
import { format, isToday, isTomorrow, addDays } from 'date-fns';
import { it } from 'date-fns/locale';

const Dashboard = () => {
    const { user } = useAuth();
    const { unreadCount } = useNotifications();
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState({
        stats: {},
        upcomingEvents: [],
        recentCommunications: [],
        expiringDocuments: [],
        myAthletes: []
    });

    useEffect(() => {
        loadDashboardData();
    }, [user]);

    const loadDashboardData = async () => {
        try {
            setLoading(true);

            const promises = [];

            // Carica eventi prossimi
            promises.push(
                apiService.getEvents({
                    startDate: new Date().toISOString(),
                    endDate: addDays(new Date(), 7).toISOString(),
                    limit: 5
                })
            );

            // Carica comunicazioni recenti
            promises.push(
                apiService.getCommunications({
                    limit: 5
                })
            );

            // In base al ruolo, carica dati specifici
            if (user.role === 'parent') {
                promises.push(apiService.getMyAthletes());
            } else if (user.role === 'admin' || user.role === 'coach') {
                promises.push(apiService.getExpiringDocuments());
                if (user.role === 'admin') {
                    promises.push(apiService.getUserStats());
                }
            }

            const results = await Promise.allSettled(promises);

            const [eventsResult, communicationsResult, ...otherResults] = results;

            const newDashboardData = {
                upcomingEvents: eventsResult.status === 'fulfilled' ? eventsResult.value.events || [] : [],
                recentCommunications: communicationsResult.status === 'fulfilled' ? communicationsResult.value.communications || [] : [],
                expiringDocuments: [],
                myAthletes: [],
                stats: {}
            };

            // Elabora risultati aggiuntivi in base al ruolo
            let resultIndex = 2;

            if (user.role === 'parent') {
                if (otherResults[0]?.status === 'fulfilled') {
                    newDashboardData.myAthletes = otherResults[0].value.athletes || [];
                }
            } else if (user.role === 'admin' || user.role === 'coach') {
                if (otherResults[0]?.status === 'fulfilled') {
                    newDashboardData.expiringDocuments = otherResults[0].value.expiringDocuments || [];
                }
                if (user.role === 'admin' && otherResults[1]?.status === 'fulfilled') {
                    newDashboardData.stats = otherResults[1].value.overview || {};
                }
            }

            setDashboardData(newDashboardData);
        } catch (error) {
            console.error('Errore nel caricamento della dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const getEventTypeColor = (eventType) => {
        const colors = {
            training: 'bg-blue-100 text-blue-800',
            match: 'bg-red-100 text-red-800',
            meeting: 'bg-yellow-100 text-yellow-800'
        };
        return colors[eventType] || 'bg-gray-100 text-gray-800';
    };

    const getEventTypeLabel = (eventType) => {
        const labels = {
            training: 'Allenamento',
            match: 'Partita',
            meeting: 'Riunione'
        };
        return labels[eventType] || eventType;
    };

    const formatEventDate = (dateString) => {
        const date = new Date(dateString);

        if (isToday(date)) {
            return `Oggi alle ${format(date, 'HH:mm')}`;
        } else if (isTomorrow(date)) {
            return `Domani alle ${format(date, 'HH:mm')}`;
        } else {
            return format(date, 'EEEE d MMMM alle HH:mm', { locale: it });
        }
    };

    const getDocumentUrgencyColor = (urgencyLevel) => {
        const colors = {
            expired: 'bg-red-100 text-red-800 border-red-200',
            urgent: 'bg-orange-100 text-orange-800 border-orange-200',
            warning: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        };
        return colors[urgencyLevel] || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <CardSkeleton className="h-8 w-64" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Ciao, {user.firstName}! 👋
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Ecco un riepilogo delle tue attività oggi
                    </p>
                </div>
                <div className="text-sm text-gray-500">
                    {format(new Date(), 'EEEE d MMMM yyyy', { locale: it })}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Notifiche non lette */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <MessageSquare className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Notifiche</p>
                            <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
                        </div>
                    </div>
                </div>

                {/* Eventi prossimi */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Calendar className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Eventi 7gg</p>
                            <p className="text-2xl font-bold text-gray-900">{dashboardData.upcomingEvents.length}</p>
                        </div>
                    </div>
                </div>

                {/* Documenti in scadenza (solo admin/coach) */}
                {(user.role === 'admin' || user.role === 'coach') && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-yellow-100 rounded-lg">
                                <AlertTriangle className="h-6 w-6 text-yellow-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Scadenze</p>
                                <p className="text-2xl font-bold text-gray-900">{dashboardData.expiringDocuments.length}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* I miei atleti (solo genitori) */}
                {user.role === 'parent' && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Users className="h-6 w-6 text-green-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">I miei atleti</p>
                                <p className="text-2xl font-bold text-gray-900">{dashboardData.myAthletes.length}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Statistiche totali (solo admin) */}
                {user.role === 'admin' && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <TrendingUp className="h-6 w-6 text-purple-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Utenti totali</p>
                                <p className="text-2xl font-bold text-gray-900">{dashboardData.stats.total_users || 0}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Eventi prossimi */}
                <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Prossimi Eventi</h2>
                            <Link
                                to="/calendar"
                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                            >
                                Vedi tutti
                                <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                    <div className="p-6">
                        {dashboardData.upcomingEvents.length === 0 ? (
                            <div className="text-center py-8">
                                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun evento</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Non ci sono eventi programmati nei prossimi 7 giorni
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {dashboardData.upcomingEvents.map((event) => (
                                    <div key={event.id} className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                                        <div className={`p-2 rounded-lg ${getEventTypeColor(event.event_type)}`}>
                                            <Calendar className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-sm font-medium text-gray-900">{event.title}</h3>
                                            <p className="text-xs text-gray-600 mt-1">
                                                {formatEventDate(event.start_datetime)}
                                            </p>
                                            {event.location && (
                                                <p className="text-xs text-gray-500 mt-1">📍 {event.location}</p>
                                            )}
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${getEventTypeColor(event.event_type)}`}>
                        {getEventTypeLabel(event.event_type)}
                      </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Comunicazioni recenti */}
                <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Comunicazioni Recenti</h2>
                            <Link
                                to="/communications"
                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                            >
                                Vedi tutte
                                <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                    <div className="p-6">
                        {dashboardData.recentCommunications.length === 0 ? (
                            <div className="text-center py-8">
                                <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna comunicazione</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Non ci sono comunicazioni recenti
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {dashboardData.recentCommunications.map((communication) => (
                                    <div key={communication.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="text-sm font-medium text-gray-900 flex items-center">
                                                    {communication.title}
                                                    {communication.is_urgent && (
                                                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Urgente
                            </span>
                                                    )}
                                                </h3>
                                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                                    {communication.content.length > 100
                                                        ? communication.content.substring(0, 100) + '...'
                                                        : communication.content
                                                    }
                                                </p>
                                                <p className="text-xs text-gray-500 mt-2">
                                                    {format(new Date(communication.sent_at), 'dd/MM/yyyy HH:mm')}
                                                </p>
                                            </div>
                                            {!communication.is_read && (
                                                <div className="w-2 h-2 bg-blue-600 rounded-full ml-4 mt-2" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* I miei atleti (solo genitori) */}
                {user.role === 'parent' && (
                    <div className="bg-white rounded-lg shadow lg:col-span-2">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">I Miei Atleti</h2>
                                <Link
                                    to="/athletes"
                                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                                >
                                    Gestisci
                                    <ArrowRight className="ml-1 h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                        <div className="p-6">
                            {dashboardData.myAthletes.length === 0 ? (
                                <div className="text-center py-8">
                                    <Users className="mx-auto h-12 w-12 text-gray-400" />
                                    <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun atleta associato</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Contatta l'amministratore per associare i tuoi atleti
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {dashboardData.myAthletes.map((athlete) => (
                                        <div key={athlete.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-sm">
                            {athlete.first_name.charAt(0)}{athlete.last_name.charAt(0)}
                          </span>
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-sm font-medium text-gray-900">
                                                        {athlete.first_name} {athlete.last_name}
                                                    </h3>
                                                    <p className="text-xs text-gray-500">
                                                        {format(new Date(athlete.date_of_birth), 'dd/MM/yyyy')}
                                                    </p>
                                                    {athlete.groups_names && (
                                                        <p className="text-xs text-blue-600 mt-1">
                                                            {athlete.groups_names}
                                                        </p>
                                                    )}
                                                </div>
                                                <Link
                                                    to={`/athletes/${athlete.id}`}
                                                    className="text-blue-600 hover:text-blue-700"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Documenti in scadenza (solo admin/coach) */}
                {(user.role === 'admin' || user.role === 'coach') && (
                    <div className="bg-white rounded-lg shadow lg:col-span-2">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">Documenti in Scadenza</h2>
                                <Link
                                    to="/documents?filter=expiring"
                                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                                >
                                    Vedi tutti
                                    <ArrowRight className="ml-1 h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                        <div className="p-6">
                            {dashboardData.expiringDocuments.length === 0 ? (
                                <div className="text-center py-8">
                                    <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                                    <h3 className="mt-2 text-sm font-medium text-gray-900">Tutto in regola!</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Non ci sono documenti in scadenza
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {dashboardData.expiringDocuments.slice(0, 5).map((doc) => (
                                        <div key={doc.id} className={`p-3 border rounded-lg ${getDocumentUrgencyColor(doc.urgency_level)}`}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-sm font-medium">
                                                        {doc.title} - {doc.first_name} {doc.last_name}
                                                    </h3>
                                                    <p className="text-xs mt-1">
                                                        Scade il {format(new Date(doc.expiry_date), 'dd/MM/yyyy')}
                                                    </p>
                                                </div>
                                                <span className="text-xs font-medium">
                          {doc.urgency_level === 'expired' && 'SCADUTO'}
                                                    {doc.urgency_level === 'urgent' && 'URGENTE'}
                                                    {doc.urgency_level === 'warning' && 'IN SCADENZA'}
                        </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            {(user.role === 'admin' || user.role === 'coach') && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Azioni Rapide</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Link
                            to="/events/new"
                            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                        >
                            <Plus className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-700">Nuovo Evento</span>
                        </Link>

                        {user.role === 'admin' && (
                            <Link
                                to="/athletes/new"
                                className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                            >
                                <Plus className="h-5 w-5 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-700">Nuovo Atleta</span>
                            </Link>
                        )}

                        <Link
                            to="/communications/new"
                            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                        >
                            <Plus className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-700">Nuova Comunicazione</span>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
