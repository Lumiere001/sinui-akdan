# ml/models.py — 비교할 모델 정의
# 지도학습 분류(LogReg, RandomForest) + 비지도 IsolationForest를
# 동일한 분류기 인터페이스로 감싸 한 dict에서 test_accuracy로 공정 비교한다.
import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression


class IsolationForestClassifier(BaseEstimator, ClassifierMixin):
    """비지도 IsolationForest → 지도 분류기 래퍼.
    fit: 정상(label=0) 샘플로만 학습. predict: 이상치→1, 정상→0.
    predict_proba: decision_function을 시그모이드로 이상 확률화.
    """

    def __init__(self, n_estimators=200, contamination=0.15, random_state=42):
        self.n_estimators = n_estimators
        self.contamination = contamination
        self.random_state = random_state

    def fit(self, X, y=None):
        X = np.asarray(X, dtype=float)
        self.classes_ = np.array([0, 1])
        self._iso = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=self.random_state,
        )
        if y is not None:
            y = np.asarray(y)
            X_normal = X[y == 0]
            if len(X_normal) == 0:
                X_normal = X
        else:
            X_normal = X
        self._iso.fit(X_normal)
        return self

    def predict(self, X):
        raw = self._iso.predict(np.asarray(X, dtype=float))  # 1 정상 / -1 이상
        return (raw == -1).astype(int)

    def predict_proba(self, X):
        s = self._iso.decision_function(np.asarray(X, dtype=float))  # 클수록 정상
        p_anom = 1.0 / (1.0 + np.exp(s * 5.0))
        p_anom = np.clip(p_anom, 1e-6, 1 - 1e-6)
        return np.column_stack([1 - p_anom, p_anom])


def build_models():
    """run_name → estimator. 모든 모델이 predict_proba 제공."""
    return {
        "LogisticRegression": LogisticRegression(max_iter=500, class_weight="balanced"),
        "RandomForest": RandomForestClassifier(n_estimators=200, random_state=42),
        "IsolationForest": IsolationForestClassifier(random_state=42),
    }
