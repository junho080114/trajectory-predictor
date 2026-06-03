# 에어 컴뱃 (Trajectory Predictor)

3D 공중 전투 시뮬레이션 — 플레이어 전투기, 드론 AI, 호밍 미사일, 실시간 WebSocket, Three.js 비주얼.

## 빠른 시작 (Windows)

**필요:** [Python 3.10+](https://www.python.org/downloads/), [Node.js 18+](https://nodejs.org/), [Git](https://git-scm.com/download/win)

```powershell
git clone https://github.com/YOUR_USERNAME/trajectory-predictor.git
cd trajectory-predictor
.\setup.bat    # 최초 1회만 (venv, npm, LSTM 모델)
.\start.bat    # 백엔드 + 프론트 실행
```

브라우저: **http://localhost:5173**

- 조작: **WASD**, **Shift** 부스트, **마우스** 조준
- API 확인: http://127.0.0.1:8000/health → `version: 2`, `drone_count: 2`

## GitHub에 올리기

로컬 Git 커밋은 이미 되어 있습니다. GitHub에 올리려면:

```powershell
cd trajectory-predictor
gh auth login          # 최초 1회: 브라우저로 GitHub 로그인
.\push-to-github.ps1   # 저장소 생성 + 푸시
```

수동으로 할 경우: [github.com/new](https://github.com/new)에서 `trajectory-predictor` 저장소를 만든 뒤:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/trajectory-predictor.git
git push -u origin main
```

다른 PC에서 다시 받을 때:

```powershell
git clone https://github.com/YOUR_USERNAME/trajectory-predictor.git
cd trajectory-predictor
.\setup.bat
.\start.bat
```

## 수동 실행

터미널 1 — Backend:

```powershell
cd backend
.\run_server.bat
```

터미널 2 — Frontend:

```powershell
cd frontend
npm run dev
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React, Vite, Canvas, Tailwind, Zustand |
| Backend | FastAPI, WebSocket, NumPy, SciPy, FilterPy |
| AI | PyTorch LSTM, Kalman Filter |
| Physics | 유도탄(PN), 요격 솔버, swept collision |

## 프로젝트 구조

```
trajectory-predictor/
├── setup.bat / setup.ps1   # 최초 설치
├── start.bat / start.ps1   # 실행
├── frontend/               # React UI
├── backend/
│   ├── main.py
│   ├── simulation_engine.py
│   ├── physics/            # homing, collision, drone_ai
│   ├── prediction/         # kalman, lstm, model.pt
│   └── run_server.bat
└── README.md
```

## API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/health` | 버전·드론 수 확인 |
| GET | `/predict` | 궤적 예측 |
| POST | `/launch` | 미사일 발사 |
| POST | `/sync` | 설정 동기화 |
| WS | `/ws` | 실시간 상태 (30Hz) |

## 라이선스

MIT (교육·연구용)
