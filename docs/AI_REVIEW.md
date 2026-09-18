# Nhận xét bài làm bằng AI

## Phạm vi

Chức năng chỉ nhận yêu cầu do người dùng đã đăng nhập chủ động gửi cho một Attempt thỏa cả ba điều kiện: `type=FULL_TEST`, `mode=FULL`, `status=COMPLETED`. Mini Test, luyện Part, bài chưa nộp và Attempt của người khác đều bị từ chối. Việc nộp bài và chấm điểm hiện tại không gọi AI.

## Luồng xử lý

1. BE-Core chấm điểm, lưu Attempt và trả kết quả thi như trước.
2. Frontend gọi `POST /api/attempts/{attemptId}/ai-analysis` khi người dùng nhấn **Nhận xét bằng AI**.
3. BE-Core kiểm tra quyền sở hữu và điều kiện, lưu `PENDING`, rồi publish message định danh.
4. AI Service claim job bằng Firestore transaction, lưu `PROCESSING`, đọc Attempt, answers và đề thi.
5. AI Service ghép đủ 200 câu, tính toàn bộ số liệu xác định bằng code rồi chỉ gửi dữ liệu cần thiết (không có danh tính hay audio) sang Gemini Structured Output.
6. Gemini tạo đồng thời hai bản `vi` và `en`. Cả hai được kiểm tra lại với score, tag, question number, evidence, Part 1–7, ba ưu tiên, kế hoạch 7 ngày, giới hạn dữ liệu thời gian, đúng ngôn ngữ và độ chi tiết tối thiểu của các phần giải thích.
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
FIREBASE_STORAGE_BUCKET=toeicpractice-1445a.firebasestorage.app
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
