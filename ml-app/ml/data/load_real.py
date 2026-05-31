# ml/data/load_real.py — 실데이터(data_backup.json) 로더 + PII 익명화
# 정책: 실데이터는 평가셋(eval)으로만 사용. 학습에 절대 미사용.
#       참가자 실명/playerId 제거(익명화). lat/lng/teamId/timestamp만 사용.
# 라벨: 룰 기반(미수신 또는 정상반경 밖) — 자연 라벨로 v0(룰) vs v1(ML) 비교에 활용.
import json
import os

import pandas as pd

from app.config import NORMAL_RADIUS_M
from app.geo import featurize

# data_backup.json 은 .gitignore (PII 보호). 로컬에서만 존재.
DEFAULT_REAL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "data_backup.json",
)


def _label_by_rule(lat, lng):
    f = featurize(lat, lng)
    return 1 if (f["gps_missing"] == 1 or f["dist_to_center_m"] > NORMAL_RADIUS_M) else 0


def load_real_eval(path=None):
    """실데이터 GPS 기록 → 익명화된 평가셋 DataFrame[lat,lng,label,source]."""
    path = path or DEFAULT_REAL_PATH
    if not os.path.exists(path):
        return pd.DataFrame(columns=["lat", "lng", "label", "source"])

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    rows = []
    for _team_key, team in data.get("teams", {}).items():
        for m in team.get("members", []):
            lat = m.get("lat")
            lng = m.get("lng")
            if lat is None or lng is None:
                continue
            # 익명화: playerId/실명은 가져오지 않는다. teamId만 정수로 보존.
            rows.append(
                {
                    "lat": float(lat),
                    "lng": float(lng),
                    "label": _label_by_rule(float(lat), float(lng)),
                    "source": "real",
                }
            )
    return pd.DataFrame(rows)


if __name__ == "__main__":
    df = load_real_eval()
    print(f"실데이터 평가셋 {len(df)}건 (PII 제거됨)")
    if len(df):
        print(df["label"].value_counts())
