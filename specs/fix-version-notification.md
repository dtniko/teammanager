# Fix: notifica "nuova versione" ripetuta / false positive al primo visitatore

## Problema
1. `src/index.js` (listener `controllerchange`, solo production): al **primo** install lo SW passa da null → controller (per `skipWaiting` + `clients.claim()` in `public/sw.js`), fa scattare `controllerchange` e mostra `window.confirm('È disponibile una nuova versione…')` + reload a un utente che non ha mai avuto una versione.
2. Per ogni update reale partono **tre segnali** insieme: Web Notification + banner `#update-banner` (via `updatefound`, in `src/utils/serviceWorker.js`) E il `confirm` (via `controllerchange`, in `src/index.js`).
3. `showUpdateBanner()` in `src/utils/serviceWorker.js` non è idempotente: chiamate multiple creano banner duplicati (a differenza del banner offline che fa il check di esistenza).
4. Nessun flag di versione memorizzato: niente dedup tra visite.

## Cambiamenti richiesti

### A. `src/utils/serviceWorker.js`
- Introdurre in localStorage un flag di dedup, es. `sw_last_notified_version`. La "versione" da confrontare è il nome della cache SW (es. `sportclub-manager-v3` in `public/sw.js`) — ma la pagina non lo conosce direttamente. Soluzione: in `registerValidSW`/`updatefound`, quando si notifica, leggere la versione dal **content-script non è possibile**, quindi usare come identificativo lo script URL + un fetch leggero di `sw.js`? **No — soluzione più semplice e robusta**: il nome cache è hardcoded in `sw.js`; la pagina può leggere la versione con un `fetch('/sw.js')` + regex su `CACHE_NAME`, ma è fragile. **Adottare invece questo approccio**: in `public/sw.js`, alla fine di `activate`, inviare ai clients un `postMessage({ type: 'sw-activated', version: CACHE_NAME })`. La pagina (in `serviceWorker.js`) ascolta `navigator.serviceWorker.onmessage` e salva `version` in `localStorage['sw_last_version']`. Questo dà alla pagina la versione SW installata con affidabilità, senza parsing HTTP.
- `showUpdateAvailableNotification()` (funzione che fa Web Notification + banner):
  - prima di mostrare, leggere `localStorage['sw_last_version']`; se esiste ed è **uguale** alla versione appena attivata ricevuta via message, **non** notificare (già notificata).
  - nota: l'ordine di attivazione può essere *updatefound → install → skipWaiting → controllerchange → activate → postMessage*. La Web Notification scatta su `updatefound` **prima** che la versione nuova sia conosciuta. Quindi: sulla notifica via `updatefound` si può fare il dedup solo se si ha già ricevuto il message con versione nuova — non possibile. **Pertanto il dedup su `updatefound` va fatto così**: se `navigator.serviceWorker.controller` è presente e il nuovo SW installato non è ancora attivato, notifica UNA sola volta per sessione: usa un flag di modulo-scoped `let notifiedThisSession = false` (resiste ai re-render, si resetta al reload) INVECE del solo `tag` della Notification. Mantieni comunque `tag: 'app-update'` (dedup a livello OS).
  - `showUpdateBanner()`: aggiungi `if (document.getElementById('update-banner')) return;` all'inizio.
  - Listener `onmessage`: al ricevere `{ type: 'sw-activated', version }` salva `localStorage['sw_last_version'] = version`. Se l'utente ha già il banner/la notifica aperta e la versione è quella nuova, non cambiare nulla (l'utente deve cliccare "Aggiorna" e reloadare; `skipWaiting`+`claim` in `sw.js` restano come sono: il reload avviene solo su richiesta utente tramite il banner/notifica, come già previsto dal codice esistente).

### B. `public/sw.js`
- Alla fine del handler `activate` (dopo `clients.claim()`), aggiungere:
  ```js
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: 'sw-activated', version: CACHE_NAME }));
  ```
  (adattarsi allo stile esistente del file; usare `CACHE_NAME` o la costante che il file usa).

### C. `src/index.js`
- Nel listener `controllerchange` (blocco production, ~righe 93-103):
  - **rimuovere** il `window.confirm` + reload automatico.
  - Sostituire con: se esiste già un meccanismo di banner/notifica attivo (il `serviceWorker.js` gestisce `updatefound` e mostra banner+notification con pulsante "Aggiorna"), non duplicare: basta un log di debug `console.info('Service worker aggiornato, controller attivo')`. In alternativa, se si vuole mantenere un segnale immediato, delegare a `showUpdateAvailableNotification`? **No** — non è esportato e il flusso `updatefound` lo copre già. Rimuovere il confirm, lasciare solo il log.
  - **Esclusione primo install**: anche il log deve distinguere il primo install: in un `let hadController = !!navigator.serviceWorker.controller` letto una tantum al boot (modulo-scoped) del blocco production; al `controllerchange`, se `hadController === false` → è il primo install, solo log "primo install SW", nessun messaggio all'utente; poi `hadController = true`.

## D. Voce menu "Verifica aggiornamenti" (NUOVA — implementata in un secondo passo, in file separati)

Nuovo file `src/utils/swUpdateCheck.js` (NON toccare `src/utils/serviceWorker.js` in questo passo):
```js
// API da esportare:
export async function checkForSWUpdate(): Promise<'up-to-date' | 'update-available' | 'unsupported'>
export function applySWUpdate(): void  // window.location.reload()
```
Logica di `checkForSWUpdate`:
- se `'serviceWorker' in navigator` è false → `'unsupported'`.
- `const reg = await navigator.serviceWorker.getRegistration();` se null → `'unsupported'`.
- se `reg.waiting` esiste → `'update-available'` (un update è già stato rilevato e sta aspettando).
- altrimenti: chiamare `reg.update()`; se la promise risolve e compare un nuovo SW (ascoltare `updatefound` / verificare `reg.waiting` dopo) → `'update-available'`, altrimenti → `'up-to-date'`. Gestire timeout di ~15s: se `update()` non risolve entro, considerare `'up-to-date'` (nessun nuovo deploy) ma non lanciare errori.
- Nota: il nostro SW usa `skipWaiting()` + `clients.claim()` (vedi `public/sw.js`), quindi il nuovo SW si attiva da solo: l'"applica aggiornamento" = semplice reload della pagina.

`src/components/Layout/Layout.js` — **dropdown utente dell'header** (righe ~332-403), NON la sidebar (che ha solo voci di navigazione). Punto esatto: dopo "Installa app sul dispositivo" (~riga 377) e prima di "Attiva notifiche push" (~riga 379). Il dropdown è identico su desktop e mobile (avatar sempre nell'header) → un solo punto di inserimento. Pattern delle voci: `<button onClick={() => { setUserMenuOpen(false); ... }}>` + icona lucide `mr-3 h-4 w-4` + feedback via `toast` (vedi `handleInstallClick`/`handlePushClick` ~155-189).
- Nuova voce "Verifica aggiornamenti" con icona lucide coerente (es. `RefreshCw` / `CheckCircle`).
- Al click: mostra stato "verifica in corso" (spinner o testo), poi il risultato:
  - `up-to-date` / `unsupported` → messaggio "Sei già all'ultima versione" (per `unsupported` meglio "Aggiornamenti non disponibili in questo browser", ma solo in dev/no-sw; in production lo SW c'è sempre).
  - `update-available` → chiede "È disponibile una nuova versione. Vuoi aggiornare ora?" con azione conferma → `applySWUpdate()` (reload) e annulla.
- UI: usare il pattern di conferma già esistente nell'app (modale o alert — da verificare nel codebase; se non c'è un componente modale riutilizzabile, usare un piccolo inline panel nello stesso menu con i due bottoni, stile coerente con l'app).
- Stato React della verifica (idle | checking | up-to-date | update-available) in un hook locale o direttamente nel componente che ospita la voce menu.

## Vincoli
- Non toccare `public/sw.js` nella strategia di precache/network-first e non cambiare il nome della cache (niente bump).
- Non modificare `src/hooks/usePWAInstall.js` né `PWAInstallCard.js` (riguardano solo l'install prompt).
- Mantenere il codice in stile con l'file esistente (stesso pattern di banner imperativo già presente per il banner offline).
- Il pulsante "Aggiorna" del banner deve continuare a fare reload (comportamento esistente).

## Verifica
- `npx react-scripts build` (o comunque il comando di build del progetto) senza errori.
- Controllo statico: grep che `window.confirm('È disponibile una nuova versione` non compaia più in `src/index.js`.
- Leggere i tre file modificati e verificare coerenza del flusso: primo install → solo log, nessun prompt; update reale → 1 notifica OS (tag dedup) + 1 banner (idempotente) + version salvata in localStorage via onmessage.