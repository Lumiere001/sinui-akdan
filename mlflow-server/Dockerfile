# mlflow-server/Dockerfile — MLflow Tracking Server (Render Web Service)
# 백엔드 스토어 = 외부 Postgres(Neon), 아티팩트 = 외부 오브젝트스토리지(Cloudflare R2, S3 호환).
# --serve-artifacts: 클라이언트가 R2 자격증명 없이 MLflow 서버를 통해 아티팩트 송수신(보안↑).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
# Render Free(512MB) OOM 방지: MLflow 3.x의 GenAI 백그라운드 job 컨슈머
# (huey: run_online_trace_scorer/invoke_scorer/periodic 등) 를 끈다. 기본값은 True.
ENV MLFLOW_SERVER_ENABLE_JOB_EXECUTION=false
RUN pip install --no-cache-dir \
    mlflow==3.10.1 \
    psycopg2-binary==2.9.10 \
    boto3==1.40.46

EXPOSE 5000
# 필요한 환경변수(Render에서 주입):
#   DATABASE_URL            = postgresql://...   (Neon)
#   MLFLOW_ARTIFACT_ROOT    = s3://<bucket>/mlflow
#   AWS_ACCESS_KEY_ID       = <R2 access key>
#   AWS_SECRET_ACCESS_KEY   = <R2 secret key>
#   MLFLOW_S3_ENDPOINT_URL  = https://<account>.r2.cloudflarestorage.com
#   AWS_DEFAULT_REGION      = auto
#   RENDER_EXTERNAL_HOSTNAME= (Render 자동 주입) 공개 호스트 — Host 헤더 검증 허용에 사용
# --workers 1: 메모리 절감(Free 512MB). --allowed-hosts/--cors: 3.x 보안 미들웨어가
# 공개 호스트로 들어오는 요청(train·서비스)을 막지 않도록 Render 호스트를 허용.
CMD mlflow server --host 0.0.0.0 --port ${PORT:-5000} \
    --workers 1 \
    --backend-store-uri "${DATABASE_URL}" \
    --artifacts-destination "${MLFLOW_ARTIFACT_ROOT}" \
    --serve-artifacts \
    --allowed-hosts "localhost,127.0.0.1,${RENDER_EXTERNAL_HOSTNAME}" \
    --cors-allowed-origins "http://localhost,http://127.0.0.1,https://${RENDER_EXTERNAL_HOSTNAME}"
