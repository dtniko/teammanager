import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Clock, Users, User, BarChart3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import { CardSkeleton } from '../Common/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const TARGET_LABELS = {
    all: 'Tutti',
    parents: 'Genitori',
    athletes: 'Atleti'
};

const CommunicationDetail = () => {
    const { communicationId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [communication, setCommunication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const canManage = user.role === 'admin' || user.role === 'coach';
    const isAdmin = user.role === 'admin';

    const loadCommunication = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiService.getCommunicationById(communicationId);
            setCommunication(response.communication);
        } catch (error) {
            console.error("Errore nel caricamento della comunicazione:", error);
            toast.error(error?.error || "Errore nel caricamento della comunicazione");
            navigate('/communications');
        } finally {
            setLoading(false);
        }
    }, [communicationId, navigate]);

    useEffect(() => {
        loadCommunication();
    }, [loadCommunication]);

    // Statistiche di lettura: solo per admin/coach, errore non blocca la pagina
    useEffect(() => {
        if (!canManage || !communication) {
            setStats(null);
            return;
        }
        let active = true;
        const loadStats = async () => {
            try {
                const response = await apiService.getCommunicationStats(communicationId);
                if (active) setStats(response.stats || null);
            } catch (error) {
                console.error('Errore nel caricamento delle statistiche di lettura:', error);
                if (active) setStats(null);
            }
        };
        loadStats();
        return () => { active = false; };
    }, [canManage, communication, communicationId]);

    const handleDelete = async () => {
        if (!window.confirm('Sei sicuro di voler eliminare questa comunicazione?')) {
            return;
        }

        try {
            setDeleting(true);
            await apiService.deleteCommunication(communicationId);
            toast.success('Comunicazione eliminata');
            navigate('/communications');
        } catch (error) {
            console.error("Errore nell'eliminazione della comunicazione:", error);
            toast.error(error?.error || "Errore nell'eliminazione della comunicazione");
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

    if (!communication) {
        return null;
    }

    const targetLabel = communication.target_type === 'group'
        ? (communication.target_group_name || 'Gruppo')
        : (TARGET_LABELS[communication.target_type] || communication.target_type);

    const readPercent = stats && stats.total_recipients > 0
        ? Math.round((stats.read_count / stats.total_recipients) * 100)
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/communications')}
                    className="flex items-center text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft className="h-5 w-5 mr-1" />
                    Torna alle comunicazioni
                </button>

                {isAdmin && (
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        title="Elimina"
                        className="flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deleting ? 'Eliminazione...' : 'Elimina'}
                    </button>
                )}
            </div>

            {/* Communication Info */}
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex flex-wrap items-center space-x-3">
                    <h1 className="text-2xl font-bold text-gray-900">{communication.title}</h1>
                    {communication.is_urgent && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Urgente
                        </span>
                    )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                    <div className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-gray-400" />
                        {communication.sender_first_name} {communication.sender_last_name}
                    </div>
                    <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                        {format(new Date(communication.sent_at), 'dd/MM/yyyy HH:mm')}
                    </div>
                    <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-gray-400" />
                        {targetLabel}
                    </div>
                </div>

                <div className="mt-5 pt-5 border-t border-gray-200">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{communication.content}</p>
                </div>
            </div>

            {/* Statistiche lettura per admin/coach */}
            {canManage && stats && (
                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center space-x-2">
                        <BarChart3 className="h-5 w-5 text-gray-400" />
                        <h3 className="text-lg font-medium text-gray-900">Statistiche di lettura</h3>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                        <span className="font-medium text-gray-900">{stats.read_count}</span> di{' '}
                        <span className="font-medium text-gray-900">{stats.total_recipients}</span> destinatari hanno letto la comunicazione
                        {stats.unread_count > 0 && (
                            <span className="text-gray-500"> ({stats.unread_count} non letti)</span>
                        )}
                    </p>
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${readPercent}%` }}
                        />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{readPercent}% letti</p>
                </div>
            )}
        </div>
    );
};

export default CommunicationDetail;