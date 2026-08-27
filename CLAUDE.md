# Sport Manager — note di progetto

## Architettura deploy
App monolitica: un solo container Express serve sia le API (`/api/*`) sia i
file statici della build React (`build/`). Nessun frontend separato da
hostare: `server/index.js` fa `app.use(express.static('../build'))` +
catch-all `*` -> `index.html` quando `NODE_ENV=production`.

Database: PostgreSQL su **Supabase** (non Postgres locale/Cloud SQL).
`server/config/database.js` usa `DATABASE_URL` se presente (priorità su
DB_HOST/DB_USER/ecc., che restano come fallback per lo sviluppo locale via
docker-compose).

## Cloud Run — infrastruttura GCP
- Progetto: `sportclub-manager-app`
- Region: `europe-west8` (Milano)
- Servizio Cloud Run: `sportclub-manager`
- URL: https://sportclub-manager-321154544822.europe-west8.run.app
- Artifact Registry (repo Docker): `europe-west8-docker.pkg.dev/sportclub-manager-app/sportclub-manager/app`
- Secret Manager: `sportclub-database-url` (Supabase DATABASE_URL),
  `sportclub-jwt-secret` (JWT_SECRET **dedicato alla produzione**, diverso da
  quello di sviluppo in `.env`) — il service account Cloud Run di default
  (`<project-number>-compute@developer.gserviceaccount.com`) ha il ruolo
  `roles/secretmanager.secretAccessor` su entrambi.
- Env vars runtime (non-segrete) impostate su Cloud Run:
  `NODE_ENV=production`, `GOOGLE_CLIENT_ID`, `FRONTEND_URL` (= URL Cloud Run
  stesso, per CORS).

### gcloud CLI su questa macchina Windows
Installato via `winget install --id Google.CloudSDK`. Il PATH utente viene
aggiornato dall'installer, ma le sessioni bash/PowerShell già aperte non lo
rileggono: usare il path completo finché non si riavvia il terminale:
```
"/c/Users/rstimpfl/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"
```
oppure, in una nuova sessione bash:
```
export PATH="$PATH:/c/Users/rstimpfl/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin"
```

### Rebuild + deploy manuale (finché non c'è CI/CD)
Dalla root del progetto, con `.env` presente per leggere i valori
`REACT_APP_*` da passare come build-arg (baked a build-time, non sono env
runtime):
```bash
export PATH="$PATH:/c/Users/rstimpfl/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin"
SUPABASE_URL=$(grep "^REACT_APP_SUPABASE_URL=" .env | cut -d= -f2-)
SUPABASE_ANON=$(grep "^REACT_APP_SUPABASE_ANON_KEY=" .env | cut -d= -f2-)
GOOGLE_CLIENT_ID_FE=$(grep "^REACT_APP_GOOGLE_CLIENT_ID=" .env | cut -d= -f2-)
IMAGE="europe-west8-docker.pkg.dev/sportclub-manager-app/sportclub-manager/app:latest"

# IMPORTANTE: MSYS_NO_PATHCONV=1 SOLO per il docker build (vedi bug sotto),
# NON per gcloud (rompe gcloud.cmd, che internamente invoca python.exe).
export MSYS_NO_PATHCONV=1
docker build --target production \
  --build-arg REACT_APP_API_URL=/api \
  --build-arg REACT_APP_SUPABASE_URL="$SUPABASE_URL" \
  --build-arg REACT_APP_SUPABASE_ANON_KEY="$SUPABASE_ANON" \
  --build-arg REACT_APP_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID_FE" \
  -t "$IMAGE" .
docker push "$IMAGE"
unset MSYS_NO_PATHCONV

gcloud run deploy sportclub-manager --image="$IMAGE" --region=europe-west8 --platform=managed
```

Verifica rapida dopo ogni deploy:
```bash
curl -s https://sportclub-manager-321154544822.europe-west8.run.app/api/health
```
Deve rispondere JSON `{"status":"OK",...}`, non l'HTML della SPA (vedi bug
catch-all sotto — se torna HTML, l'ordine delle route in `server/index.js` si
è rotto di nuovo).

### Log in tempo reale
```bash
gcloud beta run services logs tail sportclub-manager --region=europe-west8
```
(richiede i componenti gcloud `beta` e `log-streaming`: installarli una
tantum con `gcloud components install beta log-streaming --quiet` se il
comando si blocca su un prompt Y/n).

## Bug risolti durante il primo deploy (26/08/2026)

1. **Catch-all Express registrato prima delle route `/api/*`** — in
   `server/index.js`, il blocco che serve la SPA (`app.use(static)` +
   `app.get('*', ...)`) era prima di `/api/health` e delle altre route GET.
   In produzione qualsiasi GET `/api/*` veniva intercettata dal catch-all e
   restituiva `index.html` invece del JSON atteso (POST/PUT/DELETE non
   erano toccate). **Fix**: spostare il blocco SPA dopo tutte le route
   `/api/*`, appena prima dell'error handler finale.

2. **`public/sw.js` (service worker custom) precaching file inesistenti** —
   metteva in cache `/static/js/bundle.js` e `/static/css/main.css`, nomi
   che non esistono nella build CRA di produzione (hash nel filename). Il
   catch-all rispondeva comunque 200 con `index.html`, quindi il SW
   cachava HTML sotto chiavi sbagliate; inoltre `/` veniva cachata "per
   sempre" al primo install (nessuna invalidazione), rendendo invisibili i
   deploy successivi ai browser che avevano già visitato il sito. **Fix**:
   rimossi i path inesistenti da `urlsToCache`; strategia diventata
   network-first per le navigazioni e per `/api/*`; `activate` ora elimina
   le cache di versioni precedenti e chiama `self.clients.claim()`.
   Versione cache bump a `sportclub-manager-v2`. La pagina di login ha un
   pulsante di debug "Pulisci cache/service worker e ricarica" per gli
   utenti bloccati da una cache vecchia.

3. **`MSYS_NO_PATHCONV` non impostato durante `docker build` da Git Bash** —
   `--build-arg REACT_APP_API_URL=/api` veniva silenziosamente convertito da
   Git Bash in un path Windows (tipo `C:/Program Files/Git/api`) prima di
   arrivare a `docker.exe`, perché MSYS2 converte automaticamente qualsiasi
   argomento che comincia per `/`. Risultato: `axios.baseURL` diventava
   quel path Windows e ogni chiamata API falliva istantaneamente con
   `AxiosError: Unsupported protocol C:` — visibile all'utente come un
   errore "velocissimo e illeggibile" al login, senza nessuna richiesta
   loggata sul server. **Fix**: `export MSYS_NO_PATHCONV=1` solo attorno al
   comando `docker build` (vedi sezione sopra). **Sempre verificare** dopo
   la build che il valore corretto sia finito nel bundle:
   ```bash
   docker run --rm --entrypoint sh "$IMAGE" -c "grep -o '\"/api\"' build/static/js/main.*.js"
   ```

## Diagnosi di bug frontend senza DevTools disponibili
Se F12/DevTools non si aprono (es. policy aziendale sulla macchina) e serve
vedere errori JS/console/network di una pagina in produzione, riprodurre con
Playwright headless invece di chiedere all'utente di leggere una console che
non riesce ad aprire:
```bash
npm install playwright --no-save   # in una cartella scratch, non nel repo
npx --yes playwright install chromium --with-deps
node repro-script.js   # vedi pattern: page.on('console'|'pageerror'|'requestfailed'|'response', ...)
```
Non serve conoscere credenziali valide per riprodurre un bug di login: basta
inviare il form con credenziali finte e osservare cosa succede prima ancora
che la risposta del server arrivi (es. errori sincroni lato client come
`Unsupported protocol`).
