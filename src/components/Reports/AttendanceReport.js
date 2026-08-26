import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, UserCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import { TableSkeleton } from '../Common/LoadingSpinner';
import { toast } from 'react-toastify';

const AttendanceReport = () => {
    const { user } = useAuth();
    const [summary, setSummary] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [groupFilter, setGroupFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const canView = user.role === 'admin' || user.role === 'coach';

    useEffect(() => {
        if (canView) {
            loadGroups();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadGroups = async () => {
        try {
            const response = await apiService.getGroups();
            setGroups(response.groups || []);
        } catch (error) {
            console.error('Errore nel caricamento dei gruppi:', error);
        }
    };

    const loadSummary = useCallback(async () => {
        try {
            setLoading(true);

            const params = {};
            if (groupFilter) params.groupId = groupFilter;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const response = await apiService.getAttendanceSummary(params);
            setSummary(response.summary || []);
        } catch (error) {
            console.error('Errore nel caricamento del report presenze:', error);
            toast.error('Errore nel caricamento del report presenze');
        } finally {
            setLoading(false);
        }
    }, [groupFilter, startDate, endDate]);

    useEffect(() => {
        if (canView) {
            loadSummary();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadSummary]);

    if (!canView) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Non hai i permessi per accedere a questa pagina.</p>
            </div>
        );
    }

    if (loading && summary.length === 0) {
        return <TableSkeleton rows={6} />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Report Presenze</h1>
                <p className="text-gray-600 mt-1">Confronto tra convocazioni e presenze reali confermate</p>
            </div>

            {/* Filters */}
            <div className="bg-white shadow rounded-lg p-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gruppo</label>
                    <select
                        value={groupFilter}
                        onChange={(e) => setGroupFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Tutti i gruppi</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dal</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Al</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Summary list */}
            {summary.length === 0 ? (
                <div className="bg-white shadow rounded-lg text-center py-12">
                    <ClipboardList className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun dato disponibile</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Non ci sono eventi con presenze nel periodo selezionato
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {summary.map(row => (
                        <div key={row.athlete_id} className="bg-white shadow rounded-lg p-4">
                            <div className="flex items-center">
                                <UserCircle className="h-8 w-8 text-gray-300 flex-shrink-0" />
                                <p className="ml-2 text-sm font-medium text-gray-900">
                                    {row.first_name} {row.last_name}
                                </p>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                <div className="bg-gray-50 rounded-md py-2">
                                    <p className="text-lg font-semibold text-gray-700">{row.notified_absences}</p>
                                    <p className="text-xs text-gray-500">Assenze avvisate</p>
                                </div>
                                <div className="bg-red-50 rounded-md py-2">
                                    <p className="text-lg font-semibold text-red-700">{row.unnotified_absences}</p>
                                    <p className="text-xs text-red-600">No-show</p>
                                </div>
                                <div className="bg-green-50 rounded-md py-2">
                                    <p className="text-lg font-semibold text-green-700">{row.confirmed_present}</p>
                                    <p className="text-xs text-green-600">Presenze confermate</p>
                                </div>
                            </div>

                            <p className="mt-2 text-xs text-gray-400 text-right">
                                {row.total_events} eventi totali
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AttendanceReport;
