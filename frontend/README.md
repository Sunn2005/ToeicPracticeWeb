# CapyTOEIC Web — Frontend

Frontend của hệ thống luyện thi TOEIC, xây dựng bằng React, Vite, Tailwind CSS và Firebase Authentication.

Tài liệu này dành cho các thành viên phát triển frontend. Hãy đọc hết phần **Cài đặt**, **Biến môi trường**, **Đăng nhập và phân quyền** trước khi bắt đầu code.

## 1. Công nghệ và yêu cầu môi trường

### Công nghệ chính

- React 19
- React Router 7
- Vite 8
- Tailwind CSS 4
- Firebase Authentication 12
- ESLint 10
- Node.js test runner

### Phiên bản cần cài

- Node.js: `^20.19.0` hoặc `>=22.12.0` theo yêu cầu của Vite 8
- npm: nên dùng phiên bản đi kèm Node.js
- Git
- Trình duyệt Chrome, Edge hoặc Safari phiên bản mới

Phiên bản đã được kiểm tra trên máy phát triển hiện tại:

```text
Node.js v22.16.0
npm 10.9.2
```

Kiểm tra phiên bản trên máy:

```bash
node --version
npm --version
git --version
```

Nếu Node.js quá cũ, Vite có thể không khởi động hoặc build thất bại.

## 2. Clone và cài đặt dự án

Clone repository:

```bash
git clone https://github.com/Sunn2005/ToeicPracticeWeb.git
cd ToeicPracticeWeb/frontend
```

Cài đúng dependency từ `package-lock.json`:

```bash
npm ci
```

Nên dùng `npm ci` khi mới clone hoặc khi đồng bộ code từ nhóm. Chỉ dùng `npm install` khi chủ động thêm, xóa hoặc nâng cấp package.

## 3. Cấu hình biến môi trường

Frontend hiện dùng một biến môi trường:

| Biến                | Bắt buộc | Ý nghĩa                                                  |
| ------------------- | -------- | -------------------------------------------------------- |
| `VITE_API_BASE_URL` | Có       | URL gốc của Spring Boot backend, không có dấu `/` ở cuối |

Tạo file cấu hình cá nhân từ file mẫu:

```bash
cp .env.example .env.local
```

Nếu dùng Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

### Cách A — dùng backend production qua custom domain

Đây là lựa chọn đơn giản nhất cho thành viên chỉ làm frontend:

```env
VITE_API_BASE_URL=https://api.capytoeic.id.vn
```

Lưu ý: Render Free có thể sleep khi không có người dùng. Request đầu tiên đôi khi mất khoảng 30–60 giây.

### Cách B — dùng backend chạy trên máy local

Chỉ sử dụng khi backend Spring Boot đang chạy tại cổng 8080:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Frontend phải chạy tại `http://localhost:5173` vì backend hiện cho phép CORS đối với origin này.
Backend local qua HTTP phải có `AUTH_COOKIE_SECURE=false`; production giữ mặc định `true`.

### Quy tắc bảo mật `.env`

- Dùng `.env.local` cho cấu hình cá nhân.
- Không commit `.env`, `.env.local` hoặc file chứa secret.
- Không đưa Firebase Admin service-account JSON vào frontend.
- Không đặt private key vào biến bắt đầu bằng `VITE_`. Biến `VITE_` được đóng gói vào JavaScript và người dùng trình duyệt có thể đọc được.
- Firebase Web config trong `src/firebase.js` là cấu hình client, không phải Firebase Admin private key.

Frontend **không cần** biến `FIREBASE_SERVICE_ACCOUNT`. Biến đó chỉ dành cho backend/Render.

## 4. Chạy frontend

Khởi động development server:

```bash
npm run dev
```

Mở trình duyệt tại:

```text
http://localhost:5173
```

Vite hỗ trợ hot reload: khi sửa file trong `src/`, trình duyệt sẽ tự cập nhật.

Nếu cổng 5173 đang được sử dụng, hãy dừng process cũ rồi chạy lại. Không nên tự chuyển sang cổng khác vì backend hiện chỉ cho phép CORS từ cổng 5173.

Trên macOS/Linux, có thể tìm process đang dùng cổng bằng:

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

Sau đó dừng đúng PID vừa tìm được:

```bash
kill <PID>
```

Trên Windows PowerShell/CMD:

```powershell
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

## 5. Đăng nhập và tài khoản kiểm thử

### Cách đăng nhập

Ứng dụng hiện chỉ hỗ trợ **Continue with Google** thông qua Firebase Authentication.

1. Mở `http://localhost:5173/login`.
2. Chọn **Continue with Google**.
3. Chọn tài khoản Google được phép sử dụng trong Firebase project.
4. Sau khi đăng nhập thành công, ứng dụng chuyển tới `/dashboard`.

Không có username/password mặc định trong repository và không được commit tài khoản hoặc mật khẩu dùng chung vào README.

### Các quyền người dùng

| Role       | Dùng để kiểm thử                                     | Cách nhận quyền                                      |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `USER`     | Xem đề, bắt đầu thi, làm bài, xem kết quả và lịch sử | Tài khoản Google thông thường; đây là quyền mặc định |
| `EMPLOYEE` | Tạo, sửa, xóa, preview và gửi đề để duyệt            | Gửi email Google cho trưởng nhóm để được cấp quyền   |
| `ADMIN`    | Xem hàng đợi, duyệt/từ chối đề và xem lịch sử duyệt  | Gửi email Google cho trưởng nhóm để được cấp quyền   |

Quyền `EMPLOYEE` và `ADMIN` được backend kiểm tra bằng Spring Security, không được giả lập bằng cách sửa state hoặc local storage trên frontend. Firestore `users/{uid}.role` là nguồn role duy nhất.

Sau khi trưởng nhóm thay đổi role trong Firestore, tải lại profile bằng `GET /api/me`. Nếu vẫn nhận `403`, báo trưởng nhóm kiểm tra trường `role` trong document `users/{uid}`.

### Khi thành viên mới không đăng nhập được

Kiểm tra theo thứ tự:

1. Google provider đã được bật trong Firebase Authentication.
2. `localhost` đã nằm trong Firebase Authentication → Authorized domains.
3. Popup đăng nhập không bị trình duyệt chặn.
4. Thành viên đang chọn đúng tài khoản Google đã đăng ký với nhóm.
5. Đăng xuất, tải lại trang và đăng nhập lại.

## 6. Các lệnh thường dùng

| Lệnh                             | Chức năng                                                 |
| -------------------------------- | --------------------------------------------------------- |
| `npm run dev`                    | Chạy development server tại cổng 5173                     |
| `npm run lint`                   | Kiểm tra ESLint                                           |
| `npm test`                       | Chạy automated tests                                      |
| `npm run build`                  | Tạo production build trong `dist/`                        |
| `npm run preview -- --port 5173` | Xem production build trên cổng được backend cho phép CORS |

Trước khi push hoặc mở pull request, bắt buộc chạy:

```bash
npm run lint
npm test
npm run build
```

## 7. Cấu trúc thư mục

```text
frontend/
├── src/
│   ├── api/                 # API client và wrapper theo nghiệp vụ
│   ├── auth/                # Firebase session và route guard
│   ├── components/          # Component dùng chung
│   │   ├── admin/           # Component dành cho Admin
│   │   ├── ai-chat/         # Khung chat Capy AI dành cho người dùng Pro
│   │   ├── test-editor/     # Component tạo/sửa đề TOEIC
│   │   ├── tests/           # Component danh sách và bộ lọc đề
│   │   ├── ui/              # Button, Input, Modal, Badge...
│   │   └── user/            # Component dashboard/lịch sử người dùng
│   ├── config/              # Cấu hình thời gian và chế độ thi
│   ├── data/                # Dữ liệu catalog tĩnh
│   ├── layouts/             # Layout Public, User, Employee/Admin
│   ├── pages/               # Các trang theo route
│   ├── utils/               # Hàm xử lý dữ liệu và format
│   ├── App.jsx              # Khai báo route hiện tại
│   ├── firebase.js          # Firebase Web client config
│   └── main.jsx             # Entry point React
├── .env.example
├── package.json
├── package-lock.json
└── vite.config.js
```

## 8. Trạng thái các luồng hiện tại

### Đã hoạt động

- Đăng nhập Google.
- Dashboard và chọn đề Test 1.
- Chọn Full Test, Listening Test, Reading Test hoặc một/nhiều Part.
- Làm bài Listening/Reading.
- Autosave đáp án.
- Previous/Next, question navigator và submit có xác nhận.
- Chấm điểm, xem kết quả và review.

### Đang phát triển

- Public landing page và layout dùng chung.
- Auth context và role-based protected routes.
- User dashboard, profile, catalog và attempt history.
- Employee dashboard và trình tạo/sửa đề.
- Admin review dashboard.
- Bộ component UI dùng chung.

### Route legacy không nên dùng

`/practice/part5` và `src/pages/PracticePart.jsx` là code thử nghiệm cũ, vẫn tham chiếu `test_001`. Không phát triển tính năng mới dựa trên file này.

Luồng thi hiện tại sử dụng:

```text
/full-test/:testId
/full-test/:attemptId/exam
/full-test/:attemptId/result
/full-test/:attemptId/review
```

## 9. Capy AI Chat dành cho người dùng Pro

Capy AI Chat hỗ trợ giải đáp thắc mắc liên quan đến luyện thi TOEIC trước và sau khi làm bài. Đây không phải trợ lý trong phòng thi và không thay thế luồng nhận xét AI của bài Full Test.

### Điều kiện hiển thị

- Chỉ tài khoản có `role: USER`, `subscription.effective: true` và entitlement `AI_CHAT` từ `GET /api/me` mới thấy pet Capy.
- Người dùng thường, `EMPLOYEE`, `ADMIN` và các route quản trị không hiển thị Capy.
- Capy và khung chat không xuất hiện tại route làm bài `/full-test/:attemptId/exam`.
- Frontend chỉ dùng subscription summary để quyết định cách hiển thị. Backend vẫn kiểm tra entitlement trên mọi API chat; không được tin role hoặc trạng thái Pro từ local storage/request body.
- Dashboard người dùng thường tải danh sách gói từ backend và tạo checkout PayOS bằng `src/api/payments.js`; frontend chỉ gửi `planCode`, không gửi giá hoặc thời hạn.
- Route `/payment/success` chỉ báo PayOS đã redirect về và refresh profile; quyền Pro chỉ được kích hoạt sau khi backend xác minh webhook. `/payment/cancel` không thay đổi subscription.

### Tương tác và khả năng truy cập

- Lần đầu Capy xuất hiện trên một trình duyệt, tooltip “Nhấn để trò chuyện” tự ẩn sau khoảng 6 giây. Trạng thái đã xem dùng key `capy-ai-chat-hint-seen-v1` trong local storage và không dùng để phân quyền.
- Click hoặc kích hoạt bằng bàn phím mở dialog chat. Kéo quá ngưỡng 8 CSS px chỉ đổi vị trí pet và không mở chat.
- Dialog giữ focus bên trong khi mở, hỗ trợ `Escape` để đóng và trả focus về launcher. Dialog xác nhận xóa hội thoại cũng có focus trap riêng.
- Mobile dùng chiều cao viewport động và safe-area cho vùng nhập; desktop hiển thị panel neo gần Capy.
- Hiệu ứng chuyển động được giảm khi trình duyệt bật `prefers-reduced-motion`.

### Cách chat hoạt động

- API wrapper nằm tại `src/api/aiChat.js`; component không tự lấy Firebase token hoặc gọi `fetch` trực tiếp.
- Phiên bản đầu dùng job bất đồng bộ và polling, không dùng token streaming. Tin nhắn người dùng xuất hiện ngay; câu trả lời Capy được cập nhật khi job hoàn thành.
- Đóng khung chat chỉ hủy polling phía trình duyệt, không hủy job backend. Khi mở lại hội thoại có job đang chờ, frontend tiếp tục polling.
- Người dùng có thể gắn context bằng attempt đã hoàn thành và số câu hỏi. Frontend chỉ gửi ID/số câu; backend tự tải và kiểm tra ownership cùng trạng thái attempt.
- Khi backend trả `PRO_REQUIRED`, lịch sử đang có vẫn được giữ để đọc nhưng composer chuyển sang read-only. Khi profile đã biết entitlement không còn hiệu lực, launcher và dialog được đóng.
- Timeout polling mặc định là 60 giây. Không thay đổi timeout, trạng thái job hoặc mã lỗi ổn định nếu chưa thống nhất contract với backend/AI service.

### Checklist kiểm thử thủ công

Chuẩn bị một tài khoản `USER` Pro có entitlement `AI_CHAT`, một tài khoản `USER` thường và backend/AI service/RabbitMQ hoạt động. Không dùng hoặc commit tài khoản/secret dùng chung.

1. Trên desktop và mobile, đăng nhập tài khoản Pro; kiểm tra Capy, tooltip lần đầu, click mở chat và layout không tràn viewport.
2. Dùng `Tab`/`Shift+Tab`, `Enter`/`Space` và `Escape`; kiểm tra focus không thoát dialog và quay lại launcher sau khi đóng.
3. Click Capy không kéo phải mở chat; kéo dưới 8 px vẫn được xem là click; kéo vượt 8 px chỉ di chuyển pet.
4. Bật reduced motion ở hệ điều hành/trình duyệt và kiểm tra launcher không dùng chuyển động không cần thiết.
5. Gửi tin nhắn rồi đóng chat khi đang chờ; mở lại và kiểm tra job tiếp tục đến khi có câu trả lời.
6. Chọn attempt đã hoàn thành, chọn câu hỏi, gửi chat và kiểm tra UI không hiển thị/đẩy đáp án hoặc nội dung review chưa được phép.
7. Đăng nhập tài khoản thường, `EMPLOYEE` và `ADMIN`; xác nhận Capy hoàn toàn không xuất hiện.
8. Với tài khoản Pro, đi vào `/full-test/:attemptId/exam`; xác nhận Capy và dialog không xuất hiện.
9. Thu hồi/hết hạn Pro; xác nhận lần tải profile tiếp theo đóng chat. Nếu API gửi trả `PRO_REQUIRED` trước khi profile cập nhật, xác nhận lịch sử còn đọc được nhưng không thể gửi thêm.

Sau khi thay đổi frontend, luôn chạy:

```bash
npm run lint
npm test
npm run build
```

## 10. Quy ước gọi API

API client dùng chung nằm tại `src/api/client.js`.

### API public

Dùng `publicApiFetch` cho endpoint không cần đăng nhập:

```jsx
import { publicApiFetch } from "../api/client";

const tests = await publicApiFetch("/api/tests");
const metadata = await publicApiFetch("/api/tests/test-1");
```

### API cần đăng nhập

Dùng `apiFetch` cho endpoint cần phiên đăng nhập:

```jsx
import { apiFetch } from "../api/client";

const profile = await apiFetch("/api/me");
const attempts = await apiFetch("/api/users/me/attempts");
```

Ví dụ gửi JSON:

```jsx
const attempt = await apiFetch("/api/tests/test-1/attempts", {
  method: "POST",
  body: JSON.stringify({
    mode: "PART",
    part: 3,
    parts: [3],
    durationMinutes: 15,
  }),
});
```

`apiFetch` luôn gửi cookie phiên bằng `credentials: "include"`. Với `POST`, `PUT`, `PATCH` và `DELETE`, client tự lấy CSRF token và gửi header `X-XSRF-TOKEN`.

Firebase ID token chỉ tồn tại tạm thời trong memory trong lúc đăng nhập. Frontend gửi token này một lần tới `/api/v1/auth/session`; backend đổi nó thành Firebase session cookie `HttpOnly`. Frontend không lưu ID token, refresh token hoặc session cookie trong localStorage.

Không tự sao chép logic lấy token vào từng page. Nếu cần thêm endpoint, hãy tạo wrapper trong file tương ứng của thư mục `src/api/`.

Client đã hỗ trợ cả JSON và `FormData`. Khi Member 3 triển khai upload `multipart/form-data`, chỉ cần truyền `FormData` làm body và không tự đặt `Content-Type`; trình duyệt sẽ tự thêm multipart boundary. Không sửa `src/api/client.js` nếu chưa được trưởng nhóm đồng ý.

### Nhóm endpoint chính

| Nhóm         | Endpoint tiêu biểu                                              | Quyền                   |
| ------------ | --------------------------------------------------------------- | ----------------------- |
| Test catalog | `GET /api/tests`, `GET /api/tests/{testId}`                     | Public                  |
| Current user | `GET /api/me`                                                   | Đã đăng nhập            |
| Learning     | `GET /api/users/me/attempts`, `GET /api/users/me/statistics`    | `USER` trở lên          |
| Exam         | `/api/tests/{testId}/attempts`, `/api/attempts/{attemptId}/...` | Đã đăng nhập            |
| Capy AI Chat | `/api/ai/chat/conversations`, `/api/ai/chat/jobs/{jobId}`       | `USER` Pro + `AI_CHAT`  |
| Payment      | `/api/payments/pro`, `/api/payments/pro/plans`                 | Đã đăng nhập            |
| Employee     | `/api/employee/tests`, `/api/employee/media`                    | `EMPLOYEE` hoặc `ADMIN` |
| Admin review | `/api/admin/test-submissions`, `/api/admin/review-history`      | `ADMIN`                 |

Các mutation Capy AI Chat yêu cầu entitlement Pro hiệu lực. Các endpoint `GET` lịch sử hội thoại/job vẫn cho owner đã đăng nhập đọc sau khi Pro hết hạn hoặc bị thu hồi; backend không cho gửi, tạo, xóa hoặc retry mới khi thiếu `AI_CHAT`.

## 11. Phân chia công việc frontend

Quy định ownership, file bị khóa, cách đặt branch, commit và pull request được mô tả đầy đủ tại:

➡️ **[Quy định làm việc nhóm Frontend](TEAM_FRONTEND_ASSIGNMENTS.md)**

Mọi thành viên phải đọc tài liệu này trước khi tạo branch đầu tiên.

### Member 1 — nền tảng dùng chung

- `src/auth/`
- `src/layouts/`
- `src/components/ui/`
- `src/pages/auth/`, `src/pages/public/`, `src/pages/errors/`
- Tích hợp route cuối cùng trong `App.jsx`

### Member 2 — chức năng người học

- `src/api/userLearning.js`
- `src/pages/user/`
- `src/components/user/`
- `src/components/tests/`

### Member 3 — chức năng Employee

- `src/api/employeeTests.js`
- `src/pages/employee/`
- `src/components/test-editor/`

### Member 4 — chức năng Admin

- `src/api/adminReviews.js`
- `src/pages/admin/`
- `src/components/admin/`

Để giảm conflict, chỉ Member 1 nên thực hiện đợt tích hợp route lớn trong `App.jsx`. Các thành viên khác tập trung vào page, component và API wrapper thuộc phạm vi của mình.

## 12. Quy trình Git dành cho thành viên

Từ thư mục gốc repository:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/m2-user-dashboard
```

Sau khi hoàn thành:

```bash
cd frontend
npm run lint
npm test
npm run build
cd ..
git status
git add frontend/src/pages/user frontend/src/components/user frontend/src/components/tests frontend/src/api/userLearning.js
git diff --cached
git commit -m "feat(user): implement user dashboard"
git push -u origin feature/m2-user-dashboard
```

Không đưa các file sau vào commit:

- `.env`
- `.env.local`
- Firebase service-account JSON
- `node_modules/`
- `dist/`
- `.DS_Store`
- file cấu hình IDE cá nhân

Không dùng `git add .` một cách máy móc. Luôn chạy `git status` và kiểm tra từng file trước khi commit.

## 13. Lỗi thường gặp

### `Failed to fetch` hoặc CORS

- Kiểm tra `VITE_API_BASE_URL`.
- Kiểm tra backend đang chạy.
- Bảo đảm frontend chạy tại `http://localhost:5173`.
- Khởi động lại Vite sau khi thay đổi `.env.local`.

### API production phản hồi chậm lần đầu

Render Free có thể đang cold start. Chờ khoảng 30–60 giây rồi thử lại.

### `401 Unauthorized`

- Đăng nhập lại bằng Google.
- Phiên cookie có thể đã hết hạn hoặc bị thu hồi.
- Không gửi Google OAuth access token trực tiếp tới API nghiệp vụ.
- Với code mới, ưu tiên dùng `apiFetch` thay vì tự viết `fetch`.

### `403 CSRF_TOKEN_INVALID`

- Không tự viết `fetch` cho request thay đổi dữ liệu; dùng `apiFetch` để gửi CSRF token đúng cách.
- Kiểm tra `VITE_API_BASE_URL` và bảo đảm request dùng `credentials: "include"`.
- Nếu vừa đổi domain hoặc xóa cookie, tải lại trang để lấy CSRF token mới.

### `403 Forbidden`

Tài khoản đã đăng nhập nhưng không có role cần thiết. Liên hệ trưởng nhóm để kiểm tra quyền `USER`, `EMPLOYEE` hoặc `ADMIN`.

### `500 Internal Server Error`

- Kiểm tra response body trong Network tab.
- Ghi lại endpoint, request body, thời điểm xảy ra lỗi và thao tác đang thực hiện.
- Kiểm tra log backend local hoặc Render.
- Không sửa frontend để che lỗi 500 từ backend.

### Google popup không mở

- Cho phép popup cho `localhost:5173`.
- Tắt extension chặn popup nếu cần.
- Kiểm tra `localhost` trong Firebase Authorized domains.

### Thay đổi `.env.local` nhưng ứng dụng vẫn dùng URL cũ

Dừng Vite rồi chạy lại:

```bash
npm run dev
```

Vite chỉ đọc biến môi trường khi khởi động process.

## 14. Checklist trước khi giao code

- [ ] Chức năng chạy được trên màn hình desktop và mobile.
- [ ] Có loading, empty và error state phù hợp.
- [ ] API authenticated gọi qua `apiFetch`.
- [ ] Không hiển thị đáp án đúng trước khi nộp bài.
- [ ] Không log token, private data hoặc toàn bộ response nhạy cảm.
- [ ] `npm run lint` thành công.
- [ ] `npm test` thành công.
- [ ] `npm run build` thành công.
- [ ] Không có `.env`, key JSON, `.DS_Store`, `dist/` hoặc `node_modules/` trong commit.
- [ ] Pull request mô tả màn hình đã làm, endpoint đã dùng và cách kiểm thử.

## 15. Thông tin liên hệ trong nhóm

Khi cần quyền Firebase/Render, tài khoản `EMPLOYEE`/`ADMIN`, hoặc thay đổi API contract, liên hệ trưởng nhóm qua kênh nội bộ. Không gửi private key hoặc mật khẩu qua GitHub issue, pull request hay group chat công khai.

### Khôi phục thanh toán Pro bị bỏ lỡ webhook

Admin mở `/console/orders` → chi tiết đơn → **Đối soát với PayOS**. Wrapper
`reconcileAdminOrder` gửi `POST /api/admin/payments/orders/{orderCode}/reconcile`
qua `apiFetch` (session + CSRF), không gửi status/giá/UID. Backend xác minh đầy đủ
với PayOS rồi trả schema chi tiết đơn hiện tại; UI cập nhật chi tiết và tải lại danh
sách theo bộ lọc. Có trạng thái đang xử lý, khóa bấm lặp và thông báo lỗi theo code.
Đơn `CANCELLED` không có nút đối soát. Không dựa vào return URL để cấp Pro.

Phải deploy cả backend và frontend trước khi sử dụng trên website công khai.
Với đơn chưa từng kích hoạt, thời hạn tính từ lúc khôi phục hoặc nối tiếp thời hạn
Pro còn lại. Retry không cộng ngày trùng/hoàn tác thu hồi sau đó. Ngày thanh toán
chưa ghi nhận được để trống, không thay bằng thời gian khôi phục. Sau khi đối soát,
người mua tải lại dashboard. Không yêu cầu thanh toán thêm.

## Quản lý nhân viên và nhóm quyền

Admin truy cập `/console/staff` để tạo/sửa/xóa nhóm, cấu hình quyền và tạo tài khoản mới bằng họ tên, số điện thoại liên hệ, email. Không cần nhân viên tự đăng ký; email đã có trong Firebase Auth hoặc Firestore bị từ chối. Thông tin đăng nhập gửi bằng Gmail SMTP; trạng thái tạo tài khoản và gửi mail riêng biệt, có gửi lại sau 60 giây. Xem `docs/STAFF_ACCOUNT_SETUP.md`. Các nhóm thường không thể được cấp quyền quản lý nhân viên. Nhóm Quản trị có đầy đủ quyền cố định và không được xóa.

Menu, route và thao tác lấy quyền từ `profile.consoleAccess` do backend trả; gọi API qua `src/api/adminStaff.js` và client chung (session cookie + CSRF). Không tự lấy token hoặc giả lập role. Backend luôn kiểm tra lại quyền và ownership; nhân viên không được tự approve/reject đề do mình tạo.

Khóa chỉ thu hồi quyền Console; xóa thành viên chỉ gỡ quyền nội bộ, giữ tài khoản/dữ liệu học. Employee legacy tự ánh xạ vào nhóm tạo đề. UI có tìm tên/email, lọc nhóm/trạng thái, phân trang, dialog thêm/sửa và xác nhận xóa; dữ liệu stale trả `STAFF_CONFLICT` cần làm mới. Xem contract chi tiết trong `docs/API_ROLE_WORKFLOWS.md`.

Các key bản dịch mới thuộc `src/i18n/staffTranslations.js` (prefix `staff`, đầy đủ EN/VI), được ghép vào `translations.js`. Kiểm tra trong `npm test`: `consolePermissions.test.js`, `adminStaff.test.js`.


### Gỡ quản trị gói Pro (2026-10-27)

Console không còn menu/trang `/console/subscriptions`, API wrapper hoặc quyền cấp/thu hồi Pro thủ công. Ma trận quyền nhân viên chỉ giữ các chức năng hiện có: tổng quan, quản lý nhân viên/đề thi, xét duyệt, lịch sử duyệt, đơn hàng và doanh thu. Người học vẫn mua Pro qua PayOS và sử dụng AI theo entitlement từ backend; subscription hiện có không bị xóa.

## Mật khẩu Console (2026-10-27)

`/console/forgot-password` yêu cầu link qua email; `/console/reset-password` nhận token qua fragment, xóa fragment sau khi đọc. Link có hạn 1 giờ, dùng một lần. `/console/change-password` bắt buộc đổi mật khẩu tạm (hạn 24 giờ); backend cũng chặn các API khác. Cả Admin và Employee có `/console/profile` với dialog mật khẩu cũ/mới/xác nhận. Đổi thành công thu hồi tất cả phiên và yêu cầu đăng nhập lại. Gọi qua `src/api/staffPasswords.js`, giữ session + CSRF từ client chung. Mọi key mới có EN/VI trong staffTranslations.
