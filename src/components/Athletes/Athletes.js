import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Users,
    Search,
    Filter,
    Plus,
    Eye,
    Edit,
    Mail,
    Phone,
    Calendar,
    MapPin,
    UserCheck,
    UserX,
    Download,
    Upload
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner, { TableSkeleton } from '../Common/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const Athletes = () => {
    const { user } = useAuth();
    const [athletes, setAthletes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [showActiveOnly, setShowActiveOnly] = useState(true);
    const [groups, setGroups] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
    });

    useEffect(() => {
        loadGroups();
    }, []);

    useEffect(() => {
        loadAthletes();
    }, [pagination.page, searchTerm, selectedGroup, showActiveOnly]);

    const loadGroups = async () => {
        try {
            const response = await apiService.getGroups();
            setGroups(response.groups || []);
        } catch (error) {
            console.error('Errore nel caricamento dei gruppi:', error);
        }
    };

    const loadAthletes = async () => {
        try {
            setLoading(true);

            let athletesData;

            if (user.role === 'parent') {
                // I genitori vedono solo i propri atleti
                athletesData = await apiService.getMyAthletes();
                setAthletes(athletesData.athletes || []);
                setPagination(prev => ({
                    ...prev,
                    total: athletesData.athletes?.length || 0,
                    pages: 1
                }));
            } else {
                // Admin e coach vedono tutti gli atleti con filtri
                const params = {
                    page: pagination.page,
                    limit: pagination.limit,
                    search: searchTerm,
                    active: showActiveOnly ? 'true' : 'false'
                };

                if (selectedGroup) {
                    params.groupId = selectedGroup;
                }

                athletesData = await apiService.getAthletes(params);
                setAthletes(athletesData.athletes || []);
                setPagination(athletesData.pagination || pagination);
            }
        } catch (error) {
            console.error('Errore nel caricamento degli atleti:', error);
            toast.error('Errore nel caricamento degli atleti');
        } finally {
            setLoading(false);
        }
    };

    const calculateAge = (birthDate) => {
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }

        return age;
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleGroupFilter = (e) => {
        setSelectedGroup(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const exportAthletes = async () => {
        try {
            // Implementa export CSV degli atleti
            const params = {
                search: searchTerm,
                active: showActiveOnly ? 'true' : 'false',
                export: 'csv'
            };

            if (selectedGroup) {
                params.groupId = selectedGroup;
            }

            await apiService.downloadFile('/athletes/export', 'atleti.csv');
            toast.success('Export completato');
        } catch (error) {
            console.error('Errore nell\'export:', error);
            toast.error('Errore nell\'export degli atleti');
        }
    };

    const sortedAthletes = useMemo(() => {
        return [...athletes].sort((a, b) => new Date(a.date_of_birth) - new Date(b.date_of_birth));
    }, [athletes]);

    const canCreateAthlete = user.role === 'admin' || user.role === 'coach';
    const canEditAthlete = user.role === 'admin' || user.role === 'coach';

    if (loading && athletes.length === 0) {
        return <TableSkeleton rows={10} />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {user.role === 'parent' ? 'I Miei Atleti' : 'Gestione Atleti'}
                    </h1>
                    <p className="text-gray-600 mt-1">
                        {user.role === 'parent'
                            ? 'Visualizza e gestisci i dati dei tuoi atleti'
                            : 'Gestisci anagrafica, documenti e gruppi degli atleti'
                        }
                    </p>
                </div>

                <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                    {(user.role === 'admin' || user.role === 'coach') && (
                        <>
                            <button
                                onClick={exportAthletes}
                                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Esporta
                            </button>

                            {canCreateAthlete && (
                                <Link
                                    to="/athletes/new"
                                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nuovo Atleta
                                </Link>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Filters */}
            {user.role !== 'parent' && (
                <div className="bg-white p-4 rounded-lg shadow space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cerca per nome, cognome o codice fiscale..."
                                value={searchTerm}
                                onChange={handleSearch}
                                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Group Filter */}
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <select
                                value={selectedGroup}
                                onChange={handleGroupFilter}
                                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                            >
                                <option value="">Tutti i gruppi</option>
                                {groups.map(group => (
                                    <option key={group.id} value={group.id}>
                                        {group.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Active Filter */}
                        <div className="flex items-center space-x-4">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={showActiveOnly}
                                    onChange={(e) => setShowActiveOnly(e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-600">Solo attivi</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Athletes List */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <LoadingSpinner size="medium" text="Caricamento atleti..." />
                    </div>
                ) : athletes.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">
                            {user.role === 'parent' ? 'Nessun atleta associato' : 'Nessun atleta trovato'}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            {user.role === 'parent'
                                ? 'Contatta l\'amministratore per associare i tuoi atleti'
                                : searchTerm || selectedGroup
                                    ? 'Prova a modificare i filtri di ricerca'
                                    : 'Inizia creando il primo atleta'
                            }
                        </p>
                        {canCreateAthlete && !searchTerm && !selectedGroup && (
                            <div className="mt-6">
                                <Link
                                    to="/athletes/new"
                                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nuovo Atleta
                                </Link>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden lg:block">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        #
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Atleta
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Età
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Gruppi
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Contatti
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Stato
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Azioni
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {sortedAthletes.map((athlete, index) => (
                                    <tr key={athlete.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {index + 1}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">
                              {athlete.first_name.charAt(0)}{athlete.last_name.charAt(0)}
                            </span>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {athlete.first_name} {athlete.last_name}
                                                    </div>
                                                    {athlete.fiscal_code && (
                                                        <div className="text-sm text-gray-500">
                                                            CF: {athlete.fiscal_code}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {calculateAge(athlete.date_of_birth)} anni
                                            <div className="text-xs text-gray-500">
                                                {format(new Date(athlete.date_of_birth), 'dd/MM/yyyy')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {athlete.groups_names ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {athlete.groups_names}
                          </span>
                                            ) : (
                                                <span className="text-sm text-gray-400">Nessun gruppo</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {athlete.email && (
                                                <div className="flex items-center">
                                                    <Mail className="h-4 w-4 mr-1" />
                                                    {athlete.email}
                                                </div>
                                            )}
                                            {athlete.phone && (
                                                <div className="flex items-center mt-1">
                                                    <Phone className="h-4 w-4 mr-1" />
                                                    {athlete.phone}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            athlete.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                        }`}>
                          {athlete.is_active ? (
                              <>
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Attivo
                              </>
                          ) : (
                              <>
                                  <UserX className="h-3 w-3 mr-1" />
                                  Inattivo
                              </>
                          )}
                        </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <Link
                                                    to={`/athletes/${athlete.id}`}
                                                    className="text-blue-600 hover:text-blue-900"
                                                    title="Visualizza dettagli"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                                {canEditAthlete && (
                                                    <Link
                                                        to={`/athletes/${athlete.id}/edit`}
                                                        className="text-gray-600 hover:text-gray-900"
                                                        title="Modifica"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Link>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="lg:hidden space-y-4 p-4">
                            {sortedAthletes.map((athlete, index) => (
                                <div key={athlete.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center space-x-3">
                                            <span className="text-xs font-medium text-gray-400 w-5 text-right">
                                                {index + 1}
                                            </span>
                                            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {athlete.first_name.charAt(0)}{athlete.last_name.charAt(0)}
                        </span>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-medium text-gray-900">
                                                    {athlete.first_name} {athlete.last_name}
                                                </h3>
                                                <p className="text-xs text-gray-500">
                                                    {calculateAge(athlete.date_of_birth)} anni
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Link
                                                to={`/athletes/${athlete.id}`}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                <Eye className="h-5 w-5" />
                                            </Link>
                                            {canEditAthlete && (
                                                <Link
                                                    to={`/athletes/${athlete.id}/edit`}
                                                    className="text-gray-600 hover:text-gray-900"
                                                >
                                                    <Edit className="h-5 w-5" />
                                                </Link>
                                            )}
                                        </div>
                                    </div>

                                    {athlete.groups_names && (
                                        <div className="mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {athlete.groups_names}
                      </span>
                                        </div>
                                    )}

                                    {(athlete.email || athlete.phone) && (
                                        <div className="mt-3 space-y-1">
                                            {athlete.email && (
                                                <div className="flex items-center text-xs text-gray-500">
                                                    <Mail className="h-3 w-3 mr-2" />
                                                    {athlete.email}
                                                </div>
                                            )}
                                            {athlete.phone && (
                                                <div className="flex items-center text-xs text-gray-500">
                                                    <Phone className="h-3 w-3 mr-2" />
                                                    {athlete.phone}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {user.role !== 'parent' && pagination.pages > 1 && (
                            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                                <div className="flex-1 flex justify-between sm:hidden">
                                    <button
                                        onClick={() => handlePageChange(pagination.page - 1)}
                                        disabled={pagination.page === 1}
                                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Precedente
                                    </button>
                                    <button
                                        onClick={() => handlePageChange(pagination.page + 1)}
                                        disabled={pagination.page === pagination.pages}
                                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Successiva
                                    </button>
                                </div>
                                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm text-gray-700">
                                            Mostra <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> a{' '}
                                            <span className="font-medium">
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span> di{' '}
                                            <span className="font-medium">{pagination.total}</span> risultati
                                        </p>
                                    </div>
                                    <div>
                                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                            <button
                                                onClick={() => handlePageChange(pagination.page - 1)}
                                                disabled={pagination.page === 1}
                                                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                Precedente
                                            </button>
                                            {[...Array(pagination.pages)].map((_, i) => {
                                                const page = i + 1;
                                                if (
                                                    page === 1 ||
                                                    page === pagination.pages ||
                                                    (page >= pagination.page - 2 && page <= pagination.page + 2)
                                                ) {
                                                    return (
                                                        <button
                                                            key={page}
                                                            onClick={() => handlePageChange(page)}
                                                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                                                page === pagination.page
                                                                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {page}
                                                        </button>
                                                    );
                                                } else if (
                                                    page === pagination.page - 3 ||
                                                    page === pagination.page + 3
                                                ) {
                                                    return (
                                                        <span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                              ...
                            </span>
                                                    );
                                                }
                                                return null;
                                            })}
                                            <button
                                                onClick={() => handlePageChange(pagination.page + 1)}
                                                disabled={pagination.page === pagination.pages}
                                                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                Successiva
                                            </button>
                                        </nav>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Athletes;
