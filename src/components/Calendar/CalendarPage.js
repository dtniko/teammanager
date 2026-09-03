import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Calendar as CalendarIcon,
    Plus,
    MapPin,
    Clock,
    Users,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner from '../Common/LoadingSpinner';
import { toast } from 'react-toastify';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const EVENT_TYPE_LABELS = {
    training: 'Allenamento',
    match: 'Partita',
    meeting: 'Riunione'
};

const EVENT_TYPE_COLORS = {
    training: 'bg-blue-100 text-blue-800',
    match: 'bg-red-100 text-red-800',
    meeting: 'bg-purple-100 text-purple-800'
};

const CalendarPage = () => {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [pastEvents, setPastEvents] = useState([]);
    const [showPastEvents, setShowPastEvents] = useState(false);
    const [loadingPast, setLoadingPast] = useState(false);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [eventTypeFilter, setEventTypeFilter] = useState('');
    const [groupFilter, setGroupFilter] = useState('');
    const [selectedAthleteId, setSelectedAthleteId] = useState('');

    const canManage = user.role === 'admin' || user.role === 'coach';
    const showAthleteSelector = user.role === 'parent' && (user.athletes || []).length > 1;

    useEffect(() => {
        if (canManage) {
            loadGroups();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadGroups = async () => {
        try {
            const response = await apiService.getGroups();
            setGroups(response.groups || []);
        } catch (error) {
            console.error('Errore nel caricamento dei gruppi:', error);
        }
    };

    const loadEvents = useCallback(async () => {
        try {
            setLoading(true);

            const params = {
                startDate: new Date().toISOString()
            };

            if (eventTypeFilter) {
                params.eventType = eventTypeFilter;
            }

            if (groupFilter) {
                params.groupId = groupFilter;
            }

            if (selectedAthleteId) {
                params.athleteId = selectedAthleteId;
            }

            const response = await apiService.getEvents(params);
            setEvents(response.events || []);
        } catch (error) {
            console.error('Errore nel caricamento degli eventi:', error);
            toast.error('Errore nel caricamento degli eventi');
        } finally {
            setLoading(false);
        }
    }, [eventTypeFilter, groupFilter, selectedAthleteId]);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const loadPastEvents = useCallback(async () => {
        try {
            setLoadingPast(true);

            const params = {
                endDate: new Date().toISOString()
            };

            if (eventTypeFilter) {
                params.eventType = eventTypeFilter;
            }

            if (groupFilter) {
                params.groupId = groupFilter;
            }

            const response = await apiService.getEvents(params);
            setPastEvents(response.events || []);
        } catch (error) {
            console.error('Errore nel caricamento degli eventi passati:', error);
            toast.error('Errore nel caricamento degli eventi passati');
        } finally {
            setLoadingPast(false);
        }
    }, [eventTypeFilter, groupFilter]);

    useEffect(() => {
        if (canManage && showPastEvents) {
            loadPastEvents();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showPastEvents, loadPastEvents]);

    const groupDateLabel = (dateStr) => {
        const date = parseISO(dateStr);
        if (isToday(date)) return 'Oggi';
        if (isTomorrow(date)) return 'Domani';
        return format(date, 'EEEE d MMMM yyyy', { locale: it });
    };

    const groupEventsByDay = (list) => list.reduce((acc, event) => {
        const dayKey = format(parseISO(event.start_datetime), 'yyyy-MM-dd');
        if (!acc[dayKey]) {
            acc[dayKey] = [];
        }
        acc[dayKey].push(event);
        return acc;
    }, {});

    const groupedEvents = groupEventsByDay(events);
    const groupedPastEvents = groupEventsByDay(pastEvents);

    const renderAttendanceBadge = (event) => {
        if (!canManage) return null;

        const parts = [];
        if (parseInt(event.called_up_count) > 0) {
            parts.push(`${event.called_up_count} convocati`);
        }
        if (parseInt(event.present_count) > 0) {
            parts.push(`${event.present_count} confermati`);
        }
        if (parseInt(event.absent_count) > 0) {
            parts.push(`${event.absent_count} assenti`);
        }
        if (parseInt(event.pending_count) > 0) {
            parts.push(`${event.pending_count} in attesa`);
        }

        if (parts.length === 0) return null;

        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                <Users className="h-3 w-3 mr-1" />
                {parts.join(', ')}
            </span>
        );
    };

    const renderEventCard = (event) => (
        <Link
            key={event.id}
            to={`/calendar/${event.id}`}
            className="block bg-white shadow rounded-lg p-4 hover:shadow-md transition-shadow"
        >
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-gray-900">
                            {event.title}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${EVENT_TYPE_COLORS[event.event_type] || 'bg-gray-100 text-gray-800'}`}>
                            {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                        </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {format(parseISO(event.start_datetime), 'HH:mm', { locale: it })} - {format(parseISO(event.end_datetime), 'HH:mm', { locale: it })}
                        </span>
                        {event.group_name && (
                            <span className="flex items-center">
                                <Users className="h-4 w-4 mr-1" />
                                {event.group_name}
                            </span>
                        )}
                        {event.location && (
                            <span className="flex items-center">
                                <MapPin className="h-4 w-4 mr-1" />
                                {event.location}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            {renderAttendanceBadge(event) && (
                <div className="mt-3">
                    {renderAttendanceBadge(event)}
                </div>
            )}
        </Link>
    );

    const renderDayGroups = (grouped, sortDirection = 'asc') => {
        const dayKeys = Object.keys(grouped).sort();
        if (sortDirection === 'desc') dayKeys.reverse();

        return dayKeys.map(dayKey => (
            <div key={dayKey}>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                    {groupDateLabel(dayKey)}
                </h2>
                <div className="space-y-3">
                    {grouped[dayKey].map(renderEventCard)}
                </div>
            </div>
        ));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
                    <p className="text-gray-600 mt-1">
                        Visualizza eventi, allenamenti e partite
                    </p>
                </div>

                {canManage && (
                    <div className="mt-4 sm:mt-0">
                        <Link
                            to="/events/new"
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nuovo evento
                        </Link>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {showAthleteSelector && (
                        <select
                            value={selectedAthleteId}
                            onChange={(e) => setSelectedAthleteId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Tutti gli atleti</option>
                            {user.athletes.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.first_name} {a.last_name}
                                </option>
                            ))}
                        </select>
                    )}

                    <select
                        value={eventTypeFilter}
                        onChange={(e) => setEventTypeFilter(e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${showAthleteSelector ? '' : 'md:col-span-2'}`}
                    >
                        <option value="">Tutti i tipi di evento</option>
                        <option value="training">Allenamento</option>
                        <option value="match">Partita</option>
                        <option value="meeting">Riunione</option>
                    </select>

                    {canManage && (
                        <select
                            value={groupFilter}
                            onChange={(e) => setGroupFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Tutti i gruppi</option>
                            {groups.map(group => (
                                <option key={group.id} value={group.id}>
                                    {group.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Events List */}
            {loading ? (
                <div className="bg-white shadow rounded-lg p-8 text-center">
                    <LoadingSpinner size="medium" text="Caricamento eventi..." />
                </div>
            ) : Object.keys(groupedEvents).length === 0 ? (
                <div className="bg-white shadow rounded-lg p-8 text-center">
                    <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun evento in programma</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Non ci sono eventi che corrispondono ai filtri selezionati
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {renderDayGroups(groupedEvents, 'asc')}
                </div>
            )}

            {/* Past Events (solo admin/coach, collassato di default) */}
            {canManage && (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <button
                        onClick={() => setShowPastEvents(prev => !prev)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
                    >
                        <span className="text-sm font-semibold text-gray-700 flex items-center">
                            {showPastEvents ? (
                                <ChevronDown className="h-4 w-4 mr-2 text-gray-400" />
                            ) : (
                                <ChevronRight className="h-4 w-4 mr-2 text-gray-400" />
                            )}
                            Eventi passati
                        </span>
                        <span className="text-xs text-gray-400">
                            Modificabili solo da admin/coach
                        </span>
                    </button>

                    {showPastEvents && (
                        <div className="p-4 border-t border-gray-200 space-y-6">
                            {loadingPast ? (
                                <LoadingSpinner size="medium" text="Caricamento eventi passati..." />
                            ) : Object.keys(groupedPastEvents).length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">
                                    Nessun evento passato trovato
                                </p>
                            ) : (
                                renderDayGroups(groupedPastEvents, 'desc')
                            )}
                        </div>
                    )}
                </div>
            )}

            </div>
    );
};

export default CalendarPage;
