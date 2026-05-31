# ml/data/synthetic_gps.py — 합성 GPS 데이터 생성 (학습셋)
# 정상: 양림동 9개 장소 중심 정규분포 / 이상: 광주 외곽·타도시 / 미수신: lat=lng=0
import numpy as np
import pandas as pd

from app.geo import LOCATIONS, CENTER_LAT, CENTER_LNG, haversine_m


def generate_synthetic(n_normal=1000, n_anomaly=200, n_missing=50, seed=42):
    rng = np.random.default_rng(seed)
    rows = []

    def normal_row(lat, lng):
        return {"lat": round(lat, 7), "lng": round(lng, 7), "label": 0, "source": "synthetic"}

    # 정상 ① 장소 군집 (~60%): 9개 장소 중심 ~25m 정규분포 (GPS 안정 상태)
    n_cluster = int(n_normal * 0.6)
    n_roam = n_normal - n_cluster
    per_loc = max(1, n_cluster // len(LOCATIONS))
    for _, c_lat, c_lng in LOCATIONS:
        for _ in range(per_loc):
            rows.append(normal_row(c_lat + rng.normal(0, 0.00025), c_lng + rng.normal(0, 0.00025)))

    # 정상 ② 행사장 배회 (~40%): 장소 사이 이동·GPS 드리프트.
    # 중심 650m 이내만 채택(룰 임계 700m 내) → 실데이터의 흩어진 정상과 분포 일치.
    made = 0
    while made < n_roam:
        lat = CENTER_LAT + rng.normal(0, 0.0025)
        lng = CENTER_LNG + rng.normal(0, 0.0030)
        if haversine_m(lat, lng, CENTER_LAT, CENTER_LNG) <= 650:
            rows.append(normal_row(lat, lng))
            made += 1

    # 이상 (~200건): 광주권 박스에서 양림동 정상영역(>1.5km) 밖만 채택
    made = 0
    while made < n_anomaly:
        lat = rng.uniform(35.05, 35.25)
        lng = rng.uniform(126.80, 127.05)
        if haversine_m(lat, lng, CENTER_LAT, CENTER_LNG) > 1500:
            rows.append({"lat": round(lat, 7), "lng": round(lng, 7), "label": 1, "source": "synthetic"})
            made += 1

    # 명백한 원거리 이탈(타도시) 몇 건 — 실데이터의 전주/외곽 케이스 모사
    for lat, lng in [(35.79, 127.11), (35.32, 127.47), (35.21, 126.88)]:
        rows.append({"lat": lat, "lng": lng, "label": 1, "source": "synthetic"})

    # GPS 미수신 (~50건)
    for _ in range(n_missing):
        rows.append({"lat": 0.0, "lng": 0.0, "label": 1, "source": "synthetic"})

    df = pd.DataFrame(rows)
    return df.sample(frac=1.0, random_state=seed).reset_index(drop=True)


if __name__ == "__main__":
    df = generate_synthetic()
    print(df["label"].value_counts())
    print(df.head())
