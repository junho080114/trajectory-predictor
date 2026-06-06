from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from models.schemas import LaunchRequest, LaunchResponse, SimulationConfig
from runtime_profile import BROADCAST_HZ, CLOUD_LITE, IDLE_SLEEP_SEC, SIM_HZ
from simulation_engine import SimulationEngine

engine = SimulationEngine()
ws_clients: List[WebSocket] = []
SIM_DT = 1.0 / SIM_HZ
BROADCAST_INTERVAL = 1.0 / BROADCAST_HZ


def _ws_json(payload: dict) -> str:
    return json.dumps({"type": "state", "payload": payload}, separators=(",", ":"))


async def simulation_loop() -> None:
    accum = 0.0
    while True:
        if CLOUD_LITE and not ws_clients:
            await asyncio.sleep(IDLE_SLEEP_SEC)
            continue

        loop_start = asyncio.get_event_loop().time()
        try:
            if engine.config.paused and engine.config.player_control:
                engine.config.paused = False
            engine.step(SIM_DT)
        except Exception as exc:
            print(f"[sim] step error: {exc}")
        accum += SIM_DT
        if ws_clients and accum >= BROADCAST_INTERVAL:
            accum = 0.0
            payload = engine.to_ws_payload()
            message = _ws_json(payload)
            dead: List[WebSocket] = []
            for ws in ws_clients:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                if ws in ws_clients:
                    ws_clients.remove(ws)
        elapsed = asyncio.get_event_loop().time() - loop_start
        await asyncio.sleep(max(0.0, SIM_DT - elapsed))


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine.config.player_control = True
    engine.config.ai_targets = True
    engine.config.use_kalman = True
    engine.restart()
    engine.ensure_drones()
    task = asyncio.create_task(simulation_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Trajectory Predictor API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/predict")
def get_predict(
    target_id: str = Query(default="target-0"),
    horizon: float = Query(default=2.0, ge=0.1, le=10.0),
):
    engine.select_target(target_id)
    result = engine.get_prediction_result(horizon)
    return result.model_dump()


@app.post("/launch", response_model=LaunchResponse)
def post_launch(req: LaunchRequest):
    engine.config.muzzle_velocity = req.muzzle_velocity
    engine.select_target(req.target_id)
    launched = engine.launch(req.target_id)
    intercept = engine.last_intercept
    return LaunchResponse(
        launched=launched,
        intercept=intercept,
        projectile_id=next(iter(engine.projectiles), ""),
    )


@app.get("/health")
def health_check():
    drones = sum(1 for t in engine.targets.values() if t.is_drone or t.id.startswith("drone-"))
    return {
        "version": 4,
        "game_mode": True,
        "cloud_lite": CLOUD_LITE,
        "targets": list(engine.targets.keys()),
        "drone_count": drones,
        "player_control": engine.config.player_control,
        "ai_targets": engine.config.ai_targets,
    }


@app.get("/status")
def get_status():
    return engine.get_status()


@app.post("/config")
def update_config(config: SimulationConfig):
    engine.update_config(config.model_dump())
    return engine.config.model_dump()


@app.post("/input")
async def post_player_input(payload: Dict[str, Any]):
    """동기 입력은 이벤트 루프를 막지 않도록 스레드에서 처리."""
    def _apply() -> None:
        engine.apply_player_input(
            move_x=float(payload.get("move_x", 0)),
            move_y=float(payload.get("move_y", 0)),
            move_forward=float(payload.get("move_forward", 0)),
            move_strafe=float(payload.get("move_strafe", 0)),
            move_vertical=float(payload.get("move_vertical", 0)),
            throttle_input=float(payload.get("throttle_input", 0)),
            boost=bool(payload.get("boost", False)),
            view_yaw=float(payload.get("view_yaw", 0)),
            view_pitch=float(payload.get("view_pitch", 0)),
            yaw_rate=float(payload.get("yaw_rate", 0)),
            pitch_rate=float(payload.get("pitch_rate", 0)),
        )

    await asyncio.to_thread(_apply)
    return {"ok": True}


@app.post("/restart")
def restart_simulation():
    engine.restart()
    engine.ensure_drones()
    return {
        "ok": True,
        "targets": list(engine.targets.keys()),
        "drone_count": sum(1 for t in engine.targets.values() if t.is_drone or t.id.startswith("drone-")),
    }


@app.post("/sync")
def sync_simulation(config: SimulationConfig):
    engine.sync_config(config.model_dump())
    return {
        "ok": True,
        "targets": list(engine.targets.keys()),
        "drone_count": sum(1 for t in engine.targets.values() if t.is_drone or t.id.startswith("drone-")),
    }


@app.post("/select/{target_id}")
def select_target(target_id: str):
    ok = engine.select_target(target_id)
    return {"ok": ok, "selected": target_id}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    ws_clients.append(websocket)
    engine.ensure_drones()
    try:
        await websocket.send_text(_ws_json(engine.to_ws_payload()))
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type", "")
            payload: Dict[str, Any] = data.get("payload", {})
            if msg_type == "config":
                prev_ai = engine.config.ai_targets
                prev_pc = engine.config.player_control
                engine.update_config(payload)
                if payload.get("ai_targets") != prev_ai or payload.get("player_control") != prev_pc:
                    engine.restart()
            elif msg_type == "sync":
                engine.update_config(payload)
                engine.ensure_drones()
                if payload.get("player_control") and not engine.targets:
                    engine.restart()
            elif msg_type == "launch":
                engine.launch(payload.get("target_id"))
            elif msg_type == "select":
                engine.select_target(payload.get("target_id", "target-0"))
            elif msg_type == "restart":
                engine.restart()
            elif msg_type == "pause":
                engine.config.paused = bool(payload.get("paused", False))
            elif msg_type == "input":
                engine.apply_player_input(
                    move_x=float(payload.get("move_x", 0)),
                    move_y=float(payload.get("move_y", 0)),
                    move_forward=float(payload.get("move_forward", 0)),
                    move_strafe=float(payload.get("move_strafe", 0)),
                    move_vertical=float(payload.get("move_vertical", 0)),
                    throttle_input=float(payload.get("throttle_input", 0)),
                    boost=bool(payload.get("boost", False)),
                    view_yaw=float(payload.get("view_yaw", 0)),
                    view_pitch=float(payload.get("view_pitch", 0)),
                    yaw_rate=float(payload.get("yaw_rate", 0)),
                    pitch_rate=float(payload.get("pitch_rate", 0)),
                )
            elif msg_type == "fire":
                result = engine.player_try_fire()
                await websocket.send_text(
                    json.dumps({"type": "fire_result", "payload": result})
                )
            elif msg_type == "game_mode":
                engine.sync_config(payload)
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in ws_clients:
            ws_clients.remove(websocket)


# Render / production: serve Vite build from same host (API + game UI)
_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    _assets = _FRONTEND_DIST / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets), name="frontend-assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(_FRONTEND_DIST / "index.html")

    @app.get("/{spa_path:path}")
    async def serve_spa(spa_path: str):
        candidate = _FRONTEND_DIST / spa_path
        if spa_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")
