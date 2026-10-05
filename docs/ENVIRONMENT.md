# Môi trường thực tế — 2026-10-05

## Quan sát

| Mục | Kết quả thực tế |
|---|---|
| Repo | `/Users/hung/tutuba`, origin `https://github.com/hungdeniubeo/tutuba.git` |
| Ban đầu | nhánh main chưa có commit; remote không trả branch; không có mã game |
| Dữ liệu có sẵn | `.git`, `.serena` (giữ nguyên); không thấy file AGENTS.md tại repo/các thư mục cha |
| Nhánh làm việc | `feat/tutuba-vertical-slice` |
| Máy | Mac mini Mac16,10, Apple M4, CPU 10 lõi, GPU 10 lõi, RAM 16 GB |
| OS | macOS 26.7.1 (25G241), arm64 |
| Màn hình | 1920×1080, 120 Hz |
| Đĩa trống lúc khảo sát | khoảng 188 GiB theo `df`; không phải dung lượng build |
| Xcode đang chọn | `/Library/Developer/CommandLineTools` |
| `xcodebuild -version` | lỗi: cần full Xcode |
| SDK / clang của CLT | macOS SDK 27.0 / Apple clang 21.0.0; không đủ chứng minh toolchain UE |
| `xcrun --find metal` | lỗi: không tìm thấy utility `metal` |
| Unreal Editor / full Xcode | không tìm thấy qua các vị trí chuẩn và Spotlight |

Đã kiểm tra `/Applications`, `~/Applications`, `/Users/Shared`, các thư mục
Epic trong `~/Library/Application Support`, `/opt`, `/usr/local`, các thư
mục Developer/Development/UnrealEngine và volume được mount. Spotlight không
trả `UnrealEditor.app`, `Xcode*.app`, `UE_5*` hoặc Engine Build.version.
Kết luận giới hạn ở các nguồn này, không khẳng định đã quét mọi byte của đĩa.
Engine cài nơi khác có thể khai báo bằng `UE_ROOT` để kiểm tra lại.

Log có command, exit code và output: [environment-discovery.txt](evidence/2026-10-05-environment-discovery.txt).
Không ghi serial, hardware UUID hoặc secret môi trường.

## Phiên bản dự kiến

Tài liệu Epic hiện liệt kê **UE 5.8**, macOS tối thiểu 14.5, Xcode tối thiểu
26.0 và khuyến nghị 26.1.1; ghi Xcode 26.4 không tương thích. Chọn tạm
`EngineAssociation: 5.8`, chưa có engine cài thực tế để xác nhận. [Epic macOS requirements](https://dev.epicgames.com/documentation/en-us/unreal-engine/macos-development-requirements-for-unreal-engine).

Apple liệt kê Xcode 26.1.1 hỗ trợ macOS 15.6 đến Tahoe 26.x. Máy 26.7.1 nằm
trong khoảng đó; đây là suy luận từ bảng Apple, không phải bằng chứng Epic
đã kiểm thử đúng bản OS này. [Apple system requirements](https://developer.apple.com/xcode/system-requirements/).

Không tự chọn Xcode mới nhất vì CLT SDK 27.0 hiện tại không chứng minh UE
chấp nhận nó. `BuildSettingsVersion.V5`, các API C++/Python và câu lệnh build
cũng phải kiểm chứng bằng engine thật; static check không thay thế việc đó.

## Bước tối thiểu để gỡ blocker

1. Cài **full Xcode 26.1.1** từ [Apple Developer Downloads](https://developer.apple.com/download/all/).
   Mở Xcode, hoàn tất first launch và license bằng tài khoản của bạn; cài
   Metal Toolchain trong Settings → Components nếu chưa có. [Apple hướng dẫn components](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components).
2. Chọn bản Xcode đó tại Settings → Locations → Command Line Tools. Hoặc,
   với đường dẫn cài thực tế, chạy `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer`.
   Kiểm tra `xcodebuild -version` và `xcrun --find metal`. [Apple hướng dẫn chọn toolchain](https://developer.apple.com/documentation/xcode/configuring-command-line-tools-settings).
3. Cài/đăng nhập [Epic Games Launcher](https://www.unrealengine.com/download),
   Unreal Engine → Library → Add Engine Version → UE 5.8, gồm hỗ trợ Mac.
   Nếu Launcher không có phiên bản này, ghi phiên bản có thật để điều chỉnh
   project/toolchain theo bảng tương thích; không tự đổi OS.
4. Chạy `python3 Scripts/check_environment.py`; nếu cài engine ngoài đường
   dẫn chuẩn, đặt `UE_ROOT` tới thư mục chứa `Engine/`. Sau khi preflight
   đạt, chạy lần lượt `build-editor`, `bootstrap`, `editor` như README.

Việc tải bộ cài, đăng nhập, first launch/license và chọn toolchain toàn máy
cần phía người dùng thực hiện; phiên này không đổi cài đặt hệ thống. Không có
lỗi gameplay nào được xác nhận vì chưa chạy game.

## API Editor làm căn cứ cho scaffold

Python Editor Script Plugin + Editor Scripting Utilities, chạy script bằng
`-ExecutePythonScript`, chỉ dùng trong Editor. [Epic Python workflow](https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-unreal-editor-using-python).
Wrapper thêm `-ScriptErrorsAreFatal` để lỗi script được coi là lỗi process;
cần xác nhận exit code trên engine cài thật. [Epic release notes](https://dev.epicgames.com/documentation/es-es/unreal-engine/unreal-engine-5-5-release-notes).

Script dùng `EditorLoadingAndSavingUtils.new_blank_map(False)` để tạo world
chưa lưu, thêm đủ arena và đèn rồi mới `save_map(world, asset_path)`. Nếu
spawn/config actor lỗi, đích map chưa được lưu. Từ chối map đã tồn tại; chạy
trong phiên riêng vì tạo world sẽ thay level đang mở. Lỗi ghi đĩa vẫn cần
xem log/kiểm tra asset trong Editor, không tự xóa hoặc ghi đè.
[Loading/saving API](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/EditorLoadingAndSavingUtils).

Load native class và spawn qua API chính thức:
[unreal module](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/module/unreal?application_version=5.7),
[EditorActorSubsystem](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/EditorActorSubsystem?application_version=5.7).
Hai trang API này được đối chiếu ở bản 5.7; cần chạy lại trên 5.8 thực tế.
