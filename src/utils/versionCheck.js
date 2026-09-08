import apiService from '../services/apiService';

// Versione del deployment corrente dal backend (null se offline/errore)
export async function fetchServerVersion() {
    try {
        const data = await apiService.version();
        return data && typeof data.version === 'string' ? data.version : null;
    } catch {
        return null;
    }
}

// true se l'ultima versione registrata in localStorage (al load precedente)
// differisce da quella baked nel bundle corrente. null = non valutabile
// (prima volta, o build 'dev' locale).
export function isUpdateAvailable() {
    if (!window.__BUILD_VERSION__ || window.__BUILD_VERSION__ === 'dev') return null;
    const stored = localStorage.getItem('app_version');
    if (!stored) return null;
    return stored !== window.__BUILD_VERSION__;
}

// Registra la versione corrente per il confronto al login successivo
export function recordVersion() {
    if (!window.__BUILD_VERSION__ || window.__BUILD_VERSION__ === 'dev') return;
    localStorage.setItem('app_version', window.__BUILD_VERSION__);
}