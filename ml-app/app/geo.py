# app/geo.py — 양림동 좌표 상수 + 피처 엔지니어링 (학습/서빙 공용)
# 학습(ml/train.py)과 서빙(app/anomaly.py)이 동일한 피처를 쓰도록 한 곳에 모은다.
# 좌표 출처: server/gameData.ts (Google Maps 검증). 9개 장소 + 행사 중심.
import math

# 양림동 행사 중심 (gameData.ts Center)
CENTER_LAT = 35.140252
CENTER_LNG = 126.912400

# 9개 장소 (id, 이름, lat, lng)
LOCATIONS = [
    ("오웬기념각", 35.138299, 126.915901),
    ("선교사 묘역", 35.139354, 126.911123),
    ("우일선 선교사 사택", 35.138358, 126.911861),
    ("펭귄마을", 35.140536, 126.917556),
    ("이장우 가옥", 35.140423, 126.914215),
    ("양림교회", 35.138181, 126.915584),
    ("최승효 가옥", 35.141354, 126.913985),
    ("조아라 기념관", 35.138778, 126.914419),
    ("호랑가시나무", 35.137888, 126.911828),
]

# 학습/서빙 공용 피처 순서 (CSV의 lat,lng로부터 파생)
FEATURE_COLUMNS = ["lat", "lng", "dist_to_center_m", "min_dist_to_loc_m", "gps_missing"]


def haversine_m(lat1, lng1, lat2, lng2):
    """두 좌표 간 거리(미터). gpsCheck.ts의 Haversine과 동일 공식."""
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(min(1.0, math.sqrt(a)))


def featurize(lat, lng):
    """단일 GPS 좌표 → 피처 dict. lat=lng=0 은 GPS 미수신으로 간주."""
    gps_missing = 1 if (lat == 0 and lng == 0) else 0
    if gps_missing:
        # 미수신은 거리 피처를 큰 값으로 (정상 영역 밖) 표현
        dist_center = 999999.0
        min_loc = 999999.0
    else:
        dist_center = haversine_m(lat, lng, CENTER_LAT, CENTER_LNG)
        min_loc = min(haversine_m(lat, lng, la, lo) for _, la, lo in LOCATIONS)
    return {
        "lat": float(lat),
        "lng": float(lng),
        "dist_to_center_m": round(dist_center, 2),
        "min_dist_to_loc_m": round(min_loc, 2),
        "gps_missing": gps_missing,
    }


def features_frame(df):
    """lat,lng 컬럼이 있는 DataFrame → FEATURE_COLUMNS DataFrame."""
    import pandas as pd

    rows = [featurize(r.lat, r.lng) for r in df.itertuples(index=False)]
    return pd.DataFrame(rows, columns=FEATURE_COLUMNS)
