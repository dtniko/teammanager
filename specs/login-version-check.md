# Check automatico di versione al login + endpoint `/api/version`

## Problema

Dopo un deploy, il "Verifica aggiornamenti" del menu dice "Sei già all'ultima
versione" anche quando il bundle JS è cambiato: `src/utils/swUpdateCheck.js`
usa solo `reg.update()`, che fa confrontare al browser i **byte di sw.js**.
Se il deploy cambia solo `build/` (bundle hashato) e sw.js resta identico
(nome cache sempre `sportclub-manager-v3`), il check è cieco. La versione
dell'app non esiste da nessuna parte (nessun file VERSION, nessuna route).

## Obiettivo

1. Versione dell'app **baked in build** (env var `REACT_APP_APP_VERSION`,
   valorizzata a deploy via `--build-arg APP_VERSION=...`).
2. Endpoint pubblico **`GET /api/version`** che restituisce la versione del
   deployment corrente.
3. Al **login** (e login Google) l'app confronta la versione corrente
   (baked nel bundle) con quella salvata nel `localStorage` al load
   precedente; se differisce → `window.confirm("E' disponibile una nuova
   versione dell'app. Ricaricare ora?")` → reload se confermato.
4. Il pulsante menu "Verifica aggiornamenti" resta (extra): fa SW check
   **+** confronto con `/api/version`; se SW dice "up-to-date" ma i numeri
   differiscono, mostra il banner di aggiornamento esistente (una tantum per
   sessione, via `sessionStorage`).
5. Asset hashati serviti con `Cache-Control: public, max-age=31536000,
   immutable` (sicuri: il filename cambia a ogni build).

## Note di contesto (dall'indagine)

- `src/index.js`: entry CRA. `src/contexts/AuthContext.js`: `login()` circa
  l.104-129 (dopo `setUser` + toast ≈ l.118), `loginWithGoogle()` l.77-99
  (`setUser` l.88).
- `server/index.js`: route API l.36-47, `/api/health` l.50-52, blocco SPA
  (static + catch-all `app.get('*')`) l.57-63 **dopo** le API — NON toccare
  l'ordine (bug documentato in CLAUDE.md).
- `src/components/Layout/Layout.js`: `handleUpdateCheck` l.255-265, voce
  menu l.455-468, mini-panel "Aggiorna ora" l.471-496. Esiste già un banner
  di nuova versione attivato dal postMessage `sw-activated` dello SW —
  riutilizzarlo (trovare lo stato che lo pilota, es. dedup con localStorage).
- `src/services/apiService.js`: `axios.create`, baseURL `REACT_APP_API_URL`,
  interceptor response che ritorna `response.data` (quindi
  `await apiService.version()` dà direttamente l'oggetto JSON).
- `Dockerfile`: stage builder l.32-49 (ARG `REACT_APP_*` l.38-47,
  `npm run build` l.49); stage production copia `/app/build`.
- sw.js **non va toccato** (non serve bump di versione cache).
- `public/package.json` non esiste (verificabile); CRA copia `public/*` in
  `build/` dopo la compilazione, quindi un `public/package.json` finisce in
  `build/package.json`.

## Cambiamenti

### 1. `Dockerfile` (stage builder)

Dopo gli ARG `REACT_APP_*` e **prima** di `npm run build`:

```dockerfile
ARG APP_VERSION=dev
RUN cp build/package.json public/ 2>/dev/null || true
```

ATTENZIONE: `build/package.json` non esiste prima della build. La sequenza
corretta è:

```dockerfile
ARG APP_VERSION=dev
RUN printf '{ "version": "%s" }' "$APP_VERSION" > public/package.json
```

poi `npm run build` come oggi. (Nessun altro RUN da toccare.)

### 2. `server/index.js`

In testa, accanto agli altri require (aggiungere `fs` e `path` se non
presenti):

```js
const APP_VERSION = (() => {
    try {
        const pkg = require(path.join(__dirname, '..', 'build', 'package.json'));
        if (pkg && pkg.version) return pkg.version;
    } catch { /* fall back */ }
    return '0.0.0';
})();
```

Nuova route **dopo** `/api/health` (e comunque PRIMA del blocco SPA):

```js
app.get('/api/version', (req, res) => {
    res.json({ version: APP_VERSION, timestamp: new Date().toISOString() });
});
```

Middleware Cache-Control per asset hashati, registrato **prima** di
`app.use(express.static(...))`:

```js
app.use((req, res, next) => {
    if (req.method === 'GET' && /^\/static\/(js|css)\//.test(req.path)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
    next();
});
```

### 3. `src/index.js`

Prima riga di codice (dopo gli import va bene, prima del `ReactDOM`/`createRoot`):

```js
// Versione dell'app baked a build time (Dockerfile: REACT_APP_APP_VERSION
// da --build-arg APP_VERSION). 'dev' in sviluppo locale senza la variabile.
window.__BUILD_VERSION__ = process.env.REACT_APP_APP_VERSION || 'dev';
```

### 4. `src/services/apiService.js`

Aggiungere un metodo (accanto agli altri `get...`):

```js
version() {
    return apiService.get('/version');
}
```

(Verificare lo stile dei metodi esistenti e adeguarsi.)

### 5. `src/utils/versionCheck.js` (nuovo file)

```js
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
```

### 6. `src/contexts/AuthContext.js`

Import: `import { isUpdateAvailable, recordVersion } from '../utils/versionCheck';`

In **entrambi** i punti (dopo il `setUser(...)` di `login()` ≈ l.118 e di
`loginWithGoogle()` l.88), **solo se il login è riuscito**:

```js
const needsReload = isUpdateAvailable();
recordVersion();
if (needsReload) {
    if (window.confirm("E' disponibile una nuova versione dell'app. Ricaricare ora?")) {
        window.location.reload();
    }
}
```

Ordine importante: `isUpdateAvailable()` PRIMA di `recordVersion()`
(altrimenti il confronto sarebbe sempre falso).

### 7a. `src/utils/serviceWorker.js`

`showUpdateBanner()` (l.139-175) è oggi private. **Esportarla**
(`export function showUpdateBanner()`) — il resto non si tocca. Il banner è
già deduplicato da solo via `document.getElementById('update-banner')`.

### 7b. `src/components/Layout/Layout.js`

- Import: `import { fetchServerVersion } from '../../utils/versionCheck';`
  e `import { showUpdateBanner } from '../../utils/serviceWorker';`
- Stato: `const [serverVersion, setServerVersion] = useState(null);`
- `handleUpdateCheck`: in parallelo al check SW, chiedere la versione al
  server; se SW = 'up-to-date' ma le versioni differiscono → `showUpdateBanner()`;
  i toast restano come ora.

```js
const handleUpdateCheck = async () => {
    setUpdateCheck('checking');
    const [swResult, remote] = await Promise.all([
        checkForSWUpdate(),
        fetchServerVersion(),
    ]);
    setServerVersion(remote);
    setUpdateCheck(swResult);
    const buildV = window.__BUILD_VERSION__;
    if (swResult === 'up-to-date') {
        if (remote && buildV && buildV !== 'dev' && remote !== buildV) {
            // SW identico (niente reload automatico) ma bundle cambiato:
            // banner con "Aggiorna ora" (dedup interno via DOM id)
            showUpdateBanner();
        } else {
            toast.success("Sei già all'ultima versione.");
        }
    } else if (swResult === 'unsupported') {
        toast.info('Aggiornamenti non disponibili in questo browser.');
    }
};
```

- **Footer del dropdown utente** (dopo la voce push, prima del separator
  finale/logout):

```jsx
{serverVersion && (
    <div className="px-4 py-2 text-xs text-gray-400 border-t">
        Versione {serverVersion}
    </div>
)}
```

### 8. `CLAUDE.md` (sezione "Rebuild + deploy manuale")

- Nel blocco di `export` delle variabili: `APP_VERSION=$(git rev-parse --short HEAD)`
- Nel `docker build`: aggiungere `--build-arg APP_VERSION="$APP_VERSION"`
- In "Verifica rapida dopo ogni deploy": aggiungere
  `curl -s https://…/api/version` che deve rispondere
  `{"version":"<APP_VERSION>",...}` (oltre a `/api/health`).

## Cosa NON si tocca

- `public/sw.js` (nessun bump, nessuna nuova strategia).
- L'ordine delle route in `server/index.js` (API prima della SPA).
- Il flow "Aggiorna ora" SW esistente (`applySWUpdate` = reload).

## Verifica

1. `REACT_APP_APP_VERSION=9.9.9-test npm run build` (variabile baked nel bundle:
   `grep -c '9.9.9-test' build/static/js/main.*.js` → ≥1).
2. Avviare il server su **PORT=8000** (mai la 4040, trappola nota) con
   `NODE_ENV=production`; `curl localhost:8000/api/version` deve dare
   `{"version":"9.9.9-test",...}`.
3. `curl -sI localhost:8000/static/js/main.<hash>.js` → header
   `Cache-Control: public, max-age=31536000, immutable`.
4. `curl -s localhost:8000/api/health` intatto (JSON, non HTML).
5. `npx --yes playwright` opzionale: login con cred finte → nessun crash,
   nessun confirm a schermo (in dev `__BUILD_VERSION__='dev'` → check off).
6. Simulazione update: con l'app aperta, `localStorage.app_version='1.0.0'`
   e reload (se in prod), oppure unitario: impostare `window.__BUILD_VERSION__`
   a mano + `localStorage` + chiamare `isUpdateAvailable()` da console.