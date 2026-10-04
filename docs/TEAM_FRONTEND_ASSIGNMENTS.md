# Quy định làm việc nhóm Frontend

Tài liệu này là quy ước bắt buộc dành cho tất cả thành viên làm frontend. Mục tiêu là để nhiều người có thể làm song song mà không làm hỏng luồng thi, nhận xét bằng AI, xác thực hoặc code của thành viên khác.

## 1. Nguyên tắc bắt buộc

1. Không commit hoặc push trực tiếp vào `main`.
2. Mỗi công việc phải được thực hiện trên một branch riêng và đưa vào `main` bằng pull request (PR).
3. Mỗi thành viên chỉ sửa file thuộc phạm vi được giao.
4. Không tự ý sửa API contract, logic phân quyền, luồng thi hoặc luồng AI để làm cho giao diện “chạy tạm”.
5. Không merge PR khi lint, test hoặc build thất bại.
6. Không đưa secret, token, tài khoản kiểm thử hoặc file `.env.local` lên Git.
7. Không dùng `git add .` một cách máy móc. Phải kiểm tra từng file trước khi commit.
8. Nếu công việc bắt buộc phải chạm file dùng chung hoặc file bị khóa, dừng lại và báo trưởng nhóm trước khi sửa.

## 2. Điểm bắt đầu chung

Trước khi tạo branch mới:

```bash
git switch main
git pull --ff-only origin main
git status
```

`git status` phải sạch. Sau đó mới tạo branch:

```bash
git switch -c feature/m1-auth-routing
```

Từ thư mục `frontend/`:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Không commit `.env.local`. Giá trị `VITE_API_BASE_URL` do trưởng nhóm cung cấp hoặc dùng backend được ghi trong `frontend/README.md`.

## 3. Phân quyền sở hữu code

### Member 1 — Authentication, routing và UI dùng chung

Được sửa:

- `src/auth/**`
- `src/layouts/**`
- `src/components/ui/**`
- `src/pages/public/**`
- `src/pages/auth/**`
- `src/pages/errors/**`
- `src/App.jsx`

Nhiệm vụ chính:

- Hoàn thiện Firebase session và tải profile bằng `GET /api/me`.
- Cài đặt route guard theo role `USER`, `EMPLOYEE`, `ADMIN`.
- Xây layout và component UI dùng chung.
- Là người duy nhất ghép route cuối cùng vào `src/App.jsx`.
- Giữ nguyên đầy đủ các route `/full-test/**` hiện có khi tích hợp route mới.

Không được sửa:

- Các page và component của Member 2, 3, 4.
- Luồng làm bài, kết quả, review và AI được liệt kê tại mục 4.
- Backend hoặc AI service.

### Member 2 — Người học, dashboard và lịch sử

Được sửa:

- `src/pages/user/**`
- `src/components/user/**`
- `src/components/tests/**`
- `src/api/userLearning.js`

Nhiệm vụ chính:

- Dashboard người học.
- Hồ sơ người dùng.
- Danh sách và bộ lọc đề thi.
- Lịch sử, thống kê và xóa lượt làm bài.
- Điều hướng người dùng vào các route thi hiện có, không viết lại luồng thi.

Không được sửa:

- `src/App.jsx`; gửi danh sách route cần thêm cho Member 1.
- `src/pages/Welcome.jsx`, `src/components/TestCard.jsx`, `src/components/TestList.jsx` để “vá” giao diện cũ.
- Các file thi, review và AI tại mục 4.
- File của Member 1, 3 hoặc 4.

### Member 3 — Employee và quản lý đề TOEIC

Được sửa:

- `src/pages/employee/**`
- `src/components/test-editor/**`
- `src/api/employeeTests.js`

Nhiệm vụ chính:

- Danh sách đề của Employee.
- Tạo, sửa, xóa và preview đề.
- Hiển thị lỗi validation trước khi gửi duyệt.
- Upload media bằng `FormData`.
- Gửi đề sang trạng thái `PENDING_REVIEW`.

Quy tắc API:

- Dùng `apiFetch`; không tự viết lại logic Firebase token.
- Khi upload, truyền `FormData` trực tiếp và không tự đặt header `Content-Type`. Trình duyệt phải tự tạo multipart boundary.
- Không gửi hoặc tin cậy các trường do server quản lý như `createdBy`, `status` và review metadata.

Không được sửa:

- `src/api/client.js`, kể cả khi đang xử lý upload.
- `src/App.jsx`; gửi route cần thêm cho Member 1.
- Logic làm bài để phù hợp với cấu trúc đề đang tạo.
- File của Member 1, 2 hoặc 4.

### Member 4 — Admin review workflow và subscription Pro

Được sửa:

- `src/pages/admin/**`
- `src/components/admin/**`
- `src/api/adminReviews.js`
- `src/api/adminSubscriptions.js` và `src/api/adminSubscriptions.test.js`
- Trang Pro: `src/pages/admin/SubscriptionManagementPage.jsx`, helper `subscriptionManagement.js` và `subscriptionManagement.test.js`.

Nhiệm vụ chính:

- Hàng đợi đề chờ duyệt.
- Trang xem chi tiết nội dung cần duyệt.
- Approve, reject và nhập lý do reject.
- Lịch sử duyệt.
- Quản lý Pro tại `/console/subscriptions`: tra UID, kích hoạt/gia hạn với body chỉ `expiresAt`, xác nhận thu hồi; dùng summary server để hiển thị hiệu lực. Route chỉ cho `ADMIN`, điều hướng subscription chỉ xuất hiện cho admin.
- Wrapper subscription dùng `apiFetch`, encode UID và xử lý status/code; không tự lấy token, suy luận quyền từ expiry trên trình duyệt hoặc gửi audit actor.
- Xử lý đúng `401`, `403`, `404` và `409` từ backend.

Không được sửa:

- Nội dung đề để làm cho thao tác duyệt thành công.
- `src/App.jsx`; gửi route cần thêm cho Member 1.
- Logic Employee, người học, làm bài hoặc AI.
- File của Member 1, 2 hoặc 3.

## 4. File lõi bị khóa

Các file sau thuộc trưởng nhóm/người phụ trách backend và exam flow. Thành viên frontend không được sửa nếu chưa có xác nhận rõ ràng trong issue hoặc PR:

### Luồng thi chính

- `src/pages/FullTestExam.jsx`
- `src/pages/FullTestIntro.jsx`
- `src/pages/FullTestResult.jsx`
- `src/pages/FullTestReview.jsx`
- `src/components/ExamHeader.jsx`
- `src/components/ExamModeCard.jsx`
- `src/components/ExamNavigationBar.jsx`
- `src/components/LockedExamAudio.jsx`
- `src/components/PassagePanel.jsx`
- `src/components/QuestionCard.jsx`
- `src/components/QuestionNavigatorDrawer.jsx`
- `src/components/ResizableExamLayout.jsx`
- `src/components/ReviewTogglePanel.jsx`
- `src/config/examTiming.js`
- `src/utils/reviewContent.js`
- `src/utils/testData.js`

### Nhận xét bằng AI

- `src/api/aiJobs.js`
- `src/hooks/useAIExplanationJobs.js`
- `src/components/AIExplanationPanel.jsx`

### Hạ tầng dùng chung

- `src/api/client.js`
- `src/firebase.js`
- `src/main.jsx`
- `vite.config.js`
- `package.json`
- `package-lock.json`
- Mọi file trong `backend/**`
- Mọi file trong `ai-service/**`

Nếu phát hiện lỗi trong các file này, tạo issue hoặc mô tả trong PR gồm: cách tái hiện, kết quả mong đợi, kết quả thực tế, ảnh chụp và log lỗi đã loại bỏ token/dữ liệu nhạy cảm. Không tự sửa ngoài phạm vi.

## 5. File dùng chung có nguy cơ conflict

### Tích hợp Pro: route, điều hướng và profile

Member 4 sở hữu page/helper/API/test subscription nêu trên. Member 1 tích hợp route `/console/subscriptions` trong `src/App.jsx` và liên kết admin trong `src/layouts/ManagementLayout.jsx`; giữ guard role và mọi route `/full-test/**`. Thay đổi `src/auth/**` để dùng summary `GET /api/me.subscription` thuộc Member 1. Thành viên khác cần phối hợp owner trước khi sửa các file này.

Các file review/AI trong mục 4 vẫn bị khóa, gồm `src/pages/FullTestReview.jsx`; việc hiển thị `PRO_REQUIRED` và giữ khả năng đọc kết quả sau expiry thuộc trưởng nhóm/người phụ trách AI. API client, auth infrastructure, backend và AI service không thuộc quyền sửa của Member 4. Entitlement `AI_CHAT` không có nghĩa là chat hoặc thanh toán đã triển khai.

### `src/i18n/translations.js`

Thành viên được thêm bản dịch cần thiết cho màn hình của mình, nhưng phải tuân thủ:

- Chỉ thêm key mới; không đổi tên hoặc xóa key đang tồn tại.
- Thêm đủ cả tiếng Anh và tiếng Việt trong cùng một commit.
- Tên key phải rõ nghĩa, tránh các tên chung như `title`, `submit`, `error`.
- Khi PR có sửa file này, ghi rõ danh sách key mới trong mô tả PR.

Ví dụ: `employeeCreateTestTitle`, `adminRejectReasonRequired`.

### `src/index.css`

Ưu tiên Tailwind class tại component. Không thêm CSS global nếu chưa trao đổi với Member 1. Tuyệt đối không thay đổi selector global như `body`, `button`, `input` chỉ để sửa một màn hình.

### Dependency

Không chạy `npm install <package>` và không sửa `package.json`/`package-lock.json` nếu chưa được trưởng nhóm đồng ý. Khi đề xuất package mới, phải nêu:

- Package giải quyết vấn đề gì.
- Vì sao code hiện tại không đủ.
- Kích thước/rủi ro bảo trì.
- License và link tài liệu chính thức.

## 6. Quy tắc bảo vệ nghiệp vụ thi và AI

Các bất biến sau không được thay đổi bởi công việc frontend:

- Không hiển thị đáp án đúng trước khi người dùng nộp bài.
- Listening đã bị khóa thì không cho sửa đáp án bằng state hoặc UI workaround.
- Thời gian thi lấy theo dữ liệu attempt/server; không tự tạo timer nghiệp vụ mới ở dashboard.
- Không bỏ autosave, xác nhận submit hoặc xử lý attempt đã hoàn thành.
- Không gọi AI trước khi vào review và không gửi thêm dữ liệu người dùng ngoài payload đã định nghĩa.
- Không đổi polling interval, timeout, trạng thái AI job hoặc response shape.
- Không giả lập role bằng local storage hoặc frontend state. Role từ `GET /api/me` và backend là nguồn quyết định.
- Không bỏ qua `401/403` bằng cách mở route hoặc ẩn lỗi.

## 7. Quy ước gọi API

- API public dùng `publicApiFetch`.
- API cần đăng nhập dùng `apiFetch`.
- API theo nghiệp vụ phải được bọc trong file của member, ví dụ `userLearning.js`, `employeeTests.js`, `adminReviews.js`.
- Page/component không tự lấy Firebase token và không tự tạo header `Authorization`.
- Không dùng `fetch` trực tiếp trong page mới.
- Không so khớp nội dung message tiếng Việt để xử lý lỗi. Dùng HTTP status và trường `code` ổn định.
- ID đưa vào URL phải dùng `encodeURIComponent` khi có khả năng chứa ký tự đặc biệt.
- Không `console.log` token, payload nhạy cảm hoặc toàn bộ profile/attempt response.

Ví dụ wrapper:

```js
import { apiFetch } from "./client";

export function getEmployeeTests() {
  return apiFetch("/api/employee/tests");
}
```

## 8. Cách viết React code

### Component

- Dùng function component và React hooks.
- Một component chỉ nên có một trách nhiệm chính.
- Page chịu trách nhiệm phối hợp dữ liệu; component con nhận dữ liệu và callback qua props.
- Không sao chép component của member khác sang thư mục của mình chỉ để đổi vài class.
- Button trong form phải ghi rõ `type="button"` hoặc `type="submit"`.
- Input phải có label; icon button phải có `aria-label`.
- Mọi màn hình gọi API phải có loading, empty, error và success state phù hợp.
- Chặn double submit bằng trạng thái `submitting`/`loading`.

### State và side effect

- Không lưu dữ liệu có thể tính từ props/state thành một state thứ hai nếu không cần thiết.
- `useEffect` gọi API phải xử lý việc component unmount hoặc request cũ hoàn thành muộn.
- Không đặt object/array mới tạo trực tiếp vào dependency list nếu khiến effect chạy lặp vô hạn.
- Không che lỗi bằng `catch {}` rỗng.
- Error hiển thị cho người dùng phải dễ hiểu; log kỹ thuật không được chứa thông tin nhạy cảm.

### Styling

- Ưu tiên Tailwind và các component trong `src/components/ui/**`.
- Giữ phong cách, spacing, màu sắc và responsive behavior nhất quán với layout chung.
- Kiểm tra ít nhất ở mobile và desktop.
- Không dùng inline style trừ giá trị thực sự được tính động.

### Naming

- React component/page: `PascalCase.jsx`.
- Hook: `useSomething.js`.
- Hàm và biến: `camelCase`.
- Constant dùng chung: `UPPER_SNAKE_CASE`.
- Handler: `handleSave`, `handleSubmit`; callback prop: `onSave`, `onSubmit`.
- Không dùng tên mơ hồ như `data2`, `temp`, `handleThing` hoặc `abc`.

## 9. Quy ước đặt tên branch

Format:

```text
<type>/m<member-number>-<mo-ta-ngan-gon>
```

Type được phép:

- `feature`: tính năng mới.
- `fix`: sửa lỗi.
- `refactor`: cải tổ code nhưng không đổi nghiệp vụ.
- `test`: bổ sung test.
- `docs`: tài liệu.
- `chore`: công việc cấu hình/bảo trì đã được duyệt.

Quy tắc:

- Chỉ dùng chữ thường, số và dấu gạch ngang.
- Không dùng dấu tiếng Việt, dấu cách, tên cá nhân hoặc tên chung như `update`, `frontend`.
- Một branch chỉ giải quyết một đầu việc.
- Luôn tạo branch từ `main` mới nhất, không tạo từ branch của thành viên khác.

Ví dụ tốt:

```text
feature/m1-role-protected-routes
feature/m2-attempt-history
feature/m3-test-media-upload
feature/m4-review-queue
fix/m2-empty-attempt-state
test/m3-test-editor-validation
```

Ví dụ không được dùng:

```text
sunny-code
frontend
update-new
member2
feature/dashboard-and-admin-and-fix-test
```

## 10. Quy ước commit

Format:

```text
<type>(<scope>): <mô tả ngắn ở thể chủ động>
```

Type: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`.

Scope khuyến nghị: `auth`, `routing`, `ui`, `user`, `employee`, `admin`, `tests`, `i18n`, `docs`.

Ví dụ:

```text
feat(auth): add role-based protected routes
feat(user): add attempt history empty state
feat(employee): implement test media upload
fix(admin): handle repeated review conflict
test(employee): cover test validation summary
docs(frontend): clarify pull request workflow
```

Không dùng commit message như:

```text
update
fix bug
done
code moi
final final
```

Mỗi commit phải là một thay đổi logic có thể review. Không trộn format toàn dự án, tính năng mới và sửa lỗi không liên quan trong cùng commit.

Trước khi commit:

```bash
git status
git diff
git add frontend/src/pages/user frontend/src/components/user
git diff --cached
git commit -m "feat(user): add attempt history page"
```

Chỉ stage đúng file thuộc ownership của mình.

## 11. Đồng bộ branch và xử lý conflict

Trước khi mở hoặc cập nhật PR:

```bash
git fetch origin
git merge origin/main
```

Nếu có conflict:

1. Không chọn “accept all current/incoming”.
2. Đọc cả hai phía và xác định file thuộc owner nào.
3. Nếu conflict nằm trong `App.jsx`, báo Member 1.
4. Nếu conflict nằm trong file lõi bị khóa, báo trưởng nhóm.
5. Sau khi resolve, chạy lại lint, test và build.

Không dùng force push lên branch đã có người khác cùng làm nếu chưa trao đổi. Tuyệt đối không force push `main`.

## 12. Checklist trước khi push

Từ `frontend/`:

```bash
npm run lint
npm test
npm run build
```

Sau đó kiểm tra:

- [ ] Chỉ sửa file thuộc ownership.
- [ ] Không có `.env`, secret, token, `dist/`, `node_modules/` hoặc `.DS_Store`.
- [ ] Không có `console.log` tạm.
- [ ] Có loading, empty và error state.
- [ ] Đã kiểm tra role phù hợp.
- [ ] Đã kiểm tra mobile và desktop.
- [ ] Không làm thay đổi route thi/AI.
- [ ] Lint, test và build đều thành công.

Push branch:

```bash
git push -u origin feature/m2-attempt-history
```

## 13. Quy định pull request

Tiêu đề PR dùng cùng format với commit:

```text
feat(user): add attempt history page
```

Mô tả PR phải có:

```markdown
## Mục tiêu
Mô tả ngắn yêu cầu cần hoàn thành.

## Thay đổi
- Các màn hình/component đã thêm hoặc sửa.
- API endpoint đã sử dụng.
- Translation key hoặc file dùng chung đã chạm tới.

## Cách kiểm thử
1. Đăng nhập bằng role ...
2. Mở route ...
3. Thực hiện ...
4. Kết quả mong đợi ...

## Bằng chứng
- Ảnh desktop.
- Ảnh mobile.
- Kết quả lint/test/build.

## Ảnh hưởng nghiệp vụ lõi
- [ ] Không sửa luồng thi.
- [ ] Không sửa luồng AI.
- [ ] Không sửa API client/auth contract ngoài phạm vi.
```

PR không được merge khi:

- Có file ngoài ownership mà chưa được chấp thuận.
- Có conflict chưa xử lý.
- CI/lint/test/build thất bại.
- Thiếu cách kiểm thử hoặc bằng chứng giao diện.
- Tự thay đổi API contract hay dùng dữ liệu mock để che lỗi backend.
- PR quá lớn và chứa nhiều đầu việc không liên quan.

## 14. Khi cần thay đổi ngoài phạm vi

Thành viên tạo issue hoặc nhắn trưởng nhóm theo mẫu:

```text
File cần thay đổi:
Lý do:
Nghiệp vụ bị ảnh hưởng:
Giải pháp đề xuất:
Phương án không sửa file dùng chung đã thử:
```

Chỉ bắt đầu sửa sau khi trưởng nhóm xác nhận owner và hướng xử lý. Nếu được duyệt, commit thay đổi file dùng chung riêng với commit tính năng để việc review và rollback rõ ràng.

## 15. Definition of Done

Một đầu việc chỉ được xem là hoàn thành khi:

- Đúng acceptance criteria trong issue.
- Đúng ownership và không làm hỏng nghiệp vụ lõi.
- Giao diện usable trên mobile và desktop.
- Loading, empty, error và permission state được xử lý.
- Không lộ đáp án, token hoặc dữ liệu nhạy cảm.
- Lint, test và build thành công.
- PR được review và merge theo repository rules.
- Branch sau khi merge không được tái sử dụng cho công việc mới.
