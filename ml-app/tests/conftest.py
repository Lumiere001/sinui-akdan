import os

# 테스트는 MLflow 없이 동작하도록 rules 모드로 강제 (CI 친화)
os.environ.setdefault("MODEL_MODE", "rules")
os.environ.setdefault("MLFLOW_TRACKING_URI", "sqlite:///mlflow_test.db")

import pytest  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def ensure_dataset():
    from app.config import TRAIN_CSV
    from ml.data.make_dataset import build

    if not os.path.exists(TRAIN_CSV):
        build()
    yield
