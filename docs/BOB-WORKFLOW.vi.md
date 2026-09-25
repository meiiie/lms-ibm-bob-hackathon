# Bắt đầu với Bob trong fork LMS

1. Mở gốc repo chứa AGENTS.md, `.bob/`, `fe/`, `backend/`. Dùng `scripts/Open-Bob.ps1`.
2. Xác nhận Workspace Trust, tài khoản, instance hackathon và quota. Kiểm tra 8 skill
   và 3 mode trong Settings; reload cửa sổ sau khi lưu công việc nếu cần.
3. Chọn **Plan**, dán prompt tại [BOB-START-PROMPT.md](BOB-START-PROMPT.md).
   Mục tiêu là chốt một cải tiến developer workflow có bằng chứng.
4. Khi đã chốt, dùng **Hackathon Build** hoặc **Agent** để triển khai. Yêu cầu dùng
   Ponytail, giữ stack hiện có, kiểm thử đúng phần đổi và cập nhật PRD/WORKSTATE.
5. Dùng task **Hackathon Verify** riêng cho phần tích hợp quan trọng; cuối cùng
   **Hackathon Ship** để chuẩn bị README, demo và kiểm tra thiếu tài liệu.
6. Mỗi thành viên chụp summary các task thật vào `bob_sessions/`, cập nhật manifest.

LMS không có dependency Neko Core trong phạm vi đã kiểm tra; Neko Core là tên đội.
Không ghi phần LMS có sẵn hoặc setup Codex thành tính năng Bob mới làm trong 48 giờ.
Hướng dẫn cài, lệnh chạy/test và cách chia việc bằng tiếng Anh cho đồng đội:
[BOB-SETUP.md](BOB-SETUP.md). Hạn nộp 27/09/2026 22:00 Việt Nam (UTC+7),
mục tiêu nội bộ 20:00 cùng ngày.
