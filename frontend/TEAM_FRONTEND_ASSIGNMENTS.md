# Frontend ownership

## Member 1 — Guest, authentication, routing and shared UI

- `src/auth/*`
- `src/layouts/*`
- `src/components/ui/*`
- `src/pages/public/*`
- `src/pages/auth/*`
- `src/pages/errors/*`
- Owns the final route integration in `src/App.jsx`.

## Member 2 — User dashboard and learning history

- `src/pages/user/*`
- `src/components/user/*`
- `src/components/tests/*`
- `src/api/userLearning.js`

Do not edit the exam, result or review logic.

## Member 3 — Employee TOEIC test CRUD

- `src/pages/employee/*`
- `src/components/test-editor/*`
- `src/api/employeeTests.js`

## Member 4 — Admin review workflow

- `src/pages/admin/*`
- `src/components/admin/*`
- `src/api/adminReviews.js`

## Files owned by the backend/exam-flow developer

- `src/pages/FullTestExam.jsx`
- `src/pages/FullTestIntro.jsx`
- `src/pages/FullTestResult.jsx`
- `src/pages/FullTestReview.jsx`
- `src/components/QuestionCard.jsx`
- `src/components/LockedExamAudio.jsx`
- `src/api/client.js`
