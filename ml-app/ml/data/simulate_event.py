# ml/data/simulate_event.py — 행사 시뮬레이션 데이터 생성 (학습셋 보강)
# 100회 행사 × 10팀 × 팀원들이 정답 장소로 이동(정규분포 흩어짐), 약 5%는 이탈.
import numpy as np
import pandas as pd

from app.geo import LOCATIONS


def simulate_event(seed):
    rng = np.random.default_rng(seed)
    rows = []
    for _team in range(1, 11):
        # 팀 경로: 9개 장소 중 3곳을 방문
        route_idx = rng.choice(len(LOCATIONS), size=3, replace=False)
        team_size = int(rng.integers(3, 7))
        for _player in range(team_size):
            for step in route_idx:
                _, c_lat, c_lng = LOCATIONS[step]
                if rng.random() < 0.05:
                    # 이탈: 외곽으로 크게 벗어남
                    lat = c_lat + rng.normal(0, 0.02)
                    lng = c_lng + rng.normal(0, 0.02)
                    label = 1
                else:
                    # 정상: 장소 주변 ~30m
                    lat = c_lat + rng.normal(0, 0.0003)
                    lng = c_lng + rng.normal(0, 0.0003)
                    label = 0
                rows.append({"lat": round(lat, 7), "lng": round(lng, 7), "label": label, "source": "simulation"})
    return rows


def generate_simulation(n_events=100, seed=7):
    all_rows = []
    for e in range(n_events):
        all_rows.extend(simulate_event(seed + e))
    df = pd.DataFrame(all_rows)
    return df.sample(frac=1.0, random_state=seed).reset_index(drop=True)


if __name__ == "__main__":
    df = generate_simulation()
    print(f"총 {len(df)}건")
    print(df["label"].value_counts())
