# Gỡ chức năng quản trị gói Pro

## Phạm vi
Theo yêu cầu chủ dự án: gỡ quản lý gói Pro từ BE đến FE, trực tiếp trên main theo workflow đã được cho phép. Đây là chức năng quản trị thủ công, không gỡ sản phẩm Pro, PayOS, dữ liệu subscription, profile summary hay entitlement của AI.

## Kế hoạch
1. Xóa controller/DTO và hàm service chỉ dùng cho cấp/gia hạn/thu hồi thủ công. Giữ cơ chế activatePaidOrder và đọc entitlement phục vụ thanh toán/AI.
2. Gỡ security matchers của API cũ và permission subscriptions khỏi catalog; lọc các permission đã nghỉ trong nhóm cũ khi đọc để không làm hỏng các quyền khác, không ghi/xóa dữ liệu production.
3. Gỡ route/menu/page/API wrapper/helper/test riêng của quản lý Pro; gỡ hàng quyền và cột Cấp/Thu hồi không còn áp dụng; dọn EN/VI.
4. Cập nhật contract và phân công hiện hành. Lưu lịch sử kế hoạch cũ.
5. Test API cũ không còn truy cập được, nhóm legacy vẫn dùng/sửa được với quyền còn lại; giữ test activation PayOS/idempotency/AI entitlement. Chạy backend tests và frontend lint/test/build; review diff, bảo toàn thay đổi khác.

## Kết quả
Đã gỡ controller, DTO, entry point service thủ công, trang/menu/route/wrapper/helper và translation riêng. Catalog/UI không còn chức năng quản trị Pro và action Cấp/Thu hồi; nhóm legacy lọc riêng các quyền đã gỡ. Giữ kích hoạt PayOS, summary/entitlement, dữ liệu subscription và kiểm thử idempotency/thanh toán đồng thời.

Xác minh: backend ./mvnw test thành công (299 tests hiện hành, không tính XML report cũ của class đã xóa); frontend lint, 121 tests và build thành công. Các API cũ trả 404 cho Admin; nhóm mang quyền cũ vẫn hoạt động và lưu được các quyền còn lại. git diff --check qua; đã rà soát diff và trạng thái git. Chưa commit/push/deploy hoặc sửa dữ liệu Firebase thật.
