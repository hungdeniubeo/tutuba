# Playtest

Trạng thái: **chưa chạy gameplay**, thiếu UE/full Xcode/Metal. Chưa có kết
quả người chơi, thời lượng hay screenshot. Các ô dưới đây là gate cần kiểm
tra, không phải test đã đạt. Ghi ngày, commit, build config, máy và log khi chạy.

## Checklist chức năng

- [ ] AP tối đa 2/người/vòng, reset đúng; lệnh sai không trừ AP.
- [ ] Di chuyển kề cạnh; chặn ngoài bàn/ô bị chiếm; nâng cấp đi 2 ô cần đường trống.
- [ ] Intent hiện trước input; không đổi vùng khi mục tiêu di chuyển hoặc địch bị đẩy.
- [ ] Đánh của hai phe tạo ảnh N+1, 50% làm tròn xuống/min 1; ô trống vẫn lưu ảnh.
- [ ] Ảnh đứng yên, friendly fire đúng, owner chết vẫn còn ảnh.
- [ ] Dời ảnh tốn 1 AP, dùng chung 1 lần/vòng, bảo toàn deadline/damage/owner.
- [ ] Dời cập nhật preview ngay; biên bị từ chối; ô đang có người vẫn hợp lệ.
- [ ] Đẩy sau damage; chặn biên/ô chiếm; không đẩy xác hoặc dây chuyền.
- [ ] Ảnh không tạo ảnh mới, không đẩy, không nổ hai lần.
- [ ] Ảnh đồng thời cộng sát thương theo snapshot; hai phe cùng chết là thua.
- [ ] Nhân vật chết bị bỏ khỏi lưới; không được input hoặc thực hiện intent.
- [ ] Trận kết thúc khóa input; replay/reset bỏ mọi state cũ.
- [ ] Tutorial dạy đủ move/intent/echo/push, có reset khi làm sai.
- [ ] Hai trận thường, mỗi lần chọn 1/3 nâng cấp, pool 6 tác động đúng.
- [ ] Save/load trước và sau chọn thưởng đúng checkpoint; save hỏng không crash.
- [ ] Boss đổi phase một lần ở ngưỡng; intent đã công bố không đổi.
- [ ] Pause/settings/controls/continue/win/lose/replay hoạt động.
- [ ] 1×/2× cho kết quả gameplay giống nhau.
- [ ] Chơi trọn run thắng và thua trong Editor, có log/ảnh.
- [ ] Chơi trọn run thắng và thua trong packaged native, có log/ảnh.

## Năm câu hỏi cho người chơi

1. Trước khi kết thúc lượt, bạn có dự đoán được địch và Dư Ảnh sẽ đánh ô nào,
   vào lúc nào và ai có thể trúng không? Chỗ nào khó hiểu nhất?
2. Khi nào bạn thấy cần cân nhắc giữa gây damage ngay, di chuyển và chuẩn bị
   combo ảnh? Hãy mô tả một quyết định có hơn một lựa chọn hợp lý.
3. Nhịp tutorial, các lượt đánh và thời gian chờ animation có phù hợp không?
   Đoạn nào quá nhanh/chậm; tổng run thực tế mất bao lâu?
4. Qua hai trận thường và boss, chiến thuật nào bị lặp lại? Nâng cấp hoặc
   phase boss có khiến bạn đổi cách chơi không?
5. Khoảnh khắc hoặc combo nào thú vị nhất với bạn, và vì sao? Bạn có muốn
   thử lại để làm khác điều gì không?

## Ghi nhận cho mỗi run

Ghi đường đi thắng/thua, upgrade đã chọn, thời lượng thực, số lần tutorial
reset, lượt có friendly fire ngoài ý muốn, bug và câu trả lời nguyên văn.
Không diễn giải một playtest duy nhất thành bằng chứng game “hay/đẹp”.
