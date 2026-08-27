import React, { useState, useEffect } from 'react';
import {
    Calendar as CalendarIcon,
    Plus,
    CheckCircle,
    X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner, { TableSkeleton } from '../Common/LoadingSpinner';
import { toast } from 'react-toastify';

const initialFormState = {
    name: '',
    isCurrent: false
};

const Seasons = () => {
    const { user } = useAuth();
    const [seasons, setSeasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadSeasons();
    }, []);

    const loadSeasons = async () => {
        try {
            setLoading(true);
            const response = await apiService.getSeasons();
            setSeasons(response.seasons || []);
        } catch (error) {
            console.error('Errore nel caricamento delle stagioni:', error);
            toast.error('Errore nel caricamento delle stagioni');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = () => {
        setFormData(initialFormState);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setFormData(initialFormState);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleCreateSeason = async (e) => {
        e.preventDefault();

        if (!formData.name) {
            toast.error('Il nome della stagione è obbligatorio');
            return;
        }

        setSubmitting(true);

        try {
            await apiService.createSeason({
                name: formData.name,
                isCurrent: formData.isCurrent
            });

            toast.success('Stagione creata con successo');
            handleCloseModal();
            loadSeasons();
        } catch (error) {
            console.error('Errore nella creazione della stagione:', error);
            toast.error(error.response?.data?.error || 'Errore nella creazione della stagione');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSetCurrent = async (season) => {
        try {
            await apiService.setCurrentSeason(season.id);
            toast.success('Stagione corrente aggiornata con successo');
            loadSeasons();
        } catch (error) {
            console.error('Errore nell\'impostazione della stagione corrente:', error);
            toast.error(error.response?.data?.error || 'Errore nell\'impostazione della stagione corrente');
        }
    };

    const canManageSeasons = user.role === 'admin' || user.role === 'coach';

    if (loading && seasons.length === 0) {
        return <TableSkeleton rows={10} />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestione Stagioni</h1>
                    <p className="text-gray-600 mt-1">Gestisci gli anni sportivi</p>
                </div>

                <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                    {canManageSeasons && (
                        <button
                            onClick={handleOpenModal}
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nuova Stagione
                        </button>
                    )}
                </div>
            </div>

            {/* Seasons List */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <LoadingSpinner size="medium" text="Caricamento stagioni..." />
                    </div>
                ) : seasons.length === 0 ? (
                    <div className="text-center py-12">
                        <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna stagione trovata</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Inizia creando la prima stagione
                        </p>
                        {canManageSeasons && (
                            <div className="mt-6">
                                <button
                                    onClick={handleOpenModal}
                                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nuova Stagione
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Nome
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Stato
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Azioni
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {seasons.map((season) => (
                                    <tr key={season.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{season.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {season.is_current ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                    Corrente
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {!season.is_current && canManageSeasons && (
                                                <button
                                                    onClick={() => handleSetCurrent(season)}
                                                    className="text-blue-600 hover:text-blue-900"
                                                >
                                                    Imposta come corrente
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="lg:hidden space-y-4 p-4">
                            {seasons.map((season) => (
                                <div key={season.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-900">{season.name}</h3>
                                        </div>
                                        {season.is_current && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                Corrente
                                            </span>
                                        )}
                                    </div>

                                    {!season.is_current && canManageSeasons && (
                                        <div className="mt-3">
                                            <button
                                                onClick={() => handleSetCurrent(season)}
                                                className="text-sm text-blue-600 hover:text-blue-900"
                                            >
                                                Imposta come corrente
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* New Season Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleCloseModal} />

                        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">Nuova Stagione</h2>
                                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateSeason} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleFormChange}
                                        placeholder="es. 2026/27"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="isCurrent"
                                        name="isCurrent"
                                        checked={formData.isCurrent}
                                        onChange={handleFormChange}
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor="isCurrent" className="ml-2 block text-sm text-gray-700">
                                        Imposta come stagione corrente
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <LoadingSpinner size="small" text="Creazione..." />
                                    ) : (
                                        'Crea Stagione'
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Seasons;
