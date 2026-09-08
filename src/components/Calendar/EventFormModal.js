import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import apiService from '../../services/apiService';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

// ── Dropdown custom ──────────────────────────────────────────────────
// I <select> nativi perdono il posizionamento quando il genitore ha
// `overflow-y: auto` (il modal ha scroll). Un dropdown custom gestisce
// autonomamente `position: absolute` e `z-index`.
const CustomSelect = ({ label, name, value, onChange, options = [], placeholder }) => {
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
                onClick={() => setOpen(!open)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between bg-white text-left"
            >
                <span className={value ? 'text-gray-900' : 'text-gray-400'}>{displayLabel}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
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

// Modale per la creazione di un evento. Autosufficiente: carica i gruppi
// e chiama apiService.createEvent. `onCreated` (opzionale) viene invocato
// dopo una creazione riuscita, cosi' il chiamante puo' aggiornare la propria
// lista (es. il calendario). `groups` (opzionale) puo' essere passato se il
// chiamante li ha gia' caricati; altrimenti li carica da solo.
const EventFormModal = ({ onClose, onCreated, groups: groupsProp }) => {
    const [groups, setGroups] = useState(groupsProp || []);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (groupsProp) return; // il chiamante gestisce i gruppi
        let active = true;
        const loadGroups = async () => {
            try {
                const response = await apiService.getGroups();
                if (active) setGroups(response.groups || []);
            } catch (error) {
                console.error('Errore nel caricamento dei gruppi:', error);
            }
        };
        loadGroups();
        return () => { active = false; };
    }, [groupsProp]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: checked }));
    };

    const handleClose = () => {
        setForm(emptyForm);
        onClose();
    };

    const handleCreateEvent = async (e) => {
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
            setForm(emptyForm);
            onClose();
            if (onCreated) onCreated();
        } catch (error) {
            console.error('Errore nella creazione dell\'evento:', error);
            toast.error(error?.error || 'Errore nella creazione dell\'evento');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Nuovo evento</h3>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleCreateEvent} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Titolo *</label>
                        <input
                            type="text"
                            name="title"
                            value={form.title}
                            onChange={handleFormChange}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                        <textarea
                            name="description"
                            value={form.description}
                            onChange={handleFormChange}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

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
                            placeholder="Nessun gruppo"
                            options={[
                                { value: '', label: 'Nessun gruppo' },
                                ...groups.map(g => ({ value: g.id, label: g.name })),
                            ]}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Inizio *</label>
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fine *</label>
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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <input
                            type="text"
                            name="location"
                            value={form.location}
                            onChange={handleFormChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                name="isRecurring"
                                checked={form.isRecurring}
                                onChange={handleCheckboxChange}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">Evento ricorrente (settimanale)</span>
                        </label>
                    </div>

                    {form.isRecurring && (
                        <div className="space-y-3 bg-gray-50 p-3 rounded-md">
                            <p className="text-sm text-gray-600">
                                {form.startDatetime
                                    ? <>Si ripeterà ogni <strong>{format(parseISO(form.startDatetime), 'EEEE', { locale: it })}</strong> a partire dalla data di inizio sopra indicata.</>
                                    : 'Imposta prima la data di inizio'}
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fino al *</label>
                                <input
                                    type="date"
                                    name="recurringUntil"
                                    value={form.recurringUntil}
                                    onChange={handleFormChange}
                                    required={form.isRecurring}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? 'Creazione...' : 'Crea evento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EventFormModal;