# ml/train.py — 여러 모델 학습 + MLflow 기록 + 레지스트리 등록 + champion 자동 승격
# 실행:  python -m ml.train     (프로젝트 루트 ml-app/ 에서)
# 수업 패턴(12_1/12_2/13_1)을 GPS 이상탐지로 이식.
import os

import joblib
import mlflow
import mlflow.sklearn
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.config import (
    ARTIFACT_DIR,
    EXPERIMENT_NAME,
    MLFLOW_TRACKING_URI,
    MODEL_NAME,
    MODEL_PATH,
    TEST_CSV,
    TRAIN_CSV,
)
from app.geo import FEATURE_COLUMNS, features_frame
from ml.models import build_models
from ml.model_promoter import promote_if_better

os.makedirs(ARTIFACT_DIR, exist_ok=True)


def _xy(csv_path):
    df = pd.read_csv(csv_path)
    X = features_frame(df)[FEATURE_COLUMNS]
    y = df["label"].astype(int)
    return X, y, len(df)


def main():
    # MLflow 세팅: 로컬 sqlite or 원격(Render) — 환경변수 MLFLOW_TRACKING_URI로 결정
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_registry_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(EXPERIMENT_NAME)

    X_train, y_train, n_train = _xy(TRAIN_CSV)
    X_test, y_test, n_test = _xy(TEST_CSV)

    best_acc, best_version = -1.0, None

    for name, model in build_models().items():
        with mlflow.start_run(run_name=name):
            # 실험 설정 기록
            mlflow.log_param("model_type", name)  # 하드코딩 금지 (수업 버그 교훈)
            mlflow.log_param("features", ",".join(FEATURE_COLUMNS))
            mlflow.log_param("train_row_count", n_train)
            mlflow.log_param("test_row_count", n_test)

            pipeline = Pipeline([("scaler", StandardScaler()), ("clf", model)])
            pipeline.fit(X_train, y_train)

            train_pred = pipeline.predict(X_train)
            test_pred = pipeline.predict(X_test)
            train_acc = accuracy_score(y_train, train_pred)
            test_acc = accuracy_score(y_test, test_pred)

            mlflow.log_metric("train_accuracy", train_acc)
            mlflow.log_metric("test_accuracy", test_acc)
            mlflow.log_metric("test_precision", precision_score(y_test, test_pred, zero_division=0))
            mlflow.log_metric("test_recall", recall_score(y_test, test_pred, zero_division=0))
            mlflow.log_metric("test_f1", f1_score(y_test, test_pred, zero_division=0))

            joblib.dump(pipeline, MODEL_PATH)
            mlflow.log_artifact(TRAIN_CSV)
            mlflow.log_artifact(TEST_CSV)

            info = mlflow.sklearn.log_model(
                pipeline, name="model", registered_model_name=MODEL_NAME
            )

            print(f"[{name}] train_acc={train_acc:.4f} test_acc={test_acc:.4f}")

            if test_acc > best_acc:
                best_acc = test_acc
                best_version = info.registered_model_version

    # 이번 학습 중 최고 모델을 현재 champion과 비교해 자동 승격
    if best_version is not None:
        promote_if_better(best_version, best_acc)


if __name__ == "__main__":
    main()
