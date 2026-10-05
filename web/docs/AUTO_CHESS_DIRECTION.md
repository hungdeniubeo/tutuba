# Hướng mới: hai đội đối diện

Yêu cầu mới: chơi cùng bạn, xếp đội hình và nhìn hai đội tự chiến đấu theo hướng Auto Chess. Giao diện tiếng Việt, nhẹ và chạy trong trình duyệt; tiếp tục dùng TypeScript/Three.js và luật Dư Ảnh có tính quyết định.

Đã chốt: mỗi người một máy, phòng riêng bằng mã qua mạng. Dùng máy chủ WebSocket nhỏ giữ trạng thái chính thức của phòng; browser chỉ gửi thao tác xếp quân/sẵn sàng. Không có tài khoản, cơ sở dữ liệu hay matchmaking.

Phần thiết kế áp dụng cho cả hai lựa chọn:

- Bàn 6×6, hai vùng chuẩn bị đối diện; camera nhìn rõ hai phe.
- Mỗi người chuẩn bị đội nhỏ, chọn quân/vị trí rồi xác nhận sẵn sàng.
- Khi cả hai sẵn sàng, combat tự chạy theo bước cố định; kết quả không phụ thuộc FPS.
- Giữ Dư Ảnh: vùng đánh cố định, kích hoạt đầu vòng sau một lần, nửa sát thương, trúng cả hai phe. Không có chuỗi Dư Ảnh vô hạn.
- Hiển thị đội của bạn/đối phương, trạng thái sẵn sàng, vòng đấu, sát thương và thắng/thua; có chơi lại.
- Không tự mở rộng sang matchmaking, tài khoản, cửa hàng mua bán hoặc hệ thống xếp hạng.

Milestone tiếp theo sau khi chốt kết nối: (1) mô hình hai đội + chuẩn bị/sẵn sàng/tự đánh, (2) giao diện hai phía và quân có thể xếp, (3) kết nối đã chọn và xử lý mất kết nối/chơi lại, (4) kiểm thử hai người thực tế, đồng bộ kết quả và hiệu năng production.

Bản single-player đã kiểm chứng là mốc tham chiếu, không đủ để tuyên bố hoàn thành yêu cầu chơi cùng bạn.
