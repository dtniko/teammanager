# Spec: Onboarding — collegamento account a profilo atleta (post cambio-password)

## Contesto
Al primo login esiste già il flusso "cambia password" (vedi `src/App.js:78-88`,
`src/components/Auth/ChangePassword.js`, `server/routes/auth.js:10-116`,
`src/contexts/AuthContext.js`). Dopo quello step va aggiunto un secondo step
obbligatorio, SOLO per utenti con `role IN ('athlete','parent')`:

- **Atleta**: deve collegare il proprio account a un profilo `athletes`
  esistente (select tra atleti già creati e non ancora collegati a nessun
  account) oppure crearne uno nuovo.
- **Genitore**: deve collegare il proprio account a un profilo atleta FIGLIO
  (stessa logica: select tra atleti esistenti o crea nuovo), specificando la
  relazione (parent/guardian/tutor).
- In **entrambi i casi**, se sceglie un profilo ESISTENTE, la richiesta resta
  `pending` finché un admin o coach non la approva — l'utente vede una
  schermata di attesa. Se invece CREA un nuovo profilo, il collegamento è
  immediato (nessuna approvazione: è il caso in cui l'utente è la fonte di
  verità dei propri dati).
- Ruoli approvatori: `admin` e `coach` (il `coach` in UI è etichettato
  "Dirigente/Allenatore" — vedi `src/components/Layout/Layout.js:104` — non
  esiste un ruolo DB separato "dirigente").

Tabelle esistenti rilevanti (`database/schema.sql`):
- `users(id, email, role user_role, must_change_password, ...)` — enum
  `user_role`: admin/coach/parent/athlete.
- `athletes(id, ..., user_id INTEGER REFERENCES users(id))` — nullable,
  indice `idx_athletes_user_id`.
- `parent_athlete(parent_id → users, athlete_id → athletes, relationship,
  can_edit)` — già modella N:N genitore-figlio.

Pattern di riferimento per "redirect forzato post-login" da replicare:
`src/App.js:78-88` (mustChangePassword) + `AuthContext.js` righe ~89-95,
152-154 (stato lato client, funzione di update esposta dal context).

## Step 1 — Backend: migration + route onboarding

### 1a. Migration `database/migrations/003_add_profile_link_requests.sql`
```sql
CREATE TABLE profile_link_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  context VARCHAR(10) NOT NULL CHECK (context IN ('athlete','parent')),
  relationship VARCHAR(20),
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_profile_link_requests_user_id ON profile_link_requests(user_id);
CREATE INDEX idx_profile_link_requests_status ON profile_link_requests(status);
```
Nota: niente UNIQUE rigido — la route applicativa controlla "non creare un
altro pending se ce n'è già uno identico" prima dell'insert.

Aggiungere la stessa DDL anche in fondo a `database/schema.sql` (così un DB
nuovo la include già), seguendo lo stile delle tabelle esistenti.

### 1b. Nuovo file `server/routes/onboarding.js`, montato in `server/index.js`
su `app.use('/api/onboarding', require('./routes/onboarding'))` — **prima**
del blocco catch-all SPA, seguendo l'ordine già corretto delle altre route
`/api/*` (vedi bug #1 documentato in CLAUDE.md di progetto: il catch-all va
sempre dopo tutte le route API).

Middleware: riusa `authenticateToken` (o come si chiama in
`server/middleware/auth.js`, verificare nome esatto leggendo il file) su
tutte le route sotto, e `requireRole(['admin','coach'])` sulle route di
approvazione.

Endpoint:

1. `GET /api/onboarding/status`
   Calcola per `req.user`:
   - se `role` non è `athlete`/`parent` → `{ needsOnboarding: false, state: 'done' }`
   - `athlete`: se esiste riga in `athletes` con `user_id = req.user.id` →
     `done`. Altrimenti se esiste `profile_link_requests` con
     `user_id=req.user.id AND context='athlete' AND status='pending'` →
     `{ needsOnboarding: true, state: 'pending', request: {...} }`.
     Altrimenti `{ needsOnboarding: true, state: 'select' }`.
   - `parent`: stessa logica ma controllando `parent_athlete` (almeno una
     riga con `parent_id = req.user.id`) invece di `athletes.user_id`, e
     `context='parent'` per il pending.

2. `GET /api/onboarding/available-athletes?context=athlete|parent&search=`
   - `context=athlete`: `SELECT id, first_name, last_name, birth_date FROM athletes WHERE user_id IS NULL AND (ricerca opzionale per nome)`.
   - `context=parent`: stessa query ma senza il filtro `user_id IS NULL`
     (un atleta può avere più genitori collegati).
   Ordina per cognome/nome, limita a ~50 risultati.

3. `POST /api/onboarding/link-existing`
   Body: `{ athleteId, context, relationship? }` (`relationship` obbligatorio
   se `context='parent'`, valori: `parent|guardian|tutor`).
   - Validare che non esista già un `profile_link_requests` pending identico
     per questo utente (stesso `user_id`+`context`, qualunque `athleteId`) —
     se esiste, rispondere 409.
   - Se `context='athlete'`, validare che l'atleta scelto abbia
     `user_id IS NULL` (altrimenti 409, "profilo già collegato").
   - Insert riga `profile_link_requests` status `pending`. Risposta 201.

4. `POST /api/onboarding/create-profile`
   Body: `{ context, relationship?, athleteData: {...} }` — `athleteData`
   con gli stessi campi richiesti dalla creazione atleta esistente in
   `server/routes/athletes.js` (riusare la stessa validazione/shape, non
   duplicarla se estraibile in una funzione condivisa; altrimenti replicare
   i campi minimi: first_name, last_name, birth_date, ecc. — leggere il file
   per i campi NOT NULL esatti).
   - `context='athlete'`: crea riga `athletes` con `user_id = req.user.id`
     dentro una transazione. Risposta 201 con l'atleta creato, collegamento
     immediato (nessuna richiesta pending).
   - `context='parent'`: crea riga `athletes` (`user_id` NULL, è il figlio)
     + riga `parent_athlete(parent_id=req.user.id, athlete_id=nuovo_id,
     relationship)`, stessa transazione. Risposta 201.

5. `GET /api/onboarding/pending-requests` (solo admin/coach)
   Lista `profile_link_requests` status `pending`, JOIN su `users` (email,
   nome) e `athletes` (nome, cognome), ordinata per `created_at`.

6. `POST /api/onboarding/requests/:id/approve` (solo admin/coach)
   - Ricarica la richiesta, deve essere `pending` (altrimenti 409).
   - `context='athlete'`: verifica `athletes.user_id IS NULL` per l'atleta
     target (altrimenti 409 — nel frattempo collegato da qualcun altro),
     poi `UPDATE athletes SET user_id = request.user_id`.
   - `context='parent'`: `INSERT INTO parent_athlete(parent_id, athlete_id,
     relationship) VALUES (request.user_id, request.athlete_id,
     request.relationship)`.
   - Aggiorna la richiesta: `status='approved', reviewed_by=req.user.id,
     reviewed_at=NOW()`. Tutto in una transazione.

7. `POST /api/onboarding/requests/:id/reject` (solo admin/coach)
   Body opzionale `{ reason }` (se c'è già una colonna adatta altrimenti
   ignorare/non persistere il motivo, non aggiungere colonne extra per
   questo). `status='pending'` richiesto, altrimenti 409. Aggiorna
   `status='rejected', reviewed_by, reviewed_at`.

Verifica: `node -e` o avvio server locale + qualche `curl` manuale non è
necessario in questo step; la validazione sintattica/require del modulo è
sufficiente (verrà esercitato end-to-end nello Step 2/3 via browser).

## Step 2 — Frontend: flusso utente (select / crea / attesa)

### 2a. `src/contexts/AuthContext.js`
Aggiungere, seguendo il pattern esistente di `mustChangePassword` /
`updateMustChangePassword` (righe ~89-95, 152-154):
- stato `onboardingStatus` (null finché non caricato) fetchato da
  `GET /api/onboarding/status` subito dopo il login riuscito (e su
  refresh/mount se c'è già un token valido).
- funzione `refreshOnboardingStatus()` esposta dal context, da richiamare
  dopo ogni azione di onboarding (crea profilo / invia richiesta) per
  aggiornare lo stato senza richiedere un nuovo login.

### 2b. `src/App.js`
Dopo il blocco `mustChangePassword` (righe 78-88) e prima del render di
`<Layout>`/`<Routes>` (riga 90), aggiungere blocco analogo: se
`onboardingStatus?.needsOnboarding` è true e la route corrente non è
`/link-profile`, redirect forzato a `/link-profile`; se è false ma sei su
`/link-profile`, redirect a `/dashboard`. Stesso pattern if/else sequenziale
già usato nel file (non introdurre un guard component nuovo, restare
coerenti con lo stile esistente).

### 2c. Nuovo componente `src/components/Onboarding/LinkProfile.js`
- Legge `onboardingStatus` dal context.
- **state 'pending'**: schermata di sola lettura, messaggio tipo "La tua
  richiesta di collegamento al profilo [nome atleta] è in attesa di
  conferma da parte di un amministratore o dirigente.", bottone
  "Aggiorna stato" che chiama `refreshOnboardingStatus()`.
- **state 'select'**: due sezioni/tab:
  - "Collega un profilo esistente": campo di ricerca + select popolata da
    `GET /api/onboarding/available-athletes?context=...`; per `parent`
    aggiungere select relazione (parent/guardian/tutor). Bottone "Invia
    richiesta" → `POST /api/onboarding/link-existing` → su successo,
    `refreshOnboardingStatus()` (porta lo stato a `pending`, la UI si
    aggiorna da sola).
  - "Crea nuovo profilo atleta": form con gli stessi campi del form atleti
    esistente (riusare `src/components/Athletes/AthleteForm.js` se estraibile
    come componente condiviso senza rompere l'uso attuale in
    `src/App.js:17,96-97`; altrimenti duplicare solo i campi minimi
    necessari, non l'intero componente admin). Submit →
    `POST /api/onboarding/create-profile` → su successo,
    `refreshOnboardingStatus()` (porta lo stato a `done`, `App.js` fa il
    redirect automatico alla dashboard).
- Testo/etichette in italiano, coerenti con il resto della UI (vedi
  `src/components/Groups/GroupDetail.js:21-25` per lo stile label ruoli).

### 2d. Route
Aggiungere `/link-profile` tra le route disponibili (fuori dal blocco
`<Layout>` come `/change-password`, stesso pattern di App.js righe 78-88 —
verificare se `/change-password` è renderizzato fuori da `<Routes>` o dentro,
replicare esattamente quello schema per `/link-profile`).

## Step 3 — Frontend: UI approvazione (admin/coach)

### 3a. Nuovo componente `src/components/Onboarding/PendingApprovals.js`
- Solo visibile/instradabile per `admin`/`coach` (stesso pattern di
  controllo ruolo di `src/App.js:101-104`).
- Fetch `GET /api/onboarding/pending-requests`, tabella con: utente
  richiedente (email/nome), tipo (atleta/genitore), atleta target,
  relazione (se genitore), data richiesta, bottoni "Approva"/"Rifiuta".
- Approva → `POST /api/onboarding/requests/:id/approve`, rimuove la riga
  dalla lista in ottimistico o rifetch.
- Rifiuta → `POST /api/onboarding/requests/:id/reject`, stessa gestione.

### 3b. Navigazione
Aggiungere voce di menu "Richieste da approvare" (o simile) in
`src/components/Layout/Layout.js`, visibile solo a admin/coach, che punta
alla nuova route `/pending-approvals` (registrata dentro `<Layout>`/
`<Routes>` come le altre pagine admin, non fuori come `/link-profile`).
Se esiste già un badge/contatore pattern nel Layout per altre notifiche,
valutare di mostrare il numero di richieste pending sulla voce di menu
(opzionale, solo se il pattern esiste già — non introdurne uno nuovo da
zero per questo).

## Verifica finale (delegata a un subagent di verifica, non nel main agent)
- Avviare l'app (docker compose o `npm start` a seconda di come gira di
  solito questo progetto — leggere `docker-compose.yml`/README se serve) e
  con Playwright (vedi sezione "Diagnosi bug frontend" in CLAUDE.md di
  progetto se DevTools non disponibili) testare almeno un percorso completo:
  1. Login come atleta al primo accesso → cambio password → schermata
     collega profilo → crea nuovo profilo → arriva alla dashboard.
  2. Login come genitore al primo accesso → collega profilo esistente →
     schermata di attesa.
  3. Login come admin → vede la richiesta pending → approva → il genitore
     al login successivo risulta `done`.
- Ricordarsi (memoria di progetto): dopo modifiche a `src/`, se il progetto
  gira via Docker con volume mount, serve rigenerare `build/` con
  `docker compose exec app npm run build` — un semplice rebuild immagine non
  basta.
