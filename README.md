# TUTUBA

Vertical slice Unreal Engine 5: fantasy stylized 3D, offline một người chơi,
chiến đấu theo lượt với Dư Ảnh trên lưới 6×6.

**Hiện tại: phần chuẩn bị milestone 1; chưa có bản chơi được.** Máy đã kiểm
tra là Mac mini M4 16 GB, macOS 26.7.1 arm64, nhưng chưa tìm thấy Unreal,
full Xcode hoặc compiler Metal. C++/Editor script chưa được chạy trong UE;
chưa có `.umap`, build native, gameplay, screenshot hoặc số đo hiệu năng.
Chi tiết và bước tiếp tục: [PROGRESS](docs/PROGRESS.md), [môi trường](docs/ENVIRONMENT.md).

## Thiết lập tối thiểu

Cặp phiên bản dự kiến: **UE 5.8 + Xcode 26.1.1**, dựa trên tài liệu Epic và
Apple; chưa chứng minh tương thích bằng build trên máy này. Không tự nâng OS.
Xem [nguồn và hướng dẫn cài](docs/ENVIRONMENT.md#bước-tối-thiểu-để-gỡ-blocker).

Sau khi cài, từ thư mục repo:

```sh
python3 Scripts/check_environment.py
# Chỉ đặt khi engine không ở vị trí chuẩn; đường dẫn là thư mục chứa Engine/.
export UE_ROOT='/Users/Shared/Epic Games/UE_5.8'
bash Scripts/ue.sh build-editor
bash Scripts/ue.sh bootstrap
bash Scripts/ue.sh editor
```

`bootstrap` chạy Unreal Editor để tạo `/Game/Maps/L_Tutuba`; từ chối ghi đè
map có sẵn. Dùng một phiên riêng, đóng Editor đang chỉnh project trước khi
bootstrap. `editor` mở map mặc định. Có thể mở `Tutuba.uproject` trực tiếp
sau build/bootstrap. Nếu UE báo module không tương thích, giữ lại log
`Saved/Logs/` và sửa theo phiên bản thực tế; chưa kiểm chứng UHT/UBT ở M1.

## Chơi và chỉnh trong Editor

Hiện scaffold chỉ dự kiến cho thấy 36 ô blockout khi nhấn Play. Chưa có
nhân vật, thao tác chiến đấu hoặc menu. Không coi đây là bản demo hoàn thiện.
Điều khiển dự kiến M2/M3: click chọn nhân vật và ô; nút UI chọn kỹ năng;
End Round kết thúc lượt; Escape tạm dừng; nút tốc độ 1×/2×.

Sau khi tạo map, chọn actor `Tutuba Arena` trong World Outliner. Details
cho phép chỉnh `TileSpacing`, `CameraPitch`, `CameraYaw`, `CameraDistance`,
`CameraFOV`, `PlayerSpawnCells` và `EnemySpawnCells`. Spawn hiện là dữ liệu
chuẩn bị, chưa tạo nhân vật. Chọn hai Directional Light để chỉnh hướng,
cường độ/màu. Gameplay DataAssets cho skill/enemy/upgrade sẽ thêm ở M2/M3.
Save level bằng Editor; commit asset thật sau khi kiểm chứng.

## Build và kiểm tra

```sh
# Kiểm tra công cụ môi trường, không thay thế gameplay/UE tests.
python3 -m unittest discover -s Tests -v
Tests/run_combat_core.sh
python3 Scripts/check_environment.py --json

# Sau khi build Editor + bootstrap và hoàn tất gameplay:
bash Scripts/ue.sh package
```

Package dự kiến tại `Builds/Mac/` (gitignored), Shipping Mac arm64. Cần kiểm
tra kiến trúc binary và mở `.app` thực tế; chưa có package để thực hiện.
Không push tự động. Windows/Linux/iOS/Android chưa kiểm tra.

`Tests/run_combat_core.sh` biên dịch model luật thuần C++ bằng `clang++` của
macOS và chạy các ca Dư Ảnh không cần Unreal. Kết quả này chỉ chứng minh luật
deterministic ở mức model; UBT/UHT, Editor, PIE và packaged vẫn cần UE thật.

## Tài liệu

- [Thiết kế và quy tắc Dư Ảnh](docs/DESIGN.md)
- [Kế hoạch 5 milestone](docs/PLAN.md)
- [Tiến độ, gate và bằng chứng](docs/PROGRESS.md)
- [Checklist gameplay và 5 câu hỏi playtest](docs/PLAYTEST.md)
- [Quy trình đo, kết quả hiệu năng](docs/PERFORMANCE.md)
- [Nguồn asset và giấy phép](ASSET_LICENSES.md)

Mục tiêu 10–15 phút, ≥60 FPS trung bình, ≥45 FPS 1% low, build <2 GB là
các tiêu chí cần đo, chưa phải kết quả. Repo không chứa asset mua hoặc binary
Unreal Engine. Chỉ có Engine BasicShapes được tham chiếu cho blockout.
