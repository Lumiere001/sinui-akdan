# ml-app/Dockerfile — FastAPI GPS 이상탐지 서비스 (Render Web Service)
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
# Render는 $PORT 주입. 로컬은 8000.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
