# MLflow Tracking Server (Render 호스팅)

ngrok 없이, MLflow를 **Render Web Service**로 직접 호스팅한다. 로컬 PC를 인터넷에 노출하지 않고
고정 HTTPS URL을 얻는다. 백엔드 스토어는 무료 Postgres(Neon), 아티팩트는 무료 오브젝트
스토리지(Cloudflare R2, S3 호환)를 쓴다.

## 구조

```
[train.py / 서비스]  --HTTPS-->  [Render: MLflow Server]
                                     ├── 메타데이터 → Neon Postgres (DATABASE_URL)
                                     └── 아티팩트   → Cloudflare R2 (--serve-artifacts 프록시)
```

`--serve-artifacts` 덕분에 학습/서빙 클라이언트는 R2 자격증명을 가질 필요가 없다.
오직 MLflow 서버만 R2 키를 보유 → 보안상 유리.

## 사전 준비 (Cowork/사용자 — 외부 콘솔)

1. **Neon** (https://neon.tech) 무료 프로젝트 생성 → connection string 복사
   - 예: `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`
2. **Cloudflare R2** 버킷 생성 → Access Key / Secret / S3 endpoint 확보
   - 버킷 예: `sinui-akdan-mlflow`
   - endpoint 예: `https://<account_id>.r2.cloudflarestorage.com`

## Render 배포

- Render Dashboard → New → Web Service → 이 저장소 연결 → **Root Directory = `mlflow-server`**
- Environment 변수:

| KEY | VALUE |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `MLFLOW_ARTIFACT_ROOT` | `s3://sinui-akdan-mlflow/mlflow` |
| `AWS_ACCESS_KEY_ID` | R2 access key |
| `AWS_SECRET_ACCESS_KEY` | R2 secret key |
| `MLFLOW_S3_ENDPOINT_URL` | R2 S3 endpoint |
| `AWS_DEFAULT_REGION` | `auto` |

- 배포 후 URL(예: `https://sinui-akdan-mlflow.onrender.com`)을 확인.
  - 이 URL을 **보고서 §1 "MLflow Tracking Server 주소"로 캡처**.
  - 서비스/학습 측 `MLFLOW_TRACKING_URI` 환경변수에 이 URL을 넣는다.

## 연결 확인

```
MLFLOW_TRACKING_URI=https://sinui-akdan-mlflow.onrender.com python -m ml.train
```
→ Render MLflow의 Experiments/Models에 run과 모델이 등록되면 성공.
