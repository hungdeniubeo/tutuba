# TUTUBA — tiến độ và bằng chứng

## Trạng thái hiện tại (2026-10-05)

**Goal chưa hoàn thành. M1 chưa đạt gate mở Editor.** Nhánh
`feat/tutuba-vertical-slice`; repo ban đầu không có commit/mã game, remote
không có branch. `.serena` có sẵn được giữ nguyên. Chưa push.

| Milestone | Trạng thái | Bằng chứng / phần còn thiếu |
|---|---|---|
| M1: môi trường/project mở được | phần chuẩn bị xong, bị chặn native | thiết kế, scaffold/helper đã kiểm tra tĩnh; thiếu UE/full Xcode/Metal |
| M2: một trận Dư Ảnh | model luật độc lập đã kiểm chứng; UE prototype chưa triển khai | cần M1 Editor/UBT/UHT pass để nối input/UI |
| M3: tutorial/run/save/boss | chưa triển khai | cần M2 pass |
| M4: hình/animation/UI/audio | chưa triển khai | chưa có asset nhân vật hoặc trình diễn |
| M5: package/playtest/performance | chưa chạy | không có native binary |

## M1 — đã làm

- Kiểm tra Git, instructions, workspace, remote và môi trường thật; chuyển
  sang nhánh được yêu cầu. [Log khảo sát](evidence/2026-10-05-environment-discovery.txt).
- Viết [thiết kế](DESIGN.md) và [kế hoạch](PLAN.md), chốt thứ tự ảnh đồng thời,
  death/victory, friendly fire, dời ảnh, collision và phase boss để có thể test.
- Tạo descriptor UE5.8, C++ module/game/editor targets, actor arena/camera
  chỉnh trong Editor, GameMode chọn camera, cấu hình render nhẹ/1080p.
- Viết script Editor sinh level thật; chưa chạy. Không có `.umap`/`.uasset`
  giả. Blockout không phải hình ảnh cuối, chưa có gameplay.
- Chuẩn bị checker môi trường, wrapper build/bootstrap/editor/package,
  README, nguồn asset, playtest và protocol đo hiệu năng.
- Tạo model luật deterministic không phụ thuộc Unreal trong
  `Source/Tutuba/Public/TutubaCombatModel.h` và
  `Source/Tutuba/Private/TutubaCombatModel.cpp`. C++ host test cố định 18 ca
  cho AP, di chuyển, intent, ảnh, friendly fire, dời ảnh, đẩy, shield,
  death/victory và kết quả đồng thời.

## Kiểm chứng

Khảo sát thực tế đã xác nhận Mac mini M4 16 GB, macOS 26.7.1 arm64. Không
tìm thấy Unreal/Xcode qua vị trí chuẩn/Spotlight. `xcodebuild -version` lỗi
vì chỉ có CLT; `xcrun --find metal` lỗi vì thiếu compiler. SDK 27.0 của CLT
không đủ thay full Xcode. [Chi tiết môi trường](ENVIRONMENT.md).

Đã chạy trực tiếp trong phiên:

- `python3 -m unittest discover -s Tests -v`: **20 tests pass**, 11.165 giây.
  Kiểm tra guard thiếu engine/CLT, version sai, explicit UE_ROOT sai/rỗng,
  đường dẫn có dấu cách/ký tự shell, không shell injection, bảo toàn exit
  code của tool, bootstrap args và package chặn map chưa có. Bốn test thêm
  kiểm tra từ chối ghi đè, lỗi spawn không lưu map dở, lưu sau đủ actor và
  báo lỗi save. Các fixture engine/tool và mock API Editor chỉ kiểm tra
  control flow của script, không phải Unreal thật.
  [Log tests](evidence/2026-10-05-helper-tests.txt).
- `Tests/run_combat_core.sh`: **18/18 pass**, compile bằng Apple clang với
  `-std=c++17 -Wall -Wextra -Werror -pedantic`. [Log model](evidence/2026-10-05-combat-core.txt).
  Đây là bằng chứng luật thuần C++ ở host; chưa phải UBT/UHT hoặc runtime UE.
- `bash -n Scripts/ue.sh`: exit 0. [Log syntax](evidence/2026-10-05-bash-syntax.txt).
- Python AST parse (kể cả Editor script), JSON descriptor và 3 INI parse:
  pass. `Content/` không có binary asset giả.
  [Log static checks](evidence/2026-10-05-static-checks.txt).
- `python3 Scripts/check_environment.py --json`: exit 1, đúng ba blocker;
  [report máy thật](evidence/2026-10-05-preflight.json).
- `bash Scripts/ue.sh build-editor`: exit 1 tại preflight, **chưa gọi UBT**.
  [Log attempt](evidence/2026-10-05-build-editor-attempt.txt).
- Kiểm tra whitespace từng file mới bằng `git diff --no-index --check`:
  không có lỗi. [Log](evidence/2026-10-05-whitespace.txt).

Review độc lập phát hiện hai lỗi trong bootstrap: API `new_level` lưu map
trống quá sớm, và wrapper thiếu `-ScriptErrorsAreFatal`. Đã thêm test hồi
quy (4 fail trước sửa: [log red](evidence/2026-10-05-review-regression-red.txt)),
đổi sang world chưa lưu + `save_map` ở cuối, thêm cờ fatal, chạy lại toàn bộ
20 helper tests pass. Review không tìm thấy lỗi C++ cụ thể khác bằng đọc mã;
điều này không thay cho compile. Căn cứ API ở [ENVIRONMENT](ENVIRONMENT.md).

**Chưa có** UBT/UHT compile, Editor startup/PIE, gameplay tests, packaged
playthrough, screenshot gameplay hoặc số đo FPS/RSS/build size. Kiểm tra
cú pháp/helper không chứng minh C++/Python Editor API chạy đúng trong UE.

## Blocker và bước tiếp tục

Cần người dùng cài UE5.8 và full Xcode26.1.1 + Metal theo
[các bước tối thiểu](ENVIRONMENT.md#bước-tối-thiểu-để-gỡ-blocker), hoặc cung
cấp đường dẫn cài engine/toolchain nếu nằm ngoài những nơi đã kiểm tra.
Cặp phiên bản này được chọn theo docs, **chưa build xác nhận** trên máy.
Không tự cài, nâng OS hay thay global developer directory trong phiên này.

Sau khi môi trường sẵn sàng: chạy checker → build-editor → bootstrap → mở
Editor/Play → lưu log/ảnh → sửa lỗi thực tế → đánh dấu M1/commit khi gate đạt.
Tiếp đó mới triển khai một trận prototype M2. Không lặp lại dựng scaffold.

## Quyết định trong phiên

- User đã chọn concept và cho phép tự quyết chi tiết, vì vậy viết thiết kế/
  milestone plan rồi triển khai, không thêm vòng duyệt thiết kế.
- Repo unborn/không có thay đổi mã người dùng: làm ngay trên nhánh được yêu
  cầu tại workspace hiện có; không tạo thêm worktree.
- Chỉ phần chuẩn bị có thể kiểm tra bằng Python/config khi thiếu UE; không
  lấy helper tests làm bằng chứng native. M2 model được thực hiện như một
  lát cắt engine-independent để tạo bằng chứng luật trong lúc môi trường UE
  bị chặn; chưa gọi đây là M2 gate vì chưa có Editor/PIE.
- Ruling: tiếp tục lõi C++ thuần trong blocker là tiến bộ an toàn, không tạo
  asset/map giả và không thay thế yêu cầu M1. Khi UE sẵn sàng, giữ API này và
  nối actor/UI; nếu UBT phát hiện khác biệt, sửa theo build thật.

## Khi tiếp tục phiên

Đọc file này trước; kiểm tra Git và chạy lại preflight để tìm bằng chứng mới.
Nếu cùng blocker vẫn tồn tại, không tạo lại project hoặc chạy lặp package.
Chỉ tiếp tục công việc phụ thuộc Unreal sau khi có toolchain/engine thực tế.
