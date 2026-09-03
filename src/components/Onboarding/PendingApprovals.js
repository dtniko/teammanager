import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Check, X } from 'lucide-react';
import { toast } from 'react-toastify';
import apiService from '../../services/apiService';
import { TableSkeleton } from '../Common/LoadingSpinner';

const CONTEXT_LABELS = {
    athlete: 'Atleta (auto-collegamento)',
    parent: 'Genitore (collega figlio)'
};

const RELATIONSHIP_LABELS = {
    parent: 'Genitore',
    guardian: 'Tutore',
    tutor: 'Tutore legale'
};

const ROLE_LABELS = {
    admin: 'Amministratore',
    coach: 'Coach / Dirigente'
};

const TYPE_BADGE = {
    profile_link: { bg: 'bg-blue-100', text: 'text-blue-800' },
    role_change: { bg: 'bg-amber-100', text: 'text-amber-800' }
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
            const response = await apiService.getUnifiedPendingRequests();
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
            let response;
            if (request.type === 'role_change') {
                response = await apiService.approveRoleChange(request.id);
            } else {
                response = await apiService.approveOnboardingRequest(request.id);
            }

            if (response.success !== false) {
                const typeLabel = request.type === 'role_change' ? 'cambio ruolo' : 'collegamento profilo';
                toast.success(`Richiesta di ${typeLabel} approvata`);
                setRequests(prev => prev.filter(r => r.id !== request.id));
            } else {
                throw new Error(response.error || 'Errore nell\'approvazione');
            }
        } catch (error) {
            console.error('Errore nell\'approvazione:', error);
            toast.error(error.error || error.message || 'Errore nell\'approvazione');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (request) => {
        const typeLabel = request.type === 'role_change' ? 'cambio ruolo' : 'collegamento profilo';
        if (!window.confirm(`Rifiutare questa richiesta di ${typeLabel}?`)) {
            return;
        }

        setProcessingId(request.id);

        try {
            let response;
            if (request.type === 'role_change') {
                response = await apiService.rejectRoleChange(request.id);
            } else {
                response = await apiService.rejectOnboardingRequest(request.id);
            }

            if (response.success !== false) {
                toast.success(`Richiesta di ${typeLabel} rifiutata`);
                setRequests(prev => prev.filter(r => r.id !== request.id));
            } else {
                throw new Error(response.error || 'Errore nel rifiuto');
            }
        } catch (error) {
            console.error('Errore nel rifiuto:', error);
            toast.error(error.error || error.message || 'Errore nel rifiuto');
        } finally {
            setProcessingId(null);
        }
    };

    if (loading && requests.length === 0) {
        return <TableSkeleton rows={5} />;
    }

    const profileLinkCount = requests.filter(r => r.type === 'profile_link').length;
    const roleChangeCount = requests.filter(r => r.type === 'role_change').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Richieste da approvare</h1>
                <p className="text-gray-600 mt-1">
                    {profileLinkCount > 0 && roleChangeCount > 0
                        ? `${profileLinkCount} collegamento${profileLinkCount > 1 ? 'i' : ''} + ${roleChangeCount} cambio${roleChangeCount > 1 ? 'i' : ''} ruolo in attesa`
                        : profileLinkCount > 0
                            ? `${profileLinkCount} richiesta${profileLinkCount > 1 ? 'e' : ''} in attesa`
                            : roleChangeCount > 0
                                ? `${roleChangeCount} richiesta${roleChangeCount > 1 ? 'e' : ''} in attesa`
                                : 'Nessuna richiesta in attesa'
                    }
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
                    <>
                        {/* Desktop Table */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utente richiedente</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Atleta</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Relazione</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruolo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motivazione</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {requests.map((r) => {
                                    const b = TYPE_BADGE[r.type];
                                    return (
                                        <tr key={r.id} className="hover:bg-gray-50">
                                            {/* Utente */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {r.user_first_name} {r.user_last_name}
                                                <div className="text-xs text-gray-500 font-normal">{r.user_email}</div>
                                            </td>
                                            {/* Tipo badge */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${b.bg} ${b.text}`}>
                                                    {r.type === 'profile_link'
                                                        ? CONTEXT_LABELS[r.context] || r.context
                                                        : ROLE_LABELS[r.requested_role] || r.requested_role
                                                    }
                                                </span>
                                            </td>
                                            {/* Atleta (solo profile_link) */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {r.type === 'profile_link' && r.athlete_first_name && r.athlete_last_name
                                                    ? `${r.athlete_first_name} ${r.athlete_last_name}`
                                                    : <span className="text-gray-300">—</span>
                                                }
                                            </td>
                                            {/* Relazione (solo profile_link) */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {r.type === 'profile_link' && r.relationship
                                                    ? RELATIONSHIP_LABELS[r.relationship]
                                                    : <span className="text-gray-300">—</span>
                                                }
                                            </td>
                                            {/* Ruolo richiesto (solo role_change) */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {r.type === 'role_change'
                                                    ? ROLE_LABELS[r.requested_role] || r.requested_role
                                                    : <span className="text-gray-300">—</span>
                                                }
                                            </td>
                                            {/* Motivazione (solo role_change) */}
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                                                {r.type === 'role_change' && r.reason ? (
                                                    <span title={r.reason} className="truncate block">{r.reason}</span>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>
                                            {/* Data */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(r.created_at)}
                                            </td>
                                            {/* Azioni */}
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
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="lg:hidden space-y-4 p-4">
                            {requests.map((r) => {
                                const b = TYPE_BADGE[r.type];
                                return (
                                    <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                        {/* Badge tipo + azioni in alto */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${b.bg} ${b.text}`}>
                                                    {r.type === 'profile_link'
                                                        ? CONTEXT_LABELS[r.context] || r.context
                                                        : ROLE_LABELS[r.requested_role] || r.requested_role
                                                    }
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-2 ml-2">
                                                <button
                                                    onClick={() => handleApprove(r)}
                                                    disabled={processingId === r.id}
                                                    className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                                >
                                                    <Check className="h-5 w-5" /> Approva
                                                </button>
                                                <button
                                                    onClick={() => handleReject(r)}
                                                    disabled={processingId === r.id}
                                                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                                >
                                                    <X className="h-5 w-5" /> Rifiuta
                                                </button>
                                            </div>
                                        </div>

                                        {/* Info utente */}
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-900">{r.user_first_name} {r.user_last_name}</h3>
                                            <p className="text-xs text-gray-500">{r.user_email}</p>
                                        </div>

                                        {/* Campi dinamici */}
                                        <div className="mt-3 space-y-2 text-sm">
                                            {r.type === 'profile_link' && (
                                                <>
                                                    <p><span className="font-medium text-gray-700">Atleta:</span> {r.athlete_first_name} {r.athlete_last_name}</p>
                                                    {r.relationship && (
                                                        <p><span className="font-medium text-gray-700">Relazione:</span> {RELATIONSHIP_LABELS[r.relationship]}</p>
                                                    )}
                                                </>
                                            )}
                                            {r.type === 'role_change' && (
                                                <>
                                                    <p><span className="font-medium text-gray-700">Ruolo richiesto:</span> {ROLE_LABELS[r.requested_role] || r.requested_role}</p>
                                                    {r.reason && (
                                                        <p className="text-gray-600">
                                                            <span className="font-medium text-gray-700">Motivazione:</span> {r.reason}
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                            <p><span className="font-medium text-gray-700">Data:</span> {formatDate(r.created_at)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PendingApprovals;