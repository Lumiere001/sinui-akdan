# app/issue.py — GitHub Issue 생성 (운영 알림). best-effort.
# 환경변수 GH_TOKEN, GH_REPO("owner/repo") 필요. 없으면 로그만 남기고 통과.
import os

import requests


def create_github_issue(title, body, logger=None):
    token = os.getenv("GH_TOKEN")
    repo = os.getenv("GH_REPO")
    if not token or not repo:
        if logger:
            logger.warning("GH_TOKEN/GH_REPO 미설정 → GitHub Issue 생략 (로컬/CI 정상)")
        return None
    url = f"https://api.github.com/repos/{repo}/issues"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    try:
        r = requests.post(url, json={"title": title, "body": body}, headers=headers, timeout=10)
        r.raise_for_status()
        num = r.json().get("number")
        if logger:
            logger.info(f"GitHub Issue #{num} 생성: {title}")
        return num
    except Exception as e:
        if logger:
            logger.exception(f"GitHub Issue 생성 실패: {type(e).__name__}: {e}")
        return None
