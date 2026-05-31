# ml/evaluate.py — 모델 평가 (test셋 + 실데이터 평가셋)
# precision/recall/f1 + confusion matrix. 실데이터(real_eval.csv)로 운영 적합성 점검.
# 실행:  python -m ml.evaluate
import os

import joblib
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix

from app.config import DATA_DIR, MODEL_PATH, TEST_CSV
from app.geo import FEATURE_COLUMNS, features_frame

REAL_EVAL_CSV = os.path.join(DATA_DIR, "real_eval.csv")


def _eval(pipeline, csv_path, title):
    if not os.path.exists(csv_path):
        print(f"[evaluate] {title}: 파일 없음 ({csv_path}) — 생략")
        return
    df = pd.read_csv(csv_path)
    X = features_frame(df)[FEATURE_COLUMNS]
    y = df["label"].astype(int)
    pred = pipeline.predict(X)
    print(f"\n===== {title} (n={len(df)}) =====")
    print(confusion_matrix(y, pred))
    print(classification_report(y, pred, target_names=["정상", "이탈"], zero_division=0))


def main():
    if not os.path.exists(MODEL_PATH):
        raise SystemExit(f"모델 없음: {MODEL_PATH} — 먼저 python -m ml.train 실행")
    pipeline = joblib.load(MODEL_PATH)
    _eval(pipeline, TEST_CSV, "합성/시뮬 test셋")
    _eval(pipeline, REAL_EVAL_CSV, "실데이터 평가셋 (운영 적합성)")


if __name__ == "__main__":
    main()
