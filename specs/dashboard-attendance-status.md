# Spec: link evento rotto in Dashboard + indicatore presenza da confermare

## A) Bug: click su evento in Dashboard non fa nulla
`src/components/Dashboard/Dashboard.js:292-297` ha
`<Link to={`/events/${event.id}`}>` ma la route corretta (vedi
`src/App.js`) è `/calendar/:eventId`, non `/events/:id` (che non esiste e
cade nel catch-all che rimanda a `/dashboard` — da qui la sensazione "non
succede nulla"). **Fix**: cambiare in `to={`/calendar/${event.id}`}`.

Nota: la UI di conferma presenza esiste già ed è corretta
(`src/components/Calendar/EventDetail.js` righe ~304-360, banner
"Sei stato convocato" con bottoni Parteciperò/Non ci sarò quando
`row.status === 'called_up'`) — per gli eventi di tipo `training` lo status
iniziale è già `called_up` per tutti gli atleti del gruppo (vedi
`server/routes/events.js` intorno alla riga 388-398, `initialStatus =
eventType === 'training' ? 'called_up' : 'pending'`), quindi non serve
cambiare nient'altro in EventDetail per questo bug — con il link corretto i
bottoni compariranno già.

## B) Indicatore "presenza da confermare" in Dashboard

### B1. Backend — `server/routes/events.js`, handler `GET /` (righe ~9-150)
Aggiungere alla SELECT principale (righe ~110-133) una colonna
`my_attendance_status`, valorizzata SOLO per `req.user.role IN ('athlete',
'parent')` (per admin/coach restare `NULL`, non è rilevante per loro — la
UI di Dashboard.js userà questa colonna solo per quei due ruoli, vedi B2):

- Per `role === 'athlete'`:
```sql
(
  SELECT a.status FROM attendance a
  JOIN athletes ath ON a.athlete_id = ath.id
  WHERE a.event_id = e.id AND ath.user_id = $N
  LIMIT 1
) as my_attendance_status
```
- Per `role === 'parent'`:
```sql
(
  SELECT a.status FROM attendance a
  JOIN parent_athlete pa ON pa.athlete_id = a.athlete_id
  WHERE a.event_id = e.id AND pa.parent_id = $N
  ORDER BY a.status = 'pending' DESC, a.status = 'called_up' DESC
  LIMIT 1
) as my_attendance_status
```
  (se un genitore ha più atleti nello stesso gruppo/evento, priorità a
  mostrare uno stato ancora da confermare piuttosto che uno già confermato —
  euristica semplice, non serve gestire il caso multi-atleta in dettaglio
  in questo giro).
- Per `admin`/`coach`: non aggiungere la subquery, lasciare `NULL as
  my_attendance_status` nella SELECT per uniformità dello shape della
  risposta (il frontend può ignorarla per quei ruoli).

Il parametro `$N` è `req.user.id`, da aggiungere a `queryParams` con lo
stesso meccanismo di `paramIndex` già usato nel resto della query (occhio a
dove viene incrementato `paramIndex`, l'aggiunta va fatta PRIMA di
`queryParams.push(limit)` finale, coerentemente con l'ordine dei
placeholder `$N` nella query).

### B2. Frontend — `src/components/Dashboard/Dashboard.js`
Nella card di ogni evento in "Prossimi eventi" (righe ~273-299), se
`user.role === 'athlete' || user.role === 'parent'` e
`event.my_attendance_status` è `'pending'` o `'called_up'` (cioè non ancora
confermata: manca sia il caso "nessuna riga" cioè `null`/`undefined` — che
NON va trattato come "da confermare" per non generare falsi positivi su
eventi senza gruppo/attendance — sia i due stati espliciti pending/called_up),
mostrare un badge tipo:
```jsx
<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ml-2 bg-yellow-100 text-yellow-800">
  Presenza da confermare
</span>
```
posizionato accanto/sotto al badge esistente del tipo evento (riga
~288-290). Se `event.my_attendance_status === 'present'` o `'absent'`,
mostrare invece un badge verde/rosso coerente (es. "Presenza confermata" /
"Assenza segnalata") — riusa gli stessi colori/label già presenti in
`EventDetail.js` (`STATUS_COLORS`/`STATUS_LABELS`, verifica se sono
esportabili/riusabili da lì senza duplicare, altrimenti replica solo i 4
valori necessari: pending, called_up, present, absent — non l'intera
mappa se ha più valori non pertinenti qui).

Non serve azione di click sul badge stesso (il click sull'intera card/icona
occhio porta già al dettaglio evento dove si conferma, vedi fix A).

## Verifica
- `npx eslint` su `server/routes/events.js` e `src/components/Dashboard/Dashboard.js` (0 errori attesi).
- `node -c server/routes/events.js` per la sintassi.
- Non serve avviare il browser in questo step: il progetto gira in locale
  senza Docker (`npm run server:local` porta 5001 con `node --watch`,
  `npm run start:local` porta 3000 con hot reload) — le modifiche sono
  già live non appena salvate, la verifica visuale la farà il coordinatore
  o l'utente dopo.
