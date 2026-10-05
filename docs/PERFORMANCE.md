# Báo cáo hiệu năng

Ngày khảo sát môi trường: 2026-10-05. **Chưa đo runtime.** Không có packaged
binary vì thiếu Unreal Engine, full Xcode và Metal toolchain. Không có FPS
Editor để dùng thay thế, không có ước tính FPS/memory/size.

| Chỉ số | Mục tiêu | Kết quả thực tế |
|---|---:|---|
| Average FPS (combat 180 giây) | ≥60 | chưa đo |
| 1% low FPS | ≥45 | chưa đo |
| Peak RSS game | báo số đo | chưa đo |
| Dung lượng `.app` | <2.000.000.000 bytes | chưa có build |
| Độ phân giải render | 1920×1080 | cấu hình mặc định đã viết, chưa xác nhận runtime |
| Kiến trúc binary | native arm64 | chưa có binary để kiểm tra |

Máy hiện có: Mac mini M4 (10 CPU/10 GPU), RAM 16 GB, macOS 26.7.1 arm64,
màn hình 1080p 120 Hz. Khi chạy cần xác nhận lại cấu hình và ghi các app nền.
Windows/Linux và các máy khác chưa kiểm tra.

## Quy trình khi có packaged combat

1. Ghi commit, engine/Xcode thực tế, config Development/Shipping, renderer,
   scaling, VSync và cap; xác nhận kích thước render 1920×1080. `file` trên
   executable phải có arm64; dùng native process, không Rosetta.
2. Chạy encounter cố định và chuỗi hành động có ảnh, friendly fire, push,
   boss phase 2. Warm-up 60 giây ngoài vùng đo để tránh shader/cold-load bias.
3. Ghi raw frame times **đủ 180 giây sau warm-up** trong packaged game bằng
   CSV Profiler/Unreal Insights hoặc telemetry C++ của build. Không lấy FPS
   overlay một thời điểm. Benchmark input phải tái chạy cùng seed và speed.
4. Average FPS = số frame / tổng thời gian frame (giây). 1% low = 1000 /
   trung bình `ceil(N×0.01)` frame-time lớn nhất (ms). Ghi sample count,
   duration và hitch; không nhầm 99th-percentile frame time với 1% low này.
5. Lấy mẫu RSS của **process game** trong cùng cửa sổ đo, báo peak quan sát
   được và tần suất lấy mẫu (mục tiêu 1 Hz). RSS không đại diện toàn GPU
   memory/shared system memory; không dùng RAM máy thay số đo game.
6. Ghi cả logical bytes và `du -sk` cho bundle `.app`, archive/config đi kèm
   riêng; tiêu chí <2 GB áp bundle phát hành. Không dùng kích thước repo.
7. Lưu raw CSV, command/log, ảnh đầu/cuối và summary trong `docs/evidence/`.
   Chạy lại sau thay đổi ảnh hưởng render/gameplay; nếu quá ngưỡng, tìm nguyên
   nhân bằng profile và ghi kết quả sau sửa, không sửa mục tiêu để báo đạt.

Phiên bản cuối cần đo Shipping packaged. Development giúp tìm lỗi và đo sơ
bộ nhưng không tự chứng minh hiệu năng Shipping. Nếu console/profiler bị tắt
trong Shipping, thêm telemetry chỉ bật bằng benchmark option trong M5.
