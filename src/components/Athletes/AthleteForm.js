import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner, { CardSkeleton } from '../Common/LoadingSpinner';
import { toast } from 'react-toastify';

const emptyForm = {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    fiscalCode: '',
    placeOfBirth: '',
    address: '',
    phone: '',
    email: '',
    emergencyContactName: '',
    emergencyContactPhone: ''
};

const AthleteForm = () => {
    const { athleteId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEditMode = Boolean(athleteId);

    const [formData, setFormData] = useState(emptyForm);
    const [groups, setGroups] = useState([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);
    const [loading, setLoading] = useState(isEditMode);
    const [saving, setSaving] = useState(false);

    const canManage = user.role === 'admin' || user.role === 'coach';

    useEffect(() => {
        if (!canManage) {
            toast.error('Non hai i permessi per accedere a questa pagina');
            navigate('/athletes');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!isEditMode) {
            loadGroups();
        }
        if (isEditMode) {
            loadAthlete();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [athleteId]);

    const loadGroups = async () => {
        try {
            const response = await apiService.getGroups();
            setGroups(response.groups || []);
        } catch (error) {
            console.error('Errore nel caricamento dei gruppi:', error);
        }
    };

    const loadAthlete = async () => {
        try {
            setLoading(true);
            const response = await apiService.getAthleteById(athleteId);
            const athlete = response.athlete;
            setFormData({
                firstName: athlete.first_name || '',
                lastName: athlete.last_name || '',
                dateOfBirth: athlete.date_of_birth ? athlete.date_of_birth.substring(0, 10) : '',
                fiscalCode: athlete.fiscal_code || '',
                placeOfBirth: athlete.place_of_birth || '',
                address: athlete.address || '',
                phone: athlete.phone || '',
                email: athlete.email || '',
                emergencyContactName: athlete.emergency_contact_name || '',
                emergencyContactPhone: athlete.emergency_contact_phone || ''
            });
        } catch (error) {
            console.error('Errore nel caricamento dell\'atleta:', error);
            toast.error('Errore nel caricamento dei dati dell\'atleta');
            navigate('/athletes');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGroupToggle = (groupId) => {
        setSelectedGroupIds(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setSaving(true);

            if (isEditMode) {
                await apiService.updateAthlete(athleteId, formData);
                toast.success('Atleta aggiornato con successo');
                navigate(`/athletes/${athleteId}`);
            } else {
                const payload = {
                    ...formData,
                    groupIds: selectedGroupIds
                };
                const response = await apiService.createAthlete(payload);
                toast.success('Atleta creato con successo');
                navigate(`/athletes/${response.athlete.id}`);
            }
        } catch (error) {
            console.error('Errore nel salvataggio dell\'atleta:', error);
            toast.error(error.response?.data?.error || 'Errore nel salvataggio dell\'atleta');
        } finally {
            setSaving(false);
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => navigate(isEditMode ? `/athletes/${athleteId}` : '/athletes')}
                    className="flex items-center text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft className="h-5 w-5 mr-1" />
                    {isEditMode ? 'Torna al dettaglio' : 'Torna agli atleti'}
                </button>
                <h1 className="text-2xl font-bold text-gray-900">
                    {isEditMode ? 'Modifica Atleta' : 'Nuovo Atleta'}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Info */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Informazioni Personali</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cognome *</label>
                            <input
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data di Nascita *</label>
                            <input
                                type="date"
                                name="dateOfBirth"
                                value={formData.dateOfBirth}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
                            <input
                                type="text"
                                name="fiscalCode"
                                value={formData.fiscalCode}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Luogo di Nascita</label>
                            <input
                                type="text"
                                name="placeOfBirth"
                                value={formData.placeOfBirth}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Contatti</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Emergency Contact */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Contatto di Emergenza</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                            <input
                                type="text"
                                name="emergencyContactName"
                                value={formData.emergencyContactName}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                            <input
                                type="tel"
                                name="emergencyContactPhone"
                                value={formData.emergencyContactPhone}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Groups (create mode only) */}
                {!isEditMode && groups.length > 0 && (
                    <div className="bg-white shadow rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Gruppi</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {groups.map(group => (
                                <label key={group.id} className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedGroupIds.includes(group.id)}
                                        onChange={() => handleGroupToggle(group.id)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">{group.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end space-x-3">
                    <Link
                        to={isEditMode ? `/athletes/${athleteId}` : '/athletes'}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Annulla
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? (
                            <LoadingSpinner size="small" color="white" className="mr-2" />
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Salva
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AthleteForm;
