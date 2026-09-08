# Fix: mismatch chiavi VAPID — le web push sono rotte per tutti i device

## Root cause (verificata)

Due coppie VAPID distinte, entrambe coerenti di per sé:

| Coppia | Pubblica | Privata |
|---|---|---|
| Locale (`.env`) | `BOSblLwq…D1F8` | `bY5SkwoX…` |
| **Produzione** (Secret Manager) | `BHxo7A1p…PkYw` | `QVcFXHFH…` |

- Il bundle deployato ha **baked la pubblica LOCALE** (`REACT_APP_VAPID_PUBLIC_KEY`
  letta da `.env` a deploy).
- Il server di produzione **firma** le push con la **privata di produzione**
  (Secret Manager).
- FCM rigetta ogni push: *"the VAPID credentials in the authorization header do
  not correspond to the credentials used to create the subscriptions"*
  (visto nei log Cloud Run per tutte e 3 le subscription Android).

La notifica "vista" sul Mac era la **in-app** (browser aperto → `new
Notification` locale), non la web push: nel DB non c'è subscription dal Mac.

**Principio**: la pubblica con cui il browser crea la subscription deve essere
quella **accoppiata alla privata con cui il server firma**. In produzione
quella è la pubblica di produzione. La si ottiene in modo infallibile
chiedendola al server a **runtime** (che è per forza quella giusta), non
bakeandola a build-time (che può driftare).

## Cambiamenti

### 1. `server/routes/notifications.js` — `/push-status` restituisce la pubblica

`GET /push-status` (autenticato, router già dietro `authenticateToken`) passa da
`{ enabled }` a `{ enabled, publicKey }`:

```js
router.get('/push-status', (req, res) => {
    res.json({
        enabled: isVapidConfigured(),
        publicKey: process.env.VAPID_PUBLIC_KEY || null
    });
});
```

La chiave pubblica VAPID **non è segreta** (è la privata che lo è): esporla al
client è sicuro ed è l'unico modo per il browser di sapere con quale chiave
creare la subscription. (Non tocca il resto del router.)

### 2. `server/services/webPush.js` — logga la rimozione delle subscription morte

Nel ramo 404/410 (attualmente silenzio totale, `webPush.js:57-59`), aggiungere
un `console.log` prima del DELETE così un token FCM revocato non sparisce nel
silenzio:

```js
if (statusCode === 404 || statusCode === 410) {
    const endpoint = subscriptionsResult.rows[index].endpoint;
    console.log(`Push subscription rimossa (token scaduto/revocato ${statusCode}):`, endpoint);
    await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}
```

### 3. `server/routes/notifications.js` — endpoint `POST /test-push` (verifica E2E)

Accanto a `/push-status`, una route per testare la consegna a un utente (usata
per verificare la fix e come "testa le mie notifiche"):

```js
// Test: invia una push all'utente corrente (verifica che la consegna funzioni)
router.post('/test-push', async (req, res) => {
    if (!isVapidConfigured()) {
        return res.status(400).json({ error: 'Push non configurate sul server' });
    }
    await sendPushToUser(req.user.id, {
        title: 'Sport Manager',
        body: 'Push di test: se la vedi, le notifiche funzionano.',
        url: '/'
    });
    res.json({ success: true, message: 'Push di test inviata' });
});
```

(`sendPushToUser` già assorbe i fallimenti per subscription; qui non serve
distinguere l'esito per endpoint, basta aver tentato.)

### 4. `src/services/apiService.js` — getter chiave pubblica + test-push

- `getPushStatus()` (l.396) già esiste e ora porta `publicKey` → non serve
  cambiarlo, il frontend legge `status.publicKey`.
- Aggiungere:

```js
async testPush() {
    return this.client.post('/notifications/test-push');
}
```

### 5. `src/contexts/NotificationContext.js` — chiave pubblica a runtime + self-healing

Obiettivo: il browser crea/ri-crea la subscription **sempre** con la pubblica
che il server usa per firmare, e il telefono con una subscription vecchia
(creata con la chiave sbagliata) la **rigenera da solo** alla prossima apertura
(self-healing), senza azioni manuali.

In cima al modulo (fuori dal componente, una tantum per sessione):

```js
// Chiave pubblica VAPID letta dal server a runtime: è per forza quella
// accoppiata alla chiave privata con cui il server firma le push.
// Il fallback è quella baked a build-time (REACT_APP_VAPID_PUBLIC_KEY),
// corretta in locale e, dal fix del deploy, anche in produzione.
let cachedVapidPublicKey = null;
const getVapidPublicKey = async () => {
    if (cachedVapidPublicKey) return cachedVapidPublicKey;
    try {
        const status = await apiService.getPushStatus();
        if (status && status.publicKey) {
            cachedVapidPublicKey = status.publicKey;
            return cachedVapidPublicKey;
        }
    } catch { /* offline/401: si usa il fallback baked */ }
    return process.env.REACT_APP_VAPID_PUBLIC_KEY || null;
};
```

Nuova helper unica (dentro il componente, usa `urlBase64ToUint8Array` già
presente) che sostituisce la logica di subscribe di tutti e 3 i punti:

```js
// Crea (o rigenera, self-healing) la subscription con la chiave pubblica
// corrente del server e la registra. `subscribe()` è idempotente se la
// chiave coincide con quella della subscription esistente e ne crea una
// nuova corretta se la chiave con cui il server firma è cambiata.
const ensurePushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) {
        console.warn('Chiave VAPID non disponibile: push non sottoscritte');
        return null;
    }
    const registration = await navigator.serviceWorker.ready;
    const previous = await registration.pushManager.getSubscription();
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    setPushSubscription(subscription);
    // Registra la (nuova) subscription; se quella precedente aveva un
    // endpoint diverso, toglila dal server per non lasciare endpoint morti.
    await apiService.savePushSubscription(subscription);
    if (previous && previous.endpoint !== subscription.endpoint) {
        try { await apiService.deletePushSubscription(previous.endpoint); } catch {}
    }
    return subscription;
};
```

Poi:
- `subscribeToPushNotifications()` → diventa `await ensurePushSubscription();`
  (rimuovi la lettura di `process.env.REACT_APP_VAPID_PUBLIC_KEY` e il
  `subscribe` inline).
- `activatePushNotifications()` → dopo il permesso concesso, il blocco
  `getSubscription`/`subscribe`/`save` (l.181-198) diventa
  `await ensurePushSubscription();` e torna `'ok'` se restituisce una
  subscription, `'no-vapid'` se `ensurePushSubscription` non ha potuto
  (chiave assente), `'unsupported'`/`'denied'` come prima.
- `setupPushNotifications()` (auto al login, l.91-109): se c'è già una
  subscription **e** il permesso è `granted`, chiama `await
  ensurePushSubscription();` per il self-healing (idempotente: niente
  endpoint nuovi se la chiave non è cambiata). Se non c'è subscription,
  mantiene il flow attuale (`requestNotificationPermission`).

Non toccare: realtime Supabase, `isPushEnabled` (resta `!!pushSubscription`),
`PushNotificationManager` in `serviceWorker.js`.

### 6. Procedura deploy (CLAUDE.md) — bake la pubblica di PRODUZIONE

In "Rebuild + deploy manuale", sostituire la riga che legge la pubblica da
`.env` con il secret di produzione, così anche il fallback baked è quella
giusta in produzione:

```bash
# da:  VAPID_PUBLIC_FE=$(grep "^REACT_APP_VAPID_PUBLIC_KEY=" .env | cut -d= -f2-)
VAPID_PUBLIC_FE=$(gcloud secrets versions access latest --secret=vapid-public-key | tr -d '\n')
```

(Nota: ora è solo il fallback; la chiave usata a runtime arriva da
`/push-status`. Il `--build-arg REACT_APP_VAPID_PUBLIC_KEY` resta.)

## Cosa NON si tocca
- Le chiavi in Secret Manager (sono corrette e coerenti).
- `webPush.sendPushToUser`/`sendStaffPush` (l'invio è già giusto).
- sw.js, manifest, strategy del service worker.

## Verifica (da main agent, dopo implementazione)

1. Build locale: `grep -c "<pubblica prod>" build/static/js/main.*.js` → il
   fallback baked è la chiave prod.
2. Server locale (postgres effimero, porta 8001, `DB_SSL=false`,
   `build/package.json` a mano — vedi memoria `local-verify-server`):
   `curl /api/notifications/push-status` con token → `publicKey` = quella del
   `.env` locale (in locale è coerente con la privata locale).
3. Deploy (gcloud, build-arg `REACT_APP_VAPID_PUBLIC_KEY` = pubblica **prod**).
4. Post-deploy: `GET /push-status` (prod, con token) → `publicKey` =
   `BHxo7A1p…PkYw`; bundle contiene `BHxo7A1p…PkYw`.
5. **Self-healing sul telefono**: l'utente chiude e riapre l'app →
   `setupPushNotifications` → `ensurePushSubscription` rigenera la
   subscription con la chiave prod → upsert in `push_subscriptions`.
6. **Conferma E2E**: `POST /api/notifications/test-push` (con il token
   dell'utente) e nei log Cloud Run la consegna FCM va a buon fine (nessun
   "credentials do not correspond"). In alternativa una notifica reale
   (es. richiesta di collegamento profilo) arriva sul telefono a app chiusa.