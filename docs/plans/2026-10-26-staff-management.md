# Quản lý nhân viên và quyền Console

## Phạm vi được xác nhận
Triển khai trực tiếp trên main theo yêu cầu chủ dự án. Cho phép sửa backend, API contract, auth/routing/menu và các trang Console liên quan. Không sửa luồng thi hoặc AI. Giữ thay đổi người dùng đang có.

## Thiết kế
- users/{uid}.role vẫn là nguồn role; thêm staffGroupId, staffActive, staffNotes. Một người/một nhóm. Nhóm admin hệ thống không xóa, quyền quản lý nhân viên không thể chuyển cho employee.
- staffGroups/{id}: name, code, description, permissions, version. Permission catalog cố định theo chức năng hiện có. Nhóm quản trị có đầy đủ quyền cố định để không gây khóa quyền quản trị. Các nhóm khác sửa được ma trận quyền.
- Default nhóm: admin, creators, reviewers, business. Employee legacy không có staffGroupId được ánh xạ creators, giữ quyền tạo/sửa/xóa/gửi đề; admin legacy ánh xạ admin. Persist ánh xạ khi quản trị ghi dữ liệu lần đầu.
- staffActive=false chỉ chặn Console/API quản trị; không chặn học/thi. Xóa nhân viên gỡ nhóm, chuyển USER; giữ tài khoản và lịch sử. Không tự khóa/gỡ quyền Admin; chặn xóa nhóm còn thành viên.
- Backend đọc quyền mới trên mỗi request; lỗi thiếu quyền 403. Không cache quyền dài hạn. API đang có giữ paths/schema, mở thêm quyền employee theo action; reconcile PayOS vẫn admin-only.
- Các thao tác quản trị ghi transaction Firestore, cùng đọc/ghi staffManagement/state làm khóa phiên bản tránh ghi đè, race nhóm/thành viên. Version nhóm/thành viên phát hiện stale UI.
- Chặn approve/reject đề do chính actor tạo bằng SELF_REVIEW_FORBIDDEN, không bỏ kiểm tra ownership đề hiện có.

## API mới (admin-only)
GET /api/admin/staff: nhóm, catalog và danh sách nhân viên (chỉ field cần cho Console).
GET /api/admin/staff/lookup?email=: tài khoản đã đăng ký; không tạo Firebase account.
POST /api/admin/staff/groups; PUT/DELETE /api/admin/staff/groups/{id}.
POST /api/admin/staff/members; PUT/DELETE /api/admin/staff/members/{uid}.
GET /api/me và session response thêm consoleAccess (active, groupId, permissions), dùng chung API profile hiện có.
Write groups chỉ nhận name/code/description/permissions/version; members chỉ nhận uid (create), groupId/active/notes/version. Actor và role do backend quản lý. Lỗi ổn định: STAFF_INVALID, STAFF_NOT_FOUND, STAFF_CONFLICT, STAFF_GROUP_NOT_EMPTY, STAFF_SELF_PROTECTED.

## Thực hiện
1. Catalog, storage transaction, management service/controller, migration, auth authorities và profile summary.
2. Gắn từng quyền vào endpoint hiện có; chống tự duyệt.
3. UI theo ảnh: nhóm/form, matrix, modal thêm/sửa, tìm/lọc/phân trang và confirm xóa; EN/VI.
4. Tích hợp guard, menu và action visibility, dashboard theo quyền; refresh quyền khi focus/đổi route.
5. Backend tests quyền/mutation/ownership/self-review; frontend tests permission rules/API; lint, tests, build. Review diff và trạng thái git.

## Kết quả xác minh
- Backend `./mvnw test`: 303 tests, 0 failure/error/skipped, gồm controller authorization thực, nhóm/quyền, migration partial update và rollback trước khi queue writes.
- Frontend `npm run lint`, `npm test` (129 tests), `npm run build`: thành công. Build vẫn cảnh báo chunk vượt 500 kB.
- Browser localhost với API giả lập/dữ liệu tổng hợp: tạo nhóm Kế toán, cấp xem đơn hàng/doanh thu, thêm tài khoản đăng ký, chỉnh sửa/khóa và xác minh trạng thái. Kiểm tra dialog ở 375px, document không tràn ngang.
- Đã rà soát diff, `git diff --check` qua; giữ các thay đổi có sẵn ở AI chat, UserLayout và translation keys sidebar. Không chạy ghi dữ liệu Firebase production; chưa kiểm thử tích hợp Firestore thật/emulator.
- Chưa commit, push hoặc deploy. Các server giả lập/Vite và tab kiểm thử đã đóng.

## Sửa lỗi tương thích thời gian hồ sơ (2026-10-27)
Log thực tế báo FirestoreStaffStore không deserialize được createdAt Timestamp sang Long. Thay toObject(User.class) bằng mapper dùng chung cho danh sách/transaction nhân viên và tra profile; đọc Timestamp/Date/numeric, trả epoch milliseconds, giữ null. Không migrate/ghi lại dữ liệu Firestore. Thêm regression tests dữ liệu thực Timestamp, giữ đầy đủ profile/staff fields và không update createdAt khi migrate nhóm. Backend ./mvnw test thành công: 309 tests, 0 failure/error/skipped; git diff --check qua. Chưa xác minh lại request trên Firebase thật.
