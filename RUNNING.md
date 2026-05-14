# Hướng dẫn chạy dự án

## Yêu cầu

- Python 3.10+ với virtual env `p1_env` (đã có trong repo)
- Node.js 18+
- ngrok (nếu muốn share ra ngoài)
- cloudflared (nếu muốn share bằng Cloudflare Tunnel)

---

## 1. Chạy local (chỉ mình dùng)

### Terminal 1 — Backend

```bash
cd /path/to/project/backend
../p1_env/bin/uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

### Terminal 2 — Frontend dev server

```bash
cd /path/to/project/frontend
npm run dev
```

Mở trình duyệt: **http://localhost:8080**

> WebSocket tự kết nối tới backend tại `ws://localhost:5000/ws/posture`

> Lưu ý: `localhost` chỉ đúng trên chính máy đang chạy backend/frontend. Máy
> khác trong cùng Wi-Fi không thể dùng `localhost` để trỏ về máy của bạn.

---

## 1.1. Cho laptop/điện thoại khác trong cùng Wi-Fi vào test

### Cách khuyên dùng: chạy single-port bằng backend

Build frontend rồi để backend serve luôn giao diện:

```bash
cd /path/to/project/frontend
npm run build

cd /path/to/project/backend
../p1_env/bin/uvicorn main:app --host 0.0.0.0 --port 5000
```

Lấy IP LAN của máy đang chạy server:

```bash
hostname -I
```

Ví dụ IP là `192.168.1.20`, mở trên laptop/điện thoại khác:

```text
http://192.168.1.20:5000
```

Vì frontend và backend cùng port `5000`, WebSocket sẽ tự đi đúng về:

```text
ws://192.168.1.20:5000/ws/posture
```

### Nếu vẫn muốn dùng frontend dev server `:8080`

Tạo file `frontend/.env.local`:

```bash
VITE_WS_URL=ws://192.168.1.20:5000/ws/posture
VITE_API_URL=http://192.168.1.20:5000
```

Sau đó chạy lại frontend:

```bash
cd /path/to/project/frontend
npm run dev
```

Mở máy khác:

```text
http://192.168.1.20:8080
```

Nếu không set `VITE_WS_URL`, máy khác mở `:8080` sẽ dễ bị lỗi WebSocket vì app
có thể tìm `/ws/posture` trên port `8080` thay vì backend port `5000`.

### Camera trên máy khác

Trình duyệt thường chỉ cho dùng camera trên:

- `localhost`
- hoặc trang `HTTPS`

Vì vậy nếu mở bằng `http://192.168.x.x:5000`, có thể giao diện vào được nhưng
camera bị chặn. Để test camera từ máy khác, dùng ngrok hoặc Cloudflare Tunnel
ở mục 2/3 để có link `https://...`.

---

## 2. Share cho người khác qua ngrok

### Bước 1 — Build frontend (chạy 1 lần, hoặc sau khi sửa code)

```bash
cd /path/to/project/frontend
npm run build
```

Kết quả: tạo thư mục `frontend/dist/` — backend sẽ tự serve thư mục này.

### Bước 2 — Chạy backend

```bash
cd /path/to/project/backend
../p1_env/bin/uvicorn main:app --host 0.0.0.0 --port 5000
```

Kiểm tra tại **http://localhost:5000** — nếu thấy giao diện web là OK.

### Bước 3 — Mở ngrok tunnel

```bash
ngrok http 5000
```

Copy link dạng `https://xxxx.ngrok-free.app` → gửi cho người khác.

> **Lưu ý:** Lần đầu vào link ngrok sẽ hiện trang warning → bấm **"Visit Site"** là qua.
> Link thay đổi mỗi lần restart ngrok. Nếu muốn link cố định → xem mục bên dưới.

---

## 3. Link cố định (không cần trả tiền ngrok)

Dùng **Cloudflare Tunnel** (miễn phí, link cố định):

### Cách nhanh bằng npm script

Từ repo root:

```bash
npm run share:cloudflare
```

Script này sẽ:

- build frontend
- chạy backend single-port tại `http://localhost:5000`
- mở Cloudflare Tunnel tới `http://localhost:5000`

Copy link dạng `https://something.trycloudflare.com`.

### Cách thủ công

```bash
# Cài cloudflared
yay -S cloudflared   # hoặc: sudo pacman -S cloudflared

# Chạy (không cần tài khoản cho quick tunnel)
cloudflared tunnel --config cloudflared-quick.yml --url http://127.0.0.1:5000
```

Sẽ hiện link dạng `https://something.trycloudflare.com` — cố định trong session.

### Windows

Có thể chạy file:

```bat
start-cloudflare.bat
```

---

## Tóm tắt lệnh nhanh

```bash
# === Build frontend (1 lần) ===
cd frontend && npm run build && cd ..

# === Chạy backend ===
cd backend && ../p1_env/bin/uvicorn main:app --host 0.0.0.0 --port 5000

# === Expose ra ngoài (terminal khác) ===
ngrok http 5000
# hoặc
cloudflared tunnel --config cloudflared-quick.yml --url http://127.0.0.1:5000
```

Hoặc chạy Cloudflare một lệnh từ repo root:

```bash
npm run share:cloudflare
```

Nếu chạy bằng script ở repo root:

```bash
npm start
```

Script này chạy chế độ dev frontend `:8080` và backend `:5000`. Nếu muốn share
ra ngoài, khuyên dùng `npm run share:cloudflare` để frontend/backend đi chung
port `5000`.

Nếu vẫn muốn tự mở tunnel khi đang chạy backend port `5000`:

```bash
ngrok http 5000
# hoặc
npm run tunnel:cloudflare
```

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| `connection refused` khi dùng ngrok | ngrok trỏ sai port | Đảm bảo backend chạy trên port 5000 và `ngrok http 5000` |
| `lookup connect.ngrok-agent.com: i/o timeout` hoặc ngrok không tạo URL | Máy/mạng không resolve hoặc không kết nối được server ngrok | Kiểm tra DNS/mạng/VPN/firewall. Thử mạng khác, đổi DNS sang `1.1.1.1` hoặc `8.8.8.8`, hoặc dùng Cloudflare Tunnel |
| Camera không hoạt động | Trang dùng HTTP, không HTTPS | Dùng ngrok/cloudflare (tự có HTTPS) hoặc localhost |
| `No module named mediapipe` | Sai Python env | Dùng `../p1_env/bin/uvicorn`, không dùng `uvicorn` hệ thống |
| Frontend không load | Chưa build | Chạy `cd frontend && npm run build` trước |
| WebSocket lỗi trên máy khác | Frontend chưa rebuild sau khi sửa code | Rebuild frontend |
| Signup/Login báo `NetworkError when attempting to fetch resource` | Frontend gọi sai backend URL/port | Backend phải chạy port 5000. Nếu dùng frontend dev `:8080`, set `VITE_API_URL=http://<IP-server>:5000` trong `frontend/.env.local` rồi restart `npm run dev` |
