# Spec: Eventi ricorrenti (es. "ogni martedì fino al ...")

## Problema
Il DB ha già `events.is_recurring` e `events.recurring_pattern` (JSONB), e
`server/routes/events.js` (`POST /events`, `PUT /events/:eventId`) già
accetta/salva `isRecurring`/`recurringPattern`, ma **non genera mai più di
un evento**: crea sempre una singola riga. Il form "Nuovo evento" in
`src/components/Calendar/CalendarPage.js` non espone nemmeno l'opzione. Va
implementata la generazione reale di occorrenze settimanali (weekly, stesso
giorno della settimana dello `startDatetime`) fino a una data limite.

## Scope
Solo la **creazione** genera la serie di eventi reali (una riga per
occorrenza in `events`, con relative righe `attendance` se c'è un gruppo —
serve per poter segnare le presenze allenamento per allenamento).
Modifica/eliminazione restano per-singolo-evento come oggi (le rotte PUT e
DELETE su `/:eventId` non vanno toccate) — fuori scope gestire "modifica
tutta la serie". Non aggiungere quella funzionalità.

## 1. Migration DB
Crea `database/migrations/004_add_recurring_group_id.sql` seguendo lo stile
di `database/migrations/003_add_actual_attendance.sql` (usa `ALTER TABLE
... ADD COLUMN IF NOT EXISTS`):
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurring_group_id UUID;
CREATE INDEX IF NOT EXISTS idx_events_recurring_group_id ON events(recurring_group_id);
```
Aggiorna anche `database/schema.sql` aggiungendo la stessa colonna
nella `CREATE TABLE events` (intorno alla riga 129-130, vicino a
`is_recurring`/`recurring_pattern`), per gli ambienti che ripartono da
schema pulito. Non applicare tu stesso la migration al DB (nessuno script
di migrazione runner esiste nel repo — la applica l'utente come le
precedenti).

## 2. Backend — `server/routes/events.js`, `POST /` (riga ~311)
Estendi il body accettato con `recurringUntil` (stringa data `YYYY-MM-DD`,
il "fino al"). Logica:
- Se `isRecurring` è true e `recurringUntil` è presente: calcola le
  occorrenze partendo da `startDatetime`, passo di 7 giorni (stesso weekday,
  stessa ora/minuti e stessa durata di `endDatetime - startDatetime`),
  finché la data dell'occorrenza è `<=` `recurringUntil` (confronta solo la
  parte data). Limita difensivamente a max 104 occorrenze (2 anni) per
  evitare loop eccessivi da input malformati.
  - Genera un id di serie con `crypto.randomUUID()` (Node `crypto` core
    module, `require('crypto')`) condiviso da tutte le occorrenze.
  - Per ciascuna occorrenza, dentro la STESSA transazione già presente
    (`BEGIN`/`COMMIT`), inserisci una riga in `events` con gli stessi
    campi dell'evento singolo attuale, più `is_recurring = true`,
    `recurring_pattern = JSON.stringify({ frequency: 'weekly', until:
    recurringUntil })`, `recurring_group_id = <uuid della serie>`.
  - Se `groupId` è presente, crea le righe `attendance` per ciascuna
    occorrenza esattamente come già avviene oggi per l'evento singolo
    (stessa query, ripetuta per ogni evento creato).
  - Rispondi con `{ success: true, events: [...tutte le righe create...],
    event: events[0], count: events.length, message: 'N eventi creati con
    successo' }` (mantieni anche la chiave singolare `event` per
    retrocompatibilità con chi già legge `response.event`).
- Se `isRecurring` non è true (comportamento invariato): mantieni esattamente
  la logica attuale a singolo evento, ma la risposta deve comunque includere
  `events: [event]` e `count: 1` oltre a `event` esistente, per uniformità
  con il ramo ricorrente (il frontend userà `response.events`/`response.count`).
- Non modificare `PUT /:eventId` né `DELETE /:eventId`.

## 3. Frontend — `src/services/apiService.js`
Verifica la firma di `createEvent` (probabilmente
`createEvent(eventData) { return this.client.post('/events', eventData); }`)
— non serve cambiarla, il payload aggiuntivo (`isRecurring`,
`recurringUntil`) passa già attraverso l'oggetto esistente.

## 4. Frontend — `src/components/Calendar/CalendarPage.js`
- Aggiungi a `emptyForm` (riga ~30): `isRecurring: false, recurringUntil: ''`.
- `handleFormChange` gestisce già input testuali; per la checkbox serva
  gestire `e.target.checked` invece di `e.target.value` (aggiungi un
  branch o un handler dedicato `handleCheckboxChange`).
- Nel form JSX (dopo il blocco "Location", righe ~400-409, prima dei
  pulsanti finali), aggiungi:
  - Una checkbox "Evento ricorrente (settimanale)" legata a
    `form.isRecurring`.
  - Quando `form.isRecurring` è true, mostra:
    - Un testo informativo che calcola dinamicamente il giorno della
      settimana da `form.startDatetime` con date-fns, es. "Si ripeterà ogni
      **{giorno}** a partire dalla data di inizio sopra indicata." — usa
      `format(parseISO(form.startDatetime), 'EEEE', { locale: it })`
      quando `form.startDatetime` è valorizzato, altrimenti un messaggio
      generico tipo "Imposta prima la data di inizio".
    - Un campo data "Fino al *" (`<input type="date" name="recurringUntil"
      required={form.isRecurring}>`), che alimenta `form.recurringUntil`.
- In `handleCreateEvent`, valida che se `form.isRecurring` è true,
  `form.recurringUntil` sia valorizzato e successivo (o uguale) alla data
  di `form.startDatetime` — altrimenti `toast.error(...)` e return.
- Passa `isRecurring: form.isRecurring, recurringUntil: form.isRecurring ?
  form.recurringUntil : null` nel payload di `apiService.createEvent`.
- Dopo il successo, usa `response.count` per il messaggio toast: se
  `count > 1` → `toast.success(\`${count} eventi creati con successo\`)`,
  altrimenti il messaggio singolo esistente.
- Reset del form (`setForm(emptyForm)`) deve includere anche i nuovi campi
  (già coperto se `emptyForm` li include).

## Verifica
- `npm run build` deve passare senza nuovi errori.
- Riporta: file toccati/creati, ed esito build. Nota nel report che la
  migration `004_add_recurring_group_id.sql` va applicata manualmente al DB
  dall'utente (stesso modo delle precedenti).
