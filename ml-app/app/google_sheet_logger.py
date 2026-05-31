# app/google_sheet_logger.py — 예측/피드백을 Google Sheets(외부 DB)로 누적 (수업 13_2)
# 환경변수 GOOGLE_SHEET_NAME, GOOGLE_SERVICE_ACCOUNT_JSON 필요.
# 미설정 시 no-op(경고만) → 로컬/CI에서도 앱이 정상 동작.
import json
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

SCOPE = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

_spreadsheet = None
_disabled = False


def _get_spreadsheet():
    global _spreadsheet, _disabled
    if _disabled:
        return None
    if _spreadsheet is not None:
        return _spreadsheet

    sheet_name = os.getenv("GOOGLE_SHEET_NAME")
    service_account_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not sheet_name or not service_account_json:
        logger.warning("GOOGLE_SHEET_* 미설정 → Google Sheets 로깅 비활성화")
        _disabled = True
        return None

    try:
        import gspread
        from google.oauth2.service_account import Credentials

        info = json.loads(service_account_json)
        creds = Credentials.from_service_account_info(info, scopes=SCOPE)
        client = gspread.authorize(creds)
        _spreadsheet = client.open(sheet_name)
        return _spreadsheet
    except Exception as e:
        logger.exception(f"Google Sheets 연결 실패 → 비활성화: {type(e).__name__}: {e}")
        _disabled = True
        return None


def append_prediction_log(lat, lng, label, score, serving_model):
    ss = _get_spreadsheet()
    if ss is None:
        return
    try:
        ws = ss.worksheet("prediction_logs")
        ws.append_row(
            [datetime.now().isoformat(timespec="seconds"), lat, lng, label, round(float(score), 4), serving_model]
        )
    except Exception as e:
        logger.exception(f"prediction_logs append 실패: {type(e).__name__}: {e}")


def append_feedback_log(lat, lng, prediction, correct_label, score, serving_model):
    ss = _get_spreadsheet()
    if ss is None:
        return
    try:
        ws = ss.worksheet("feedback_logs")
        ws.append_row(
            [
                datetime.now().isoformat(timespec="seconds"),
                lat,
                lng,
                prediction,
                correct_label,
                round(float(score), 4),
                serving_model,
            ]
        )
    except Exception as e:
        logger.exception(f"feedback_logs append 실패: {type(e).__name__}: {e}")
