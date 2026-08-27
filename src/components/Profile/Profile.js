import React, { useState, useEffect, useCallback } from 'react';
import { User, Mail, Phone, Calendar, FileText, MapPin, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner, { CardSkeleton } from '../Common/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const emptyAthleteForm = {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    fiscalCode: '',
    placeOfBirth: '',
    address: '',
    residenceCity: '',
    phone: '',
    email: '',
    emergencyContactName: '',
    emergencyContactPhone: ''
};

const Profile = () => {
    const { user, isAthlete, isParent } = useAuth();
    const [profile, setProfile] = useState(null);
    const [athleteForm, setAthleteForm] = useState(emptyAthleteForm);
    const [parentAthletes, setParentAthletes] = useState([]);
    const [selectedAthleteId, setSelectedAthleteId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadProfile = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiService.getUserProfile();
            setProfile(response.user);

            if (isAthlete && response.user?.athleteProfile) {
                const ap = response.user.athleteProfile;
                setAthleteForm({
                    firstName: ap.first_name || '',
                    lastName: ap.last_name || '',
                    dateOfBirth: ap.date_of_birth ? ap.date_of_birth.substring(0, 10) : '',
                    fiscalCode: ap.fiscal_code || '',
                    placeOfBirth: ap.place_of_birth || '',
                    address: ap.address || '',
                    residenceCity: ap.residence_city || '',
                    phone: ap.phone || '',
                    email: ap.email || '',
                    emergencyContactName: ap.emergency_contact_name || '',
                    emergencyContactPhone: ap.emergency_contact_phone || ''
                });
            }
        } catch (error) {
            console.error('Errore nel caricamento del profilo:', error);
            toast.error('Errore nel caricamento del profilo');
        } finally {
            setLoading(false);
        }
    }, [isAthlete]);

    const loadMyAthletes = useCallback(async () => {
        try {
            const response = await apiService.getMyAthletes();
            setParentAthletes(response.athletes || []);
        } catch (error) {
            console.error('Errore nel caricamento degli atleti:', error);
        }
    }, []);

    useEffect(() => {
        if (user) {
            loadProfile();
            if (isParent) {
                loadMyAthletes();
            }
        }
    }, [user, loadProfile, isParent, loadMyAthletes]);

    const handleSelectAthlete = (e) => {
        const athleteId = parseInt(e.target.value, 10);
        setSelectedAthleteId(athleteId);

        if (!athleteId) {
            setAthleteForm(emptyAthleteForm);
            return;
        }

        const athlete = parentAthletes.find(a => a.id === athleteId);
        if (athlete) {
            setAthleteForm({
                firstName: athlete.first_name || '',
                lastName: athlete.last_name || '',
                dateOfBirth: athlete.date_of_birth ? athlete.date_of_birth.substring(0, 10) : '',
                fiscalCode: athlete.fiscal_code || '',
                placeOfBirth: athlete.place_of_birth || '',
                address: athlete.address || '',
                residenceCity: athlete.residence_city || '',
                phone: athlete.phone || '',
                email: athlete.email || '',
                emergencyContactName: athlete.emergency_contact_name || '',
                emergencyContactPhone: athlete.emergency_contact_phone || ''
            });
        }
    };

    const handleSaveAthleteProfile = async () => {
        try {
            setSaving(true);

            if (isAthlete) {
                await apiService.updateSelfProfile(athleteForm);
                toast.success('Profilo atleta aggiornato con successo');
            } else if (selectedAthleteId) {
                await apiService.updateParentAthlete(selectedAthleteId, athleteForm);
                toast.success('Profilo atleta aggiornato con successo');
            }

            loadProfile();
            if (isParent) {
                loadMyAthletes();
            }
        } catch (error) {
            console.error('Errore nell\'aggiornamento del profilo atleta:', error);
            toast.error(error.response?.data?.error || 'Errore nell\'aggiornamento del profilo atleta');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setAthleteForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveProfile = async () => {
        try {
            setSaving(true);
            await apiService.updateProfile({
                firstName: profile.firstName,
                lastName: profile.lastName,
                phone: profile.phone
            });
            toast.success('Dati personali aggiornati con successo');
            loadProfile();
        } catch (error) {
            console.error('Errore nell\'aggiornamento del profilo:', error);
            toast.error(error.response?.data?.error || 'Errore nell\'aggiornamento del profilo');
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

    const formatBirthDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
        } catch {
            return dateStr;
        }
    };

    const calculateAge = (birthDate) => {
        if (!birthDate) return '—';
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return `${age} anni`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Profilo Utente</h1>
                <p className="text-sm text-gray-500 mt-1">Gestisci i tuoi dati personali e il profilo atleta</p>
            </div>

            {/* Dati Personali */}
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Dati Personali</h3>
                    <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Salva
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <User className="h-4 w-4 inline mr-1" />
                            Nome
                        </label>
                        <input
                            type="text"
                            name="firstName"
                            value={profile.firstName || ''}
                            onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <User className="h-4 w-4 inline mr-1" />
                            Cognome
                        </label>
                        <input
                            type="text"
                            name="lastName"
                            value={profile.lastName || ''}
                            onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Mail className="h-4 w-4 inline mr-1" />
                            Email
                        </label>
                        <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{profile.email}</p>
                        <p className="text-xs text-gray-500 mt-1">L'email non può essere modificata</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Phone className="h-4 w-4 inline mr-1" />
                            Telefono
                        </label>
                        <input
                            type="tel"
                            name="phone"
                            value={profile.phone || ''}
                            onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Dati Atleta (per atleta o genitore) */}
            {(isAthlete && profile?.athleteProfile) || (isParent && parentAthletes.length > 0) && (
                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                            {isAthlete ? 'Dati Atleta' : 'Dati Atleti'}
                        </h3>
                        <button
                            onClick={handleSaveAthleteProfile}
                            disabled={saving || !selectedAthleteId && isParent}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            Salva Profilo
                        </button>
                    </div>

                    {/* Info di sola lettura */}
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-start">
                        <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                        <p className="text-sm text-blue-700">
                            Modifica solo i campi che intendi cambiare. Le modifiche vengono salvate automaticamente al profilo atleta.
                        </p>
                    </div>

                    {/* Selettore atleta per genitori */}
                    {isParent && parentAthletes.length > 0 && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <User className="h-4 w-4 inline mr-1" />
                                Seleziona Atleta
                            </label>
                            <select
                                value={selectedAthleteId || ''}
                                onChange={handleSelectAthlete}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">— Seleziona un atleta —</option>
                                {parentAthletes
                                    .filter(a => a.can_edit)
                                    .map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.first_name} {a.last_name}
                                            {a.relationship ? ` (${a.relationship})` : ''}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    )}

                    {/* Messaggio quando genitore non ha selezionato atleta */}
                    {isParent && !selectedAthleteId && (
                        <div className="text-center py-8 text-gray-500">
                            Seleziona un atleta dalla lista sopra per modificarne i dati.
                        </div>
                    )}

                    {(isAthlete || (isParent && selectedAthleteId)) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Lettura - Data di nascita */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Calendar className="h-4 w-4 inline mr-1" />
                                Data di Nascita
                            </label>
                            <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                                {formatBirthDate(isAthlete ? profile.athleteProfile?.date_of_birth : athleteForm.dateOfBirth)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">{calculateAge(isAthlete ? profile.athleteProfile?.date_of_birth : athleteForm.dateOfBirth)}</p>
                        </div>

                        {/* Lettura - Codice Fiscale */}
                        {(profile.athleteProfile?.fiscal_code || athleteForm.fiscalCode) && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <FileText className="h-4 w-4 inline mr-1" />
                                    Codice Fiscale
                                </label>
                                <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                                    {profile.athleteProfile?.fiscal_code || athleteForm.fiscalCode}
                                </p>
                            </div>
                        )}

                        {/* Edit - Nome */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <User className="h-4 w-4 inline mr-1" />
                                Nome
                            </label>
                            <input
                                type="text"
                                name="firstName"
                                value={athleteForm.firstName}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Edit - Cognome */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <User className="h-4 w-4 inline mr-1" />
                                Cognome
                            </label>
                            <input
                                type="text"
                                name="lastName"
                                value={athleteForm.lastName}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Edit - Luogo di nascita */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <MapPin className="h-4 w-4 inline mr-1" />
                                Luogo di Nascita
                            </label>
                            <input
                                type="text"
                                name="placeOfBirth"
                                value={athleteForm.placeOfBirth}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Edit - Telefono */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Phone className="h-4 w-4 inline mr-1" />
                                Telefono
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={athleteForm.phone}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Edit - Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Mail className="h-4 w-4 inline mr-1" />
                                Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={athleteForm.email}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Edit - Indirizzo */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <MapPin className="h-4 w-4 inline mr-1" />
                                Indirizzo
                            </label>
                            <input
                                type="text"
                                name="address"
                                value={athleteForm.address}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Edit - Città di residenza */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <MapPin className="h-4 w-4 inline mr-1" />
                                Città di Residenza
                            </label>
                            <input
                                type="text"
                                name="residenceCity"
                                value={athleteForm.residenceCity}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Edit - Nome contatto di emergenza */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <AlertTriangle className="h-4 w-4 inline mr-1" />
                                Contatto Emergenza - Nome
                            </label>
                            <input
                                type="text"
                                name="emergencyContactName"
                                value={athleteForm.emergencyContactName}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Edit - Telefono contatto di emergenza */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <AlertTriangle className="h-4 w-4 inline mr-1" />
                                Contatto Emergenza - Telefono
                            </label>
                            <input
                                type="tel"
                                name="emergencyContactPhone"
                                value={athleteForm.emergencyContactPhone}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Profile;