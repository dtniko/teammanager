import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Edit,
    Trash2,
    Clock,
    MapPin,
    Users,
    FileText,
    CheckCircle,
    XCircle,
    Megaphone,
    X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner, { CardSkeleton } from '../Common/LoadingSpinner';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';
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

const STATUS_LABELS = {
    pending: 'In attesa',
    called_up: 'Convocato',
    present: 'Presente',
    absent: 'Assente'
};

const STATUS_COLORS = {
    pending: 'bg-gray-100 text-gray-800',
    called_up: 'bg-yellow-100 text-yellow-800',
    present: 'bg-green-100 text-green-800',
    absent: 'bg-red-100 text-red-800'
};

const ACTUAL_STATUS_LABELS = {
    present: 'Presente',
    absent: 'Assente'
};

const ACTUAL_STATUS_COLORS = {
    present: 'bg-green-100 text-green-800',
    absent: 'bg-red-100 text-red-800'
};

const EventDetail = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [myAthleteIds, setMyAthleteIds] = useState([]);
    const [convening, setConvening] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [saving, setSaving] = useState(false);

    const canManage = user.role === 'admin' || user.role === 'coach';

    const loadEvent = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiService.getEventById(eventId);
            setEvent(response.event);
        } catch (error) {
            console.error('Errore nel caricamento dell\'evento:', error);
            toast.error('Errore nel caricamento dell\'evento');
            navigate('/calendar');
        } finally {
            setLoading(false);
        }
    }, [eventId, navigate]);

    useEffect(() => {
        loadEvent();
    }, [loadEvent]);

    useEffect(() => {
        const loadMyAthletes = async () => {
            if (user.role === 'parent') {
                try {
                    const response = await apiService.getMyAthletes();
                    setMyAthleteIds((response.athletes || []).map(a => a.id));
                } catch (error) {
                    console.error('Errore nel caricamento dei propri atleti:', error);
                }
            }
        };
        loadMyAthletes();
    }, [user.role]);

    const myAttendanceRows = () => {
        if (!event?.attendance) return [];

        if (user.role === 'parent') {
            return event.attendance.filter(a => myAthleteIds.includes(a.athlete_id));
        }

        if (user.role === 'athlete') {
            return event.attendance.filter(a => a.athlete_user_id === user.id);
        }

        return [];
    };

    const summary = (event?.attendance || []).reduce((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
    }, {});

    const handleMarkAttendance = async (athleteId, status) => {
        try {
            await apiService.markAttendance(eventId, athleteId, status);
            toast.success('Presenza aggiornata');
            loadEvent();
        } catch (error) {
            console.error('Errore nell\'aggiornamento della presenza:', error);
            toast.error(error?.error || 'Errore nell\'aggiornamento della presenza');
        }
    };

    const handleMarkActualAttendance = async (athleteId, actualStatus) => {
        try {
            await apiService.markActualAttendance(eventId, athleteId, actualStatus);
            toast.success('Presenza reale aggiornata');
            loadEvent();
        } catch (error) {
            console.error('Errore nell\'aggiornamento della presenza reale:', error);
            toast.error(error?.error || 'Errore nell\'aggiornamento della presenza reale');
        }
    };

    const handleConveneAll = async () => {
        try {
            setConvening(true);
            const response = await apiService.conveneGroup(eventId);
            toast.success(`${response.convened} atleti convocati`);
            loadEvent();
        } catch (error) {
            console.error('Errore nella convocazione:', error);
            toast.error(error?.error || 'Errore nella convocazione');
        } finally {
            setConvening(false);
        }
    };

    const toDatetimeLocal = (isoString) => {
        const date = parseISO(isoString);
        const offset = date.getTimezoneOffset();
        const local = new Date(date.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
    };

    const openEditForm = () => {
        setEditForm({
            title: event.title || '',
            description: event.description || '',
            eventType: event.event_type,
            startDatetime: toDatetimeLocal(event.start_datetime),
            endDatetime: toDatetimeLocal(event.end_datetime),
            location: event.location || ''
        });
        setShowEditForm(true);
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateEvent = async (e) => {
        e.preventDefault();

        try {
            setSaving(true);
            await apiService.updateEvent(eventId, editForm);
            toast.success('Evento aggiornato con successo');
            setShowEditForm(false);
            loadEvent();
        } catch (error) {
            console.error('Errore nell\'aggiornamento dell\'evento:', error);
            toast.error(error?.error || 'Errore nell\'aggiornamento dell\'evento');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEvent = async () => {
        if (!window.confirm('Sei sicuro di voler eliminare questo evento?')) {
            return;
        }

        try {
            setDeleting(true);
            await apiService.deleteEvent(eventId);
            toast.success('Evento eliminato');
            navigate('/calendar');
        } catch (error) {
            console.error('Errore nell\'eliminazione dell\'evento:', error);
            toast.error(error?.error || 'Errore nell\'eliminazione dell\'evento');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <CardSkeleton className="h-8 w-64" />
                <CardSkeleton />
            </div>
        );
    }

    if (!event) {
        return null;
    }

    const myRows = myAttendanceRows();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start space-x-4">
                    <button
                        onClick={() => navigate('/calendar')}
                        className="flex items-center text-gray-600 hover:text-gray-900 mt-1"
                    >
                        <ArrowLeft className="h-5 w-5 mr-1" />
                        Torna al calendario
                    </button>
                </div>

                {canManage && (
                    <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                        <button
                            onClick={openEditForm}
                            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            <Edit className="h-4 w-4 mr-2" />
                            Modifica
                        </button>
                        <button
                            onClick={handleDeleteEvent}
                            disabled={deleting}
                            className="flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Elimina
                        </button>
                    </div>
                )}
            </div>

            {/* Event Info */}
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center space-x-3">
                    <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${EVENT_TYPE_COLORS[event.event_type] || 'bg-gray-100 text-gray-800'}`}>
                        {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                    </span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                        {format(parseISO(event.start_datetime), 'EEEE d MMMM yyyy, HH:mm', { locale: it })}
                        {' - '}
                        {format(parseISO(event.end_datetime), 'HH:mm', { locale: it })}
                    </div>
                    {event.group_name && (
                        <div className="flex items-center">
                            <Users className="h-4 w-4 mr-2 text-gray-400" />
                            {event.group_name}
                        </div>
                    )}
                    {event.location && (
                        <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                            {event.location}
                        </div>
                    )}
                </div>

                {event.description && (
                    <div className="mt-4 flex items-start text-sm text-gray-600">
                        <FileText className="h-4 w-4 mr-2 mt-0.5 text-gray-400" />
                        <p>{event.description}</p>
                    </div>
                )}
            </div>

            {/* Self banner for parent/athlete */}
            {!canManage && myRows.map(row => (
                <div
                    key={row.id}
                    className={`rounded-lg p-6 shadow ${row.status === 'called_up' ? 'bg-yellow-50 border border-yellow-200' : 'bg-white'}`}
                >
                    {row.status === 'called_up' ? (
                        <>
                            <div className="flex items-center">
                                <Megaphone className="h-5 w-5 text-yellow-600 mr-2" />
                                <h3 className="text-sm font-semibold text-yellow-800">
                                    Sei stato convocato per questo evento
                                </h3>
                            </div>
                            <div className="mt-4 flex items-center space-x-3">
                                <button
                                    onClick={() => handleMarkAttendance(row.athlete_id, 'present')}
                                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Parteciperò
                                </button>
                                <button
                                    onClick={() => handleMarkAttendance(row.athlete_id, 'absent')}
                                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                                >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Non ci sarò
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-900">La tua presenza</p>
                                <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status]}`}>
                                    {STATUS_LABELS[row.status]}
                                </span>
                            </div>
                            {(row.status === 'present' || row.status === 'absent') && (
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handleMarkAttendance(row.athlete_id, 'present')}
                                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100"
                                    >
                                        Presente
                                    </button>
                                    <button
                                        onClick={() => handleMarkAttendance(row.athlete_id, 'absent')}
                                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
                                    >
                                        Assente
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {/* Roster for admin/coach */}
            {canManage && (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Presenze</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {Object.entries(summary).map(([status, count]) => `${count} ${STATUS_LABELS[status]?.toLowerCase()}`).join(' · ') || 'Nessun atleta associato'}
                            </p>
                        </div>
                        {event.group_id && (
                            <button
                                onClick={handleConveneAll}
                                disabled={convening}
                                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                                <Megaphone className="h-4 w-4 mr-2" />
                                {convening ? 'Convocazione...' : 'Convoca tutti'}
                            </button>
                        )}
                    </div>

                    {(!event.attendance || event.attendance.length === 0) ? (
                        <div className="text-center py-12">
                            <Users className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun atleta</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Questo evento non è associato a un gruppo con atleti
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {event.attendance.map(row => (
                                <div key={row.id} className="p-4 space-y-3">
                                    <p className="text-sm font-medium text-gray-900">
                                        {row.first_name} {row.last_name}
                                    </p>
                                    {row.notes && (
                                        <p className="text-xs text-gray-500 -mt-2">{row.notes}</p>
                                    )}

                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        {/* RSVP block */}
                                        <div className="flex items-center justify-between sm:justify-start sm:space-x-3">
                                            <span className="text-xs text-gray-500 mr-2">Risposta convocazione</span>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status]}`}>
                                                {STATUS_LABELS[row.status]}
                                            </span>
                                            <select
                                                value={row.status}
                                                onChange={(e) => handleMarkAttendance(row.athlete_id, e.target.value)}
                                                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            >
                                                <option value="pending">In attesa</option>
                                                <option value="called_up">Convocato</option>
                                                <option value="present">Presente</option>
                                                <option value="absent">Assente</option>
                                            </select>
                                        </div>

                                        {/* Actual attendance block */}
                                        <div className="flex items-center justify-between sm:justify-start sm:space-x-3 bg-gray-50 rounded-md px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0">
                                            <span className="text-xs text-gray-500 mr-2">Presenza reale</span>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.actual_status ? ACTUAL_STATUS_COLORS[row.actual_status] : 'bg-gray-100 text-gray-800'}`}>
                                                {row.actual_status ? ACTUAL_STATUS_LABELS[row.actual_status] : 'Da confermare'}
                                            </span>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => handleMarkActualAttendance(row.athlete_id, 'present')}
                                                    className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100"
                                                    title="Segna presente"
                                                >
                                                    ✅ Presente
                                                </button>
                                                <button
                                                    onClick={() => handleMarkActualAttendance(row.athlete_id, 'absent')}
                                                    className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
                                                    title="Segna assente"
                                                >
                                                    ❌ Assente
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {convening && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg">
                        <LoadingSpinner size="medium" text="Convocazione in corso..." />
                    </div>
                </div>
            )}

            {/* Edit Event Modal */}
            {showEditForm && editForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Modifica evento</h3>
                            <button
                                onClick={() => setShowEditForm(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateEvent} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Titolo *</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={editForm.title}
                                    onChange={handleEditFormChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                                <textarea
                                    name="description"
                                    value={editForm.description}
                                    onChange={handleEditFormChange}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo evento *</label>
                                <select
                                    name="eventType"
                                    value={editForm.eventType}
                                    onChange={handleEditFormChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="training">Allenamento</option>
                                    <option value="match">Partita</option>
                                    <option value="meeting">Riunione</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Inizio *</label>
                                    <input
                                        type="datetime-local"
                                        name="startDatetime"
                                        value={editForm.startDatetime}
                                        onChange={handleEditFormChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fine *</label>
                                    <input
                                        type="datetime-local"
                                        name="endDatetime"
                                        value={editForm.endDatetime}
                                        onChange={handleEditFormChange}
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
                                    value={editForm.location}
                                    onChange={handleEditFormChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowEditForm(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? 'Salvataggio...' : 'Salva modifiche'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventDetail;
