# Nguồn tài nguyên

- Arena, nhân vật, cây, đá, phế tích, vũ khí, Dư Ảnh và hiệu ứng: tạo bằng code trong `src/render/ArenaScene.ts` cho dự án này. Không tải model, texture hay animation bên ngoài.
- Âm thanh: oscillator Web Audio được tạo bằng code trong `src/main.ts`. Không dùng sample bên ngoài.
- Biểu tượng: ký tự Unicode được vẽ bởi font hệ thống. Không đóng gói hoặc phân phối font.
- Font: font hệ thống của trình duyệt/OS; không tải Google Fonts hay CDN.
- Three.js: https://github.com/mrdoob/three — MIT. OrbitControls và renderer WebGL/WebGPU thuộc Three.js. Toàn văn giấy phép được phân phối trong `public/THIRD_PARTY_NOTICES.txt` và `dist/THIRD_PARTY_NOTICES.txt` sau build.
- Vite, TypeScript, Vitest và Playwright Core là công cụ phát triển/kiểm tra; không có runtime game ngoài Three.js. Giấy phép dependency được giữ trong npm packages/lockfile.

Đây là hình ảnh prototype low-poly tạo bằng primitive có nhận diện nhân vật và bố cục thống nhất, chưa phải bộ art/animation hoàn thiện cho sản phẩm thương mại. Không có asset trả phí.
