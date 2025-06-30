// Utility per gestire il service worker e le notifiche push

const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(
        /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
        if (publicUrl.origin !== window.location.origin) {
            return;
        }

        window.addEventListener('load', () => {
            const swUrl = `${process.env.PUBLIC_URL}/sw.js`;

            if (isLocalhost) {
                checkValidServiceWorker(swUrl);
                navigator.serviceWorker.ready.then(() => {
                    console.log('🔧 Service Worker pronto in localhost');
                });
            } else {
                registerValidSW(swUrl);
            }
        });
    }
}

function registerValidSW(swUrl) {
    navigator.serviceWorker
        .register(swUrl)
        .then(registration => {
            console.log('✅ Service Worker registrato:', registration);

            registration.addEventListener('updatefound', () => {
                const installingWorker = registration.installing;
                if (installingWorker == null) {
                    return;
                }

                installingWorker.addEventListener('statechange', () => {
                    if (installingWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            console.log('🔄 Nuovo contenuto disponibile, aggiorna la pagina');
                            showUpdateAvailableNotification();
                        } else {
                            console.log('✅ Contenuto cached per uso offline');
                        }
                    }
                });
            });
        })
        .catch(error => {
            console.error('❌ Errore registrazione Service Worker:', error);
        });
}

function checkValidServiceWorker(swUrl) {
    fetch(swUrl, {
        headers: { 'Service-Worker': 'script' },
    })
        .then(response => {
            const contentType = response.headers.get('content-type');
            if (
                response.status === 404 ||
                (contentType != null && contentType.indexOf('javascript') === -1)
            ) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.unregister().then(() => {
                        window.location.reload();
                    });
                });
            } else {
                registerValidSW(swUrl);
            }
        })
        .catch(() => {
            console.log('📱 App in modalità offline');
        });
}

export function unregisterServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
            .then(registration => {
                registration.unregister();
            })
            .catch(error => {
                console.error('❌ Errore nell\'unregister del Service Worker:', error);
            });
    }
}

// Mostra notifica di aggiornamento disponibile
function showUpdateAvailableNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Aggiornamento Disponibile', {
            body: 'Una nuova versione dell\'app è disponibile. Ricarica la pagina per aggiornare.',
            icon: '/logo192.png',
            tag: 'app-update'
        });
    }

    // Opzionalmente, potresti anche mostrare un banner nell'app
    showUpdateBanner();
}

// Mostra banner per aggiornamento
function showUpdateBanner() {
    // Crea un banner per informare l'utente dell'aggiornamento
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.className = 'fixed top-0 left-0 right-0 bg-blue-600 text-white text-center py-2 z-50';
    banner.innerHTML = `
    <div class="flex items-center justify-center space-x-4">
      <span>🔄 Nuova versione disponibile</span>
      <button id="update-btn" class="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-sm">
        Aggiorna ora
      </button>
      <button id="dismiss-btn" class="text-blue-200 hover:text-white text-sm">
        ✕
      </button>
    </div>
  `;

    document.body.appendChild(banner);

    // Event listeners
    document.getElementById('update-btn').addEventListener('click', () => {
        window.location.reload();
    });

    document.getElementById('dismiss-btn').addEventListener('click', () => {
        banner.remove();
    });

    // Auto-rimuovi dopo 10 secondi
    setTimeout(() => {
        if (document.getElementById('update-banner')) {
            banner.remove();
        }
    }, 10000);
}

// Gestione notifiche push
export class PushNotificationManager {
    constructor() {
        this.vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
    }

    // Controlla supporto notifiche
    isSupported() {
        return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }

    // Richiedi permessi
    async requestPermission() {
        if (!this.isSupported()) {
            throw new Error('Push notifications non supportate');
        }

        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    // Ottieni subscription
    async getSubscription() {
        if (!this.isSupported()) {
            return null;
        }

        const registration = await navigator.serviceWorker.ready;
        return await registration.pushManager.getSubscription();
    }

    // Sottoscrivi alle notifiche push
    async subscribe() {
        if (!this.vapidPublicKey) {
            console.warn('⚠️ VAPID public key non configurata');
            return null;
        }

        const hasPermission = await this.requestPermission();
        if (!hasPermission) {
            throw new Error('Permesso notifiche negato');
        }

        const registration = await navigator.serviceWorker.ready;

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
        });

        console.log('📱 Push subscription creata:', subscription);
        return subscription;
    }

    // Annulla sottoscrizione
    async unsubscribe() {
        const subscription = await this.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            console.log('📱 Push subscription rimossa');
            return true;
        }
        return false;
    }

    // Utility per convertire VAPID key
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    // Mostra notifica locale
    showLocalNotification(title, options = {}) {
        if ('Notification' in window && Notification.permission === 'granted') {
            return new Notification(title, {
                icon: '/logo192.png',
                badge: '/logo192.png',
                ...options
            });
        }
        return null;
    }
}

// Gestione installazione PWA
export class PWAInstallManager {
    constructor() {
        this.deferredPrompt = null;
        this.setupInstallPrompt();
    }

    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('📱 PWA installabile');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA installata');
            this.deferredPrompt = null;
            this.hideInstallButton();
        });
    }

    // Mostra pulsante di installazione
    showInstallButton() {
        const installButton = document.getElementById('pwa-install-button');
        if (installButton) {
            installButton.style.display = 'block';
            installButton.addEventListener('click', this.promptInstall.bind(this));
        } else {
            // Crea dinamicamente il pulsante se non esiste
            this.createInstallButton();
        }
    }

    // Nascondi pulsante di installazione
    hideInstallButton() {
        const installButton = document.getElementById('pwa-install-button');
        if (installButton) {
            installButton.style.display = 'none';
        }
    }

    // Crea pulsante di installazione
    createInstallButton() {
        const button = document.createElement('button');
        button.id = 'pwa-install-button';
        button.className = 'fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center space-x-2';
        button.innerHTML = `
      <span>📱</span>
      <span>Installa App</span>
    `;

        button.addEventListener('click', this.promptInstall.bind(this));
        document.body.appendChild(button);
    }

    // Avvia installazione
    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('⚠️ Prompt di installazione non disponibile');
            return;
        }

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;

        console.log(`🎯 Risultato installazione: ${outcome}`);
        this.deferredPrompt = null;
    }

    // Controlla se l'app è già installata
    isInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;
    }
}

// Gestione stato online/offline
export class NetworkManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.callbacks = {
            online: [],
            offline: []
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Connessione ripristinata');
            this.callbacks.online.forEach(callback => callback());
            this.hideOfflineBanner();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📡 Connessione persa');
            this.callbacks.offline.forEach(callback => callback());
            this.showOfflineBanner();
        });
    }

    // Aggiungi listener per eventi di rete
    addEventListener(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    // Rimuovi listener
    removeEventListener(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        }
    }

    // Mostra banner offline
    showOfflineBanner() {
        if (document.getElementById('offline-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.className = 'fixed top-0 left-0 right-0 bg-yellow-600 text-white text-center py-2 z-50';
        banner.innerHTML = `
      <div class="flex items-center justify-center space-x-2">
        <span>📡</span>
        <span>Modalità offline - Alcune funzionalità potrebbero non essere disponibili</span>
      </div>
    `;

        document.body.appendChild(banner);
    }

    // Nascondi banner offline
    hideOfflineBanner() {
        const banner = document.getElementById('offline-banner');
        if (banner) {
            banner.remove();
        }
    }

    // Controlla stato connessione
    checkConnection() {
        return this.isOnline;
    }
}

// Esporta istanze singleton
export const pushManager = new PushNotificationManager();
export const installManager = new PWAInstallManager();
export const networkManager = new NetworkManager();
