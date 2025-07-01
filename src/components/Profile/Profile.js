import React from 'react';
import { Settings } from 'lucide-react';

const Profile = () => {
    return (
        <div className="p-6">
            <div className="flex items-center mb-6">
                <Settings className="h-8 w-8 text-blue-600 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900">Profilo Utente</h1>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600">
                    Componente Profilo in fase di sviluppo...
                </p>
            </div>
        </div>
    );
};

export default Profile;
