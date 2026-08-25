# TOEIC Practice Web

Repository gồm:

- `backend/`: Spring Boot API, Firebase Admin và Firestore.
- `frontend/`: React, Vite, Tailwind CSS và Firebase Authentication.

Các thành viên phát triển giao diện bắt đầu tại tài liệu:

➡️ **[Frontend setup và hướng dẫn làm việc nhóm](frontend/README.md)**

Tài liệu frontend bao gồm yêu cầu Node.js, cài dependency, `.env.local`, chạy local, đăng nhập Google, role `USER`/`EMPLOYEE`/`ADMIN`, quy ước gọi API, phân chia Member 1–4, Git workflow và xử lý lỗi thường gặp.

## Bảo mật

- Không commit `.env`, Firebase service-account JSON hoặc private key.
- Frontend không cần Firebase Admin key.
- Không chia sẻ mật khẩu/tài khoản dùng chung trong repository.
- Luôn kiểm tra `git status` trước khi commit và push.
