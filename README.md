# TrustChat Desktop Universal Builder v1.1.0

Đây là app desktop dùng chung cho mọi website khách hàng đã cài TrustChat.

Khác bản cũ: không cần build riêng theo từng domain. Nhân viên cài một app **TrustChat Desktop**, sau đó nhập website khách hàng hoặc bấm deep-link từ `/trustchat-chat/`.

## Kết quả sau khi build

Windows:

```text
TrustChat-Desktop-Setup-1.1.0.exe
```

Mac:

```text
TrustChat-Desktop-1.1.0.dmg
```

## Cách build Windows đơn giản

1. Cài Node.js LTS.
2. Giải nén thư mục này.
3. Double click:

```text
build-windows-easy.bat
```

File `.exe` sẽ nằm trong thư mục `dist/`.

## Cách build Mac

Cần máy macOS:

```bash
./build-mac-easy.sh
```

File `.dmg` sẽ nằm trong thư mục `dist/`.

## Cách dùng sau khi có file cài

Upload file `.exe` và `.dmg` lên hosting/TrustWeb Center, sau đó dán link vào:

```text
TrustChat → Cài đặt → App PC/Mac
```

Khi nhân viên mở:

```text
https://domain.com/trustchat-chat/
```

PC/Mac sẽ tải app chung, hoặc mở app đã cài qua protocol:

```text
trustchat://open?site=https%3A%2F%2Fdomain.com%2Ftrustchat-app%2F
```

## App hoạt động thế nào?

- Lần đầu mở app: nhập domain website khách hàng.
- App tự chuẩn hoá sang `/trustchat-app/`.
- Lần sau mở app: vào thẳng TrustChat.
- Không phụ thuộc Chrome profile.
- Có thể đổi website trong menu TrustChat → Đổi website.

## Ghi chú

Không nên build `.exe/.dmg` trực tiếp trên hosting WordPress. Hãy build app này một lần trên máy Windows/Mac của TrustWeb, rồi dùng chung cho toàn bộ khách hàng.
