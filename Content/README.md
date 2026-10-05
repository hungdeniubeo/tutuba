# Nội dung Unreal

Chưa có `.umap`/`.uasset`: máy hiện thiếu Unreal Engine và full Xcode.
Không tạo asset nhị phân giả. Sau khi build module Editor, chạy:

```sh
bash Scripts/ue.sh bootstrap
```

Script tạo `/Game/Maps/L_Tutuba` qua Unreal Editor. Chỉ chạy trong phiên Editor
riêng; script sẽ đóng map hiện tại. Nếu map đã tồn tại, script từ chối ghi đè.
Mở map có sẵn bằng lệnh `editor`. Map/asset do Editor tạo cần được review và
commit cùng milestone đã kiểm chứng. Không xóa map người dùng để chạy lại script.

M1 chỉ có lưới khối lập phương, camera và đèn. Không có nhân vật, animation,
combat, UI hoặc đồ họa hoàn thiện. Các mục này thuộc milestone sau.
