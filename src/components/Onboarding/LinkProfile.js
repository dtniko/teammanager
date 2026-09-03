import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { Link2, UserPlus, Clock, LogOut, Shield, UserCheck, UserX, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner from '../Common/LoadingSpinner';

// ── Dropdown custom ──────────────────────────────────────────────────
// I <select> nativi perdono il posizionamento quando il genitore ha
// `overflow-y: auto` (il modal ha scroll). Un dropdown custom gestisce
// autonomamente `position: absolute` e `z-index`.
const CustomSelect = ({ label, name, value, onChange, options = [], placeholder }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const displayLabel = options.find(o => o.value === value)?.label || placeholder || '—';

    return (
        <div className="relative" ref={ref}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between bg-white text-left"
            >
                <span className={value ? 'text-gray-900' : 'text-gray-400'}>{displayLabel}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {options.map((opt, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => { onChange({ target: { name, value: opt.value } }); setOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                                opt.value === value ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-gray-900'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const RELATIONSHIP_LABELS = {
    parent: 'Genitore',
    guardian: 'Tutore',
    tutor: 'Tutore legale'
};

// Opzioni profilo: Genitore, Atleta, Coach/Dirigente
const PROFILE_OPTIONS = [
    { value: 'parent', label: 'Genitore', icon: Link2, description: 'Collega il tuo account al profilo di un atleta' },
    { value: 'athlete', label: 'Atleta', icon: UserCheck, description: 'Crea o collega il tuo profilo atleta' },
    { value: 'role', label: 'Coach / Dirigente', icon: Shield, description: 'Richiedi il ruolo di allenatore o dirigente' }
];

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

const ROLE_CHANGE_DEFAULTS = {
    requestedRole: 'coach',
    reason: ''
};

const LinkProfile = () => {
    const { user, onboardingStatus, refreshOnboardingStatus, logout } = useAuth();
    const state = onboardingStatus?.state;

    const [refreshing, setRefreshing] = useState(false);
    const [profileChoice, setProfileChoice] = useState('');

    // Collega profilo esistente
    const [search, setSearch] = useState('');
    const [availableAthletes, setAvailableAthletes] = useState([]);
    const [loadingAthletes, setLoadingAthletes] = useState(false);
    const [selectedAthleteId, setSelectedAthleteId] = useState('');
    const [relationship, setRelationship] = useState('parent');
    const [linking, setLinking] = useState(false);

    // Crea nuovo profilo atleta
    const [athleteForm, setAthleteForm] = useState(emptyAthleteForm);
    const [creating, setCreating] = useState(false);

    // Role change
    const [roleForm, setRoleForm] = useState(ROLE_CHANGE_DEFAULTS);
    const [requestingRole, setRequestingRole] = useState(false);

    // Carica Atleti Disponibili
    const loadAvailableAthletes = useCallback(async (context, searchStr = '') => {
        try {
            setLoadingAthletes(true);
            const response = await apiService.getAvailableAthletes(context, searchStr);
            setAvailableAthletes(response.athletes || []);
        } catch (error) {
            console.error('Errore nel caricamento degli atleti disponibili:', error);
            toast.error('Errore nel caricamento degli atleti disponibili');
        } finally {
            setLoadingAthletes(false);
        }
    }, []);

    useEffect(() => {
        if (state === 'select') {
            loadAvailableAthletes('athlete', search);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadAvailableAthletes('athlete', search);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await refreshOnboardingStatus();
        setRefreshing(false);
    };

    // ============================================
    // Collega profilo esistente (Genitore)
    // ============================================
    const handleLinkExisting = async (e) => {
        e.preventDefault();

        if (!selectedAthleteId) {
            toast.error('Seleziona un atleta dalla lista');
            return;
        }

        if (!relationship) {
            toast.error('Seleziona la relazione con l\'atleta');
            return;
        }

        try {
            setLinking(true);
            await apiService.linkExistingProfile(
                Number(selectedAthleteId),
                'parent',
                relationship
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

    // ============================================
    // Crea nuovo profilo atleta (Atleta)
    // ============================================
    const handleAthleteFormChange = (field) => (e) => {
        setAthleteForm(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleCreateProfile = async (e) => {
        e.preventDefault();

        if (!athleteForm.firstName || !athleteForm.lastName || !athleteForm.dateOfBirth) {
            toast.error('Nome, cognome e data di nascita sono obbligatori');
            return;
        }

        try {
            setCreating(true);
            await apiService.createOnboardingProfile(
                'athlete',
                undefined,
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

    // ============================================
    // Richiedi ruolo Coach/Dirigente
    // ============================================
    const handleRoleChangeRequest = async (e) => {
        e.preventDefault();

        if (!roleForm.requestedRole || !['coach', 'admin'].includes(roleForm.requestedRole)) {
            toast.error('Seleziona un ruolo valido');
            return;
        }

        try {
            setRequestingRole(true);
            await apiService.requestRoleChange(roleForm.requestedRole, roleForm.reason);
            const roleName = roleForm.requestedRole === 'admin' ? 'amministratore' : 'allenatore/dirigente';
            toast.success(`Richiesta per ruolo di ${roleName} inviata con successo`);
            await refreshOnboardingStatus();
        } catch (error) {
            console.error('Errore nella richiesta di cambio ruolo:', error);
            toast.error(error.error || error.message || 'Errore nella richiesta di cambio ruolo');
        } finally {
            setRequestingRole(false);
        }
    };

    const roleName = (r) => (r === 'admin' ? 'amministratore' : 'allenatore/dirigente');

    // ============================================
    // Rendering: stato pendente (cambio ruolo)
    // ============================================
    if (state === 'pending_role_change') {
        const req = onboardingStatus?.request;
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
                            Richiesta in attesa di approvazione
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Hai richiesto il ruolo di <strong>{roleName(req?.requested_role)}</strong>.
                            La tua richiesta è in attesa di conferma da parte di un amministratore.
                        </p>

                        {req?.reason && (
                            <p className="text-sm text-gray-500 mb-4 italic">
                                "{req.reason}"
                            </p>
                        )}

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

    // ============================================
    // Rendering: stato pendente (link profilo)
    // ============================================
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

    // ============================================
    // Rendering: selezione profilo (select)
    // ============================================
    if (state === 'select') {
        if (!profileChoice) {
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
                                Che profilo vuoi creare?
                            </h2>
                            <p className="text-gray-600">
                                Seleziona l'opzione che corrisponde al tuo ruolo nella società sportiva.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {PROFILE_OPTIONS.map((option) => {
                                const Icon = option.icon;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setProfileChoice(option.value)}
                                        className="w-full flex items-center gap-4 p-5 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all"
                                    >
                                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Icon className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-semibold text-gray-900">{option.label}</div>
                                            <div className="text-sm text-gray-500">{option.description}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        }

        // Genitore: Collega profilo esistente
        if (profileChoice === 'parent') {
            return (
                <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-10">
                    <div className="w-full max-w-xl space-y-6">
                        <div className="flex justify-between items-center">
                            <button
                                type="button"
                                onClick={() => setProfileChoice('')}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                ← Torna alla selezione
                            </button>
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
                                Genitore
                            </h2>
                            <p className="text-gray-600">
                                Collega il tuo account al profilo di tuo figlio/a.
                                L'amministratore confermerà il collegamento.
                            </p>
                        </div>

                        <div className="bg-white shadow rounded-lg p-6">
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
                                <CustomSelect
                                    label="Atleta"
                                    name="athlete"
                                    value={selectedAthleteId}
                                    onChange={(e) => setSelectedAthleteId(e.target.value)}
                                    placeholder={loadingAthletes ? 'Caricamento...' : 'Seleziona un atleta'}
                                    options={availableAthletes.map((a) => ({
                                        value: a.id,
                                        label: `${a.last_name} ${a.first_name}${a.date_of_birth ? ` (${a.date_of_birth.substring(0, 10)})` : ''}`
                                    }))}
                                />

                                <CustomSelect
                                    label="Relazione con l'atleta"
                                    name="relationship"
                                    value={relationship}
                                    onChange={(e) => setRelationship(e.target.value)}
                                    options={Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => ({ value, label }))}
                                />

                                <button
                                    type="submit"
                                    disabled={linking}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {linking ? (
                                        <LoadingSpinner size="small" text="Invio in corso..." />
                                    ) : (
                                        'Invia richiesta di collegamento'
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            );
        }

        // Atleta: Crea nuovo profilo
        if (profileChoice === 'athlete') {
            return (
                <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-10">
                    <div className="w-full max-w-3xl space-y-6">
                        <div className="flex justify-between items-center">
                            <button
                                type="button"
                                onClick={() => setProfileChoice('')}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                ← Torna alla selezione
                            </button>
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
                                Atleta
                            </h2>
                            <p className="text-gray-600">
                                Crea il tuo profilo atleta per continuare.
                            </p>
                        </div>

                        <div className="bg-white shadow rounded-lg p-6">
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
        }

        // Coach/Dirigente: Richiedi ruolo
        if (profileChoice === 'role') {
            return (
                <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-10">
                    <div className="w-full max-w-xl space-y-6">
                        <div className="flex justify-between items-center">
                            <button
                                type="button"
                                onClick={() => setProfileChoice('')}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                ← Torna alla selezione
                            </button>
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
                                Coach / Dirigente
                            </h2>
                            <p className="text-gray-600">
                                Richiedi il ruolo di allenatore o dirigente. La richiesta sarà
                                esaminata da un amministratore.
                            </p>
                        </div>

                        <div className="bg-white shadow rounded-lg p-6">
                            <form onSubmit={handleRoleChangeRequest} className="space-y-4">
                                <CustomSelect
                                    label="Ruolo richiesto *"
                                    name="requestedRole"
                                    value={roleForm.requestedRole}
                                    onChange={(e) => setRoleForm(prev => ({ ...prev, requestedRole: e.target.value }))}
                                    options={[
                                        { value: 'coach', label: 'Allenatore / Dirigente' },
                                        { value: 'admin', label: 'Amministratore' }
                                    ]}
                                />

                                <div>
                                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                                        Motivazione (opzionale)
                                    </label>
                                    <textarea
                                        id="reason"
                                        value={roleForm.reason}
                                        onChange={(e) => setRoleForm(prev => ({ ...prev, reason: e.target.value }))}
                                        rows={4}
                                        placeholder="Descrivi brevemente il motivo della richiesta..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={requestingRole}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {requestingRole ? (
                                        <LoadingSpinner size="small" text="Invio in corso..." />
                                    ) : (
                                        'Invia richiesta'
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            );
        }
    }

    // ============================================
    // Nessun onboarding necessario
    // ============================================
    if (state === 'done') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4">
                <div className="w-full max-w-md">
                    <div className="bg-white shadow rounded-lg p-8 text-center">
                        <div className="flex items-center justify-center mb-6">
                            <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center">
                                <UserCheck className="h-7 w-7 text-white" />
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Profilo collegato
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Il tuo account è stato collegato con successo.
                        </p>

                        <button
                            type="button"
                            onClick={logout}
                            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Esci
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Fallback
    return (
        <div className="min-h-screen flex items-center justify-center">
            <LoadingSpinner size="large" />
        </div>
    );
};

export default LinkProfile;