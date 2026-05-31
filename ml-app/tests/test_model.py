import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.anomaly import check_rules
from app.config import TRAIN_CSV
from app.geo import FEATURE_COLUMNS, featurize, features_frame


def test_featurize_missing():
    assert featurize(0, 0)["gps_missing"] == 1


def test_featurize_normal_vs_far():
    near = featurize(35.1383, 126.9159)  # 양림동
    far = featurize(35.79, 127.11)  # 전주
    assert near["gps_missing"] == 0
    assert near["dist_to_center_m"] < far["dist_to_center_m"]


def test_rules_baseline():
    assert check_rules(35.1383, 126.9159)[0] == "정상"  # 양림동 정상
    assert check_rules(35.79, 127.11)[0] == "이탈"  # 전주 이탈
    assert check_rules(0, 0)[0] == "이탈"  # GPS 미수신


def test_supervised_pipeline_predicts_both():
    df = pd.read_csv(TRAIN_CSV)
    X = features_frame(df)[FEATURE_COLUMNS]
    y = df["label"].astype(int)
    pipe = Pipeline(
        [("scaler", StandardScaler()), ("clf", LogisticRegression(max_iter=500, class_weight="balanced"))]
    )
    pipe.fit(X, y)
    preds = pipe.predict(X)
    assert set(np.unique(preds)).issubset({0, 1})
