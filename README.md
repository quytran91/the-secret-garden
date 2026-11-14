# The Secret Garden

*Một khoảng lặng. Một điều biết ơn.*

Web app cá nhân để nạp những ảnh thông điệp của bạn (lời biết ơn, gia đình, sức khỏe, kỷ niệm, mong ước) và mỗi lần muốn xem, bốc ngẫu nhiên một ảnh. Ảnh được che bằng mosaic pixel, lướt qua rồi chậm dần, dừng ở một tấm và hiện rõ dần.

Bốc ngẫu nhiên thuần tuý từ bộ ảnh của bạn: không có AI, không có lời tiên đoán.

## Chạy trên máy

Cần Node.js 20 trở lên.

```bash
npm install
npm run dev        # http://localhost:5290
```

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Chạy bản phát triển |
| `npm run build` | Kiểm tra kiểu TypeScript + build ra `dist/` |
| `npm run preview` | Xem bản build tại http://localhost:5291 |
| `npm test` | Unit test: quy tắc ngẫu nhiên và lưu trữ IndexedDB (Vitest + fake-indexeddb) |
| `npm run e2e` | Kiểm thử bằng trình duyệt thật (cần `npm run dev` đang chạy và Chrome/Edge trên máy) |

`npm run e2e` tự vẽ ảnh thử bằng canvas ngay trong trình duyệt (không dùng ảnh thật) rồi chạy các luồng: nhập ảnh, ảnh trùng, file hỏng, HEIC, GIF, reload, bốc hết một vòng, bấm liên tục, reload giữa hiệu ứng, thêm/xoá ảnh giữa vòng, giảm chuyển động, bàn phím, layout 360px và desktop. Ảnh chụp màn hình nằm trong thư mục tạm của hệ điều hành (đổi bằng biến `E2E_OUT`).

## Deploy lên GitHub Pages

Repo đã có sẵn workflow `.github/workflows/deploy.yml`:

1. Push lên nhánh `main`.
2. Trong repo: **Settings → Pages → Source: GitHub Actions** (chỉ cần làm một lần).
3. Workflow chạy unit test, build với `BASE_PATH=/<tên-repo>/`, chép `index.html` thành `404.html` rồi deploy.

App chỉ có một trang và không dùng router theo URL, nên refresh ở bất kỳ đâu cũng không lỗi 404. Đổi tên repo không cần sửa code vì base path lấy tự động từ `actions/configure-pages`.

## Ảnh của bạn được lưu ở đâu

- **Chỉ trong trình duyệt trên thiết bị bạn đang dùng**, trong IndexedDB: ảnh gốc, thumbnail và metadata ở ba kho riêng, lưu dạng Blob (không base64, không localStorage).
- **Không tải ảnh lên bất kỳ máy chủ nào.** Trang GitHub Pages chỉ phục vụ mã nguồn. Repo và bản build không chứa ảnh cá nhân (`.gitignore` chặn sẵn `my-photos/`, `private/`).
- Ảnh **không tự đồng bộ** giữa các thiết bị hoặc giữa các trình duyệt. iPhone và máy tính là hai khu vườn riêng.
- Ảnh **có thể mất** nếu bạn xoá dữ liệu trang web hoặc lịch sử trình duyệt, dùng tab ẩn danh, hoặc nếu Safari tự dọn dữ liệu của trang không được mở trong thời gian dài. Hãy luôn giữ bản gốc ở nơi khác (Ảnh, Google Photos…).
- Sau lần nhập đầu tiên, app xin trình duyệt quyền lưu lâu dài (`navigator.storage.persist`). Trên iPhone, **thêm app vào Màn hình chính** (Chia sẻ → Thêm vào MH chính) giúp dữ liệu ổn định hơn và mở toàn màn hình với icon riêng.
- Dung lượng tối đa do trình duyệt quyết định (thường vài trăm MB tới vài GB). Khi đầy, app dừng nhập và báo rõ những ảnh chưa nhập được. Phần **Cài đặt** hiển thị dung lượng đang dùng.

## Định dạng ảnh

JPEG, PNG, WebP, tối đa 40 MB mỗi ảnh. HEIC/HEIF chưa hỗ trợ: app báo rõ để bạn đổi sang JPEG. Khi chọn ảnh từ thư viện iPhone, Safari thường tự chuyển HEIC sang JPEG. Ảnh trùng (giống hệt nội dung, so bằng SHA-256) được bỏ qua.

## Quy tắc ngẫu nhiên

- **Không lặp cho đến khi xem hết** (mặc định): shuffle bag dùng Fisher–Yates. Mỗi ảnh xuất hiện đúng một lần mỗi vòng. Thêm ảnh giữa vòng thì ảnh mới vào nhóm chưa mở; xoá ảnh thì mọi tham chiếu (túi, lịch sử, lượt hiện tại) được dọn sạch.
- **Ngẫu nhiên tự do**: có thể lặp, chỉ tránh trùng ngay ảnh vừa xem khi có lựa chọn khác.
- Kết quả được **chọn và khoá trước** khi chạy hiệu ứng. Túi, lượt hiện tại và lịch sử được ghi trong cùng một giao dịch IndexedDB: reload hay đổi tab giữa hiệu ứng không làm mất kết quả và không ghi lịch sử hai lần. Nếu ảnh lỗi không mở được, lượt đó được hoàn lại.

## Cấu trúc mã

```
src/lib/bag.ts        quy tắc ngẫu nhiên (hàm thuần, có unit test)
src/lib/db.ts         IndexedDB (idb): ảnh, thumbnail, lịch sử, trạng thái vòng
src/lib/importer.ts   kiểm tra định dạng, hash, giải mã, tạo thumbnail
src/lib/pixel.ts      mosaic pixel thật trên canvas (thu nhỏ + phóng lớn với smoothing tắt)
src/lib/media.ts      nạp thumbnail mosaic (cache) và ảnh gốc (từng ảnh một)
src/lib/feedback.ts   chime Web Audio + haptic
src/store/garden.tsx  trạng thái React
src/components/       giao diện; animate.ts chạy hiệu ứng bằng requestAnimationFrame / Web Animations
tests/e2e.mjs         kiểm thử trình duyệt
```

Hiệu ứng không dùng thư viện animation: vòng lướt chạy bằng `requestAnimationFrame` (chỉ đổi `transform`/`opacity`, không cập nhật React state theo frame), các chuyển cảnh ngắn dùng Web Animations API. Icon app được tạo từ ảnh viên kim cương (`public/icons`, `public/favicon.ico`).

## Giới hạn hiện tại

- Không có đồng bộ hay sao lưu: dữ liệu gắn với một trình duyệt trên một thiết bị.
- Chưa có xuất/nhập bản sao lưu.
- Chưa có service worker, nên chưa dùng offline hoàn toàn khi mất mạng lần đầu mở.
- Haptic chỉ có trên thiết bị hỗ trợ `navigator.vibrate` (đa số Android; iPhone không hỗ trợ).
