# Spec: Web Push reale (VAPID) — notifiche a tab/app chiusa

## Contesto
Oggi (`src/contexts/NotificationContext.js`) le notifiche funzionano solo se
la tab è aperta: realtime Supabase (`postgres_changes` su `notifications`) +
`Notification` browser API mostrata client-side. L'utente vuole anche vera
push OS-level (Web Push API), che funzioni con la web app chiusa — uso
principale mobile (Android Chrome; iOS richiede PWA installata via
"Aggiungi a Home" per supportare Web Push, è una limitazione della
piattaforma, non nostra — documentarlo ma non bloccare l'implementazione).

Nel client esiste già codice PARZIALE non finito:
`NotificationContext.js` righe ~127-153 (`setupPushNotifications`,
`subscribeToPushNotifications`) — usa `REACT_APP_VAPID_PUBLIC_KEY`,
chiama `registration.pushManager.subscribe(...)`, ma l'invio della
subscription al server è commentato (riga ~146-147:
`// await apiService.savePushSubscription(subscription);`).
Non esiste: tabella `push_subscriptions`, endpoint subscribe/unsubscribe,
libreria `web-push` lato server, gestore evento `push` nel service worker.

## Step 1 — Chiavi VAPID + dipendenza server
1. Aggiungere `web-push` a `dependencies` in `package.json` (non devDependencies,
   serve a runtime in `server/`).
2. Generare una coppia di chiavi VAPID (`npx web-push generate-vapid-keys`,
   comando una tantum, non va scriptato in un file eseguito a ogni avvio).
   Aggiungere a `.env` (e a `.env.example` se esiste, solo come placeholder):
   - `VAPID_PUBLIC_KEY=...`
   - `VAPID_PRIVATE_KEY=...`
   - `VAPID_SUBJECT=mailto:<email di contatto reale del progetto>` (chiedere
     all'utente quale email usare se non è ovvio dal progetto, altrimenti usare
     un placeholder chiaramente marcato da sostituire)
   Il frontend ha già bisogno della sola chiave pubblica via
   `REACT_APP_VAPID_PUBLIC_KEY` (stesso valore di `VAPID_PUBLIC_KEY`) — va
   aggiunta anch'essa a `.env` E passata come build-arg Docker in fase di
   build finale (vedi CLAUDE.md di progetto, sezione "Rebuild + deploy
   manuale": altri `REACT_APP_*` sono già passati come `--build-arg`, questa
   va aggiunta allo stesso elenco quando si farà il build/deploy finale —
   annotare questo passo ma non eseguirlo ora, siamo in sviluppo locale).
   In sviluppo locale (`npm run start:local`), va esportata come env var
   prima di avviare CRA (stesso meccanismo di `REACT_APP_API_URL` nello
   script `start:local` di `package.json`).

## Step 2 — DB: tabella `push_subscriptions`
Nuova migration `database/migrations/004_add_push_subscriptions.sql`
(+ stessa DDL in fondo a `schema.sql`, stile coerente con le altre tabelle):
```sql
CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
```
Un utente può avere più subscription (più dispositivi/browser). `endpoint`
UNIQUE evita duplicati se il client ri-invia la stessa subscription.

## Step 3 — Backend: endpoint subscribe/unsubscribe + invio push
### 3a. `server/routes/notifications.js` (o nuovo file se il modulo è già
grande — valutare leggendo il file, ma preferire estendere quello esistente
dato che gestisce già le notifiche)
Nuovi endpoint (protetti da `authenticateToken`, già applicato a livello di
mount in `server/index.js` per `/api/notifications`):
- `POST /api/notifications/push-subscribe`
  Body: `{ endpoint, keys: { p256dh, auth } }` (shape standard di
  `PushSubscription.toJSON()`). Upsert in `push_subscriptions` per
  `(user_id, endpoint)` — se l'endpoint esiste già aggiorna `p256dh`/`auth`/
  `user_agent`, altrimenti insert. Risposta 201/200.
- `DELETE /api/notifications/push-subscribe`
  Body: `{ endpoint }`. Cancella la riga corrispondente (solo se
  `user_id = req.user.id`, per non permettere di cancellare subscription
  altrui). Da chiamare quando l'utente disattiva le notifiche o fa logout
  (opzionale per il logout, non bloccante se non implementato in questo giro).

### 3b. Modulo di invio: `server/services/webPush.js` (nuovo file)
```js
const webpush = require('web-push');
webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

async function sendPushToUser(userId, payload) {
  // 1. SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1
  // 2. per ogni subscription, webpush.sendNotification({endpoint, keys:{p256dh,auth}}, JSON.stringify(payload))
  // 3. se l'invio fallisce con statusCode 404 o 410 (subscription scaduta/revocata),
  //    cancellare quella riga da push_subscriptions (pulizia automatica) — non lanciare
  //    errore per gli altri destinatari, isolare i fallimenti per singola subscription
  //    (Promise.allSettled, non Promise.all)
}

async function sendPushToUsers(userIds, payload) {
  // Promise.allSettled su sendPushToUser per ciascun userId
}

module.exports = { sendPushToUser, sendPushToUsers };
```
`payload` consigliato: `{ title, body, url }` (url = dove navigare al click,
es. `/pending-approvals` per le richieste pending, `/notifications` come
fallback generico).

### 3c. Collegare l'invio alla creazione notifiche
In `server/routes/notifications.js`, dentro `createNotification` e
`createBulkNotifications` (le due funzioni helper già esistenti, usate da
tutto il progetto per creare righe in `notifications` — es. anche dal nuovo
flusso "richiesta pending" appena aggiunto in `server/routes/onboarding.js`),
DOPO l'insert nel DB, richiamare `sendPushToUser`/`sendPushToUsers` con lo
stesso `user_id`/`userIds` e un payload costruito da `title`/`message`.
Così OGNI notifica esistente nel progetto (eventi, comunicazioni, scadenze
documenti, richieste pending, ecc.) guadagna automaticamente anche la push
reale, senza dover toccare ogni singolo chiamante.
**Importante**: l'invio push non deve mai far fallire la request HTTP che
crea la notifica — avvolgere in try/catch, loggare l'errore, non rilanciare
(fire-and-forget rispetto alla response principale, ma awaitare comunque
prima di rispondere così eventuali errori finiscono nei log e non in una
race condition silente — usare `.catch(err => console.error(...))` se si
vuole non bloccare la risposta, altrimenti `await` diretto se il piccolo
ritardo è accettabile: preferire NON bloccare la risposta, quindi avviare
l'invio senza `await` ma con `.catch` per non generare unhandled rejection).

## Step 4 — Service worker: gestione evento `push` e click
In `public/sw.js` (già esistente, vedi cache strategy attuale — non
toccare la logica di fetch/cache già a posto), aggiungere:
```js
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Sport Manager';
  const options = {
    body: data.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
```

## Step 5 — Frontend: completare la subscription
In `src/contexts/NotificationContext.js`:
1. Aggiungere in `src/services/apiService.js` i metodi
   `savePushSubscription(subscription)` (POST
   `/notifications/push-subscribe`, body = `subscription.toJSON()`) e
   `deletePushSubscription(endpoint)` (DELETE
   `/notifications/push-subscribe`, body `{ endpoint }`) se non già presenti
   (leggi il file, potrebbero già esserci nomi simili da riusare).
2. Nella funzione `subscribeToPushNotifications` (o dove il codice
   attualmente commenta la chiamata), togliere il commento e chiamare
   `apiService.savePushSubscription(subscription)` dopo un subscribe
   riuscito.
3. Verificare che `setupPushNotifications` venga effettivamente invocato
   dopo il login (non solo definito) — leggere l'`useEffect` che lo chiama
   (riga ~33 secondo l'esplorazione precedente) e assicurarsi che richieda
   il permesso (`Notification.requestPermission()`) in un momento sensato
   (dopo login, non al primo mount prima che l'utente sia autenticato —
   verificare condizione `if (user) {...}` già presente o da aggiungere).
4. Il componente `LoadingSpinner`/UI non serve toccarlo; non aggiungere UI
   nuova per "attiva notifiche" a meno che il permesso venga negato/mai
   richiesto — in tal caso opzionale: un piccolo banner/bottone "Attiva
   notifiche push" da qualche parte nel `Layout` (solo se il pattern di
   permesso `default`/`denied` lo rende necessario; valutare in base a
   quanto la libreria attuale già gestisce, non reinventare se già previsto
   nel codice esistente).

## Note importanti
- **VAPID_PRIVATE_KEY è un segreto**: non deve mai finire in `REACT_APP_*`
  (bundle pubblico) né in log. Solo `VAPID_PUBLIC_KEY` è pubblica per
  design.
- **iOS Safari**: la Web Push API funziona solo per PWA "installate" (Add to
  Home Screen) su iOS 16.4+; su iOS in tab Safari normale la push non
  arriva. Non è un bug della nostra implementazione, è una limitazione della
  piattaforma — se rilevante, menzionarlo all'utente ma non è richiesto
  gestirlo diversamente nel codice (il subscribe fallirà silenziosamente o
  `pushManager` non sarà disponibile: gestire già l'eventuale eccezione nel
  codice esistente di `subscribeToPushNotifications`, verificare che non
  rompa il resto dell'app se il subscribe fallisce).
- Non serve applicare la migration a Supabase né rigenerare la build/
  container in questo step — lo farà il coordinatore (main agent) dopo,
  come per gli step precedenti di questa sessione, e SOLO su richiesta
  esplicita (l'utente ora sta lavorando in locale senza container, vedi
  script `server:local`/`start:local` in `package.json`).

## Verifica finale (delegata a un subagent di verifica, non nel main agent)
Con l'app in esecuzione locale (`npm run dev:local` o i due script separati),
usare Playwright per: fare login, controllare in console che
`pushManager.subscribe` vada a buon fine e che `POST
/api/notifications/push-subscribe` risponda 200/201, poi verificare via
query diretta al DB che la riga sia stata inserita in `push_subscriptions`.
Testare l'invio reale (creare una richiesta di collegamento profilo pending
da un altro utente, controllare che `sendPushToUsers` non lanci eccezioni
nei log del server) — la ricezione effettiva della notifica di sistema in un
browser headless non è verificabile in automatico (richiede permesso
notifiche reale), quindi la verifica end-to-end "arriva davvero la
notifica" andrà fatta manualmente dall'utente su un dispositivo reale.
