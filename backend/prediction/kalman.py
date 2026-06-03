from __future__ import annotations

import numpy as np
from filterpy.kalman import KalmanFilter


class TargetKalmanFilter:
    def __init__(self, dt: float = 1.0 / 60.0) -> None:
        self.dt = dt
        self.kf = KalmanFilter(dim_x=4, dim_z=2)
        self.kf.x = np.array([0.0, 0.0, 0.0, 0.0])
        self.kf.F = np.array(
            [
                [1, 0, dt, 0],
                [0, 1, 0, dt],
                [0, 0, 1, 0],
                [0, 0, 0, 1],
            ],
            dtype=float,
        )
        self.kf.H = np.array(
            [
                [1, 0, 0, 0],
                [0, 1, 0, 0],
            ],
            dtype=float,
        )
        self.kf.P *= 500.0
        self.kf.R = np.eye(2) * 8.0
        self.kf.Q = np.array(
            [
                [0.1, 0, 0, 0],
                [0, 0.1, 0, 0],
                [0, 0, 1.0, 0],
                [0, 0, 0, 1.0],
            ],
            dtype=float,
        )
        self._initialized = False

    def reset(self, position: np.ndarray, velocity: np.ndarray) -> None:
        self.kf.x = np.array(
            [position[0], position[1], velocity[0], velocity[1]], dtype=float
        )
        self.kf.P *= 0.0
        self.kf.P += np.eye(4) * 100.0
        self._initialized = True

    def update_dt(self, dt: float) -> None:
        self.dt = dt
        self.kf.F[0, 2] = dt
        self.kf.F[1, 3] = dt

    def predict(self) -> np.ndarray:
        self.kf.predict()
        return self.kf.x.copy()

    def update(self, measurement: np.ndarray) -> np.ndarray:
        if not self._initialized:
            self.reset(measurement, np.zeros(2))
        self.kf.update(measurement)
        return self.kf.x.copy()

    def get_state(self) -> tuple[np.ndarray, np.ndarray]:
        x = self.kf.x
        return np.array([x[0], x[1]], dtype=float), np.array([x[2], x[3]], dtype=float)

    def predict_future(self, horizon: float, dt: float = 0.05) -> list[np.ndarray]:
        state = self.kf.x.copy()
        original_x = self.kf.x.copy()
        P = self.kf.P.copy()
        F = self.kf.F.copy()
        trajectory: list[np.ndarray] = []
        steps = max(1, int(horizon / dt))
        for _ in range(steps):
            state = F @ state
            trajectory.append(np.array([state[0], state[1]], dtype=float))
        self.kf.x = original_x
        self.kf.P = P
        return trajectory

    def linear_predict(self, t: float) -> np.ndarray:
        pos, vel = self.get_state()
        return pos + vel * t
