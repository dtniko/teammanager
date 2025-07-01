import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

const Calendar = () => {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
                    <p className="text-gray-600 mt-1">
                        Visualizza eventi, allenamenti e partite
                    </p>
                </div>
            </div>

            {/* Placeholder Content */}
            <div className="bg-white shadow rounded-lg p-8">
                <div className="text-center">
                    <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                        Calendario in sviluppo
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Il componente calendario sarà disponibile presto
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Calendar;
