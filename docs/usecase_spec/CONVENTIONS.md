# Quy ước quản lý Use Case — ToeicPracticeWeb

Tài liệu này quy định cách chia module, cấp mã và quản lý business rule, câu hỏi mở và Use Case trong bộ `docs/usecase_spec/`. Format nội dung từng Use Case được quy định tại [STANDARD.md](./STANDARD.md).

## 1. Nguồn sự thật và phạm vi

- Phạm vi, phân quyền và workflow theo [API_ROLE_WORKFLOWS.md](../archive/API_ROLE_WORKFLOWS.md); nghiệp vụ AI theo [AI_REVIEW.md](../archive/AI_REVIEW.md).
- [README frontend](../../frontend/README.md) và [phân công frontend](../archive/TEAM_FRONTEND_ASSIGNMENTS.md) là contract tích hợp và ranh giới sở hữu hiện hành.
- Bộ Markdown trong `docs/usecase_spec/` là nguồn đặc tả Use Case và business rule, phải nhất quán với các contract trên.
- Chưa có quyết định thì ghi thành câu hỏi mở (OQ). Không tự đặt thời lượng thi, cách chấm điểm, điều kiện mở nội dung review, quyền Pro hoặc chính sách AI.

## 2. Ranh giới hệ thống và actor

| Actor | Vai trò và phạm vi |
|---|---|
| Khách (`GUEST`) | Chưa đăng nhập; xem danh mục đề công khai, đăng ký và đăng nhập. Đây là trạng thái truy cập, không phải role lưu trong Firestore. |
| Người học (`USER`) | Làm bài, luyện tập, xem kết quả/lịch sử của mình, quản lý hồ sơ và sử dụng AI hoặc gói Pro khi đủ điều kiện. |
| Nhân viên (`EMPLOYEE`) | Biên soạn và gửi duyệt đề theo quyền sở hữu; sử dụng chức năng Console được cấp bởi nhóm quyền đang hoạt động. |
| Quản trị viên (`ADMIN`) | Xét duyệt đề, quản lý nhân viên/nhóm quyền, tra cứu thanh toán, đối soát và xem doanh thu theo contract. |

- Quyền thực tế phụ thuộc role, trạng thái nhân viên, quyền Console, entitlement và quyền sở hữu tương ứng; không suy ra quyền chỉ từ tên actor. Pro là quyền sử dụng, không phải một role mới.
- Dịch vụ ngoài như Firebase Authentication, Gemini hoặc nhà cung cấp thanh toán chỉ được thể hiện là actor phụ khi trực tiếp tham gia luồng đang đặc tả.
- Frontend, backend, AI service, RabbitMQ và Firestore thuộc ranh giới triển khai của ToeicPracticeWeb; không tạo actor hoặc Use Case độc lập chỉ vì một bước được xử lý ở thành phần đó.
- Tác vụ nền, polling và thông báo kết quả là các bước của mục tiêu nghiệp vụ liên quan, trừ khi có mục tiêu độc lập của actor đã được chốt.

## 3. Chia module

Module được chia theo năng lực nghiệp vụ ổn định, không chia theo frontend/backend/API/database hoặc theo từng màn hình.

| Tiền tố | Module | Phạm vi dự kiến |
|---|---|---|
| `AUTH` | Tài khoản và phân quyền | Đăng ký, đăng nhập, đăng xuất, hồ sơ; quản lý nhân viên và nhóm quyền Console. |
| `TST` | Danh mục đề (`test/`) | Danh sách, bộ lọc, metadata và nội dung đề được phép công khai. |
| `ATT` | Lượt làm bài (`attempt/`) | Thi full, mini test/luyện Part, lưu đáp án, nộp/chấm bài, kết quả, review, lịch sử và thống kê cá nhân. |
| `EDT` | Biên soạn đề (`editor/`) | Tạo, sửa, xóa, preview, upload media và gửi duyệt đề theo quyền sở hữu. |
| `REV` | Xét duyệt đề (`review/`) | Hàng đợi, xem nội dung cần duyệt, duyệt/từ chối và lịch sử xét duyệt theo quyền Console. |
| `AI` | Hỗ trợ học bằng AI | Phân tích toàn bài, giải thích và Capy AI Chat theo điều kiện sử dụng của từng chức năng. |
| `PAY` | Gói Pro và thanh toán (`payment/`) | Nâng cấp Pro, tra cứu đơn, đối soát và báo cáo doanh thu theo quyền được cấp. |

Các feature và Use Case cụ thể được đăng ký trong `00-module.md` và README của module tương ứng. Có thể điều chỉnh ranh giới khi phân tích nghiệp vụ, nhưng phải cập nhật danh mục và tham chiếu liên quan cùng lúc.

## 4. Mã định danh

### 4.1. Use Case

Mã có dạng `<MODULE>-UC-<NNN>`, ví dụ `AUTH-UC-001` hoặc `ATT-UC-001`.

- Tiền tố phải thuộc module đã đăng ký ở mục 3.
- Số có tối thiểu ba chữ số, tăng riêng trong từng module.
- Mã là định danh ổn định, không biểu diễn thứ tự trình bày hoặc thứ tự chạy.
- Chỉ cấp mã chính thức khi Use Case đã được chấp nhận trong danh mục module.
- Không tái sử dụng hoặc đánh lại mã đã cấp, kể cả khi Use Case bị bỏ hoặc gộp.
- Tên file: `<MODULE>-UC-<NNN>_<slug>.md`; tiêu đề trong file phải có cùng mã.

### 4.2. Business rule

Mã có dạng `BR-<MODULE>-<NNN>`, ví dụ `BR-AUTH-001`, `BR-ATT-001`, `BR-REV-001`, `BR-AI-001`. Luật xuyên module dùng `BR-TOEIC-NNN`.

- Mã rule phải duy nhất và ổn định.
- Rule được định nghĩa tại đúng một nguồn: rule xuyên module ở `00-module.md`; rule riêng module/feature ở file `rules.md` tương ứng.
- Use Case chỉ mô tả hành vi và tham chiếu rule; không chép lại công thức hoặc nội dung luật để tránh lệch nguồn.

### 4.3. Câu hỏi mở

Mã có dạng `OQ-<MODULE>-<NNN>` hoặc `OQ-TOEIC-NNN` cho câu hỏi chung. Câu hỏi nằm trong README của module/feature sở hữu quyết định. Không dùng OQ như một business rule đã chốt.

## 5. Xác định Use Case

1. Một Use Case mô tả mục tiêu nghiệp vụ của actor bên ngoài khi tương tác với ToeicPracticeWeb.
2. Không tách trạng thái, hàm nội bộ, webhook, tác vụ nền hoặc một bước trong quy trình thành Use Case độc lập nếu không có mục tiêu actor riêng.
3. Việc chọn đáp án, tự động lưu và xác nhận nộp thường là các bước của mục tiêu hoàn thành lượt làm bài; chỉ tách khi nhóm xác định có mục tiêu nghiệp vụ độc lập.
4. UC thuộc module sở hữu mục tiêu nghiệp vụ, không nhất thiết thuộc module có nhiều bước kỹ thuật nhất.
5. Khi một UC liên quan module khác, giữ mục tiêu actor làm căn cứ sở hữu; tham chiếu UC/rule liên quan và thể hiện trao đổi xuyên module trong sequence nếu cần.
6. Trước khi gộp hai UC, so sánh mục tiêu actor, kết quả, điều kiện trước/sau và ranh giới hệ thống; không kết luận chỉ dựa vào tên giống nhau.

## 6. Một nguồn cho mỗi loại nội dung

| Nội dung | Nguồn chính |
|---|---|
| Mục tiêu, phạm vi, actor và thuật ngữ dùng chung | `00-module.md` |
| Danh sách feature/UC, trạng thái UC | `00-module.md` và README module |
| Business rule dùng chung | `00-module.md` |
| Business rule riêng module/feature và câu hỏi mở | `rules.md` và README của module/feature sở hữu |
| Điều kiện và luồng của Use Case | File Use Case tương ứng |
| Activity/Sequence source | File `.act` / `.seq` tương ứng với Use Case |

Nếu cùng một rule được dùng ở nhiều module, định nghĩa ở nguồn chung rồi tham chiếu; không sao chép thành nhiều rule độc lập.

## 7. Thay đổi và truy vết

- Khi đổi rule, rà lại mọi Use Case và sơ đồ có tham chiếu tới rule đó.
- Khi đổi mã, tên hoặc module sở hữu UC, cập nhật danh mục, tên file và toàn bộ tham chiếu; không cấp lại mã cũ.
- Khi quyết định một OQ, cập nhật trực tiếp rule/UC và xóa OQ khỏi danh sách; ghi lý do trong commit message nếu nhóm dùng Git để lưu lịch sử quyết định.
- Thay đổi phạm vi phải được đối chiếu với các contract TOEIC ở mục 1 trước khi cập nhật spec; không dùng đặc tả để tự thay đổi nghiệp vụ.
