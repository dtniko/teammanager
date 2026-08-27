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

const ATTENDANCE_STATUS_LABELS = {
    pending: 'Presenza da confermare',
    called_up: 'Presenza da confermare',
    present: 'Presenza confermata',
    absent: 'Assenza segnalata'
};

const ATTENDANCE_STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-800',
    called_up: 'bg-yellow-100 text-yellow-800',
    present: 'bg-green-100 text-green-800',
    absent: 'bg-red-100 text-red-800'
};

const DASHBOARD_RANGE_OPTIONS = [
    { value: '7', label: 'Settimana' },
    { value: '14', label: '2 Settimane' },
    { value: '30', label: 'Mese' },
    { value: 'all', label: 'Tutti' }
];

const Dashboard = () => {
    const { user } = useAuth();
    const { unreadCount } = useNotifications();
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState({
        stats: {},
        upcomingEvents: [],
        expiringDocuments: [],
        myAthletes: []
    });
    const eventsRangeStorageKey = user ? `dashboard_events_range_${user.id}` : null;
    const [eventsRange, setEventsRange] = useState(() => {
        if (!user) return '7';
        return localStorage.getItem(`dashboard_events_range_${user.id}`) || '7';
    });
    const [listEvents, setListEvents] = useState([]);
    const [listEventsLoading, setListEventsLoading] = useState(false);

    const commsRangeStorageKey = user ? `dashboard_comms_range_${user.id}` : null;
    const [commsRange, setCommsRange] = useState(() => {
        if (!user) return '7';
        return localStorage.getItem(`dashboard_comms_range_${user.id}`) || '7';
    });
    const [listComms, setListComms] = useState([]);
    const [listCommsLoading, setListCommsLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, [user]);

    useEffect(() => {
        if (eventsRange === '7') return;
        loadListEvents(eventsRange);
    }, [eventsRange]);

    useEffect(() => {
        loadListComms(commsRange);
    }, [commsRange, user]);

    const handleEventsRangeChange = (range) => {
        setEventsRange(range);
        if (eventsRangeStorageKey) {
            localStorage.setItem(eventsRangeStorageKey, range);
        }
    };

    const handleCommsRangeChange = (range) => {
        setCommsRange(range);
        if (commsRangeStorageKey) {
            localStorage.setItem(commsRangeStorageKey, range);
        }
    };

    const displayedEvents = eventsRange === '7' ? dashboardData.upcomingEvents : listEvents;
    const displayedEventsLoading = eventsRange === '7' ? false : listEventsLoading;

    const loadListEvents = async (range) => {
        try {
            setListEventsLoading(true);
            const params = {
                startDate: new Date().toISOString(),
                limit: range === 'all' ? 20 : 10
            };
            if (range !== 'all') {
                params.endDate = addDays(new Date(), parseInt(range, 10)).toISOString();
            }
            const response = await apiService.getEvents(params);
            setListEvents(response.events || []);
        } catch (error) {
            console.error('Errore nel caricamento degli eventi:', error);
            setListEvents([]);
        } finally {
            setListEventsLoading(false);
        }
    };

    const loadListComms = async (range) => {
        try {
            setListCommsLoading(true);
            const params = { limit: range === 'all' ? 20 : 10 };
            if (range !== 'all') {
                params.sentAfter = addDays(new Date(), -parseInt(range, 10)).toISOString();
            }
            const response = await apiService.getCommunications(params);
            setListComms(response.communications || []);
        } catch (error) {
            console.error('Errore nel caricamento delle comunicazioni:', error);
            setListComms([]);
        } finally {
            setListCommsLoading(false);
        }
    };

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

            const [eventsResult, ...otherResults] = results;

            const newDashboardData = {
                upcomingEvents: eventsResult.status === 'fulfilled' ? eventsResult.value.events || [] : [],
                expiringDocuments: [],
                myAthletes: [],
                stats: {}
            };

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
            training: 'bg-blue-100 text-blue-800 border-blue-200',
            match: 'bg-red-100 text-red-800 border-red-200',
            meeting: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        };
        return colors[eventType] || 'bg-gray-100 text-gray-800 border-gray-200';
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

    // Componente per le statistiche card
    const StatCard = ({ icon: Icon, label, value, color = "blue", trend = null, onClick = null }) => (
        <div
            className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200 ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-xl bg-${color}-100`}>
                        <Icon className={`h-6 w-6 text-${color}-600`} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-600">{label}</p>
                        <p className="text-2xl font-bold text-gray-900">{value}</p>
                        {trend && (
                            <p className={`text-sm ${trend.positive ? 'text-green-600' : 'text-red-600'} flex items-center mt-1`}>
                                <TrendingUp className={`h-3 w-3 mr-1 ${trend.positive ? '' : 'rotate-180'}`} />
                                {trend.value}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <CardSkeleton className="h-8 w-64" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Ciao, {user.athleteProfile?.first_name || user.firstName}! 👋
                    </h1>
                    <p className="text-gray-600">
                        Ecco un riepilogo delle tue attività oggi
                    </p>
                </div>
                <div className="mt-4 sm:mt-0">
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>Sistema Online</span>
                        </div>
                        <span className="text-gray-300">|</span>
                        <span>{format(new Date(), 'EEEE d MMMM yyyy', { locale: it })}</span>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            {(user.role === 'admin' || user.role === 'coach') && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                        <Plus className="h-5 w-5 mr-2 text-green-600" />
                        Azioni Rapide
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        <Link
                            to="/events/new"
                            className="flex items-center justify-center p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group"
                        >
                            <Calendar className="h-5 w-5 text-gray-400 group-hover:text-blue-500 mr-2" />
                            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">Nuovo Evento</span>
                        </Link>

                        <Link
                            to="/communications/new"
                            className="flex items-center justify-center p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors group"
                        >
                            <MessageSquare className="h-5 w-5 text-gray-400 group-hover:text-purple-500 mr-2" />
                            <span className="text-sm font-medium text-gray-700 group-hover:text-purple-600">Nuova Comunicazione</span>
                        </Link>
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <StatCard
                    icon={MessageSquare}
                    label="Notifiche"
                    value={unreadCount}
                    color="red"
                    onClick={() => window.location.href = '/notifications'}
                />

                <StatCard
                    icon={Calendar}
                    label="Eventi 7gg"
                    value={dashboardData.upcomingEvents.length}
                    color="blue"
                    onClick={() => window.location.href = '/calendar'}
                />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Eventi prossimi */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                                <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                                Prossimi Eventi
                            </h2>
                            <select
                                value={eventsRange}
                                onChange={(e) => handleEventsRangeChange(e.target.value)}
                                className="text-sm text-blue-600 font-medium border border-gray-200 rounded-md px-2 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {DASHBOARD_RANGE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="p-6">
                        {displayedEventsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                            </div>
                        ) : displayedEvents.length === 0 ? (
                            <div className="text-center py-12">
                                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-4 text-lg font-medium text-gray-900">Nessun evento</h3>
                                <p className="mt-2 text-sm text-gray-500">
                                    Non ci sono eventi programmati in questo periodo
                                </p>
                                {(user.role === 'admin' || user.role === 'coach') && (
                                    <Link
                                        to="/events/new"
                                        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Aggiungi Evento
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {displayedEvents.map((event) => (
                                    <Link
                                        key={event.id}
                                        to={`/calendar/${event.id}`}
                                        className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <div className={`p-2 rounded-lg ${getEventTypeColor(event.event_type)}`}>
                                            <Calendar className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-medium text-gray-900 truncate">{event.title}</h3>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {formatEventDate(event.start_datetime)}
                                            </p>
                                            {event.location && (
                                                <p className="text-xs text-gray-500 mt-1 flex items-center">
                                                    📍 {event.location}
                                                </p>
                                            )}
                                            {(user.role === 'athlete' || user.role === 'parent') && event.my_attendance_status && (
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${ATTENDANCE_STATUS_COLORS[event.my_attendance_status]}`}>
                                                    {ATTENDANCE_STATUS_LABELS[event.my_attendance_status]}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Comunicazioni recenti */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                                <MessageSquare className="h-5 w-5 mr-2 text-green-600" />
                                Comunicazioni
                            </h2>
                            <select
                                value={commsRange}
                                onChange={(e) => handleCommsRangeChange(e.target.value)}
                                className="text-sm text-blue-600 font-medium border border-gray-200 rounded-md px-2 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {DASHBOARD_RANGE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="p-6">
                        {listCommsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                            </div>
                        ) : listComms.length === 0 ? (
                            <div className="text-center py-2">
                                <p className="text-sm text-gray-500">
                                    Non ci sono comunicazioni recenti
                                </p>
                                {(user.role === 'admin' || user.role === 'coach') && (
                                    <Link
                                        to="/communications/new"
                                        className="mt-2 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Nuova Comunicazione
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {listComms.map((communication) => (
                                    <div key={communication.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-medium text-gray-900 flex items-center">
                                                    <span className="truncate">{communication.title}</span>
                                                    {communication.is_urgent && (
                                                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            Urgente
                                                        </span>
                                                    )}
                                                </h3>
                                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                    {communication.content.length > 100
                                                        ? communication.content.substring(0, 100) + '...'
                                                        : communication.content
                                                    }
                                                </p>
                                                <p className="text-xs text-gray-500 mt-2">
                                                    {format(new Date(communication.sent_at), 'dd/MM/yyyy HH:mm')}
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-2 ml-4">
                                                {!communication.is_read && (
                                                    <div className="w-2 h-2 bg-blue-600 rounded-full" />
                                                )}
                                                <Link
                                                    to={`/communications/${communication.id}`}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sezioni specifiche per ruolo */}
            {user.role === 'parent' && dashboardData.myAthletes.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                                <Users className="h-5 w-5 mr-2 text-purple-600" />
                                I Miei Atleti
                            </h2>
                            <Link
                                to="/athletes"
                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center font-medium transition-colors"
                            >
                                Gestisci
                                <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {dashboardData.myAthletes.map((athlete) => (
                                <div key={athlete.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                            <span className="text-white font-medium text-sm">
                                                {athlete.first_name.charAt(0)}{athlete.last_name.charAt(0)}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-medium text-gray-900 truncate">
                                                {athlete.first_name} {athlete.last_name}
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                {format(new Date(athlete.date_of_birth), 'dd/MM/yyyy')}
                                            </p>
                                            {athlete.groups_names && (
                                                <p className="text-xs text-blue-600 mt-1 truncate">
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
                    </div>
                </div>
            )}

            {/* Documenti in scadenza (solo admin/coach) */}
            {(user.role === 'admin' || user.role === 'coach') && dashboardData.expiringDocuments.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                                <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
                                Documenti in Scadenza
                            </h2>
                            <Link
                                to="/documents?filter=expiring"
                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center font-medium transition-colors"
                            >
                                Vedi tutti
                                <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="space-y-3">
                            {dashboardData.expiringDocuments.slice(0, 5).map((doc) => (
                                <div key={doc.id} className={`p-4 border rounded-lg ${getDocumentUrgencyColor(doc.urgency_level)}`}>
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
                    </div>
                </div>
            )}

        </div>
    );
};

export default Dashboard;
