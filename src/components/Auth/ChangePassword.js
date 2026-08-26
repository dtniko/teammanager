import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Shield, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner from '../Common/LoadingSpinner';

const ChangePassword = () => {
    const { clearMustChangePassword } = useAuth();
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (newPassword.length < 8) {
            toast.error('La password deve avere almeno 8 caratteri');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Le password non coincidono');
            return;
        }

        setLoading(true);

        try {
            const response = await apiService.changePassword(null, newPassword);

            if (response.success) {
                clearMustChangePassword();
                toast.success('Password aggiornata con successo');
                navigate('/dashboard', { replace: true });
            } else {
                throw new Error(response.error || 'Errore nel cambio password');
            }
        } catch (error) {
            console.error('Errore nel cambio password:', error);
            toast.error(error.error || error.message || 'Errore nel cambio password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="bg-white shadow rounded-lg p-8">
                    <div className="flex items-center justify-center mb-6">
                        <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center">
                            <Shield className="h-7 w-7 text-white" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                        Imposta una nuova password
                    </h2>
                    <p className="text-gray-600 text-center mb-6">
                        Per motivi di sicurezza devi impostare una nuova password prima di continuare.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                Nuova password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    id="newPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Almeno 8 caratteri"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                Conferma nuova password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Ripeti la password"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? (
                                <LoadingSpinner size="small" text="Aggiornamento..." />
                            ) : (
                                'Aggiorna password'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChangePassword;
