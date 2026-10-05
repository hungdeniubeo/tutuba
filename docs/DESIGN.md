# TUTUBA — thiết kế vertical slice

Ngày: 2026-10-05. Concept và phạm vi đã được người dùng chọn; các quyết định
dưới đây là chi tiết triển khai được phép tự quyết. Đây là thiết kế, chưa phải
mô tả tính năng đã chạy. Trạng thái thực tế: [PROGRESS.md](PROGRESS.md).

## Trải nghiệm và phạm vi

Game offline một người chơi, UE5 native, bàn cảnh fantasy stylized nhìn chéo,
lưới 6×6. Giả thuyết cần playtest: đọc ý định và đẩy quái vào Dư Ảnh tạo các
lựa chọn dễ hiểu, có chiều sâu. Chưa có bằng chứng về độ hay hoặc độ đẹp.

Một lượt dự kiến 10–15 phút: menu → tutorial khoảng 2 phút → trận thường 1
→ chọn 1/3 nâng cấp → trận thường 2 → chọn 1/3 nâng cấp → boss hai giai đoạn
→ thắng/thua → chơi lại. Thời lượng chỉ là mục tiêu cho tới khi đo playtest.
Menu có bắt đầu mới, tiếp tục tại ranh giới trận, điều khiển, thiết lập và thoát.
Tạm dừng chặn input chiến đấu; tốc độ trình diễn 1×/2× không đổi luật.

## Luật quyết định, độc lập animation

- Tọa độ `(x,y)` nguyên, từ 0 đến 5. Không đi chéo. Mỗi ô tối đa một nhân vật
  sống; xác chết được bỏ khỏi lưới ngay sau mỗi đợt giải quyết sát thương.
- Mỗi vòng: giải quyết Dư Ảnh đến hạn → kiểm tra kết thúc → cấp lại 2 AP cho
  mỗi nhân vật sống, reset giới hạn dời ảnh → lập và hiển thị ý định địch →
  người chơi hành động → địch thực hiện lần lượt theo ID → kết thúc vòng.
  Vòng 1 có bước Dư Ảnh rỗng. Người chơi có thể kết thúc vòng sớm; AP không tích lũy.
- Hành động hợp lệ mới trừ AP. Di chuyển 1 AP/ô trống kề cạnh; ô ngoài bàn,
  bị chiếm hoặc thiếu AP bị từ chối, không đổi trạng thái. Nhân vật chết
  không nhận AP, không được chọn hoặc hành động.
- Một đòn đánh hợp lệ tốn AP kể cả đánh vào ô trống và tạo đúng một Dư Ảnh
  cho toàn vùng đánh. Sát thương gốc là giá trị nguyên của đòn sau buff tấn
  công, trước shield của mục tiêu; được chụp lại lúc ra đòn. Kỹ năng không
  gây sát thương (di chuyển, bảo hộ, dời ảnh) không tạo ảnh.
- Ảnh sinh ở vòng N kích hoạt ở đầu N+1: mỗi ô gây `max(1, floor(baseDamage/2))`.
  Giữ vùng ô, ID chủ sở hữu và phe gốc để hiển thị; gây sát thương cho mọi
  nhân vật trong vùng, cả đồng minh và chủ ảnh. Chủ ảnh chết không xóa ảnh.
  Một nhân vật chỉ trúng mỗi ảnh một lần, kể cả dữ liệu vùng có ô trùng.
- Các ảnh đến hạn được chụp danh sách theo ID tăng dần và lấy khỏi hàng đợi
  **trước** khi áp sát thương. Lấy vị trí mọi nhân vật tại đầu bước; cộng
  sát thương tất cả ảnh cho mỗi người rồi áp một đợt đồng thời. Shield hấp
  thụ tổng sát thương trước HP. Sau đó xóa người chết và kiểm tra kết thúc.
  Trình diễn/log theo ID, không để animation thay đổi kết quả.
- Ảnh không tạo ảnh mới, không đẩy, không gọi lại pipeline đòn đánh.
  Ảnh chưa đến hạn không bị kích hoạt. ID tăng đơn điệu trong trận.
- Dời ảnh: hỗ trợ dùng 1 AP; tối đa một lần **cho cả đội mỗi vòng**. Chọn
  một ảnh của bất kỳ phe nào rồi dịch toàn vùng một ô kề cạnh; mọi ô mới
  phải trong bàn. Ô có nhân vật hoặc ảnh khác vẫn hợp lệ. Giữ nguyên damage,
  owner và vòng đến hạn; cập nhật preview ngay. Lệnh sai không tốn AP/quota.
- Đẩy: sau sát thương trực tiếp, mục tiêu còn sống bị đẩy một ô theo hướng
  từ người đánh tới mục tiêu (chỉ đánh kề cạnh). Nếu ô sau lưng ngoài bàn
  hoặc có người sống, mục tiêu đứng nguyên; không thêm damage va chạm, không
  đẩy dây chuyền. Nếu chết thì bỏ người chết, không đẩy xác. Không kích hoạt
  ảnh sớm khi đi/đẩy vào vùng.
- Sau mỗi hành động/đòn địch và sau đợt ảnh đồng thời: không còn người chơi
  sống → thua; nếu còn người chơi và không còn địch → thắng. Cả hai phe
  chết đồng thời là **thua**. Trạng thái kết thúc khóa mọi lệnh chiến đấu,
  xóa queue trình diễn còn thừa; ảnh chờ không trì hoãn kết thúc trận.

## Hai nhân vật và địch

Di chuyển là hành động chung, không phải kỹ năng. Mỗi kỹ năng dưới đây tốn 1 AP;
các trị số là điểm bắt đầu để tune trong Editor, chưa phải cân bằng đã kiểm chứng.

| Nhân vật | Nhận diện | HP | Kỹ năng (tối đa 3) |
|---|---|---:|---|
| Rowan | giáp hổ phách, vai rộng, búa | 24 | Strike: kề cạnh, 6 damage; Shove: kề cạnh, 4 damage + đẩy; Brace: tự nhận 3 shield |
| Mira | áo choàng ngọc lam, mũ nhọn, trượng | 18 | Bolt: một ô cách Manhattan ≤3, 4 damage; Shift Echo: dời ảnh; Ward: đồng minh cách ≤2 nhận 3 shield |

Shield không cộng dồn vượt 6 và hết ở cuối vòng **sau khi** địch hành động;
có thể chặn ảnh đầu vòng sau chỉ nếu được cấp bởi nâng cấp ở bước ảnh (hiện
không có nâng cấp như vậy). Không có hồi sinh hoặc hồi máu vô hạn trong trận.

Ba loại quái: Briarling áp sát/đánh kề (HP 10, damage 4), Rune Archer bắn
một ô cố định xa ≤4 (HP 8, damage 4), Stone Warden báo trước vùng chữ thập
(HP 16, damage 3). Nếu chưa trong tầm thì ý định là đi một ô giảm khoảng
cách tới người chơi gần nhất. Hòa khoảng cách: Rowan trước Mira, sau đó ưu
tiên hướng +X, +Y, −X, −Y. Ý định chứa ô di chuyển/vùng đánh cố định; không
tự đổi mục tiêu khi bị đẩy. Lúc thi hành, địch chết thì hủy; đích di chuyển
bị chiếm thì bỏ lượt; vùng đánh vẫn giữ nguyên ngay cả khi trống. Đòn đã
báo vùng trên bàn vẫn thi hành nếu người đánh bị đẩy, miễn còn sống.

Boss Ruin Keeper (HP 48) có phase 1 đánh đường thẳng và phase 2 đánh chữ thập,
ngưỡng HP ≤24; đổi phase ngay sau đợt damage nhưng không sửa ý định đã hiển
thị. Phase mới chỉ áp cho lần lập ý định kế tiếp. Boss chết không đổi phase.
Không thêm địch triệu hồi trong slice.

## Tutorial và nâng cấp

Tutorial có các bước khóa theo sự kiện thật: di chuyển tránh ô đỏ → đọc ý
định → đánh tạo ảnh → kết thúc vòng thấy ảnh nổ → dời ảnh và đẩy địch vào
vùng. Có reset tutorial nếu làm sai, không softlock khi mục tiêu chết sớm.
Hai trận thường phối ba loại quái; boss có arena cùng cấu trúc để giảm chi phí.

Sáu nâng cấp không trùng trong một run; mỗi lần thưởng lấy ba lựa chọn từ
pool còn lại theo seed lưu trong save. Chọn một mới sang trận tiếp theo.

| ID | Tác động |
|---|---|
| HeavyHands | Rowan Strike/Shove +2 damage; ảnh dùng giá trị mới |
| LongStride | cả đội có thể di chuyển tối đa 2 ô đường đi trống với 1 AP |
| FarSight | Mira Bolt tăng tầm từ 3 lên 4 |
| ResonantWard | lần dời ảnh thành công cấp 2 shield cho Mira |
| SharedShelter | Brace của Rowan đồng thời cấp 2 shield cho Mira nếu kề cạnh |
| EchoPadding | mỗi người chơi giảm 2 damage từ tổng ảnh mỗi đầu vòng, tối thiểu 0 |

Giữa các trận hồi đầy HP, bỏ shield/ảnh/AP cũ. Save chỉ tại ranh giới trận và
khi chọn nâng cấp; checkpoint lưu encounter tiếp theo, bước chọn thưởng,
seed, upgrade IDs và schema version. Settings riêng gồm âm lượng, tốc độ,
độ phân giải. Save hỏng báo lỗi có thể bắt đầu mới, không crash. Chơi lại
xóa trạng thái run trong bộ nhớ và thay checkpoint bằng run mới; giữ settings.

## Kiến trúc gọn và Editor

Một module C++ `Tutuba`. Model chiến đấu C++ thuần dữ liệu (không Tick/world
time) trả event list; controller chuyển input thành lệnh, actor/UI trình diễn
event. Không GAS hoặc framework lớn. `UDataAsset` chứa encounter, skill,
enemy, upgrade; `UPROPERTY(EditAnywhere)` cho trị số và vị trí spawn. Save
bằng `USaveGame` C++; UI dựng bằng UMG/Blueprint gọi API C++.

Milestone 1 chỉ tạo module, actor arena lưới với camera chỉnh được, config
render nhẹ và script Editor tạo level thật. Chưa thêm combat trước khi có
build/editor smoke test. `.uasset`/`.umap` chỉ do Unreal Editor tạo, không
viết giả. Có thể chỉnh cell spacing, camera pitch/yaw/distance, ánh sáng,
spawn trong Editor. Asset tạo lần đầu không bị script ghi đè khi chạy lại.

## Hình ảnh, hiệu năng và bằng chứng

Stone/ivory nền bàn, cây xanh trầm, ruins tím than, đồng minh hổ phách/ngọc
lam; nguy hiểm đỏ và ảnh tím đi kèm icon/text để không chỉ dựa vào màu.
Preview ghi vùng, damage, “đầu vòng N”, owner và cảnh báo đồng minh. Cần
phản hồi chọn/hover/hit/death/echo; animation ngắn, âm thanh miễn phí có
license rõ. Blockout milestone 1 **không phải** hình ảnh cuối.

Mặc định Lumen, hardware ray tracing, Nanite, virtual shadow maps tắt;
ánh sáng đơn giản, texture 512–1024. Chỉ presentation đang chạy mới Tick.
Mục tiêu packaged native arm64 1920×1080: average ≥60 FPS, 1% low ≥45 FPS,
build <2 GB. Đo sau warm-up 60 giây trong combat 180 giây trên máy thật,
ghi cấu hình, nhiệt/ứng dụng nền nếu ảnh hưởng, frame times, peak RSS và
dung lượng `.app`. 1% low = 1000 / trung bình 1% frame-time chậm nhất (ms).
Không dùng FPS Editor thay packaged. Báo kết quả thật kể cả không đạt.
