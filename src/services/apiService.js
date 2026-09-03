import axios from 'axios';

class ApiService {
    constructor() {
        this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Interceptor per gestire errori globalmente
        this.client.interceptors.response.use(
            (response) => response.data,
            (error) => {
                console.error('API Error:', error);

                const isAuthEndpoint = error.config?.url?.startsWith('/auth/login')
                    || error.config?.url?.startsWith('/auth/google');

                if (error.response?.status === 401 && !isAuthEndpoint) {
                    // Token scaduto o non valido (non un tentativo di login fallito)
                    this.handleUnauthorized();
                }

                return Promise.reject(error.response?.data || error);
            }
        );
    }

    // Imposta token di autorizzazione
    setAuthToken(token) {
        if (token) {
            this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete this.client.defaults.headers.common['Authorization'];
        }
    }

    // Gestisce errori di autorizzazione
    handleUnauthorized() {
        localStorage.removeItem('sportclub_token');
        delete this.client.defaults.headers.common['Authorization'];
        window.location.href = '/';
    }

    // === AUTH ENDPOINTS ===

    async loginWithGoogle(googleToken) {
        return this.client.post('/auth/google', { googleToken });
    }

    async login(email, password) {
        return this.client.post('/auth/login', { email, password });
    }

    async changePassword(currentPassword, newPassword) {
        return this.client.post('/auth/change-password', { currentPassword, newPassword });
    }

    async verifyToken() {
        return this.client.get('/auth/verify');
    }

    async logout() {
        return this.client.post('/auth/logout');
    }

    async refreshToken() {
        return this.client.post('/auth/refresh');
    }

    // === USER ENDPOINTS ===

    async getUserProfile() {
        return this.client.get('/users/profile');
    }

    async updateProfile(profileData) {
        return this.client.put('/users/profile', profileData);
    }

    async updateSelfProfile(profileData) {
        return this.client.put('/athletes/self', profileData);
    }

    async getUsers(params = {}) {
        return this.client.get('/users', { params });
    }

    async createUser(userData) {
        return this.client.post('/users', userData);
    }

    async getUserById(userId) {
        return this.client.get(`/users/${userId}`);
    }

    async updateUserRole(userId, role) {
        return this.client.patch(`/users/${userId}/role`, { role });
    }

    async updateUserStatus(userId, isActive) {
        return this.client.patch(`/users/${userId}/status`, { isActive });
    }

    async deleteUser(userId) {
        return this.client.delete(`/users/${userId}`);
    }

    async searchUsersByEmail(email) {
        return this.client.get('/users/search/email', { params: { email } });
    }

    async getUserStats() {
        return this.client.get('/users/stats/overview');
    }

    // === ATHLETE ENDPOINTS ===

    async getAthletes(params = {}) {
        return this.client.get('/athletes', { params });
    }

    async getMyAthletes() {
        return this.client.get('/athletes/my-athletes');
    }

    async getAthleteById(athleteId) {
        return this.client.get(`/athletes/${athleteId}`);
    }

    async createAthlete(athleteData) {
        return this.client.post('/athletes', athleteData);
    }

    async updateAthlete(athleteId, athleteData) {
        return this.client.put(`/athletes/${athleteId}`, athleteData);
    }

    async deleteAthlete(athleteId) {
        return this.client.delete(`/athletes/${athleteId}`);
    }

    async updateParentAthlete(athleteId, data) {
        return this.client.put(`/athletes/${athleteId}/self`, data);
    }

    // === ONBOARDING ENDPOINTS ===

    async getOnboardingStatus() {
        return this.client.get('/onboarding/status');
    }

    async getAvailableAthletes(context, search = '') {
        return this.client.get('/onboarding/available-athletes', { params: { context, search } });
    }

    async linkExistingProfile(athleteId, context, relationship) {
        return this.client.post('/onboarding/link-existing', { athleteId, context, relationship });
    }

    async createOnboardingProfile(context, relationship, athleteData) {
        return this.client.post('/onboarding/create-profile', { context, relationship, athleteData });
    }

    async getPendingOnboardingRequests() {
        return this.client.get('/onboarding/pending-requests');
    }

    async getUnifiedPendingRequests() {
        return this.client.get('/onboarding/unified-pending-requests');
    }

    async approveOnboardingRequest(requestId) {
        return this.client.post(`/onboarding/requests/${requestId}/approve`);
    }

    async rejectOnboardingRequest(requestId, reason) {
        return this.client.post(`/onboarding/requests/${requestId}/reject`, { reason });
    }

    // Role Change
    async requestRoleChange(requestedRole, reason) {
        return this.client.post('/onboarding/role-change', { requestedRole, reason });
    }

    async getRoleChangeRequests() {
        return this.client.get('/onboarding/role-change/requests');
    }

    async approveRoleChange(requestId) {
        return this.client.post(`/onboarding/role-change/${requestId}/approve`);
    }

    async rejectRoleChange(requestId) {
        return this.client.post(`/onboarding/role-change/${requestId}/reject`);
    }

    // === GROUP ENDPOINTS ===

    async getGroups(params = {}) {
        return this.client.get('/groups', { params });
    }

    async getGroupById(groupId) {
        return this.client.get(`/groups/${groupId}`);
    }

    async createGroup(groupData) {
        return this.client.post('/groups', groupData);
    }

    async updateGroup(groupId, groupData) {
        return this.client.put(`/groups/${groupId}`, groupData);
    }

    async deleteGroup(groupId) {
        return this.client.delete(`/groups/${groupId}`);
    }

    async addAthleteToGroup(groupId, athleteId) {
        return this.client.post(`/groups/${groupId}/athletes`, { athleteId });
    }

    async removeAthleteFromGroup(groupId, athleteId) {
        return this.client.delete(`/groups/${groupId}/athletes/${athleteId}`);
    }

    async addStaffToGroup(groupId, userId, role, canManage) {
        return this.client.post(`/groups/${groupId}/staff`, { userId, role, canManage });
    }

    async removeStaffFromGroup(groupId, userId) {
        return this.client.delete(`/groups/${groupId}/staff/${userId}`);
    }

    // === SEASON ENDPOINTS ===

    async getSeasons() {
        return this.client.get('/seasons');
    }

    async createSeason(seasonData) {
        return this.client.post('/seasons', seasonData);
    }

    async setCurrentSeason(seasonId) {
        return this.client.patch(`/seasons/${seasonId}/set-current`);
    }

    async updateSeason(seasonId, seasonData) {
        return this.client.patch(`/seasons/${seasonId}`, seasonData);
    }

    // === EVENT ENDPOINTS ===

    async getEvents(params = {}) {
        return this.client.get('/events', { params });
    }

    async getEventById(eventId) {
        return this.client.get(`/events/${eventId}`);
    }

    async createEvent(eventData) {
        return this.client.post('/events', eventData);
    }

    async updateEvent(eventId, eventData) {
        return this.client.put(`/events/${eventId}`, eventData);
    }

    async deleteEvent(eventId) {
        return this.client.delete(`/events/${eventId}`);
    }

    async markAttendance(eventId, athleteId, status, notes = '') {
        return this.client.post(`/events/${eventId}/attendance`, {
            athleteId,
            status,
            notes
        });
    }

    async conveneGroup(eventId, athleteIds = null) {
        return this.client.post(`/events/${eventId}/convene`, athleteIds ? { athleteIds } : {});
    }

    async markActualAttendance(eventId, athleteId, actualStatus) {
        return this.client.post(`/events/${eventId}/actual-attendance`, { athleteId, actualStatus });
    }

    async getAttendanceSummary(params = {}) {
        return this.client.get('/events/reports/attendance-summary', { params });
    }

    // === DOCUMENT ENDPOINTS ===

    async getDocuments(athleteId, params = {}) {
        return this.client.get(`/documents/athlete/${athleteId}`, { params });
    }

    async uploadDocument(formData) {
        return this.client.post('/documents/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    }

    async downloadDocument(documentId) {
        return this.client.get(`/documents/download/${documentId}`, {
            responseType: 'blob',
        });
    }

    async deleteDocument(documentId) {
        return this.client.delete(`/documents/${documentId}`);
    }

    async getExpiringDocuments(days = 30) {
        return this.client.get('/documents/expiring', { params: { days } });
    }

    async updateDocumentValidity(documentId, isValid) {
        return this.client.patch(`/documents/${documentId}/validity`, { isValid });
    }

    // === COMMUNICATION ENDPOINTS ===

    async getCommunications(params = {}) {
        return this.client.get('/communications', { params });
    }

    async getCommunicationById(communicationId) {
        return this.client.get(`/communications/${communicationId}`);
    }

    async createCommunication(communicationData) {
        return this.client.post('/communications', communicationData);
    }

    async markCommunicationAsRead(communicationId) {
        return this.client.post(`/communications/${communicationId}/read`);
    }

    async markAllCommunicationsAsRead() {
        return this.client.post('/communications/mark-all-read');
    }

    async deleteCommunication(communicationId) {
        return this.client.delete(`/communications/${communicationId}`);
    }

    async getCommunicationStats(communicationId) {
        return this.client.get(`/communications/${communicationId}/stats`);
    }

    // === NOTIFICATION ENDPOINTS ===

    async getNotifications(params = {}) {
        return this.client.get('/notifications', { params });
    }

    async markNotificationAsRead(notificationId) {
        return this.client.patch(`/notifications/${notificationId}/read`);
    }

    async markAllNotificationsAsRead() {
        return this.client.patch('/notifications/mark-all-read');
    }

    async deleteNotification(notificationId) {
        return this.client.delete(`/notifications/${notificationId}`);
    }

    async deleteReadNotifications() {
        return this.client.delete('/notifications/read');
    }

    async sendSystemNotification(notificationData) {
        return this.client.post('/notifications/system', notificationData);
    }

    async savePushSubscription(subscription) {
        return this.client.post('/notifications/push-subscribe', subscription.toJSON());
    }

    async deletePushSubscription(endpoint) {
        return this.client.delete('/notifications/push-subscribe', { data: { endpoint } });
    }

    // === UTILITY METHODS ===

    // Upload generico di file
    async uploadFile(file, endpoint, additionalData = {}) {
        const formData = new FormData();
        formData.append('file', file);

        Object.keys(additionalData).forEach(key => {
            formData.append(key, additionalData[key]);
        });

        return this.client.post(endpoint, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    }

    // Download generico di file
    async downloadFile(url, filename) {
        try {
            const response = await this.client.get(url, {
                responseType: 'blob',
            });

            // Crea URL per il download
            const downloadUrl = window.URL.createObjectURL(new Blob([response]));
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            return { success: true };
        } catch (error) {
            console.error('Errore nel download del file:', error);
            return { success: false, error: error.message };
        }
    }

    // Controllo salute API
    async healthCheck() {
        return this.client.get('/health');
    }

    // === HELPER METHODS ===

    // Formatta parametri per query string
    formatParams(params) {
        const formatted = {};
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
                formatted[key] = params[key];
            }
        });
        return formatted;
    }

    // Gestisce errori di rete
    handleNetworkError(error) {
        if (!navigator.onLine) {
            return 'Connessione internet non disponibile';
        }

        if (error.code === 'ECONNABORTED') {
            return 'Richiesta scaduta, riprova più tardi';
        }

        return error.message || 'Errore di rete sconosciuto';
    }

    // === CACHE METHODS (per ottimizzazioni future) ===

    // Cache semplice in memoria
    cache = new Map();

    async getCached(key, fetcher, ttl = 300000) { // 5 minuti default
        const cached = this.cache.get(key);

        if (cached && Date.now() - cached.timestamp < ttl) {
            return cached.data;
        }

        const data = await fetcher();
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });

        return data;
    }

    clearCache(key) {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }
}

// Crea e esporta istanza singleton
const apiService = new ApiService();
export default apiService;
