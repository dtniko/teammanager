import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Check, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiService from '../../services/apiService';
import { TableSkeleton } from '../Common/LoadingSpinner';

const getContextLabel = (context) => {
    const labels = {
        athlete: 'Atleta (auto-collegamento)',
        parent: 'Genitore (collega figlio)'
    };
    return labels[context] || context;
};

const getRelationshipLabel = (relationship) => {
    const labels = {
        parent: 'Genitore',
        guardian: 'Tutore',
        tutor: 'Tutore legale'
    };
    return labels[relationship] || relationship;
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const PendingApprovals = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        try {
            setLoading(true);
            const response = await apiService.getPendingOnboardingRequests();
            setRequests(response.requests || []);
        } catch (error) {
            console.error('Errore nel caricamento delle richieste:', error);
            toast.error('Errore nel caricamento delle richieste');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (request) => {
        setProcessingId(request.id);

        try {
            const response = await apiService.approveOnboardingRequest(request.id);

            if (response.success !== false) {
                toast.success('Richiesta approvata con successo');
                setRequests(prev => prev.filter(r => r.id !== request.id));
            } else {
                throw new Error(response.error || 'Errore nell\'approvazione della richiesta');
            }
        } catch (error) {
            console.error('Errore nell\'approvazione della richiesta:', error);
            toast.error(error.error || error.message || 'Errore nell\'approvazione della richiesta');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (request) => {
        if (!window.confirm('Rifiutare questa richiesta di collegamento?')) {
            return;
        }

        setProcessingId(request.id);

        try {
            const response = await apiService.rejectOnboardingRequest(request.id);

            if (response.success !== false) {
                toast.success('Richiesta rifiutata');
                setRequests(prev => prev.filter(r => r.id !== request.id));
            } else {
                throw new Error(response.error || 'Errore nel rifiuto della richiesta');
            }
        } catch (error) {
            console.error('Errore nel rifiuto della richiesta:', error);
            toast.error(error.error || error.message || 'Errore nel rifiuto della richiesta');
        } finally {
            setProcessingId(null);
        }
    };

    if (loading && requests.length === 0) {
        return <TableSkeleton rows={5} />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Richieste da approvare</h1>
                <p className="text-gray-600 mt-1">
                    Approva o rifiuta le richieste di collegamento tra account utente e profili atleta
                </p>
            </div>

            {/* Requests List */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                {requests.length === 0 ? (
                    <div className="text-center py-12">
                        <ClipboardCheck className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna richiesta in attesa</h3>
                    </div>
                ) : (
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utente richiedente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo richiesta</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Atleta</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Relazione</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data richiesta</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {requests.map((r) => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {r.user_first_name} {r.user_last_name}
                                        <div className="text-xs text-gray-500 font-normal">{r.user_email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {getContextLabel(r.context)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {r.athlete_first_name} {r.athlete_last_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {r.relationship ? getRelationshipLabel(r.relationship) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDate(r.created_at)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-3">
                                            <button
                                                onClick={() => handleApprove(r)}
                                                disabled={processingId === r.id}
                                                className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                                title="Approva"
                                            >
                                                <Check className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleReject(r)}
                                                disabled={processingId === r.id}
                                                className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                                title="Rifiuta"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-4 p-4">
                    {requests.map((r) => (
                        <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900">{r.user_first_name} {r.user_last_name}</h3>
                                    <p className="text-xs text-gray-500">{r.user_email}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handleApprove(r)}
                                        disabled={processingId === r.id}
                                        className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                    >
                                        <Check className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => handleReject(r)}
                                        disabled={processingId === r.id}
                                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 text-sm text-gray-600 space-y-1">
                                <p><span className="font-medium text-gray-700">Tipo:</span> {getContextLabel(r.context)}</p>
                                <p><span className="font-medium text-gray-700">Atleta:</span> {r.athlete_first_name} {r.athlete_last_name}</p>
                                {r.relationship && (
                                    <p><span className="font-medium text-gray-700">Relazione:</span> {getRelationshipLabel(r.relationship)}</p>
                                )}
                                <p><span className="font-medium text-gray-700">Data:</span> {formatDate(r.created_at)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PendingApprovals;
