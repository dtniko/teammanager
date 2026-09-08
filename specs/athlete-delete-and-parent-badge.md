# Atleti: disattivazione (cancellazione soft) per coach + badge "senza genitore"

## Obiettivo
1. **Cancellare un atleta** = soft delete (`is_active=false`), disponibile ad
   **admin** (già così) e **coach dei gruppi dell'atleta** (nuovo), con
   pulsante UI + conferma, e possibilità di **riattivare**.
2. **Badge "Senza genitore"** nella lista atleti (e dettaglio): un atleta è
   "coperto" se esiste almeno una riga in `parent_athlete`.

## Fatti dal codice (verificati)
- `athletes` ha già `is_active BOOLEAN DEFAULT true` (database/schema.sql:62)
  → **nessuna migrazione**. Tutte le FK verso athletes sono
  `ON DELETE CASCADE` (irrelevanti per il soft delete).
- `parent_athlete` (schema.sql:68-76): `parent_id → users CASCADE`,
  `athlete_id → athletes CASCADE`, `UNIQUE(parent_id, athlete_id)`. **Niente
  is_active** → "coperto" = esistenza riga (scelta: non filtrare su
  `users.is_active`, bordo non gestito).
- **`DELETE /:athleteId` ESISTE** (`server/routes/athletes.js:306`):
  `requireRole(['admin'])`, soft delete `UPDATE athletes SET is_active=false`.
  Va allargato a coach (con check gruppo).
- `canAccessAthlete` (athletes.js:88) è troppo permissivo per le scritture
  (admin/coach = tutto) → per il soft delete serve un **check staff_group
  dedicato** (vedi sotto).
- GET lista `athletes.js:8` (`requireRole(['admin','coach'])`, già
  `GROUP BY a.id`, filtri search/groupId/`active`): **nessun** campo
  genitori → da estendere.
- `apiService.deleteAthlete` **già esiste** (`apiService.js:143`,
  `DELETE /athletes/:id`) ma **nessuna UI la chiama**.
- UI lista `src/components/Athletes/Athletes.js`: tabella desktop
  (#/Atleta/Età/Gruppi/Contatti/**Stato**/Azioni), badge Attivo/Inattivo
  (:364-382, UserCheck/UserX), azioni Eye+Edit (:385-400), mobile cards
  (:410-478). Pattern conferma da imitare: `handleDocumentDelete`
  (AthleteDetail.js:235-248, `window.confirm` + API + toast); `Trash2`
  già importata in AthleteDetail.js:19.
- UI dettaglio `src/components/Athletes/AthleteDetail.js`: sezione
  "Genitori/Tutori" read-only (:485-504, da `athlete.parents`); `canEdit()`
  :250-260.
- Gotcha vista genitori: `/my-athletes` (genitori) non restituirà
  `has_parent` → il badge va mostrato **solo se `has_parent === false`**
  (non `!has_parent`, che sarebbe vero anche su `undefined`).
- Nota (fuori scope): il coach vede già TUTTI gli atleti in lista (niente
  filtro staff_group sul GET) — non cambiarlo ora.

## Cambiamenti

### 1. `server/routes/athletes.js` — permessi + riattivazione
- **`DELETE /:athleteId`** (:306): cambia `requireRole(['admin'])` in
  `requireRole(['admin', 'coach'])`. Dentro: se `req.user.role === 'coach'`,
  verifica che il coach sia staff di **almeno un gruppo** cui appartiene
  l'atleta:
  ```sql
  SELECT 1 FROM athlete_group ag
  JOIN staff_group sg ON sg.group_id = ag.group_id
  WHERE ag.athlete_id = $1 AND sg.user_id = $2 AND sg.is_active = true
  LIMIT 1
  ```
  → 0 righe ⇒ `403 { error: 'Non hai i permessi su questo atleta' }`.
  Admin: nessun check. **Il soft delete resta** `UPDATE athletes SET
  is_active = false` (già così).
- **Nuovo `POST /:athleteId/reactivate`** (stesso livello di protezione:
  `requireRole(['admin','coach'])` + stesso check staff_group per coach):
  `UPDATE athletes SET is_active = true` → `200 { success: true }`.
  (Verifica l'ordine route: `/:athleteId/reactivate` prima di eventuali
  route parametriche che lo ombreggino — controlla le route esistenti.)

### 2. `server/routes/athletes.js` — flag genitori nel GET lista
Nella SELECT della lista (righe 37-52), aggiungere:
```sql
EXISTS (SELECT 1 FROM parent_athlete pa WHERE pa.athlete_id = a.id) AS has_parent
```
(colonna `a.id` già nel GROUP BY → Postgres lo accetta). Non toccare
`/my-athletes` (per costruzione i genitori sono coperti; e la vista non
dovrebbe mostrare il badge).

### 3. `src/services/apiService.js`
- `reactivateAthlete(athleteId)` → `this.client.post(`/athletes/${athleteId}/reactivate`)`
  (accanto a `deleteAthlete`, :143). `deleteAthlete` già c'è.

### 4. `src/components/Athletes/Athletes.js` — badge + azioni
- **Badge "Senza genitore"**: quando `athlete.has_parent === false` (===,
  non `!`), badge ambra/rosso (stile esistente badge, icona es. `UserX` o
  `AlertTriangle` — usa una delle icone già importate, altrimenti importala)
  con testo "Senza genitore", titolo/tooltip "Nessun genitore associato".
  Posizione: colonna **Stato** accanto a Attivo/Inattivo (desktop) e nella
  card mobile nella zona stato.
- **Pulsante disattiva/riattiva** nella colonna Azioni (desktop e mobile):
  - atleta **attivo**: icona `Trash2` (rosso al hover), click →
    `window.confirm('Disattivare <Nome Cognome>? L\'atleta verrà nascosto dalle liste ma la storia resterà salvata. Potrà essere riattivato in seguito.')`
    → `apiService.deleteAthlete(id)` → toast "Atleta disattivato" →
    reload lista (o rimozione dall'array se il filtro è `active`).
  - atleta **inattivo**: pulsante "Riattiva" (es. icona `UserPlus`/`RotateCcw`
    verde) → `apiService.reactivateAthlete(id)` → toast → reload.
  - Visibilità: stesso `canEditAthlete` di Edit (admin/coach, :151). (Il check
    staff_group vero è lato server; qui si mostra a tutti coach/admin, come
    Edit già fa.)
  - Gestisci errori API: 403 → toast con messaggio server.

### 5. `src/components/Athletes/AthleteDetail.js` — dettaglio
- Sezione Genitori (:485-504): se `athlete.parents` (o equivalente vuoto) è
  vuoto → mostra avviso ambra "Nessun genitore associato a questo atleta".
- Pulsante **Disattiva** (icona `Trash2`, già importata :19) accanto a Edit
  (:324), visibile se `canEdit()` e atleta attivo → stesso `window.confirm`
  della lista → `deleteAthlete` → toast → `navigate('/athletes')`. Se atleta
  già inattivo → pulsante "Riattiva" → `reactivateAthlete` → toast.

### Non toccare
- `/my-athletes`, onboarding (i parent_athlete nascono lì), altre route.
- Migrazioni: nessuna.
- Il GET lista non filtra ancora per staff_group (comportamento esistente,
  out-of-scope).

## Verifica (obbligatoria)
Setup: postgres effimero su **5434** (container `tm-athlete-pg`) + server su
**8002** `TZ=UTC` (PORTA 8000 = backend utente MAI toccare; **5433/8001 sono
occupati da un altro test in corso** — non usarli). `node --check` sul file.
Seed: 2 gruppi, coach A (staff gruppo 1), coach B (staff gruppo 2), admin,
atleta X nel gruppo 1 **con genitore**, atleta Y nel gruppo 1 **senza
genitore**, atleta Z nel gruppo 2.
1. `GET /athletes` (admin) → X con `has_parent: true`, Y con `false`.
2. `DELETE /athletes/X` come **coach A** (staff gruppo 1) → 200,
   `is_active=false`; come **coach B** → 403; riattiva poi per i test.
3. `DELETE /athletes/Y` come coach B → 403 (Y non è nel gruppo 2).
4. `POST /athletes/Y/reactivate` dopo disattivazione → `is_active=true`.
5. `DELETE` come ruolo base/parent → 403.
6. Badge: (frontend) verificato con esbuild/parse + code review; il campo
   `has_parent` presente nell'JSON (punto 1).
Frontend JSX: `npx --yes esbuild <file>... --outdir=/tmp/esbuild-check-athlete --loader:.js=jsx`
(per parse; se offline segnalalo).
A fine test: fermare server 8002 + `tm-athlete-pg`, rimuovere
`build/package.json` se creato.

## Report (≤ 15 righe)
File + righe, node --check, esbuild, risultati casi 1-5, deviazioni.