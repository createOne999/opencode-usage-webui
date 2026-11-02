# Bảng điều khiển sử dụng OpenCode

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

Bảng điều khiển web cục bộ gọn nhẹ dành cho **OpenCode V2**, giúp bạn khám phá mức sử dụng token, chi phí mô hình, hiệu suất công cụ và ngữ cảnh phiên theo từng yêu cầu ngay trên trình duyệt.

Chạy **`/usage-dashboard`** trong OpenCode Mini hoặc TUI đầy đủ để mở bảng điều khiển bất cứ lúc nào. Bảng chạy trong tiến trình plugin OpenCode, không cần cơ sở dữ liệu hay dịch vụ nền bổ sung.

![OpenCode Usage Dashboard](screenshot.png)

## Nội dung có thể khám phá

- **Tổng quan (`/stats`):** Tổng token, chi phí USD đã ghi nhận, số phiên, Steps mô hình, hoạt động hằng ngày, phân tích token và xu hướng token theo ngày khi cần.
- **Mô hình (`/models`):** Biểu đồ và bảng token, chi phí theo nhà cung cấp, mô hình và variant—có thể sắp xếp theo token, chi phí, Steps hoặc tên mô hình.
- **Công cụ (`/tools`):** Số lần gọi, số lần thành công/thất bại/chưa hoàn tất và thời gian thực thi trung vị (`P50`) của từng công cụ.
- **Phiên và ngữ cảnh yêu cầu (`/sessions`):** Tìm phiên theo tiêu đề, chuyển giữa phiên cha và phiên con, xem dòng thời gian token và chi phí theo yêu cầu, cũng như lịch sử đã lưu dẫn đến bất kỳ Step nào được chọn.

## Bắt đầu nhanh

Thêm plugin vào `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/opencode-usage-webui#release"]
}
```

Sau đó chạy **`/usage-dashboard`** trong OpenCode để mở bảng điều khiển bằng trình duyệt mặc định, hoặc truy cập trực tiếp <http://127.0.0.1:7331/stats> (`http://localhost:7331/stats` và `http://[::1]:7331/stats` cũng hoạt động).

### Tùy chỉnh cổng

Cổng mặc định là `7331`. Nếu chạy nhiều dự án cùng lúc hoặc muốn dùng cổng khác, hãy đặt `options.port` (dùng `0` để tự động chọn một cổng khả dụng):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/opencode-usage-webui#release", "options": { "port": 7332 } }
  ]
}
```

## Sử dụng bảng điều khiển

- **Bộ lọc ngày và dự án:** Mặc định là tháng hiện tại và dự án hiện tại theo múi giờ trình duyệt (bao gồm cả ngày kết thúc). Bạn có thể chuyển sang **Tất cả dự án** hoặc bất kỳ dự án cụ thể nào bất cứ lúc nào.
- **Giao diện đa ngôn ngữ:** Đổi ngôn ngữ bằng bộ chọn phía trên. Ngôn ngữ đã chọn (`?lang=...`), khoảng ngày, bộ lọc dự án và liên kết yêu cầu đang chọn được lưu trong URL để bạn dễ dàng đánh dấu trang hoặc tải lại bất kỳ chế độ xem nào.
- **Phân tích token hằng ngày:** Trên trang Tổng quan, nhấp **Tải token hằng ngày** để xem biểu đồ token đầu vào, đầu ra, lập luận và đọc/ghi bộ nhớ đệm theo từng ngày trong khoảng thời gian đã chọn.
- **Kiểm tra ngữ cảnh yêu cầu:**
  1. Mở **Phiên / yêu cầu** và chọn một phiên (dùng nhãn hoặc mục **Phiên con** để chuyển giữa các phiên tác tử con có liên quan).
  2. Nhấp vào một điểm trên biểu đồ yêu cầu hoặc dấu thời gian trong bảng yêu cầu.
  3. Duyệt **Lịch sử đã lưu trước yêu cầu** (bao gồm lời nhắc của người dùng, phản hồi trước đó, lần gọi công cụ, kỹ năng và tóm tắt nén ngữ cảnh) bên cạnh **Phản hồi cho yêu cầu đã chọn**.
  4. Dùng **Tải thêm 100 mục lịch sử** bất cứ khi nào bạn muốn xem các tin nhắn cũ hơn trong phiên dài.

### Ghi chú hữu ích về chỉ số

- **Số lượng token:** Hiển thị theo đơn vị rút gọn `K`, `M`, `B` và `T` (tối đa hai chữ số thập phân), trong khi việc sắp xếp và tính tổng sử dụng số chính xác. Tổng token bằng `input + output + reasoning + cache.read + cache.write`.
- **Ước tính chi phí:** Chi phí được hiển thị bằng USD, dựa trên mức sử dụng do nhà cung cấp báo cáo và giá trong danh mục mô hình để tiện tham khảo.
- **Chế độ xem ngữ cảnh đã lưu:** Trình kiểm tra yêu cầu dựng lại ngữ cảnh từ lịch sử phiên đã lưu và các mốc nén ngữ cảnh đã hoàn tất cho đến Step được chọn.

## Riêng tư và hoạt động cục bộ theo thiết kế

- **Chỉ loopback:** Chỉ liên kết với loopback cục bộ (`127.0.0.1` và `::1`) và xác thực tiêu đề cùng nguồn để dữ liệu sử dụng chỉ có thể truy cập trên máy của bạn.
- **Không lưu trữ hay đo từ xa bổ sung:** Khi cần, bảng đọc dịch vụ dùng chung OpenCode V2 đang chạy cục bộ. Toàn bộ tài nguyên giao diện và bản dịch được đóng gói cục bộ, không dùng CDN bên ngoài, công cụ phân tích hay tệp dữ liệu bổ sung. Để gỡ cài đặt, chỉ cần xóa mục plugin khỏi `opencode.json`.

## Chạy từ mã nguồn

Được xây dựng cho OpenCode **2.2.0** và Bun **1.4.2**. Chạy từ thư mục gốc kho mã:

```powershell
bun run setup
opencode mini
# Trong OpenCode: /usage-dashboard
```

Nếu bạn làm việc trong môi trường từ xa, WSL hoặc không có giao diện, nơi trình duyệt không thể tự mở, hãy kiểm tra URL bảng điều khiển đang hoạt động và trạng thái sẵn sàng từ terminal:

```powershell
bun run status
```

### Kiểm tra trong quá trình phát triển

```powershell
bun run build
bun run typecheck
bun run test
```

## Giấy phép

Được cấp phép theo MIT. Xem [LICENSE](LICENSE) để biết chi tiết.
