# app/main.py — FastAPI 서비스 (GPS 이상 탐지)
# /classify, /feedback, /health + 정적 UI. 로깅(9_1) + 폴백(§11) + 드리프트(13_1) + 이중로깅(13_2).
import logging
import os

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.anomaly import check_ml_canary, check_rules
from app.config import LOW_CONFIDENCE_THRESHOLD, MODEL_MODE
from app.feedback import save_feedback
from app.google_sheet_logger import append_feedback_log, append_prediction_log
from app.prediction_logger import save_prediction_log
from app.retrain_issue import update_issue_state

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass

# 1) 로깅 포맷: 시간 | 레벨 | 위치 | 메시지 (수업 9_1 로깅)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s:%(lineno)d | %(message)s",
)
logger = logging.getLogger("gps-anomaly")

app = FastAPI(title="신의 악단 — GPS 이상 탐지 (V5 MLOps)")

_STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")


class ClassifyRequest(BaseModel):
    lat: float
    lng: float


class FeedbackRequest(BaseModel):
    lat: float
    lng: float
    prediction: str
    correct_label: str
    score: float = 0.0
    serving_model: str = "unknown"


@app.get("/")
async def index():
    return FileResponse(os.path.join(_STATIC_DIR, "index.html"))


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/classify")
async def classify(payload: ClassifyRequest):
    lat, lng = payload.lat, payload.lng
    logger.info(f"CALL /classify | lat={lat} lng={lng}")

    serving_model = "rules"
    model_info = None
    try:
        if MODEL_MODE == "ml":
            try:
                label, score, serving_model = check_ml_canary(lat, lng)
                from app.model_loader import get_model_info

                model_info = get_model_info(serving_model)
            except Exception as e:
                # §11 의도적 문제 대응: 모델 로드/추론 실패 → 룰 베이스라인으로 graceful fallback
                logger.exception(f"ML 추론 실패 → 룰 폴백: {type(e).__name__}: {e}")
                label, score = check_rules(lat, lng)
                serving_model = "rules-fallback"
        else:
            label, score = check_rules(lat, lng)

        # 드리프트(저신뢰도 누적) 감지 → 임계 초과 시 GitHub Issue 자동 생성
        update_issue_state(lat, lng, label, score, LOW_CONFIDENCE_THRESHOLD)

        # 예측 로그: 로컬 CSV + Google Sheets(설정 시)
        save_prediction_log(lat, lng, label, score, serving_model)
        append_prediction_log(lat, lng, label, score, serving_model)

        logger.info(f"OK /classify | label={label} score={score} serving={serving_model}")
        return {"label": label, "score": score, "serving_model": serving_model, "model_info": model_info}
    except Exception as e:
        logger.exception(f"FAIL /classify | {type(e).__name__}: {e}")
        return {"label": "error", "score": -1, "serving_model": serving_model, "model_info": None}


@app.post("/feedback")
async def feedback(payload: FeedbackRequest):
    try:
        save_feedback(
            payload.lat, payload.lng, payload.prediction, payload.correct_label, payload.score, payload.serving_model
        )
        append_feedback_log(
            payload.lat, payload.lng, payload.prediction, payload.correct_label, payload.score, payload.serving_model
        )
        logger.info(
            f"OK /feedback | prediction={payload.prediction} correct_label={payload.correct_label}"
        )
        return {"status": "feedback saved"}
    except Exception as e:
        logger.exception(f"FAIL /feedback | {type(e).__name__}: {e}")
        return {"status": "feedback save failed"}
