# Fix: orari di evento/allenamento mostrati con +2h e deriva in modifica

## Sintomo
- L'utente imposta un allenamento (es. lunedì 17:00–18:30) e in app lo vede a
  **19:00–20:30**: shift uniforme di **+2h su TUTTI i giorni** (fuso di Roma,
  CEST = UTC+2 d'estate).
- Modificando anche solo la **data** di un evento, tutti gli orari "si sbalano":
  deriva cumulativa di +2h ad ogni save.

## Diagnosi (confermata sperimentalmente)

Le colonne `events.start_datetime` / `events.end_datetime` sono
**`TIMESTAMP` senza time zone** (`database/schema.sql:125-126`) → sono ore "a
muro" (wall-clock), NON istanti assoluti. L'utente immette 17:00 e si aspetta
di vedere 17:00.

### Bug 1 — read: l'ora viene reinterpretata come UTC e il browser la converte
- La route eventi fa `SELECT ... e.start_datetime ...`. `node-pg` converte la
  colonna `timestamp` naive in un **JS `Date` ancorato al fuso del server**
  (Cloud Run gira in **UTC**) → istante `17:00:00Z`.
- `res.json` serializza quel `Date` come `"2026-09-07T17:00:00.000Z"`.
- Il frontend usa `date-fns`: `format(parseISO("...17:00:00Z"), 'HH:mm')`.
  `parseISO` con `Z` = istante assoluto; `format` lo converte nel **fuso
  locale del browser** (Roma +2) → **19:00**.
- Verificato: `format(parseISO('2026-09-07T17:00:00.000Z'),'HH:mm')` = `19:00`;
  `format(parseISO('2026-09-07T17:00:00'),'HH:mm')` (senza Z) = `17:00`.
- Impatto collaterale: `CalendarPage.js:137` raggruppa per
  `format(parseISO(start_datetime),'yyyy-MM-dd')` → un evento delle 23:30
  (23:30Z) salta al giorno dopo. Si corregge con lo stesso fix.

### Bug 2 — form di edit: `toDatetimeLocal` fa doppia conversione
- `src/components/Calendar/EventDetail.js:~170-175`: `toDatetimeLocal` fa
  `parseISO` → `new Date(date.getTime() - offset*60000)` →
  `toISOString().slice(0,16)`. Sul valore **già con `Z`** raddoppia l'offset →
  il form di edit mostra già l'ora sbagliata (+2h).
- L'utente "corregge" la data, salva → il payload spedisce l'ora sbagliata
  (es. 19:00) → viene salvata in DB → allo save successivo deriva ancora +2h.
  Da qui "modificando le date mi sballa tutti gli orari".

### Dati già in DB
- **Intatti.** Su server UTC, la scrittura (`events.js:391` `new Date(naive)` →
  `17:00Z` → colonna naive) salva l'ora a muro corretta (17:00). **Nessuna
  migrazione necessaria.** Si interviene solo su read + form di edit.

## Fix (approvato)

**Principio:** restituire `start_datetime`/`end_datetime` al client come
**stringa a muro senza zona** (`YYYY-MM-DDTHH:MM:SS`, senza `Z`). Così
`parseISO` date-fns li tratta come **ora locale** e non converte nulla.

### 1. Backend — read (l'unico fix "vero")
In `server/routes/events.js`, in **ogni SELECT che ritorna eventi al client**
(lista e dettaglio), sostituire le due colonne con `TO_CHAR` tenendo invariati
i nomi delle colonne (alias) così il frontend non cambia:

```sql
TO_CHAR(e.start_datetime, 'YYYY-MM-DD"THH24:MI:SS') AS start_datetime,
TO_CHAR(e.end_datetime,   'YYYY-MM-DD"THH24:MI:SS') AS end_datetime
```

- Individua **tutti** i `SELECT` che espongono `e.start_datetime`/`e.end_datetime`
  al client in `events.js` (lista ~linea 159, dettaglio — cercalo, e qualsiasi
  altro endpoint eventi usato da Dashboard/Calendario). Modifica quelli.
- **NON modificare**: i `WHERE`/`ORDER BY` che usano `e.start_datetime` (sono
  confronti, non output); le **scritture** (INSERT/UPDATE); le righe di
  `scheduler.js` e `notifications.js` (fanno `new Date(...)` solo per messaggi
  e restano corrette su server UTC — lasciale come `Date`).
- `TO_CHAR` è **indipendente dal fuso del server** (formatta i campi salvati
  della colonna naive) → robusto anche se il TZ di Cloud Run cambiasse.

### 2. Frontend — form di edit (toglie la deriva)
`src/components/Calendar/EventDetail.js`, funzione `toDatetimeLocal` (~linea
170-175): l'input è ormai `YYYY-MM-DDTHH:MM:SS` a muro → semplificare a
passthrough, eliminando la matematica sull'offset che era la causa della deriva:

```js
const toDatetimeLocal = (value) => String(value).slice(0, 16);
```

(Verifica che la firma/uso della funzione resti coerente con `EventDetail.js:182-183`.)

### 3. NON toccare
- Scritture (CREATE/UPDATE): oggi producono già l'ora a muro corretta su server
  UTC. (Nota per il futuro: la scrittura dipende dal TZ del server = UTC;
  documentarlo, non cambiarlo ora.)
- Tutte le altre colonne `TIMESTAMP` (`created_at`, `sent_at`, `read_at`, …):
  servono a filtri di notifica (`NotificationContext.js:408`) e sort
  dell'onboarding (`onboarding.js:411`) → cambiarne la serializzazione
  introducerebbe uno shift lì.
- `EventForm.js` / `EventFormModal.js` (create): spediscono già la stringa
  naive del `<input type="datetime-local">` senza conversioni → corretti.

## Verifica

Ricetta server locale (vedi memory `local-verify-server`):
- `docker run -d --rm --name tm-tzfix-pg -e POSTGRES_PASSWORD=vertestpw -p 5433:5432 postgres:15-alpine`
- `DATABASE_URL="postgres://postgres:vertestpw@127.0.0.1:5433/postgres" DB_SSL=false NODE_ENV=production PORT=8001 node server/index.js`
  (porta 8001: la 8000 è del backend utente — **mai** ucciderla; creare
  `build/package.json` a mano se serve per `/api/version`)
- `printf '{"version":"x"}' > build/package.json` (se assente)

Passi:
1. **Unità read**: dopo il fix, un `GET` degli eventi deve restituire
   `start_datetime` come **stringa** `"YYYY-MM-DDTHH:MM:SS"` **senza `Z`**.
   (Verifica l'JSON grezzo, non la formattazione UI.)
2. **Round-trip**: crea un evento con `startDatetime=2026-09-07T17:00` e
   controlla che `GET` restituisca `17:00` (non 19:00/15:00). Apri il form di
   edit mentalmente: `toDatetimeLocal("...T17:00:00")` = `...T17:00`.
3. **Nessun regresso** su `created_at`/`sent_at`: `GET /api/notifications` (o
   equivalente) continua a restituire valori di `sent_at` coerenti (non si
   aspetta la loro modifica — solo che non sia rotto il parsing a valle).
4. Opzionale (frontend): serve la build e crea un evento 17:00 → il calendario
   lo mostra 17:00 e il giorno è corretto; modifichi la data → l'ora resta 17:00.

## File toccati (attesi)
- `server/routes/events.js` — `TO_CHAR` nei SELECT eventi (lista + dettaglio).
- `src/components/Calendar/EventDetail.js` — `toDatetimeLocal` → passthrough.