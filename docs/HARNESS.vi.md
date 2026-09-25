# Harness Bob cho LMS

Bộ này được chuyển từ repo chuẩn bị của đội, rồi điều chỉnh cho Angular/Java.
AGENTS.md giữ quy tắc ngắn; PRD giữ yêu cầu; WORKSTATE giữ tiến độ. Tám skill
được nạp theo công việc; không cần nạp tất cả tài liệu lịch sử cùng một lúc.

- SessionStart in trạng thái Git và tối đa 1.800 ký tự WORKSTATE.
- Stop kiểm tra cấu hình, ghi báo cáo local `.tools/harness/last-stop.json`.
- Pre-commit kiểm tra nội dung staged: JSON, context, đường dẫn riêng và whitespace.
- Cho phép `.env.example` và `.env.<name>.example`; vẫn chặn `.env` thật. Đây là
  kiểm tra tên file, không phải công cụ dò mọi bí mật trong nội dung.
- `Install-Harness.ps1` chỉ cài pre-commit trong clone độc lập, giữ các hook Git LFS
  và hook khác. Nếu đã có pre-commit khác, script dừng để tích hợp có chủ đích.

Chạy `node scripts/harness.cjs check` và `node --test scripts/harness.test.cjs`.
Harness không chạy test sản phẩm, không tự commit/push, không tạo ảnh Bob summary.
Hook Stop không ngăn Bob kết thúc task; báo cáo không chứng minh app đạt nghiệm thu.
Các hook dùng Node Windows được ghim trong `.tools`; mở Bob ở gốc repo.
Việc đã kiểm tra command không đồng nghĩa hook đã được Bob kích hoạt trong task thật.

Các giới hạn và cách cài cho đồng đội: [BOB-SETUP.md](BOB-SETUP.md).
Git ignore đã mở ngoại lệ PNG trong `bob_sessions/`; chỉ lưu ảnh thật đã rà dữ liệu.

Nguồn thiết kế: [Claude Code trong codebase lớn](https://claude.com/blog/how-claude-code-works-in-large-codebases-best-practices-and-where-to-start),
[IBM lifecycle hooks](https://bob.ibm.com/docs/ide/configuration/lifecycle-hooks),
[IBM skills](https://bob.ibm.com/docs/ide/features/skills).
Đây là cách áp dụng vào Bob; không giả định cấu hình Claude tự tương thích.
