import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft,
    Edit,
    Users as UsersIcon,
    UserCircle,
    Plus,
    Trash2,
    X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner, { CardSkeleton } from '../Common/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const ROLES = ['admin', 'coach', 'parent', 'athlete'];

const getRoleLabel = (role) => {
    const labels = {
        admin: 'Amministratore',
        coach: 'Dirigente/Allenatore',
        parent: 'Genitore',
        athlete: 'Atleta'
    };
    return labels[role] || role;
};

const GroupDetail = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);

    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState({ name: '', description: '', ageGroup: '' });
    const [submittingEdit, setSubmittingEdit] = useState(false);

    const [availableAthletes, setAvailableAthletes] = useState([]);
    const [selectedAthleteId, setSelectedAthleteId] = useState('');
    const [addingAthlete, setAddingAthlete] = useState(false);

    const [availableStaff, setAvailableStaff] = useState([]);
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [selectedStaffRole, setSelectedStaffRole] = useState('coach');
    const [addingStaff, setAddingStaff] = useState(false);

    const loadGroup = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiService.getGroupById(groupId);
            setGroup(response.group);
        } catch (error) {
            console.error('Errore nel caricamento del gruppo:', error);
            toast.error('Errore nel caricamento dei dati del gruppo');
            navigate('/groups');
        } finally {
            setLoading(false);
        }
    }, [groupId, navigate]);

    useEffect(() => {
        loadGroup();
    }, [groupId, loadGroup]);

    const loadAvailableAthletes = useCallback(async () => {
        try {
            const response = await apiService.getAthletes({ limit: 1000 });
            const currentAthleteIds = (group?.athletes || []).map(a => a.id);
            const filtered = (response.athletes || []).filter(a => !currentAthleteIds.includes(a.id));
            setAvailableAthletes(filtered);
        } catch (error) {
            console.error('Errore nel caricamento degli atleti disponibili:', error);
        }
    }, [group]);

    const loadAvailableStaff = useCallback(async () => {
        try {
            const response = await apiService.getUsers({ limit: 1000 });
            const currentStaffIds = (group?.staff || []).map(s => s.id);
            const filtered = (response.users || []).filter(u =>
                (u.role === 'admin' || u.role === 'coach') && !currentStaffIds.includes(u.id)
            );
            setAvailableStaff(filtered);
        } catch (error) {
            console.error('Errore nel caricamento dello staff disponibile:', error);
        }
    }, [group]);

    useEffect(() => {
        if (group) {
            loadAvailableAthletes();
            loadAvailableStaff();
        }
    }, [group, loadAvailableAthletes, loadAvailableStaff]);

    const canEditGroup = user.role === 'admin';
    const canManageAthletes = () => {
        if (user.role === 'admin') return true;
        if (user.role === 'coach') {
            const staffEntry = (group?.staff || []).find(s => s.id === user.id);
            return !!staffEntry?.can_manage;
        }
        return false;
    };
    const canManageStaff = user.role === 'admin';

    const handleOpenEditModal = () => {
        setEditFormData({
            name: group.name || '',
            description: group.description || '',
            ageGroup: group.age_group || ''
        });
        setShowEditModal(true);
    };

    const handleCloseEditModal = () => {
        setShowEditModal(false);
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateGroup = async (e) => {
        e.preventDefault();

        if (!editFormData.name) {
            toast.error('Il nome del gruppo è obbligatorio');
            return;
        }

        setSubmittingEdit(true);

        try {
            await apiService.updateGroup(groupId, {
                name: editFormData.name,
                description: editFormData.description || undefined,
                ageGroup: editFormData.ageGroup || undefined
            });

            toast.success('Gruppo aggiornato con successo');
            setShowEditModal(false);
            loadGroup();
        } catch (error) {
            console.error('Errore nell\'aggiornamento del gruppo:', error);
            toast.error(error.response?.data?.error || 'Errore nell\'aggiornamento del gruppo');
        } finally {
            setSubmittingEdit(false);
        }
    };

    const handleAddAthlete = async (e) => {
        e.preventDefault();
        if (!selectedAthleteId) return;

        setAddingAthlete(true);

        try {
            await apiService.addAthleteToGroup(groupId, selectedAthleteId);
            toast.success('Atleta aggiunto al gruppo');
            setSelectedAthleteId('');
            loadGroup();
        } catch (error) {
            console.error('Errore nell\'aggiunta dell\'atleta:', error);
            toast.error(error.response?.data?.error || 'Errore nell\'aggiunta dell\'atleta');
        } finally {
            setAddingAthlete(false);
        }
    };

    const handleRemoveAthlete = async (athlete) => {
        if (!window.confirm(`Rimuovere ${athlete.first_name} ${athlete.last_name} dal gruppo?`)) {
            return;
        }

        try {
            await apiService.removeAthleteFromGroup(groupId, athlete.id);
            toast.success('Atleta rimosso dal gruppo');
            loadGroup();
        } catch (error) {
            console.error('Errore nella rimozione dell\'atleta:', error);
            toast.error(error.response?.data?.error || 'Errore nella rimozione dell\'atleta');
        }
    };

    const handleAddStaff = async (e) => {
        e.preventDefault();
        if (!selectedStaffId) return;

        setAddingStaff(true);

        try {
            await apiService.addStaffToGroup(groupId, selectedStaffId, selectedStaffRole, true);
            toast.success('Staff aggiunto al gruppo');
            setSelectedStaffId('');
            loadGroup();
        } catch (error) {
            console.error('Errore nell\'aggiunta dello staff:', error);
            toast.error(error.response?.data?.error || 'Errore nell\'aggiunta dello staff');
        } finally {
            setAddingStaff(false);
        }
    };

    const handleRemoveStaff = async (staffMember) => {
        if (!window.confirm(`Rimuovere ${staffMember.first_name} ${staffMember.last_name} dallo staff del gruppo?`)) {
            return;
        }

        try {
            await apiService.removeStaffFromGroup(groupId, staffMember.id);
            toast.success('Staff rimosso dal gruppo');
            loadGroup();
        } catch (error) {
            console.error('Errore nella rimozione dello staff:', error);
            toast.error(error.response?.data?.error || 'Errore nella rimozione dello staff');
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <CardSkeleton className="h-8 w-64" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            </div>
        );
    }

    if (!group) {
        return (
            <div className="text-center py-12">
                <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Gruppo non trovato</h3>
                <p className="mt-1 text-sm text-gray-500">
                    Il gruppo richiesto non esiste o non hai i permessi per visualizzarlo
                </p>
                <div className="mt-6">
                    <Link
                        to="/groups"
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Torna ai gruppi
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/groups')}
                        className="flex items-center text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="h-5 w-5 mr-1" />
                        Torna ai gruppi
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
                        {group.description && (
                            <p className="text-gray-600">{group.description}</p>
                        )}
                    </div>
                </div>

                {canEditGroup && (
                    <button
                        onClick={handleOpenEditModal}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                        <Edit className="h-4 w-4 mr-2" />
                        Modifica
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Athletes Section */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Atleti nel gruppo</h3>

                    {canManageAthletes() && (
                        <form onSubmit={handleAddAthlete} className="flex items-center space-x-2 mb-4">
                            <select
                                value={selectedAthleteId}
                                onChange={(e) => setSelectedAthleteId(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Seleziona un atleta...</option>
                                {availableAthletes.map(athlete => (
                                    <option key={athlete.id} value={athlete.id}>
                                        {athlete.first_name} {athlete.last_name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                disabled={!selectedAthleteId || addingAthlete}
                                className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </form>
                    )}

                    {group.athletes && group.athletes.length > 0 ? (
                        <div className="space-y-3">
                            {group.athletes.map((athlete) => (
                                <div key={athlete.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {athlete.first_name} {athlete.last_name}
                                        </p>
                                        {athlete.date_of_birth && (
                                            <p className="text-xs text-gray-500">
                                                Nato il {format(new Date(athlete.date_of_birth), 'dd/MM/yyyy')}
                                            </p>
                                        )}
                                        {athlete.joined_date && (
                                            <p className="text-xs text-gray-400">
                                                Iscritto il {format(new Date(athlete.joined_date), 'dd/MM/yyyy')}
                                            </p>
                                        )}
                                    </div>
                                    {canManageAthletes() && (
                                        <button
                                            onClick={() => handleRemoveAthlete(athlete)}
                                            className="text-red-600 hover:text-red-700"
                                            title="Rimuovi dal gruppo"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <UsersIcon className="mx-auto h-10 w-10 text-gray-400" />
                            <p className="mt-2 text-sm text-gray-500">Nessun atleta assegnato a questo gruppo</p>
                        </div>
                    )}
                </div>

                {/* Staff Section */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Staff del gruppo</h3>

                    {canManageStaff && (
                        <form onSubmit={handleAddStaff} className="flex items-center space-x-2 mb-4">
                            <select
                                value={selectedStaffId}
                                onChange={(e) => setSelectedStaffId(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Seleziona un membro dello staff...</option>
                                {availableStaff.map(staffUser => (
                                    <option key={staffUser.id} value={staffUser.id}>
                                        {staffUser.first_name} {staffUser.last_name} ({getRoleLabel(staffUser.role)})
                                    </option>
                                ))}
                            </select>
                            <select
                                value={selectedStaffRole}
                                onChange={(e) => setSelectedStaffRole(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {ROLES.filter(r => r === 'admin' || r === 'coach').map(role => (
                                    <option key={role} value={role}>{getRoleLabel(role)}</option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                disabled={!selectedStaffId || addingStaff}
                                className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </form>
                    )}

                    {group.staff && group.staff.length > 0 ? (
                        <div className="space-y-3">
                            {group.staff.map((staffMember) => (
                                <div key={staffMember.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                    <div className="flex items-center space-x-3">
                                        <UserCircle className="h-8 w-8 text-gray-400" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {staffMember.first_name} {staffMember.last_name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {getRoleLabel(staffMember.group_role || staffMember.role)}
                                                {staffMember.can_manage && ' · Può gestire'}
                                            </p>
                                            {staffMember.email && (
                                                <p className="text-xs text-gray-400">{staffMember.email}</p>
                                            )}
                                        </div>
                                    </div>
                                    {canManageStaff && (
                                        <button
                                            onClick={() => handleRemoveStaff(staffMember)}
                                            className="text-red-600 hover:text-red-700"
                                            title="Rimuovi dal gruppo"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <UserCircle className="mx-auto h-10 w-10 text-gray-400" />
                            <p className="mt-2 text-sm text-gray-500">Nessun membro dello staff assegnato</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Group Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleCloseEditModal} />

                        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">Modifica Gruppo</h2>
                                <button onClick={handleCloseEditModal} className="text-gray-400 hover:text-gray-600">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleUpdateGroup} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={editFormData.name}
                                        onChange={handleEditFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                                    <textarea
                                        name="description"
                                        value={editFormData.description}
                                        onChange={handleEditFormChange}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fascia Età</label>
                                    <input
                                        type="text"
                                        name="ageGroup"
                                        value={editFormData.ageGroup}
                                        onChange={handleEditFormChange}
                                        placeholder="es. Under 15"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submittingEdit}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {submittingEdit ? (
                                        <LoadingSpinner size="small" text="Salvataggio..." />
                                    ) : (
                                        'Salva Modifiche'
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

export default GroupDetail;
