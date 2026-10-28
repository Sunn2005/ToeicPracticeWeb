# Hướng dẫn đặc tả Use Case từ bước 4

Tài liệu này lưu các bước 4–10 để bạn tự thực hiện tiếp. Các đoạn Markdown và sơ đồ dưới đây là nội dung mẫu để sao chép vào file tương ứng; việc tạo hướng dẫn này chưa tạo các file mẫu hoặc chạy build.

Chạy các lệnh từ thư mục gốc repository `ToeicPracticeWeb`. Đã có bộ công cụ tại `docs/tools/usecase_flow/` và các hướng dẫn nền tảng:

- [Tổng quan Use Case](usecase_spec/README.md).
- [Quy ước](usecase_spec/CONVENTIONS.md).
- [Chuẩn đặc tả](usecase_spec/STANDARD.md).

Đường dẫn tài liệu nguồn trong ví dụ đã được cập nhật theo thư mục `docs/archive/`. Các lệnh tạo thư mục và kích hoạt môi trường dùng Bash/Zsh trên macOS/Linux.

## Bước 4. Tạo danh mục Use Case

Tạo file:
docs/usecase_spec/00-module.md
Nội dung khởi đầu:

```markdown
# Đặc tả nghiệp vụ ToeicPracticeWeb

## Nguồn đối chiếu

- [API và workflow](../archive/API_ROLE_WORKFLOWS.md)
- [Nhận xét AI](../archive/AI_REVIEW.md)

## Actor

- GUEST: người chưa đăng nhập
- USER: người học đã đăng nhập
- EMPLOYEE: nhân viên quản lý nội dung đề
- ADMIN: quản trị viên

## Danh mục Use Case

| Mã | Tên | Actor chính | Trạng thái |
|---|---|---|---|
| TST-UC-001 | Xem danh sách đề thi | GUEST, USER | Bản nháp |
| ATT-UC-001 | Làm và nộp bài thi | USER | Chưa đặc tả |
| EDT-UC-001 | Soạn và gửi duyệt đề | EMPLOYEE | Chưa đặc tả |
| REV-UC-001 | Duyệt đề thi | ADMIN | Chưa đặc tả |
| AI-UC-001 | Yêu cầu nhận xét bài làm | USER | Chưa đặc tả |
```

Các mã chưa có file đặc tả chỉ là danh mục dự kiến, không có nghĩa chức năng đã được tài liệu hóa đầy đủ.

## Bước 5. Viết Use Case đầu tiên

Nên bắt đầu với xem danh sách đề thi vì luồng nhỏ, dễ kiểm tra toàn bộ quy trình.

Tạo thư mục:

```bash
mkdir -p docs/usecase_spec/test/xem-danh-sach/{use-cases,diagrams}
```

Tạo docs/usecase_spec/test/xem-danh-sach/README.md:

```markdown
# Xem danh sách đề thi

## Use Case

| Mã | Tên | Trạng thái |
|---|---|---|
| TST-UC-001 | Xem danh sách đề thi | Bản nháp |

## Nguồn đối chiếu

- docs/archive/API_ROLE_WORKFLOWS.md
- TestController và TestService trong backend

## Câu hỏi mở

- OQ-TST-001: Giao diện hiện tại xử lý danh sách rỗng và lỗi tải
  như thế nào? Cần đối chiếu trước khi chốt các nhánh này.
```

Tạo docs/usecase_spec/test/xem-danh-sach/rules.md:

```markdown
# Luật nghiệp vụ xem danh sách đề

- **BR-TST-001:** Người chưa đăng nhập được xem danh sách đề public.
- **BR-TST-002:** Danh sách public chỉ gồm đề được công bố theo
  quy tắc APPROVED trong tài liệu API; đề legacy thiếu status được
  xử lý theo quy tắc tương thích hiện có.
- **BR-TST-003:** API danh sách trả metadata, không trả nội dung parts.
```

Các rule trên lấy từ tài liệu API hiện tại. Giữ cú pháp **BR-TST-001:** vì công cụ dùng nó để nhận diện mã rule.

Tạo file:
docs/usecase_spec/test/xem-danh-sach/use-cases/TST-UC-001_xem-danh-sach-de-thi.md
Nội dung:

```markdown
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
```

Đây là bản nháp để thử công cụ. Khi xác minh được hành vi giao diện, bổ sung các nhánh phụ và cập nhật sơ đồ tương ứng.

## Bước 6. Viết hai sơ đồ

Tạo docs/usecase_spec/test/xem-danh-sach/diagrams/TST-UC-001_activity.act:

```text
title: TST-UC-001 Xem danh sách đề thi

lane U "Người học"
lane S "Hệ thống"

start st U
action a1 U "Mở trang danh sách đề thi"
action a2 S "Lấy danh sách đề được công bố"
action a3 S "Hiển thị thông tin tổng quan"
end e1 S

st -> a1
a1 -> a2
a2 -> a3
a3 -> e1
```

Tạo docs/usecase_spec/test/xem-danh-sach/diagrams/TST-UC-001_sequence.seq:

```text
title: TST-UC-001 Xem danh sách đề thi

actor u "Người học"
boundary ui "Trang danh sách đề"
control service "Dịch vụ đề thi"
entity repo "Lớp truy cập dữ liệu đề"

u -> ui : mở danh sách đề
ui -> service : yêu cầu danh sách đề công bố
service -> repo : lấy danh sách đề phù hợp
repo --> service : metadata các đề
service --> ui : trả danh sách metadata
ui --> u : hiển thị danh sách đề
```

Tên các thành phần trong ví dụ là vai trò ở mức nghiệp vụ; khi cần mô tả kiến trúc cụ thể, đối chiếu tên lớp thực tế.

## Bước 7. Chạy kiểm tra và sinh sơ đồ trước

Kiểm tra Python:

```bash
python3 --version
```

Cần Python 3.9 trở lên. Sau đó chạy:

```bash
python3 docs/tools/usecase_flow/build.py list

python3 docs/tools/usecase_flow/build.py check TST-UC-001

python3 docs/tools/usecase_flow/build.py build TST-UC-001 \
  --only diagrams --no-png
```

Bước này không cần cài thư viện Python ngoài.

Kết quả nằm tại:

```text
docs/build/usecase-flow/test/TST-UC-001/
```

Trong đó có file .drawio và .svg. Mở SVG bằng trình duyệt để xem sơ đồ; mở .drawio bằng draw.io khi cần xem trong trình biên tập.

Lệnh check chỉ kiểm tra cấu trúc và cú pháp. Bạn vẫn cần tự đọc để xác nhận nghiệp vụ đúng.

## Bước 8. Bổ sung xuất Word và PNG

[`AGENTS.md`](../AGENTS.md) của dự án có quy định: “Do not add or upgrade dependencies without the required team approval.” Vì vậy, phần cài thêm dưới đây thực hiện khi nhóm đã cho phép dùng các dependency phục vụ tài liệu.

Tạo môi trường Python riêng:

```bash
python3 -m venv .venv-docs
source .venv-docs/bin/activate
```

Cài công cụ:

```bash
python -m pip install python-docx playwright
python -m playwright install chromium
```

Xuất đầy đủ:

```bash
python docs/tools/usecase_flow/build.py build TST-UC-001
```

Thư mục đầu ra sẽ có sơ đồ draw.io, SVG, PNG và file Word của Use Case. Kiểm tra Word đã có đủ bảng và hai ảnh sơ đồ.

Không cần thêm các thư viện này vào frontend/package.json hay Maven.

## Bước 9. Quản lý bằng Git

Bổ sung vào .gitignore, tránh thêm trùng:

```gitignore
# Documentation tooling
.venv-docs/
__pycache__/

# Generated documentation
docs/build/
```

Đưa vào Git các file nguồn:

- Markdown đặc tả.
- .act và .seq.
- Script Python và template Word.

Khi cần sửa kết quả, chỉnh nguồn rồi build lại. Bản Word/PDF bàn giao có thể lưu theo quy ước riêng của nhóm.

Trước khi commit:

```bash
python3 docs/tools/usecase_flow/build.py check
git status --short
git diff --stat
git diff -- docs/usecase_spec docs/tools/usecase_flow .gitignore
```

## Bước 10. Mở rộng ra toàn dự án

Sau khi Use Case đầu tiên chạy được, làm tiếp từng nhóm chức năng:

1. Danh sách và thông tin đề thi.
2. Bắt đầu bài, lưu đáp án, nộp và xem kết quả.
3. Nhân viên soạn đề và quản trị viên duyệt đề.
4. Nhận xét AI, chat AI và thanh toán.

Riêng luồng làm bài cần mô tả kỹ thời gian do server quản lý, khóa đáp án Listening, quyền sở hữu bài và việc nộp lặp. Với AI, tài liệu hiện tại quy định người dùng chủ động yêu cầu và chỉ áp dụng nhận xét cho full attempt đã hoàn thành.

Mỗi chức năng đi theo cùng quy trình: đọc tài liệu/code hiện có → ghi rule và câu hỏi mở → viết UC → viết sơ đồ → chạy check → review → xuất tài liệu.
