# app/prediction_logger.py — 예측 로그를 로컬 CSV로 누적 (수업 13_2)
import csv
from datetime import datetime
from pathlib import Path

PREDICTION_LOG_PATH = Path("logs/predictions.csv")
PREDICTION_LOG_PATH.parent.mkdir(exist_ok=True)


def save_prediction_log(lat, lng, label, score, serving_model):
    is_new = not PREDICTION_LOG_PATH.exists()
    with open(PREDICTION_LOG_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if is_new:
            writer.writerow(["time", "lat", "lng", "label", "score", "serving_model"])
        writer.writerow(
            [
                datetime.now().isoformat(timespec="seconds"),
                lat,
                lng,
                label,
                round(float(score), 4),
                serving_model,
            ]
        )
