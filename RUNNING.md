# Hướng dẫn chạy GymFixer

Dự án chạy theo mô hình:

- Backend: chạy bằng Docker Compose để tránh lỗi môi trường Python/CUDA/MediaPipe.
- Database: PostgreSQL chạy trong Docker Compose.
- Frontend: chạy local bằng Next.js, không chạy bằng Docker.

---

## 1. Yêu cầu cài sẵn

Cần có:

- Docker Desktop
- Node.js 18+ hoặc mới hơn
- npm
- Git

Khuyến nghị kiểm tra nhanh:

```powershell
docker --version
docker compose version
node --version
npm --version
```

---

## 2. File môi trường `.env`

Tạo file `.env` ở root dự án:

```text
D:\gymfixer\.env
```

Các biến tối thiểu cần có:

```env
DATABASE_URL=postgresql://gymfixer:gymfixer_password@postgres:5432/gymfixer
JWT_SECRET_KEY=dev-local-change-me
FRONTEND_URL=http://localhost:3000
AUTH_EMAIL_VERIFICATION_ENABLED=false
POSE_BACKEND=mediapipe
```

Nếu dùng AI Coaching bằng Gemini, thêm:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3-flash-preview
```

Lưu ý:

- Không commit `.env` lên Git.
- `.env` đã nằm trong `.gitignore`.
- Nên giữ `.env.example` để người khác biết cần biến gì.

---

## 3. Chạy backend bằng Docker

Mở PowerShell tại root dự án:

```powershell
cd D:\gymfixer
```

Build và chạy lần đầu:

```powershell
docker compose -f docker-compose1.yml up --build -d
```

Các lần sau chỉ cần:

```powershell
docker compose -f docker-compose1.yml up -d
```

Kiểm tra container:

```powershell
docker ps
```

Kết quả mong muốn:

```text
project1-backend    Up ... healthy    0.0.0.0:5000->5000/tcp
project1-postgres   Up ... healthy    0.0.0.0:5432->5432/tcp
```

Mở backend docs:

```text
http://localhost:5000/docs
```

---

## 4. Xem log backend

Xem log backend:

```powershell
docker logs project1-backend
```

Xem realtime:

```powershell
docker logs -f project1-backend
```

Xem 100 dòng cuối:

```powershell
docker logs --tail 100 project1-backend
```

Xem bằng compose:

```powershell
docker compose -f docker-compose1.yml logs -f backend
```

Xem backend và PostgreSQL cùng lúc:

```powershell
docker compose -f docker-compose1.yml logs -f
```

---

## 5. Dừng backend

Dừng chỉ backend:

```powershell
docker compose -f docker-compose1.yml stop backend
```

Dừng cả backend và PostgreSQL:

```powershell
docker compose -f docker-compose1.yml down
```

Dừng và xóa volume database local:

```powershell
docker compose -f docker-compose1.yml down -v
```

Cẩn thận: `down -v` xóa dữ liệu PostgreSQL local.

---

## 6. Chạy frontend local

Mở terminal khác:

```powershell
cd D:\gymfixer\frontend
npm install
npm run dev
```

Mở frontend:

```text
http://localhost:3000
```

Có thể chạy từ root:

```powershell
cd D:\gymfixer
npm run frontend
```

---

## 7. Lệnh chạy nhanh hằng ngày

Terminal 1 — backend:

```powershell
cd D:\gymfixer
docker compose -f docker-compose1.yml up -d
```

Terminal 2 — frontend:

```powershell
cd D:\gymfixer\frontend
npm run dev
```

Mở:

```text
http://localhost:3000
```

---

## 8. Khi nào cần `--build` lại Docker?

Cần build lại backend khi sửa các file như:

- `backend/Dockerfile`
- `backend/requirements.txt`
- dependency Python
- cấu hình hệ thống trong image

Lệnh build lại:

```powershell
docker compose -f docker-compose1.yml up --build -d
```

Nếu chỉ sửa code frontend, không cần build Docker.

Nếu chỉ sửa code backend Python, image hiện tại copy code vào image nên nên build lại:

```powershell
docker compose -f docker-compose1.yml up --build -d backend
```

---

## 9. Troubleshooting frontend

### Lỗi: `Could not find a production build in the '.next' directory`

Nguyên nhân: chạy production server `next start` khi chưa build.

Fix cho dev:

```powershell
cd D:\gymfixer\frontend
npm run dev
```

Nếu muốn chạy production:

```powershell
cd D:\gymfixer\frontend
npm run build
npm start
```

Trong dự án hiện tại, khuyến nghị dùng `npm run dev`.

---

### Lỗi: `.next\dev\lock`, port 3000 đang bị dùng

Nguyên nhân: còn process Next.js cũ đang chạy.

Fix nhanh:

```powershell
Get-Process node
Stop-Process -Id <PID> -Force
Remove-Item -Recurse -Force .next
npm run dev
```

Nếu log báo port 3000 đang dùng nhưng app vẫn chạy port 3001, mở:

```text
http://localhost:3001
```

---

### Lỗi: `package.json is not parseable` hoặc ký tự `﻿` đầu file

Nguyên nhân: `package.json` bị lưu UTF-8 with BOM.

Fix bằng PowerShell:

```powershell
$path = "D:\gymfixer\frontend\package.json"
$json = Get-Content -Path $path -Raw -Encoding UTF8 | ConvertFrom-Json
$content = $json | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
Remove-Item -Path "D:\gymfixer\frontend\.next" -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```

---

## 10. Troubleshooting backend Docker

### Lỗi NVIDIA/CUDA

Lỗi thường gặp:

```text
nvidia-container-cli: requirement error: unsatisfied condition: cuda>=13.0
```

Nguyên nhân: Docker image yêu cầu CUDA cao hơn driver NVIDIA trên máy.

Fix hiện tại trong dự án:

- `backend/Dockerfile` dùng CUDA 12.4:

```dockerfile
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04
```

- `docker-compose1.yml` không ép GPU reservation để tránh NVIDIA prestart hook.

Nếu vẫn lỗi, rebuild:

```powershell
docker compose -f docker-compose1.yml up --build -d
```

---

### Backend không healthy

Xem log:

```powershell
docker logs --tail 200 project1-backend
```

Kiểm tra docs:

```text
http://localhost:5000/docs
```

Kiểm tra container:

```powershell
docker ps -a --filter "name=project1"
```

---

### Database lỗi hoặc muốn reset dữ liệu local

Dừng và xóa volume:

```powershell
docker compose -f docker-compose1.yml down -v
```

Chạy lại:

```powershell
docker compose -f docker-compose1.yml up -d
```

Cẩn thận: lệnh này xóa dữ liệu PostgreSQL local.

---

## 11. Git trước khi push

Không commit:

```text
.env
.venv/
frontend/.next/
node_modules/
backend/model/
test_video/
*.mp4
```

Kiểm tra trước khi commit:

```powershell
git status --short
```

Nếu `.env` xuất hiện trong status, không commit.

---

## 12. Tóm tắt cực nhanh

```powershell
cd D:\gymfixer
docker compose -f docker-compose1.yml up -d
```

```powershell
cd D:\gymfixer\frontend
npm run dev
```

Mở:

```text
http://localhost:3000
```
