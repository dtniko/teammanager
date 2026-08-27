import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import {
    ArrowLeft,
    Edit,
    User,
    Mail,
    Phone,
    MapPin,
    Calendar,
    FileText,
    Users,
    AlertTriangle,
    CheckCircle,
    Upload,
    Download,
    Eye,
    Trash2,
    Plus,
    UserCheck,
    UserX
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import LoadingSpinner, { CardSkeleton } from '../Common/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const AthleteDetail = () => {
    const { athleteId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [athlete, setAthlete] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('details');
    const [uploadingDocument, setUploadingDocument] = useState(false);
    const [seasons, setSeasons] = useState([]);
    const [seasonFilter, setSeasonFilter] = useState('');
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [uploadForm, setUploadForm] = useState({
        documentType: 'other',
        title: '',
        seasonId: '',
        expiryDate: '',
        file: null
    });

    const loadAthleteData = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiService.getAthleteById(athleteId);
            setAthlete(response.athlete);
        } catch (error) {
            console.error('Errore nel caricamento dell\'atleta:', error);
            toast.error('Errore nel caricamento dei dati dell\'atleta');
            navigate('/athletes');
        } finally {
            setLoading(false);
        }
    }, [athleteId, navigate]);

    const loadDocuments = useCallback(async () => {
        try {
            setDocumentsLoading(true);
            const params = seasonFilter ? { seasonId: seasonFilter } : {};
            const response = await apiService.getDocuments(athleteId, params);
            setDocuments(response.documents || []);
        } catch (error) {
            console.error('Errore nel caricamento dei documenti:', error);
            toast.error('Errore nel caricamento dei documenti');
        } finally {
            setDocumentsLoading(false);
        }
    }, [athleteId, seasonFilter]);

    const loadSeasons = useCallback(async () => {
        try {
            const response = await apiService.getSeasons();
            const list = response.seasons || [];
            setSeasons(list);
            const current = list.find((s) => s.is_current);
            if (current) {
                setSeasonFilter((prev) => prev || String(current.id));
                setUploadForm((prev) => ({ ...prev, seasonId: prev.seasonId || String(current.id) }));
            }
        } catch (error) {
            console.error('Errore nel caricamento delle stagioni:', error);
        }
    }, []);

    useEffect(() => {
        loadAthleteData();
    }, [athleteId, loadAthleteData]);

    useEffect(() => {
        loadSeasons();
    }, [loadSeasons]);

    useEffect(() => {
        if (activeTab === 'documents') {
            loadDocuments();
        }
    }, [activeTab, athleteId, loadDocuments]);

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

    const getDocumentTypeLabel = (type) => {
        const labels = {
            payment: 'Attestazione di Pagamento',
            medical_certificate: 'Certificato Medico',
            other: 'Altro Documento'
        };
        return labels[type] || type;
    };

    const getDocumentStatusColor = (doc) => {
        if (doc.expired) {
            return 'bg-red-100 text-red-800 border-red-200';
        } else if (doc.expiring_soon) {
            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        } else {
            return 'bg-green-100 text-green-800 border-green-200';
        }
    };

    const openUploadForm = () => {
        const current = seasons.find((s) => s.is_current);
        setUploadForm({
            documentType: 'other',
            title: '',
            seasonId: current ? String(current.id) : '',
            expiryDate: '',
            file: null
        });
        setShowUploadForm(true);
    };

    const closeUploadForm = () => {
        if (uploadingDocument) return;
        setShowUploadForm(false);
    };

    const handleUploadFormChange = (field, value) => {
        setUploadForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleUploadFileSelected = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setUploadForm((prev) => ({ ...prev, file, title: file.name }));
        event.target.value = '';
    };

    const handleUploadSubmit = async (event) => {
        event.preventDefault();

        if (!uploadForm.file) {
            toast.error('Seleziona un file da caricare');
            return;
        }

        try {
            setUploadingDocument(true);

            const formData = new FormData();
            formData.append('document', uploadForm.file);
            formData.append('athleteId', athleteId);
            formData.append('title', uploadForm.title || uploadForm.file.name);
            formData.append('documentType', uploadForm.documentType);
            if (uploadForm.seasonId) {
                formData.append('seasonId', uploadForm.seasonId);
            }
            if (uploadForm.expiryDate) {
                formData.append('expiryDate', uploadForm.expiryDate);
            }

            const response = await apiService.uploadDocument(formData);

            if (response.success) {
                toast.success('Documento caricato con successo');
                setShowUploadForm(false);
                loadDocuments();
            }
        } catch (error) {
            console.error('Errore nel caricamento del documento:', error);
            toast.error('Errore nel caricamento del documento');
        } finally {
            setUploadingDocument(false);
        }
    };

    const handleDocumentDownload = async (documentId, fileName) => {
        try {
            await apiService.downloadDocument(documentId);
        } catch (error) {
            console.error('Errore nel download:', error);
            toast.error('Errore nel download del documento');
        }
    };

    const handleDocumentDelete = async (documentId) => {
        if (!window.confirm('Sei sicuro di voler eliminare questo documento?')) {
            return;
        }

        try {
            await apiService.deleteDocument(documentId);
            toast.success('Documento eliminato');
            loadDocuments();
        } catch (error) {
            console.error('Errore nell\'eliminazione:', error);
            toast.error('Errore nell\'eliminazione del documento');
        }
    };

    const canEdit = () => {
        if (user.role === 'admin' || user.role === 'coach') return true;
        if (user.role === 'parent') {
            return athlete?.parents?.some(parent =>
                parent.id === user.id && parent.can_edit
            );
        }
        if (user.role === 'athlete') {
            return athlete?.has_account && athlete?.user_id === user.id;
        }
        return false;
    };

    const canUploadDocuments = () => {
        return canEdit();
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <CardSkeleton className="h-8 w-64" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <CardSkeleton className="lg:col-span-2" />
                    <CardSkeleton />
                </div>
            </div>
        );
    }

    if (!athlete) {
        return (
            <div className="text-center py-12">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Atleta non trovato</h3>
                <p className="mt-1 text-sm text-gray-500">
                    L'atleta richiesto non esiste o non hai i permessi per visualizzarlo
                </p>
                <div className="mt-6">
                    <Link
                        to="/athletes"
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Torna agli atleti
                    </Link>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'details', name: 'Dettagli', icon: User },
        { id: 'documents', name: 'Documenti', icon: FileText },
        { id: 'groups', name: 'Gruppi', icon: Users },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/athletes')}
                        className="flex items-center text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="h-5 w-5 mr-1" />
                        Torna agli atleti
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {athlete.first_name} {athlete.last_name}
                        </h1>
                        <p className="text-gray-600">
                            {calculateAge(athlete.date_of_birth)} anni -
                            Nato il {format(new Date(athlete.date_of_birth), 'dd MMMM yyyy', { locale: it })}
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              athlete.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
          }`}>
            {athlete.is_active ? (
                <>
                    <UserCheck className="h-4 w-4 mr-1" />
                    Attivo
                </>
            ) : (
                <>
                    <UserX className="h-4 w-4 mr-1" />
                    Inattivo
                </>
            )}
          </span>

                    {canEdit() && (
                        <Link
                            to={`/athletes/${athleteId}/edit`}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            <Edit className="h-4 w-4 mr-2" />
                            Modifica
                        </Link>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                                    activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <Icon className="h-4 w-4 mr-2" />
                                {tab.name}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'details' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Personal Info */}
                        <div className="bg-white shadow rounded-lg p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Informazioni Personali</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                                    <p className="text-sm text-gray-900">{athlete.first_name}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                                    <p className="text-sm text-gray-900">{athlete.last_name}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Data di Nascita</label>
                                    <p className="text-sm text-gray-900">
                                        {format(new Date(athlete.date_of_birth), 'dd/MM/yyyy')}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Età</label>
                                    <p className="text-sm text-gray-900">{calculateAge(athlete.date_of_birth)} anni</p>
                                </div>
                                {athlete.fiscal_code && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
                                        <p className="text-sm text-gray-900">{athlete.fiscal_code}</p>
                                    </div>
                                )}
                                {athlete.place_of_birth && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Luogo di Nascita</label>
                                        <p className="text-sm text-gray-900">{athlete.place_of_birth}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="bg-white shadow rounded-lg p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Contatti</h3>
                            <div className="space-y-4">
                                {athlete.email && (
                                    <div className="flex items-center">
                                        <Mail className="h-5 w-5 text-gray-400 mr-3" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Email</p>
                                            <a href={`mailto:${athlete.email}`} className="text-sm text-blue-600 hover:text-blue-700">
                                                {athlete.email}
                                            </a>
                                        </div>
                                    </div>
                                )}
                                {athlete.phone && (
                                    <div className="flex items-center">
                                        <Phone className="h-5 w-5 text-gray-400 mr-3" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Telefono</p>
                                            <a href={`tel:${athlete.phone}`} className="text-sm text-blue-600 hover:text-blue-700">
                                                {athlete.phone}
                                            </a>
                                        </div>
                                    </div>
                                )}
                                {athlete.address && (
                                    <div className="flex items-start">
                                        <MapPin className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Indirizzo</p>
                                            <p className="text-sm text-gray-900">{athlete.address}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Emergency Contact */}
                        {(athlete.emergency_contact_name || athlete.emergency_contact_phone) && (
                            <div className="bg-white shadow rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Contatto di Emergenza</h3>
                                <div className="space-y-2">
                                    {athlete.emergency_contact_name && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Nome</p>
                                            <p className="text-sm text-gray-900">{athlete.emergency_contact_name}</p>
                                        </div>
                                    )}
                                    {athlete.emergency_contact_phone && (
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Telefono</p>
                                            <a href={`tel:${athlete.emergency_contact_phone}`} className="text-sm text-blue-600 hover:text-blue-700">
                                                {athlete.emergency_contact_phone}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Account Info */}
                        <div className="bg-white shadow rounded-lg p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Account</h3>
                            {athlete.has_account ? (
                                <div className="flex items-center text-green-600">
                                    <CheckCircle className="h-5 w-5 mr-2" />
                                    <span className="text-sm">Ha un account personale</span>
                                </div>
                            ) : (
                                <div className="flex items-center text-gray-500">
                                    <UserX className="h-5 w-5 mr-2" />
                                    <span className="text-sm">Nessun account personale</span>
                                </div>
                            )}
                        </div>

                        {/* Parents */}
                        {athlete.parents && athlete.parents.length > 0 && (
                            <div className="bg-white shadow rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Genitori/Tutori</h3>
                                <div className="space-y-3">
                                    {athlete.parents.map((parent) => (
                                        <div key={parent.id} className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {parent.first_name} {parent.last_name}
                                                </p>
                                                <p className="text-xs text-gray-500">{parent.relationship}</p>
                                            </div>
                                            {parent.can_edit && (
                                                <span className="text-xs text-green-600">Può modificare</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Actions */}
                        {canEdit() && (
                            <div className="bg-white shadow rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Azioni Rapide</h3>
                                <div className="space-y-3">
                                    <Link
                                        to={`/documents/${athleteId}`}
                                        className="block w-full text-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        <FileText className="h-4 w-4 inline mr-2" />
                                        Gestisci Documenti
                                    </Link>
                                    <Link
                                        to={`/athletes/${athleteId}/edit`}
                                        className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                                    >
                                        <Edit className="h-4 w-4 inline mr-2" />
                                        Modifica Dati
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'documents' && (
                <div className="space-y-6">
                    {/* Documents Header */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h3 className="text-lg font-medium text-gray-900">Documenti</h3>
                        <div className="flex items-center space-x-3">
                            <select
                                value={seasonFilter}
                                onChange={(e) => setSeasonFilter(e.target.value)}
                                className="rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
                            >
                                <option value="">Tutte le stagioni</option>
                                {seasons.map((season) => (
                                    <option key={season.id} value={season.id}>
                                        {season.name}{season.is_current ? ' (corrente)' : ''}
                                    </option>
                                ))}
                            </select>
                            {canUploadDocuments() && (
                                <button
                                    type="button"
                                    onClick={openUploadForm}
                                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Carica Documento
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Documents List */}
                    {documentsLoading ? (
                        <div className="text-center py-8">
                            <LoadingSpinner size="medium" text="Caricamento documenti..." />
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-lg shadow">
                            <FileText className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun documento</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Non sono stati caricati documenti per questo atleta
                            </p>
                            {canUploadDocuments() && (
                                <div className="mt-6">
                                    <button
                                        type="button"
                                        onClick={openUploadForm}
                                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Carica Primo Documento
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="divide-y divide-gray-200">
                                {documents.map((doc) => (
                                    <div key={doc.id} className="p-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3">
                                                    <div className="flex-shrink-0">
                                                        <FileText className="h-8 w-8 text-gray-400" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-medium text-gray-900">{doc.title}</h4>
                                                        <p className="text-sm text-gray-500">
                                                            {getDocumentTypeLabel(doc.document_type)}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            Caricato il {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}
                                                        </p>
                                                    </div>
                                                </div>

                                                {doc.expiry_date && (
                                                    <div className="mt-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getDocumentStatusColor(doc)}`}>
                              {doc.expired ? (
                                  <>
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Scaduto il {format(new Date(doc.expiry_date), 'dd/MM/yyyy')}
                                  </>
                              ) : doc.expiring_soon ? (
                                  <>
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Scade il {format(new Date(doc.expiry_date), 'dd/MM/yyyy')}
                                  </>
                              ) : (
                                  <>
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Valido fino al {format(new Date(doc.expiry_date), 'dd/MM/yyyy')}
                                  </>
                              )}
                            </span>
                                                    </div>
                                                )}

                                                {doc.notes && (
                                                    <p className="mt-2 text-sm text-gray-600">{doc.notes}</p>
                                                )}
                                            </div>

                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => handleDocumentDownload(doc.id, doc.title)}
                                                    className="text-blue-600 hover:text-blue-700"
                                                    title="Scarica"
                                                >
                                                    <Download className="h-5 w-5" />
                                                </button>

                                                {canUploadDocuments() && (
                                                    <button
                                                        onClick={() => handleDocumentDelete(doc.id)}
                                                        className="text-red-600 hover:text-red-700"
                                                        title="Elimina"
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'groups' && (
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Gruppi</h3>
                    {athlete.groups && athlete.groups.length > 0 ? (
                        <div className="space-y-4">
                            {athlete.groups.map((group) => (
                                <div key={group.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">{group.name}</h4>
                                        {group.description && (
                                            <p className="text-sm text-gray-500">{group.description}</p>
                                        )}
                                        {group.age_group && (
                                            <p className="text-xs text-gray-400">Categoria: {group.age_group}</p>
                                        )}
                                        <p className="text-xs text-gray-400">
                                            Iscritto il {format(new Date(group.joined_date), 'dd/MM/yyyy')}
                                        </p>
                                    </div>
                                    <div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        group.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}>
                      {group.is_active ? 'Attivo' : 'Inattivo'}
                    </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Users className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun gruppo</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                L'atleta non è iscritto a nessun gruppo
                            </p>
                        </div>
                    )}
                </div>
            )}

            {showUploadForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        {uploadingDocument ? (
                            <div className="p-6">
                                <LoadingSpinner size="medium" text="Caricamento documento..." />
                            </div>
                        ) : (
                            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
                                <h3 className="text-lg font-medium text-gray-900">Carica Documento</h3>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo documento</label>
                                    <select
                                        value={uploadForm.documentType}
                                        onChange={(e) => handleUploadFormChange('documentType', e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
                                    >
                                        <option value="payment">Attestazione di Pagamento</option>
                                        <option value="medical_certificate">Certificato Medico</option>
                                        <option value="other">Altro Documento</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Titolo</label>
                                    <input
                                        type="text"
                                        value={uploadForm.title}
                                        onChange={(e) => handleUploadFormChange('title', e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
                                        placeholder="Titolo del documento"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Stagione</label>
                                    <select
                                        value={uploadForm.seasonId}
                                        onChange={(e) => handleUploadFormChange('seasonId', e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
                                    >
                                        <option value="">Nessuna stagione</option>
                                        {seasons.map((season) => (
                                            <option key={season.id} value={season.id}>
                                                {season.name}{season.is_current ? ' (corrente)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Data di scadenza</label>
                                    <input
                                        type="date"
                                        value={uploadForm.expiryDate}
                                        onChange={(e) => handleUploadFormChange('expiryDate', e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                                    <div className="flex flex-col space-y-2">
                                        <label className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                                            <Upload className="h-4 w-4 mr-2" />
                                            Scegli file
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="application/pdf,image/*"
                                                onChange={handleUploadFileSelected}
                                            />
                                        </label>
                                        <label className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                                            <Upload className="h-4 w-4 mr-2" />
                                            Scatta foto
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                capture="environment"
                                                onChange={handleUploadFileSelected}
                                            />
                                        </label>
                                        {uploadForm.file && (
                                            <p className="text-xs text-gray-500">File selezionato: {uploadForm.file.name}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end space-x-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={closeUploadForm}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Annulla
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                    >
                                        Carica
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AthleteDetail;
