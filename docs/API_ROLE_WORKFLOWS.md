# Role and TOEIC management API

All protected endpoints require:

```http
Authorization: Bearer <Firebase-ID-token>
```

`GUEST` means an unauthenticated browser session and is not stored in Firestore.
Authenticated profiles live at `users/{uid}`. New profiles default to `USER`.
Firestore `users/{uid}.role` is the single source of truth for authorization.
Assign `EMPLOYEE` or `ADMIN` by setting the uppercase `role` field in that
document through a trusted administrative process. Never accept a role from the
frontend request body or local storage.

Spring Security maps the stored values to `ROLE_USER`, `ROLE_EMPLOYEE`, and
`ROLE_ADMIN`. Missing or invalid Firebase ID tokens return `401`; authenticated
users without the required role return `403`.

| API group | GUEST | USER | EMPLOYEE | ADMIN |
| --- | --- | --- | --- | --- |
| `GET /api/tests...` | Yes | Yes | Yes | Yes |
| `/api/me`, `/api/users/me/**`, `/api/attempts/**` | No | Yes | Yes | Yes |
| `/api/ai/jobs/**` | No | Yes | Yes | Yes |
| `/api/employee/**` | No | No | Yes | Yes |
| `/api/admin/**` | No | No | No | Yes |

## Current user

```http
GET /api/me
```

Returns `uid`, `email`, `displayName`, `photoUrl`, `role`, `createdAt`, and `lastLoginAt`.

## Public/user APIs

```http
GET /api/tests
GET /api/tests/{testId}
GET /api/users/me/attempts
GET /api/users/me/statistics
DELETE /api/users/me/attempts/{attemptId}
```

`GET /api/tests` is public and only returns `APPROVED` tests. Legacy tests without a
status are treated as approved. The three `/users/me` endpoints require authentication.
Users can only read or delete their own attempts.

## Exam APIs

All exam endpoints require authentication. A user can only access attempts whose
`userId` matches the authenticated Firebase UID.

```http
POST /api/tests/{testId}/attempts
POST /api/attempts
GET  /api/attempts/current?testId={testId}
GET  /api/attempts/{attemptId}
GET  /api/attempts/{attemptId}/exam
PUT  /api/attempts/{attemptId}/answers
PUT  /api/attempts/{attemptId}/position
POST /api/attempts/{attemptId}/listening/next
POST /api/attempts/{attemptId}/finish-listening
POST /api/attempts/{attemptId}/submit
POST /api/attempts/{attemptId}/submit-for-review
GET  /api/attempts/{attemptId}/result
GET  /api/attempts/{attemptId}/review
```

`POST /api/attempts` and `submit-for-review` are compatibility endpoints. New
frontend work should prefer `POST /api/tests/{testId}/attempts` and `submit`.

## Employee APIs

Role: `EMPLOYEE` or `ADMIN`.

```http
GET    /api/employee/tests
POST   /api/employee/tests
GET    /api/employee/tests/{testId}
PUT    /api/employee/tests/{testId}
DELETE /api/employee/tests/{testId}
POST   /api/employee/tests/{testId}/submit
POST   /api/employee/media
```

Create and update accept the existing full `Test` JSON shape. Server-controlled fields
such as `testId`, `createdBy`, status, and review metadata are ignored/replaced.

Only `DRAFT` and `REJECTED` tests are editable or deletable. Submission validates that
the test contains Parts 1–7 and exactly 200 questions numbered 1–200, each with four
answers and a correct answer from A–D.

Media upload uses `multipart/form-data` with field name `file`. Supported formats are
JPEG, PNG, WEBP, GIF, MP3, MP4 audio, WAV, and OGG up to 15 MB. Set the deployment
environment variable `FIREBASE_STORAGE_BUCKET` before using this endpoint.

## Admin APIs

Role: `ADMIN`.

```http
GET  /api/admin/test-submissions
GET  /api/admin/test-submissions/{testId}
POST /api/admin/test-submissions/{testId}/approve
POST /api/admin/test-submissions/{testId}/reject
GET  /api/admin/review-history
```

Reject body:

```json
{
  "reason": "Nội dung cần chỉnh sửa"
}
```

The reason is required. Approve/reject only succeeds while the test is
`PENDING_REVIEW`; repeated review requests return HTTP 409.

## Workflow

```text
DRAFT -> PENDING_REVIEW -> APPROVED
                        -> REJECTED -> DRAFT
```

## Error response

Security and application errors use JSON. Frontend behavior should be based on
the HTTP status and stable `code`, not on matching the Vietnamese message.

```json
{
  "timestamp": 1789020000000,
  "status": 403,
  "code": "ACCESS_DENIED",
  "message": "Bạn không có quyền thực hiện thao tác này",
  "path": "/api/admin/test-submissions",
  "fieldErrors": {}
}
```

- `401 AUTHENTICATION_REQUIRED`: missing, invalid, or expired Firebase ID token.
- `403 ACCESS_DENIED`: the authenticated user does not have the required role.
- `404 NOT_FOUND`: resource is absent or hidden by ownership rules.
- `409 CONFLICT`: the requested workflow transition is not allowed.
