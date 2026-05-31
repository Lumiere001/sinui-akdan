# app/feedback.py — 사용자 피드백을 로컬 CSV로 누적 (Human-in-the-loop, 수업 13_2)
import csv
from datetime import datetime
from pathlib import Path

FEEDBACK_PATH = Path("logs/feedback.csv")
FEEDBACK_PATH.parent.mkdir(exist_ok=True)


def save_feedback(lat, lng, prediction, correct_label, score, serving_model):
    is_new = not FEEDBACK_PATH.exists()
    with open(FEEDBACK_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if is_new:
            writer.writerow(
                ["time", "lat", "lng", "prediction", "correct_label", "score", "serving_model"]
            )
        writer.writerow(
            [
                datetime.now().isoformat(timespec="seconds"),
                lat,
                lng,
                prediction,
                correct_label,
                round(float(score), 4),
                serving_model,
            ]
        )
