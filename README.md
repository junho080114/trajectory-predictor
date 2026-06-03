# Trajectory Predictor — 실시간 궤적 예측·유도 미사일 시뮬레이션

플레이어 전투기 조작, 드론 AI, 유도 미사일, 칼만/LSTM 예측, Canvas 시각화를 포함한 풀스택 시뮬레이터입니다.

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

## GitHub에 올리기 (본인 저장소)

1. [GitHub](https://github.com/new)에서 새 저장소 생성 (예: `trajectory-predictor`, Public)
2. 프로젝트 폴더에서:

```powershell
cd trajectory-predictor
git init
git add .
git commit -m "Initial commit: trajectory predictor simulation"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/trajectory-predictor.git
git push -u origin main
```

> Git이 없다면 [Git for Windows](https://git-scm.com/download/win) 설치 후 터미널을 다시 엽니다.

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
