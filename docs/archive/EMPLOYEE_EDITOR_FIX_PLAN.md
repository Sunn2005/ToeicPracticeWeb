# Employee editor fixes — 2026-10-22

## Scope and decisions

The user approved Part 2 with exactly A/B/C. Other Parts retain A/B/C/D.
Keep ownership, review transitions, exam filtering, timing and Supabase upload
architecture unchanged. Existing approved tests are not migrated automatically;
drafts must meet the new option rule before submission/approval.

## Implementation plan

1. Update shared backend submission/approval validation and API documentation;
   cover valid Part 2, invalid labels/counts/correct answers and other Parts.
2. Use the existing passage `content` schema throughout authoring, preview and
   sample data; preserve existing passage fields and avoid stale multi-field updates.
3. Share frontend structural validation between the summary and submit actions.
   Check Parts 1–7, numbering 1–200, labels/counts and correct answers. Keep media
   quality warnings separate from structural errors. Add English/Vietnamese keys.
4. Serialize only writable test fields, save before submit, stop on save failure,
   and prevent concurrent saves/submissions. Respect non-editable test states.
5. Keep backend-generated media names (UID/UUID/sanitized original filename).
   Align the audio picker with supported MIME types; no storage credential changes.
6. Add focused regression tests without dependencies, run backend tests and
   frontend lint/test/build, review diff and final Git status.

## Verification limits

Live upload and authenticated Employee/Admin end-to-end checks require a running
deployment/session. Unit checks cannot confirm deployed Supabase bucket settings.

## Results

- Backend: `./mvnw test` passed, 261 tests (6 new validation regressions).
- Frontend: lint, `npm test` (109 tests, 7 new regressions), and build passed.
  The existing large-bundle warning remains.
- Local browser check with isolated sample data: Part 2 shows A/B/C; editing
  Part 6 updates its preview; an empty title disables both submit buttons.
- Supabase upload architecture and generated object names are preserved. The
  audio picker now includes MP4 and x-wav. Live authenticated upload was not run.
- Only the test command in package.json changed to register the new tests;
  no dependencies or lockfile changed.
- New translation keys: employeeEditorPart2Legacy, employeeEditorUseThreeOptions,
  employeeEditorTitleRequired, employeeEditorPartsInvalid,
  employeeEditorOptionsInvalid, employeeEditorCorrectInvalid,
  employeeEditorNumbersInvalid, employeeEditorValidationIssue,
  employeeEditorMediaWarning, employeeEditorExplanationWarning,
  employeeEditorCannotSubmit, employeeEditorMissingSavedId,
  employeeEditorNotEditable, employeeEditorAuthError, employeeEditorAccessError,
  employeeEditorConflictError, employeeEditorRequestError, employeeEditorSaving.
  All are present in English and Vietnamese.
- The branch creation permission request was rejected. Changes remain uncommitted;
  no commit, push, deployment, schema migration or live test submission was made.
