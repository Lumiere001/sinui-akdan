# app/config.py — 서비스/모델/운영 설정 (SSOT)
# 수업 패턴: config.py 한 곳에서 MODEL_MODE·MLFLOW_TRACKING_URI·MODEL_URI 관리.
# 운영 환경에서는 환경변수로 덮어쓴다 (로컬=sqlite, Render=원격 MLflow).
import os

# --- 서비스 모드 ---
MODEL_MODE = os.getenv("MODEL_MODE", "ml")  # "ml" | "rules"

# --- MLflow Tracking / Registry ---
# 로컬 개발: sqlite, 운영(Render): MLFLOW_TRACKING_URI 환경변수로 원격 서버 주입
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "sqlite:///mlflow.db")
EXPERIMENT_NAME = os.getenv("MLFLOW_EXPERIMENT", "gps-anomaly-detection")
MODEL_NAME = os.getenv("MODEL_NAME", "gps-anomaly-model")

# alias 기반 모델 참조 (MLflow 3.x). 교체/롤백은 alias만 바꾸면 됨.
CHAMPION_MODEL_URI = f"models:/{MODEL_NAME}@champion"
CHALLENGER_MODEL_URI = f"models:/{MODEL_NAME}@challenger"
MODEL_URI = CHAMPION_MODEL_URI  # 단일 서빙 시 기본값

# --- 카나리 배포 (champion 대부분 + challenger 일부) ---
CANARY_ENABLED = os.getenv("CANARY_ENABLED", "true").lower() == "true"
CANARY_RATIO = float(os.getenv("CANARY_RATIO", "0.1"))  # challenger 처리 비율

# --- 드리프트 감지 → GitHub Issue 자동 생성 (반자동화) ---
LOW_CONFIDENCE_THRESHOLD = float(os.getenv("LOW_CONFIDENCE_THRESHOLD", "0.65"))
LOW_CONFIDENCE_LIMIT = int(os.getenv("LOW_CONFIDENCE_LIMIT", "5"))

# --- 룰 베이스라인 임계값 (양림동 정상 반경) ---
NORMAL_RADIUS_M = float(os.getenv("NORMAL_RADIUS_M", "700"))

# --- 경로 ---
_HERE = os.path.dirname(os.path.abspath(__file__))
ML_DIR = os.path.join(os.path.dirname(_HERE), "ml")
DATA_DIR_NAME = "data"
ARTIFACT_DIR_NAME = "artifacts"
DATA_DIR = os.path.join(ML_DIR, DATA_DIR_NAME)
ARTIFACT_DIR = os.path.join(ML_DIR, ARTIFACT_DIR_NAME)
TRAIN_FILE_NAME = "train.csv"
TEST_FILE_NAME = "test.csv"
TRAIN_CSV = os.path.join(DATA_DIR, TRAIN_FILE_NAME)
TEST_CSV = os.path.join(DATA_DIR, TEST_FILE_NAME)
MODEL_NAME_FILE = "gps_anomaly_model.joblib"
MODEL_PATH = os.path.join(ARTIFACT_DIR, MODEL_NAME_FILE)

# --- 라벨 표기 ---
LABELS = {0: "정상", 1: "이탈"}
