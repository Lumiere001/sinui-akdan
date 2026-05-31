# app/retrain_issue.py — 드리프트 감지(저신뢰도 누적) → GitHub Issue 자동 생성
# 운영 중 정답을 모르므로 confidence(score)로 간접 평가. 저신뢰 예측이 누적되면
# "재학습 검토" Issue를 1회 생성 (반자동화, 수업 13_1).
import logging
from datetime import datetime

from app.config import LOW_CONFIDENCE_LIMIT
from app.issue import create_github_issue

logger = logging.getLogger(__name__)

# 서버 실행 동안만 유지하는 간단 상태
_state = {"low_confidence_count": 0, "samples": [], "issue_created": False}


def update_issue_state(lat, lng, label, score, threshold):
    if score < threshold:
        _state["low_confidence_count"] += 1
        _state["samples"].append(
            {
                "lat": lat,
                "lng": lng,
                "label": label,
                "score": round(float(score), 4),
                "time": datetime.now().isoformat(timespec="seconds"),
            }
        )
    if _state["low_confidence_count"] >= LOW_CONFIDENCE_LIMIT and not _state["issue_created"]:
        _create_drift_issue()
        _state["issue_created"] = True
    return _state


def _create_drift_issue():
    samples = _state["samples"][-5:]
    title = "[MLOps] Drift suspected (low confidence accumulation)"
    body = (
        "## Drift Detection Report\n"
        "저신뢰도 예측이 누적되었습니다.\n"
        f"- count: {_state['low_confidence_count']}\n"
        f"- threshold(limit): {LOW_CONFIDENCE_LIMIT}\n\n"
        "## Recent Samples\n"
    )
    for s in samples:
        body += f"- (score={s['score']}) lat={s['lat']}, lng={s['lng']} → {s['label']}\n"
    body += "\n## Action\n- 데이터 검토 후 라벨링/추가\n- 재학습 필요 여부 결정\n"
    create_github_issue(title, body, logger)
