# Notifica "allenamento modificato" con dettaglio di cosa è cambiato

## Obiettivo
Quando un evento/allenamento viene **modificato** (PUT), la notifica spedita a
genitori/atleti (e staff) deve indicare **cosa è cambiato**: ora, data, luogo —
con i valori prima/dopo. Decisione utente: dettagli su **ora, data, luogo**
(non titolo/descrizione).

Esempi di messaggio atteso (sezione `message` di `notifications` = body push):
- `Data: 7 settembre 2026 · Orario: 17:00–18:30 → 18:00–19:30 · Luogo: itg → Delai`
- `Orario: 17:00–18:30 → 17:30–19:00` (solo ora)
- `Luogo: itg → Delai` (solo luogo)
- Se cambia solo titolo/descrizione (campi non tracciati): generico
  `${label} modificato: ${event.title} – ${eventDate}` (vedi sotto).

## Fatti dal codice (verificati)
- `server/routes/notifications.js:503` — `notifyEventCreatedOrUpdated(eventId, groupId, createdBy, eventType)`:
  ri-legge l'evento da DB (è chiamata **dopo** CREATE e dopo UPDATE → `event`
  contiene i valori **nuovi**), destina a: admin+coach attivi (escluso
  `createdBy`), genitori via `parent_athlete`, atleti con account. Oggi **nessuna
  distinzione** creazione/aggiornamento: titoli "Nuovo allenamento programmato"
  (staff) / "Nuovo ${label}: ${title}" (genitori/atleti).
- `createBulkNotifications(userIds, title, message, 'info', 'event', eventId)`
  (notifications.js:279-311) → INSERT in `notifications` + web push
  `{title, body: message, url:'/notifications'}`. **Nessuna migrazione né
  cambio webPush.js**: `message` è TEXT e diventa il body push.
- `server/routes/events.js` — call site:
  - CREATE: `events.js:462-470` (solo se `!isRecurring`).
  - UPDATE: `events.js:532-539`. **Non esiste SELECT dello stato precedente**
    (l'unico SELECT pre-UPDATE a :513 è il check di accesso coach).
  - Colonne aggiornabili nell'UPDATE (:513-518): `title, description,
    event_type, start_datetime, end_datetime, location, is_recurring,
    recurring_pattern`.
- Schema `notifications` (database/schema.sql:177-187): `title VARCHAR(255),
  message TEXT, type, related_type, related_id, is_read, sent_at`.
- Pattern da imitare: `notifyAttendanceChanged` (notifications.js:599-671) —
  il **chiamante** legge lo stato precedente e lo passa come parametro; la
  funzione compone il testo.
- I timestamp sono `TIMESTAMP` naive; server Cloud Run in UTC → i componenti
  "a muro" sono le componenti **UTC** del `Date` restituito da pg. Lo stile
  esistente in notifications.js usa già `toLocaleDateString('it-IT')` /
  `toLocaleTimeString('it-IT')` (es. :412, :516) che su server UTC restituisce
  l'ora a muro: **riutilizza lo stesso stile**.
- `eventLabel`: `'training' → 'allenamento'`, altrimenti `'evento'` (pattern
  esistente a notifications.js:412).

## Cambiamenti

### 1. `server/routes/events.js` — leggere lo stato precedente nel PUT
Subito **prima** dell'UPDATE (se l'UPDATE è in una transazione client, mettere
la SELECT nella stessa transazione), leggere la riga:
```sql
SELECT title, event_type, start_datetime, end_datetime, location
FROM events WHERE id = $1
```
Passare la vecchia riga (o `null` se assente) al call site di notifica
(events.js:532-539) come **nuovo 5° parametro** `previousEvent`.
Al call site di CREATE (events.js:462-470) passare `null` (o omettere).

### 2. `server/routes/notifications.js` — firma + ramificazione
`notifyEventCreatedOrUpdated(eventId, groupId, createdBy, eventType, previousEvent = null)`

- **`previousEvent === null`** (creazione): comportamento e testi **invariati**.
- **`previousEvent` presente** (modifica):
  - Confrontare, in modo robusto (trim + case-insensitive per `location`):
    - **Data**: parte data di `start_datetime` (vecchia vs nuova).
    - **Orario**: `HH:MM` di inizio E fine (`start_datetime`, `end_datetime`).
      Basta che uno dei due differisca → riga Orario con l'intervallo completo
      vecchio → nuovo.
    - **Luogo**: `location` (null/'' ↔ valore conta come cambiamento;
      visualizzare `–` per i vuoti).
  - Costruire `changes` = lista di segmenti, **nell'ordine**: Data, Orario,
    Luogo, ciascuno formato:
    - Data: `Data: ${old} → ${new}` con `toLocaleDateString('it-IT')`
      (es. `7 settembre 2026`).
    - Orario: `Orario: ${oldStart}–${oldEnd} → ${newStart}–${newEnd}` con
      `toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})`.
    - Luogo: `Luogo: ${old} → ${new}`.
  - `title` (staff): `Modificato: ${event.title}` · (genitori/atleti):
    `${label} modificato: ${event.title}` — stesso schema titoli della
    creazione attuale, adattato.
  - `message`:
    - se `changes.length > 0`: `${eventDate} — ${changes.join(' · ')}` dove
      `eventDate` = data + orario **nuovi** formatati come nei messaggi
      esistenti (usa lo stesso formato data già usato nella funzione per la
      creazione).
    - se `changes.length === 0` (cambiati solo titolo/descrizione/altro):
      `message = ${event.title} – ${eventDate}` (il titolo già dice
      "modificato").
  - Resto invariato: stessi destinatari, stesso `createdBy` escluso, stesso
    `createBulkNotifications(..., 'info', 'event', eventId)`.
  - Se **nessuna** notifica va spedita (nessun destinatario) non fare nulla,
    come oggi.

### 3. Non toccare
- CREATE (testi "Nuovo …" invariati).
- `webPush.js`, `sw.js`, frontend (`NotificationContext.js` legge già
  `title`+`message` → il nuovo testo arriva in-app e nel push senza modifiche).
- `notifyAttendanceChanged` e altre notifiche.
- Migrazioni: nessuna.

## Verifica (obbligatoria)
Setup: postgres effimero su 5433 (`docker run -d --rm --name tm-notify-pg -e
POSTGRES_PASSWORD=vertestpw -p 5433:5432 postgres:15-alpine` oppure PG locale
Homebrew), server su **8001** con `TZ=UTC`:
`DATABASE_URL="postgres://postgres:vertestpw@127.0.0.1:5433/postgres" DB_SSL=false NODE_ENV=production PORT=8001 TZ=UTC node server/index.js`
(Porta 8000 = backend utente, mai toccare. `node --check` sui file modificati.)

Casi (crea un evento di test + 1-2 utenti destinatari di ruoli diversi nel DB;
i push web falliranno senza VAPID: atteso e ignorable, deve restare solo
l'INSERT in `notifications`):
1. **PUT cambia ora+luogo** (17:00–18:30/itg → 18:00–19:30/Delai): righe in
   `notifications` con `message` contenente `Orario: 17:00–18:30 → 18:00–19:30`
   e `Luogo: itg → Delai`; titolo "…modificato…".
2. **PUT cambia solo luogo**: solo segmento Luogo.
3. **PUT cambia solo titolo**: titolo "modificato", message generico
   (nessun segmento "→" fasullo).
4. **PUT senza reali cambi** (stessi valori): se si invia comunque la
   notifica, il message non deve contenere "→" spurio. (Se il codice oggi
   notifica comunque al PUT, lascia così: verifica solo che il testo sia
   coerente.)
5. **POST create**: message invariato ("Nuovo …" con data), nessuna "→".
6. `createdBy` escluso dai destinatari (come oggi).

A fine test: fermare server/postgres di test, pulire eventuali righe di test se
si è usato un DB condiviso (con l'effimero non serve).

## File toccati (attesi)
- `server/routes/events.js` — SELECT pre-UPDATE nel PUT + nuovo parametro.
- `server/routes/notifications.js` — 5° parametro + ramo "modifica" con diff.