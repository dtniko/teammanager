import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, MailOpen, Inbox } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner from '../Common/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const TARGET_LABELS = {
    all: 'Tutti',
    parents: 'Genitori',
    athletes: 'Atleti'
};

const Communications = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [communications, setCommunications] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading, setLoading] = useState(true);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [page, setPage] = useState(1);
    const [markingAll, setMarkingAll] = useState(false);

    const canManage = user.role === 'admin' || user.role === 'coach';

    const loadCommunications = useCallback(async () => {
        try {
            setLoading(true);
            const params = { page, limit: 10 };
            if (unreadOnly) params.unreadOnly = true;
            const response = await apiService.getCommunications(params);
            setCommunications(response.communications || []);
            setPagination(response.pagination || null);
        } catch (error) {
            console.error('Errore nel caricamento delle comunicazioni:', error);
            toast.error(error?.error || 'Errore nel caricamento delle comunicazioni');
        } finally {
            setLoading(false);
        }
    }, [page, unreadOnly]);

    useEffect(() => {
        loadCommunications();
    }, [loadCommunications]);

    const handleToggleUnreadOnly = (e) => {
        const next = e.target.checked;
        setUnreadOnly(next);
        if (next) setPage(1);
    };

    const handleMarkAllRead = async () => {
        try {
            setMarkingAll(true);
            await apiService.markAllCommunicationsAsRead();
            toast.success('Tutte le comunicazioni segnate come lette');
            loadCommunications();
        } catch (error) {
            console.error('Errore nel segnare tutte le comunicazioni come lette:', error);
            toast.error(error?.error || 'Errore nel segnare le comunicazioni come lette');
        } finally {
            setMarkingAll(false);
        }
    };

    const targetLabel = (communication) => {
        if (communication.target_type === 'group') {
            return communication.target_group_name || 'Gruppo';
        }
        return TARGET_LABELS[communication.target_type] || communication.target_type;
    };

    const hasUnread = communications.some(c => !c.is_read);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                    <MessageSquare className="h-6 w-6 text-green-600" />
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Comunicazioni</h1>
                        <p className="text-sm text-gray-600">Messaggi inviati a gruppi, genitori e atleti</p>
                    </div>
                </div>

                {canManage && (
                    <div className="flex items-center space-x-2">
                        {hasUnread && (
                            <button
                                onClick={handleMarkAllRead}
                                disabled={markingAll}
                                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                <MailOpen className="h-4 w-4 mr-2" />
                                {markingAll ? 'Aggiornamento...' : 'Segna tutte come lette'}
                            </button>
                        )}
                        <Link
                            to="/communications/new"
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nuova
                        </Link>
                    </div>
                )}
            </div>

            {/* Filtro non lette */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3">
                <label className="flex items-center">
                    <input
                        type="checkbox"
                        checked={unreadOnly}
                        onChange={handleToggleUnreadOnly}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                        Solo non lette
                    </span>
                </label>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <LoadingSpinner size="medium" text="Caricamento comunicazioni..." />
                </div>
            ) : communications.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 text-center py-16">
                    <Inbox className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-3 text-sm font-medium text-gray-900">
                        {unreadOnly ? 'Nessuna comunicazione non letta' : 'Nessuna comunicazione'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                        {unreadOnly
                            ? 'Tutte le comunicazioni sono state lette. Ottimo!'
                            : 'Le comunicazioni inviate a te e ai tuoi gruppi appariranno qui.'}
                    </p>
                    {canManage && (
                        <Link
                            to="/communications/new"
                            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nuova Comunicazione
                        </Link>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
                    {communications.map(communication => (
                        <div
                            key={communication.id}
                            onClick={() => navigate(`/communications/${communication.id}`)}
                            className="flex items-start justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-medium text-gray-900 truncate">
                                        {communication.title}
                                    </h3>
                                    {communication.is_urgent && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                            Urgente
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                    {communication.content}
                                    </p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                                    <span>
                                        {communication.sender_first_name} {communication.sender_last_name}
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">
                                        {targetLabel(communication)}
                                    </span>
                                    <span>
                                        {format(new Date(communication.sent_at), 'dd/MM/yyyy HH:mm')}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                                {!communication.is_read && (
                                    <span className="w-2 h-2 bg-blue-600 rounded-full" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Paginazione */}
            {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Precedente
                    </button>
                    <span className="text-sm text-gray-600">
                        Pagina {pagination.page} di {pagination.pages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                        disabled={page >= pagination.pages}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Successiva
                    </button>
                </div>
            )}
        </div>
    );
};

export default Communications;