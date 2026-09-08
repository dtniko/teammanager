import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import { toast } from 'react-toastify';

const emptyForm = {
    title: '',
    content: '',
    targetType: 'all',
    targetGroupId: '',
    isUrgent: false
};

const TARGET_OPTIONS = [
    { value: 'all', label: 'Tutti' },
    { value: 'group', label: 'Gruppo' },
    { value: 'parents', label: 'Genitori' },
    { value: 'athletes', label: 'Atleti' }
];

const CommunicationNew = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [loadingGroups, setLoadingGroups] = useState(true);

    const canManage = user.role === 'admin' || user.role === 'coach';

    useEffect(() => {
        if (!canManage) return;
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
    }, [canManage]);

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

        if (!form.title || !form.content || !form.targetType) {
            toast.error('Compila tutti i campi obbligatori');
            return;
        }

        if (form.targetType === 'group' && !form.targetGroupId) {
            toast.error('Seleziona un gruppo destinatario');
            return;
        }

        try {
            setSaving(true);
            await apiService.createCommunication({
                title: form.title,
                content: form.content,
                targetType: form.targetType,
                targetGroupId: form.targetType === 'group' ? form.targetGroupId : null,
                isUrgent: form.isUrgent
            });
            toast.success('Comunicazione inviata con successo');
            navigate('/communications');
        } catch (error) {
            console.error("Errore nell'invio della comunicazione:", error);
            toast.error(error?.error || "Errore nell'invio della comunicazione");
        } finally {
            setSaving(false);
        }
    };

    if (!canManage) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Link
                        to="/communications"
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Nuova comunicazione</h1>
                        <p className="text-sm text-gray-600">Invia un messaggio a tutti, a un gruppo, ai genitori o agli atleti</p>
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
                            placeholder="es. Spostamento allenamento di sabato"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Contenuto <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            name="content"
                            value={form.content}
                            onChange={handleFormChange}
                            rows={6}
                            required
                            placeholder="Scrivi il messaggio da inviare..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Target */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Destinatari <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="targetType"
                            value={form.targetType}
                            onChange={handleFormChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                            {TARGET_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>

                    {form.targetType === 'group' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Gruppo <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="targetGroupId"
                                value={form.targetGroupId}
                                onChange={handleFormChange}
                                required
                                disabled={loadingGroups}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:opacity-60"
                            >
                                <option value="">{loadingGroups ? 'Caricamento…' : 'Seleziona un gruppo'}</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Urgent */}
                    <div className="border-t border-gray-200 pt-4">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                name="isUrgent"
                                checked={form.isUrgent}
                                onChange={handleCheckboxChange}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">
                                Comunicazione urgente
                            </span>
                        </label>
                    </div>

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
                                    Invio...
                                </span>
                            ) : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Invia
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Footer actions */}
            <div className="flex justify-between items-center">
                <button
                    type="button"
                    onClick={() => navigate('/communications')}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Annulla e torna alle comunicazioni
                </button>
                <span className="text-xs text-gray-500">
                    I campi contrassegnati con <span className="text-red-500">*</span> sono obbligatori
                </span>
            </div>
        </div>
    );
};

export default CommunicationNew;