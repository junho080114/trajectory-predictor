# Render 배포 가이드

## 지금 화면이 "WELCOME TO RENDER" 에서 멈춘 이유

이 화면은 **앱이 아직 안 떠 있을 때** Render가 보여주는 대기 화면입니다.

| 상황 | 정상? |
|------|--------|
| 첫 접속 후 **1~2분** 대기 | 무료 플랜 콜드 스타트 (정상) |
| **몇 시간** 그대로 | **배포 실패** — 앱이 한 번도 안 켜진 상태 |

몇 시간 멈춰 있으면 **빌드/시작 명령이 잘못됐거나**, **Static Site로 만들었거나**, **PyTorch 설치가 실패**한 경우가 많습니다.

---

## 1단계: Render 로그 확인

1. [Render Dashboard](https://dashboard.render.com) → 해당 서비스 클릭
2. **Logs** 탭
3. 빨간 `Build failed` / `Exited with status` / `ModuleNotFoundError` 있는지 확인

로그에 아무것도 없고 Deploy가 `Failed`면 설정이 틀린 것입니다.

---

## 2단계: 서비스 다시 만들기 (권장)

기존 서비스 삭제 후, 아래대로 **Web Service** 하나만 만듭니다.

### A) Blueprint (가장 쉬움)

1. GitHub에 최신 코드 push ( `render.yaml` 포함 )
2. Render → **New** → **Blueprint**
3. `junho080114/trajectory-predictor` 연결
4. **Apply** → 자동 배포

### B) 수동 설정

| 항목 | 값 |
|------|-----|
| Type | **Web Service** (Static Site 아님!) |
| Repository | `trajectory-predictor` |
| Branch | `main` |
| Root Directory | *(비워 둠 — 프로젝트 루트)* |
| Runtime | **Python 3** |
| Build Command | `bash scripts/render-build.sh` |
| Start Command | `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |

**Environment Variables (선택):**

| Key | Value |
|-----|-------|
| `PYTHON_VERSION` | `3.12.8` |
| `NODE_VERSION` | `22.12.0` |

---

## 3단계: 배포 성공 확인

배포가 **Live** 되면:

- `https://당신서비스.onrender.com/health` → JSON (`version: 4`)
- `https://당신서비스.onrender.com` → 게임 화면

---

## 자주 하는 실수

| 실수 | 결과 |
|------|------|
| **Static Site**로 생성 | Python 서버가 없어서 영원히 대기 화면 |
| Start: `python main.py` | 포트 `$PORT` 미사용 → 헬스체크 실패 |
| Root Directory: `frontend`만 | 백엔드 없음 |
| `setup.ps1` / `start.bat`을 Start Command로 | Windows 전용, Render(Linux)에서 안 됨 |
| Build 없이 Deploy | `venv`/`node_modules` 없음 |

---

## 무료 플랜 참고

- **15분 미사용** 시 슬립 → 다음 접속 시 30초~2분 깨어남 (정상)
- 빌드에 **PyTorch** 포함 → 첫 빌드 **10~20분** 걸릴 수 있음
- 메모리 부족 시 **Starter($7)** 플랜 고려

---

## 로컬 vs Render

| | 로컬 | Render |
|--|------|--------|
| 실행 | `setup.bat` + `start.bat` | Git push → 자동 빌드 |
| URL | localhost:5173 | `*.onrender.com` |
| 프론트+백엔드 | 포트 2개 | **한 서비스**에 합침 |
