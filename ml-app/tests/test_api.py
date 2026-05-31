from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_classify_rules_returns_label():
    r = client.post("/classify", json={"lat": 35.1383, "lng": 126.9159})
    assert r.status_code == 200
    assert r.json()["label"] in ["정상", "이탈"]


def test_classify_far_is_anomaly():
    # rules 모드에서 전주 좌표는 결정적으로 '이탈'
    r = client.post("/classify", json={"lat": 35.79, "lng": 127.11})
    assert r.json()["label"] == "이탈"


def test_feedback_saved():
    r = client.post(
        "/feedback",
        json={
            "lat": 0,
            "lng": 0,
            "prediction": "이탈",
            "correct_label": "이탈",
            "score": 1.0,
            "serving_model": "rules",
        },
    )
    assert r.json()["status"] == "feedback saved"
