# Đặc tả Use Case ToeicPracticeWeb

Bộ tài liệu này đặc tả luồng nghiệp vụ Use Case của ToeicPracticeWeb, hệ thống luyện thi TOEIC. Phạm vi và hành vi được đối chiếu với các tài liệu hiện hành:

- [API, phân quyền và workflow TOEIC](../archive/API_ROLE_WORKFLOWS.md): hợp đồng API, vai trò, quyền sở hữu và các chuyển trạng thái nghiệp vụ.
- [Nhận xét bài làm và Capy AI Chat](../archive/AI_REVIEW.md): điều kiện sử dụng và luồng xử lý AI bất đồng bộ.
- [README frontend](../../frontend/README.md): ứng dụng, route, xác thực và cách tích hợp API.
- [Phân công frontend](../archive/TEAM_FRONTEND_ASSIGNMENTS.md): ranh giới sở hữu và các file lõi bị khóa.

Bộ Use Case diễn giải các contract này, không tự thay đổi hoặc mở rộng chúng. Điểm chưa thống nhất phải được ghi thành câu hỏi mở (OQ).

## Bắt đầu từ đâu

1. Đọc [CONVENTIONS.md](./CONVENTIONS.md) để nắm module, actor, mã UC/BR/OQ và cách quản lý nguồn.
2. Đọc [STANDARD.md](./STANDARD.md) trước khi viết một Use Case.
3. Khi có `00-module.md`, xem phạm vi, thuật ngữ và danh mục UC đã chốt tại đó. Hiện bộ tài liệu mới có ba file hướng dẫn; danh mục module và các UC cụ thể chưa được tạo.
4. Vào README và `rules.md` của feature liên quan; sau đó đọc file UC và sơ đồ của feature đó.

## Cấu trúc dự kiến

```text
usecase_spec/
  README.md
  CONVENTIONS.md
  STANDARD.md
  00-module.md
  auth/
  test/
  attempt/
  editor/
  review/
  ai/
  payment/
```

Mỗi thư mục module có README, danh sách/feature, nguồn business rule và Use Case. Sơ đồ nguồn Activity/Sequence gắn với Use Case tương ứng. Chưa tạo module hoặc UC nào khi phạm vi và mã chưa được chốt trong `00-module.md`.

## Phạm vi nghiệp vụ hiện tại

- Tài khoản và phân quyền: khách chưa đăng nhập, người học (`USER`), nhân viên (`EMPLOYEE`) và quản trị viên (`ADMIN`); quản lý hồ sơ, nhân viên và quyền Console theo contract hiện hành.
- Danh mục đề TOEIC: xem danh sách, bộ lọc, metadata và nội dung được phép công khai của đề đã được duyệt.
- Làm bài và luyện tập: bắt đầu hoặc tiếp tục lượt làm bài, lưu đáp án, khóa đơn vị Listening, theo dõi thời gian từ server, xác nhận nộp và chấm điểm; giữ các route `/full-test/**`.
- Kết quả học tập: xem kết quả, review, lịch sử và thống kê của chính mình; chỉ mở đáp án, giải thích, bản dịch và transcript khi bài thi hoặc đơn vị luyện tập cho phép.
- Biên soạn đề: nhân viên tạo, sửa, preview, upload media và gửi duyệt đề trong phạm vi quyền sở hữu.
- Xét duyệt đề: thực hiện các chuyển trạng thái `DRAFT → PENDING_REVIEW → APPROVED` và `PENDING_REVIEW → REJECTED → DRAFT`; chỉ đề được duyệt mới xuất hiện trong danh mục công khai.
- AI: người dùng chủ động yêu cầu phân tích toàn bài khi lượt làm bài full đã hoàn thành; Capy AI Chat và các chức năng AI khác tuân theo điều kiện quyền, context và trạng thái riêng trong tài liệu nguồn.
- Gói Pro và thanh toán: nâng cấp, kiểm tra quyền sử dụng, tra cứu đơn, đối soát và báo cáo doanh thu theo contract; không đưa lại chức năng cấp/gia hạn/thu hồi Pro thủ công qua Console đã được gỡ.

Không phát triển tính năng mới trên luồng legacy `/practice/part5`. Không tự thêm tính năng hoặc số liệu AI chưa có trong tài liệu nguồn; ghi phần chưa rõ thành OQ trước khi đặc tả.

## Quy trình viết và rà soát

1. Ghi mục tiêu, actor và ranh giới module trong `00-module.md`.
2. Ghi business rule đã chốt trong `rules.md`; ghi điều chưa rõ thành OQ tại đúng feature.
3. Viết UC theo format `STANDARD.md`, tham chiếu business rule bằng mã.
4. Viết nguồn `.act` và `.seq` từ các bước/nhánh đã chốt trong UC.
5. Rà tính nhất quán giữa rule, UC, Activity và Sequence; cập nhật cả các tham chiếu chịu ảnh hưởng khi đổi rule.

## Công cụ và đầu ra

Các file Markdown, `.act` và `.seq` là nguồn có thể chỉnh sửa. Dùng bộ công cụ tại `docs/tools/usecase_flow/` để kiểm tra cấu trúc, sinh sơ đồ và xuất từng Use Case ra DOCX. Cài `python-docx` để xuất DOCX; Playwright/Chromium chỉ cần khi muốn sinh ảnh PNG tự động. Đầu ra nằm trong `docs/build/usecase-flow/`; không sửa tay file đầu ra sinh tự động.
