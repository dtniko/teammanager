import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Link2, UserPlus, Clock, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner from '../Common/LoadingSpinner';

const RELATIONSHIP_LABELS = {
    parent: 'Genitore',
    guardian: 'Tutore',
    tutor: 'Tutore legale'
};

const emptyAthleteForm = {
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

const LinkProfile = () => {
    const { user, onboardingStatus, refreshOnboardingStatus, logout } = useAuth();
    const context = user?.role === 'parent' ? 'parent' : 'athlete';
    const state = onboardingStatus?.state;

    const [refreshing, setRefreshing] = useState(false);

    // Collega profilo esistente
    const [search, setSearch] = useState('');
    const [availableAthletes, setAvailableAthletes] = useState([]);
    const [loadingAthletes, setLoadingAthletes] = useState(false);
    const [selectedAthleteId, setSelectedAthleteId] = useState('');
    const [relationship, setRelationship] = useState('parent');
    const [linking, setLinking] = useState(false);

    // Crea nuovo profilo
    const [athleteForm, setAthleteForm] = useState(emptyAthleteForm);
    const [creating, setCreating] = useState(false);

    const loadAvailableAthletes = useCallback(async () => {
        try {
            setLoadingAthletes(true);
            const response = await apiService.getAvailableAthletes(context, search);
            setAvailableAthletes(response.athletes || []);
        } catch (error) {
            console.error('Errore nel caricamento degli atleti disponibili:', error);
            toast.error('Errore nel caricamento degli atleti disponibili');
        } finally {
            setLoadingAthletes(false);
        }
    }, [context, search]);

    useEffect(() => {
        if (state === 'select') {
            loadAvailableAthletes();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await refreshOnboardingStatus();
        setRefreshing(false);
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadAvailableAthletes();
    };

    const handleLinkExisting = async (e) => {
        e.preventDefault();

        if (!selectedAthleteId) {
            toast.error('Seleziona un atleta dalla lista');
            return;
        }

        if (context === 'parent' && !relationship) {
            toast.error('Seleziona la relazione con l\'atleta');
            return;
        }

        try {
            setLinking(true);
            await apiService.linkExistingProfile(
                Number(selectedAthleteId),
                context,
                context === 'parent' ? relationship : undefined
            );
            toast.success('Richiesta di collegamento inviata, in attesa di conferma');
            await refreshOnboardingStatus();
        } catch (error) {
            console.error('Errore nell\'invio della richiesta di collegamento:', error);
            toast.error(error.error || error.message || 'Errore nell\'invio della richiesta');
        } finally {
            setLinking(false);
        }
    };

    const handleAthleteFormChange = (field) => (e) => {
        setAthleteForm(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleCreateProfile = async (e) => {
        e.preventDefault();

        if (!athleteForm.firstName || !athleteForm.lastName || !athleteForm.dateOfBirth) {
            toast.error('Nome, cognome e data di nascita sono obbligatori');
            return;
        }

        if (context === 'parent' && !relationship) {
            toast.error('Seleziona la relazione con l\'atleta');
            return;
        }

        try {
            setCreating(true);
            await apiService.createOnboardingProfile(
                context,
                context === 'parent' ? relationship : undefined,
                athleteForm
            );
            toast.success('Profilo creato e collegato con successo');
            await refreshOnboardingStatus();
        } catch (error) {
            console.error('Errore nella creazione del profilo:', error);
            toast.error(error.error || error.message || 'Errore nella creazione del profilo');
        } finally {
            setCreating(false);
        }
    };

    if (!state) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="large" />
            </div>
        );
    }

    if (state === 'pending') {
        const athleteName = onboardingStatus?.request
            ? `${onboardingStatus.request.first_name} ${onboardingStatus.request.last_name}`
            : 'selezionato';

        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4">
                <div className="w-full max-w-md">
                    <div className="bg-white shadow rounded-lg p-8 text-center">
                        <div className="flex items-center justify-center mb-6">
                            <div className="w-14 h-14 bg-yellow-500 rounded-xl flex items-center justify-center">
                                <Clock className="h-7 w-7 text-white" />
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Richiesta in attesa di conferma
                        </h2>
                        <p className="text-gray-600 mb-6">
                            La tua richiesta di collegamento al profilo <strong>{athleteName}</strong> è
                            in attesa di conferma da parte di un amministratore o dirigente.
                        </p>

                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                        >
                            {refreshing ? (
                                <LoadingSpinner size="small" text="Aggiornamento..." />
                            ) : (
                                'Aggiorna stato'
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={logout}
                            className="mt-3 w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Esci
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // state === 'select'
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-3xl space-y-6">
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={logout}
                        className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        Esci
                    </button>
                </div>

                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Collega il tuo account a un profilo atleta
                    </h2>
                    <p className="text-gray-600">
                        {context === 'parent'
                            ? 'Collega il tuo account al profilo di tuo figlio/a per continuare.'
                            : 'Collega il tuo account al tuo profilo atleta per continuare.'}
                    </p>
                </div>

                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center mb-4">
                        <Link2 className="h-5 w-5 text-blue-600 mr-2" />
                        <h3 className="text-lg font-semibold text-gray-900">
                            Collega un profilo esistente
                        </h3>
                    </div>

                    <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cerca per nome o cognome"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cerca
                        </button>
                    </form>

                    <form onSubmit={handleLinkExisting} className="space-y-4">
                        <div>
                            <label htmlFor="athleteSelect" className="block text-sm font-medium text-gray-700 mb-1">
                                Atleta
                            </label>
                            <select
                                id="athleteSelect"
                                value={selectedAthleteId}
                                onChange={(e) => setSelectedAthleteId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">
                                    {loadingAthletes ? 'Caricamento...' : 'Seleziona un atleta'}
                                </option>
                                {availableAthletes.map((athlete) => (
                                    <option key={athlete.id} value={athlete.id}>
                                        {athlete.last_name} {athlete.first_name}
                                        {athlete.date_of_birth ? ` (${athlete.date_of_birth.substring(0, 10)})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {context === 'parent' && (
                            <div>
                                <label htmlFor="relationship" className="block text-sm font-medium text-gray-700 mb-1">
                                    Relazione con l'atleta
                                </label>
                                <select
                                    id="relationship"
                                    value={relationship}
                                    onChange={(e) => setRelationship(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={linking}
                            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                        >
                            {linking ? (
                                <LoadingSpinner size="small" text="Invio in corso..." />
                            ) : (
                                'Invia richiesta'
                            )}
                        </button>
                    </form>
                </div>

                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center mb-4">
                        <UserPlus className="h-5 w-5 text-blue-600 mr-2" />
                        <h3 className="text-lg font-semibold text-gray-900">
                            Crea nuovo profilo atleta
                        </h3>
                    </div>

                    <form onSubmit={handleCreateProfile} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                                    Nome *
                                </label>
                                <input
                                    id="firstName"
                                    type="text"
                                    value={athleteForm.firstName}
                                    onChange={handleAthleteFormChange('firstName')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                                    Cognome *
                                </label>
                                <input
                                    id="lastName"
                                    type="text"
                                    value={athleteForm.lastName}
                                    onChange={handleAthleteFormChange('lastName')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                                    Data di nascita *
                                </label>
                                <input
                                    id="dateOfBirth"
                                    type="date"
                                    value={athleteForm.dateOfBirth}
                                    onChange={handleAthleteFormChange('dateOfBirth')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label htmlFor="fiscalCode" className="block text-sm font-medium text-gray-700 mb-1">
                                    Codice fiscale
                                </label>
                                <input
                                    id="fiscalCode"
                                    type="text"
                                    value={athleteForm.fiscalCode}
                                    onChange={handleAthleteFormChange('fiscalCode')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label htmlFor="placeOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                                    Luogo di nascita
                                </label>
                                <input
                                    id="placeOfBirth"
                                    type="text"
                                    value={athleteForm.placeOfBirth}
                                    onChange={handleAthleteFormChange('placeOfBirth')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                                    Indirizzo
                                </label>
                                <input
                                    id="address"
                                    type="text"
                                    value={athleteForm.address}
                                    onChange={handleAthleteFormChange('address')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                                    Telefono
                                </label>
                                <input
                                    id="phone"
                                    type="text"
                                    value={athleteForm.phone}
                                    onChange={handleAthleteFormChange('phone')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={athleteForm.email}
                                    onChange={handleAthleteFormChange('email')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label htmlFor="emergencyContactName" className="block text-sm font-medium text-gray-700 mb-1">
                                    Contatto di emergenza
                                </label>
                                <input
                                    id="emergencyContactName"
                                    type="text"
                                    value={athleteForm.emergencyContactName}
                                    onChange={handleAthleteFormChange('emergencyContactName')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label htmlFor="emergencyContactPhone" className="block text-sm font-medium text-gray-700 mb-1">
                                    Telefono di emergenza
                                </label>
                                <input
                                    id="emergencyContactPhone"
                                    type="text"
                                    value={athleteForm.emergencyContactPhone}
                                    onChange={handleAthleteFormChange('emergencyContactPhone')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {context === 'parent' && (
                            <div>
                                <label htmlFor="relationshipCreate" className="block text-sm font-medium text-gray-700 mb-1">
                                    Relazione con l'atleta
                                </label>
                                <select
                                    id="relationshipCreate"
                                    value={relationship}
                                    onChange={(e) => setRelationship(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={creating}
                            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                        >
                            {creating ? (
                                <LoadingSpinner size="small" text="Creazione in corso..." />
                            ) : (
                                'Crea profilo'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LinkProfile;
