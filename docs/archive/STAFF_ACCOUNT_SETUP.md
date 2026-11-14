# Gửi email tài khoản nhân viên bằng Gmail SMTP

Admin tạo trực tiếp tài khoản mới; tên, số điện thoại liên hệ, email và nhóm đều bắt buộc. Email là tên đăng nhập. Chọn tài khoản trong danh sách để xem trạng thái gửi mail và gửi lại khi cần. Gmail SMTP được chọn và việc thêm `spring-boot-starter-mail` đã được chủ dự án đồng ý trong yêu cầu này.

## Cấu hình backend

Thiết lập trong môi trường chạy backend, không commit vào Git hoặc dùng biến VITE:

| Biến | Ý nghĩa |
| --- | --- |
| `STAFF_SMTP_USERNAME` | Địa chỉ Gmail gửi mail |
| `STAFF_SMTP_PASSWORD` | Google App Password (không phải mật khẩu Google thông thường) |
| `STAFF_MAIL_FROM` | Địa chỉ gửi, thường giống SMTP username |
| `STAFF_CONSOLE_URL` | URL HTTPS đến Console, ví dụ `https://capytoeic.id.vn/console` |
| `FIREBASE_WEB_API_KEY` | Web API key của **cùng Firebase project** với Admin SDK, dùng backend xác thực mật khẩu cũ |
| `STAFF_SMTP_HOST` | Mặc định `smtp.gmail.com` |
| `STAFF_SMTP_PORT` | Mặc định `587`, STARTTLS bắt buộc |

Bật xác minh hai bước cho Google Account rồi tạo App Password. Đảm bảo hosting cho phép SMTP outbound cổng 587. Không bật `mail.debug`, request-body logging hoặc HTTP wire logging vì nội dung có mật khẩu/token. Backend timeout kết nối/đọc/ghi SMTP; không có dependency phía frontend chứa thông tin SMTP. Cấu hình này chưa được kiểm tra với hộp thư thật trong quá trình triển khai mã.

Nguồn chính thức: [Google App Password](https://support.google.com/mail/answer/185833), [Firebase REST password authentication](https://firebase.google.com/docs/reference/rest/auth), [Firebase session revocation](https://firebase.google.com/docs/auth/admin/manage-sessions).

## Kiểm tra khi triển khai

Dùng tài khoản nội bộ được cho phép để xác nhận mail mới và reset mail tới đúng hộp thư, domain link đúng môi trường và không bị thư rác. Kiểm tra Firebase Email/Password provider đã bật. Xác nhận Firestore client rules chặn ghi field role/group/credential và collection `staffRecoveryLimits`; backend Admin SDK dùng IAM như hiện tại. Kiểm tra reverse proxy truyền remote address theo cấu hình tin cậy; ứng dụng không đọc forwarding header do client tự khai.

API tạo mới trả thành công kể cả SMTP lỗi; UI hiện “Tài khoản đã tạo · Gửi mail thất bại”. Sau 60 giây chọn nhân viên và Gửi lại thông tin đăng nhập; mật khẩu mới thay thế mật khẩu cũ. Không tạo lại bằng cùng email. `SENT` chỉ xác nhận SMTP đã chấp nhận.

## Phục hồi sau sự cố tiến trình

Credential operation được khóa bền, không tự hết hạn nhằm tránh hai tác vụ đồng thời thay đổi mật khẩu. Nếu backend bị dừng trong khi cấp/gửi/đổi mật khẩu, xác minh tiến trình cũ đã kết thúc và không còn request đang chạy trước khi sửa dữ liệu bằng công cụ quản trị tin cậy. Giữ `passwordChangeRequired=true`, đặt `temporaryPasswordExpiresAt=0`, xóa `staffResetTokenHash`/`staffResetExpiresAt`, đặt `credentialOperation=null` và `credentialEmailStatus=FAILED`. Với tài khoản admin tạo có profile, admin khác dùng Gửi lại; nếu tài khoản bị khóa nội bộ thì bật lại trước. Với tài khoản legacy, dùng Quên mật khẩu. Không tự dựng hoặc đọc lại mật khẩu. Nếu Firebase identity disabled được tạo nhưng chưa có profile và cleanup cũng thất bại do gián đoạn hạ tầng, chỉ xóa identity sau khi xác nhận UID thuộc provisioning thất bại, chưa có profile hoặc dữ liệu người học; không xóa một tài khoản có trước.

Ứng dụng không gửi email thật hoặc tạo tài khoản thật trong các unit test; mail/Firebase được mock. Để tránh khóa admin cuối cùng khi thử nghiệm gửi lại, dùng một admin khác và tài khoản kiểm tra được cho phép.
