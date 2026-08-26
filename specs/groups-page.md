# Spec: Pagina di gestione Gruppi

## Problema
`src/components/Groups/Groups.js` esiste ma è un file completamente vuoto
(0 byte) — la pagina non è mai stata implementata. Inoltre `src/App.js` non
ha nessuna rotta per `/groups` (il menu in `Layout.js:38-42` linka a
`/groups` per i ruoli admin/coach, ma senza rotta finisce sul catch-all `*`
→ redirect a `/dashboard`).

## Obiettivo
Implementare una pagina di lista gruppi (creazione/modifica/eliminazione) e
una pagina di dettaglio gruppo (gestione atleti e staff assegnati), seguendo
lo stile e le convenzioni già usate in `src/components/Athletes/Athletes.js`,
`src/components/Athletes/AthleteDetail.js` e
`src/components/Athletes/AthleteForm.js` (Tailwind, lucide-react,
`LoadingSpinner`, `toast` da react-toastify, gestione errori con
`error.response?.data?.error`).

## Backend contract (già implementato, non modificare) — vedi `server/routes/groups.js`
- `apiService.getGroups(params)` → `GET /groups` → `{ groups: [{id, name,
  description, age_group, season_name, athletes_count, staff_count}] }`
- `apiService.getGroupById(groupId)` → `GET /groups/:groupId` → `{ group: {
  ...campi gruppo, athletes: [{id, first_name, last_name, date_of_birth,
  joined_date, is_active_in_group}], staff: [{id, first_name, last_name,
  email, role, group_role, can_manage}] } }`
- `apiService.createGroup({name, description, ageGroup, seasonId})` → `POST
  /groups` (solo ruolo `admin`) — `name` obbligatorio
- `apiService.updateGroup(groupId, {name, description, ageGroup})` → `PUT
  /groups/:groupId` (solo `admin`)
- `apiService.deleteGroup(groupId)` → `DELETE /groups/:groupId` (solo
  `admin`, disattiva il gruppo — soft delete)
- `apiService.addAthleteToGroup(groupId, athleteId)` → `POST
  /groups/:groupId/athletes` (admin o coach con `can_manage` sul gruppo)
- `apiService.removeAthleteFromGroup(groupId, athleteId)` → `DELETE
  /groups/:groupId/athletes/:athleteId`
- `apiService.addStaffToGroup(groupId, userId, role, canManage)` → `POST
  /groups/:groupId/staff` (solo `admin`)
- `apiService.removeStaffFromGroup(groupId, userId)` → `DELETE
  /groups/:groupId/staff/:userId` (solo `admin`)
- `apiService.getAthletes(params)` → per popolare il selettore "aggiungi
  atleta al gruppo" (atleti non ancora nel gruppo — filtra lato client
  confrontando con `group.athletes`)
- `apiService.getUsers(params)` → per popolare il selettore "aggiungi
  staff al gruppo" (filtra lato client per `role === 'admin' || role ===
  'coach'`, confronta con `group.staff` già presenti)

## Componenti da creare

### 1. `src/components/Groups/Groups.js` (pagina lista)
- Fetch gruppi con `getGroups()` al mount, mostra `loading` con
  `LoadingSpinner`.
- Tabella/card list (segui lo stile responsive di `Athletes.js`: tabella su
  desktop, card su mobile) con: nome, descrizione, fascia età, stagione,
  numero atleti, numero staff, e link "Gestisci" verso
  `/groups/:groupId`.
- Pulsante "Nuovo Gruppo" visibile solo per `user.role === 'admin'`, apre un
  modal (o form inline) con campi `name` (obbligatorio), `description`,
  `ageGroup`. Submit → `createGroup`, toast successo/errore, refresh lista.
- Pulsante "Elimina" per riga, solo admin, con conferma (`window.confirm` va
  bene, coerente con eventuali pattern già presenti in `Users.js` — verifica
  prima) → `deleteGroup`, refresh lista.
- Empty state coerente con quello di `Athletes.js` quando non ci sono
  gruppi.

### 2. `src/components/Groups/GroupDetail.js` (pagina dettaglio/gestione)
- Legge `groupId` da `useParams()`, fetch con `getGroupById`.
- Mostra dati gruppo, con pulsante "Modifica" (solo admin) che apre lo
  stesso modal di modifica usato nella lista (o un modal locale equivalente)
  → `updateGroup`.
- Sezione "Atleti nel gruppo": lista atleti assegnati con pulsante rimuovi
  (`removeAthleteFromGroup`) per admin/coach con permessi; selettore per
  aggiungere un atleta esistente (`addAthleteToGroup`) — usa `getAthletes()`
  filtrando quelli già presenti nel gruppo.
- Sezione "Staff del gruppo": lista staff assegnato con pulsante rimuovi
  (`removeStaffFromGroup`, solo admin); selettore per aggiungere
  admin/coach esistenti (`addStaffToGroup`, solo admin) — usa `getUsers()`
  filtrato per ruolo.
- Link "Torna ai gruppi" verso `/groups` (icona `ArrowLeft`, come in
  `AthleteDetail.js`).
- Gestione errori/toast coerente col resto dell'app.

## Routing — `src/App.js`
Aggiungi import di `Groups` da `./components/Groups/Groups` e `GroupDetail`
da `./components/Groups/GroupDetail`, e le rotte:
```
<Route path="/groups" element={(user.role === 'admin' || user.role === 'coach') ? <Groups /> : <Navigate to="/dashboard" replace />} />
<Route path="/groups/:groupId" element={(user.role === 'admin' || user.role === 'coach') ? <GroupDetail /> : <Navigate to="/dashboard" replace />} />
```
(coerente col pattern già usato per `/users` e `/reports/attendance` in
`App.js`, e coerente coi ruoli abilitati al link "Gruppi" in
`Layout.js:41`).

## Verifica
- `npm run build` deve completare senza errori (i warning ESLint
  pre-esistenti in altri file non sono un problema).
- Riporta: file toccati/creati ed esito della build.
