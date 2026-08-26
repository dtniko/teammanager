import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Users as UsersIcon,
    Plus,
    Settings,
    Trash2,
    X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner, { TableSkeleton } from '../Common/LoadingSpinner';
import { toast } from 'react-toastify';

const initialFormState = {
    name: '',
    description: '',
    ageGroup: ''
};

const Groups = () => {
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            setLoading(true);
            const response = await apiService.getGroups();
            setGroups(response.groups || []);
        } catch (error) {
            console.error('Errore nel caricamento dei gruppi:', error);
            toast.error('Errore nel caricamento dei gruppi');
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
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();

        if (!formData.name) {
            toast.error('Il nome del gruppo è obbligatorio');
            return;
        }

        setSubmitting(true);

        try {
            await apiService.createGroup({
                name: formData.name,
                description: formData.description || undefined,
                ageGroup: formData.ageGroup || undefined
            });

            toast.success('Gruppo creato con successo');
            handleCloseModal();
            loadGroups();
        } catch (error) {
            console.error('Errore nella creazione del gruppo:', error);
            toast.error(error.response?.data?.error || 'Errore nella creazione del gruppo');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteGroup = async (group) => {
        if (!window.confirm(`Eliminare il gruppo ${group.name}?`)) {
            return;
        }

        try {
            await apiService.deleteGroup(group.id);
            toast.success('Gruppo eliminato con successo');
            loadGroups();
        } catch (error) {
            console.error('Errore nell\'eliminazione del gruppo:', error);
            toast.error(error.response?.data?.error || 'Errore nell\'eliminazione del gruppo');
        }
    };

    const canCreateGroup = user.role === 'admin';
    const canDeleteGroup = user.role === 'admin';

    if (loading && groups.length === 0) {
        return <TableSkeleton rows={10} />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestione Gruppi</h1>
                    <p className="text-gray-600 mt-1">Gestisci i gruppi, gli atleti e lo staff assegnato</p>
                </div>

                <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                    {canCreateGroup && (
                        <button
                            onClick={handleOpenModal}
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nuovo Gruppo
                        </button>
                    )}
                </div>
            </div>

            {/* Groups List */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <LoadingSpinner size="medium" text="Caricamento gruppi..." />
                    </div>
                ) : groups.length === 0 ? (
                    <div className="text-center py-12">
                        <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun gruppo trovato</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Inizia creando il primo gruppo
                        </p>
                        {canCreateGroup && (
                            <div className="mt-6">
                                <button
                                    onClick={handleOpenModal}
                                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nuovo Gruppo
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
                                        Fascia Età
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Stagione
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Atleti
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Staff
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Azioni
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {groups.map((group) => (
                                    <tr key={group.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{group.name}</div>
                                            {group.description && (
                                                <div className="text-sm text-gray-500">{group.description}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {group.age_group || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {group.season_name || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {group.athletes_count ?? 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {group.staff_count ?? 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-3">
                                                <Link
                                                    to={`/groups/${group.id}`}
                                                    className="text-blue-600 hover:text-blue-900"
                                                    title="Gestisci"
                                                >
                                                    <Settings className="h-4 w-4" />
                                                </Link>
                                                {canDeleteGroup && (
                                                    <button
                                                        onClick={() => handleDeleteGroup(group)}
                                                        className="text-red-600 hover:text-red-900"
                                                        title="Elimina"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="lg:hidden space-y-4 p-4">
                            {groups.map((group) => (
                                <div key={group.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-900">{group.name}</h3>
                                            {group.description && (
                                                <p className="text-xs text-gray-500 mt-1">{group.description}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Link
                                                to={`/groups/${group.id}`}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                <Settings className="h-5 w-5" />
                                            </Link>
                                            {canDeleteGroup && (
                                                <button
                                                    onClick={() => handleDeleteGroup(group)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                        <span>{group.age_group || 'Nessuna fascia età'}</span>
                                        <span>{group.season_name || '-'}</span>
                                    </div>

                                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                                        <span>{group.athletes_count ?? 0} atleti</span>
                                        <span>{group.staff_count ?? 0} staff</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* New Group Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleCloseModal} />

                        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">Nuovo Gruppo</h2>
                                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateGroup} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleFormChange}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fascia Età</label>
                                    <input
                                        type="text"
                                        name="ageGroup"
                                        value={formData.ageGroup}
                                        onChange={handleFormChange}
                                        placeholder="es. Under 15"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <LoadingSpinner size="small" text="Creazione..." />
                                    ) : (
                                        'Crea Gruppo'
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

export default Groups;
