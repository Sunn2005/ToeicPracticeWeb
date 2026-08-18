# Role and TOEIC management API

All protected endpoints require:

```http
Authorization: Bearer <Firebase-ID-token>
```

`GUEST` means an unauthenticated browser session and is not stored in Firestore.
Authenticated profiles live at `users/{uid}`. New profiles default to `USER`.
Assign `EMPLOYEE` or `ADMIN` by setting the uppercase `role` field in that document
or through a trusted Firebase custom claim before the profile is created.

## Current user

```http
GET /api/me
```

Returns `uid`, `email`, `displayName`, `photoUrl`, `role`, `createdAt`, and `lastLoginAt`.

## Public/user APIs

```http
GET /api/tests
GET /api/users/me/attempts
GET /api/users/me/statistics
```

`GET /api/tests` is public and only returns `APPROVED` tests. Legacy tests without a
status are treated as approved. The two `/users/me` endpoints require authentication.

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
