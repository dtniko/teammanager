# Spec: New/Edit Athlete form

## Problem
Links to `/athletes/new` (in `src/components/Athletes/Athletes.js`) and
`/athletes/:athleteId/edit` (in `src/components/Athletes/AthleteDetail.js`)
exist, but no route or component handles them. `/athletes/new` currently
falls through to the `/athletes/:athleteId` route with `athleteId="new"`,
causing a 500 from `GET /api/athletes/new` (server tries to use "new" as a
DB id).

## Goal
Create one component `src/components/Athletes/AthleteForm.js` that handles
both create and edit, and wire it into routing.

## Backend contract (already implemented, do not change)
- `apiService.createAthlete(athleteData)` → `POST /athletes`
- `apiService.updateAthlete(athleteId, athleteData)` → `PUT /athletes/:athleteId`
- `apiService.getAthleteById(athleteId)` → `GET /athletes/:athleteId` (edit mode prefill)
- `apiService.getGroups(params)` → `GET /groups` for group multi-select (list has `{id, name, ...}` groups; response shape `{ groups: [...] }` similar to athletes — verify by reading `server/routes/groups.js` or existing usage in `Athletes.js`)

Request body fields expected by POST/PUT `/athletes` (camelCase):
`firstName, lastName, dateOfBirth, fiscalCode, placeOfBirth, address, phone,
email, emergencyContactName, emergencyContactPhone, parentEmails (array,
create only), groupIds (array, create only)`.
Required: `firstName, lastName, dateOfBirth`.

`GET /athletes/:athleteId` response `athlete` object uses snake_case DB
columns (`first_name`, `last_name`, `date_of_birth`, `fiscal_code`,
`place_of_birth`, `address`, `phone`, `email`, `emergency_contact_name`,
`emergency_contact_phone`), plus `athlete.groups` (array of `{id, name, ...}`)
and `athlete.parents` (array of `{id, first_name, last_name, email, ...}`).

## Component behavior
`AthleteForm.js`:
- Read `athleteId` from `useParams()`. If present → edit mode (fetch existing
  athlete via `getAthleteById`, prefill fields, submit via `updateAthlete`,
  no parentEmails/groupIds fields needed in edit mode since PUT route
  doesn't accept them — omit those inputs when editing, or if you want group
  management reuse existing group endpoints, but keep scope minimal: for
  edit mode only submit the fields PUT accepts).
- If no `athleteId` → create mode. Form fields: firstName, lastName,
  dateOfBirth (date input), fiscalCode, placeOfBirth, address, phone, email,
  emergencyContactName, emergencyContactPhone, and a groups multi-select
  (fetch via `getGroups()`, optional). Skip parentEmails input (out of scope
  for this fix) — just don't send it, backend defaults to `[]`.
- On submit: call `createAthlete`/`updateAthlete`, `toast.success(...)` on
  success, navigate to `/athletes/${athlete.id}` (create) or
  `/athletes/${athleteId}` (edit). On failure: `toast.error` using
  `error.response?.data?.error` fallback to generic message (follow the
  pattern already used in `AthleteDetail.js` / `Athletes.js` for
  apiService error handling and toast usage).
- Use the same visual style/conventions as `AthleteDetail.js` and
  `Athletes.js` (Tailwind classes, `LoadingSpinner`, lucide-react icons,
  `ArrowLeft` back link to `/athletes` or the detail page).
- Client-side required validation for firstName/lastName/dateOfBirth
  (simple, e.g. HTML5 `required` attributes is enough).

## Routing changes — `src/App.js`
Add two routes (react-router v6 matches by specificity so order doesn't
matter, but place them near the existing athlete routes for readability):
```
<Route path="/athletes/new" element={<AthleteForm />} />
<Route path="/athletes/:athleteId/edit" element={<AthleteForm />} />
```
Import `AthleteForm` from `./components/Athletes/AthleteForm`.

Restrict creation/edit access consistent with how `Athletes.js` and
`AthleteDetail.js` already gate the buttons (`admin`/`coach` roles for
create; reuse the same `canEdit()`-style check pattern already present in
`AthleteDetail.js` for edit — but the component itself can just redirect to
`/athletes` with a toast if `user.role === 'parent'` and no edit permission,
consistent with existing patterns). Keep it simple — don't over-engineer;
match existing role-check style in the codebase.

## Verification
- `npm run build` (or the project's existing lint/build check) must pass
  with no new errors.
- Report back: files touched, and confirm no console errors in the
  build/lint output related to the new component.
