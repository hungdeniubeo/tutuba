# TUTUBA — kế hoạch milestone

Thiết kế nguồn: [DESIGN.md](DESIGN.md). Tiến độ và bằng chứng: [PROGRESS.md](PROGRESS.md).
Theo chỉ thị người dùng, tự triển khai chi tiết thông thường và chỉ push khi
được yêu cầu. Nhánh `feat/tutuba-vertical-slice`. Không tăng nội dung trước
khi kiểm chứng prototype Dư Ảnh. Commit milestone sau khi gate của nó đạt.

## M1 — môi trường và project mở được

1. Xác minh Git/local/remote, đọc instructions, kiểm tra máy/UE/Xcode/Metal.
   Ghi output đã loại định danh máy trong `docs/evidence/`.
2. Ghi thiết kế, plan và checklist nghiệm thu; tạo `Tutuba.uproject`, module
   `Source/Tutuba`, game/editor targets, `Config/`.
3. `ATutubaArena` chỉ dựng 36 ô blockout và camera chỉnh được; không Tick.
   `ATutubaGameMode` chọn camera khi Play. Script `Scripts/Editor/create_starter_map.py`
   tạo map `/Game/Maps/L_Tutuba` bằng Editor API, không ghi đè map tồn tại.
4. Tạo `Scripts/check_environment.py` và `Scripts/ue.sh` để báo blocker,
   build Editor target, tạo map, mở Editor và package. Test guard đường dẫn
   có dấu cách, thiếu engine, chỉ có CLT; không tự cài hoặc chọn lại Xcode.
5. Gate: UBT/UHT build Editor target thành công → script tạo map thành công
   → mở Editor, Play, thấy arena/camera, thoát không crash. Lưu log và ảnh.
   Nếu thiếu engine/toolchain: hoàn tất phần chuẩn bị có thể kiểm tra, ghi
   blocker/bước tối thiểu, **M1 chưa đạt**, không đẩy sang M2.

## M2 — một trận kiểm chứng Dư Ảnh

Tạo `Combat/TutubaCombatTypes.h`, `TutubaCombatModel.{h,cpp}` và UE automation
tests ở `Private/Tests/`. Model nhận Move/Attack/ShiftEcho/EndRound, trả trạng
thái/event theo thiết kế. DataAsset gameplay được tạo qua Editor sau compile.
Nối input chọn nhân vật/ô, overlay ý định/ảnh, AP và end turn; mỗi nhân vật
đủ 3 kỹ năng. Dùng blockout; một encounter debug cố định có reset.

Gate: automated tests cho 2 AP, reset AP, di chuyển sai, vùng đánh cố định,
50% làm tròn, friendly fire, owner chết, dời ảnh/quota/timing, đẩy/va chạm,
dead actors, simultaneous defeat, no re-echo/no double activation. Test cùng
chuỗi input ở tốc độ 1×/2× cho cùng state. Chơi một trận trong Editor có ảnh
chụp preview trước/sau dời. Chỉ tăng nội dung khi gate này đạt.

## M3 — vòng chơi và dữ liệu

Tạo encounter/skill/enemy/upgrade DataAssets có tham số Editor; tutorial theo
sự kiện, ba quái, boss hai phase, hai trận thường, sáu upgrade. Run state +
`USaveGame`; menu/continue/pause/settings/win/lose/retry và hướng dẫn điều khiển.
Gate: tests boss threshold và intent cũ; restart sạch; save/load checkpoint
trước/sau chọn thưởng; save hỏng; khóa input khi pause/kết thúc; tutorial có
reset; chơi hết run thắng và thua, đo thời gian (mục tiêu 10–15 phút).

## M4 — trình diễn và khả năng đọc

Thay blockout bằng nhân vật nhận diện được, arena fantasy nhất quán; ghi
license mọi asset; phản hồi hover/select/attack/hit/death/echo, animation
nhanh và âm thanh; UMG text dễ đọc 1080p, camera nhẹ. Cập nhật ngay preview
damage/time/owner/friendly fire. Không tăng phạm vi tính năng.
Gate: checklist ảnh tại menu/tutorial/combat/upgrade/boss/end; playtest năm
câu hỏi trong `PLAYTEST.md`; fix readability. Chỉ gọi hình ảnh hoàn thiện
khi đã xem trong bản chạy, nêu rõ asset còn thiếu nếu có.

## M5 — package, playtest và đo

Build Development để automation/CSV rồi Shipping để phát hành; Mac native
arm64, stage vào `Builds/`. Chơi trọn vòng trong Editor và packaged, cả đường
thắng/thua/retry/continue. Bài combat 3 phút sau warm-up 1 phút; lưu raw frame
CSV, thông tin máy, kích thước bundle, peak RSS, screenshot trong evidence.
`PERFORMANCE.md` ghi average FPS, 1% low theo định nghĩa DESIGN, memory, size,
commit/build config/resolution. Nền tảng khác ghi “chưa kiểm tra”.

Gate cuối: mọi test/gameplay pass, build native mở được, run chơi trọn, số đo
thật được báo (nếu chưa đạt mục tiêu thì sửa hoặc ghi blocker, chưa hoàn thành).
README đủ mở/chơi/build/chỉnh Editor. Commit mỗi milestone đã đạt; không push.

## Trường hợp dễ bỏ sót cần kiểm tra

- Cả hai phe chết cùng đợt ảnh → thua; ảnh của owner chết vẫn nổ (M2).
- Dời ảnh đa ô tới biên, ô đang có người, lệnh sai sau hết quota (M2).
- Đẩy sau intent không làm vùng intent chạy theo; blocker di chuyển bỏ lượt (M2).
- Save tại màn chọn upgrade rồi khởi động lại không cho chọn thêm hoặc skip trận (M3).
- Retry sau thua/pause/phase change không giữ queue ảnh, AP, phase hoặc upgrade cũ (M3/M5).
