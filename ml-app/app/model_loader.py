# app/model_loader.py — MLflow 레지스트리에서 champion/challenger 모델 로드 (+카나리)
# 모델을 '파일'이 아니라 '레지스트리의 alias'로 다룬다 (수업 12_1/13_1).
import random

import mlflow
import mlflow.sklearn
from mlflow.tracking import MlflowClient

from app.config import (
    CANARY_ENABLED,
    CANARY_RATIO,
    CHALLENGER_MODEL_URI,
    CHAMPION_MODEL_URI,
    MLFLOW_TRACKING_URI,
)

_champion_model = None
_challenger_model = None
_model_info_cache = {}


def _init_mlflow():
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_registry_uri(MLFLOW_TRACKING_URI)


def load_champion_model():
    global _champion_model
    if _champion_model is None:
        _init_mlflow()
        _champion_model = mlflow.sklearn.load_model(CHAMPION_MODEL_URI)
    return _champion_model


def load_challenger_model():
    global _challenger_model
    if _challenger_model is None:
        _init_mlflow()
        _challenger_model = mlflow.sklearn.load_model(CHALLENGER_MODEL_URI)
    return _challenger_model


def select_serving_model():
    """카나리: champion 대부분 + challenger 일부(CANARY_RATIO)."""
    if CANARY_ENABLED and random.random() < CANARY_RATIO:
        try:
            return load_challenger_model(), "challenger"
        except Exception:
            pass  # challenger 미등록 시 champion으로
    return load_champion_model(), "champion"


def get_model_info(serving_model):
    """서빙 모델의 run_id / model_type / test_accuracy (운영 화면 표시용)."""
    if serving_model in _model_info_cache:
        return _model_info_cache[serving_model]
    _init_mlflow()
    uri = CHAMPION_MODEL_URI if serving_model == "champion" else CHALLENGER_MODEL_URI
    try:
        info = mlflow.models.get_model_info(uri)
        run = MlflowClient().get_run(info.run_id)
        out = {
            "run_id": info.run_id,
            "model_type": run.data.params.get("model_type"),
            "test_accuracy": run.data.metrics.get("test_accuracy"),
        }
    except Exception:
        out = {"run_id": "unknown", "model_type": None, "test_accuracy": None}
    _model_info_cache[serving_model] = out
    return out
