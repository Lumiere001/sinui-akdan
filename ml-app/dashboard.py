# dashboard.py — Streamlit 운영 모니터링 대시보드 (수업 13_2)
# 데이터 소스: Google Sheets(prediction_logs/feedback_logs) 우선, 없으면 로컬 CSV.
# 실행:  streamlit run dashboard.py
import os

import pandas as pd
import streamlit as st

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass

st.set_page_config(page_title="MLOps Dashboard", layout="wide")
st.title("🎼 신의 악단 — MLOps 모니터링 대시보드")

SCOPE = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


@st.cache_resource
def _gspread_client():
    import json

    import gspread
    from google.oauth2.service_account import Credentials

    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    file_path = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "google_key.json")
    if raw:
        creds = Credentials.from_service_account_info(json.loads(raw), scopes=SCOPE)
    else:
        creds = Credentials.from_service_account_file(file_path, scopes=SCOPE)
    return gspread.authorize(creds)


def load_sheet(sheet_name, tab):
    client = _gspread_client()
    ws = client.open(sheet_name).worksheet(tab)
    return pd.DataFrame(ws.get_all_records())


def load_data():
    sheet_name = os.getenv("GOOGLE_SHEET_NAME")
    if sheet_name:
        try:
            return load_sheet(sheet_name, "prediction_logs"), load_sheet(sheet_name, "feedback_logs"), "Google Sheets"
        except Exception as e:
            st.warning(f"Google Sheets 로드 실패 → 로컬 CSV 사용: {e}")
    pred = pd.read_csv("logs/predictions.csv") if os.path.exists("logs/predictions.csv") else pd.DataFrame()
    fb = pd.read_csv("logs/feedback.csv") if os.path.exists("logs/feedback.csv") else pd.DataFrame()
    return pred, fb, "로컬 CSV"


pred_df, feedback_df, source = load_data()
st.caption(f"데이터 소스: {source}")

# --- 운영 지표 ---
st.subheader("운영 지표")
c1, c2, c3, c4 = st.columns(4)
c1.metric("Total Requests", len(pred_df))
if len(pred_df) and "score" in pred_df.columns:
    pred_df["score"] = pd.to_numeric(pred_df["score"], errors="coerce")
    c2.metric("Average Confidence", round(pred_df["score"].mean(), 4))
    c3.metric("Low Confidence (<0.65)", int(len(pred_df[pred_df["score"] < 0.65])))
    if "serving_model" in pred_df.columns:
        c4.metric("Canary Requests", int(len(pred_df[pred_df["serving_model"] == "challenger"])))
else:
    c2.metric("Average Confidence", "-")
    c3.metric("Low Confidence", 0)
    c4.metric("Canary Requests", 0)

if len(pred_df) and "score" in pred_df.columns:
    st.subheader("Confidence Trend")
    st.line_chart(pred_df.reset_index()[["score"]])
    if "serving_model" in pred_df.columns:
        st.subheader("Serving Model Count")
        st.bar_chart(pred_df["serving_model"].value_counts())
    st.subheader("Recent Predictions")
    st.dataframe(pred_df.tail(20), use_container_width=True)
else:
    st.info("아직 예측 로그가 없습니다.")

# --- 사용자 피드백 ---
st.subheader("사용자 피드백")
f1, f2 = st.columns(2)
f1.metric("Feedback Count", len(feedback_df))
if len(feedback_df) and {"prediction", "correct_label"}.issubset(feedback_df.columns):
    wrong = feedback_df[feedback_df["prediction"] != feedback_df["correct_label"]]
    rate = len(wrong) / len(feedback_df) if len(feedback_df) else 0
    f2.metric("Wrong Prediction Rate", f"{rate:.2%}")
    st.subheader("Recent Feedback")
    st.dataframe(feedback_df.tail(20), use_container_width=True)
else:
    f2.metric("Wrong Prediction Rate", "0.00%")
    st.info("아직 사용자 피드백이 없습니다.")
