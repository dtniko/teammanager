// Verifica e applicazione di una nuova versione del service worker.
//
// File autonomo: non dipende da serviceWorker.js (che gestisce registro,
// banner e prompt di installazione) — usa solo l'API serviceWorker del
// browser. Il SW dell'app fa skipWaiting() + clients.claim(), quindi la
// nuova versione si attiva da sola appena installata: "applicare
// l'aggiornamento" significa semplicemente ricaricare la pagina.

const UPDATE_TIMEOUT_MS = 15000;

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Verifica se c'è una nuova versione dell'app disponibile.
// Restituisce:
//   'up-to-date'       — nessuna nuova versione (oppure update() ha
//                        scoccato il timeout: nessun nuovo deploy, non
//                        lanciamo errori)
//   'update-available' — è già installato un nuovo SW in attesa
//                        (reg.waiting o updatefound dopo reg.update())
//   'unsupported'      — il browser non supporta i service worker o non
//                        c'è alcun SW registrato
export async function checkForSWUpdate() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return 'unsupported';
    }

    let reg;
    try {
        reg = await navigator.serviceWorker.getRegistration();
    } catch (e) {
        return 'unsupported';
    }
    if (!reg) return 'unsupported';

    // Un aggiornamento in attesa è già noto (es. updatefound già scattato
    // dal flusso normale di update): niente altro da fare.
    if (reg.waiting) return 'update-available';

    let found = false;
    const onUpdateFound = () => { found = true; };
    reg.addEventListener('updatefound', onUpdateFound);

    try {
        // Se update() non risolve entro il timeout consideriamo
        // 'up-to-date' (nessun nuovo deploy) senza lanciare errori.
        await Promise.race([
            Promise.resolve(reg.update()).catch(() => {}),
            timeout(UPDATE_TIMEOUT_MS)
        ]);
    } finally {
        reg.removeEventListener('updatefound', onUpdateFound);
    }

    return found || reg.waiting ? 'update-available' : 'up-to-date';
}

// Applica l'aggiornamento: il nuovo SW è già attivo (skipWaiting + claim),
// basta ricaricare la pagina.
export function applySWUpdate() {
    window.location.reload();
}