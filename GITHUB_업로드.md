# GitHub 업로드 가이드

## 1. Git 설치 (아직 없다면)

https://git-scm.com/download/win  
설치 후 **PowerShell을 새로 열기**.

## 2. GitHub에 빈 저장소 만들기

1. https://github.com/new 접속
2. Repository name: `trajectory-predictor` (원하는 이름)
3. Public 선택 → **Create repository**
4. 생성된 주소 복사 (예: `https://github.com/내아이디/trajectory-predictor.git`)

## 3. 프로젝트 업로드

PowerShell에서 프로젝트 폴더로 이동:

```powershell
cd "C:\Users\User\OneDrive\Desktop\새 폴더\trajectory-predictor"
```

아래에서 `YOUR_USERNAME`을 본인 GitHub 아이디로 바꿉니다.

```powershell
git init
git add .
git commit -m "Trajectory predictor: 유도 미사일 시뮬레이션"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/trajectory-predictor.git
git push -u origin main
```

처음 push 시 GitHub 로그인 창이 뜹니다.

## 4. 다른 PC / 나중에 다시 실행

```powershell
git clone https://github.com/YOUR_USERNAME/trajectory-predictor.git
cd trajectory-predictor
.\setup.bat
.\start.bat
```

브라우저: http://localhost:5173

## 포함된 것 / 제외된 것

| 포함 (저장소) | 제외 (.gitignore) |
|---------------|-------------------|
| 소스 코드 | `backend/venv/` |
| `model.pt` (LSTM) | `frontend/node_modules/` |
| `setup.bat`, `start.bat` | `frontend/dist/` |

`venv`와 `node_modules`는 `setup.bat` 한 번으로 자동 설치됩니다.
