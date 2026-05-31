# app/anomaly.py — GPS 이상 탐지 로직 (룰 베이스라인 + ML + 카나리)
# 수업 spam.py(check_spam_rules/check_spam_ml/check_spam_ml_canary)의 GPS 버전.
import pandas as pd

from app.config import NORMAL_RADIUS_M
from app.geo import FEATURE_COLUMNS, featurize


def _feature_row(lat, lng):
    f = featurize(lat, lng)
    return pd.DataFrame([[f[c] for c in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)


def check_rules(lat, lng):
    """v0 룰 베이스라인: 미수신이거나 정상 반경 밖이면 이탈."""
    f = featurize(lat, lng)
    is_anom = f["gps_missing"] == 1 or f["dist_to_center_m"] > NORMAL_RADIUS_M
    if f["gps_missing"]:
        score = 1.0
    else:
        score = min(1.0, f["dist_to_center_m"] / (NORMAL_RADIUS_M * 2))
    label = "이탈" if is_anom else "정상"
    return label, float(round(score, 4))


def check_ml(lat, lng):
    """champion 모델 단일 서빙."""
    from app.model_loader import load_champion_model

    model = load_champion_model()
    X = _feature_row(lat, lng)
    pred = int(model.predict(X)[0])
    proba = model.predict_proba(X)[0]
    classes = list(model.classes_)
    score = float(proba[classes.index(pred)])
    label = "이탈" if pred == 1 else "정상"
    return label, round(score, 4)


def check_ml_canary(lat, lng):
    """카나리: champion/challenger 중 선택해 서빙. serving_model도 반환."""
    from app.model_loader import select_serving_model

    model, serving_model = select_serving_model()
    X = _feature_row(lat, lng)
    pred = int(model.predict(X)[0])
    proba = model.predict_proba(X)[0]
    classes = list(model.classes_)
    score = float(proba[classes.index(pred)])
    label = "이탈" if pred == 1 else "정상"
    return label, round(score, 4), serving_model
