# ml/data/make_dataset.py — train.csv / test.csv / real_eval.csv 생성
# 학습/검증셋 = 합성 + 시뮬레이션 (8:2 분리). 실데이터 = 별도 평가셋(학습 미사용).
# 사용법:  python -m ml.data.make_dataset
import os

import pandas as pd
from sklearn.model_selection import train_test_split

from app.config import DATA_DIR, TRAIN_CSV, TEST_CSV
from ml.data.synthetic_gps import generate_synthetic
from ml.data.simulate_event import generate_simulation
from ml.data.load_real import load_real_eval

REAL_EVAL_CSV = os.path.join(DATA_DIR, "real_eval.csv")


def build(seed=42):
    os.makedirs(DATA_DIR, exist_ok=True)

    synth = generate_synthetic(seed=seed)
    sim = generate_simulation(seed=seed)
    full = pd.concat([synth, sim], ignore_index=True)
    full = full.sample(frac=1.0, random_state=seed).reset_index(drop=True)

    train_df, test_df = train_test_split(
        full, test_size=0.2, random_state=seed, stratify=full["label"]
    )
    train_df.to_csv(TRAIN_CSV, index=False)
    test_df.to_csv(TEST_CSV, index=False)
    print(f"[make_dataset] train={len(train_df)}  test={len(test_df)}  → {DATA_DIR}")
    print("  train label:", train_df["label"].value_counts().to_dict())
    print("  test  label:", test_df["label"].value_counts().to_dict())

    real = load_real_eval()
    if len(real):
        real.to_csv(REAL_EVAL_CSV, index=False)
        print(f"[make_dataset] real_eval={len(real)} (익명화, 평가 전용) → {REAL_EVAL_CSV}")
    else:
        print("[make_dataset] data_backup.json 없음 → real_eval 생략 (CI 등 정상)")


if __name__ == "__main__":
    build()
