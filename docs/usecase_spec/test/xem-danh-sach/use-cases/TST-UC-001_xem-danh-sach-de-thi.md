### TST-UC-001_Xem danh sách đề thi

### Mô tả use case TST-UC-001

| Trường | Nội dung |
|---|---|
| Use case: | TST-UC-001_Xem danh sách đề thi |
| Mục đích: | Cho phép người học xem các đề thi đã công bố |
| Mô tả: | Người học mở danh sách đề và xem thông tin tổng quan |
| Actor: | GUEST, USER |
| Tiền điều kiện: | Không yêu cầu đăng nhập {{ref: BR-TST-001}} |
| Hậu điều kiện: | Danh sách đề được tải và hiển thị thành công |

### Luồng sự kiện chính

| Người học | Hệ thống |
|---|---|
| 1. Mở trang danh sách đề thi. | 2. Lấy danh sách đề được phép công bố. {{ref: BR-TST-002}} |
| | 3. Hiển thị thông tin tổng quan của các đề. {{ref: BR-TST-003}} |

### Luồng sự kiện phụ

| Người học | Hệ thống |
|---|---|
| | Chưa đặc tả; các nhánh danh sách rỗng và lỗi tải đang chờ đối chiếu trong README của feature. |

### Biểu đồ

Activity: `../diagrams/TST-UC-001_activity.act`

Sequence: `../diagrams/TST-UC-001_sequence.seq`
