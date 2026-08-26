import React, { useState, useEffect } from 'react';
import {
    UserCircle,
    Plus,
    UserCheck,
    UserX,
    Trash2,
    Copy,
    X
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner, { TableSkeleton } from '../Common/LoadingSpinner';

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

const getRoleBadgeColor = (role) => {
    const colors = {
        admin: 'bg-red-100 text-red-800',
        coach: 'bg-blue-100 text-blue-800',
        parent: 'bg-green-100 text-green-800',
        athlete: 'bg-purple-100 text-purple-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
};

const initialFormState = {
    email: '',
    firstName: '',
    lastName: '',
    role: 'parent',
    phone: ''
};

const Users = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [submitting, setSubmitting] = useState(false);
    const [createdUserInfo, setCreatedUserInfo] = useState(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const response = await apiService.getUsers();
            setUsers(response.users || []);
        } catch (error) {
            console.error('Errore nel caricamento degli utenti:', error);
            toast.error('Errore nel caricamento degli utenti');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = () => {
        setFormData(initialFormState);
        setCreatedUserInfo(null);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setCreatedUserInfo(null);
        setFormData(initialFormState);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();

        if (!formData.email || !formData.firstName || !formData.lastName || !formData.role) {
            toast.error('Email, nome, cognome e ruolo sono obbligatori');
            return;
        }

        setSubmitting(true);

        try {
            const response = await apiService.createUser({
                email: formData.email,
                firstName: formData.firstName,
                lastName: formData.lastName,
                role: formData.role,
                phone: formData.phone || undefined
            });

            if (response.success) {
                if (response.emailSent === false) {
                    setCreatedUserInfo({
                        email: response.user?.email || formData.email,
                        temporaryPassword: response.temporaryPassword
                    });
                } else {
                    toast.success('Utente creato, email inviata');
                    handleCloseModal();
                }

                loadUsers();
            } else {
                throw new Error(response.error || 'Errore nella creazione dell\'utente');
            }
        } catch (error) {
            console.error('Errore nella creazione dell\'utente:', error);
            toast.error(error.error || error.message || 'Errore nella creazione dell\'utente');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopyPassword = async () => {
        if (!createdUserInfo?.temporaryPassword) return;

        try {
            await navigator.clipboard.writeText(createdUserInfo.temporaryPassword);
            toast.success('Password copiata negli appunti');
        } catch (error) {
            console.error('Errore nella copia della password:', error);
            toast.error('Impossibile copiare la password');
        }
    };

    const handleRoleChange = async (userId, role) => {
        try {
            const response = await apiService.updateUserRole(userId, role);

            if (response.success) {
                toast.success('Ruolo aggiornato con successo');
                loadUsers();
            } else {
                throw new Error(response.error || 'Errore nell\'aggiornamento del ruolo');
            }
        } catch (error) {
            console.error('Errore nell\'aggiornamento del ruolo:', error);
            toast.error(error.error || error.message || 'Errore nell\'aggiornamento del ruolo');
        }
    };

    const handleToggleStatus = async (targetUser) => {
        try {
            const response = await apiService.updateUserStatus(targetUser.id, !targetUser.is_active);

            if (response.success) {
                toast.success(`Utente ${!targetUser.is_active ? 'attivato' : 'disattivato'} con successo`);
                loadUsers();
            } else {
                throw new Error(response.error || 'Errore nel cambio di stato');
            }
        } catch (error) {
            console.error('Errore nel cambio di stato dell\'utente:', error);
            toast.error(error.error || error.message || 'Errore nel cambio di stato');
        }
    };

    const handleDeleteUser = async (targetUser) => {
        if (!window.confirm(`Eliminare l'utente ${targetUser.first_name} ${targetUser.last_name}?`)) {
            return;
        }

        try {
            const response = await apiService.deleteUser(targetUser.id);

            if (response.success) {
                toast.success('Utente eliminato con successo');
                loadUsers();
            } else {
                throw new Error(response.error || 'Errore nell\'eliminazione dell\'utente');
            }
        } catch (error) {
            console.error('Errore nell\'eliminazione dell\'utente:', error);
            toast.error(error.error || error.message || 'Errore nell\'eliminazione dell\'utente');
        }
    };

    if (user.role !== 'admin') {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Non hai i permessi per accedere a questa pagina.</p>
            </div>
        );
    }

    if (loading && users.length === 0) {
        return <TableSkeleton rows={10} />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestione Utenti</h1>
                    <p className="text-gray-600 mt-1">Crea e gestisci gli account degli utenti della piattaforma</p>
                </div>

                <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                    <button
                        onClick={handleOpenModal}
                        className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Nuovo Utente
                    </button>
                </div>
            </div>

            {/* Users List */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                {users.length === 0 ? (
                    <div className="text-center py-12">
                        <UserCircle className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun utente trovato</h3>
                    </div>
                ) : (
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruolo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {u.first_name} {u.last_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {u.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                            disabled={u.id === user.id}
                                            className={`text-xs font-medium rounded-full px-2.5 py-0.5 border-0 ${getRoleBadgeColor(u.role)} disabled:opacity-50`}
                                        >
                                            {ROLES.map(role => (
                                                <option key={role} value={role}>{getRoleLabel(role)}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {u.is_active ? (
                          <>
                              <UserCheck className="h-3 w-3 mr-1" />
                              Attivo
                          </>
                      ) : (
                          <>
                              <UserX className="h-3 w-3 mr-1" />
                              Inattivo
                          </>
                      )}
                    </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-3">
                                            <button
                                                onClick={() => handleToggleStatus(u)}
                                                disabled={u.id === user.id}
                                                className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                                                title={u.is_active ? 'Disattiva' : 'Attiva'}
                                            >
                                                {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(u)}
                                                disabled={u.id === user.id}
                                                className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                                title="Elimina"
                                            >
                                                <Trash2 className="h-4 w-4" />
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
                    {users.map((u) => (
                        <div key={u.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900">{u.first_name} {u.last_name}</h3>
                                    <p className="text-xs text-gray-500">{u.email}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handleToggleStatus(u)}
                                        disabled={u.id === user.id}
                                        className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                                    >
                                        {u.is_active ? <UserX className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUser(u)}
                                        disabled={u.id === user.id}
                                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                                <select
                                    value={u.role}
                                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                    disabled={u.id === user.id}
                                    className={`text-xs font-medium rounded-full px-2.5 py-0.5 border-0 ${getRoleBadgeColor(u.role)} disabled:opacity-50`}
                                >
                                    {ROLES.map(role => (
                                        <option key={role} value={role}>{getRoleLabel(role)}</option>
                                    ))}
                                </select>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                    {u.is_active ? 'Attivo' : 'Inattivo'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* New User Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleCloseModal} />

                        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">Nuovo Utente</h2>
                                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {createdUserInfo ? (
                                <div className="space-y-4">
                                    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                                        <p className="text-sm font-medium text-yellow-800 mb-2">
                                            Email non inviata (SMTP non configurato) — comunica questa password temporanea all'utente:
                                        </p>
                                        <div className="flex items-center justify-between bg-white border border-yellow-200 rounded px-3 py-2">
                                            <code className="text-sm font-mono text-gray-900">
                                                {createdUserInfo.temporaryPassword}
                                            </code>
                                            <button
                                                onClick={handleCopyPassword}
                                                className="flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 ml-3"
                                            >
                                                <Copy className="h-3 w-3 mr-1" />
                                                Copia
                                            </button>
                                        </div>
                                        <p className="text-xs text-yellow-700 mt-2">
                                            Utente: {createdUserInfo.email}
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleCloseModal}
                                        className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                    >
                                        Chiudi
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleCreateUser} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleFormChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                                            <input
                                                type="text"
                                                name="firstName"
                                                value={formData.firstName}
                                                onChange={handleFormChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                                            <input
                                                type="text"
                                                name="lastName"
                                                value={formData.lastName}
                                                onChange={handleFormChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
                                        <select
                                            name="role"
                                            value={formData.role}
                                            onChange={handleFormChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            {ROLES.map(role => (
                                                <option key={role} value={role}>{getRoleLabel(role)}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefono (opzionale)</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleFormChange}
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
                                            'Crea Utente'
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
