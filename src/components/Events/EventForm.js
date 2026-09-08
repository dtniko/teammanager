import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const emptyForm = {
    title: '',
    description: '',
    eventType: 'training',
    startDatetime: '',
    endDatetime: '',
    location: '',
    groupId: '',
    isRecurring: false,
    recurringUntil: ''
};

// ── Dropdown custom ──────────────────────────────────────────────────
// I <select> nativi perdono il posizionamento quando il genitore ha
// `overflow-y: auto` (il modal ha scroll). Un dropdown custom gestisce
// autonomamente `position: absolute` e `z-index`.
const CustomSelect = ({ label, name, value, onChange, options = [], placeholder, disabled }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    // Chiude il menu quando si clicca fuori
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <button
                type="button"
                onClick={() => !disabled && setOpen(!open)}
                disabled={disabled}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between bg-white text-left ${
                    disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
            >
                <span className={value ? 'text-gray-900' : 'text-gray-400'}>{displayLabel}</span>
                <ChevronDown className={`h-4 w-4 ${disabled ? 'text-gray-400' : 'text-gray-400'}`} />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {options.map(opt => (
                        <button
                            key={opt.value}
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

const EventForm = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [loadingGroups, setLoadingGroups] = useState(true);

    const canManage = user.role === 'admin' || user.role === 'coach';

    useEffect(() => {
        if (!canManage) {
            toast.error('Non hai i permessi per creare eventi');
            navigate('/dashboard');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canManage]);

    useEffect(() => {
        let active = true;
        const loadGroups = async () => {
            try {
                const response = await apiService.getGroups();
                if (active) setGroups(response.groups || []);
            } catch (error) {
                console.error('Errore nel caricamento dei gruppi:', error);
            } finally {
                if (active) setLoadingGroups(false);
            }
        };
        loadGroups();
        return () => { active = false; };
    }, []);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: checked }));
    };

    const handleSave = async (e) => {
        e.preventDefault();

        if (!form.title || !form.startDatetime || !form.endDatetime) {
            toast.error('Compila tutti i campi obbligatori');
            return;
        }

        if (form.isRecurring) {
            if (!form.recurringUntil) {
                toast.error('Indica fino a quando ripetere l\'evento');
                return;
            }

            if (new Date(form.recurringUntil) < new Date(form.startDatetime.slice(0, 10))) {
                toast.error('La data "Fino al" deve essere successiva o uguale alla data di inizio');
                return;
            }
        }

        try {
            setSaving(true);
            const response = await apiService.createEvent({
                title: form.title,
                description: form.description,
                eventType: form.eventType,
                startDatetime: form.startDatetime,
                endDatetime: form.endDatetime,
                location: form.location,
                groupId: form.groupId || null,
                isRecurring: form.isRecurring,
                recurringUntil: form.isRecurring ? form.recurringUntil : null
            });
            const count = response?.count || 1;
            toast.success(count > 1 ? `${count} eventi creati con successo` : 'Evento creato con successo');
            navigate('/calendar');
        } catch (error) {
            console.error('Errore nella creazione dell\'evento:', error);
            toast.error(error?.error || 'Errore nella creazione dell\'evento');
        } finally {
            setSaving(false);
        }
    };

    const handleBack = () => {
        setForm(emptyForm);
        navigate('/calendar');
    };

    if (!canManage) return null;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Link
                        to="/calendar"
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Nuovo evento</h1>
                        <p className="text-sm text-gray-600">Compila i campi per creare un nuovo evento</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <form onSubmit={handleSave} className="space-y-6">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Titolo <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={form.title}
                            onChange={handleFormChange}
                            required
                            placeholder="es. Allenamento prima squadra"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Descrizione
                        </label>
                        <textarea
                            name="description"
                            value={form.description}
                            onChange={handleFormChange}
                            rows={3}
                            placeholder="Dettagli dell'evento..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Event type + Group */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 space-y-4 sm:space-y-0">
                        <CustomSelect
                            label="Tipo evento *"
                            name="eventType"
                            value={form.eventType}
                            onChange={handleFormChange}
                            placeholder="Seleziona tipo"
                            options={[
                                { value: 'training', label: 'Allenamento' },
                                { value: 'match', label: 'Partita' },
                                { value: 'meeting', label: 'Riunione' },
                            ]}
                        />

                        <CustomSelect
                            label="Gruppo"
                            name="groupId"
                            value={form.groupId}
                            onChange={handleFormChange}
                            placeholder={loadingGroups ? 'Caricamento…' : 'Nessun gruppo'}
                            disabled={loadingGroups}
                            options={[
                                { value: '', label: 'Nessun gruppo' },
                                ...groups.map(g => ({ value: g.id, label: g.name })),
                            ]}
                        />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Inizio <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                name="startDatetime"
                                value={form.startDatetime}
                                onChange={handleFormChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fine <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                name="endDatetime"
                                value={form.endDatetime}
                                onChange={handleFormChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Location */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Location
                        </label>
                        <input
                            type="text"
                            name="location"
                            value={form.location}
                            onChange={handleFormChange}
                            placeholder="es. Campo comunale, Palestra..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Recurring */}
                    <div className="border-t border-gray-200 pt-4">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                name="isRecurring"
                                checked={form.isRecurring}
                                onChange={handleCheckboxChange}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">
                                Evento ricorrente (settimanale)
                            </span>
                        </label>

                        {form.isRecurring && (
                            <div className="mt-3 space-y-3 bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-blue-800">
                                    {form.startDatetime
                                        ? <>Si ripeterà ogni <strong>{format(parseISO(form.startDatetime), 'EEEE', { locale: it })}</strong> a partire dalla data di inizio sopra indicata.</>
                                        : 'Imposta prima la data di inizio'
                                    }
                                </p>
                                <div>
                                    <label className="block text-sm font-medium text-blue-900 mb-1">
                                        Ripeti fino al <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        name="recurringUntil"
                                        value={form.recurringUntil}
                                        onChange={handleFormChange}
                                        required={form.isRecurring}
                                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Save button */}
                        <div className="flex justify-end pt-4 border-t border-gray-200">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Salvataggio...
                                    </span>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4 mr-2" />
                                        Salva
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Footer actions */}
            <div className="flex justify-between items-center">
                <button
                    type="button"
                    onClick={handleBack}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Annulla e torna al calendario
                </button>
                <span className="text-xs text-gray-500">
                    I campi contrassegnati con <span className="text-red-500">*</span> sono obbligatori
                </span>
            </div>
        </div>
    );
};

export default EventForm;