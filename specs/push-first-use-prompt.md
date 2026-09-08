# Prompt push al primo utilizzo + status endpoint push

## Contesto
- Il toast "Notifiche push non configurate dal server" nasce client-side (`src/contexts/NotificationContext.js:175-179` → `'no-vapid'`, toast in `Layout.js:193-194`) quando `REACT_APP_VAPID_PUBLIC_KEY` (baked a build-time) è vuoto. Probabile causa osservata: dev server locale avviato prima che le chiavi entrassero nel `.env` (CRA non rilegge .env a runtime). Messaggio comunque fuorviante: dice "dal server" ma verifica il bundle.
- Su Cloud Run le env VAPID *sono* configurate (secret `vapid-*`), il bundle prod *contiene* la chiave pubblica.
- Richiesta utente: (1) rendere affidabile il check "push disponibile" chiedendo al **server** lo stato reale; (2) all'apertura per la prima volta / primo login e dopo l'install PWA, chiedere di attivare le notifiche push.

## Cambiamenti

### A. `server/services/webPush.js`
- Esportare la configurazione: in `module.exports` aggiungere `isVapidConfigured: () => vapidConfigured` (la flag già esiste a riga ~22).

### B. `server/routes/notifications.js`
- Nuovo endpoint `GET /push-status` (stesso router, mounted a `/api/notifications`): senza auth (come gli altri endpoint GET leggeri, seguire il pattern esistente del file; se tutti gli altri richiedono auth, valutare: meglio SENO auth perché usato dal modal pre-attivazione — ma il modal è post-login comunque, quindi va bene anche SE c'è il middleware auth: usare lo stesso middleware degli altri GET del file per coerenza).
- Risposta: `{ enabled: isVapidConfigured() }` (JSON 200). Nessuna query al DB.

### C. `src/services/apiService.js`
- Metodo `getPushStatus()` che chiama `GET /notifications/push-status` e restituisce la risposta (stesso stile degli altri metodi del file).

### D. `src/components/Layout/Layout.js` (tutte le modifiche UI qui)
1. **Correzione messaggio** `handlePushClick`, caso `'no-vapid'`: testo toast → `"Notifiche push non disponibili su questa versione dell'app"`.
2. **Modal "Attiva le notifiche push" al primo utilizzo**:
   - Stato `const [showPushPrompt, setShowPushPrompt] = useState(false)`.
   - `useEffect` (dipendenze: `isPushEnabled`, id utente): se `isPushEnabled` → nothing. Se `localStorage.getItem('push_prompt_shown')` → nothing. Se `Notification.permission === 'denied'` → nothing. Se `!('PushManager' in window)` → nothing (es. Safari non-PWA: nessun web push, non disturbare). Altrimenti: `setTimeout` ~2000ms → `apiService.getPushStatus()`; se `enabled === true` → `setShowPushPrompt(true)`; se la chiamata fallisce → nessun modal (silenzioso). Cleanup: cancellare il timeout.
   - Modal (stesso pattern visivo del modal `showInstallHelp` già presente nel file, ~riga 501): titolo "Attiva le notifiche push", icona `Bell`, testo: "Ricevi avvisi su allenamenti, partite e aggiornamenti direttamente sul tuo dispositivo." Bottoni: **"Attiva"** (primario, blu, stile "Chiuso" del modal install) e **"Più tardi"** (secondario/grigio).
   - "Attiva": `await activatePushNotifications()` → toast a secondo dell'esito (stessa mappatura di `handlePushClick`, riusare la logica in una funzione locale comune se comoda) → `localStorage.setItem('push_prompt_shown', '1')` → `setShowPushPrompt(false)`.
   - "Più tardi": `localStorage.setItem('push_prompt_shown', '1')` → chiudi (non mostrerà più; si può comunque attivare dal menu utente).
3. **Prompt dopo install PWA**: in `handleInstallClick`, quando `r === 'accepted'`: dopo `toast.success('App installata')`, chiamare `await activatePushNotifications()` e mostrare il toast d'esito (stessa mappatura). Il click è user gesture → `Notification.requestPermission` è permesso. Non toccare la flag `push_prompt_shown` qui (il modal primo-login non deve essere soppresso: se l'utente non ha ancora una subscription dopo l'install, il modal lo mostrerà comunque al prossimo login… attenzione: l'install avviene da logged in → `isPushEnabled` diventa true → il modal non parte più; coerente).

### E. `CLAUDE.md` (root del progetto, sezione Cloud Run)
- Nella lista "Secret Manager" aggiungere: `vapid-*` (3 secret: `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, nomi uid `vapid-19fdb2cf/…d0/…d1`).
- Nella lista "Env vars runtime" aggiungere: `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (via secret), `NODE_OPTIONS=--no-warnings`.
- Nota: NON stampare valori dei secret da nessuna parte.

## Vincoli
- Non toccare `server/index.js` (le route del router notifications sono già montate).
- Non modificare `setupPushNotifications`/auto-setup esistente in `NotificationContext.js` (resta il fallback silenzioso).
- UI modal in stile Tailwind coerente con il file (vedi `showInstallHelp`).
- Solo build locale di verifica (`npm run build`); NO docker, NO deploy GCP in questo passaggio.

## Verifica
1. `npm run build` → ok.
2. `grep "push-status"` in server/routes/notifications.js e src/services/apiService.js → presente.
3. Avvio rapido server locale: `PORT=8000 node server/index.js` (in background, uccidere dopo) + `curl -s localhost:8000/api/notifications/push-status` → `{ "enabled": true }` (le chiavi VAPID sono nel .env locale).
4. Grep: `push_prompt_shown` presente in Layout.js; vecchio testo "non configurate dal server" assente.