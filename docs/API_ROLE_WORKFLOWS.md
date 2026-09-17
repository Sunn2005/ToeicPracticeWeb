# Tài liệu API, phân quyền và workflow TOEIC

Tài liệu này mô tả contract hiện tại của REST API trong `backend`: mục đích, HTTP method, path, quyền truy cập, tham số, request body, response và các lỗi nghiệp vụ quan trọng.

## 1. Quy ước chung

### Base URL và định dạng

- Base URL khi chạy local: `http://localhost:8080`.
- Request/response thông thường dùng `application/json`.
- Upload media dùng `multipart/form-data`.
- Các thời điểm như `createdAt`, `updatedAt`, `startedAt`, `submittedAt` là Unix timestamp theo millisecond (`Long`).
- Những field chưa có dữ liệu có thể trả về `null`.
- API không dùng session phía server; token phải được gửi lại trong mỗi request được bảo vệ.

### Xác thực

Mọi endpoint được bảo vệ yêu cầu header:

```http
Authorization: Bearer <Firebase-ID-token>
```

`GUEST` là phiên trình duyệt chưa đăng nhập và không được lưu trong Firestore. Profile đã đăng nhập nằm tại `users/{uid}`; tài khoản mới mặc định có role `USER`.

Firestore `users/{uid}.role` là nguồn dữ liệu duy nhất dùng để phân quyền. Role `EMPLOYEE` hoặc `ADMIN` phải được gán bằng quy trình quản trị tin cậy. Không nhận role từ request body, local storage hoặc state của frontend.

Spring Security ánh xạ role thành `ROLE_USER`, `ROLE_EMPLOYEE`, `ROLE_ADMIN`.

### Ma trận phân quyền

| Nhóm API | GUEST | USER | EMPLOYEE | ADMIN |
| --- | --- | --- | --- | --- |
| `GET /api/tests`, metadata và Part | Có | Có | Có | Có |
| `POST /api/tests/{testId}/attempts` | Không | Có | Có | Có |
| `/api/me`, `/api/users/me/**`, `/api/attempts/**` | Không | Có | Có | Có |
| `/api/ai/jobs/**` | Không | Có | Có | Có |
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
  "role": "USER",
  "createdAt": 1789020000000,
  "lastLoginAt": 1789020000000
}
```

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
  "durationMinutes": 35
}
```

| Field | Type | Bắt buộc | Quy tắc |
| --- | --- | --- | --- |
| `type` | `string` | Không | `FULL_TEST` hoặc `PRACTICE`; mặc định `FULL_TEST`. |
| `mode` | `string` | Không | `FULL`, `LISTENING`, `READING`, `PART`; mặc định `FULL`. |
| `part` | `integer` | Khi `mode=PART` nếu không có `parts` | Từ 1 đến 7. |
| `parts` | `integer[]` | Khi `mode=PART` nếu không có `part` | Ít nhất một Part từ 1 đến 7; server loại trùng và sắp xếp. |
| `durationMinutes` | `integer` | Không | Chỉ dùng cho `PART`, từ 1 đến 180 phút. |

Nếu `PART` không truyền `durationMinutes`, thời lượng gợi ý lần lượt cho Part 1–7 là `5, 10, 15, 15, 20, 10, 45` phút và được cộng theo các Part đã chọn.

- **Response thành công:** `200 OK`, `AttemptResponse` có `answers` và `answeredCount`.
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
- **Lỗi chính:** với `mode=FULL`, trả `409 CONFLICT` nếu attempt vẫn đang ở Listening và chưa chuyển sang Reading; attempt đã khóa không nhận cập nhật khác.

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
- **Điều kiện:** attempt phải có `type=FULL_TEST`, `mode=FULL`, `status=COMPLETED`.
- **Response thành công:** `200 OK`.

```json
{
  "attemptId": "attempt-123",
  "aiAnalysisStatus": "PENDING",
  "status": "PENDING",
  "message": "Yêu cầu phân tích đã được tiếp nhận."
}
```

Trạng thái có thể là `NOT_REQUESTED`, `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`. Gọi lại khi đang xử lý hoặc đã hoàn thành không tạo job trùng; server trả trạng thái hiện tại.

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
  - Mỗi câu có đúng bốn đáp án.
  - `correctAnswer` của mỗi câu là A, B, C hoặc D.

- **Response thành công:** `200 OK`, object `Test` đầy đủ với `status=PENDING_REVIEW`, `submittedAt` được cập nhật.
- **Lỗi chính:** `400 BAD_REQUEST` nếu đề không hợp lệ; `403 FORBIDDEN` nếu không phải owner; `409 CONFLICT` nếu đề không còn chỉnh sửa được.

### 8.7 Upload media

- **Mục đích:** upload ảnh/audio dùng trong đề lên Firebase Storage.
- **Method/type:** `POST`, request `multipart/form-data`, response `application/json`.
- **Path:** `/api/employee/media`.
- **Form params:** field `file`, bắt buộc.
- **Định dạng hỗ trợ:** JPEG, PNG, WEBP, GIF, MP3 (`audio/mpeg`), MP4 audio, WAV, OGG.
- **Giới hạn:** tối đa 15 MB.
- **Response thành công:** `201 Created`.

```json
{
  "url": "https://firebasestorage.googleapis.com/...",
  "objectName": "toeic-media/employee-uid/uuid-file.mp3",
  "fileName": "file.mp3",
  "contentType": "audio/mpeg",
  "size": 1048576
}
```

Frontend không tự đặt header `Content-Type`; trình duyệt cần tự thêm multipart boundary. Deployment phải có biến `FIREBASE_STORAGE_BUCKET`.

- **Lỗi chính:** `400 BAD_REQUEST` nếu file rỗng, quá lớn hoặc sai MIME type; `503 SERVICE_UNAVAILABLE` nếu chưa cấu hình storage bucket.

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
| `404` | `NOT_FOUND` | Resource không tồn tại hoặc bị che bởi rule ownership/publication. |
| `409` | `CONFLICT` | Trạng thái workflow/section không cho phép thao tác. |
| `503` | `SERVICE_UNAVAILABLE` | Storage, RabbitMQ hoặc AI service chưa sẵn sàng. |

Ngoài các lỗi riêng ghi tại từng endpoint, mọi endpoint được bảo vệ đều có thể trả `401`; endpoint giới hạn role có thể trả `403`.
