# Chuẩn viết Use Case — ToeicPracticeWeb

Tài liệu này định nghĩa format nội dung một file Use Case. Quy ước module, mã UC/BR/OQ và vòng đời mã nằm trong [CONVENTIONS.md](./CONVENTIONS.md).

## 1. Vị trí và tên file

Use Case nằm trong `docs/usecase_spec/<module>/use-cases/`.

`<MODULE>-UC-<NNN>_<slug>.md`

Ví dụ: `AUTH-UC-001_dang-ky.md`.

Sơ đồ nguồn gắn với UC có thể đặt cạnh file hoặc trong thư mục `diagrams/` cùng module:

```text
diagrams/
  AUTH-UC-001_activity.act
  AUTH-UC-001_sequence.seq
```

Tên file sơ đồ phải chứa đúng mã UC và loại sơ đồ để công cụ có thể ghép đầu ra.

## 2. Cấu trúc file bắt buộc

```markdown
### AUTH-UC-001_Đăng ký tài khoản

### Mô tả use case AUTH-UC-001

| Trường | Nội dung |
|---|---|
| Use case: | AUTH-UC-001_Đăng ký tài khoản |
| Mục đích: | ... |
| Mô tả: | ... |
| Actor: | Khách (GUEST) |
| Tiền điều kiện: | ... |
| Hậu điều kiện: | ... |

### Luồng sự kiện chính

| Khách (GUEST) | Hệ thống |
|---|---|
| 1. ... | 2. ... |

### Luồng sự kiện phụ

| Khách (GUEST) | Hệ thống |
|---|---|
| 1.1. ... | 1.1.1. ... |

### Biểu đồ

Activity: `diagrams/AUTH-UC-001_activity.act`

Sequence: `diagrams/AUTH-UC-001_sequence.seq`
```

Các mục, tiêu đề và nhãn trường giữ ổn định để sau này có thể kiểm tra tự động.

## 3. Thông tin Use Case

- **Use case:** mã và tên đã đăng ký trong danh mục.
- **Mục đích:** kết quả actor muốn đạt, viết ngắn gọn.
- **Mô tả:** tóm tắt phạm vi tương tác, không chép toàn bộ rule.
- **Actor:** actor chính theo CONVENTIONS.md; nêu actor phụ hoặc dịch vụ ngoài nếu trực tiếp tham gia luồng. Tên cột luồng sự kiện phải khớp actor chính; mẫu đăng ký ở trên dùng Khách (`GUEST`).
- **Tiền điều kiện:** điều kiện phải đúng trước khi bắt đầu UC, ví dụ đã đăng nhập để bắt đầu lượt làm bài hoặc có quyền xét duyệt đề.
- **Hậu điều kiện:** kết quả nghiệp vụ sau khi luồng thành công. Trạng thái lượt làm bài, đề thi hoặc tác vụ AI chỉ ghi theo contract đã xác nhận; không giả định trạng thái còn đang mở OQ.

Nếu tiền điều kiện hoặc hậu điều kiện gồm nhiều ý, đặt mỗi ý trên một dòng riêng và ngăn cách trong Markdown bằng `<br>`. Không thêm ký hiệu bullet hoặc dấu chấm ở cuối dòng. Không để OQ chưa chốt thành điều kiện được khẳng định.

## 4. Luồng sự kiện chính

- Dùng bảng hai cột: actor chính và `Hệ thống`.
- Đánh số các bước chính liên tục bắt đầu từ 1. Số thứ tự bước mô tả diễn tiến, không phải mã UC.
- Mỗi ô nên nêu một hành động hoặc phản hồi rõ ràng, thường tối đa 1–2 câu.
- Hành động của actor bắt đầu bằng động từ: “Chọn…”, “Nhập…”, “Xác nhận…”.
- Hệ thống nêu kết quả actor quan sát được và thay đổi nghiệp vụ cần thiết.
- Luồng chính đi tới hậu điều kiện của UC; không bỏ qua kết quả thành công.
- Nếu một hành động chỉ được phép sau xác thực, thể hiện điều kiện đăng nhập theo rule chung và luồng thay thế phù hợp.

## 5. Luồng thay thế và ngoại lệ

- Dùng cho nhánh phát sinh từ luồng chính, ví dụ dữ liệu không hợp lệ, danh mục đề trống, lỗi xác thực/phân quyền, lượt làm bài không thuộc sở hữu, đơn vị Listening đã khóa, lượt làm bài đã nộp, lỗi AI hoặc lỗi mạng khi thuộc phạm vi rule đã chốt. Chỉ mô tả xử lý yêu cầu gửi lặp theo contract tương ứng.
- Đánh số nhánh theo bước rẽ: `N.1`, `N.2`; các bước tiếp theo trong nhánh dùng `N.1.1`, `N.1.2`.
- Bước đầu nhánh ghi rõ điều kiện và hành động/phản hồi; không để một dòng “Nếu…” trơ trọi mà không có kết quả.
- Nêu nhánh kết thúc UC, quay lại bước nào, hoặc giữ trạng thái chờ nếu đã có rule xác nhận.
- Không tự đặt hành vi cho tình huống đang là OQ. Ghi tình huống trong README của module/feature sở hữu dưới dạng câu hỏi mở cho tới khi được quyết định.

## 6. Tham chiếu business rule và UC

- Dùng cú pháp `{{ref: BR-AUTH-001}}`, `{{ref: BR-TOEIC-001}}` hoặc `{{ref: ATT-UC-001}}` ở cuối câu/ô cần truy vết.
- Chỉ tham chiếu mã đã được định nghĩa và đăng ký.
- Tham chiếu là truy vết, không thay thế nội dung bước cần thiết để hiểu luồng.
- Không chép công thức, điều kiện chi tiết hoặc danh sách lựa chọn từ `rules.md` sang UC; diễn đạt hành vi liên quan và gắn tham chiếu.
- Không để mã lịch sử hoặc ghi chú chỉnh sửa trong nội dung chuẩn của Use Case.

## 7. Activity và Sequence

### Activity

- File nguồn `.act` mô tả luồng actor/hệ thống, các quyết định, nhánh lỗi và điểm kết thúc.
- Activity dùng đúng hai swimlane mặc định: actor chính của UC (Khách, Người học, Nhân viên hoặc Quản trị viên) và `Hệ thống`. Gộp xử lý ứng dụng, backend, cơ sở dữ liệu và service nội bộ vào lane `Hệ thống`; không tạo lane riêng cho từng tầng kỹ thuật. Dịch vụ ngoài liên quan có thể là participant trong Sequence; không tách thành lane Activity.
- Mọi quyết định trong sơ đồ phải tương ứng với một nhánh trong UC hoặc một rule đã chốt.

### Sequence

- File nguồn `.seq` mô tả thông điệp theo thời gian giữa actor và các thành phần cần thiết.
- Dùng đúng ý nghĩa participant của ToeicPracticeWeb: `actor` cho người dùng theo vai trò/dịch vụ ngoài; `boundary` cho giao diện người dùng; `control` cho service xử lý nghiệp vụ; `entity` cho DAO/repository truy cập dữ liệu. Không đặt trực tiếp Firestore hoặc entity nghiệp vụ vào vị trí DAO.
- Thể hiện actor chính, giao diện (`boundary`), service (`control`) và DAO/repository (`entity`) có liên quan. Dịch vụ ngoài trực tiếp tham gia luồng có thể xuất hiện như actor. DAO/repository đại diện cho tương tác lưu trữ; không cần thêm Firestore thành một participant riêng trong sequence nghiệp vụ.
- Với luồng AI bất đồng bộ, thể hiện yêu cầu của người dùng và quá trình nhận kết quả theo contract của chức năng tương ứng. Không mô tả nộp bài tự động gọi phân tích AI; phân tích toàn bài chỉ được yêu cầu với lượt làm bài full đã hoàn thành và thuộc sở hữu.
- Không đưa chi tiết class, hàm nội bộ hoặc endpoint chưa được thống nhất vào sơ đồ nghiệp vụ. Chi tiết hợp đồng API theo [API_ROLE_WORKFLOWS.md](../archive/API_ROLE_WORKFLOWS.md) hiện hành.

## 8. Nguyên tắc nghiệp vụ và phạm vi

- Chỉ mô tả phạm vi ToeicPracticeWeb theo các tài liệu nguồn trong [README.md](./README.md); không dùng đặc tả để sửa contract hiện hành.
- Giữ quyền sở hữu lượt làm bài, thời gian/deadline từ server, khóa Listening, autosave, xác nhận nộp, chấm điểm và nộp bài idempotent.
- Không tiết lộ đáp án, giải thích, bản dịch hoặc transcript trước thời điểm bài thi/đơn vị luyện tập cho phép.
- Giữ workflow biên soạn/xét duyệt đề và điều kiện công khai; không suy ra quyền từ frontend hoặc dữ liệu do actor tự gửi.
- Giữ điều kiện quyền và trạng thái riêng của từng chức năng AI; phân tích toàn bài phải do người dùng chủ động yêu cầu, xử lý bất đồng bộ, idempotent và lưu kết quả trước khi phát thông báo. Không bịa số liệu hay metadata AI chưa có.
- Chỉ ghi rule đã xác nhận. Thời lượng, công thức điểm, điều kiện mở review, quota AI hoặc chính sách Pro chưa có nguồn phải tiếp tục là OQ.
- Nội dung Use Case tập trung vào hành vi nghiệp vụ; bố cục UI và chi tiết cài đặt không đưa vào đây.

## 9. Checklist rà soát UC

- [ ] UC có một mục tiêu actor rõ và có trong danh mục module.
- [ ] Tiền điều kiện, luồng chính và hậu điều kiện nhất quán.
- [ ] Bước actor bắt đầu bằng hành động; phản hồi hệ thống dễ hiểu.
- [ ] Các nhánh ngoại lệ có điều kiện, kết quả và điểm tiếp tục/kết thúc.
- [ ] Business rule được định nghĩa ở nguồn chính và mã tham chiếu hợp lệ.
- [ ] Không biến OQ thành hành vi đã chốt.
- [ ] Activity và Sequence phản ánh cùng luồng/nhánh trong UC.
- [ ] Không đưa chức năng ngoài phạm vi TOEIC đã xác nhận vào đặc tả.
