# 신의 악단 V5 — GPS 이상 탐지 MLOps 파이프라인

V4(DevOps: Git→CI→Docker→Render)를 베이스로, **GPS 이상 탐지 ML**을 얹고
**MLflow 기반 실험·모델·재학습·롤백·운영 파이프라인**을 구축한 기말 과제 산출물.

수업(전남대 인공지능소프트웨어개발및운영파이프라인, 9~14주차)의 SpamChecker MLOps
레퍼런스를 GPS 도메인으로 이식했다. 서비스 = **FastAPI(Python)**, 모델 = **scikit-learn**,
실험/레지스트리 = **MLflow(alias 기반)**, 자동화 = **GitHub Actions**, 모니터링 = **Streamlit**.

## ML 문제 정의

> "이 플레이어의 GPS 좌표가 양림동 행사 정상 범위인가(정상) vs 이탈/오기록인가(이탈)?"

- 지도학습 이진분류. 피처: `[lat, lng, dist_to_center_m, min_dist_to_loc_m, gps_missing]`
- 후보 모델 비교: **LogisticRegression / RandomForest / IsolationForest** → `test_accuracy`로 champion 선정
- 데이터: 학습=합성+시뮬레이션(약 4천+건), 평가=실데이터(`data_backup.json`, 익명화, **학습 미사용**)

## 전체 파이프라인

```
Git ─push─▶ GitHub Actions ──┬─ ml-ci.yml   : pytest
                              └─ ml-train.yml: pytest→train→register→@champion 승격→artifact 업로드
                                                       │
                                                       ▼
                                   MLflow (Render 호스팅, Neon+R2)  ◀── 실험/레지스트리(alias)
                                                       │  models:/gps-anomaly-model@champion / @challenger
                                                       ▼
                              FastAPI 서비스(Render, Docker) ── /classify (카나리 서빙)
                                   ├─ 예측 로그 → CSV + Google Sheets
                                   ├─ 사용자 피드백(Human-in-the-loop) → CSV + Google Sheets
                                   └─ 저신뢰도 누적(drift) → GitHub Issue 자동 생성
                                                       │
                                                       ▼
                              Streamlit 대시보드 ── 운영 지표/Confidence/피드백 모니터링
```

## 빠른 시작 (로컬)

```bash
cd ml-app
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 1) 데이터 생성 (train.csv / test.csv / real_eval.csv)
python -m ml.data.make_dataset

# 2) 학습 + MLflow 기록 + 레지스트리 등록 + champion 자동 승격 (로컬 sqlite)
python -m ml.train

# 3) MLflow UI 확인
mlflow ui --backend-store-uri sqlite:///mlflow.db --port 9999

# 4) 평가 (test셋 + 실데이터)
python -m ml.evaluate

# 5) 서비스 실행
uvicorn app.main:app --reload      # http://127.0.0.1:8000

# 6) 모니터링 대시보드
streamlit run dashboard.py
```

> 로컬에서 ML 서빙을 보려면 `app/config.py`의 `MODEL_MODE=ml`(기본값) + champion alias 등록 필요.
> alias가 없으면 서비스는 자동으로 룰 베이스라인으로 **graceful fallback** 한다(로그에 ERROR).

## MLflow 서버(Render) — ngrok 미사용

로컬 PC를 노출하지 않고 MLflow를 Render에 직접 호스팅한다. 셋업: [`../mlflow-server/README.md`](../mlflow-server/README.md).
배포 후 `MLFLOW_TRACKING_URI=https://...onrender.com` 환경변수만 주입하면 학습/서빙 코드는 그대로 동작.

## 환경변수

`.env.example` 참고. 핵심: `MODEL_MODE`, `MLFLOW_TRACKING_URI`, `MODEL_NAME`,
`CANARY_ENABLED/RATIO`, (선택) `GH_TOKEN/GH_REPO`, `GOOGLE_SHEET_NAME/GOOGLE_SERVICE_ACCOUNT_JSON`.

## 평가 기준 ↔ 구현 매핑

| 배점 | 항목 | 구현 위치 |
|---|---|---|
| 35 | 파이프라인 완성도 | Git→Actions(ci+train)→Docker→MLflow(alias)→Render |
| 15 | MLflow 활용·버전비교 | `ml/train.py`(param·metric·artifact, 3모델 run), alias |
| 10 | 자동화 | `ml-train.yml` + `ml/model_promoter.py`(자동 승격) |
| 10 | ML 서비스 연결 | `app/main.py` `/classify` + 모델정보 표시 |
| 10 | Git 이력 | Conventional Commits + PR |
| 5 | Docker | `ml-app/Dockerfile`, `mlflow-server/Dockerfile` |
| 5 | 배포·운영 로그 | Render 로그 + `app/main.py` 로깅(9_1) |
| 10 | 추가점수 | 카나리 / drift→Issue / Google Sheets+Streamlit / 의도적 버그 |

## 시연 시나리오 (보고서 §10~13)

1. **재학습/승격(§10)**: `train.csv`에 데이터 추가 → `python -m ml.train` → `test_accuracy` 향상 시 `[PROMOTION] version N promoted to champion`. 서비스 재기동 시 새 champion 서빙.
2. **롤백(§12)**: MLflow UI(또는 `MlflowClient.set_registered_model_alias`)로 `@champion`을 이전 버전으로 이동 → 서비스 재기동 → 즉시 이전 모델로 복구.
3. **카나리(§8 추가점수)**: `CANARY_RATIO`로 challenger 일부 트래픽 서빙. 화면/로그의 `serving_model`로 확인.
4. **의도적 문제(§11)**: `MODEL_NAME`/alias를 존재하지 않게 만들어 모델 로드 실패 유발 → `/classify`가 **룰 폴백**으로 정상 응답 + 로그에 `ML 추론 실패 → 룰 폴백` ERROR → alias 복구로 해결.
5. **드리프트(§11 추가)**: 저신뢰도(score<0.65) 예측이 `LOW_CONFIDENCE_LIMIT`회 누적 → GitHub Issue `[MLOps] Drift suspected` 자동 생성.

## 보고서 스크린샷 체크리스트

- [ ] Render 배포 주소(서비스) / MLflow Tracking Server 주소
- [ ] GitHub Actions(ci, train) 실행 결과 / Docker 빌드 로그
- [ ] MLflow Experiments(3 run 비교 차트) / Models(version + @champion/@challenger alias)
- [ ] `/classify` 결과 화면(모델타입·Test Acc·Run ID) / 룰 폴백 ERROR 로그
- [ ] 재학습 전후 test_accuracy 비교 / 롤백 후 모델 변경
- [ ] Streamlit 대시보드 / drift GitHub Issue

## 운영 메모

- **git push는 사용자가 직접** (CC는 로컬 커밋까지). Render/Neon/R2/Google Cloud 등 외부 인증도 사용자/Cowork.
- 코드 작업 = CC, 브라우저/콘솔/스크린샷 = Cowork.
- `data_backup.json`은 PII → git 추적 금지(루트 `.gitignore` 등록됨). `real_eval.csv`도 커밋 금지.
