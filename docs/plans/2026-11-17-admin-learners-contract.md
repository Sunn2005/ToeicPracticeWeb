# Contract Quản lý học viên v1

Đề xuất để review trước khi triển khai. Quyền Console, phiên đăng nhập và mã lỗi dùng chung theo [API_ROLE_WORKFLOWS.md](../archive/API_ROLE_WORKFLOWS.md).

## Phạm vi và quyền truy cập

- Console có danh sách tại `/console/learners` và chi tiết tại `/console/learners/:uid`. Chỉ Admin đang hoạt động và đã hoàn tất yêu cầu đổi mật khẩu được thấy mục điều hướng và truy cập hai trang.
- Backend xác thực qua Firebase session theo cơ chế hiện tại, lấy role từ Firestore và áp dụng kiểm tra quyền Console trên mỗi request. Cả ba API bên dưới chỉ cấp cho Admin đủ điều kiện. `EMPLOYEE` không được cấp quyền này qua cấu hình nhóm.
- Học viên là người dùng có role hiện tại là `USER`. API chi tiết và đơn hàng kiểm tra role của UID đích ở mỗi request. UID không tồn tại hoặc có role khác trả cùng một lỗi `404`.
- Chức năng chỉ đọc hồ sơ, trạng thái Pro, số liệu học tập tổng hợp và đơn hàng Pro của học viên. Quy tắc ownership của API lượt thi tiếp tục áp dụng. Trạng thái khóa tài khoản, chỉnh sửa hồ sơ, cấp Pro và đối soát thanh toán nằm ngoài phạm vi.

## API

Mọi thời điểm dùng Unix millisecond. Các field nullable luôn có mặt trong JSON. Response dùng DTO có danh sách field cố định và `Cache-Control: no-store`.

### Danh sách học viên

`GET /api/admin/users?search=&pro=ALL&size=20&cursor=`

| Tham số | Quy tắc |
| --- | --- |
| `search` | Tùy chọn. Bỏ khoảng trắng ở hai đầu, tối đa 100 ký tự. So khớp chuỗi con của tên hiển thị hoặc email, không phân biệt hoa thường, giữ phân biệt dấu. Rỗng tương đương không tìm kiếm. |
| `pro` | `ALL` (mặc định), `PRO` hoặc `FREE`. |
| `size` | Số nguyên từ 1 đến 50, mặc định 20. |
| `cursor` | Bỏ ở trang đầu. Các trang sau truyền nguyên `nextCursor` và giữ cùng bộ lọc, kích thước trang. |

Trả `200 { items, nextCursor }`. Mỗi phần tử có `uid` (string), `displayName`, `email`, `photoUrl` (string hoặc null), `targetScore` (integer hoặc null), `createdAt`, `lastLoginAt`, `proExpiresAt` (integer hoặc null) và `proStatus` (`PRO`, `FREE` hoặc `UNKNOWN`).

- Dùng điều kiện Pro hiệu lực hiện tại của `SubscriptionService`, tính theo cùng một mốc thời gian server cho mỗi request. Subscription đọc thành công nhưng không tồn tại hoặc không hiệu lực là `FREE`. `proExpiresAt` chỉ có giá trị khi đang `PRO`.
- Nếu chưa xác định được trạng thái do đọc subscription lỗi, bộ lọc `ALL` trả `UNKNOWN` cho học viên bị ảnh hưởng. Với `PRO` hoặc `FREE`, trả `503 LEARNER_SUBSCRIPTIONS_UNAVAILABLE` nếu gặp lỗi khi xác định một ứng viên cần để lập trang.
- Sắp xếp theo ID tài liệu Firestore tăng dần để bao gồm cả hồ sơ cũ thiếu `createdAt`. Cursor là token do server sinh, gắn với bộ lọc chuẩn hóa và vị trí tiếp tục. `nextCursor: null` nghĩa là đã đọc hết. Trang có thể ít hơn `size` mục hoặc rỗng và vẫn có cursor tiếp theo. UI dùng **Tiếp** khi còn cursor, đặt lại lịch sử cursor khi đổi bộ lọc và hiển thị trạng thái rỗng cuối lượt tìm kiếm khi đã duyệt hết.
- Giới hạn đọc tối đa 200 tài liệu học viên mỗi request. Truy vấn Firestore theo `role=USER` và cursor, lọc tên/email trên các lô đã đọc, đọc subscription theo lô cho các ứng viên phù hợp. Cursor tiến qua ứng viên cuối đã xử lý, kể cả ứng viên bị loại, và không bỏ qua ứng viên đã tải nhưng chưa xử lý. Lượt phân trang đọc dữ liệu hiện hành và không cung cấp tổng số trang.

### Chi tiết học viên

`GET /api/admin/users/{uid}` trả `200` với các field hồ sơ như một phần tử danh sách và thêm `statistics`:

| Field | Kiểu | Cách tính |
| --- | --- | --- |
| `completedExamAttempts` | integer | Số lượt đã hoàn thành được xếp loại thi theo logic thống kê học tập hiện tại. |
| `completedPracticeAttempts` | integer | Số lượt luyện tập có trạng thái `COMPLETED`. |
| `bestListeningScore`, `bestReadingScore` | integer hoặc null | Điểm phần cao nhất đã lưu của lượt thi hoàn thành, có số câu của phần đó lớn hơn 0. Mỗi phần trả null nếu thiếu điểm hợp lệ. |
| `lastStudyAt` | integer hoặc null | `submittedAt` lớn nhất của lượt thi hoặc luyện tập đã hoàn thành. |

Không có lượt hoàn thành thì hai bộ đếm bằng 0 và các số liệu còn lại bằng null. Nếu đọc thống kê thất bại, trả `503 LEARNER_DATA_UNAVAILABLE`. Nếu chỉ đọc subscription thất bại, vẫn trả hồ sơ và thống kê với `proStatus: "UNKNOWN"` và `proExpiresAt: null`. Chỉ truy vấn trường cần để tổng hợp theo UID đích. Response không có mã lượt thi, dữ liệu từng lượt, đáp án hoặc thông tin xác thực. Schema `GET /api/users/me/statistics` giữ theo contract hiện tại.

### Đơn hàng Pro của học viên

`GET /api/admin/users/{uid}/orders?size=20&cursor=` trả `200 { items, nextCursor }`. Quy tắc `size` như danh sách học viên. Cursor gắn với UID đích, kích thước trang và vị trí tiếp tục.

- Truy vấn đơn theo UID, sắp xếp `createdAt` giảm dần, cùng thời điểm thì `orderCode` giảm dần. Mỗi phần tử gồm `orderCode`, `planCode`, `amount` (VND), `durationDays`, `status`, `createdAt` và `paidAt` (nullable), dùng kiểu dữ liệu và trạng thái của API đơn hàng hiện tại. Hiển thị mọi trạng thái đơn.
- Thiếu đơn trả danh sách rỗng. Không trả dữ liệu ngân hàng, `checkoutUrl` hoặc mã liên kết PayOS. UI tải đơn riêng để vẫn hiển thị hồ sơ khi phần đơn hàng gặp lỗi.

### Lỗi

| HTTP | Code | Khi nào |
| --- | --- | --- |
| `400` | `LEARNER_QUERY_INVALID` | Tham số lọc hoặc phân trang sai, cursor hỏng hoặc dùng sai bộ lọc/UID. |
| `401` | Theo contract auth hiện tại | Thiếu phiên hoặc phiên không hợp lệ. |
| `403` | Theo contract auth hiện tại | Không có quyền Admin hiệu lực hoặc còn yêu cầu đổi mật khẩu. |
| `404` | `LEARNER_NOT_FOUND` | UID đích không tồn tại hoặc hiện không có role `USER`. |
| `503` | `LEARNER_SUBSCRIPTIONS_UNAVAILABLE` | Lỗi nguồn subscription khi cần phân loại theo bộ lọc Pro/Free. |
| `503` | `LEARNER_DATA_UNAVAILABLE` | Lỗi đọc dữ liệu cần thiết để trả danh sách, hồ sơ, thống kê hoặc đơn hàng. |

## Kế hoạch triển khai và kiểm tra

1. Tích hợp kiểm tra Admin theo cơ chế Console hiện có. Dùng DAO truy vấn có giới hạn và DTO riêng. Kiểm tra index Firestore cho truy vấn người dùng và đơn hàng. Thiết kế này dùng các collection hiện có. Truy vấn đơn hàng cần composite index `paymentOrders(userId ASC, createdAt DESC, orderCode DESC)`, khai báo trong `firestore.indexes.json` và phải deploy bằng `firebase deploy --only firestore:indexes`; thiếu index thì endpoint trả `503 LEARNER_DATA_UNAVAILABLE`.
2. Thêm API wrapper dùng `apiFetch`, hai route Console và bản dịch Anh–Việt. Phối hợp owner Console cho phần route, guard và điều hướng. UI có trạng thái tải, rỗng, lỗi và thử lại cho từng nguồn.
3. Kiểm tra thiếu phiên, role USER/EMPLOYEE, Admin bị khóa hoặc phải đổi mật khẩu, và UID đích là nhân viên. Kiểm tra hồ sơ legacy, cursor qua trang rỗng, lọc không bỏ sót ở ranh giới lô, Pro hết hạn hoặc lỗi nguồn, thống kê thiếu điểm và phân trang đơn hàng. Xác minh response lượt thi của chủ sở hữu vẫn theo contract hiện tại.
4. Chạy bộ test backend, lint/test/build frontend và smoke test hai màn hình với Admin và Employee. Bổ sung mục API vào tài liệu contract chính khi triển khai endpoint.
