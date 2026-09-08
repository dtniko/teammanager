# Nuova pagina "Notifica" — push a tutti i genitori/atleti di un gruppo

## Obiettivo
Nuovo punto menu **"Notifica"** (solo `coach` e `admin`) che apre una pagina
per inviare una notifica **push + in-app** a **tutti i genitori e gli atleti
(con account) di un gruppo scelto**. Form: **titolo + messaggio** (scelta
utente), select gruppo.

## Fatti dal codice (verificati)
- Menu: `src/components/Layout/Layout.js:104-165` array `navigationItems`,
  voce `{ name, href, icon, roles: [...] }`; filtro `Layout.js:168-170`.
  Esempio coach/admin: "Gruppi" (:111-116). Icona `Bell` già importata (:12).
- Route: `src/App.js:106-131`, pattern protezione = ternario inline
  `user.role === 'admin' || user.role === 'coach' ? <Comp/> : <Navigate to="/dashboard" replace/>`
  (es. `/communications/new` :118). **Il path `/notifications` è già occupato**
  da `NotificationsPage` (notifiche in arrivo, :127) → la nuova pagina va a
  `/notifications/broadcast`.
- UI pattern: `src/components/Communications/CommunicationNew.js` — form
  `{ title, content, targetGroupId }`, `apiService.getGroups()` →
  `response.groups`, guardie `canManage` (:31) + `Navigate` (:92-94),
  toast + navigate dopo l'invio.
- Backend: `server/routes/notifications.js` —
  - `createBulkNotifications(userIds, title, message, type='info', relatedType=null, relatedId=null)`
    (:279): INSERT bulk in `notifications` + `sendPushToUsers(userIds, {title,
    body: message, url:'/notifications'})`. **Già nello stesso file** — usarla.
  - Query destinatari (da `notifyEventCreatedOrUpdated`, :583-590 e :602-609):
    - Genitori: `SELECT DISTINCT pa.parent_id FROM parent_athlete pa
      JOIN athlete_group ag ON pa.athlete_id = ag.athlete_id
      WHERE ag.group_id = $1 AND ag.is_active = true`
    - Atleti con account: `SELECT DISTINCT a.user_id FROM athletes a
      JOIN athlete_group ag ON a.id = ag.athlete_id
      WHERE ag.group_id = $1 AND ag.is_active = true AND a.user_id IS NOT NULL`
  - Endpoint analogo esistente: `POST /system` (:450-491, admin-only con check
    manuale) — seguire il pattern di risposta ma usare `requireRole`.
  - `requireRole` da `server/middleware/auth.js:69-85`; verifica gli import
    già presenti in notifications.js e aggiungilo se manca.
  - `authenticateToken` è applicato al mount (`server/index.js:58`).
- Autorizzazione coach su gruppo: pattern in `communications.js:229-238`
  (check su `staff_group`), da replicare.
- `GET /api/groups` filtra per ruolo (coach vede solo i propri gruppi) —
  niente da fare lato select.
- apiService: pattern `sendSystemNotification` (:384) → nuova
  `sendGroupPushNotification(data)` → `POST /notifications/group`.

## Cambiamenti

### 1. `server/routes/notifications.js` — `POST /group`
```js
router.post('/group', requireRole(['admin', 'coach']), async (req, res) => { ... })
```
- Body: `{ title, message, groupId }`; valida: title non vuoto (trim), message
  non vuoto (trim), groupId numero valido. Errori 400 con messaggio in italiano.
- **Coach**: check accesso al gruppo su `staff_group`
  (`sg.group_id = $1 AND sg.user_id = $2 AND sg.is_active = true`) → 403 se
  non autorizzato. Admin: nessun check.
- Risolvi destinatari con le due query sopra (genitori + atleti con account),
  **union con dedup**. Se zero destinatari → `200 { success: true, sent: 0 }`
  (con messaggio nel body, es. `note: 'Nessun destinatario con account attivo'`).
- Invio: `createBulkNotifications(userIds, title, message, 'info', null, null)`.
- Risposta: `200 { success: true, sent: userIds.length }`.
- Avvolgi in try/catch come gli altri endpoint del file.
- **Attenzione**: verifica che `POST /group` non conflitti con altre route
  `router.post('/:...')` dello stesso file (l'ordine delle route conta).

### 2. `src/services/apiService.js`
- `sendGroupPushNotification(notificationData)` → `this.client.post('/notifications/group', notificationData)`
  (pattern di `sendSystemNotification`, :384).

### 3. Frontend — pagina `src/components/Notifications/GroupPushNew.js`
(Cartella `Notifications/` già esistente — contiene `NotificationsPage.js`.)
- Stato: `{ title, message, groupId: '' }` + `groups` + `saving`.
- `useEffect`: `apiService.getGroups()` → setGroups (stesso pattern di
  CommunicationNew.js:33-48).
- Guardie: `canManage = user.role === 'admin' || user.role === 'coach'`;
  `if (!canManage) return <Navigate to="/dashboard" replace/>`.
- UI (tailwind, stile CommunicationNew.js): titolo pagina "Notifica",
  sottotitolo "Invia una notifica push a tutti i genitori e gli atleti del
  gruppo", input Titolo, textarea Messaggio, select Gruppo, pulsante
  "Invia notifica" (disabilitato se campi vuoti o `saving`).
- `handleSend`: validazione client → `await apiService.sendGroupPushNotification({
  title, message, groupId: parseInt(groupId) })` → toast di successo
  ("Notifica inviata a N destinatari" usando `response.sent` se presente) →
  reset form (resta sulla pagina, com'è naturale per invii multipli) — o
  `navigate('/notifications')`; scegli **reset + toast** e dimmelo nel report.
- Gestisci errori API (toast di errore con messaggio server).

### 4. `src/App.js`
- Import `GroupPushNew` (pattern :23-33).
- `<Route path="/notifications/broadcast" element={user.role === 'admin' || user.role === 'coach' ? <GroupPushNew /> : <Navigate to="/dashboard" replace/>} />`
  (stesso pattern di :118), vicino alla route `/notifications` (:127).

### 5. `src/components/Layout/Layout.js`
- Voce in `navigationItems`: `{ name: 'Notifica', href: '/notifications/broadcast', icon: Bell, roles: ['admin', 'coach'] }` —
  inseriscila dopo "Comunicazioni". Icona `Bell` già importata (:12); se il
  nome dell'import differisce, usa quello esistente.

### Non toccare
- `NotificationsPage.js` (notifiche in arrivo) e il path `/notifications`.
- Comunicazioni (non mandano push, non c'entrano).
- Migrazioni: nessuna (tabella `notifications` va bene così).

## Verifica (obbligatoria)
Setup (vedi memory `local-verify-server`): postgres effimero su 5433, server su
**8001** con `TZ=UTC` (porta 8000 = backend utente, MAI toccare).
`node --check` su `notifications.js`.

E2E: seed minimo — 1 gruppo, 1 coach nel gruppo (staff_group), 1 atleta del
gruppo con `user_id`, 1 genitore (parent_athlete → user genitore), 1 utente
fuori dal gruppo. Login del coach (via API) → token.
1. `POST /notifications/group` (titolo+message+groupId) → `200 {sent: 3}`
   (genitore+atleta+… — conta i destinatari reali del seed); righe in
   `notifications` per ogni destinatario; **nessuna** per l'utente fuori
   gruppo; nessuna per il coach se non è genitore/atleta del gruppo.
2. `POST` come **user** (ruolo base) → 403.
3. `POST` come coach di **altro gruppo** → 403.
4. `POST` groupId inesistente → 400/404 (coerente con lo stile del file).
5. `POST` title vuoto → 400.
6. Push web fallirà senza VAPID (atteso, ignorable).
Frontend: non serve browser — verifica sintassi/compile (`npx react-scripts build`
solo se rapido; altrimenti `node --check` non va su JSX: in tal caso `npx
babel` o fidati della review del diff + test API). Se la build è troppo lenta,
segnalalo e fai solo lint/parse.

## Report (≤ 15 righe)
File + righe, node --check, risultati casi 1-5 (valore `sent` e count righe
notifiche per destinatario), scelta toast/reset, deviazioni.