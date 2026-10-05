# TUTUBA — Dư âm Rừng Cổ

Prototype web 3D nhẹ, giao diện tiếng Việt, TypeScript + Vite + Three.js. Không phụ thuộc Unreal, không cần tài khoản/backend để chạy bản single-player hiện tại.

**Hướng mới đang được chốt:** hai đội đứng đối diện, chơi cùng bạn và tự chiến đấu sau khi xếp đội hình. Xem [thiết kế đang trao đổi](docs/AUTO_CHESS_DIRECTION.md). Bản hiện tại vẫn là mốc single-player đã kiểm chứng; chưa có kết nối hai người.

## Chạy

Cần Node 22.12+ (đã chạy trên Node 24.20.0) và trình duyệt hỗ trợ WebGL 2.

```sh
cd web
npm ci
npm run dev
```

Mở địa chỉ Vite in ra (mặc định `http://127.0.0.1:5173`). Mọi tài nguyên đều được đóng gói tại chỗ; runtime không gọi CDN, API hoặc dịch vụ bên ngoài.

## Build production

```sh
npm run build
npm run preview
```

Mở `http://127.0.0.1:4173`. Deploy nội dung `dist/` lên static hosting nếu muốn; chưa tự xuất bản. WebGL là mặc định. Thêm `?renderer=webgpu` để thử WebGPU; nếu không hỗ trợ sẽ dùng WebGL. Chỉ WebGL là mục tiêu hiệu năng chính.

## Chơi bản hiện tại

Chọn hành động rồi nhấp vào ô trong arena. Mỗi vòng có 2 AP. Phím 1/2/3/4/5 tương ứng Di chuyển / Đánh / Đẩy / Tạo khiên / Dời Dư Ảnh. End turn/Kết thúc lượt thực hiện ý định địch rồi kích hoạt Dư Ảnh của vòng sau. Có lưới tọa độ để thao tác bằng Tab + Enter.

Chuột phải kéo để xoay camera, cuộn để phóng to, nút đặt lại góc nhìn. H mở hướng dẫn; Escape tạm dừng. Khi thắng, chọn chặng tiếp theo; khi thua có chơi lại. Thiết lập âm thanh/tốc độ được lưu trong localStorage. Chưa lưu tiến độ trận. Bốn trận hướng tới 10–15 phút cho người chơi mới, chưa có đo thời lượng người chơi thực tế.

## Kiểm chứng

```sh
npm test
npm run build
TUTUBA_WRITE_PLANS=1 npm test
# Chạy npm run preview trong terminal khác trước hai lệnh sau:
npm run verify:browser
npm run verify:performance
```

Browser scripts dùng `playwright-core` với Chrome đã cài trên máy, không tải browser engine. Đặt `CHROME_PATH` nếu Chrome nằm ngoài các đường dẫn thường dùng. Có thể đổi URL qua `TUTUBA_URL`. Scripts mở browser riêng ở viewport 1920×1080, dùng canvas/button clicks; không sửa trạng thái gameplay để giành chiến thắng. Diagnostic API chỉ cho đọc snapshot, lấy tọa độ camera và đo frame time.

Bài đo hiệu năng: warm-up combat 30 giây, sau đó đo 180 giây trong tab foreground. Kết quả ghi cùng frame time thô, cấu hình máy, Chrome/GPU, kích thước viewport/canvas và dung lượng `dist`. Tab bị ẩn làm kết quả không hợp lệ. Xem [tiến độ và bằng chứng](docs/PROGRESS.md).

## Chỉnh nội dung

- `src/game/combat/CombatModel.ts`: luật AP, đòn đánh, đẩy, khiên, ý định, Dư Ảnh và kết quả. Không có Three.js/browser/time/random.
- `src/game/encounters.ts`: vị trí spawn, máu, đội hình và ghi chú bốn trận.
- `src/render/ArenaScene.ts`: camera, ánh sáng, cảnh, nhân vật bằng primitive, raycast và hiệu ứng.
- `src/main.ts` / `src/style.css`: HUD và điều khiển tiếng Việt.
- `src/game/combat/CombatModel.test.ts`: 18 ca C++ tương đương + regression web.
- `scripts/`: playthrough và đo hiệu năng Chrome.

Nguồn C++ Unreal trong repo chỉ dùng đối chiếu luật; bundle web không nhập hoặc chạy chúng. Nhánh Unreal được giữ nguyên. Không push nếu chưa được yêu cầu.
