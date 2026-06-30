# Huong dan chay GymFixer

Tai lieu nay khop voi cau truc hien tai cua repo tai:

```powershell
D:\racs\gymfixer
```

Mo hinh chay khuyen nghi:

- PostgreSQL va backend FastAPI chay bang Docker Compose.
- Frontend Next.js chay local bang npm.
- File compose dung trong repo la `docker-compose.yml`.

> Luu y: tai thoi diem cap nhat tai lieu nay, `.env.example` dang bi xoa trong working tree. Neu can, tao lai `.env` theo mau o muc 2.

---

## 1. Yeu cau cai san

Can co:

- Docker Desktop, gom lenh `docker`
- Node.js 18+ hoac moi hon
- npm
- Git

Kiem tra nhanh:

```powershell
docker --version
docker compose version
node --version
npm --version
git --version
```

Neu PowerShell bao `docker : The term 'docker' is not recognized`, may chua cai Docker Desktop hoac Docker chua nam trong `PATH`. Cai/mo Docker Desktop, mo lai terminal, roi chay lai lenh kiem tra.

---

## 2. File moi truong `.env`

Tao file `.env` o root du an:

```text
D:\racs\gymfixer\.env
```

Bien toi thieu de backend Docker noi toi PostgreSQL trong compose:

```env
DATABASE_URL=postgresql+psycopg://gymfixer:gymfixer_password@postgres:5432/gymfixer
JWT_SECRET_KEY=dev-local-change-me
FRONTEND_URL=http://localhost:3000
AUTH_EMAIL_VERIFICATION_ENABLED=false
POSE_BACKEND=mediapipe
```

Neu dung Google auth:

```env
GOOGLE_CLIENT_ID=your-google-client-id # dung de nhap vao Supabase Google provider
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Google OAuth chay qua Supabase Hosted Dashboard: bat Authentication > Providers > Google,
nhap Google Client ID/Client Secret trong Dashboard, va them redirect URL ve
`http://localhost:3000/auth/callback` khi chay local.

Neu dung Gemini cho AI coaching hoac weekly planning:

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3-flash-preview
GEMINI_MAX_OUTPUT_TOKENS=12000
POSTURE_LLM_MAX_LOG_FRAMES=60
```

Neu test posture/video analysis, co the them cac bien tuy chinh:

```env
POSTURE_SUBJECT_READY_MIN_FRAMES=10
POSTURE_SUBJECT_MIN_BBOX_AREA=0.035
POSTURE_SUBJECT_MIN_BBOX_WIDTH=0.12
POSTURE_SUBJECT_MIN_BBOX_HEIGHT=0.20
MP_MIN_DET_CONF=0.5
MP_MIN_TRACK_CONF=0.5
MP_VIS_THRESHOLD=0.5
```

Khong commit `.env`.

---

## 3. Cai dependencies

Tu root repo:

```powershell
cd D:\racs\gymfixer
npm install
npm --prefix frontend install
```

Neu muon chay backend local khong Docker, cai Python dependencies:

```powershell
python -m pip install -r backend\requirements.txt
```

Backend local can PostgreSQL local rieng va `DATABASE_URL` tro toi host local, khac voi Docker URL trong muc 2.

---

## 4. Chay backend va database bang Docker Compose

Mo PowerShell tai root:

```powershell
cd D:\racs\gymfixer
```

Lan dau hoac sau khi doi Dockerfile/dependency:

```powershell
docker compose up --build -d
```

Nhung lan chay hang ngay:

```powershell
docker compose up -d
```

Kiem tra service:

```powershell
docker compose ps
```

Ky vong:

```text
project1-postgres   running/healthy
project1-backend    running/healthy, port 5000
```

Mo backend docs:

```text
http://localhost:5000/docs
```

---

## 5. Chay frontend local

Mo terminal thu hai:

```powershell
cd D:\racs\gymfixer
npm --prefix frontend run dev
```

Hoac:

```powershell
cd D:\racs\gymfixer\frontend
npm run dev
```

Mo frontend:

---

## 6. Build va push backend image len Docker Hub

Dang nhap Docker Hub truoc:

```powershell
docker login
```

Tu root repo, build va push backend image bang `backend/Dockerfile.cpu`:

```powershell
$env:DOCKERHUB_USER="your-dockerhub-user"
npm run docker:push:backend
```

Mac dinh script se push 2 tag:

- `your-dockerhub-user/gymfixer-backend:latest`
- `your-dockerhub-user/gymfixer-backend:<git-sha>`

Neu chi muon push `latest`:

```powershell
$env:DOCKERHUB_USER="your-dockerhub-user"
$env:PUSH_SHA_TAG="0"
npm run docker:push:backend
```

Neu muon doi image name hoac tag:

```powershell
$env:DOCKERHUB_USER="your-dockerhub-user"
$env:IMAGE_NAME="gymfixer-backend"
$env:TAG="latest"
npm run docker:push:backend
```

Sau do tren server:

```powershell
docker pull your-dockerhub-user/gymfixer-backend:latest
```

Neu server dang chay bang compose, sua `image:` roi cap nhat:

```powershell
docker compose pull backend
docker compose up -d backend
```

```text
http://localhost:3000
```

Frontend mac dinh goi backend tai `http://localhost:5000`. Neu can doi backend URL:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL="http://localhost:5000"
npm --prefix frontend run dev
```

---

## 6. Lenh nhanh hang ngay

Terminal 1:

```powershell
cd D:\racs\gymfixer
docker compose up -d
```

Terminal 2:

```powershell
cd D:\racs\gymfixer
npm --prefix frontend run dev
```

Mo:

```text
http://localhost:3000
http://localhost:5000/docs
```

---

## 7. Chay bang npm scripts tu root

Repo co cac script:

```powershell
npm run frontend
npm run backend
npm run dev
npm run build:frontend
```

`npm run backend` chay FastAPI local bang:

```powershell
python -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload --reload-dir backend --app-dir backend
```

Chi dung script backend local khi da co PostgreSQL local va `DATABASE_URL` phu hop. Voi setup Docker, uu tien `docker compose up -d`.

---

## 8. Xem log va kiem tra backend

Xem log backend:

```powershell
docker logs project1-backend
```

Xem realtime:

```powershell
docker logs -f project1-backend
```

Xem 100 dong cuoi:

```powershell
docker logs --tail 100 project1-backend
```

Xem qua compose:

```powershell
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f
```

Kiem tra docs:

```text
http://localhost:5000/docs
```

---

## 9. Dung, restart, reset database

Dung backend va database:

```powershell
docker compose down
```

Restart:

```powershell
docker compose restart
```

Rebuild backend:

```powershell
docker compose up --build -d backend
```

Xoa ca database volume local:

```powershell
docker compose down -v
```

Can than: `down -v` xoa du lieu PostgreSQL local.

---

## 10. Test va build

Smoke test weekly planning:

```powershell
python backend\smoke_weekly_planning.py
```

Lint frontend:

```powershell
npm --prefix frontend run lint
```

Build frontend:

```powershell
npm run build:frontend
```

---

## 11. Troubleshooting

### Docker command khong ton tai

Loi:

```text
docker : The term 'docker' is not recognized
```

Fix:

1. Cai Docker Desktop.
2. Mo Docker Desktop va doi engine ready.
3. Dong/mo lai PowerShell.
4. Chay lai:

```powershell
docker --version
docker compose version
```

### Backend khong healthy

Xem container:

```powershell
docker compose ps
docker compose logs --tail 200 backend
```

Neu loi env, kiem tra `.env` co `DATABASE_URL`, `JWT_SECRET_KEY`, `FRONTEND_URL`.

### Database bi loi hoac muon reset

```powershell
docker compose down -v
docker compose up -d
```

Can than vi se xoa database local.

### Frontend port 3000 dang bi dung

Kiem tra Node process:

```powershell
Get-Process node
```

Dung process cu:

```powershell
Stop-Process -Id <PID> -Force
```

Neu Next tu chuyen sang port 3001, mo:

```text
http://localhost:3001
```

### Loi Next production build

Neu gap:

```text
Could not find a production build in the '.next' directory
```

Dung dev server:

```powershell
npm --prefix frontend run dev
```

Hoac build truoc khi chay production:

```powershell
npm --prefix frontend run build
npm --prefix frontend run start
```

Luu y: script `frontend:start` hien tai van la `next dev`, nen dev flow uu tien `npm --prefix frontend run dev`.

---

## 12. Truoc khi commit

Kiem tra:

```powershell
git status --short
```

Khong commit:

```text
.env
.venv/
frontend/.next/
node_modules/
backend/model/
test_video/
*.mp4
```

---

## 13. Tom tat cuc nhanh

```powershell
cd D:\racs\gymfixer
docker compose up -d
npm --prefix frontend run dev
```

Mo:

```text
http://localhost:3000
http://localhost:5000/docs
```
