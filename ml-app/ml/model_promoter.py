# ml/model_promoter.py — champion 자동 승격 (학습 시점 교체)
# 현재 champion의 test_accuracy vs 신규 후보 비교 → 더 나으면 champion alias 이동.
# 수업 13_1 promote_if_better 패턴.
import mlflow
from mlflow.tracking import MlflowClient

from app.config import MLFLOW_TRACKING_URI, MODEL_NAME


def _client():
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_registry_uri(MLFLOW_TRACKING_URI)
    return MlflowClient()


def get_champion_test_accuracy(client):
    try:
        champ = client.get_model_version_by_alias(MODEL_NAME, "champion")
        run = client.get_run(champ.run_id)
        return float(run.data.metrics.get("test_accuracy", -1.0))
    except Exception:
        return -1.0


def promote_if_better(new_version, new_test_accuracy):
    client = _client()
    current = get_champion_test_accuracy(client)
    print(f"[PROMOTION] current champion test_accuracy = {current}")
    print(f"[PROMOTION] new candidate  test_accuracy = {new_test_accuracy}")

    if new_test_accuracy > current:
        # 직전 champion은 challenger로 내려 카나리/롤백 대비
        try:
            old = client.get_model_version_by_alias(MODEL_NAME, "champion")
            client.set_registered_model_alias(MODEL_NAME, "challenger", old.version)
        except Exception:
            pass
        client.set_registered_model_alias(MODEL_NAME, "champion", str(new_version))
        print(f"[PROMOTION] version {new_version} promoted to champion")
    else:
        # 신규는 challenger로 등록(카나리 비교용)
        client.set_registered_model_alias(MODEL_NAME, "challenger", str(new_version))
        print(f"[PROMOTION] champion unchanged (new → challenger v{new_version})")


if __name__ == "__main__":
    print("champion test_accuracy:", get_champion_test_accuracy(_client()))
