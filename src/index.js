import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { registerServiceWorker } from './utils/serviceWorker';

// Performance monitoring (opzionale)
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// Registra il service worker per PWA
registerServiceWorker();

// Funzione per inviare metriche di performance a un servizio di analytics
function sendToAnalytics(metric) {
    // Sostituisci con il tuo servizio di analytics preferito
    // Ad esempio: Google Analytics, PostHog, etc.
    console.log('Performance metric:', metric);

    // Esempio con Google Analytics
    if (window.gtag) {
        window.gtag('event', metric.name, {
            event_category: 'Web Vitals',
            event_label: metric.id,
            value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
            non_interaction: true,
        });
    }
}

// Misura le metriche Core Web Vitals
getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);

// Error boundary globale per catturare errori non gestiti
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);

    // Invia errore a servizio di monitoring
    if (window.Sentry) {
        window.Sentry.captureException(event.error);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);

    // Invia errore a servizio di monitoring
    if (window.Sentry) {
        window.Sentry.captureException(event.reason);
    }
});

// Gestione stato offline/online per PWA
window.addEventListener('online', () => {
    console.log('🌐 Connessione ristabilita');
    // Puoi mostrare una notifica o aggiornare l'UI
});

window.addEventListener('offline', () => {
    console.log('📡 Connessione persa - modalità offline');
    // Puoi mostrare una notifica o aggiornare l'UI
});

// Gestione installazione PWA
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Previeni il prompt automatico
    e.preventDefault();
    // Salva l'evento per poterlo triggerare successivamente
    deferredPrompt = e;

    // Opzionalmente, mostra il tuo pulsante di installazione personalizzato
    const installButton = document.getElementById('pwa-install-button');
    if (installButton) {
        installButton.style.display = 'block';

        installButton.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`🎯 PWA install prompt: ${outcome}`);
                deferredPrompt = null;
                installButton.style.display = 'none';
            }
        });
    }
});

window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installata con successo');
    deferredPrompt = null;

    const installButton = document.getElementById('pwa-install-button');
    if (installButton) {
        installButton.style.display = 'none';
    }

    // Opzionalmente, mostra un messaggio di ringraziamento
    // o traccia l'evento in analytics
});

// Gestione aggiornamenti dell'app
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Un nuovo service worker ha preso il controllo
        console.log('🔄 Nuovo service worker attivo');

        // Opzionalmente, ricarica la pagina o mostra una notifica
        if (confirm('È disponibile una nuova versione dell\'app. Vuoi ricaricare?')) {
            window.location.reload();
        }
    });
}

// Utility per debug in development
if (process.env.NODE_ENV === 'development') {
    // Aggiungi utilità di debug globali
    window.DEBUG = {
        // Forza un errore per testare error boundary
        throwError: () => {
            throw new Error('Test error per debugging');
        },

        // Simula perdita di connessione
        goOffline: () => {
            window.navigator.onLine = false;
            window.dispatchEvent(new Event('offline'));
        },

        // Simula ripristino connessione
        goOnline: () => {
            window.navigator.onLine = true;
            window.dispatchEvent(new Event('online'));
        },

        // Pulisci localStorage
        clearStorage: () => {
            localStorage.clear();
            sessionStorage.clear();
            console.log('🧹 Storage pulito');
        },

        // Mostra informazioni PWA
        pwaInfo: () => {
            console.log('📱 PWA Info:', {
                isStandalone: window.matchMedia('(display-mode: standalone)').matches,
                isInstalled: window.navigator.standalone === true,
                serviceWorkerSupported: 'serviceWorker' in navigator,
                pushSupported: 'PushManager' in window,
                notificationSupported: 'Notification' in window
            });
        }
    };

    console.log('🔧 Debug utilities available at window.DEBUG');
}

// Prevenzione del menu contestuale in produzione (opzionale)
if (process.env.NODE_ENV === 'production') {
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Previeni alcune combinazioni di tasti
    document.addEventListener('keydown', (e) => {
        // Disabilita F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
        if (e.keyCode === 123 ||
            (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) ||
            (e.ctrlKey && e.keyCode === 85)) {
            e.preventDefault();
        }
    });
}

// Gestione della visibilità della pagina (per pause/resume)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('📱 App nascosta');
        // Pausa operazioni non critiche, sincronizzazioni, etc.
    } else {
        console.log('📱 App visibile');
        // Riprendi operazioni, controlla aggiornamenti, etc.
    }
});

// Gestione orientamento schermo per mobile
window.addEventListener('orientationchange', () => {
    console.log('📱 Orientamento cambiato:', window.orientation);

    // Opzionalmente, adatta l'UI all'orientamento
    setTimeout(() => {
        // Piccolo delay per permettere al browser di aggiornare le dimensioni
        window.dispatchEvent(new Event('resize'));
    }, 100);
});

// Prevenzione dello zoom con pinch (opzionale per PWA)
document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
});

document.addEventListener('gesturechange', (e) => {
    e.preventDefault();
});

document.addEventListener('gestureend', (e) => {
    e.preventDefault();
});

// Gestione del focus per accessibilità
let isTabbing = false;

window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        isTabbing = true;
        document.body.classList.add('user-is-tabbing');
    }
});

window.addEventListener('mousedown', () => {
    isTabbing = false;
    document.body.classList.remove('user-is-tabbing');
});

// Performance observer per monitorare le performance
if ('PerformanceObserver' in window) {
    // Osserva i Long Tasks
    try {
        const longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                console.warn('⚠️ Long task detected:', entry.duration + 'ms');

                // Invia a servizio di monitoring
                sendToAnalytics({
                    name: 'longtask',
                    value: entry.duration,
                    id: 'lt-' + Date.now()
                });
            }
        });

        longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (e) {
        // Long tasks non supportati
    }

    // Osserva i Layout Shifts
    try {
        const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                    console.warn('⚠️ Layout shift detected:', entry.value);
                }
            }
        });

        clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
        // Layout shift non supportato
    }
}

// Console message in produzione
if (process.env.NODE_ENV === 'production') {
    console.log('%c🏆 SportClub Manager', 'color: #2563eb; font-size: 24px; font-weight: bold;');
    console.log('%cGestionale per società sportive - Made with ❤️', 'color: #6b7280; font-size: 14px;');
    console.log('%c⚠️ ATTENZIONE: Questa è una console per sviluppatori. Non inserire codice sconosciuto.', 'color: #dc2626; font-size: 12px; font-weight: bold;');
}
