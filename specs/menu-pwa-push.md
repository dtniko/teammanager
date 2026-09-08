# Spec — Voci menu "Installa app" / "Attiva push" + fix build-arg VAPID

## Obiettivo
Nel dropdown del menu utente (avatar in header) aggiungere 2 voci azione, visibili
solo quando l'azione ha senso:

1. **"Installa app sul dispositivo"** — visibile solo se l'app NON è già installata
   (`!installed` da `usePWAInstall()`).
2. **"Attiva notifiche push"** — visibile solo se la push NON è già attiva
   (`!isPushEnabled` da `useNotifications()`).

In più: fix del `Dockerfile` che non passa `REACT_APP_VAPID_PUBLIC_KEY` alla build
(frontend) → in produzione la subscription fallisce silenziosamente.

## Contesto (da esplorazione, già verificato)

- Menu utente: `src/components/Layout/Layout.js` — dropdown `userMenuOpen`,
  container a `:298`, voci fisse "Profilo" (Link, `:306-313`) e "Disconnetti"
  (button, `:315-325`). Il Layout usa già `useNotifications()` a `:29`
  (import a `:20`) e importa icone da `lucide-react` (a `:3-19`).
- `src/hooks/usePWAInstall.js` — espone `{ canInstall, installed, install }`;
  `install()` ritorna `'accepted' | 'dismissed' | 'cancelled' | null`
  (null = prompt nativo non disponibile, es. iOS/Firefox).
- iOS: `beforeinstallprompt` non viene mai emesso da Safari → il fallback è il
  manuale "Condividi → Aggiungi alla schermata Home" (pattern già in
  `src/components/Common/PWAInstallCard.js:119-129`, helper `isIOS()` a `:7-11`).
- `src/contexts/NotificationContext.js`:
  - value espone già `isPushEnabled: !!pushSubscription` (`:357`),
    `pushSubscription` (`:337`), `requestNotificationPermission` (`:346`).
  - `subscribeToPushNotifications` (`:127-153`): legge
    `process.env.REACT_APP_VAPID_PUBLIC_KEY` (`:132`), se assente fa
    `console.warn` e torna (`:134-137`), poi `pushManager.subscribe` +
    `apiService.savePushSubscription`.
  - `setupPushNotifications` (`:91-109`) gira già in automatico a login
    (provider, `:25-33`): se esiste subscription la adotta, altrimenti richiama
    `requestNotificationPermission`.
  - Pattern modal esistente: `src/components/Calendar/EventFormModal.js:157`
    (`fixed inset-0 bg-black bg-opacity-50 ... z-50`). Toast: `react-toastify`
    (cercare un uso esistente nell'app per import/stile coerente).

## Cambiamenti

### 1. `src/contexts/NotificationContext.js`
Aggiungere al context (e al `value`) una funzione **`activatePushNotifications`**
usata dalle azioni esplicite dell'utente (differente dall'auto-setup: deve
**ritornare l'esito** per il feedback). Logica:

```
async function activatePushNotifications(): Promise<string>
- se manca 'Notification' in window | 'serviceWorker' in navigator | 'PushManager' in window
  → return 'unsupported'
- const perm = Notification.permission
- se perm === 'denied' → return 'denied'
- se perm === 'default' → perm = await Notification.requestPermission();
  se perm !== 'granted' → return perm  // 'denied' | 'default'
- // permission granted:
- const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY
- se !vapidPublicKey → return 'no-vapid'
- try:
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    se (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) })
    setPushSubscription(sub)
    await apiService.savePushSubscription(sub)   // idempotente: server fa upsert
    return 'ok'
  catch → return 'error'
```

Nota: `urlBase64ToUint8Array` è già definita in questo file (usarla, non
ridurla). Non modificare il flusso di auto-setup esistente.

### 2. `src/components/Layout/Layout.js`
- Importi: `usePWAInstall` da `../../hooks/usePWAInstall`, icone `Download` e
  `Smartphone` da lucide (controllare cosa manca tra gli import `:3-19`),
  `toast` da `react-toastify` (come usato altrove nell'app).
- `const { canInstall, installed, install } = usePWAInstall();`
- Estendere la chiamata esistente `useNotifications()` (`:29`) con
  `isPushEnabled` e `activatePushNotifications`.
- Nuovo state: `const [showInstallHelp, setShowInstallHelp] = useState(false);`

**Handler installazione:**
```
const handleInstallClick = async () => {
    setUserMenuOpen(false);
    const r = canInstall ? await install() : null;
    if (r === 'accepted') toast.success('App installata');
    else if (!r) setShowInstallHelp(true);   // prompt nativo non disponibile → istruzioni
    // dismissed/cancelled: nessun feedback, la voce resta
};
```

**Handler push:**
```
const handlePushClick = async () => {
    setUserMenuOpen(false);
    const result = await activatePushNotifications();
    switch (result) {
        case 'ok':          toast.success('Notifiche push attivate'); break;
        case 'denied':      toast.error('Notifiche bloccate: attivali dalle impostazioni del browser e ricarica la pagina'); break;
        case 'default':     toast.warning('Permesso non concesso: le notifiche restano disattivate'); break;
        case 'no-vapid':    toast.warning('Notifiche push non configurate dal server'); break;
        case 'unsupported': toast.warning('Il browser non supporta le notifiche push'); break;
        default:            toast.error('Errore nell\'attivazione delle notifiche push');
    }
};
```

**Voci nel dropdown**, inserite tra "Profilo" (dopo `:313`) e "Disconnetti"
(`:315`), con lo stesso stile delle voci esistenti
(`flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100`,
icona `mr-3 h-4 w-4`):

```jsx
{!installed && (
    <button type="button" onClick={handleInstallClick} className="...">
        <Download className="mr-3 h-4 w-4" />
        Installa app sul dispositivo
    </button>
)}

{!isPushEnabled && (
    <button type="button" onClick={handlePushClick} className="...">
        <Bell className="mr-3 h-4 w-4" />
        Attiva notifiche push
    </button>
)}
```

**Modal istruzioni installazione** (`showInstallHelp`), pattern
`EventFormModal.js:157`: overlay + pannello bianco centrato, titolo "Installa
l'app sul dispositivo", contenuto:
- se iOS (stesso test `isIOS()` di `PWAInstallCard.js:7-11` — duplicare i 4
  righe del helper localmente, non è esportato): in **Safari** tocca
  <Share> (icona di condivisione nella barra) → **"Aggiungi alla schermata
  Home"**. Nota: le notifiche push sull'iPhone arrivano solo con l'app
  installata.
- altrimenti: "Usa Chrome o Edge: cerca l'icona di installazione nella barra
  degli indirizzi (o Menu ⋮ → "Installa app")".
Pulsante "Chiuso" che fa `setShowInstallHelp(false)`.

### 3. `Dockerfile`
Nello stage `builder` aggiungere l'ARG e includerlo nell'ENV:
```
ARG REACT_APP_VAPID_PUBLIC_KEY
ENV ... REACT_APP_VAPID_PUBLIC_KEY=$REACT_APP_VAPID_PUBLIC_KEY
```
(insieme agli ARG/ENV esistenti `:38-45`).

### 4. `.env.example`
Nella sezione client (dove sta `REACT_APP_API_URL`) aggiungere:
```
# Chiave pubblica VAPID (base64url) — DEVE essere passata anche come
# --build-arg REACT_APP_VAPID_PUBLIC_KEY alla docker build (vedi CLAUDE.md)
REACT_APP_VAPID_PUBLIC_KEY=
```

### 5. `CLAUDE.md` (teammanager)
Nel blocco "Rebuild + deploy manuale":
- aggiungere la riga
  `VAPID_PUBLIC_FE=$(grep "^REACT_APP_VAPID_PUBLIC_KEY=" .env | cut -d= -f2-)`
  insieme alle altre `$(grep ...)`;
- aggiungere `--build-arg REACT_APP_VAPID_PUBLIC_KEY="$VAPID_PUBLIC_FE"`
  al comando `docker build`.

## Vincoli
- Nessuna libreria nuova; Tailwind + lucide + react-toastify già presenti.
- UI in italiano hardcoded (nessuna i18n).
- Non toccare `PWAInstallCard` (resta sulla pagina di login) né il flusso di
  auto-setup del NotificationContext.
- La subscription push è `userVisibleOnly: true` (vincolo Android, già così).
- Cross-platform: solo JS frontend, niente dipendenze da OS.

## Verifica
1. `cd teammanager && npm run build` → compila senza errori.
2. Check statico: nel bundle di build la stringa
   `REACT_APP_VAPID_PUBLIC_KEY` non compare più come env letterale (CRA la
   sostituisce a build time; senza valore nel .env diventa `undefined` —
   comportamento atteso, gestito dal ramo `no-vapid`).
3. (Opzionale, se l'utente vuole testare a mano: dev server + Chrome,
   `beforeinstallprompt` non scatta in dev; verificare che le voci del menu
   compaiano/scompaiano correttamente e che il toast per 'denied' funzioni
   bloccando il permesso una volta.)