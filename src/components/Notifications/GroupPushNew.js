import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import { toast } from 'react-toastify';

const emptyForm = {
    title: '',
    message: '',
    groupId: ''
};

const GroupPushNew = () => {
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

    const handleSend = async (e) => {
        e.preventDefault();

        if (!form.title || !form.message || !form.groupId) {
            toast.error('Compila tutti i campi obbligatori');
            return;
        }

        try {
            setSaving(true);
            const response = await apiService.sendGroupPushNotification({
                title: form.title,
                message: form.message,
                groupId: parseInt(form.groupId)
            });
            const sent = response?.sent;
            toast.success(
                sent !== undefined
                    ? `Notifica inviata a ${sent} destinatari`
                    : 'Notifica inviata con successo'
            );
            setForm(emptyForm);
        } catch (error) {
            console.error("Errore nell'invio della notifica:", error);
            toast.error(error?.error || "Errore nell'invio della notifica");
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
                        to="/notifications"
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Notifica</h1>
                        <p className="text-sm text-gray-600">Invia una notifica push a tutti i genitori e gli atleti del gruppo</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <form onSubmit={handleSend} className="space-y-6">
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
                            placeholder="es. Cambiamento di orario"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Messaggio <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            name="message"
                            value={form.message}
                            onChange={handleFormChange}
                            rows={5}
                            required
                            placeholder="Scrivi il messaggio da inviare..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Group */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Gruppo <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="groupId"
                            value={form.groupId}
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

                    {/* Send button */}
                    <div className="flex justify-end pt-4 border-t border-gray-200">
                        <button
                            type="submit"
                            disabled={saving || !form.title || !form.message || !form.groupId}
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
                                    Invia notifica
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
                    onClick={() => navigate('/notifications')}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Annulla e torna alle notifiche
                </button>
                <span className="text-xs text-gray-500">
                    I campi contrassegnati con <span className="text-red-500">*</span> sono obbligatori
                </span>
            </div>
        </div>
    );
};

export default GroupPushNew;