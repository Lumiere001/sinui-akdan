import pandas as pd

from app.config import TEST_CSV, TRAIN_CSV


def test_csv_exists_and_columns():
    for p in (TRAIN_CSV, TEST_CSV):
        df = pd.read_csv(p)
        assert {"lat", "lng", "label"}.issubset(df.columns)
        assert set(df["label"].unique()).issubset({0, 1})


def test_both_classes_present():
    df = pd.read_csv(TRAIN_CSV)
    assert df["label"].nunique() == 2, "학습셋에 정상/이탈 두 클래스가 모두 있어야 함"
