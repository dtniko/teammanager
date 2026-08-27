# Gestione documenti atleta (anno sportivo + storage persistente)

## Contesto
Il backend documenti esiste già ed è collegato ad `athletes` + `seasons`
(`server/routes/documents.js`, tabella `documents`: `payment`,
`medical_certificate`, `other`). Mancano però tre pezzi, confermati con
l'utente:

1. Non esiste nessun modo per admin/coach di **creare un nuovo anno
   sportivo** — la tabella `seasons` viene popolata solo via seed SQL
   manuale (`server/config/database.js:83`). L'utente vuole l'anno sportivo
   come **stringa libera** (es. "2026/27"), non vincolata a date precise.
2. La tab "Documenti" in `src/components/Athletes/AthleteDetail.js` è solo
   un placeholder: `handleDocumentUpload` (righe 111-137) manda sempre
   `documentType: 'other'` con un commento esplicito
   `// Default, l'utente dovrebbe poter scegliere` — niente selezione di
   tipo documento, titolo, stagione o data di scadenza.
3. I file vengono salvati su **filesystem locale del container**
   (`server/routes/documents.js:11-28`, `server/uploads/documents/`), che
   su Cloud Run è effimero: ad ogni deploy/riavvio i documenti caricati
   spariscono. Da migrare a **Supabase Storage** (il progetto già usa
   Supabase per il DB).

Decisioni utente (non rimetterle in discussione):
- I documenti restano legati solo all'atleta (`athlete_id`), MAI ai coach.
  Nessuna modifica al legame di `documents` con `athletes`.
- `seasons`: rendere `start_date`/`end_date` opzionali via migration, il
  form di creazione stagione chiede solo il **nome** (stringa libera).
- Storage: migrare subito a Supabase Storage, non rimandare.

Non toccare: logica di scadenza/validità già presente
(`expiring_soon`/`expired` in `documents.js:55-115`, route
`GET /expiring` e `PATCH /:documentId/validity`), permessi per ruolo già
implementati (admin/coach/parent con `can_edit`/atleta stesso).

---

## STEP 1 — Migration: stagioni con nome libero

File: `database/migrations/007_make_season_dates_optional.sql`

```sql
ALTER TABLE seasons ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE seasons ALTER COLUMN end_date DROP NOT NULL;
```

Aggiornare anche `database/schema.sql` (righe 27-34, tabella `seasons`)
togliendo `NOT NULL` da `start_date`/`end_date`, così uno schema creato da
zero è coerente con la migration.

---

## STEP 2 — Backend: route CRUD stagioni

Nuovo file `server/routes/seasons.js`, stesso pattern di
`server/routes/documents.js` (auth via `req.user`, `getClient()`/`query()`,
response shape `{ success, ... }` / `{ error }`).

Route:
- `GET /` — lista tutte le stagioni, ordinate per `id DESC` (le più recenti
  prima). Accessibile a qualunque utente autenticato (serve anche per i
  filtri/select lato atleta).
- `POST /` — crea stagione. **Solo `admin`/`coach`**. Body: `{ name }`
  (obbligatorio, stringa libera), `startDate`/`endDate` opzionali (se non
  forniti restano `NULL`), `isCurrent` opzionale (default `false`).
  Se `isCurrent === true`, dentro una transazione: prima
  `UPDATE seasons SET is_current = false`, poi insert della nuova con
  `is_current = true` (mai più stagioni correnti contemporaneamente).
- `PATCH /:seasonId/set-current` — **Solo `admin`/`coach`**. Stessa logica
  transazionale: azzera `is_current` su tutte, lo imposta `true` solo su
  `:seasonId`.
- `PATCH /:seasonId` — **Solo `admin`/`coach`**. Aggiorna `name` (e
  opzionalmente date) di una stagione esistente.

Non serve DELETE (una stagione con documenti/gruppi collegati non va
cancellabile; fuori scope).

Registrare in `server/index.js` accanto alle altre route (vedi riga 11 e
42 per il pattern `documentRoutes`):
```js
const seasonRoutes = require('./routes/seasons');
app.use('/api/seasons', authenticateToken, seasonRoutes);
```

---

## STEP 3 — Frontend: gestione stagioni (admin/coach)

1. `src/services/apiService.js` — aggiungere sezione
   `// === SEASON ENDPOINTS ===` (stesso pattern delle
   `GROUP ENDPOINTS` a riga 173): `getSeasons()`, `createSeason(data)`,
   `setCurrentSeason(seasonId)`, `updateSeason(seasonId, data)`.

2. Nuovo componente `src/components/Seasons/Seasons.js` (ricalca
   `src/components/Groups/Groups.js`: lista + form di creazione inline o
   modale). Campi form creazione: solo `name` (input testo, placeholder
   "es. 2026/27") + checkbox "Imposta come stagione corrente". Lista mostra
   nome, badge "Corrente" sulla stagione con `is_current = true`, azione
   "Imposta come corrente" sulle altre.

3. Route in `src/App.js` (stesso pattern delle altre pagine, es. Groups) —
   path `/seasons`, accessibile solo a `admin`/`coach` (controllare come
   viene fatto il gating per ruolo sulle altre route in `App.js`, riusare
   lo stesso meccanismo).

4. Voce di menu in `src/components/Layout/Layout.js` (vedi struttura
   attorno a riga 292, icona lucide `Settings` già importata) — nuova voce
   "Stagioni" visibile solo ad `admin`/`coach`, verso `/seasons`.

---

## STEP 4 — Backend: migrare storage documenti su Supabase Storage

File coinvolto: `server/routes/documents.js` (righe 1-403).

1. Nuovo file `server/config/supabaseStorage.js`:
   ```js
   const { createClient } = require('@supabase/supabase-js');
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_SERVICE_ROLE_KEY
   );
   const DOCUMENTS_BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET || 'documents';
   module.exports = { supabase, DOCUMENTS_BUCKET };
   ```
2. `documents.js:11-28` — sostituire `multer.diskStorage` con
   `multer.memoryStorage()` (il file arriva in `req.file.buffer`, non più
   scritto su disco). Mantenere invariati `fileFilter` e limite 10MB.
3. `POST /upload` (riga 117) — invece di scrivere su disco, generare una
   storage key tipo `athlete-<athleteId>/<timestamp>-<random>.<ext>` e fare:
   ```js
   const { error } = await supabase.storage
     .from(DOCUMENTS_BUCKET)
     .upload(storageKey, req.file.buffer, { contentType: req.file.mimetype });
   ```
   In caso di errore upload, rispondere 500 senza scrivere la riga DB.
   Salvare `storageKey` nella colonna esistente `file_path` (resta TEXT,
   cambia solo il significato: da path assoluto locale a chiave storage).
4. `GET /download/:documentId` (riga 213) — dopo i controlli di permesso
   già esistenti, invece di `fs.existsSync` + `res.sendFile`:
   ```js
   const { data, error } = await supabase.storage
     .from(DOCUMENTS_BUCKET)
     .download(document.file_path);
   ```
   e streammare il buffer al client (`res.setHeader('Content-Type', ...)`,
   `res.send(Buffer.from(await data.arrayBuffer()))`) — **non** usare
   signed URL pubblici, perché il controllo permessi per ruolo deve restare
   lato server (bucket privato).
5. `DELETE /:documentId` (riga 272) — sostituire `fs.unlinkSync` con
   `await supabase.storage.from(DOCUMENTS_BUCKET).remove([document.file_path])`
   prima/dopo il `DELETE` SQL (se lo storage fallisce, loggare ma non
   bloccare la cancellazione della riga DB — coerente con la gestione
   errori già presente nel file per casi simili).
6. Rimuovere `fs`/`path` import se non più usati altrove nel file dopo le
   modifiche.

**Nota bucket**: il bucket Supabase Storage va creato manualmente (privato,
non serve farlo da codice) — a fine implementazione, avvisare l'utente di
crearlo su Supabase dashboard col nome in `SUPABASE_DOCUMENTS_BUCKET`
(default `documents`) prima di testare in produzione.

### Env vars da aggiungere
`.env.example` — nuova sezione dopo "FILE UPLOAD CONFIGURATION":
```
# ===============================================
# SUPABASE STORAGE (documenti atleti)
# ===============================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_DOCUMENTS_BUCKET=documents
```
Stessa cosa in `docker-compose.yml` (sezione env del servizio `app`, se le
altre env vars applicative sono lì elencate — verificare pattern esistente
prima di aggiungere).

Non serve toccare `Secret Manager`/Cloud Run in questo step (deploy è
un'azione separata, fuori dallo scope dell'implementazione — lasciare
comunque una nota nel report finale che in produzione servirà creare il
secret `sportclub-supabase-service-role-key` e la env var
`SUPABASE_URL`/`SUPABASE_DOCUMENTS_BUCKET`, seguendo il pattern già
documentato in `CLAUDE.md` per `sportclub-database-url`).

---

## STEP 5 — Frontend: form di upload documento completo

File: `src/components/Athletes/AthleteDetail.js`.

Sostituire l'input file "nudo" (righe 111-137, 466-520 circa) con un
piccolo form/modale che si apre al click su "Carica Documento", con:
- **Tipo documento**: select con le 3 opzioni esistenti
  (`getDocumentTypeLabel`, riga 92-99: `payment` → "Attestazione di
  Pagamento", `medical_certificate` → "Certificato Medico", `other` →
  "Altro Documento").
- **Titolo**: input testo, precompilato col nome file, editabile.
- **Stagione**: select popolata da `apiService.getSeasons()` (nuovo
  endpoint dello STEP 3), preselezionata sulla stagione con
  `is_current = true`.
- **Data di scadenza**: input date, opzionale.
- **File**: deve permettere sia di scegliere un file esistente sul device
  (PDF o immagine) sia di scattare una foto al volo da telefono. Soluzione
  standard HTML: due input file distinti/due pulsanti — uno
  `<input type="file" accept="application/pdf,image/*">` per scegliere un
  file esistente, e uno `<input type="file" accept="image/*" capture="environment">`
  per aprire direttamente la fotocamera (l'attributo `capture` su mobile
  apre la camera invece della galleria; su desktop dove non c'è fotocamera
  il browser ignora `capture` e si comporta come un normale file picker,
  quindi non serve nascondere il secondo pulsante su desktop). Qualunque
  dei due venga usato, popola lo stesso stato/file selezionato nel form.

Solo al submit del form chiamare `apiService.uploadDocument(formData)` con
tutti i campi (`documentType`, `title`, `seasonId`, `expiryDate` oltre a
`document` e `athleteId`) — non più al semplice `onChange` dell'input file.

Aggiungere inoltre un **filtro per stagione** sopra la lista documenti
(select stagione → ricarica `loadDocuments` passando `seasonId` al backend,
che già supporta questo filtro in `documents.js:55` `GET /athlete/:athleteId`),
default sulla stagione corrente.

---

## STEP 6 — Notifiche di scadenza documento (6 soglie, atleta+coach+genitori)

Richiesta utente: quando un documento con `expiry_date` valorizzata si
avvicina alla scadenza, deve arrivare un avviso a **atleta, coach e
genitori collegati**, alle soglie **3 mesi / 2 mesi / 1 mese / 2 settimane
/ 1 settimana / scaduto**, con gravità e colore via via crescenti.

Esiste già un job cron giornaliero `document-expiry-check`
(`server/services/scheduler.js:15-18`, `0 9 * * *`, timezone
`Europe/Rome`, libreria `node-cron`) che chiama
`notifyDocumentExpiry()` (`server/routes/notifications.js:285-348`), ma
oggi ha solo 2 soglie hardcoded (7gg/30gg) e notifica solo genitore+admin.
**Va riscritta**, non creata da zero. Non toccare il cron scheduling in sé
(resta `0 9 * * *`, un giro al giorno basta: con soglie a giorni esatti
il job scatta una sola volta per soglia).

### Soglie e gravità
Calcolare `giorni_rimanenti = expiry_date - CURRENT_DATE` e far scattare
la notifica quando `giorni_rimanenti` è **esattamente** uno di questi
valori (per non ri-notificare ogni giorno):

| giorni rimanenti | soglia            | `type` notifica | colore (nuovo/esistente) |
|---|---|---|---|
| 90 | 3 mesi           | `info`     | esistente (grigio/blu) |
| 60 | 2 mesi           | `notice`   | nuovo (azzurro/teal) |
| 30 | 1 mese           | `warning`  | esistente (giallo) |
| 14 | 2 settimane      | `high`     | nuovo (arancione) |
| 7  | 1 settimana      | `urgent`   | esistente (rosso) |
| <=0 (scaduto, solo il giorno in cui `expiry_date = CURRENT_DATE`) | scaduto | `expired` | nuovo (rosso scuro/nero) |

Riusare il pattern SQL già presente in
`server/routes/documents.js:343-367` (route `GET /expiring`, CASE su
`expiry_date`) per calcolare i giorni rimanenti, ma con `WHERE`
sull'uguaglianza esatta sulle 6 soglie invece che `<=`.

### Destinatari (per ogni documento in una delle soglie)
Recuperare, per il singolo `athlete_id` del documento (non per gruppo
come fa oggi il codice esistente per gli eventi):
- **Atleta stesso**: `athletes.user_id` (se valorizzato — l'atleta ha un
  account collegato).
- **Genitori**: `parent_athlete` (righe 68-76 schema) → `parent_id`.
- **Coach**: `athlete_group` (righe 79-88) per risalire ai `group_id`
  dell'atleta, poi `staff_group` (righe 91-99) per gli `user_id` con
  `role` coach/manager/assistant su quei gruppi.

Deduplicare gli `user_id` risultanti (un utente potrebbe comparire più
volte, es. coach che è anche genitore) e usare
`createBulkNotifications(userIds, title, message, type, 'document', documentId)`
(`server/routes/notifications.js:250-282`, già gestisce insert + push).

Messaggio: includere sempre nome atleta, tipo documento
(`getDocumentTypeLabel`-equivalente lato server: `payment` → "Attestazione
di Pagamento", `medical_certificate` → "Certificato Medico", `other` →
"Altro Documento") e la soglia in linguaggio naturale (es. "Il certificato
medico di Mario Rossi scade tra 2 settimane" / "...è scaduto").

### Frontend — nuovi colori/icone
`src/components/Notifications/NotificationDropdown.js:44-74`
(`getNotificationIcon`, `getNotificationColor`) — aggiungere i 3 nuovi
`type` (`notice`, `high`, `expired`) alla mappatura, mantenendo una scala
di gravità visivamente crescente rispetto a quelli esistenti (`info` <
`notice` < `warning` < `high` < `urgent` < `expired`, quest'ultimo il più
"grave" — es. rosso scuro/bordeaux, non lo stesso rosso di `urgent`).

---

## Ordine di implementazione consigliato
1. STEP 1 (migration) + STEP 2 (route seasons) — un solo giro di
   `implementer`, verificabile con una chiamata `curl` alle nuove route.
   **[FATTO]**
2. STEP 3 (frontend stagioni) — un giro `implementer` a parte.
3. STEP 4 (storage Supabase) — un giro `implementer` a parte, è la parte
   più delicata (richiede che l'utente crei il bucket per testare
   davvero l'upload end-to-end).
4. STEP 5 (form upload completo) — dipende dall'endpoint stagioni dello
   STEP 2/3 e dai campi già accettati da STEP 4.
5. STEP 6 (notifiche scadenza) — indipendente dagli altri step (tocca
   `notifications.js`/`scheduler.js`/`NotificationDropdown.js`), può
   essere fatto in parallelo a STEP 3/4/5 in un giro `implementer` a
   parte.
