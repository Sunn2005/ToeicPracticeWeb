# Nhận xét bài làm bằng AI

## Phạm vi

Chức năng chỉ nhận yêu cầu do người dùng đã đăng nhập chủ động gửi cho một Attempt thỏa cả ba điều kiện: `type=FULL_TEST`, `mode=FULL`, `status=COMPLETED`. Mini Test, luyện Part, bài chưa nộp và Attempt của người khác đều bị từ chối. Việc nộp bài và chấm điểm hiện tại không gọi AI.

## Luồng xử lý

1. BE-Core chấm điểm, lưu Attempt và trả kết quả thi như trước.
2. Frontend gọi `POST /api/attempts/{attemptId}/ai-analysis` khi người dùng nhấn **Nhận xét bằng AI**.
3. BE-Core kiểm tra quyền sở hữu và điều kiện, lưu `PENDING`, rồi publish message định danh.
4. AI Service claim job bằng Firestore transaction, lưu `PROCESSING`, đọc Attempt, answers và đề thi.
5. AI Service ghép đủ 200 câu, tính toàn bộ số liệu xác định bằng code rồi chỉ gửi dữ liệu cần thiết (không có danh tính hay audio) sang Gemini Structured Output.
6. AI Service gọi Gemini riêng cho bản `vi` và bản `en` để giảm kích thước structured output và cô lập lỗi parse theo từng ngôn ngữ. Cả hai được kiểm tra lại với score, tag, question number, evidence, Part 1–7, ba ưu tiên, kế hoạch 7 ngày, giới hạn dữ liệu thời gian, đúng ngôn ngữ và độ chi tiết tối thiểu của các phần giải thích.
7. AI Service lưu `aiAnalyses/{attemptId}` trước, sau đó mới publish `ai.review.completed`.
8. BE-Core consume message định danh và cập nhật Attempt. Frontend poll endpoint GET; kết quả hoàn chỉnh luôn đi qua BE-Core, không đọc Firestore trực tiếp.
9. Khi thất bại sau retry, AI Service lưu `FAILED`, publish `ai.review.failed`, rồi reject message để RabbitMQ đưa vào DLQ.

Consumer và trạng thái đều idempotent. Một analysis `PROCESSING` có lease 15 phút; message lặp không gọi Gemini lần nữa. Nếu kết quả đã được lưu nhưng publish completion lỗi, lần delivery sau chỉ publish lại completion.

## RabbitMQ

Exchange chính là direct exchange bền vững `toeic.ai`.

| Hướng | Queue | Routing key |
| --- | --- | --- |
| BE-Core → AI Service | `toeic.ai.review.request` | `ai.review.request` |
| AI Service → BE-Core | `toeic.ai.review.completed` | `ai.review.completed` |
| AI Service → BE-Core | `toeic.ai.review.failed` | `ai.review.failed` |

Request queue dùng dead-letter exchange `toeic.ai.dlx`, DLQ `toeic.ai.request.dlq`, routing key `ai.request.dead`.

Payload request:

```json
{"attemptId":"attempt-123","userId":"user-001","refresh":false}
```

Payload completed:

```json
{"attemptId":"attempt-123","userId":"user-001","analysisId":"attempt-123","status":"COMPLETED"}
```

Payload failed:

```json
{"attemptId":"attempt-123","userId":"user-001","status":"FAILED","errorCode":"GEMINI_UNAVAILABLE"}
```

Các message không chứa câu hỏi, đáp án, nội dung nhận xét, stack trace hay thông tin bí mật.

## Firestore

- `attempts/{attemptId}` giữ `aiAnalysisStatus`, `aiAnalysisId`, `aiAnalysisRequestedAt` bên cạnh dữ liệu Attempt hiện có.
- `attempts/{attemptId}/answers/{questionNumber}` tiếp tục là nguồn câu trả lời.
- `tests/{testId}/parts/part1..part7` là nguồn câu hỏi và metadata.
- `aiAnalyses/{attemptId}` giữ toàn bộ analysis với các field `analysisId`, `attemptId`, `userId`, `status`, `provider`, `model`, `promptVersion`, `schemaVersion`, `result`, `retryCount`, `error`, `requestedAt`, `processingStartedAt`, `completedAt`.

`result.vi` và `result.en` đều chứa `summary`, `strengths`, `weaknesses`, `partAnalysis`, `knowledgeGaps`, `timeManagement`, `priorityTopics`, `studyPlan`, `nextActions`, `overallConfidence`, `limitations` và `statistics`. `statistics` là kết quả code, không phải số liệu Gemini tự tính. Frontend chọn bản tương ứng ngay khi người dùng chuyển EN/VI, không gọi lại Gemini.

## Biến môi trường

BE-Core (`backend/.env`):

```properties
FIREBASE_SERVICE_ACCOUNT=file:/absolute/path/to/firebase-service-account.json
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-server-side-service-key
CLOUDAMQP_URL=amqp://guest:guest@localhost:5672
PORT=8080
IMPORT_TOEIC_DATA=false
TOEIC_DATA_RESOURCE=classpath:data/test-1-data.json
```

AI Service (`ai-service/.env`):

```properties
GEMINI_API_KEY=your-secret-key
GEMINI_MODEL=gemini-2.5-flash
FIREBASE_PROJECT_ID=toeicpractice-1445a
FIREBASE_SERVICE_ACCOUNT=file:/absolute/path/to/firebase-service-account.json
CLOUDAMQP_URL=amqp://guest:guest@localhost:5672
PORT=8081
AI_REVIEW_MAX_ATTEMPTS=3
AI_REVIEW_INITIAL_BACKOFF_MS=1000
```

API key Gemini chỉ tồn tại ở AI Service.

## API

Tạo yêu cầu:

```bash
curl -X POST 'http://localhost:8080/api/attempts/attempt-123/ai-analysis' \
  -H 'Authorization: Bearer <firebase-id-token>'
```

```json
{
  "attemptId": "attempt-123",
  "aiAnalysisStatus": "PENDING",
  "status": "PENDING",
  "message": "Yêu cầu phân tích đã được tiếp nhận."
}
```

Tạo lại nhận xét đã hoàn thành bằng prompt mới:

```bash
curl -X POST 'http://localhost:8080/api/attempts/attempt-123/ai-analysis?refresh=true' \
  -H 'Authorization: Bearer <firebase-id-token>'
```

Khi `refresh=true`, BE-Core đưa Attempt về `PENDING` và AI Service ghi đè kết quả đã lưu. Message được giao lại sau khi kết quả đã lưu vẫn chỉ phát lại completion, không gọi Gemini lần nữa.

Đọc trạng thái/kết quả:

```bash
curl 'http://localhost:8080/api/attempts/attempt-123/ai-analysis' \
  -H 'Authorization: Bearer <firebase-id-token>'
```

Khi chưa xong, `result` là `null`. Khi hoàn thành, `status` và `aiAnalysisStatus` là `COMPLETED`, còn `result` chứa toàn bộ cấu trúc nhận xét.

Khi thất bại, response có `status=FAILED`, `result=null` và `errorCode`. Các lỗi JSON/schema từ Gemini được chuẩn hóa thành `INVALID_GEMINI_OUTPUT`; frontend ánh xạ mã lỗi sang thông báo cụ thể và vẫn hiển thị mã để hỗ trợ chẩn đoán.

## Chạy local

Khởi động RabbitMQ:

```bash
docker run --rm --name toeic-rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

Trong ba terminal khác nhau:

```bash
cd backend && ./mvnw spring-boot:run
cd ai-service && ./mvnw spring-boot:run
cd frontend && npm install && npm run dev
```

Để import lại Test 1 có metadata AI, chỉ bật một lần `IMPORT_TOEIC_DATA=true` cùng `TOEIC_DATA_RESOURCE=classpath:data/test-1-data.json`, chạy backend đến khi import xong, rồi tắt lại để tránh ghi đè ngoài ý muốn.

## Kiểm thử

```bash
cd backend && ./mvnw test
cd ai-service && ./mvnw test
cd frontend && npm test
cd frontend && npm run lint
cd frontend && npm run build
```

Test tự động bao phủ điều kiện truy cập, chống job trùng/idempotency, các phép tổng hợp, `grammarTags: []`, confidence khi mẫu nhỏ, lỗi Gemini/schema, thứ tự save-before-publish và logic polling/eligibility phía frontend.

## File triển khai

BE-Core:

- Cập nhật `AttemptController`, `AttemptService`, `Attempt`, `Question`, `FirestoreAttemptDao`, `RabbitMessagingConfig`, cấu hình và test controller.
- Tạo `AIReviewService`, `AIReviewRequestPublisher`, `AIReviewResultConsumer`, `AIAnalysisDao`, `FirestoreAIAnalysisDao`, enum trạng thái, ba DTO message và test service.

AI Service:

- Cập nhật Maven, Firebase/Rabbit/Gemini properties, Rabbit topology và context test.
- Tạo Firebase config; request consumer; Firestore repository; processor; statistics, Gemini, validation và notification services; các model/DTO structured output; unit tests.

Frontend:

- Cập nhật trang `FullTestResult`, bản dịch và test command.
- Tạo API client, helper trạng thái/polling và unit test.

Data và vận hành:

- `test-1-data.json` có đủ bốn metadata field cho đúng 200 câu.
- `.env.example` của hai Spring service và tài liệu này được cập nhật.

## Giới hạn dữ liệu hiện tại

- Attempt chưa lưu thời gian cho từng câu/Part, nên `timeManagement.available=false`; hệ thống không tạo thời gian giả.
- User model chưa có điểm mục tiêu, nên `targetScore` và `scoreGap` luôn `null`.
- File Test 1 đã có metadata 200/200. Các file local Test 2 và Test 3 chưa có bốn metadata field; cần gắn tag và import lại trước khi dùng AI review cho hai đề đó. AI Service cố ý trả `INVALID_INPUT` thay vì tự bịa metadata.
- Kiểm thử tự động dùng mock; smoke test thật với Gemini, Firestore và RabbitMQ cần credential/service local tương ứng.

## Capy AI Chat

Capy Chat là workflow riêng với AI Analysis toàn bài. BE-Core giữ authorization, entitlement, attempt safety, ownership, idempotency, quota và persistence; AI Service chỉ nhận input đã được thu nhỏ để tạo câu trả lời TOEIC. Không service nào log chat content, prompt, response, credential hoặc payload chứa dữ liệu review.

### Luồng xử lý

1. User Pro tạo conversation chung hoặc gắn đúng một câu của attempt owned đã hoàn thành.
2. Khi gửi, BE-Core kiểm tra `AI_CHAT`, validate tối đa 1.000 characters và atomically tạo user message, pending assistant, job, quota. Chat chung không bị chặn bởi attempt đang làm; conversation có question context phải được BE-Core xác nhận lại là attempt owned đã `COMPLETED` trước khi tạo và trước mỗi lần gửi.
3. Key lặp cùng payload trả aggregate cũ; key lặp khác payload bị từ chối. Chỉ aggregate có `newlyAccepted=true` mới được publish.
4. Request chứa identifiers, locale, current message, tối đa 12 prior successful messages và optional context allowlist của một câu. Không chứa profile, audio URL, sibling question hoặc raw attempt.
5. AI Service transactionally claim `jobId`, áp lại cap 12 messages/12.000 Unicode content characters, đặt prompt TOEIC-only/chống injection và gọi Gemini structured output.
6. AI Service lưu terminal result vào Firestore trước khi publish. Listener retry hoặc Rabbit redelivery đọc lại đúng result đã lưu thay vì gọi Gemini lần nữa.
7. BE-Core atomically finalize assistant/job; delivery terminal lặp không ghi đè kết quả đầu tiên. Frontend chỉ poll BE-Core.

### RabbitMQ contract

| Hướng | Queue | Routing key |
| --- | --- | --- |
| BE-Core → AI Service | `toeic.ai.chat.request` | `ai.chat.request` |
| AI Service → BE-Core | `toeic.ai.chat.result` | `ai.chat.result` |

Request queue dùng DLX/DLQ hiện có. Cả request/result đều durable và message được publish persistent. Request schema:

```json
{
  "userId": "user-001",
  "conversationId": "conversation-uuid",
  "jobId": "job-id",
  "userMessageId": "user-message-id",
  "assistantMessageId": "assistant-message-id",
  "locale": "vi",
  "history": [{"role":"ASSISTANT","content":"..."}],
  "currentMessage": "...",
  "questionContext": null
}
```

Result schema:

```json
{
  "userId": "user-001",
  "conversationId": "conversation-uuid",
  "jobId": "job-id",
  "assistantMessageId": "assistant-message-id",
  "status": "SUCCEEDED",
  "answer": "...",
  "errorCode": null
}
```

Provider failure dùng `status=FAILED`, `answer=null`, `errorCode=AI_UNAVAILABLE`. Logs chỉ ghi identifiers, status và kết quả finalize.

Nếu publish result thất bại sau khi Gemini đã trả lời, Spring listener retry hoặc broker redelivery phải đặt request vào recovery mode. Recovery claim đọc terminal result từ outbox và publish lại nguyên giá trị đã lưu; không tạo câu trả lời Gemini mới. Retry nội bộ của listener được nhận diện bằng Rabbit `retryCount`, không chỉ cờ broker `redelivered`.

### Firestore contract

- `aiChatConversations/{conversationId}`: owner, title, locale, optional context identifiers, `ACTIVE|DELETED`, timestamps.
- `aiChatConversations/{conversationId}/messages/{messageId}`: `USER|ASSISTANT`, content, `PENDING|SUCCEEDED|FAILED`, job/error/timestamps.
- `aiChatJobs/{jobId}`: internal ownership, deterministic user-scoped idempotency key mapping, message identifiers và terminal state.
- `aiChatUsage/{uid_yyyy-MM-dd}`: daily accepted count, audit timestamps, reset time theo `Asia/Ho_Chi_Minh`.
- `aiChatUsage/{uid}_burst`: authoritative rolling-minute timestamps và monotonic last admission.
- `aiChatUsage/{uid}_conversations`: shared active-conversation count guard.
- `aiChatGenerationResults/{jobId}`: outbox do AI Service sở hữu, gồm identifiers, `PROCESSING|SUCCEEDED|FAILED`, answer/error terminal và processing/completed timestamps. Collection này không lưu history, current message hoặc question context.

Query list conversation cần composite index cho `userId`, `status`, `lastMessageAt DESC`. Guard documents không được xóa bởi daily cleanup. Nếu có manual Firestore writes ngoài DAO tin cậy, phải repair guard count trước khi tiếp tục mutation.

Không xóa document outbox đang `PROCESSING`. Terminal outbox chỉ được cleanup sau khi job tương ứng ở BE-Core đã terminal và đã qua retention window vận hành; phiên bản hiện tại chưa tự động cleanup collection này.

### Cấu hình giới hạn

BE-Core: `AI_CHAT_DAILY_LIMIT=30`, `AI_CHAT_BURST_LIMIT=5`, `AI_CHAT_CONVERSATION_LIMIT=10`, `AI_CHAT_MESSAGE_CHARACTER_LIMIT=1000`, `AI_CHAT_HISTORY_MESSAGE_LIMIT=12`. `AI_CHAT_READ_LIMIT=100` giới hạn số item trả/đọc nội bộ.

AI Service: `AI_CHAT_HISTORY_MESSAGE_LIMIT=12`, `AI_CHAT_HISTORY_CHARACTER_LIMIT=12000`. Hai service phải dùng cùng RabbitMQ và routing contract; chỉ AI Service giữ `GEMINI_API_KEY`.
