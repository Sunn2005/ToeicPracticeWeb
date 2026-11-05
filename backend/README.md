# CapyTOEIC — Backend

Spring Boot REST API dùng Spring Security, Firebase Admin, Firestore và RabbitMQ.
Contract API và workflow nằm trong
[API_ROLE_WORKFLOWS.md](../docs/archive/API_ROLE_WORKFLOWS.md); contract AI nằm trong
[AI_REVIEW.md](../docs/archive/AI_REVIEW.md).

## Cấu trúc package

Giữ các tầng MVC ở cấp ngoài; chia package nghiệp vụ bên trong từng tầng.
Frontend React đảm nhiệm phần giao diện, backend trả dữ liệu JSON.

```text
src/main/java/com/toeic/
├── BackendApplication.java
├── controller/              # Nhận request, trả response
├── service/                 # Nghiệp vụ
├── dao/                     # Interface và implementation truy cập dữ liệu
├── model/                   # Model và enum theo nghiệp vụ
├── dto/                     # Dữ liệu request/response và message
├── messaging/ai/            # Consumer theo analysis, chat, job
├── integration/
│   ├── firebase/            # Auth gateway và staff identity gateway
│   └── mail/                # Staff mail gateway
├── exception/               # ApiCodeException, ApiExceptionHandler
├── security/                # Authentication filter, principal, error handlers
└── config/                  # Spring, Firebase, RabbitMQ và cấu hình hiện có
```

Các package con được tạo theo nhu cầu thực tế:

| Nghiệp vụ | Package bên trong mỗi tầng |
| --- | --- |
| Session và xác thực | `auth` |
| Profile và dữ liệu học tập | `user` |
| Nhân sự, credential và quyền staff | `staff` |
| Catalog, tạo/sửa đề và duyệt đề | `test` |
| Làm bài, đáp án, nộp và chấm điểm | `attempt` |
| Thanh toán, subscription và doanh thu | `billing` |
| Nhận xét toàn bài bằng AI | `ai.analysis` |
| Capy chat | `ai.chat` |
| Job giải thích câu hỏi | `ai.job` |
| Upload media | `service.media` |
| Health endpoint | `controller.health` |
| Response lỗi dùng chung | `dto.common` |

Ví dụ: `controller.test.EmployeeTestController`,
`service.test.EmployeeTestService`, `dao.test.TestDao`,
`dao.test.firestore.FirestoreTestDao`, `model.test.Test`.
Role thể hiện trong tên controller hoặc annotation kiểm tra quyền; không phải
ranh giới dữ liệu độc lập. Giữ nguyên URL và kiểm tra ownership/authorization.

## Các nhóm được giữ cùng package

- `dto.ai`: giữ nguyên mọi lớp và tên package hiện có để bảo toàn định danh
  message RabbitMQ. Các DTO HTTP của chat nằm ở `dto.ai.chat`.
- `dao.firestore`: giữ `FirestoreUserDao`, `FirestoreStaffStore` và
  `FirestoreUserMapper` cùng nhau vì hai store dùng chung mapper có quyền truy
  cập package. Interface tương ứng nằm trong `dao.user` và `dao.staff`.
- `service.billing.PayOSClient`: giữ cạnh billing service và test đang dùng
  helper ký webhook có quyền truy cập package; không mở rộng quyền truy cập.
- `service.test.ReviewFieldNormalizer`: giữ cùng các service dùng nó vì lớp
  có quyền truy cập package.

Gateway và implementation lồng bên trong được di chuyển cùng nhau. Không tách
interface/implementation hoặc thay đổi logic chỉ để phù hợp thư mục.

## Quy ước và kiểm tra

- Controller điều phối request; nghiệp vụ thuộc service; truy cập dữ liệu thuộc DAO.
- Enum nằm trong `model/<nghiệp-vụ>/enums`.
- Test phản ánh package của lớp được kiểm thử trong `src/test/java`.
- Giữ `BackendApplication` ở `com.toeic` để các package nằm trong phạm vi scan.
- Giữ nguyên Firestore collection, field, API mapping, queue và routing key.
- Không thêm package rỗng hoặc đổi dependency cho việc sắp xếp thư mục.

Từ thư mục `backend/`:

```bash
./mvnw clean test
```

`clean` giúp phát hiện tham chiếu cũ thay vì dùng lại class đã biên dịch trước khi
di chuyển. Không cần migrate Firestore chỉ vì đổi vị trí source/package.

Xem [kế hoạch và bản đồ di chuyển](../docs/plans/2026-11-04-module-folder-structure.md).
