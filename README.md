# 에어 컴뱃 (Trajectory Predictor)



3D 공중 전투 시뮬레이션 — 플레이어 전투기, 드론 AI, 호밍 미사일, WebSocket, Three.js.



## GitHub에서 받은 뒤 실행 (Windows)



**필요:** Python 3.10+, Node.js 18+, 인터넷(최초 설치 시 PyTorch 다운로드)



```powershell

git clone https://github.com/junho080114/trajectory-predictor.git

cd trajectory-predictor

```



### 방법 A — 한 번에 (권장)



탐색기에서 **`install-and-run.bat`** 더블클릭  

또는 PowerShell:



```powershell

.\install-and-run.bat

```



### 방법 B — 나눠서



```powershell

.\setup.bat      # 최초 1회 (venv + npm, 5~15분)

.\start.bat      # 백엔드 + 프론트 실행

```



> **ZIP으로 받았어도 동일합니다.** `venv`와 `node_modules`는 GitHub에 없으므로 **반드시 setup 한 번**이 필요합니다.



### 브라우저



| 주소 | 용도 |

|------|------|

| **http://localhost:5173** | **게임 화면 (여기로 접속)** |

| http://127.0.0.1:8000/health | API 상태 확인 (`version: 4`) |



1. `5173` 접속 → **전투 시작** 클릭  

2. 화면 한 번 클릭(포인터 잠금)  

3. **WASD**, 마우스 시야, **좌클릭/F** 기관포



## 안 될 때 (자주 나는 경우)



| 증상 | 원인 | 해결 |

|------|------|------|

| `먼저 setup.ps1 을 실행하세요` | setup 안 함 | `.\setup.bat` 또는 `install-and-run.bat` |

| `ERR_CONNECTION_REFUSED` (5173) | 프론트 미실행 | `start.bat` 후 **5173** 접속 (8000 아님) |

| `python` / `npm` 인식 안 됨 | PATH 미설정 | Python·Node 재설치 후 **PowerShell 새로 열기** |

| pip / torch 설치 실패 | Python 너무 새거나 오래됨 | **Python 3.10~3.12** 권장 |

| 백엔드 창 바로 닫힘 | venv 없음 | `.\setup.bat` 완료 후 `start.bat` |

| 화면만 검정 / 연결 끊김 | 백엔드 꺼짐 | 백엔드 PowerShell 창에 오류 있는지 확인 |



환경 점검:



```powershell

.\check-setup.ps1

```



## 수동 실행



터미널 1:



```powershell

cd backend

.\run_server.bat

```



터미널 2:



```powershell

cd frontend

npm run dev

```



## 로컬 수정 → 사이트 자동 반영

| 방법 | 실행 |
|------|------|
| **자동 (권장)** | `start-sync-watch.bat` 실행 후 Cursor에서 작업 — 저장하면 자동 push |
| **수동 1회** | `sync-to-site.bat` — 지금 변경분만 push |

흐름: **저장 → GitHub push → Render 자동 배포 (10~20분)**

## Render(클라우드) 배포

자세한 내용: **`RENDER_배포.md`**

- 서비스 타입: **Web Service** (Static Site 아님)
- Build: `bash scripts/render-build.sh`
- Start: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- 또는 `render.yaml` Blueprint 사용

> "WELCOME TO RENDER"가 **몇 시간** 멈추면 배포 실패입니다. Dashboard → **Logs** 확인.

## GitHub에 올리기



```powershell

.\push-to-github.ps1

```



자세한 내용: `GITHUB_업로드.md`



## 기술 스택



| 영역 | 기술 |

|------|------|

| Frontend | React, Vite, Three.js, Tailwind, Zustand |

| Backend | FastAPI, WebSocket, NumPy, SciPy, FilterPy, PyTorch |



## 라이선스



MIT (교육·연구용)

