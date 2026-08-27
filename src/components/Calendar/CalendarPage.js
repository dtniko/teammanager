import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Calendar as CalendarIcon,
    Plus,
    MapPin,
    Clock,
    Users,
    X,
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

const emptyForm = {
    title: '',
    description: '',
    eventType: 'training',
    startDatetime: '',
    endDatetime: '',
    location: '',
    groupId: '',
    isRecurring: false,
    recurringUntil: ''
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
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const canManage = user.role === 'admin' || user.role === 'coach';

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

            const response = await apiService.getEvents(params);
            setEvents(response.events || []);
        } catch (error) {
            console.error('Errore nel caricamento degli eventi:', error);
            toast.error('Errore nel caricamento degli eventi');
        } finally {
            setLoading(false);
        }
    }, [eventTypeFilter, groupFilter]);

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

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: checked }));
    };

    const handleCreateEvent = async (e) => {
        e.preventDefault();

        if (!form.title || !form.startDatetime || !form.endDatetime) {
            toast.error('Compila tutti i campi obbligatori');
            return;
        }

        if (form.isRecurring) {
            if (!form.recurringUntil) {
                toast.error('Indica fino a quando ripetere l\'evento');
                return;
            }

            if (new Date(form.recurringUntil) < new Date(form.startDatetime.slice(0, 10))) {
                toast.error('La data "Fino al" deve essere successiva o uguale alla data di inizio');
                return;
            }
        }

        try {
            setSaving(true);
            const response = await apiService.createEvent({
                title: form.title,
                description: form.description,
                eventType: form.eventType,
                startDatetime: form.startDatetime,
                endDatetime: form.endDatetime,
                location: form.location,
                groupId: form.groupId || null,
                isRecurring: form.isRecurring,
                recurringUntil: form.isRecurring ? form.recurringUntil : null
            });
            const count = response?.count || 1;
            toast.success(count > 1 ? `${count} eventi creati con successo` : 'Evento creato con successo');
            setShowForm(false);
            setForm(emptyForm);
            loadEvents();
        } catch (error) {
            console.error('Errore nella creazione dell\'evento:', error);
            toast.error(error?.error || 'Errore nella creazione dell\'evento');
        } finally {
            setSaving(false);
        }
    };

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
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nuovo evento
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select
                        value={eventTypeFilter}
                        onChange={(e) => setEventTypeFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

            {/* New Event Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Nuovo evento</h3>
                            <button
                                onClick={() => { setShowForm(false); setForm(emptyForm); }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateEvent} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Titolo *</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={form.title}
                                    onChange={handleFormChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleFormChange}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo evento *</label>
                                    <select
                                        name="eventType"
                                        value={form.eventType}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="training">Allenamento</option>
                                        <option value="match">Partita</option>
                                        <option value="meeting">Riunione</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Gruppo</label>
                                    <select
                                        name="groupId"
                                        value={form.groupId}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="">Nessun gruppo</option>
                                        {groups.map(group => (
                                            <option key={group.id} value={group.id}>
                                                {group.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Inizio *</label>
                                    <input
                                        type="datetime-local"
                                        name="startDatetime"
                                        value={form.startDatetime}
                                        onChange={handleFormChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fine *</label>
                                    <input
                                        type="datetime-local"
                                        name="endDatetime"
                                        value={form.endDatetime}
                                        onChange={handleFormChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <input
                                    type="text"
                                    name="location"
                                    value={form.location}
                                    onChange={handleFormChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="isRecurring"
                                        checked={form.isRecurring}
                                        onChange={handleCheckboxChange}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm font-medium text-gray-700">Evento ricorrente (settimanale)</span>
                                </label>
                            </div>

                            {form.isRecurring && (
                                <div className="space-y-3 bg-gray-50 p-3 rounded-md">
                                    <p className="text-sm text-gray-600">
                                        {form.startDatetime
                                            ? <>Si ripeterà ogni <strong>{format(parseISO(form.startDatetime), 'EEEE', { locale: it })}</strong> a partire dalla data di inizio sopra indicata.</>
                                            : 'Imposta prima la data di inizio'}
                                    </p>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fino al *</label>
                                        <input
                                            type="date"
                                            name="recurringUntil"
                                            value={form.recurringUntil}
                                            onChange={handleFormChange}
                                            required={form.isRecurring}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end space-x-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowForm(false); setForm(emptyForm); }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? 'Creazione...' : 'Crea evento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarPage;
