# Tài liệu API, phân quyền và workflow TOEIC

Tài liệu này mô tả contract hiện tại của REST API trong `backend`: mục đích, HTTP method, path, quyền truy cập, tham số, request body, response và các lỗi nghiệp vụ quan trọng.

## 1. Quy ước chung

### Base URL và định dạng

- Base URL khi chạy local: `http://localhost:8080`.
- Request/response thông thường dùng `application/json`.
- Upload media dùng `multipart/form-data`.
- Các thời điểm như `createdAt`, `updatedAt`, `startedAt`, `submittedAt` là Unix timestamp theo millisecond (`Long`).
- Những field chưa có dữ liệu có thể trả về `null`.
- API không lưu session trong bộ nhớ server. Trình duyệt gửi Firebase session cookie đã ký trong mỗi request được bảo vệ.

### Xác thực

Sau khi đăng nhập bằng Firebase Web SDK, frontend gửi ID token mới phát hành một lần tới `POST /api/v1/auth/session`. Backend xác minh token và trả Firebase session cookie có các thuộc tính `HttpOnly`, `Secure` trên production, `SameSite=Lax`, `Path=/` và thời hạn cố định 7 ngày.

Mọi endpoint được bảo vệ đọc cookie `session`; frontend phải gọi API với `credentials: "include"`. ID token, refresh token và session cookie không được lưu thủ công trong localStorage. Localhost qua HTTP phải chạy backend với `AUTH_COOKIE_SECURE=false`; production giữ `AUTH_COOKIE_SECURE=true`.

Các request `POST`, `PUT`, `PATCH` và `DELETE` phải gửi CSRF token. Frontend lấy token từ `GET /api/v1/auth/csrf` và gửi lại qua header `X-XSRF-TOKEN`; cookie CSRF tương ứng được trình duyệt gửi tự động.

`GUEST` là phiên trình duyệt chưa đăng nhập và không được lưu trong Firestore. Profile đã đăng nhập nằm tại `users/{uid}`; tài khoản mới mặc định có role `USER`.

Firestore `users/{uid}.role` là nguồn dữ liệu duy nhất dùng để phân quyền. Role `EMPLOYEE` hoặc `ADMIN` phải được gán bằng quy trình quản trị tin cậy. Không nhận role từ request body, local storage hoặc state của frontend.

Spring Security ánh xạ role thành `ROLE_USER`, `ROLE_EMPLOYEE`, `ROLE_ADMIN`.

### Endpoint phiên đăng nhập

#### Lấy CSRF token

- **Method/path:** `GET /api/v1/auth/csrf`.
- **Quyền:** public.
- **Response:** `200 OK`, `{ "token": "..." }`, đồng thời khởi tạo cookie CSRF.

#### Tạo session

- **Method/path:** `POST /api/v1/auth/session`.
- **Quyền:** public nhưng bắt buộc CSRF.
- **Body:** `{ "idToken": "<fresh Firebase ID token>" }`.
- **Response:** `200 OK`, profile hiện tại trong JSON và session cookie trong `Set-Cookie`.
- Backend chỉ chấp nhận lần xác thực Firebase diễn ra trong 5 phút gần nhất và không trả credential trong JSON.

#### Đăng xuất

- **Method/path:** `POST /api/v1/auth/logout`.
- **Quyền:** public nhưng bắt buộc CSRF.
- **Response:** `204 No Content` và cookie `session` hết hạn.
- Logout trình duyệt hiện tại không thu hồi phiên trên các thiết bị khác.

### Ma trận phân quyền

| Nhóm API | GUEST | USER | EMPLOYEE | ADMIN |
| --- | --- | --- | --- | --- |
| `GET /api/tests`, metadata và Part | Có | Có | Có | Có |
| `POST /api/tests/{testId}/attempts` | Không | Có | Có | Có |
| `/api/me`, `/api/users/me/**`, `/api/attempts/**` | Không | Có | Có | Có |
| `/api/ai/jobs/**` | Không | Có | Có | Có |
| `/api/ai/chat/**` | Không | Có; mutation cần `AI_CHAT` | Có; mutation cần `AI_CHAT` | Có; mutation cần `AI_CHAT` |
| `/api/employee/**` | Không | Không | Có | Có |
| `/api/admin/**` | Không | Không | Không | Có |
| `/api/internal/**` | Không | Không | Không | Có; endpoint còn phải được bật bằng cấu hình |

### Path parameter thường dùng

| Tên | Type | Ý nghĩa |
| --- | --- | --- |
| `testId` | `string` | ID đề thi. |
| `attemptId` | `string` | ID lượt làm bài. |
| `jobId` | `string` | ID tác vụ AI bất đồng bộ. |
| `partId` | `string` | `part1` đến `part7`, hoặc số `1` đến `7`. |

## 2. Các schema response dùng chung

Các ví dụ dưới đây thể hiện đầy đủ nhóm field chính. Giá trị chỉ mang tính minh họa.

### 2.1 `TestMetadata`

`GET /api/tests`, `GET /api/tests/{testId}` và các API danh sách quản trị dùng schema metadata này; field `parts` không được trả về ở API danh sách/metadata.

```json
{
  "testId": "test-1",
  "title": "TOEIC Practice Test 1",
  "description": "Đề luyện thi số 1",
  "totalQuestions": 200,
  "type": "FULL_TEST",
  "listeningMinutes": 45,
  "readingMinutes": 75,
  "totalMinutes": 120,
  "status": "APPROVED",
  "createdBy": "employee-uid",
  "createdAt": 1789020000000,
  "updatedAt": 1789020000000,
  "submittedAt": 1789020000000,
  "reviewedBy": "admin-uid",
  "reviewedAt": 1789020000000,
  "rejectionReason": null
}
```

Trong response danh sách public, đề legacy chưa có `status` được chuẩn hóa thành `APPROVED`; response chi tiết vẫn có thể trả `status=null`. Các giá trị mặc định khi đọc đề public là `type=FULL_TEST`, `listeningMinutes=45`, `readingMinutes=75`, `totalMinutes=120` nếu dữ liệu gốc thiếu field tương ứng.

### 2.2 `Test` đầy đủ

Schema `Test` đầy đủ gồm toàn bộ `TestMetadata` và:

```json
{
  "parts": [
    {
      "partNumber": 5,
      "name": "Incomplete Sentences",
      "questions": [],
      "groups": [],
      "passages": [],
      "passageGroups": []
    }
  ]
}
```

Mỗi `Question` có thể chứa:

```json
{
  "questionNumber": 101,
  "imageUrl": null,
  "audioUrl": null,
  "question": "The meeting begins ___ nine.",
  "answers": [
    { "label": "A", "content": "at" },
    { "label": "B", "content": "in" },
    { "label": "C", "content": "on" },
    { "label": "D", "content": "by" }
  ],
  "correctAnswer": "A",
  "questionTranslation": "Cuộc họp bắt đầu lúc chín giờ.",
  "answerTranslation": "at = vào lúc",
  "detailedExplanation": "Dùng at trước giờ cụ thể.",
  "transcript": null,
  "grammarTopic": "Prepositions of time",
  "questionType": "GRAMMAR",
  "skillTags": [],
  "grammarTags": ["PREPOSITION"],
  "difficulty": "EASY"
}
```

`groups` dùng các field `groupNumber`, `questionRange`, `audioUrl`, `imageUrl`, `transcript`, `transcriptTranslation`, `questions`. `passages` dùng `passageNumber`, `title`, `passageType`, `type`, `content`, `imageUrl`, `questions`. `passageGroups` dùng `groupNumber`, `questionRange`, `passageType`, `imageUrls`, `passages`, `questions`.

Response trong lúc thi luôn loại bỏ đệ quy các field bí mật: `correctAnswer`, `questionTranslation`, `answerTranslation`, `detailedExplanation`, `translation`, `explanation`, `transcript`, `transcriptTranslation`. Riêng Part 1 và Part 2 còn loại bỏ `answers[].content`, chỉ giữ nhãn đáp án.

### 2.3 `AttemptResponse`

```json
{
  "id": "attempt-123",
  "testId": "test-1",
  "type": "FULL_TEST",
  "mode": "FULL",
  "selectedPart": null,
  "selectedParts": [1, 2, 3, 4, 5, 6, 7],
  "timeLimitSeconds": 7200,
  "status": "IN_PROGRESS",
  "currentSection": "LISTENING",
  "currentQuestionNumber": 1,
  "firstQuestionNumber": 1,
  "lastQuestionNumber": 200,
  "totalQuestions": 200,
  "startedAt": 1789020000000,
  "updatedAt": 1789020000000,
  "submittedAt": null,
  "sectionStartedAt": 1789020000000,
  "sectionEndAt": 1789022700000,
  "overallEndAt": 1789027200000,
  "listeningStartedAt": 1789020000000,
  "listeningEndAt": 1789022700000,
  "readingStartedAt": null,
  "readingEndAt": null,
  "serverTime": 1789020000100,
  "result": null,
  "answers": { "1": "A", "2": "C" },
  "answeredCount": 2
}
```

- `type`: `FULL_TEST` hoặc `PRACTICE`; mặc định `FULL_TEST`.
- `mode`: `FULL`, `LISTENING`, `READING` hoặc `PART`.
- `status`: `IN_PROGRESS` hoặc `COMPLETED`.
- `currentSection`: `LISTENING`, `READING` hoặc `FINISHED`.
- `selectedPart` chỉ có giá trị khi chế độ `PART` chọn đúng một Part.
- `answers` là object có key là số câu ở dạng chuỗi. Một số response nội bộ sau khi lưu đáp án không kèm `answers`/`answeredCount`; từng endpoint sẽ ghi rõ.
- Server tự đối chiếu deadline khi đọc hoặc cập nhật attempt; attempt hết giờ có thể được chuyển section hoặc tự nộp trước khi response được trả về.

### 2.4 `ResultResponse`

```json
{
  "attemptId": "attempt-123",
  "testId": "test-1",
  "type": "FULL_TEST",
  "mode": "FULL",
  "selectedPart": null,
  "selectedParts": [1, 2, 3, 4, 5, 6, 7],
  "timeLimitSeconds": 7200,
  "firstQuestionNumber": 1,
  "lastQuestionNumber": 200,
  "listeningTotalQuestions": 100,
  "readingTotalQuestions": 100,
  "listeningCorrect": 70,
  "listeningWrong": 20,
  "listeningUnanswered": 10,
  "readingCorrect": 75,
  "readingWrong": 20,
  "readingUnanswered": 5,
  "totalCorrect": 145,
  "totalWrong": 40,
  "totalUnanswered": 15,
  "totalQuestions": 200,
  "correctCount": 145,
  "incorrectCount": 40,
  "unansweredCount": 15,
  "listeningScore": 400,
  "readingScore": 420,
  "totalScore": 820,
  "estimatedTotalScore": 820,
  "durationSeconds": 6800,
  "submittedAt": 1789026800000,
  "autoSubmitted": false
}
```

## 3. API người dùng hiện tại

### 3.1 Lấy profile hiện tại

- **Mục đích:** lấy thông tin Firebase profile và role được backend tin cậy.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/me`.
- **Quyền:** mọi user đã đăng nhập.
- **Path/query/body params:** không có.
- **Response thành công:** `200 OK`.

```json
{
  "uid": "firebase-uid",
  "email": "user@example.com",
  "displayName": "Nguyen Van A",
  "photoUrl": "https://example.com/avatar.png",
  "targetScore": 800,
  "phoneNumber": "+84901234567",
  "dateOfBirth": "2001-09-18",
  "gender": "MALE",
  "role": "USER",
  "createdAt": 1789020000000,
  "lastLoginAt": 1789020000000,
  "subscription": {
    "planCode": "PRO",
    "status": "ACTIVE",
    "startsAt": 1789020000000,
    "expiresAt": 1791612000000,
    "entitlements": ["AI_CHAT", "AI_ANALYSIS"],
    "effective": true
  }
}
```

`subscription` luôn có đúng sáu field: `planCode`, `status`, `startsAt`, `expiresAt`, `entitlements`, `effective`. Không trả UID hay metadata audit. Khi chưa có subscription, bốn field đầu là `null`, `entitlements=[]`, `effective=false`.

### 3.1A Cập nhật profile hiện tại

- **Mục đích:** cập nhật các field hồ sơ do chính người dùng quản lý.
- **Method/type:** `PATCH`, request và response `application/json`.
- **Path:** `/api/me`.
- **Quyền:** mọi user đã đăng nhập; backend luôn lấy UID từ session, không nhận UID hoặc role từ body.
- **Response thành công:** `200 OK`, cùng schema với `GET /api/me`.

```json
{
  "displayName": "Nguyen Van A",
  "photoUrl": "https://example.com/avatar.png",
  "targetScore": 800,
  "phoneNumber": "+84901234567",
  "dateOfBirth": "2001-09-18",
  "gender": "MALE"
}
```

`displayName` bắt buộc có 1-80 ký tự. `targetScore` có thể `null`, nếu có phải từ 10 đến 990 và chia hết cho 5. `phoneNumber`, `dateOfBirth`, `gender` là tùy chọn; gửi `null` hoặc chuỗi trống để xóa. Số điện thoại gồm 8-15 chữ số, có thể bắt đầu bằng `+`. Ngày sinh dùng định dạng ISO `YYYY-MM-DD` và không được ở tương lai. Giới tính nhận `MALE`, `FEMALE`, `OTHER` hoặc `PREFER_NOT_TO_SAY` (không phân biệt chữ hoa/thường và response luôn chuẩn hóa thành chữ hoa). Request không được dùng để sửa `uid`, `email`, `role`, `createdAt`, `lastLoginAt` hoặc `subscription`.

### 3.2 Schema subscription và quyền Pro

Firestore lưu tại `subscriptions/{uid}`: `userId`, `planCode`, `status`, `entitlements`, `startsAt`, `expiresAt`, `activatedBy`, `revokedBy`, `revokedAt`, `createdAt`, `updatedAt`. Các thời điểm là Unix millisecond; audit actor là UID admin. `planCode=PRO`, `status` là `ACTIVE`, `EXPIRED` hoặc `REVOKED`; quyền hiện tại gồm `AI_CHAT`, `AI_ANALYSIS`. Các thao tác quản trị thủ công hiện chỉ ghi `ACTIVE` (kích hoạt/gia hạn) hoặc `REVOKED` (thu hồi).

Server tính `effective` bằng `status=ACTIVE && startsAt <= serverNow && serverNow < expiresAt`; thiếu thời điểm làm subscription không có hiệu lực. Quyền chỉ được cấp khi subscription có hiệu lực và danh sách `entitlements` chứa quyền cần thiết. Thời gian hết hạn tự nó không chuẩn hóa status đã lưu; subscription có thể vẫn lưu `ACTIVE` nhưng `effective=false`, còn `EXPIRED` và `REVOKED` luôn không có hiệu lực. Role vẫn lấy từ `users/{uid}.role`, độc lập với Pro.

`AI_CHAT` cấp quyền tạo/xóa hội thoại và gửi tin nhắn qua API Capy Chat ở mục 7A. Lịch sử đã tạo vẫn đọc được sau khi Pro hết hạn hoặc bị thu hồi. Subscription có thể được quản lý thủ công bởi admin hoặc kích hoạt qua thanh toán PayOS ở mục 3.3.

### 3.3 Thanh toán Pro qua PayOS

`GET /api/payments/pro/plans` yêu cầu đăng nhập và trả danh sách `{ planCode, amount, durationDays, sandboxOnly }` do server quản lý. `POST /api/payments/pro` yêu cầu session và CSRF hợp lệ, body chỉ nhận `{ "planCode": "PRO_30" }`; client không gửi giá hoặc thời hạn. Response thành công gồm `checkoutUrl` và `orderCode`. Pending order cùng user/gói trong 15 phút được tái sử dụng để tránh tạo link trùng.

`POST /api/payments/webhook` là endpoint public duy nhất trong nhóm này và được miễn CSRF vì PayOS không có browser session. Backend bắt buộc xác minh HMAC-SHA256 bằng `PAYOS_CHECKSUM_KEY`, đối chiếu `orderCode`, số tiền và trạng thái order trước khi kích hoạt Pro. Browser redirect tới `/payment/success` chỉ dùng để hiển thị trạng thái chờ xác nhận; không bao giờ tự kích hoạt subscription.

Firestore lưu order tại `paymentOrders/{orderCode}` với các field: `orderCode`, `userId`, `planCode`, `amount`, `durationDays`, `status`, `paymentLinkId`, `checkoutUrl`, `proExpiresAt`, `createdAt`, `paidAt`, `updatedAt`. `status` là `PENDING`, `PAID` hoặc `CANCELLED`. Webhook được xử lý idempotent; ngày Pro được cộng từ `max(serverNow, expiresAt hiện tại)` và expiry tuyệt đối được lưu trên order để retry không cộng ngày lần nữa hoặc hoàn tác một lần thu hồi admin diễn ra sau khi order đã được áp dụng.

Credentials và URL PayOS chỉ lấy từ biến môi trường `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYOS_BASE_URL`, `PAYOS_RETURN_URL`, `PAYOS_CANCEL_URL`; không đặt trong frontend hoặc commit vào repository. `PAYOS_SANDBOX=true` mới cho phép gói test một ngày.

## 4. API catalog đề thi công khai

### 4.1 Liệt kê đề đã phát hành

- **Mục đích:** lấy catalog đề thi để hiển thị cho mọi khách truy cập.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/tests`.
- **Quyền:** public.
- **Params/body:** không có.
- **Response thành công:** `200 OK`, mảng `TestMetadata`, không có `parts`; sắp xếp `updatedAt` mới nhất trước.

Chỉ đề `APPROVED` được trả về. Đề legacy không có `status` được xem là đã duyệt.

### 4.2 Lấy metadata một đề

- **Mục đích:** lấy thông tin giới thiệu, loại đề và thời lượng trước khi bắt đầu thi.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/tests/{testId}`.
- **Quyền:** public.
- **Path params:** `testId: string`, bắt buộc.
- **Response thành công:** `200 OK`, một `TestMetadata`, không có `parts`.
- **Lỗi chính:** `404 NOT_FOUND` nếu đề không tồn tại hoặc chưa ở trạng thái `APPROVED`.

### 4.3 Lấy dữ liệu một Part để luyện tập

- **Mục đích:** endpoint tương thích cho trang luyện Part cũ; trả nội dung một Part nhưng không lộ đáp án/lời giải.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/tests/{testId}/parts/{partId}`.
- **Quyền:** public.
- **Path params:** `testId: string`; `partId: string` nhận `part1`...`part7` hoặc `1`...`7`.
- **Response thành công:** `200 OK`, một object `TestPart` đã loại bỏ dữ liệu bí mật theo mục 2.2. Với Part 1–2, `answers[].content` cũng bị loại bỏ.
- **Lỗi chính:** `400 BAD_REQUEST` nếu `partId` không đúng định dạng; `404 NOT_FOUND` nếu đề/Part không tồn tại hoặc đề chưa được duyệt.

## 5. API lịch sử học tập

### 5.1 Lấy lịch sử attempt đã hoàn thành

- **Mục đích:** hiển thị lịch sử làm bài của chính user hiện tại.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/users/me/attempts`.
- **Quyền:** đã đăng nhập.
- **Params/body:** không có.
- **Response thành công:** `200 OK`, mảng attempt đã `COMPLETED`, sắp xếp `startedAt` mới nhất trước.

Mỗi phần tử gồm: `id`, `testId`, `type`, `mode`, `selectedPart`, `selectedParts`, `status`, `currentSection`, `currentQuestionNumber`, `totalQuestions`, `score`, `startedAt`, `updatedAt`, `submittedAt`, `result`.

### 5.2 Lấy thống kê học tập

- **Mục đích:** tổng hợp tiến độ và điểm số của user hiện tại.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/users/me/statistics`.
- **Quyền:** đã đăng nhập.
- **Params/body:** không có.
- **Response thành công:** `200 OK`.

```json
{
  "totalAttempts": 8,
  "completedAttempts": 6,
  "inProgressAttempts": 2,
  "averageScore": 705,
  "bestScore": 850,
  "averageListeningScore": 360,
  "averageReadingScore": 345,
  "activeDays": 5
}
```

`activeDays` là số ngày UTC khác nhau có attempt được nộp. Các giá trị trung bình là số nguyên được làm tròn; nếu chưa có mẫu thì bằng `0`.

### 5.3 Xóa một attempt

- **Mục đích:** xóa lịch sử/lượt làm bài do chính user sở hữu.
- **Method/type:** `DELETE`.
- **Path:** `/api/users/me/attempts/{attemptId}`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Path params:** `attemptId: string`, bắt buộc.
- **Response thành công:** `204 No Content`, không có body.
- **Lỗi chính:** `404 NOT_FOUND` nếu attempt không tồn tại hoặc không thuộc user hiện tại. API cố ý che giấu attempt của user khác.

## 6. API làm bài thi

Tất cả endpoint trong mục này yêu cầu đăng nhập. Ngoài endpoint tạo mới, user chỉ truy cập attempt có `userId` trùng Firebase UID hiện tại.

### 6.1 Tạo hoặc tiếp tục attempt theo đề

- **Mục đích:** tạo attempt mới, hoặc trả lại attempt `IN_PROGRESS` có cùng `testId`, `type`, `mode` và `selectedParts`.
- **Method/type:** `POST`, request/response `application/json`.
- **Path:** `/api/tests/{testId}/attempts`.
- **Quyền:** đã đăng nhập.
- **Path params:** `testId: string`, bắt buộc.
- **Request body:** tùy chọn; body rỗng tương đương Full Test mặc định.

```json
{
  "type": "FULL_TEST",
  "mode": "PART",
  "part": 5,
  "parts": [5, 6],
  "durationMinutes": 35,
  "restartExisting": false
}
```

| Field | Type | Bắt buộc | Quy tắc |
| --- | --- | --- | --- |
| `type` | `string` | Không | `FULL_TEST` hoặc `PRACTICE`; mặc định `FULL_TEST`. |
| `mode` | `string` | Không | `FULL`, `LISTENING`, `READING`, `PART`; mặc định `FULL`. |
| `part` | `integer` | Khi `mode=PART` nếu không có `parts` | Từ 1 đến 7. |
| `parts` | `integer[]` | Khi `mode=PART` nếu không có `part` | Ít nhất một Part từ 1 đến 7; server loại trùng và sắp xếp. |
| `durationMinutes` | `integer` | Không | Chỉ dùng cho `PART`, từ 1 đến 180 phút. |
| `restartExisting` | `boolean` | Không | Mặc định `false`. Nếu `true`, xóa attempt `IN_PROGRESS` trùng scope cùng các đáp án đã lưu rồi tạo attempt mới từ đầu. Chỉ gửi sau khi người dùng xác nhận “Bắt đầu lại”. |

Nếu `PART` không truyền `durationMinutes`, thời lượng gợi ý lần lượt cho Part 1–7 là `5, 10, 15, 15, 20, 10, 45` phút và được cộng theo các Part đã chọn.

- **Response thành công:** `200 OK`, `AttemptResponse` có `answers`, `answeredCount` và `resumed`. `resumed=true` nghĩa là server trả lại attempt đang làm dở; `false` nghĩa là attempt vừa được tạo mới.
- **Lỗi chính:** `400 BAD_REQUEST` khi `type`, `mode`, Part hoặc thời lượng không hợp lệ; `404 NOT_FOUND` nếu đề không tồn tại/chưa duyệt.

### 6.2 Tạo hoặc tiếp tục attempt — endpoint tương thích

- **Mục đích:** hỗ trợ frontend cũ; chức năng giống mục 6.1.
- **Method/type:** `POST`, request/response `application/json`.
- **Path:** `/api/attempts`.
- **Quyền:** đã đăng nhập.
- **Request body:** giống mục 6.1 nhưng bắt buộc có thêm `testId: string`.
- **Response thành công:** `200 OK`, `AttemptResponse` có đáp án đã lưu.
- **Lỗi chính:** `400 BAD_REQUEST` nếu thiếu/rỗng `testId` hoặc dữ liệu scope không hợp lệ.

Frontend mới nên dùng `POST /api/tests/{testId}/attempts`.

### 6.3 Lấy Full Test đang làm

- **Mục đích:** tìm Full Test attempt hiện tại để hỗ trợ nút “Tiếp tục làm bài”.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/attempts/current?testId={testId}`.
- **Quyền:** đã đăng nhập.
- **Query params:** `testId: string`, bắt buộc.
- **Response thành công:** `200 OK`, `AttemptResponse` có đáp án đã lưu.
- **Lưu ý:** endpoint chỉ tìm `type=FULL_TEST`, `mode=FULL`, đủ Part 1–7; không tìm attempt luyện riêng Part/section.
- **Lỗi chính:** `404 NOT_FOUND` nếu không có attempt phù hợp đang làm.

### 6.4 Lấy trạng thái một attempt

- **Mục đích:** lấy tiến độ, deadline, kết quả và đáp án đã lưu để đồng bộ UI.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/attempts/{attemptId}`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Path params:** `attemptId: string`.
- **Response thành công:** `200 OK`, `AttemptResponse` có `answers` và `answeredCount`.
- **Lỗi chính:** `404 NOT_FOUND` nếu không tồn tại; `403 FORBIDDEN` nếu thuộc user khác; `409 CONFLICT` nếu attempt có loại không được hỗ trợ.

### 6.5 Lấy toàn bộ dữ liệu để thi

- **Mục đích:** tải attempt và đề đã lọc bí mật để render màn hình làm bài.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/attempts/{attemptId}/exam`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Path params:** `attemptId: string`.
- **Response thành công:** `200 OK`.

```json
{
  "attempt": { "id": "attempt-123", "answers": {}, "answeredCount": 0 },
  "test": { "testId": "test-1", "parts": [] }
}
```

`attempt` theo `AttemptResponse`; `test` là `Test` đầy đủ đã loại dữ liệu bí mật theo mục 2.2.

- **Lỗi chính:** `409 CONFLICT` nếu attempt đã kết thúc.

### 6.6 Lưu hoặc bỏ chọn đáp án

- **Mục đích:** lưu lựa chọn A–D cho một câu; gửi `null` hoặc chuỗi rỗng để bỏ chọn.
- **Method/type:** `PUT`, request/response `application/json`.
- **Path:** `/api/attempts/{attemptId}/answers`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Path params:** `attemptId: string`.
- **Request body:**

```json
{
  "questionNumber": 101,
  "selectedAnswer": "A"
}
```

| Field | Type | Quy tắc |
| --- | --- | --- |
| `questionNumber` | `integer` | Từ 1 đến 200 và phải thuộc các Part đã chọn. |
| `selectedAnswer` | `string \| null` | `A`, `B`, `C`, `D`, không phân biệt hoa thường; `null`/rỗng để bỏ chọn. |

Trong Listening chỉ được lưu câu/nhóm câu đang hiển thị; câu cũ đã bị khóa. Khi đã chuyển sang Reading không thể sửa câu Listening.

- **Response thành công:** `200 OK`.

```json
{
  "questionNumber": 101,
  "selectedAnswer": "A",
  "savedAt": 1789020000000,
  "attempt": { "id": "attempt-123", "status": "IN_PROGRESS" }
}
```

`attempt` ở response này không có `answers` và `answeredCount`.

- **Lỗi chính:** `400 BAD_REQUEST` nếu số câu/đáp án sai; `409 CONFLICT` nếu câu ngoài scope, section không cho sửa hoặc bài đã khóa.

### 6.6a Lấy phản hồi tức thì cho luyện tập

- **Mục đích:** mở đáp án, trạng thái đúng/sai, bản dịch, transcript và lời giải của đúng một câu/nhóm câu trong lúc luyện tập.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/attempts/{attemptId}/practice-feedback?questionNumber={questionNumber}`.
- **Quyền:** đã đăng nhập; chỉ owner; attempt phải có `type=PRACTICE` và đang làm.
- **Quy tắc mở đáp án:** câu độc lập được mở sau khi đã chọn đáp án; nhóm gắn với cùng audio hoặc passage chỉ được mở sau khi tất cả câu trong nhóm đã có đáp án.
- **Bảo mật:** response chỉ chứa dữ liệu của unit hiện tại, không trả đáp án của các câu/nhóm chưa hoàn thành.
- **Response:** `ready=false` kèm `pendingQuestionNumbers` nếu nhóm chưa hoàn tất; khi `ready=true`, response có `questions`, `transcript` và `transcriptTranslation` tương ứng.

### 6.7 Cập nhật vị trí câu Reading

- **Mục đích:** lưu câu Reading đang được user xem để có thể tiếp tục đúng vị trí.
- **Method/type:** `PUT`, request/response `application/json`.
- **Path:** `/api/attempts/{attemptId}/position`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Request body:**

```json
{ "questionNumber": 125 }
```

`questionNumber` phải từ 101 trở lên và thuộc các Part đã chọn.

- **Response thành công:** `200 OK`, `AttemptResponse` có đáp án đã lưu.
- **Lỗi chính:** `409 CONFLICT` nếu chưa đến Reading hoặc bài đã khóa; `400 BAD_REQUEST` nếu câu không thuộc scope Reading.

### 6.8 Chuyển sang đơn vị Listening tiếp theo

- **Mục đích:** khóa đơn vị Listening hiện tại và di chuyển tới câu/nhóm tiếp theo. Part 3–4 di chuyển theo nhóm ba câu.
- **Method/type:** `POST`, response `application/json`.
- **Path:** `/api/attempts/{attemptId}/listening/next`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Body:** không có.
- **Response thành công:** `200 OK`, `AttemptResponse` có đáp án đã lưu. Khi hết Listening, server chuyển sang Reading nếu scope có Part Reading; nếu không, server tự nộp bài.
- **Tính idempotent:** nếu đã ở Reading hoặc attempt đã `COMPLETED`, server trả trạng thái hiện tại.
- **Lỗi chính:** `409 CONFLICT` nếu attempt không ở section hợp lệ.

### 6.9 Kết thúc Listening

- **Mục đích:** kết thúc sớm phần Listening; chuyển sang Reading hoặc nộp bài nếu scope chỉ có Listening.
- **Method/type:** `POST`, response `application/json`.
- **Path:** `/api/attempts/{attemptId}/finish-listening`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Body:** không có.
- **Response thành công:** `200 OK`, `AttemptResponse` có đáp án đã lưu.
- **Tính idempotent:** attempt đã hoàn thành trả lại trạng thái hiện tại.

### 6.10 Nộp bài

- **Mục đích:** khóa attempt, chấm điểm và tạo kết quả.
- **Method/type:** `POST`, response `application/json`.
- **Path:** `/api/attempts/{attemptId}/submit`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Body:** không có.
- **Response thành công:** `200 OK`, `ResultResponse`.
- **Tính idempotent:** nếu bài đã hoàn thành, trả lại kết quả đã lưu.
- **Lỗi chính:** với `type=FULL_TEST, mode=FULL`, trả `409 CONFLICT` nếu attempt vẫn đang ở Listening và chưa chuyển sang Reading; attempt đã khóa không nhận cập nhật khác. Attempt `PRACTICE` được phép nộp ở bất kỳ section nào.

### 6.11 Nộp bài — endpoint tương thích

- **Mục đích:** hỗ trợ frontend cũ, chấm và nộp attempt ngay cả khi Full Test chưa chuyển qua Reading.
- **Method/type:** `POST`, response `application/json`.
- **Path:** `/api/attempts/{attemptId}/submit-for-review`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Body:** không có.
- **Response thành công:** `200 OK`, `ResultResponse`.

Frontend mới nên dùng `POST /api/attempts/{attemptId}/submit`.

### 6.12 Lấy kết quả

- **Mục đích:** tải lại kết quả chấm điểm sau khi nộp.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/attempts/{attemptId}/result`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Response thành công:** `200 OK`, `ResultResponse`.
- **Lỗi chính:** `409 CONFLICT` nếu bài chưa được nộp.

### 6.13 Xem lại bài và lời giải

- **Mục đích:** trả đề đầy đủ sau khi nộp, kèm đáp án user và trạng thái đúng/sai từng câu.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/attempts/{attemptId}/review`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Response thành công:** `200 OK`.

```json
{
  "attempt": { "id": "attempt-123", "status": "COMPLETED", "answers": { "1": "A" } },
  "result": { "attemptId": "attempt-123", "totalScore": 820 },
  "aiAnalysisStatus": "NOT_REQUESTED",
  "aiAnalysisId": null,
  "test": {
    "testId": "test-1",
    "parts": [
      {
        "questions": [
          {
            "questionNumber": 101,
            "correctAnswer": "A",
            "selectedAnswer": "B",
            "answerStatus": "INCORRECT"
          }
        ]
      }
    ]
  }
}
```

`answerStatus` là `CORRECT`, `INCORRECT` hoặc `UNANSWERED`. Response review có thể chứa đáp án đúng, bản dịch, transcript và lời giải chi tiết.

- **Lỗi chính:** `409 CONFLICT` nếu attempt chưa hoàn thành.

### 6.14 Yêu cầu AI phân tích Full Test

- **Mục đích:** tạo yêu cầu nhận xét tổng thể bằng AI cho một Full Test đã hoàn thành.
- **Method/type:** `POST`, response `application/json`; tác vụ xử lý bất đồng bộ.
- **Path:** `/api/attempts/{attemptId}/ai-analysis`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Body:** không có.
- **Query:** `refresh: boolean`, mặc định `false`; `true` yêu cầu phân tích lại kết quả đã hoàn thành.
- **Điều kiện:** attempt phải có `type=FULL_TEST`, `mode=FULL`, `status=COMPLETED`.
- **Quyền Pro:** tạo mới, thử lại job thất bại và refresh cần entitlement `AI_ANALYSIS` đang có hiệu lực. Thiếu quyền trả `403 PRO_REQUIRED` trước khi lưu hoặc publish job.
- **Response thành công:** `200 OK`.

```json
{
  "attemptId": "attempt-123",
  "aiAnalysisStatus": "PENDING",
  "status": "PENDING",
  "message": "Yêu cầu phân tích đã được tiếp nhận."
}
```

Trạng thái có thể là `NOT_REQUESTED`, `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`. Gọi lại khi đang xử lý hoặc đã hoàn thành với `refresh=false` không tạo job trùng; server trả trạng thái hiện tại.

Job `PENDING`/`PROCESSING` luôn trả trạng thái hiện tại kể cả `refresh=true`. Kết quả `COMPLETED` với `refresh=false` cũng trả trạng thái hiện tại; các trường hợp idempotent này không yêu cầu Pro còn hiệu lực.

- **Lỗi chính:** `409 CONFLICT` nếu không phải Full Test đầy đủ hoặc chưa hoàn thành; `503 SERVICE_UNAVAILABLE` nếu không publish được yêu cầu sang AI Service.

### 6.15 Lấy trạng thái/kết quả AI analysis

- **Mục đích:** polling trạng thái và lấy kết quả nhận xét khi hoàn thành.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/attempts/{attemptId}/ai-analysis`.
- **Quyền:** đã đăng nhập; chỉ owner.
- **Response thành công:** `200 OK`.

```json
{
  "attemptId": "attempt-123",
  "aiAnalysisStatus": "COMPLETED",
  "status": "COMPLETED",
  "result": {
    "summary": "...",
    "strengths": [],
    "weaknesses": [],
    "partAnalysis": [],
    "knowledgeGaps": [],
    "timeManagement": {},
    "priorityTopics": [],
    "studyPlan": [],
    "nextActions": [],
    "overallConfidence": 0.85,
    "limitations": [],
    "statistics": {}
  }
}
```

Khi chưa hoàn thành, `result` là `null`. Nếu trạng thái là `COMPLETED` nhưng document kết quả chưa tồn tại, server trả `409 CONFLICT`.

GET không yêu cầu entitlement Pro; owner vẫn đọc được kết quả đã hoàn thành sau khi subscription hết hạn hoặc bị thu hồi. Ownership check vẫn áp dụng cho cả attempt và kết quả.

## 7. API AI giải thích một câu hỏi

Nhóm này độc lập với AI analysis toàn bài ở mục 6.14–6.15.

### 7.1 Tạo job giải thích đáp án

- **Mục đích:** yêu cầu AI giải thích một câu hỏi/đáp án theo cơ chế job bất đồng bộ.
- **Method/type:** `POST`, request/response `application/json`.
- **Path:** `/api/ai/jobs/explanations`.
- **Quyền:** đã đăng nhập.
- **Request body:**

```json
{
  "question": "The meeting begins ___ nine.",
  "options": {
    "A": "at",
    "B": "in",
    "C": "on",
    "D": "by"
  },
  "correctAnswer": "A",
  "userAnswer": "B",
  "locale": "vi"
}
```

`question`, `options` không rỗng và `correctAnswer` là bắt buộc. `userAnswer`, `locale` là tùy chọn.

- **Response thành công:** `202 Accepted`.

```json
{
  "jobId": "uuid",
  "taskType": "EXPLAIN_ANSWER",
  "status": "PENDING",
  "createdAt": 1789020000000,
  "updatedAt": 1789020000000,
  "completedAt": null,
  "result": null,
  "error": null
}
```

- **Lỗi chính:** `400 BAD_REQUEST` nếu thiếu dữ liệu bắt buộc; `503 SERVICE_UNAVAILABLE` nếu AI service không khả dụng.

### 7.2 Lấy trạng thái/kết quả AI job

- **Mục đích:** polling job do chính user tạo.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/ai/jobs/{jobId}`.
- **Quyền:** đã đăng nhập; chỉ owner của job.
- **Path params:** `jobId: string`.
- **Response thành công:** `200 OK`, cùng schema job ở mục 7.1.

Khi thành công:

```json
{
  "status": "SUCCEEDED",
  "result": {
    "explanation": "Dùng at trước một giờ cụ thể.",
    "grammarPoint": "Prepositions of time",
    "correctAnswer": "A"
  },
  "error": null
}
```

Khi thất bại, `status=FAILED`, `result=null` và `error` chứa thông báo lỗi. Job không tồn tại hoặc thuộc user khác đều trả `404 NOT_FOUND`.

## 7A. API Capy AI Chat

Tất cả endpoint dùng Firebase UID từ session đã xác thực; không nhận `userId`, ownership, entitlement, đáp án hoặc lịch sử từ client. Conversation/job không tồn tại và resource của user khác đều trả cùng `404 NOT_FOUND`. Response công khai không trả `userId` hoặc `idempotencyKey` nội bộ.

Mutation `POST`/`PATCH`/`DELETE` yêu cầu entitlement `AI_CHAT` đang có hiệu lực. Chat TOEIC chung vẫn dùng được khi user còn attempt `IN_PROGRESS`; chỉ conversation gắn câu hỏi mới bị kiểm tra lại trạng thái attempt trước khi tạo và trước mỗi lần gửi. `GET` chỉ yêu cầu đăng nhập, nên user hết hạn/thu hồi Pro vẫn đọc được lịch sử cũ.

### 7A.1 Tạo conversation

- **Method/path:** `POST /api/ai/chat/conversations`.
- **Body:** `locale` chỉ nhận `vi|en`; `attemptId` và `questionNumber` phải cùng có hoặc cùng vắng mặt.

```json
{
  "locale": "vi",
  "attemptId": "attempt-123",
  "questionNumber": 101
}
```

Context chỉ hợp lệ với đúng một câu thuộc attempt của user, đã `COMPLETED` và nằm trong scope. Frontend chỉ gửi identifiers; BE-Core tự lấy các review field được phép. Với chat TOEIC chung, gửi `{ "locale": "vi" }`.

- **Response:** `201 Created`.

```json
{
  "id": "conversation-uuid",
  "title": "Hội thoại TOEIC mới",
  "locale": "vi",
  "contextAttemptId": "attempt-123",
  "contextQuestionNumber": 101,
  "status": "ACTIVE",
  "createdAt": 1791093600000,
  "updatedAt": 1791093600000,
  "lastMessageAt": 1791093600000
}
```

Tối đa 10 conversation `ACTIVE`; conversation đã soft-delete không tính vào giới hạn.

### 7A.2 Liệt kê và mở conversation

- `GET /api/ai/chat/conversations` trả `200 OK`, mảng conversation active sắp xếp theo `lastMessageAt` mới nhất trước.
- `GET /api/ai/chat/conversations/{conversationId}` trả `200 OK`:

```json
{
  "conversation": {
    "id": "conversation-uuid",
    "title": "Hội thoại TOEIC mới",
    "locale": "vi",
    "contextAttemptId": null,
    "contextQuestionNumber": null,
    "status": "ACTIVE",
    "createdAt": 1791093600000,
    "updatedAt": 1791093601000,
    "lastMessageAt": 1791093601000
  },
  "messages": [
    {
      "id": "message-id",
      "role": "USER",
      "content": "Giải thích giúp mình cách dùng despite.",
      "status": "SUCCEEDED",
      "jobId": "job-id",
      "errorCode": null,
      "createdAt": 1791093601000,
      "completedAt": 1791093601000
    }
  ]
}
```

Message có `role=USER|ASSISTANT`, `status=PENDING|SUCCEEDED|FAILED`. Assistant `PENDING` có `content=null`; assistant `FAILED` có `errorCode` và giữ `content=null`.

### 7A.3 Gửi tin nhắn

- **Method/path:** `POST /api/ai/chat/conversations/{conversationId}/messages`.
- **Body:** `content` được trim, tối đa 1.000 Unicode characters; `idempotencyKey` không rỗng, tối đa 128 ký tự và phải duy nhất theo user.

```json
{
  "content": "Vì sao câu này dùng despite?",
  "idempotencyKey": "95cbcb8e-f88a-4ae2-b510-575047a7d590"
}
```

- **Response:** `202 Accepted`. Một key lặp với cùng conversation/content trả lại đúng aggregate cũ với `newlyAccepted=false`, không charge quota và không publish lại.

```json
{
  "conversation": {
    "id": "conversation-uuid",
    "title": "Vì sao câu này dùng despite?",
    "locale": "vi",
    "contextAttemptId": null,
    "contextQuestionNumber": null,
    "status": "ACTIVE",
    "createdAt": 1791093600000,
    "updatedAt": 1791093601000,
    "lastMessageAt": 1791093601000
  },
  "userMessage": {
    "id": "user-message-id",
    "role": "USER",
    "content": "Vì sao câu này dùng despite?",
    "status": "SUCCEEDED",
    "jobId": "job-id",
    "errorCode": null,
    "createdAt": 1791093601000,
    "completedAt": 1791093601000
  },
  "assistantMessage": {
    "id": "assistant-message-id",
    "role": "ASSISTANT",
    "content": null,
    "status": "PENDING",
    "jobId": "job-id",
    "errorCode": null,
    "createdAt": 1791093601000,
    "completedAt": null
  },
  "job": {
    "id": "job-id",
    "conversationId": "conversation-uuid",
    "userMessageId": "user-message-id",
    "assistantMessageId": "assistant-message-id",
    "status": "PENDING",
    "errorCode": null,
    "createdAt": 1791093601000,
    "updatedAt": 1791093601000,
    "completedAt": null
  },
  "quotaSummary": {
    "dailyLimit": 30,
    "remainingDaily": 29,
    "nextResetAt": 1791133200000
  },
  "newlyAccepted": true
}
```

Tin nhắn user đầu tiên thay tiêu đề mặc định bằng nội dung câu hỏi đã chuẩn hóa khoảng trắng và giới hạn 60 Unicode code points. Các tin nhắn sau không đổi tiêu đề.

Quota được charge atomically một lần khi message hợp lệ được chấp nhận: 30/ngày lịch `Asia/Ho_Chi_Minh`, reset lúc 00:00 kế tiếp, và tối đa 5 lượt trong rolling 60 giây. Server dùng admission time không giảm để request commit đảo thứ tự quanh nửa đêm không vượt giới hạn.

### 7A.3b Thử lại tin nhắn thất bại

- **Method/path:** `POST /api/ai/chat/conversations/{conversationId}/messages/{messageId}/retry`, trong đó `{messageId}` là id của **assistant message đang `FAILED`**.
- **Body:** không có.
- **Response:** `202 Accepted`, cùng response shape với 7A.3 (`userMessage`, `assistantMessage`, `job`, `quotaSummary`, `newlyAccepted`). Khác biệt:
  - Tái dùng đúng cặp user/assistant message cũ — **không tạo tin nhắn user mới, không trừ quota**.
  - `job.id` là id mới; assistant message được reset về `PENDING` (`errorCode`/`completedAt` xóa).
  - `newlyAccepted=false` khi lượt retry đã được chấp nhận mà job vẫn `PENDING` (double-click hoặc mất response): không tạo job mới, server publish lại job đó.
- **Điều kiện lỗi thêm:** `400 CHAT_MESSAGE_INVALID` khi message không phải assistant hoặc không ở trạng thái `FAILED`/`PENDING` hợp lệ để retry; `403 PRO_REQUIRED` khi Pro hết hạn (hết hạn vẫn đọc lịch sử nhưng không được retry); `404 NOT_FOUND` khi conversation/message không thuộc user.

### 7A.4 Poll job

- **Method/path:** `GET /api/ai/chat/jobs/{jobId}`.
- **Response:** `200 OK`, cùng schema `job` ở response `202`; `status=PENDING|SUCCEEDED|FAILED`. Khi terminal, `completedAt` có giá trị; khi failed, `errorCode` có mã ổn định. Frontend poll đến terminal với timeout/abort riêng, rồi đọc lại conversation để lấy assistant message cuối cùng.

### 7A.5 Đổi tên conversation

- **Method/path:** `PATCH /api/ai/chat/conversations/{conversationId}`.
- **Body:** `{ "title": "Mẹo Part 5: giới từ" }`.
- **Response:** `200 OK`, schema conversation như API tạo/list.
- `title` được trim, chuẩn hóa chuỗi khoảng trắng và phải dài từ 1 đến 60 Unicode code points. Chỉ owner có entitlement `AI_CHAT` hiệu lực được đổi tên conversation active.

### 7A.6 Xóa conversation

- **Method/path:** `DELETE /api/ai/chat/conversations/{conversationId}`.
- **Response:** `204 No Content`.
- Đây là soft delete: conversation biến mất khỏi list/read và không được gửi cho Gemini; message/job vẫn được giữ. Thao tác lặp trên conversation owned đã xóa là no-op ở tầng lưu trữ, nhưng normal lookup vẫn không công khai resource đã xóa.

### 7A.7 Lỗi ổn định

| HTTP | Code | Điều kiện |
| --- | --- | --- |
| `400` | `CHAT_CONTEXT_INVALID` | Locale hoặc cặp context identifiers không hợp lệ. |
| `400` | `CHAT_MESSAGE_INVALID` | Content/key rỗng, quá dài, malformed, key được reuse cho payload khác, hoặc retry khi assistant message không ở trạng thái cho phép. |
| `400` | `CHAT_TITLE_INVALID` | Tiêu đề rỗng hoặc dài quá 60 Unicode code points. |
| `403` | `PRO_REQUIRED` | Mutation khi thiếu `AI_CHAT` có hiệu lực. |
| `404` | `NOT_FOUND` | Conversation/job/context không tồn tại, bị xóa, ngoài scope hoặc thuộc user khác. |
| `403` | `ATTEMPT_NOT_COMPLETED` | Câu hỏi thuộc attempt chưa hoàn thành; backend không trả nội dung review. |
| `409` | `CONVERSATION_LIMIT_REACHED` | Đã có 10 conversation active. |
| `429` | `CHAT_RATE_LIMITED` | Vượt 5 lượt trong rolling minute. |
| `429` | `CHAT_DAILY_LIMIT_REACHED` | Hết 30 lượt trong ngày Việt Nam. |
| `503` | `AI_UNAVAILABLE` | Không publish được hoặc provider tạm thời lỗi. |

## 8. API Employee quản lý đề

Yêu cầu role `EMPLOYEE` hoặc `ADMIN`. API danh sách/chi tiết chỉ thao tác trên đề có `createdBy` bằng UID hiện tại; `ADMIN` không tự động thấy hoặc sửa đề của employee khác qua nhóm API này.

### 8.1 Liệt kê đề do mình tạo

- **Mục đích:** lấy danh sách đề của employee hiện tại để quản lý.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/employee/tests`.
- **Params/body:** không có.
- **Response thành công:** `200 OK`, mảng `TestMetadata`, không có `parts`, sắp xếp `updatedAt` mới nhất trước.

### 8.2 Tạo đề nháp

- **Mục đích:** tạo đề mới ở trạng thái `DRAFT`.
- **Method/type:** `POST`, request/response `application/json`.
- **Path:** `/api/employee/tests`.
- **Request body:** object `Test` đầy đủ theo mục 2.2. `title` là bắt buộc; có thể gửi `parts` ngay khi tạo.
- **Field do server kiểm soát:** `testId`, `createdBy`, `status`, `createdAt`, `updatedAt`, `submittedAt`, `reviewedBy`, `reviewedAt`, `rejectionReason` được server tạo, ghi đè hoặc xóa phù hợp.
- **Response thành công:** `201 Created`, object `Test` đầy đủ với `status=DRAFT`.
- **Lỗi chính:** `400 BAD_REQUEST` nếu `title` rỗng.

### 8.3 Lấy chi tiết đề của mình

- **Mục đích:** tải toàn bộ đề để chỉnh sửa hoặc xem trạng thái review.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/employee/tests/{testId}`.
- **Path params:** `testId: string`.
- **Response thành công:** `200 OK`, object `Test` đầy đủ, có `parts`, đáp án và lời giải.
- **Lỗi chính:** `404 NOT_FOUND` nếu không tồn tại; `403 FORBIDDEN` nếu đề thuộc người khác.

### 8.4 Cập nhật đề

- **Mục đích:** thay thế nội dung một đề có thể chỉnh sửa.
- **Method/type:** `PUT`, request/response `application/json`.
- **Path:** `/api/employee/tests/{testId}`.
- **Path params:** `testId: string`.
- **Request body:** object `Test` đầy đủ theo mục 2.2; `title` bắt buộc.
- **Quy tắc:** chỉ đề `DRAFT` hoặc `REJECTED` được cập nhật. Sau update, server đặt lại `status=DRAFT`, giữ `testId`, `createdBy`, `createdAt`, cập nhật `updatedAt` và xóa metadata review cũ.
- **Response thành công:** `200 OK`, object `Test` đầy đủ đã lưu.
- **Lỗi chính:** `403 FORBIDDEN` nếu không phải owner; `409 CONFLICT` nếu trạng thái không cho sửa.

### 8.5 Xóa đề

- **Mục đích:** xóa đề nháp hoặc đề bị từ chối do chính employee tạo.
- **Method/type:** `DELETE`.
- **Path:** `/api/employee/tests/{testId}`.
- **Path params:** `testId: string`.
- **Response thành công:** `204 No Content`.
- **Lỗi chính:** `403 FORBIDDEN` nếu không phải owner; `409 CONFLICT` nếu đề không ở `DRAFT`/`REJECTED`.

### 8.6 Gửi đề chờ duyệt

- **Mục đích:** validate toàn bộ đề và chuyển từ `DRAFT`/`REJECTED` sang `PENDING_REVIEW`.
- **Method/type:** `POST`, response `application/json`.
- **Path:** `/api/employee/tests/{testId}/submit`.
- **Body:** không có.
- **Điều kiện validate:**

  - Có đúng Part 1–7, không thiếu/trùng `partNumber`.
  - Có đúng 200 câu, đánh số liên tục 1–200, không thiếu/trùng `questionNumber`.
  - Part 2: mỗi câu có đúng ba đáp án, nhãn A, B, C không trùng; `correctAnswer` là A, B hoặc C.
  - Các Part còn lại: mỗi câu có đúng bốn đáp án, nhãn A, B, C, D không trùng; `correctAnswer` là A, B, C hoặc D.
  - Quy tắc lựa chọn này cũng áp dụng khi Admin approve. Không tự động chuyển đổi đề đã duyệt; đề nháp/đề gửi lại phải đáp ứng quy tắc mới.

- **Response thành công:** `200 OK`, object `Test` đầy đủ với `status=PENDING_REVIEW`, `submittedAt` được cập nhật.
- **Lỗi chính:** `400 BAD_REQUEST` nếu đề không hợp lệ; `403 FORBIDDEN` nếu không phải owner; `409 CONFLICT` nếu đề không còn chỉnh sửa được.

### 8.7 Upload media

- **Mục đích:** upload ảnh/audio dùng trong đề lên bucket public `toeic-media` của Supabase Storage.
- **Method/type:** `POST`, request `multipart/form-data`, response `application/json`.
- **Path:** `/api/employee/media`.
- **Form params:** field `file`, bắt buộc.
- **Định dạng hỗ trợ:** JPEG, PNG, WEBP, GIF, MP3 (`audio/mpeg`), MP4 audio, WAV, OGG.
- **Giới hạn:** tối đa 15 MB.
- **Response thành công:** `201 Created`.

```json
{
  "url": "https://your-project.supabase.co/storage/v1/object/public/toeic-media/employee-uid/uuid-file.mp3",
  "objectName": "employee-uid/uuid-file.mp3",
  "fileName": "file.mp3",
  "contentType": "audio/mpeg",
  "size": 1048576
}
```

Frontend không tự đặt header `Content-Type`; trình duyệt cần tự thêm multipart boundary. Deployment backend phải có `SUPABASE_URL` (URL gốc project, không kèm `/storage/v1`) và `SUPABASE_SERVICE_KEY` (key đặc quyền chỉ được lưu trên server). Không đưa key vào frontend hoặc biến `VITE_*`.

Bucket `toeic-media` phải tồn tại và bật public trước khi upload; giới hạn bucket phải cho phép các MIME type trên và file tới 15 MB (15 × 1024 × 1024 byte). Public chỉ phục vụ việc đọc media; API upload vẫn yêu cầu Employee/Admin. Bất kỳ ai có URL đều đọc được file, kể cả media đề nháp; không upload đáp án, giải thích, bản dịch hoặc transcript vào bucket public.

`objectName` là đường dẫn tương đối trong bucket, được backend tạo từ UID đã xác thực và UUID; không ghi đè file cũ. Sau upload, frontend lấy `response.url` gán vào `imageUrl`, `audioUrl` hoặc phần tử `imageUrls` đúng cấu trúc đề, rồi gọi API tạo/cập nhật đề để lưu URL cùng nội dung text trên Firestore. Upload riêng không tự lưu đề.

Ví dụ tích hợp bằng wrapper hiện có (trong event handler cần xử lý loading/error):

```js
const media = await uploadEmployeeMedia(file);
// Gán media.url vào trường media tương ứng của câu hỏi/group đang sửa.
```

- **Lỗi chính:** `400 BAD_REQUEST` nếu file rỗng, quá lớn hoặc sai MIME type; `503 SERVICE_UNAVAILABLE` nếu cấu hình Supabase thiếu/không hợp lệ; `502 BAD_GATEWAY` nếu Supabase từ chối upload, lỗi kết nối hoặc timeout. Không trả chi tiết lỗi/credentials từ Supabase cho frontend.
- File quá lớn bị lớp multipart từ chối trước controller có thể trả `413`; frontend cần xử lý theo HTTP status. Giới hạn toàn bộ multipart request là 16 MB để chứa file 15 MB cùng multipart headers.

## 9. API Admin duyệt đề

Tất cả endpoint trong mục này yêu cầu role `ADMIN`.

### 9.1 Liệt kê đề đang chờ duyệt

- **Mục đích:** lấy queue đề có `status=PENDING_REVIEW`.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/admin/test-submissions`.
- **Params/body:** không có.
- **Response thành công:** `200 OK`, mảng `TestMetadata`, không có `parts`, sắp xếp `submittedAt` cũ nhất trước.

### 9.2 Lấy chi tiết submission

- **Mục đích:** xem đầy đủ nội dung đề trước/sau khi duyệt.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/admin/test-submissions/{testId}`.
- **Path params:** `testId: string`.
- **Response thành công:** `200 OK`, object `Test` đầy đủ.
- **Phạm vi trạng thái:** nhận `PENDING_REVIEW`, `APPROVED`, `REJECTED`; không trả đề `DRAFT` hoặc đề legacy chưa có status.
- **Lỗi chính:** `404 NOT_FOUND` nếu không có submission phù hợp.

### 9.3 Duyệt đề

- **Mục đích:** validate lần cuối và chuyển đề từ `PENDING_REVIEW` sang `APPROVED`.
- **Method/type:** `POST`, response `application/json`.
- **Path:** `/api/admin/test-submissions/{testId}/approve`.
- **Body:** không có.
- **Response thành công:** `200 OK`, object `Test` đầy đủ với `status=APPROVED`, `reviewedBy`, `reviewedAt`, `updatedAt` được cập nhật và `rejectionReason=null`.
- **Lỗi chính:** `400 BAD_REQUEST` nếu cấu trúc đề không hợp lệ; `409 CONFLICT` nếu đề không còn `PENDING_REVIEW`.

### 9.4 Từ chối đề

- **Mục đích:** chuyển đề từ `PENDING_REVIEW` sang `REJECTED` và lưu lý do.
- **Method/type:** `POST`, request/response `application/json`.
- **Path:** `/api/admin/test-submissions/{testId}/reject`.
- **Request body:**

```json
{
  "reason": "Nội dung cần chỉnh sửa"
}
```

`reason: string` là bắt buộc và không được chỉ chứa khoảng trắng.

- **Response thành công:** `200 OK`, object `Test` đầy đủ với `status=REJECTED`, `reviewedBy`, `reviewedAt`, `updatedAt`, `rejectionReason` được cập nhật.
- **Lỗi chính:** `400 VALIDATION_ERROR` nếu lý do rỗng; `409 CONFLICT` nếu đề không còn `PENDING_REVIEW`.

### 9.5 Lấy lịch sử review

- **Mục đích:** hiển thị các đề đã được admin duyệt hoặc từ chối.
- **Method/type:** `GET`, response `application/json`.
- **Path:** `/api/admin/review-history`.
- **Params/body:** không có.
- **Response thành công:** `200 OK`, mảng `TestMetadata` có status `APPROVED`/`REJECTED` và `reviewedAt` khác `null`, sắp xếp lần review mới nhất trước.

### 9.6 Quản lý subscription Pro

Tất cả endpoint dưới đây yêu cầu role `ADMIN`, session hợp lệ; PUT/DELETE còn cần CSRF như quy ước chung. `uid` là UID người nhận subscription, không phải UID người thực hiện. Actor `activatedBy`/`revokedBy` lấy từ principal đã xác thực, không từ body.

| Method/path | Body | Response |
| --- | --- | --- |
| `GET /api/admin/subscriptions/{uid}` | Không có | `200 OK`, summary sáu field tại mục 3.1. |
| `PUT /api/admin/subscriptions/{uid}` | Chỉ `{ "expiresAt": 1791612000000 }` | `200 OK`, summary sau kích hoạt/gia hạn. |
| `DELETE /api/admin/subscriptions/{uid}` | Không có | `200 OK`, summary sau thu hồi (không phải `204`). |

GET với subscription chưa tồn tại trả summary rỗng, không trả `404`. PUT yêu cầu `expiresAt` bắt buộc, là Unix millisecond sau thời gian server; thiếu/null trả `400 VALIDATION_ERROR`, body không deserialize được trả `400 INVALID_REQUEST_BODY`, thời hạn không ở tương lai trả `400 SUBSCRIPTION_EXPIRY_INVALID`. Không gửi `planCode`, `status`, quyền, ngày bắt đầu hoặc audit fields.

PUT tạo subscription mới hoặc kích hoạt lại subscription hết hạn/bị thu hồi với `startsAt=serverNow`. Khi status `ACTIVE` và expiry hiện tại còn ở tương lai, PUT giữ ngày bắt đầu (nếu có), chỉ kéo dài expiry; expiry yêu cầu bằng hoặc sớm hơn expiry hiện tại là no-op sau khi đã validate thời điểm tương lai. Khi ghi, server đặt `PRO`, `ACTIVE`, `[AI_CHAT, AI_ANALYSIS]`, cập nhật `activatedBy`/`updatedAt`, xóa metadata thu hồi và giữ `createdAt` cũ.

DELETE đánh dấu `REVOKED`, cập nhật `revokedBy`, `revokedAt`, `updatedAt`; không xóa document. Subscription chưa tồn tại hoặc đã `REVOKED` là no-op và vẫn trả `200 OK`. Thiếu session trả `401 AUTHENTICATION_REQUIRED`; sai role trả `403 ACCESS_DENIED`.

PUT và DELETE đọc, quyết định và ghi subscription trong cùng một Firestore transaction. Khi có cập nhật đồng thời, server tính lại trên document mới nhất để giữ quy tắc không rút ngắn expiry, tính idempotent và metadata audit.

## 10. API nội bộ kiểm thử AI

### 10.1 Publish trực tiếp một yêu cầu giải thích

- **Mục đích:** endpoint kiểm thử kết nối RabbitMQ/AI; không dùng cho frontend production.
- **Method/type:** `POST`, request/response `application/json`.
- **Path:** `/api/internal/ai/explain`.
- **Quyền:** `ADMIN`.
- **Điều kiện tồn tại:** chỉ được đăng ký khi `app.ai.test-endpoint-enabled=true`.
- **Request body:** giống payload ở mục 7.1.
- **Response thành công:** `202 Accepted`.

```json
{
  "jobId": "uuid",
  "status": "PENDING"
}
```

Endpoint này chỉ publish message, không tạo AI job thuộc user để polling qua `/api/ai/jobs/{jobId}`.

## 11. Workflow trạng thái

### Đề thi

```text
DRAFT -> PENDING_REVIEW -> APPROVED
                        -> REJECTED -> DRAFT
```

- `DRAFT`, `REJECTED`: employee owner được sửa/xóa.
- `PENDING_REVIEW`: chờ admin, employee không được sửa/xóa.
- `APPROVED`: xuất hiện ở catalog public.

### Attempt

```text
IN_PROGRESS/LISTENING -> IN_PROGRESS/READING -> COMPLETED/FINISHED
           \----------------------------------> COMPLETED/FINISHED
```

Nhánh trực tiếp xảy ra với scope chỉ có Listening, khi dùng endpoint tương thích hoặc khi hết giờ/tự nộp.

### AI analysis toàn bài

```text
NOT_REQUESTED -> PENDING -> PROCESSING -> COMPLETED
                    \----------\-------> FAILED
```

### Capy AI Chat

```text
accepted: USER/SUCCEEDED + ASSISTANT/PENDING + JOB/PENDING
                                      -> ASSISTANT/SUCCEEDED + JOB/SUCCEEDED
                                      -> ASSISTANT/FAILED    + JOB/FAILED
```

Terminal delivery đầu tiên thắng; result lặp hoặc identifiers không khớp không ghi đè. Transport duplicate không charge hoặc publish lại.

AI Service dùng `aiChatGenerationResults/{jobId}` làm outbox terminal trước khi publish `ai.chat.result`. Document chỉ chứa job/user/conversation/assistant-message identifiers, trạng thái, answer hoặc stable error code và timestamps; không chứa history, current message hay question context. Khi listener retry hoặc Rabbit redelivery, AI Service replay terminal result đã lưu thay vì gọi Gemini lại. Outbox `PROCESSING` không được cleanup; terminal outbox chỉ cleanup sau khi BE-Core job đã terminal và qua retention window vận hành.

## 12. Error response

Security và application errors đều trả JSON. Frontend nên xử lý theo HTTP status và `code`, không so khớp nội dung tiếng Việt của `message`.

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

| HTTP status | `code` thường gặp | Ý nghĩa |
| --- | --- | --- |
| `400` | `BAD_REQUEST` | Param hoặc dữ liệu nghiệp vụ không hợp lệ. |
| `400` | `VALIDATION_ERROR` | Bean validation thất bại; chi tiết nằm trong `fieldErrors`. |
| `400` | `INVALID_REQUEST_BODY` | JSON body sai cú pháp/không deserialize được. |
| `401` | `AUTHENTICATION_REQUIRED` | Thiếu, sai hoặc hết hạn Firebase ID token. |
| `403` | `ACCESS_DENIED` | User đã đăng nhập nhưng thiếu role cần thiết. |
| `403` | `FORBIDDEN` | Lỗi quyền sở hữu/nghiệp vụ do service trả về. |
| `403` | `PRO_REQUIRED` | Tạo/thử lại/refresh AI analysis khi thiếu entitlement Pro có hiệu lực. |
| `400` | `CHAT_CONTEXT_INVALID`, `CHAT_MESSAGE_INVALID`, `CHAT_TITLE_INVALID` | Context, nội dung hoặc tiêu đề chat không hợp lệ. |
| `403` | `ATTEMPT_NOT_COMPLETED` | Câu hỏi chat thuộc bài chưa hoàn thành. |
| `409` | `CONVERSATION_LIMIT_REACHED` | Đã đạt giới hạn conversation đang hoạt động. |
| `429` | `CHAT_RATE_LIMITED`, `CHAT_DAILY_LIMIT_REACHED` | Vượt quota chat burst/ngày. |
| `503` | `AI_UNAVAILABLE` | RabbitMQ/Gemini chat tạm thời không sẵn sàng. |
| `400` | `SUBSCRIPTION_EXPIRY_INVALID` | Expiry subscription không sau thời gian server. |
| `400` | `PAYMENT_PLAN_INVALID`, `PAYMENT_WEBHOOK_INVALID`, `PAYMENT_WEBHOOK_SIGNATURE_INVALID` | Gói thanh toán hoặc webhook PayOS không hợp lệ. |
| `403` | `PAYMENT_PLAN_UNAVAILABLE` | Gói chỉ dành cho sandbox nhưng server đang chạy production mode. |
| `502` | `PAYOS_UNAVAILABLE` | PayOS không tạo được link thanh toán. |
| `404` | `NOT_FOUND` | Resource không tồn tại hoặc bị che bởi rule ownership/publication. |
| `409` | `CONFLICT` | Trạng thái workflow/section không cho phép thao tác. |
| `503` | `SERVICE_UNAVAILABLE` | Storage, RabbitMQ hoặc AI service chưa sẵn sàng. |

Ngoài các lỗi riêng ghi tại từng endpoint, mọi endpoint được bảo vệ đều có thể trả `401`; endpoint giới hạn role có thể trả `403`.
