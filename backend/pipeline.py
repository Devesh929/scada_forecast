from __future__ import annotations
from pandas.util import hash_pandas_object
import io
import os
import re
import ast
import gzip
import pickle
import re
import numpy as np
import pandas as pd
import json
import logging
import traceback
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, Tuple, List
from pandas.tseries.frequencies import to_offset
from tqdm import tqdm
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.base.wrapper import ResultsWrapper
from statsmodels.tsa.holtwinters.results import HoltWintersResults
from models import HoltWintersModel, OrbitLGTModel, OrbitDLTModel, ProphetUnivariateModel
from orbit.models.lgt import LGT
from orbit.models.dlt import DLT
import joblib
from dateutil.relativedelta import relativedelta
import logging
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
def _account_url(account_name: str) -> str:
    return f"https://{account_name}.blob.core.windows.net"
def get_blob_service(config: dict) -> BlobServiceClient:
    credential = DefaultAzureCredential()
    return BlobServiceClient(account_url=_account_url(config["account_name"]), credential=credential)
def _container_for(config: dict, kind: str) -> str:
    containers = config.get("containers", {}) or {}
    return containers.get(kind, config.get("container"))
def download_blob_bytes(config: dict, blob_path: str, *, logger: Optional[logging.Logger] = None, container: Optional[str] = None) -> bytes:
    bsc: BlobServiceClient = config["_bsc"]
    cont = container or _container_for(config, "outputs")
    if logger: logger.info(f"Downloading blob: {cont}/{blob_path}")
    return bsc.get_blob_client(container=cont, blob=blob_path).download_blob().readall()
def upload_blob_bytes(config: dict, blob_path: str, data: bytes, *, logger: Optional[logging.Logger] = None, container: Optional[str] = None):
    bsc: BlobServiceClient = config["_bsc"]
    cont = container or _container_for(config, "outputs")
    if logger: logger.info(f"Uploading blob: {cont}/{blob_path} ({len(data)} bytes)")
    bsc.get_blob_client(container=cont, blob=blob_path).upload_blob(data, overwrite=True)
def list_prefix(config: dict, prefix: str, *, container: Optional[str] = None) -> List[str]:
    bsc: BlobServiceClient = config["_bsc"]
    cont = container or _container_for(config, "outputs")
    cc = bsc.get_container_client(cont)
    return [b.name for b in cc.list_blobs(name_starts_with=prefix)]
class _PandasCompatUnpickler(pickle.Unpickler):
    RENAMES = {
        ("pandas.core.indexes.numeric", "Int64Index"):  ("pandas.core.indexes.base", "Index"),
        ("pandas.core.indexes.numeric", "UInt64Index"): ("pandas.core.indexes.base", "Index"),
        ("pandas.core.indexes.numeric", "Float64Index"):("pandas.core.indexes.base", "Index"),
    }
    def find_class(self, module, name):
        new_module, new_name = self.RENAMES.get((module, name), (module, name))
        return super().find_class(new_module, new_name)
def _pandas_compat_load_bytes(raw: bytes):
    if raw[:2] == b"\x1f\x8b":
        try:
            raw = gzip.decompress(raw)
        except Exception:
            pass
    try:
        return joblib.load(io.BytesIO(raw))
    except ModuleNotFoundError as e:
        pass
    except AttributeError as e:
        pass
    return _PandasCompatUnpickler(io.BytesIO(raw)).load()
def load_pickle_compat_filelike(fobj):
    data = fobj.read()
    return _pandas_compat_load_bytes(data)
def load_pickle_from_blob(bsc, container: str, blob: str, logger):
    raw = bsc.get_blob_client(container=container, blob=blob).download_blob().readall()
    return _pandas_compat_load_bytes(raw)
class MemoryLogHandler(logging.Handler):
    def __init__(self, level=logging.INFO, fmt="%(asctime)s [%(levelname)s] %(message)s"):
        super().__init__(level)
        self.buffer: list[str] = []
        self.setFormatter(logging.Formatter(fmt))
    def emit(self, record):
        try:
            self.buffer.append(self.format(record))
        except Exception:
            pass
def _yyyymm_from_timestamp(ts: pd.Timestamp | None) -> str:
    if ts is None or pd.isna(ts):
        return pd.Timestamp.today().strftime("%y%m")
    return pd.to_datetime(ts).strftime("%y%m")
def get_logger(config: dict) -> logging.Logger:
    name = f"forecast_pipeline:{config.get('experiment_name','exp')}"
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        h = logging.StreamHandler()
        h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        logger.addHandler(h)
        logger.propagate = False
    return logger
def read_file(
    config: dict,
    experiment_name: Optional[str] = None,
    model_name: Optional[str] = None,
    file_path: Optional[str] = None,
    file_type: Optional[str] = None,
    sheet_name: Optional[str] = None,
    container_kind: Optional[str] = None, logger: Optional[logging.Logger] = None):
    if logger is None:
        logger = get_logger(config)
    logger.info(
    f"[read_file] Called with experiment_name={experiment_name}, "
    f"model_name={model_name}, file_path={file_path}, "
    f"file_type={file_type}, sheet_name={sheet_name}, container_kind={container_kind}")
    def _container_for(kind: str) -> str:
        containers = config.get("containers", {}) or {}
        return containers.get(kind, config.get("container"))
    BA    = str(config.get("BA", "")).strip()
    mgmt  = str(config.get("mgmt", "")).strip()
    target= str(config.get("target", "")).strip()
    model = str(config.get("model", "")).strip()
    modelling_type = str(config.get("modelling_type", "")).strip()
    YEAR  = ((config.get("YEAR")))
    MONTH = ((config.get("MONTH")))
    if experiment_name and model_name and file_type in {"pkl", "excel"}:
        base = f"{BA}/app_forecasting/{YEAR:04d}/{MONTH:02d}/results/{experiment_name}"
        container_name = _container_for("models")
        if experiment_name == config.get("prophet_experiment_name") and model_name == "prophet_multivariate" and file_type == "pkl":
            blob = (
                f"{BA}/app_forecasting/{YEAR:04d}/{MONTH:02d}/results/{experiment_name}/artifacts/"
                f"{mgmt}____{target}-prophet_multivariate-full_class.pkl"
            )
            raw = download_blob_bytes(config, blob, container=container_name)
            return _pandas_compat_load_bytes(raw)
        if file_type == "pkl":
            if  modelling_type.lower() == "univariate":
                blob = f"{base}/artifacts/{mgmt}____{target}-{model}.pkl"
            else:
                blob = f"{base}/artifacts/{mgmt}____{target}-{model}-full_class.pkl"
            logger.info(f"Downloading model pickle blob: {blob}")
            raw = download_blob_bytes(config, blob, container=container_name)
            return _pandas_compat_load_bytes(raw)
        if file_type == "excel":
            if file_path in (None, ".xlsx"):
                blob = f"{base}/hypertunning/{mgmt}____{target}-{model}.xlsx"
            elif str(file_path).endswith("_all_training_data.xlsx"):
                blob = f"{base}/hypertunning/{mgmt}____{target}-{model}_all_training_data.xlsx"
            else:
                blob = f"{base}/hypertunning/{mgmt}____{target}-{model}{file_path}"
            raw = download_blob_bytes(config, blob, container=container_name)
            return pd.read_excel(io.BytesIO(raw), sheet_name=sheet_name)
    if file_path:
        blob = str(file_path)
        container_name = _container_for(container_kind or "inputs")
        raw = download_blob_bytes(config, blob, container=container_name)
        if file_type == "excel" or blob.lower().endswith((".xlsx",".xlsm",".xls")):
            return pd.read_excel(io.BytesIO(raw), sheet_name=sheet_name)
        if file_type == "csv" or blob.lower().endswith(".csv"):
            return pd.read_csv(io.BytesIO(raw))
        if file_type == "pkl" or blob.lower().endswith(".pkl"):
            bio = io.BytesIO(raw)
            try:
                return joblib.load(bio)
            except Exception:
                bio.seek(0)
                return pickle.load(bio)
        raise ValueError(f"Unsupported file_type for read_file: {file_type} for blob {blob}")
    raise ValueError("read_file: could not resolve blob path from arguments.")
def write_file(
    obj: Any,
    name: str,
    config: dict,
    file_type: str = "csv",
    result_file: bool = False,):
    out_container = _container_for(config, "outputs")
    month_root = config.get("_refresh_root", config.get("paths", {}).get("output_base_prefix", "outputs"))
    is_consolidated = str(name).startswith("consolidated_")
    if is_consolidated:
        folder = "consolidated results"
    else:
        combo_folder = config.get("_combo_folder") or f"{config.get('mgmt','MGMT')}_{config.get('target','KPI')}"
        folder = f"{month_root}/{combo_folder}"
    ext = {"csv": "csv", "excel": "xlsx", "pkl": "pkl"}.get(file_type, "csv")
    blob = f"{folder}/{name}.{ext}"
    if file_type == "pkl":
        bio = io.BytesIO(); joblib.dump(obj, bio)
        upload_blob_bytes(config, blob, bio.getvalue(), container=out_container)
        return blob
    if hasattr(obj, "to_csv") and file_type == "csv":
        bio = io.BytesIO(); obj.to_csv(bio, index=False)
        upload_blob_bytes(config, blob, bio.getvalue(), container=out_container)
        return blob
    if hasattr(obj, "to_excel") or isinstance(obj, (pd.DataFrame, pd.Series)):
        if file_type == "excel":
            bio = io.BytesIO()
            with pd.ExcelWriter(bio, engine="openpyxl") as xw:
                (obj if isinstance(obj, pd.DataFrame) else obj.to_frame()).to_excel(xw, index=False)
            upload_blob_bytes(config, blob, bio.getvalue(), container=out_container)
            return blob
        else:
            bio = io.BytesIO(); (obj if isinstance(obj, pd.DataFrame) else obj.to_frame()).to_csv(bio, index=False)
            upload_blob_bytes(config, blob, bio.getvalue(), container=out_container)
            return blob
    if isinstance(obj, bytes):
        upload_blob_bytes(config, blob, obj, container=out_container); return blob
    if isinstance(obj, str):
        upload_blob_bytes(config, blob, obj.encode("utf-8"), container=out_container); return blob
    raise ValueError("write_file: unsupported object type")
FOURIER_FEATURES = {
    "FOURIER_SINE_1","FOURIER_COSINE_1",
    "FOURIER_SINE_2","FOURIER_COSINE_2",
    "FOURIER_SINE_3","FOURIER_COSINE_3",
}
def build_feature_buckets(df_feature_used: pd.DataFrame, logger: logging.Logger) -> Dict[str, list]:
    unique_features = (
        df_feature_used["features_used"].dropna().astype(str).str.strip().unique().tolist()
    )
    internal_features = [f for f in unique_features if re.search(r"(?i)_lag\d+$", f)]
    target_lag = [f for f in unique_features if re.search(r"(?i)\bLAG_\d+$", f)]
    time_feature_set = TIME_CAT_CANDIDATES | FOURIER_FEATURES | {"PERIOD"}
    time_features = [f for f in unique_features if f in time_feature_set]
    categorized = set(internal_features) | set(target_lag) | set(time_features)
    external_features = [f for f in unique_features if f not in categorized]
    buckets = {
        "internal_features": internal_features,
        "target_lag": target_lag,
        "time_features": time_features,
        "external_features": external_features,
    }
    for k, v in buckets.items():
        logger.info(f"{k}: {len(v)} items")
    return buckets
def generate_quarter_half_features(date_like, categorical_features):
    dates = pd.to_datetime(pd.Series(date_like), errors="coerce")
    month = dates.dt.month
    quarter = dates.dt.quarter
    out = pd.DataFrame({"date": dates})
    for q in range(1, 5):
        col = f"QUARTER_Q{q}"
        if col in categorical_features:
            out[col] = (quarter == q).astype(int)
    if "HALF_H1" in categorical_features:
        out["HALF_H1"] = month.between(1, 6, inclusive="both").astype(int)
    if "HALF_H2" in categorical_features:
        out["HALF_H2"] = month.between(7, 12, inclusive="both").astype(int)
    for m in range(1, 13):
        col = f"MONTH_M{m}"
        if col in categorical_features:
            out[col] = (month == m).astype(int)
    if "QUARTER_START" in categorical_features:
        out["QUARTER_START"] = month.isin([1, 4, 7, 10]).astype(int)
    if "QUARTER_END" in categorical_features:
        out["QUARTER_END"] = month.isin([3, 6, 9, 12]).astype(int)
    if "quarter_end_month_flag" in categorical_features:
        out["quarter_end_month_flag"] = month.isin([3, 6, 9, 12]).astype(int)
    if "YEAR_END_START" in categorical_features:
        out["YEAR_END_START"] = month.isin([1, 12]).astype(int)
    keep = ["date"] + [c for c in categorical_features if c in out.columns]
    out = out[keep].fillna(0)
    for c in keep:
        if c != "date":
            out[c] = out[c].astype(int)
    return out
TIME_CAT_CANDIDATES = {
    "QUARTER_Q1", "QUARTER_Q2", "QUARTER_Q3", "QUARTER_Q4",
    "HALF_H1", "HALF_H2",
    "MONTH_M1","MONTH_M2","MONTH_M3","MONTH_M4","MONTH_M5","MONTH_M6",
    "MONTH_M7","MONTH_M8","MONTH_M9","MONTH_M10","MONTH_M11","MONTH_M12",
    "QUARTER_START", "QUARTER_END", "YEAR_END_START", "quarter_end_month_flag",
}
def _align_to_model(X, est):
    order = getattr(est, "feature_names_in_", None)
    if order is None:
        try:
            order = est.get_booster().feature_names
        except Exception:
            order = None
    if order is None:
        order = list(X.columns)
    return X.reindex(columns=list(order), fill_value=0)
def build_df_feat_eng_train(df_feature_used, df_training_data_used, df_mgmt_kpi, feature_buckets, freq="MS", logger=None, config=None):
    df_training = df_training_data_used.copy()
    df_mgmt = df_mgmt_kpi.copy()
    df_training["DATE"] = pd.to_datetime(df_training["DATE"])
    df_mgmt["date"] = pd.to_datetime(df_mgmt["date"])
    df_mgmt = df_mgmt.sort_values("date").groupby("date", as_index=False).last()
    start_date = df_training["DATE"].min()
    end_date = df_mgmt["date"].max()
    df_feat_eng_train = pd.DataFrame({"date": pd.date_range(start=start_date, end=end_date, freq=freq)})
    mgmt_idx = df_mgmt.set_index("date").sort_index()
    for col in feature_buckets.get("external_features", []) or []:
        df_feat_eng_train[col] = mgmt_idx[col].reindex(df_feat_eng_train["date"]).values if col in mgmt_idx.columns else pd.NA
    int_feats = feature_buckets.get("internal_features", []) or []
    lag_pattern = re.compile(r"^(?P<base>.+?)_lag(?P<n>\d+)$", flags=re.IGNORECASE)
    for feat in int_feats:
        m = lag_pattern.match(feat)
        if not m:
            continue
        base, n = m.group("base"), int(m.group("n"))
        candidates = {c.lower(): c for c in mgmt_idx.columns}
        base_col = candidates.get(base.lower())
        if base_col is None:
            df_feat_eng_train[feat] = pd.NA
            continue
        lag_series = mgmt_idx[base_col].shift(n)
        df_feat_eng_train[feat] = lag_series.reindex(df_feat_eng_train["date"]).values
    time_feats = feature_buckets.get("time_features", []) or []
    if time_feats:
        fourier_regex = re.compile(r"^FOURIER_(SINE|COSINE)_(\d+)$", flags=re.IGNORECASE)
        requested_cats = [f for f in time_feats if f in TIME_CAT_CANDIDATES]
        requested_fourier = [f for f in time_feats if fourier_regex.match(f)]
        if "PERIOD" in time_feats:
            start_period = None
            try:
                if df_training_data_used is not None and "PERIOD" in df_training_data_used.columns:
                    dtrp = df_training_data_used.copy()
                    if "DATE" in dtrp.columns:
                        dtrp["DATE"] = pd.to_datetime(dtrp["DATE"], errors="coerce")
                        dtrp = dtrp.sort_values("DATE")
                    elif "date" in dtrp.columns:
                        dtrp["date"] = pd.to_datetime(dtrp["date"], errors="coerce")
                        dtrp = dtrp.sort_values("date")
                    per_series = pd.to_numeric(dtrp["PERIOD"], errors="coerce").dropna()
                    if not per_series.empty:
                        start_period = int(per_series.iloc[0])
            except Exception:
                start_period = None
            if start_period is None:
                if logger:
                    logger.warning("PERIOD requested but not found in df_training_data_used; filling NaNs.")
                df_feat_eng_train["PERIOD"] = pd.NA
            else:
                df_feat_eng_train["PERIOD"] = start_period + np.arange(len(df_feat_eng_train))
        if requested_cats:
            cat_df = generate_quarter_half_features(df_feat_eng_train["date"], requested_cats)
            df_feat_eng_train = df_feat_eng_train.drop(columns=[c for c in requested_cats if c in df_feat_eng_train.columns], errors="ignore")
            df_feat_eng_train = df_feat_eng_train.merge(cat_df, on="date", how="left")
            for c in requested_cats:
                df_feat_eng_train[c] = df_feat_eng_train[c].fillna(0).astype(int)
        if requested_fourier:
            df_training = df_training.copy()
            df_training["DATE"] = pd.to_datetime(df_training["DATE"], errors="coerce")
            df_training["__month__"] = df_training["DATE"].dt.month
            for col in requested_fourier:
                if col not in df_training.columns:
                    df_feat_eng_train[col] = pd.NA
                    continue
                month_map = df_training.dropna(subset=[col]).sort_values("DATE").groupby("__month__")[col].last().to_dict()
                m = df_feat_eng_train["date"].dt.month
                df_feat_eng_train[col] = m.map(month_map)
    tlag_feats = feature_buckets.get("target_lag", []) or []
    if tlag_feats:
        TARGET_COL = (config or {}).get("target")
        lower_map = {c.lower(): c for c in mgmt_idx.columns}
        tgt_col = lower_map.get(str(TARGET_COL).lower()) if TARGET_COL else None
        for feat in tlag_feats:
            m = re.match(r"(?i)^LAG_(\d+)$", feat)
            if not m or tgt_col is None:
                df_feat_eng_train[feat] = pd.NA
                continue
            n = int(m.group(1))
            lag_series = mgmt_idx[tgt_col].shift(n)
            df_feat_eng_train[feat] = lag_series.reindex(df_feat_eng_train["date"]).values
    return df_feat_eng_train
def build_df_feat_eng_forecast(df_feat_eng_train, df_mgmt_kpi, feature_buckets, forecast_horizon, freq="MS",
                               df_feature_forecast=None, external_pred_col="predictions", date_col_mgmt="date",
                               df_training_data_used=None, config=None):
    df_train = df_feat_eng_train.copy()
    df_mgmt  = df_mgmt_kpi.copy()
    df_train["date"] = pd.to_datetime(df_train["date"], errors="coerce")
    last_train_date = df_train["date"].max()
    df_mgmt[date_col_mgmt] = pd.to_datetime(df_mgmt[date_col_mgmt], errors="coerce")
    df_mgmt = df_mgmt.sort_values(date_col_mgmt).groupby(date_col_mgmt, as_index=False).last()
    mgmt_idx = df_mgmt.set_index(date_col_mgmt).sort_index()
    step = to_offset(freq)
    future_dates = pd.date_range(start=last_train_date + step, periods=forecast_horizon, freq=freq)
    df_fore = pd.DataFrame({"date": future_dates})
    df_fore["date"] = pd.to_datetime(df_fore["date"], errors="coerce")
    ext_feats = feature_buckets.get("external_features", []) or []
    if ext_feats:
        if df_feature_forecast is None:
            for col in ext_feats:
                if col not in df_fore.columns:
                    df_fore[col] = pd.NA
        else:
            dff = df_feature_forecast.copy()
            date_col_ext = "DATE" if "DATE" in dff.columns else ("date" if "date" in dff.columns else None)
            if date_col_ext is None:
                raise ValueError("df_feature_forecast must contain 'DATE' or 'date'.")
            required = {date_col_ext, "modelling_level", external_pred_col}
            missing = required - set(dff.columns)
            if missing:
                raise ValueError(f"df_feature_forecast missing columns: {missing}")
            dff[date_col_ext] = pd.to_datetime(dff[date_col_ext], errors="coerce")
            dff = dff[dff["modelling_level"].isin(ext_feats)].copy()
            ext_wide = (
                dff.pivot_table(index=date_col_ext, columns="modelling_level", values=external_pred_col, aggfunc="last")
                .sort_index().reset_index().rename(columns={date_col_ext: "date"})
            )
            df_fore = df_fore.merge(ext_wide, on="date", how="left")
            for col in ext_feats:
                if col not in df_fore.columns:
                    df_fore[col] = pd.NA
    time_feats = feature_buckets.get("time_features", []) or []
    if time_feats:
        fourier_regex = re.compile(r"^FOURIER_(SINE|COSINE)_(\d+)$", flags=re.IGNORECASE)
        requested_cats = [f for f in time_feats if f in TIME_CAT_CANDIDATES]
        requested_fourier = [f for f in time_feats if fourier_regex.match(f)]
        if "PERIOD" in time_feats:
            last_period = None
            try:
                if "PERIOD" in df_train.columns:
                    lp = pd.to_numeric(df_train["PERIOD"], errors="coerce").dropna()
                    if not lp.empty:
                        last_period = int(lp.iloc[-1])
            except Exception:
                last_period = None
            if last_period is None:
                df_fore["PERIOD"] = pd.NA
            else:
                df_fore["PERIOD"] = last_period + 1 + np.arange(len(df_fore))
        if requested_cats:
            cat_df = generate_quarter_half_features(df_fore["date"], requested_cats)
            df_fore = df_fore.drop(columns=[c for c in requested_cats if c in df_fore.columns], errors="ignore")
            df_fore = df_fore.merge(cat_df, on="date", how="left")
            for c in requested_cats:
                df_fore[c] = df_fore[c].fillna(0).astype(int)
        if requested_fourier and df_training_data_used is not None:
            df_fore["date"] = pd.to_datetime(df_fore["date"], errors="coerce")
            dtr = df_training_data_used.copy()
            if "DATE" in dtr.columns:
                dtr["DATE"] = pd.to_datetime(dtr["DATE"], errors="coerce"); dtr["__month__"] = dtr["DATE"].dt.month; sort_key = "DATE"
            else:
                dtr["date"] = pd.to_datetime(dtr["date"], errors="coerce"); dtr["__month__"] = dtr["date"].dt.month; sort_key = "date"
            df_fore = df_fore.set_index("date")
            for col in requested_fourier:
                if col not in dtr.columns:
                    df_fore[col] = pd.NA
                    continue
                month_map = dtr.dropna(subset=[col]).sort_values(sort_key).groupby("__month__")[col].last().to_dict()
                m = df_fore.index.month
                df_fore[col] = m.map(month_map)
            df_fore = df_fore.reset_index()
    int_feats = feature_buckets.get("internal_features", []) or []
    if int_feats:
        lag_pattern = re.compile(r"^(?P<base>.+?)_lag(?P<n>\d+)$", flags=re.IGNORECASE)
        lower_map = {c.lower(): c for c in mgmt_idx.columns}
        fore_idx = pd.to_datetime(df_fore["date"], errors="coerce")
        combined_index = mgmt_idx.index.union(fore_idx).sort_values()
        for feat in int_feats:
            m = lag_pattern.match(feat)
            if not m:
                df_fore[feat] = pd.NA
                continue
            base, n = m.group("base"), int(m.group("n"))
            base_col = lower_map.get(base.lower())
            if base_col is None:
                df_fore[feat] = pd.NA
                continue
            base_full = mgmt_idx[base_col].reindex(combined_index)
            lag_full = base_full.shift(n)
            df_fore[feat] = lag_full.reindex(fore_idx).values
    tlag_feats = feature_buckets.get("target_lag", []) or []
    if tlag_feats:
        TARGET_COL = (config or {}).get("target")
        lower_map = {c.lower(): c for c in mgmt_idx.columns}
        tgt_col = lower_map.get(str(TARGET_COL).lower()) if TARGET_COL else None
        fore_idx = pd.to_datetime(df_fore["date"], errors="coerce")
        combined_index = mgmt_idx.index.union(fore_idx).sort_values()
        for feat in tlag_feats:
            m = re.match(r"(?i)^LAG_(\d+)$", feat)
            if not m or tgt_col is None:
                df_fore[feat] = pd.NA
                continue
            n = int(m.group(1))
            base_full = mgmt_idx[tgt_col].reindex(combined_index)
            lag_full  = base_full.shift(n)
            df_fore[feat] = lag_full.reindex(fore_idx).values
    return df_fore
def univariate_retrain_and_predict_with_params(config, df_mgmt_kpi, logger,
                                               forecast_horizon=None, params=None):
    logger.info("== Running Univariate model ==")
    if isinstance(params, str):
        params = ast.literal_eval(params)
    TARGET_COL = config["target"]
    model_name = config.get("model", "")
    df_mgmt_kpi["date"] = pd.to_datetime(df_mgmt_kpi["date"])
    y_train = df_mgmt_kpi.set_index("date")[TARGET_COL].astype(float)
    training_data = df_mgmt_kpi[["date", TARGET_COL]].rename(columns={TARGET_COL: "target"})
    write_file(training_data.reset_index(drop=False), "training_data", config, file_type="csv")
    logger.info(f"Training univariate model on {len(y_train)} records.")
    logger.info(f"Training {model_name} model using parameters passed in app-prod sheet")
    try:
        if model_name == "holtwinters_univariate":
            model_obj = HoltWintersModel(logger, model=None, params=params)
        elif model_name == "orbitlgt_univariate":
            model_obj = OrbitLGTModel(logger, model=None, params=params)
        elif model_name == "orbitdlt_univariate":
            model_obj = OrbitDLTModel(logger, model=None, params=params)
        elif model_name == "prophet_univariate":
            model_obj = ProphetUnivariateModel(logger, model=None, params=params)
        else:
            raise ValueError(f"Unsupported univariate model type: {model_name}")
        train_pred, fitted_model, used_params = model_obj.retrain(y_train)
        yhat = model_obj.predict(steps=forecast_horizon)
        future_dates = pd.date_range(
            start=y_train.index[-1] + pd.offsets.MonthBegin(1),
            periods=forecast_horizon,
            freq="MS"
        )
        forecast_df = pd.DataFrame({"date": future_dates, "yhat": yhat})
        X_train = None
        X_future = None
        return forecast_df, model_obj, X_train, X_future
    except Exception as e:
        logger.error("Univariate retrain and predict failed", exc_info=True)
        raise
def build_aligned_regressors(
    X_raw,
    required_cols,
    df_mgmt_kpi,
    config,
    logger,
    df_training_data_used=None,
):
    missing = [c for c in required_cols if c not in X_raw.columns]
    if missing:
        logger.warning(
            f"Missing regressors in engineered data: {missing}"
        )
        train_idx_ts = pd.to_datetime(X_raw.index, errors="coerce")
        mgmt = df_mgmt_kpi.copy()
        mgmt["date"] = pd.to_datetime(mgmt["date"], errors="coerce")
        mgmt_idx = mgmt.set_index("date").sort_index()
        mgmt_lower_map = {c.lower(): c for c in mgmt_idx.columns}
        lag_pattern = re.compile(r"^(?P<base>.+?)_lag(?P<n>\d+)$", flags=re.IGNORECASE)
        fourier_regex = re.compile(r"^FOURIER_(SINE|COSINE)_(\d+)$", flags=re.IGNORECASE)
        target_lag_regex = re.compile(r"(?i)^LAG_(\d+)$")
        TARGET_COL = config["target"]
        requested_cats = [c for c in missing if c in TIME_CAT_CANDIDATES]
        if requested_cats:
            logger.info(
                f"Generating missing time-bucket features: {requested_cats}"
            )
            cat_df = generate_quarter_half_features(train_idx_ts, requested_cats)
            cat_df = cat_df.set_index("date").reindex(train_idx_ts)
            for col in requested_cats:
                X_raw[col] = cat_df[col].astype("Int64").astype(float).values
        requested_fourier = [c for c in missing if fourier_regex.match(c)]
        if requested_fourier:
            if df_training_data_used is None:
                logger.warning(
                    "Fourier features missing but df_training_data_used not provided; "
                    f"filling NaNs: {requested_fourier}"
                )
                for col in requested_fourier:
                    X_raw[col] = np.nan
            else:
                logger.info(
                    f"Generating missing Fourier features from prior training data: {requested_fourier}"
                )
                dtr = df_training_data_used.copy()
                if "DATE" in dtr.columns:
                    dtr["DATE"] = pd.to_datetime(dtr["DATE"], errors="coerce")
                    dtr["__month__"] = dtr["DATE"].dt.month
                    sort_key = "DATE"
                else:
                    dtr["date"] = pd.to_datetime(dtr["date"], errors="coerce")
                    dtr["__month__"] = dtr["date"].dt.month
                    sort_key = "date"
                m_series = pd.Index(train_idx_ts).month
                for col in requested_fourier:
                    if col not in dtr.columns:
                        logger.warning(
                            f"Fourier column {col} not found in df_training_data_used; filling NaNs."
                        )
                        X_raw[col] = np.nan
                        continue
                    month_map = (
                        dtr.dropna(subset=[col])
                        .sort_values(sort_key)
                        .groupby("__month__")[col]
                        .last()
                        .to_dict()
                    )
                    X_raw[col] = pd.Series(m_series).map(month_map).values
        remaining_missing = [
            c for c in missing if c not in requested_cats + requested_fourier
        ]
        for col in remaining_missing:
            key = col.lower()
            if key in mgmt_lower_map:
                src = mgmt_lower_map[key]
                X_raw[col] = mgmt_idx[src].reindex(train_idx_ts).values
                continue
            tm = target_lag_regex.match(col)
            if tm:
                n = int(tm.group(1))
                tgt_src = mgmt_lower_map.get(str(TARGET_COL).lower())
                if tgt_src is None:
                    raise ValueError(
                        f"Target column '{TARGET_COL}' not found while building {col}"
                    )
                X_raw[col] = (
                    mgmt_idx[tgt_src].shift(n).reindex(train_idx_ts).values
                )
                continue
            m = lag_pattern.match(col)
            if m:
                base_name = m.group("base")
                lag_n = int(m.group("n"))
                base_src = mgmt_lower_map.get(base_name.lower())
                if base_src is None:
                    raise ValueError(
                        f"Engineered train missing regressor: {col} "
                        f"(base '{base_name}' not found)"
                    )
                lag_series = mgmt_idx[base_src].shift(lag_n)
                X_raw[col] = lag_series.reindex(train_idx_ts).values
                continue
            logger.error(
                "Missing regressor '%s' not found in engineered data or df_mgmt_kpi",
                col,
            )
            raise ValueError(f"Engineered train missing regressor: {col}")
    extra_cols = [c for c in X_raw.columns if c not in required_cols]
    if extra_cols:
        logger.warning(
            f"Dropping extra regressors not used in prev model: {extra_cols}"
        )
        X_raw = X_raw[required_cols]
    else:
        X_raw = X_raw[required_cols]
    return X_raw
def retrain_and_predict_with_pickles(
    config,
    df_feat_eng_train,
    df_feat_eng_forecast,
    df_mgmt_kpi,
    external_features,
    logger,
    df_training_data_used=None,
    forecast_horizon=None,
    prev_experiment_start_date=None,
    df_prev_training_data_used=None,
):
    df_mgmt_kpi["date"] = pd.to_datetime(df_mgmt_kpi["date"])
    need_trend = "TREND" in external_features or "SEASONALITY" in external_features
    use_prev_trainx = False
    if need_trend and prev_experiment_start_date is not None:
        df_feat_eng_train["date"] = pd.to_datetime(df_feat_eng_train["date"])
        df_feat_eng_forecast["date"] = pd.to_datetime(df_feat_eng_forecast["date"])
        current_start = df_feat_eng_train["date"].min()
        prev_start = pd.to_datetime(prev_experiment_start_date)
        if prev_start != current_start:
            use_prev_trainx = True
            logger.info(
                f"Previous exp start {prev_start.date()} != current train start "
                f"{current_start.date()} → using pkl train_x for Prophet trend."
            )
        else:
            logger.info(
                f"Previous exp start {prev_start.date()} == current train start "
                f"{current_start.date()} → using original alignment logic."
            )
    if need_trend and config.get("prophet_experiment_name"):
        logger.info("Adding TREND/SEASONALITY from previous Prophet model...")
        prev_model = read_file(
            config,
            experiment_name=config["prophet_experiment_name"],
            model_name="prophet_multivariate",
            file_type="pkl",
            logger=logger,
        )
        df_feat_eng_train["date"] = pd.to_datetime(df_feat_eng_train["date"])
        df_feat_eng_forecast["date"] = pd.to_datetime(df_feat_eng_forecast["date"])
        print("
        print(prev_experiment_start_date)
        print("
        drop_cols_prev = {"date", config["target"]}
        if use_prev_trainx and getattr(prev_model, "train_x", None) is not None:
            X_prev = prev_model.train_x.copy()
            required_cols = list(X_prev.columns)
            X_curr_raw = (
                df_feat_eng_train.set_index("date")
                .drop(
                    columns=[
                        c
                        for c in drop_cols_prev
                        if c in df_feat_eng_train.columns
                    ],
                    errors="ignore",
                )
            )
            X_curr_aligned = build_aligned_regressors(
                X_curr_raw,
                required_cols,
                df_mgmt_kpi,
                config,
                logger,
                df_training_data_used=df_training_data_used,
            )
            prev_idx = pd.to_datetime(X_prev.index, errors="coerce")
            last_prev_date = prev_idx.max()
            extra_idx = X_curr_aligned.index[
                X_curr_aligned.index > last_prev_date
            ]
            if len(extra_idx) > 0:
                X_extra = X_curr_aligned.loc[extra_idx]
                logger.info(
                    f"Extending prev train_x with {len(extra_idx)} new rows "
                    f"(from {extra_idx.min().date()} to {extra_idx.max().date()})."
                )
                X_prev = (
                    pd.concat([X_prev, X_extra])
                    .sort_index()
                )
            else:
                logger.info(
                    "No extra dates beyond previous train_x; using original train_x only."
                )
            y_prev = None
            if getattr(prev_model, "train_y", None) is not None:
                y_prev = pd.Series(prev_model.train_y).astype(float)
                if len(y_prev) != len(prev_model.train_x):
                    logger.warning(
                        "prev_model.train_y length mismatch with original train_x; "
                        "rebuilding target from df_mgmt_kpi."
                    )
                    y_prev = None
            if y_prev is None or len(y_prev) != len(X_prev):
                idx_dates = pd.to_datetime(X_prev.index, errors="coerce")
                y_prev = (
                    df_mgmt_kpi.set_index("date")
                    .reindex(idx_dates)[config["target"]]
                    .astype(float)
                )
            logger.info(
                f"[Prev-exp] Using extended train_x from pkl+current: {X_prev.shape}"
            )
            write_file(
                X_prev.reset_index(drop=False),
                "prev_exp_training_data_extended",
                config,
                file_type="csv",
            )
            from copy import deepcopy
            if getattr(prev_model, "params", None) is None:
                raise RuntimeError("Pickled Prophet model missing params.")
            safe_params = deepcopy(prev_model.params)
            _, _, _, train_trend_seasonal = prev_model.retrain(
                X=X_prev, y=y_prev, params=safe_params
            )
            _tmp = df_feat_eng_train.set_index("date")
            for col in ("TREND", "SEASONALITY"):
                if col in train_trend_seasonal.columns:
                    _tmp.loc[:, col] = train_trend_seasonal.reindex(
                        _tmp.index
                    )[col].values
                    _tmp[col] = pd.to_numeric(_tmp[col], errors="coerce")
            df_feat_eng_train = _tmp.reset_index()
            X_future_raw_prev = (
                df_feat_eng_forecast.set_index("date")
                .drop(
                    columns=[
                        c
                        for c in drop_cols_prev
                        if c in df_feat_eng_forecast.columns
                    ],
                    errors="ignore",
                )
            )
            X_future_prev = X_future_raw_prev.reindex(columns=required_cols)
            if X_future_prev.isna().any().any():
                X_future_prev = X_future_prev.fillna(method="ffill").fillna(0)
            steps_future = len(X_future_prev)
            lag_features = [
                c
                for c in X_future_prev.columns
                if str(c).upper().startswith("LAG_")
            ]
            future_trend_seasonal = (
                prev_model.get_trend_seasonal_with_lag_features(
                    X=X_future_prev.copy(),
                    steps=steps_future,
                    lag_features=lag_features,
                )
            )
            _tmpf = df_feat_eng_forecast.set_index("date")
            for col in ("TREND", "SEASONALITY"):
                if col in future_trend_seasonal.columns:
                    _tmpf.loc[:, col] = future_trend_seasonal.reindex(
                        _tmpf.index
                    )[col].values
                    _tmpf[col] = pd.to_numeric(
                        _tmpf[col], errors="coerce"
                    )
            df_feat_eng_forecast = _tmpf.reset_index()
        elif need_trend:
            logger.info(
                "Using original df_feat_eng_train-based alignment for previous "
                "Prophet TREND/SEASONALITY."
            )
            df_feat_eng_train["date"] = pd.to_datetime(df_feat_eng_train["date"])
            df_feat_eng_forecast["date"] = pd.to_datetime(
                df_feat_eng_forecast["date"]
            )
            train_idx = df_feat_eng_train["date"]
            y_prev = (
                df_mgmt_kpi.set_index("date")
                .reindex(train_idx)[config["target"]]
                .astype(float)
            )
            X_train_raw = (
                df_feat_eng_train.set_index("date")
                .drop(
                    columns=[
                        c
                        for c in drop_cols_prev
                        if c in df_feat_eng_train.columns
                    ],
                    errors="ignore",
                )
            )
            if getattr(prev_model, "train_x", None) is None:
                raise RuntimeError("Pickled Prophet model missing train_x.")
            required_cols = list(prev_model.train_x.columns)
            X_train_raw = build_aligned_regressors(
                X_train_raw,
                required_cols,
                df_mgmt_kpi,
                config,
                logger,
                df_training_data_used=df_training_data_used,
            )
            logger.info(
                f"Final shape of X_train_raw aligned to required_cols: {X_train_raw.shape}"
            )
            X_prev = X_train_raw.reindex(columns=required_cols).reindex(
                index=train_idx
            )
            write_file(
                X_train_raw.reset_index(drop=False),
                "prev_exp_training_data_aligned_to_current",
                config,
                file_type="csv",
            )
            from copy import deepcopy
            if getattr(prev_model, "params", None) is None:
                raise RuntimeError("Pickled Prophet model missing params.")
            safe_params = deepcopy(prev_model.params)
            _, _, _, train_trend_seasonal = prev_model.retrain(
                X=X_prev, y=y_prev, params=safe_params
            )
            _tmp = df_feat_eng_train.set_index("date")
            for col in ("TREND", "SEASONALITY"):
                if col in train_trend_seasonal.columns:
                    _tmp.loc[:, col] = train_trend_seasonal.reindex(
                        _tmp.index
                    )[col].values
                    _tmp[col] = pd.to_numeric(
                        _tmp[col], errors="coerce"
                    )
            df_feat_eng_train = _tmp.reset_index()
            X_future_raw = (
                df_feat_eng_forecast.set_index("date")
                .drop(
                    columns=[
                        c
                        for c in drop_cols_prev
                        if c in df_feat_eng_forecast.columns
                    ],
                    errors="ignore",
                )
            )
            X_future_prev = X_future_raw.reindex(
                columns=X_prev.columns
            ).reindex(index=df_feat_eng_forecast["date"])
            if X_future_prev.isna().any().any():
                X_future_prev = X_future_prev.fillna(method="ffill").fillna(0)
            steps_future = len(X_future_prev)
            lag_features = [
                c
                for c in X_future_prev.columns
                if str(c).upper().startswith("LAG_")
            ]
            future_trend_seasonal = (
                prev_model.get_trend_seasonal_with_lag_features(
                    X=X_future_prev.copy(),
                    steps=steps_future,
                    lag_features=lag_features,
                )
            )
            _tmpf = df_feat_eng_forecast.set_index("date")
            for col in ("TREND", "SEASONALITY"):
                if col in future_trend_seasonal.columns:
                    _tmpf.loc[:, col] = future_trend_seasonal.reindex(
                        _tmpf.index
                    )[col].values
                    _tmpf[col] = pd.to_numeric(
                        _tmpf[col], errors="coerce"
                    )
            df_feat_eng_forecast = _tmpf.reset_index()
    elif need_trend:
        logger.warning(
            "TREND/SEASONALITY requested but config['prophet_experiment_name'] "
            "is missing; skipping previous-experiment trend injection."
        )
    if config.get("modelling_type", "").lower() == "multivariate":
        logger.info("== Running Multivariate Pipeline ==")
        model_obj = read_file(
            config,
            experiment_name=config["experiment_name"],
            model_name=config["model"],
            file_type="pkl",
            logger=logger,
        )
        TARGET_COL = config["target"]
        df_feat_eng_train["date"] = pd.to_datetime(df_feat_eng_train["date"])
        df_feat_eng_forecast["date"] = pd.to_datetime(df_feat_eng_forecast["date"])
        train_idx = df_feat_eng_train["date"]
        y_train = (
            df_mgmt_kpi.set_index("date")
            .reindex(train_idx)[TARGET_COL]
            .astype(float)
        )
        drop_cols = {"date", TARGET_COL}
        X_train = (
            df_feat_eng_train.set_index("date")
            .drop(
                columns=[c for c in drop_cols if c in df_feat_eng_train.columns],
                errors="ignore",
            )
        )
        requested_ts = {
            c for c in external_features if c in {"TREND", "SEASONALITY"}
        }
        cols_keep = [
            c
            for c in X_train.columns
            if c not in {"TREND", "SEASONALITY"} or c in requested_ts
        ]
        X_train = X_train[cols_keep]
        training_data = X_train.copy()
        training_data["target"] = y_train
        write_file(
            training_data.reset_index(drop=False),
            "training_data",
            config,
            file_type="csv",
        )
        X_train = X_train.replace({pd.NA: np.nan})
        X_train = X_train.apply(pd.to_numeric, errors="coerce")
        if X_train.isna().any().any():
            X_train = X_train.fillna(method="ffill").fillna(0)
        y_train = pd.to_numeric(y_train, errors="coerce")
        if y_train.isna().any():
            y_train = y_train.fillna(method="ffill").fillna(0)
        model_obj.retrain(X_train, y_train)
        X_future_raw = (
            df_feat_eng_forecast.set_index("date")
            .drop(
                columns=[c for c in drop_cols if c in df_feat_eng_forecast.columns],
                errors="ignore",
            )
        )
        X_future = X_future_raw.reindex(columns=X_train.columns)
        steps = len(X_future)
        lag_re = re.compile(r"(?i)^LAG_(\d+)$")
        tlag_cols = [c for c in X_future.columns if lag_re.match(str(c))]
        if tlag_cols:
            tlag_info = sorted(
                [
                    (c, int(lag_re.match(str(c)).group(1)))
                    for c in tlag_cols
                ],
                key=lambda x: x[1],
            )
            est = getattr(model_obj, "model", model_obj)
            is_prophet = str(config.get("model")) == "prophet_multivariate"
            y_hist = (
                pd.to_numeric(y_train, errors="coerce")
                .dropna()
                .tolist()
            )
            yhat_list = []
            idx_list = list(X_future.index)
            for t, idx in enumerate(idx_list):
                for col, n in tlag_info:
                    val = float(y_hist[-n]) if len(y_hist) >= n else np.nan
                    X_future.at[idx, col] = val
                row = X_future.loc[[idx], X_train.columns]
                if row.isna().any(axis=None):
                    if t > 0:
                        prev_idx = idx_list[t - 1]
                        row = row.fillna(
                            X_future.loc[[prev_idx], X_train.columns]
                        )
                    row = row.fillna(0)
                if is_prophet:
                    pred = float(model_obj.predict(row, steps=1)[0])
                else:
                    row = _align_to_model(row, est).ffill().fillna(0)
                    pred = float(est.predict(row)[0])
                yhat_list.append(pred)
                y_hist.append(pred)
            yhat = np.array(yhat_list)
        else:
            write_file(
                X_future.reset_index(drop=False),
                "X_future",
                config,
                file_type="csv",
            )
            if str(config.get("model")) == "prophet_multivariate":
                yhat = model_obj.predict(X_future, steps=steps)
            else:
                est = getattr(model_obj, "model", model_obj)
                X_future = _align_to_model(X_future, est).ffill().fillna(0)
                yhat = est.predict(X_future)
        forecast_df = pd.DataFrame(
            {"date": X_future.index, "yhat": yhat}
        ).reset_index(drop=True)
    elif config.get("modelling_type", "").lower() == "univariate":
        logger.info("== Running Univariate Pipeline ==")
        model_obj = read_file(
            config,
            experiment_name=config["experiment_name"],
            model_name=config["model"],
            file_type="pkl",
            logger=logger,
        )
        TARGET_COL = config["target"]
        model = config.get("model", "")
        df_mgmt_kpi["date"] = pd.to_datetime(df_mgmt_kpi["date"])
        y_train = (
            df_mgmt_kpi.set_index("date")[TARGET_COL]
            .astype(float)
        )
        training_data = df_mgmt_kpi.copy()
        training_data = training_data[["date", TARGET_COL]].rename(
            columns={TARGET_COL: "target"}
        )
        write_file(
            training_data.reset_index(drop=False),
            "training_data",
            config,
            file_type="csv",
        )
        logger.info(f"Training univariate model on {len(y_train)} records.")
        if isinstance(model_obj, (ResultsWrapper, HoltWintersResults)):
            params = getattr(model_obj, "params", None)
            model_obj = HoltWintersModel(
                logger, model=model_obj, params=params
            )
            logger.info("Holts_params")
            for k, v in params.items():
                logger.info(f"{k}: {v}")
        if model == "orbitlgt_univariate":
            logger.info("TYPE(model_obj): %s", type(model_obj))
            model_obj = OrbitLGTModel(logger, model=model_obj)
        if model == "orbitdlt_univariate":
            model_obj = OrbitDLTModel(logger, model=model_obj)
        if model == "prophet_univariate":
            def rebuild_prophet_params(prophet_model):
                allowed = [
                    "growth",
                    "changepoints",
                    "n_changepoints",
                    "changepoint_range",
                    "yearly_seasonality",
                    "weekly_seasonality",
                    "daily_seasonality",
                    "seasonality_mode",
                    "seasonality_prior_scale",
                    "changepoint_prior_scale",
                    "holidays_prior_scale",
                    "mcmc_samples",
                    "interval_width",
                    "uncertainty_samples",
                ]
                params = {}
                for key in allowed:
                    if hasattr(prophet_model, key):
                        value = getattr(prophet_model, key)
                        if (
                            key == "seasonality_mode"
                            and value not in ["additive", "multiplicative"]
                        ):
                            continue
                        params[key] = value
                if (
                    hasattr(prophet_model, "holidays")
                    and prophet_model.holidays is not None
                ):
                    params["holidays_df"] = prophet_model.holidays
                if (
                    hasattr(prophet_model, "seasonalities")
                    and prophet_model.seasonalities
                ):
                    extracted_seasonalities = []
                    for name, cfg in prophet_model.seasonalities.items():
                        if name not in ["yearly", "weekly", "daily"]:
                            extracted_seasonalities.append(
                                {
                                    "name": name,
                                    "period": cfg.get("period"),
                                    "fourier_orders": cfg.get("fourier_order"),
                                }
                            )
                    if extracted_seasonalities:
                        params["extra_seasonalities"] = extracted_seasonalities
                return params
            loaded_params = rebuild_prophet_params(model_obj)
            model_obj = ProphetUnivariateModel(
                logger, model=model_obj, params=loaded_params
            )
        model_obj.retrain(y_train)
        yhat = model_obj.predict(steps=forecast_horizon)
        future_dates = pd.date_range(
            start=y_train.index[-1] + pd.Timedelta(1, unit="D"),
            periods=forecast_horizon,
            freq="MS",
        )
        forecast_df = pd.DataFrame(
            {"date": future_dates, "yhat": yhat}
        ).reset_index(drop=True)
        X_train = None
        X_future = None
    return forecast_df, model_obj, X_train, X_future
def get_shapley(model, model_name, X_train, future_x, logger) -> Optional[pd.DataFrame]:
    try:
        import shap
        import xgboost as xgb
    except Exception as e:
        logger.warning(f"SHAP or XGBoost not available: {e}")
        return None
    cols = sorted(X_train.columns)
    X_train = X_train[cols]; future_x = future_x[cols]
    combined_data = pd.concat([X_train, future_x])
    if model_name in ["xgboosttree_multivariate", "extratree_multivariate", "randomforest_multivariate", "lightgbm_multivariate"]:
        explainer = shap.TreeExplainer(model)
        shap_values = explainer(combined_data)
        feature_names = getattr(model, "feature_names_in_", combined_data.columns)
        mean_abs = np.abs(shap_values.values).mean(axis=0)
    elif model_name == 'xgboostlinear_multivariate':
        try:
            feature_names = model.get_booster().feature_names
            dtest = xgb.DMatrix(combined_data, feature_names=feature_names)
            shap_values = model.get_booster().predict(dtest, pred_contribs=True)
            shap_values = shap_values[:, :-1]
            mean_abs = np.abs(shap_values).mean(axis=0)
        except Exception as e:
            logger.warning(f"SHAP calculation failed for linear model: {e}")
            return None
    else:
        logger.info("SHAP only implemented for specific models; skipping.")
        return None
    total = mean_abs.sum(); perc = mean_abs / total if total else np.zeros_like(mean_abs)
    return pd.DataFrame({"VARIABLE": feature_names, "IMPORTANCE": perc}).sort_values("IMPORTANCE", ascending=False).reset_index(drop=True)
def lt_save_model(model, model_path: str):
    joblib.dump(model, model_path)
def lt_get_artifact_dict(config: dict, logger: logging.Logger) -> Dict[str, Dict[str, Any]]:
    import json as _json
    params = config.get("parameters")
    if params is None:
        raise ValueError("config['parameters'] is required for LT.")
    if isinstance(params, str):
        s = params.strip()
        try:
            params = ast.literal_eval(s)
        except Exception:
            params = _json.loads(s)
        if isinstance(params, dict) and "params" in params and "exog_features" in params:
            expected_id = f"{config.get('BA','').strip()}____{config.get('mgmt','').strip()}____{config.get('target','').strip()}"
            params = {
                expected_id: {
                    "experiment_name": config.get("experiment_name"),
                    "modelling_type": (config.get("modelling_type") or "multivariate"),
                    "model_params": params,
                }
            }
    if isinstance(params, dict) and any("____" in k for k in params.keys()):
        logger.info(f"LT artifacts: using dict with {len(params)} entries.")
        return params
    if isinstance(params, list):
        out: Dict[str, Dict[str, Any]] = {}
        for row in params:
            mp = str(row.get("modelling_period", row.get("MODELLING_PERIOD", ""))).strip().upper()
            cr = str(row.get("check_run", row.get("CHECK_RUN", ""))).strip().lower() in ("true","1","yes","y")
            if mp != "LT" or not cr:
                continue
            BA   = (row.get("BA") or config.get("BA") or "").strip()
            MGMT = (row.get("MGMT") or config.get("mgmt") or "").strip()
            KPI  = (row.get("KPI") or config.get("target") or "").strip()
            if not (BA and MGMT and KPI):
                logger.warning(f"Skipping row with missing BA/MGMT/KPI: {row}")
                continue
            mod_type = (row.get("modelling_type") or row.get("MODELLING_TYPE") or "multivariate").strip().lower()
            exp_name = row.get("CURRENT_EXP_NAME") or row.get("experiment_name") or config.get("experiment_name")
            pstr = row.get("PARAMETERS") or row.get("parameters") or row.get("model_params")
            if pstr in (None, "", "None", "none", "NULL", "null"):
                logger.warning(f"No PARAMETERS for {BA}/{MGMT}/{KPI}; skipping.")
                continue
            if not isinstance(pstr, (dict, list)):
                try:
                    pval = ast.literal_eval(str(pstr))
                except Exception:
                    pval = json.loads(str(pstr))
            else:
                pval = pstr
            if isinstance(pval, dict) and isinstance(pval.get("exog_features", []), list):
                pval["exog_features"] = [e for e in pval["exog_features"] if str(e).strip() != ""]
            key = f"{BA}____{MGMT}____{KPI}"
            out[key] = {
                "experiment_name": exp_name,
                "modelling_type": mod_type,
                "model_params": pval,
            }
        logger.info(f"LT artifacts built from CSV/list: {len(out)} entries.")
        if not out:
            raise ValueError("No LT rows with check_run==True were found in parameters.")
        return out
    if isinstance(params, dict) and "params" in params and "exog_features" in params:
        expected_id = f"{config.get('BA','').strip()}____{config.get('mgmt','').strip()}____{config.get('target','').strip()}"
        logger.info("LT artifacts: wrapping single unkeyed dict into expected_id.")
        return {expected_id: {"experiment_name": config.get("experiment_name"), "modelling_type": (config.get("modelling_type") or "multivariate"), "model_params": params}}
    raise TypeError("config['parameters'] must be a keyed dict, a list of rows, or a parseable string.")
def lt_prepare_exog_df(df_feature_forecast: pd.DataFrame, logger: logging.Logger) -> pd.DataFrame:
    dff = df_feature_forecast.copy()
    date_col = "DATE" if "DATE" in dff.columns else ("date" if "date" in dff.columns else None)
    if date_col is None:
        raise ValueError("LT exog file must contain a 'DATE' or 'date' column.")
    dff[date_col] = pd.to_datetime(dff[date_col], errors="coerce")
    if "date" not in dff.columns:
        dff = dff.rename(columns={date_col: "date"})
    dff = dff.sort_values("date").dropna(subset=["date"]).drop_duplicates(subset=["date"], keep="last")
    dff = dff.set_index("date").sort_index().asfreq("MS")
    for c in dff.columns:
        try: dff[c] = pd.to_numeric(dff[c], errors="ignore")
        except Exception: pass
    return dff
def lt_prepare_train_df(df_mgmt_kpi: pd.DataFrame, artifact_dict: Dict[str, Any], logger: logging.Logger) -> pd.DataFrame:
    df = df_mgmt_kpi.copy()
    if "date" not in df.columns and "DATE" in df.columns:
        df = df.rename(columns={"DATE": "date"})
    if "date" not in df.columns:
        raise ValueError("df_mgmt_kpi must contain a 'date' column for LT.")
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.sort_values("date").dropna(subset=["date"]).drop_duplicates(subset=["date"], keep="last")
    df = df.set_index("date").sort_index()
    target_cols = [key.split("____")[2] for key in artifact_dict.keys()]
    keep = [c for c in target_cols if c in df.columns]
    if not keep:
        raise ValueError(f"None of LT target columns present in df_mgmt_kpi: expected {target_cols}")
    out = df[keep].copy()
    if out.isna().any().any():
        na_cols = out.columns[out.isna().any()].tolist()
        raise ValueError(f"Missing values in LT training targets: {na_cols}")
    return out
def lt_validate_inputs(df_train: pd.DataFrame, exog_df: pd.DataFrame, artifact_dict: Dict[str, Any], forecast_horizon: int, logger: logging.Logger):
    if not isinstance(df_train.index, pd.DatetimeIndex) or not isinstance(exog_df.index, pd.DatetimeIndex):
        raise TypeError("LT: df_train and exog_df must be indexed by DatetimeIndex.")
    if df_train.index.duplicated().any() or exog_df.index.duplicated().any():
        raise ValueError("LT: Duplicate timestamps in df_train or exog_df.")
    targets = [k.split("____")[2] for k in artifact_dict.keys()]
    missing_targets = [t for t in targets if t not in df_train.columns]
    if missing_targets:
        raise ValueError(f"LT: Missing targets in df_train: {missing_targets}")
    for ident, art in artifact_dict.items():
        mp = art.get("model_params", {})
        exogs = mp.get("exog_features", []) if isinstance(mp, dict) else []
        exogs = [e for e in exogs if str(e).strip() != ""]
        missing_exog = [e for e in exogs if e not in exog_df.columns]
        if missing_exog:
            raise ValueError(f"LT: exog features missing for {ident}: {missing_exog}")
    last_train = df_train.index.max()
    expected = pd.date_range(start=last_train + relativedelta(months=1), periods=forecast_horizon, freq="MS")
    missing_h = expected.difference(exog_df.index)
    if len(missing_h) > 0:
        raise ValueError(f"LT: exogenous data missing for forecast horizon dates: {list(missing_h)}")
def lt_generate_sarimax_forecast(df_train: pd.DataFrame, exog_df: pd.DataFrame, artifact_dict: Dict[str, dict], forecast_horizon: int, config:dict, logger: logging.Logger) -> pd.DataFrame:
    forecast_months = pd.date_range(start=df_train.index.max() + relativedelta(months=1), periods=forecast_horizon, freq="MS")
    all_forecast = pd.DataFrame(index=forecast_months)
    for identifier, artifact in artifact_dict.items():
        try:
            logger.info(f"[LT] Forecasting {identifier} ...")
            _, mgmt, target_kpi = identifier.split("____")
            model_artifacts = artifact.get("model_params", {})
            model_params = model_artifacts.get("params")
            exog_features: Optional[List[str]] = None
            if artifact.get("modelling_type", "multivariate").lower() == "multivariate":
                ef = model_artifacts.get("exog_features", []) or []
                ef = [e for e in ef if str(e).strip() != ""]
                exog_features = ef if len(ef) > 0 else None
            if not isinstance(model_params, dict):
                raise ValueError("LT: model_params must be a dict.")
            if "order" not in model_params or "seasonal_order" not in model_params:
                raise ValueError("LT: order/seasonal_order missing in model_params.")
            endog_train = df_train[[target_kpi]].copy()
            model_args = {
                "endog": endog_train,
                "order": model_params["order"],
                "seasonal_order": model_params["seasonal_order"],
                "enforce_stationarity": False,
                "enforce_invertibility": False,
            }
            exog_train = None
            if exog_features:
                exog_train = exog_df.loc[df_train.index, exog_features].copy()
                if exog_train.isna().any().any():
                    raise ValueError(f"LT: NaNs in exog_train for {identifier}")
                model_args["exog"] = exog_train
                exog_future = exog_df.loc[forecast_months, exog_features].copy()
                if exog_future.isna().any().any():
                    raise ValueError(f"LT: NaNs in exog_future for {identifier}")
            else:
                exog_future = None
            try:
                write_file(endog_train.reset_index(drop=False), "Target_LT", config, file_type="csv")
                if exog_train is not None:
                    write_file(exog_train.reset_index(drop=False), "X_train_LT", config, file_type="csv")
                if exog_future is not None:
                    write_file(exog_future.reset_index(drop=False), "X_future_LT", config, file_type="csv")
            except Exception:
                pass
            model = SARIMAX(**model_args)
            results = model.fit(disp=False, maxiter=1000)
            np.set_printoptions(precision=8, suppress=True)
            logger.info("[LT][%s] params_vector=%s", identifier, results.params)
            try:
                lt_save_model(model, f"{mgmt}____{target_kpi}_SARIMAX.pkl")
            except Exception:
                pass
            fcst = results.get_forecast(steps=forecast_horizon, exog=exog_future)
            all_forecast[f"{mgmt}____{target_kpi}"] = fcst.predicted_mean.values
            logger.info(f"[LT] Done {identifier}")
        except Exception as e:
            logger.error(f"[LT] Failed for {identifier}: {e}", exc_info=True)
            continue
    all_forecast = all_forecast.reset_index().rename(columns={"index":"forecast_month"})
    all_forecast["run_date"] = pd.Timestamp.today().strftime("%Y-%m-01")
    return all_forecast
def run_retrain_prediction_steps(
    config: dict,
    df_mgmt_kpi: pd.DataFrame,
    logger) -> tuple[pd.DataFrame, Optional[pd.DataFrame]]:
    check_run = bool(config.get("check_run", False))
    modelling_period = str(config.get("modelling_period", "")).strip().upper()
    if not check_run:
        logger.info("Skipping run: check_run is False. Combination already ran; no changes.")
        return pd.DataFrame(), None
    if modelling_period == "LT":
        try:
            logger.info("== Pipeline start (LT) ==")
            if config.get("model","").lower() == "sarimax":
                logger.info("== LT SARIMA/SARIMAX ==")
                df_feature_forecast = read_file(
                    config,
                    file_path=config['paths']['input_path']['oe_forecast'],
                    file_type="excel",
                    sheet_name="Sheet1",
                    container_kind='models', logger=logger
                )
                exog_df = lt_prepare_exog_df(df_feature_forecast, logger)
                artifact_dict = lt_get_artifact_dict(config, logger)
                expected_id = f"{config.get('BA','').strip()}____{config.get('mgmt','').strip()}____{config.get('target','').strip()}"
                if expected_id in artifact_dict:
                    artifact_dict = {expected_id: artifact_dict[expected_id]}
                    logger.info(f"[LT] Using artifact for current combo: {expected_id}")
                else:
                    logger.info(f"[LT] Using all artifacts ({len(artifact_dict)}) (expected id not found: {expected_id})")
                df_train = lt_prepare_train_df(df_mgmt_kpi, artifact_dict, logger)
                lt_validate_inputs(
                    df_train=df_train,
                    exog_df=exog_df,
                    artifact_dict=artifact_dict,
                    forecast_horizon=15,
                    logger=logger
                )
                all_fcst = lt_generate_sarimax_forecast(
                    df_train=df_train,
                    exog_df=exog_df,
                    artifact_dict=artifact_dict,
                    forecast_horizon=15,
                    logger=logger,
                    config=config
                )
                value_cols = [c for c in all_fcst.columns if c not in ("forecast_month","run_date")]
                if len(value_cols) == 1:
                    fc = all_fcst[["forecast_month", value_cols[0]]].rename(columns={"forecast_month":"date", value_cols[0]:"yhat"})
                    logger.info("== Pipeline complete (LT, single combo) ==")
                    return fc, None
                logger.info("== Pipeline complete (LT, SARIMAX multi-combo wide) ==")
                return all_fcst, None
            elif config.get("model", "").lower() in {"prophet_univariate", "holtwinters_univariate", "orbitlgt_univariate", "orbitdlt_univariate"}:
                logger.info("== LT Univariate Holt/Prophet/Orbit ==")
                logger.info(
                f"df_mgmt_kpi date: "f"{[str(d.day)+'-'+str(d.month)+'-'+str(d.year) for d in pd.to_datetime(df_mgmt_kpi['date']).unique()]}")
                feature_buckets = {"external_features": []}
                params = config.get("parameters", None)
                model = config.get("model", "").lower()
                try:
                    if model in ["orbitlgt_univariate", "orbitdlt_univariate"]:
                        params_str = str(params).strip().lower() if params is not None else ""
                        if params is None or params_str in ["none", "", "null", "{}","nan"]:
                            raise ValueError(
                                f"Parameters required for univariate model '{model}' but none were provided."
                            )
                        forecast_df, model_obj, X_train, X_future = univariate_retrain_and_predict_with_params(
                            config=config,
                            df_mgmt_kpi=df_mgmt_kpi,
                            params=params,
                            logger=logger,
                            forecast_horizon=15
                        )
                    else:
                        forecast_df, model_obj, X_train, X_future = retrain_and_predict_with_pickles(
                            config=config,
                            df_feat_eng_train=None,
                            df_feat_eng_forecast=None,
                            df_mgmt_kpi=df_mgmt_kpi,
                            external_features=feature_buckets.get("external_features", []),
                            logger=logger,
                            df_training_data_used=None,
                            forecast_horizon=15
                        )
                except Exception as e:
                    logger.error("Pipeline failed (LT).")
                    logger.error(str(e))
                    logger.error(traceback.format_exc())
                    raise
                logger.info("== Pipeline complete (LT, univariate) ==")
                df_var_imp = None
                return forecast_df, df_var_imp
            else:    
                logger.warning(f"Unknown LT model '{config.get('model')}', expected 'sarimax', 'prophet_univariate', 'holtwinters_univariate', 'orbitlgt_univariate', 'orbitdlt_univariate'. Skipping.")
                return pd.DataFrame(), None
        except Exception as e:
            logger.error("Pipeline failed (LT).")
            logger.error(str(e))
            logger.error(traceback.format_exc())
            raise
    if modelling_period != "ST":
        logger.warning(f"Unknown modelling_period '{config.get('modelling_period')}'. Expected 'ST' or 'LT'. Skipping.")
        return pd.DataFrame(), None
    try:
        logger.info("== Pipeline start (ST) ==")
        if config.get("modelling_type","").lower() == "multivariate":
            logger.info("== ST MULTIVARIATE ==")
            df_feature_used = read_file(
                config,
                experiment_name=config['experiment_name'],
                model_name=config['model'],
                file_path=".xlsx",
                file_type="excel",
                sheet_name="features_used",
                logger = logger
            )
            df_training_data_used = read_file(
                config,
                experiment_name=config['experiment_name'],
                model_name=config['model'],
                file_path="_all_training_data.xlsx",
                file_type="excel",
                sheet_name="x_future_data", logger=logger
            )
            df_prev_training_data_used = None
            previous_experiment_start_date = None
            prophet_prev_exp = config.get("prophet_experiment_name")
            logger.info(f"Previous Prophet experiment name: {prophet_prev_exp}")
            if prophet_prev_exp:
                try:
                    df_prev_training_data_used = read_file(
                        config,
                        experiment_name=prophet_prev_exp,
                        model_name="prophet_multivariate",
                        file_path="_all_training_data.xlsx",
                        file_type="excel",
                        sheet_name="x_future_data",
                    )
                    previous_experiment_start_date = pd.to_datetime(
                        df_prev_training_data_used["DATE"]
                    ).min()
                    logger.info(
                        f"Previous experiment start date: {previous_experiment_start_date}"
                    )
                except Exception as e:
                    logger.warning(
                        f"Could not read previous experiment training data for "
                        f"{prophet_prev_exp}: {e}"
                    )
            config["prev_experiment_start_date"] = previous_experiment_start_date
            df_feature_forecast = read_file(
                config,
                file_path=config['paths']['input_path']['feature_forecast'],
                file_type="excel",
                sheet_name="future_predictions",
                container_kind='models', logger=logger
            )
            logger.info(
                f"df_mgmt_kpi date: "
                f"{[str(d.day)+'-'+str(d.month)+'-'+str(d.year) for d in pd.to_datetime(df_mgmt_kpi['date']).unique()]}"
            )
            if "date" in df_training_data_used.columns:
                logger.info(
                    f"df_training_data_used date: "
                    f"{[str(d.day)+'-'+str(d.month)+'-'+str(d.year) for d in pd.to_datetime(df_training_data_used['date']).unique()]}"
                )
            else:
                logger.info(
                    f"df_training_data_used DATE: "
                    f"{[str(d.day)+'-'+str(d.month)+'-'+str(d.year) for d in pd.to_datetime(df_training_data_used['DATE']).unique()]}"
                )
            if "date" in df_feature_forecast.columns:
                logger.info(
                    f"df_feature_forecast date: "
                    f"{[str(d.day)+'-'+str(d.month)+'-'+str(d.year) for d in pd.to_datetime(df_feature_forecast['date']).unique()]}"
                )
            else:
                logger.info(
                    f"df_feature_forecast DATE: "
                    f"{[str(d.day)+'-'+str(d.month)+'-'+str(d.year) for d in pd.to_datetime(df_feature_forecast['DATE']).unique()]}"
                )
            feature_buckets = build_feature_buckets(df_feature_used, logger)
            df_feat_eng_train = build_df_feat_eng_train(
                df_feature_used=df_feature_used,
                df_training_data_used=df_training_data_used,
                df_mgmt_kpi=df_mgmt_kpi,
                feature_buckets=feature_buckets,
                freq=config['freq'],
                logger=logger,
                config=config
            )
            df_feat_eng_forecast = build_df_feat_eng_forecast(
                df_feat_eng_train=df_feat_eng_train,
                df_mgmt_kpi=df_mgmt_kpi,
                feature_buckets=feature_buckets,
                forecast_horizon=config['forecast_horizon'],
                freq=config['freq'],
                df_feature_forecast=df_feature_forecast,
                external_pred_col="predictions",
                df_training_data_used=df_training_data_used,
                config=config
            )
            null_cols = df_feat_eng_forecast.columns[df_feat_eng_forecast.isnull().any()].tolist()
            if null_cols:
                logger.warning(f"Forecast frame has NaNs in: {null_cols}")
            forecast_df, model_obj, X_train, X_future = retrain_and_predict_with_pickles(
                config=config,
                df_feat_eng_train=df_feat_eng_train,
                df_feat_eng_forecast=df_feat_eng_forecast,
                df_mgmt_kpi=df_mgmt_kpi,
                external_features=feature_buckets.get("external_features",[]),
                logger=logger,
                df_training_data_used=df_training_data_used,
                prev_experiment_start_date=previous_experiment_start_date,df_prev_training_data_used=df_prev_training_data_used,
            )
            underlying = getattr(model_obj, "model", None)
            df_var_imp = (
                get_shapley(underlying, config['model'], X_train, X_future, logger)
                if underlying is not None else None
            )
            logger.info("== Pipeline complete (ST) ==")
            return forecast_df, df_var_imp
        elif config.get("modelling_type","").lower() not in ("univariate", "multivariate"):
            logger.warning(f"Unknown modelling type '{config.get('modelling_type').lower()}'. Expected 'multivariate' or 'univariate'. Skipping.")
            return pd.DataFrame(), None
        else:
            logger.info("== ST UNIVARIATE ==")
            try:
                logger.info(
                f"df_mgmt_kpi date: "
                f"{[str(d.day)+'-'+str(d.month)+'-'+str(d.year) for d in pd.to_datetime(df_mgmt_kpi['date']).unique()]}")
                feature_buckets = {"external_features": []}
                params = config.get("parameters", {})
                model = config.get("model", "").lower()
                try:
                    if model in ["orbitlgt_univariate", "orbitdlt_univariate"]:
                        params_str = str(params).strip().lower() if params is not None else ""
                        if params is None or params_str in ["none", "", "null", "{}","nan"]:
                            raise ValueError(
                                f"Parameters required for univariate model '{model}' but none were provided."
                            )
                        forecast_df, model_obj, X_train, X_future = univariate_retrain_and_predict_with_params(
                            config=config,
                            df_mgmt_kpi=df_mgmt_kpi,
                            params=params,
                            logger=logger,
                            forecast_horizon=config['forecast_horizon']
                        )
                    else:
                        forecast_df, model_obj, X_train, X_future = retrain_and_predict_with_pickles(
                        config=config,
                        df_feat_eng_train=None,
                        df_feat_eng_forecast=None,
                        df_mgmt_kpi=df_mgmt_kpi,
                        external_features=feature_buckets.get("external_features", []),
                        logger=logger,
                        df_training_data_used=None,
                        forecast_horizon=config['forecast_horizon'])
                except Exception as e:
                    logger.error("Pipeline failed (ST).")
                    logger.error(str(e))
                    logger.error(traceback.format_exc())
                    raise
                logger.info("== Pipeline complete (ST) ==")
                df_var_imp = None
                return forecast_df, df_var_imp
            except Exception as e:
                logger.error("Pipeline failed (ST - univariate).")
                logger.error(str(e))
                logger.error(traceback.format_exc())
                raise
    except Exception as e:
        logger.error("Pipeline failed (ST).")
        logger.error(str(e))
        logger.error(traceback.format_exc())
        raise
def retrain_predict(config: dict, df: pd.DataFrame, logger) -> Tuple[pd.DataFrame, Optional[pd.DataFrame]]:
    df_forecast, df_importance = run_retrain_prediction_steps(config, df, logger)
    logger.info("Retraining and prediction complete.", extra={"status": "SUCCESS"})
    write_file(df_forecast, "forecast_results", config, file_type="csv", result_file=True)
    if df_importance is not None:
        write_file(df_importance, "feature_importance", config, file_type="csv", result_file=True)
    return df_forecast, df_importance
def get_logger(config: dict) -> logging.Logger:
    logger = logging.getLogger(f"forecast_pipeline:{config.get('experiment_name','exp')}")
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        h = logging.StreamHandler()
        h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        logger.addHandler(h)
    return logger
def read_inputs(master_config: dict) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    df_comb = read_file(master_config, file_path=master_config['paths']['input_path']['combination_csv'], file_type='csv', container_kind='inputs', logger=None)
    src = master_config['paths']['input_path']['mgmt_kpi']
    if str(src).lower().endswith((".xlsx",".xls",".xlsm")):
        df_mgmt_long = read_file(master_config, file_path=src, file_type='excel', sheet_name=0, container_kind='inputs', logger=logger)
    else:
        df_mgmt_long = read_file(master_config, file_path=src, file_type='csv', container_kind='outputs', logger=None)
    try:
        _ = read_file(master_config, file_path=master_config['paths']['input_path']['feature_forecast'], file_type='excel', sheet_name='future_predictions', container_kind='models', logger=None)
    except Exception:
        pass
    try:
        _ = read_file(master_config, file_path=master_config['paths']['input_path']['oe_forecast'], file_type='excel', sheet_name='Sheet1', container_kind='models', logger=None)
    except Exception:
        pass
    return df_comb, df_mgmt_long, pd.DataFrame()
def make_mgmt_kpi_wide(
    df_long: pd.DataFrame,
    ba: str,
    mgmt: str,
    *,
    date_col: str = "date",
    ba_col: str = "BA",
    mgmt_col: str = "MGMT",
    kpi_col: str = "KPI",
    value_col: str | None = None) -> pd.DataFrame:
    d = df_long.copy()
    cols_map = {c.lower(): c for c in d.columns}
    def col(name: str) -> str:
        key = name.lower()
        if key in cols_map:
            return cols_map[key]
        raise KeyError(f"Column '{name}' not found in mgmt_kpi dataframe")
    date_c = col(date_col)
    ba_c   = col(ba_col)
    mgmt_c = col(mgmt_col)
    kpi_c  = col(kpi_col)
    if value_col is None:
        candidates = [c for c in d.columns if c.lower() in {"value","y","amount"}]
        if not candidates:
            exclude = {date_c, ba_c, mgmt_c, kpi_c}
            num_candidates = [c for c in d.columns if c not in exclude and pd.api.types.is_numeric_dtype(d[c])]
            if not num_candidates:
                raise KeyError("Could not infer value column (tried: 'value','y','amount' or any numeric col).")
            value_c = num_candidates[0]
        else:
            value_c = candidates[0]
    else:
        value_c = col(value_col)
    filt = (d[ba_c].astype(str).str.strip().str.casefold() == str(ba).strip().casefold()) & \
           (d[mgmt_c].astype(str).str.strip().str.casefold() == str(mgmt).strip().casefold())
    d = d.loc[filt, [date_c, kpi_c, value_c]].copy()
    if d.empty:
        raise ValueError(f"No mgmt_kpi rows for BA='{ba}', MGMT='{mgmt}'")
    d[date_c] = pd.to_datetime(d[date_c], errors="coerce")
    d = d.dropna(subset=[date_c]).sort_values([date_c, kpi_c])
    d = d.groupby([date_c, kpi_c], as_index=False).last()
    wide = d.pivot(index=date_c, columns=kpi_c, values=value_c).sort_index().reset_index()
    for c in wide.columns:
        if c != date_c:
            wide[c] = pd.to_numeric(wide[c], errors="coerce")
    if date_c != "date":
        wide = wide.rename(columns={date_c: "date"})
    return wide
def _normalize_fcst(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    cols = {c.lower(): c for c in d.columns}
    if "date" in cols and "yhat" in cols:
        return d.rename(columns={cols["date"]: "date", cols["yhat"]: "yhat"})
    if "date" in cols:
        date_col = cols["date"]
    elif "forecast_month" in cols:
        date_col = cols["forecast_month"]
    else:
        raise ValueError("Forecast frame missing a date-like column")
    value_cols = [c for c in d.columns if c != date_col and d[c].dtype.kind in "if"]
    if not value_cols:
        raise ValueError("Could not find numeric forecast columns to melt")
    long = d.melt(id_vars=[date_col], value_vars=value_cols, var_name="series", value_name="yhat")
    long = long.rename(columns={date_col: "date"})
    return long[["date", "yhat"]]
def _mk_label(cfg: dict) -> str:
    return f"{cfg['mgmt']}____{cfg['target']}"
def _read_raw_data_for_cons(master_config: dict) -> pd.DataFrame:
    raw = read_file(
        master_config,
        file_path=master_config["paths"]["input_path"]["raw_data"],
        file_type="excel",
        sheet_name=0,
        container_kind="inputs", logger=logger)
    raw = raw.copy()
    raw["date"] = pd.to_datetime(raw["date"], format="mixed", dayfirst=True, errors="coerce")
    return raw
def cons_forecast(month_of_extraction: str | pd.Timestamp,raw_data, future_forecast_df, rolling_window, steps, ba, divisions, kpi):
    month_of_extraction="2025-11-01"
    name=month_of_extraction[2]+month_of_extraction[3]+month_of_extraction[5]+month_of_extraction[6]
    to_drop = {"EL", "IA", "ABB", "MO"}
    divisions = [d for d in divisions if d not in to_drop]
    print(future_forecast_df.head(5),"wwww")
    future_forecast_df['run_date']=pd.to_datetime(future_forecast_df['run_date'], format="mixed", dayfirst=True, errors="coerce")
    future_forecast_df['forecast_date']=pd.to_datetime(future_forecast_df['forecast_date'],  dayfirst=True, errors="coerce")
    future_forecast_df=future_forecast_df[(future_forecast_df['kpi']==kpi) & (future_forecast_df['run_date']==pd.to_datetime(month_of_extraction)) & 
    (future_forecast_df['forecast_type']=='ST') & (future_forecast_df['model_type']=='Multivariate')]
    print(future_forecast_df.head(5))
    raw_data=raw_data.sort_values(by=['mgmt', 'date']).reset_index(drop=True)
    raw_data.set_index('date', inplace=True)
    cons_calc=pd.DataFrame([])
    cons_calc['date']=pd.to_datetime(raw_data[raw_data['mgmt']==f'Cons ({ba})'].index)
    cons_calc['cons_value']=abs(raw_data[raw_data['mgmt']==f'Cons ({ba})'][kpi].values)
    cons_calc['sum_div']=0
    cons_calc.set_index('date', inplace=True)
    for div in divisions:
        cons_calc[div]=abs(raw_data[raw_data['mgmt']==div][kpi].values)
        cons_calc['sum_div']+=cons_calc[div]
    cons_calc['cons_percent']=abs(cons_calc['cons_value'])/abs(cons_calc['sum_div'])
    future_dates = pd.date_range(
    start=pd.to_datetime(month_of_extraction) + pd.offsets.MonthBegin(0),
    periods=steps,
    freq='MS')
    future_dates=pd.to_datetime(future_dates)
    future_cons_calc=pd.DataFrame([])
    future_cons_calc['date']=future_dates
    future_cons_calc.set_index('date', inplace=True)
    future_cons_calc['sum_div']=0
    print(future_dates)
    print(future_forecast_df["forecast_date"],"22")
    target_months = pd.DatetimeIndex(future_dates).to_period('M')
    future_forecast_df = future_forecast_df[
        future_forecast_df['forecast_date'].dt.to_period('M').isin(target_months)
    ]
    for div in divisions:
        temp=future_forecast_df[future_forecast_df['mgmt']==div]
        print(temp)
        future_cons_calc[div]=abs(temp['forecast_value'].values)
        future_cons_calc['sum_div']+=future_cons_calc[div]
    future_cons_calc['cons_percent']=0
    print(rf'cons_calc for future data: {future_cons_calc}')
    cons_calc=pd.concat([cons_calc, future_cons_calc], axis=0)
    print(rf'cons_calc concatenated: {cons_calc}')
    for step in range(0,steps):
        past_n_dates=pd.date_range(start=future_dates[step]- pd.DateOffset(months=rolling_window), end=future_dates[step] - pd.DateOffset(months=1), freq='MS')
        cons_calc.iloc[-steps+step, -1]=np.mean(cons_calc.iloc[[i for i in range(-steps+step-1,-steps+step-rolling_window-1,-1)], -1].values)
        cons_calc.iloc[-steps+step, 0]=cons_calc.iloc[-steps+step, -1] * cons_calc.iloc[-steps+step, 1]
    print(rf'cons_calc: {cons_calc}')
    final_df=cons_calc[['cons_value','cons_percent']]
    final_df=final_df.iloc[-steps:,:]
    final_df['mgmt']=f'Cons ({ba})'
    final_df['kpi']=kpi
    final_df['run_date']=month_of_extraction
    final_df['forecast_date']=cons_calc.index[-steps:].values
    print(rf'final reporting format cons_df: {final_df}')
    return final_df, cons_calc
def _consolidated_blob_path(name: str, config: dict, *, file_type: str = "csv") -> tuple[str, str, str]:
    ext = {"csv": "csv", "excel": "xlsx", "pkl": "pkl"}.get(file_type, "csv")
    out_container = _container_for(config, "outputs")
    folder = "consolidated results bijaya trial1"
    blob = f"{folder}/{name}.{ext}"
    return out_container, folder, blob
def _safe_read_consolidated_csv(name: str, config: dict) -> pd.DataFrame:
    container, _, blob = _consolidated_blob_path(name, config, file_type="csv")
    try:
        raw = download_blob_bytes(config, blob, container=container)
        bio = io.BytesIO(raw)
        return pd.read_csv(bio)
    except Exception:
        return pd.DataFrame()
def _align_columns(df_old: pd.DataFrame, df_new: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    union = list(dict.fromkeys([*df_old.columns, *df_new.columns]))
    return df_old.reindex(columns=union), df_new.reindex(columns=union)
def _strip_text_cols(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    d = df.copy()
    for c in cols:
        if c in d.columns:
            d[c] = d[c].astype(str).str.strip()
    return d
def _to_datetime(df: pd.DataFrame, col: str) -> pd.DataFrame:
    d = df.copy()
    if col in d.columns:
        d[col] = pd.to_datetime(d[col], errors="coerce", dayfirst=True)
    return d
def _normalize_predictions_for_upsert(df: pd.DataFrame) -> pd.DataFrame:
    req_cols = ["ba", "mgmt", "kpi", "forecast_type", "model_type", "forecast_date", "run_date"]
    d = df.copy()
    for rc in req_cols:
        if rc not in d.columns:
            d[rc] = pd.NA
    d = _strip_text_cols(d, ["ba", "mgmt", "kpi", "forecast_type", "model_type"])
    d = _to_datetime(d, "run_date")
    d = _to_datetime(d, "forecast_date")
    if "forecast_value" in d.columns:
        d["forecast_value"] = pd.to_numeric(d["forecast_value"], errors="coerce")
    return d
def _denormalize_predictions_for_save(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    if "forecast_date" in d.columns:
        d["forecast_date"] = pd.to_datetime(d["forecast_date"], errors="coerce").dt.strftime("%d/%m/%Y")
    if "run_date" in d.columns:
        d["run_date"] = pd.to_datetime(d["run_date"], errors="coerce").dt.strftime("%d/%m/%Y")
    return d
def _denormalize_featimp_for_save(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    if "Run_date" in d.columns:
        d["Run_date"] = pd.to_datetime(d["Run_date"], errors="coerce").dt.strftime("%d-%m-%Y")
    return d
    return d
def _normalize_cons_for_upsert(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    for c in ["mgmt", "kpi"]:
        if c in d.columns:
            d[c] = d[c].astype(str).str.strip()
    d = _to_datetime(d, "run_date")
    d = _to_datetime(d, "forecast_date")
    for c in ["cons_value", "cons_percent"]:
        if c in d.columns:
            d[c] = pd.to_numeric(d[c], errors="coerce")
    return d
def _normalize_featimp_for_upsert(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    for c in ["BA", "MGMT", "KPI", "MODEL", "EXPERIMENT", "VARIABLE"]:
        if c in d.columns:
            d[c] = d[c].astype(str).str.strip()
    if "Run_date" in d.columns:
        d["Run_date"] = pd.to_datetime(d["Run_date"], errors="coerce", dayfirst=True)
    if "IMPORTANCE" in d.columns:
        d["IMPORTANCE"] = pd.to_numeric(d["IMPORTANCE"], errors="coerce")
    return d
def upsert_consolidated_csv(
    name: str,
    df_new: pd.DataFrame,
    key_cols: list[str],
    config: dict,
    *,
    flavor: str = "predictions",  ) -> tuple[int, int, int]:
    old = _safe_read_consolidated_csv(name, config)
    if flavor == "predictions":
        old_n = _normalize_predictions_for_upsert(old) if not old.empty else old
        new_n = _normalize_predictions_for_upsert(df_new)
    elif flavor == "cons":
        old_n = _normalize_cons_for_upsert(old) if not old.empty else old
        new_n = _normalize_cons_for_upsert(df_new)
    elif flavor == "featimp":
        old_n = _normalize_featimp_for_upsert(old) if not old.empty else old
        new_n = _normalize_featimp_for_upsert(df_new)
    else:
        raise ValueError("Unknown upsert flavor")
    old_a, new_a = _align_columns(old_n, new_n)
    if not old_a.empty:
        old_keys = old_a[key_cols].astype(str).agg("|".join, axis=1)
        new_keys = new_a[key_cols].astype(str).agg("|".join, axis=1)
        overlap_count = new_keys.isin(set(old_keys)).sum()
    else:
        overlap_count = 0
    merged = pd.concat([old_a, new_a], ignore_index=True)
    merged = merged.drop_duplicates(subset=key_cols, keep="last")
    if flavor == "predictions":
        merged = _denormalize_predictions_for_save(merged)
    elif flavor == "cons":
        merged["forecast_date"] = pd.to_datetime(
        merged["forecast_date"], errors="coerce", dayfirst=True
    ).dt.strftime("%d/%m/%Y")
        merged["run_date"] = pd.to_datetime(
        merged["run_date"], errors="coerce", dayfirst=True
    ).dt.strftime("%d/%m/%Y")
    if flavor == "featimp":
        merged = _denormalize_featimp_for_save(merged)
    container, _, blob = _consolidated_blob_path(name, config, file_type="csv")
    bio = io.BytesIO()
    merged.to_csv(bio, index=False)
    upload_blob_bytes(config, blob, bio.getvalue(), container=container)
    return len(old_a), int(overlap_count), len(merged)
def _normalize_predictions(df: pd.DataFrame) -> pd.DataFrame:
    p = df.copy()
    colmap = {c.lower(): c for c in p.columns}
    for req in ["ba", "mgmt", "kpi"]:
        if req not in colmap:
            raise KeyError(f"Consolidated predictions missing column '{req}'")
        if req != colmap[req]:
            p = p.rename(columns={colmap[req]: req})
    if "run_date" not in p.columns:
        if "run_date" in colmap and colmap["run_date"] != "run_date":
            p = p.rename(columns={colmap["run_date"]: "run_date"})
        else:
            raise KeyError("Consolidated predictions missing 'run_date'")
    if "forecast_date" not in p.columns:
        if "date" in p.columns:
            p = p.rename(columns={"date": "forecast_date"})
        elif "date" in colmap:
            p = p.rename(columns={colmap["date"]: "forecast_date"})
        else:
            raise KeyError("Consolidated predictions missing 'forecast_date' (or 'date')")
    if "forecast_value" not in p.columns:
        if "yhat" in p.columns:
            p = p.rename(columns={"yhat": "forecast_value"})
        elif "yhat" in colmap:
            p = p.rename(columns={colmap["yhat"]: "forecast_value"})
        else:
            raise KeyError("Consolidated predictions missing 'forecast_value' (or 'yhat')")
    if "forecast_type" not in p.columns:
        p["forecast_type"] = "ST"
    if "model_type" not in p.columns:
        p["model_type"] = "Multivariate"
    p["run_date"] = pd.to_datetime(p["run_date"], errors="coerce")
    p["forecast_date"] = pd.to_datetime(p["forecast_date"], errors="coerce")
    return p
def run_all_cons(master_config: dict, consolidated_predictions: pd.DataFrame) -> pd.DataFrame:
    preds = _normalize_predictions(consolidated_predictions)
    month_of_extraction = preds["run_date"].max().to_period("M").to_timestamp()
    raw_data = read_file(
        master_config,
        file_path="data_extraction/raw_data_2509.csv",
        file_type="csv",
        container_kind="outputs", logger=None)
    bas = sorted(x for x in preds["ba"].dropna().astype(str).unique() if x.strip().upper() != "ABB")
    out_chunks = []
    for ba in bas:
        cons_label = f"Cons ({ba})"
        kpis = sorted(preds.loc[preds["ba"] == ba, "kpi"].dropna().astype(str).unique())
        for kpi in kpis:
            divis = (
    preds.loc[
        (preds["ba"] == ba) &
        (preds["kpi"] == kpi) &
        (preds["forecast_type"] == "ST"),
        "mgmt"
    ]
    .dropna()
    .astype(str)
    .unique()
    .tolist())
            divisions = sorted([d for d in divis if d != cons_label])
            to_drop = {"EL", "IA", "ABB", "MO"}
            divisions = [d for d in divisions if d not in to_drop]
            if not divisions:
                continue
            try:
                sub_preds = preds.loc[(preds["ba"] == ba) & (preds["kpi"] == kpi)].copy()
                print(sub_preds.head(7))
                print(ba,divisions,kpi)
                final_df, _ = cons_forecast(
                    raw_data=raw_data,
                    future_forecast_df=sub_preds,
                    month_of_extraction=month_of_extraction,
                    rolling_window=3,
                    steps=3,
                    ba=ba,
                    divisions=divisions,
                    kpi=kpi,
                )
                out_chunks.append(final_df)
            except Exception as e:
                logging.exception(f"CONS failed for BA={ba}, KPI={kpi}: {e}")
                continue
    if out_chunks:
        cons_all = pd.concat(out_chunks, ignore_index=True)
        write_file(cons_all, "consolidated_cons_predictions", master_config, file_type="csv")
        return cons_all
    return pd.DataFrame()
def format_consolidated_predictions(
    forecast_df: pd.DataFrame,
    cfg: dict,
    df_mgmt_kpi_scoped: pd.DataFrame,
) -> pd.DataFrame:
    run_date = pd.to_datetime("2025-11-01")
    print(run_date)
    last_train = pd.to_datetime(df_mgmt_kpi_scoped["date"]).max()
    train_data_month_year = f"{last_train.year % 100:02d}{last_train.month:02d}"
    forecast_type = str(cfg.get("modelling_period", "")).strip().upper()
    rows = forecast_df.copy().sort_values("date").reset_index(drop=True)
    rows["prediction_window"] = [f"N+{i+1}" for i in range(len(rows))]
    print(forecast_df,"!!!!!!!!!!!!!!!!!!111")
    rows["ba"]=cfg["BA"]
    rows["mgmt"] = cfg["mgmt"]
    rows["kpi"] = cfg["target"]
    rows["run_date"] = run_date
    rows["forecast_type"] = forecast_type
    rows["train_data_month_year"] = train_data_month_year
    rows["forecast_date"] = pd.to_datetime(rows["date"])
    rows["forecast_value"] = rows["yhat"].astype(float).round(2)
    rows["model_version"] = "v1.0"
    rows["model_type"] = (cfg.get("modelling_type") or "Multivariate").title()
    return rows[
        [
            "ba",
            "mgmt",
            "kpi",
            "run_date",
            "forecast_type",
            "train_data_month_year",
            "forecast_date",
            "prediction_window",
            "forecast_value",
            "model_version",
            "model_type",
        ]
    ]
def run_all_combinations(master_config: dict) -> None:
    if "_bsc" not in master_config:
        master_config["_bsc"] = get_blob_service(master_config)
    df_comb, df_mgmt_long, _ = read_inputs(master_config)
    try:
        iterator = tqdm(df_comb.iterrows(), total=len(df_comb), desc="Running combinations", unit="combo")
    except Exception:
        iterator = df_comb.iterrows()
    consolidated_chunks: List[pd.DataFrame] = []
    all_importances: List[pd.DataFrame] = []
    success_combos: list[str] = []
    failed_combos: list[str] = []
    combo_logs: dict[str, list[str]] = {}
    for i, row in iterator:
        cfg = dict(master_config)
        cfg['BA'] = str(row['BA']).strip()
        cfg['mgmt'] = str(row['MGMT']).strip()
        cfg['target'] = str(row['KPI']).strip()
        cfg['model'] = str(row['MODEL']).strip()
        cfg['experiment_name'] = str(row.get('CURRENT_EXP_NAME') or row.get('experiment_name') or '').strip()
        prev_exp = str(row.get('PROPHET_PREV_EXP', '')).strip()
        cfg['prophet_experiment_name'] = None if prev_exp.lower() in {'', 'none', 'null'} else prev_exp
        cfg['parameters'] = row.get('PARAMETERS')
        cfg['modelling_type'] = str(row.get('modelling_type') or row.get('MODELLING_TYPE') or 'multivariate').strip()
        cfg['modelling_period'] = str(row.get('modelling_period') or row.get('MODELLING_PERIOD') or 'ST').strip().upper()
        cfg["check_run"] = str(row.get("check_run", "")).strip().lower() in {"true", "1", "yes", "y"}
        cfg["YEAR"]  = int(str(master_config.get("YEAR", row.get("YEAR", "")) or "0") or 0) or master_config.get("YEAR")
        cfg["MONTH"] = int(str(master_config.get("MONTH", row.get("MONTH","")) or "0") or 0) or master_config.get("MONTH")
        cfg['freq'] = master_config.get('freq', 'MS')
        cfg['forecast_horizon'] = master_config.get('forecast_horizon', 3)
        cfg['_bsc'] = master_config['_bsc']
        combo_id = f"{cfg['BA']} | {cfg['mgmt']} | {cfg['target']} | {cfg['model']} | {cfg['modelling_period']}"
        logger = get_logger(cfg)
        if not cfg["check_run"]:
            logger.info(f"Skipping combo {i+1}: check_run=False")
            continue
        mem_handler = MemoryLogHandler()
        logger.addHandler(mem_handler)
        import contextlib, io, sys
        stdout_buf, stderr_buf = io.StringIO(), io.StringIO()
        try:
            logger.info(
                f"=== Running combo {i+1}/{len(df_comb)}: BA={cfg['BA']} "
                f"MGMT={cfg['mgmt']} KPI={cfg['target']} MODEL={cfg['model']} ==="
            )
            df_mgmt_wide = df_mgmt_long.loc[
                df_mgmt_long["modelling_level"].astype(str).str.strip().str.casefold()
                == str(cfg["mgmt"]).strip().casefold()
            ].copy()
            if 'date' not in df_mgmt_wide.columns and 'DATE' in df_mgmt_wide.columns:
                df_mgmt_wide = df_mgmt_wide.rename(columns={'DATE': 'date'})
            df_mgmt_wide['date'] = pd.to_datetime(df_mgmt_wide['date'], errors='coerce')
            last_month_name = df_mgmt_wide['date'].max().strftime('%B').lower()
            cfg['_refresh_root'] = f"refresh_output_bijaya_trial1_pipeline_check_till_{last_month_name}_data"
            cfg['_combo_folder'] = f"{cfg['mgmt']}_{cfg['target']}_{cfg['modelling_period']}"
            with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
                forecast_df, imp_df = retrain_predict(cfg, df_mgmt_wide, logger)
            ok = isinstance(forecast_df, pd.DataFrame) and not forecast_df.empty
            if not ok:
                failed_combos.append(combo_id)
                logger.error("No predictions generated for this combination.")
            else:
                formatted = format_consolidated_predictions(forecast_df, cfg, df_mgmt_wide)
                consolidated_chunks.append(formatted)
                success_combos.append(combo_id)
                if isinstance(imp_df, pd.DataFrame) and not imp_df.empty:
                    tmp_imp = imp_df.copy()
                    tmp_imp["BA"] = cfg["BA"]; tmp_imp["MGMT"] = cfg["mgmt"]
                    tmp_imp["KPI"] = cfg["target"]; tmp_imp["MODEL"] = cfg["model"]
                    tmp_imp["EXPERIMENT"] = cfg["experiment_name"]
                    tmp_imp["Run_date"] = pd.to_datetime("2025-11-01")
                    all_importances.append(tmp_imp)
        except Exception as e:
            failed_combos.append(combo_id)
            logger.exception(f"Combo failed with exception: {e}")
        logs = []
        logs.extend(mem_handler.buffer)
        std_text = stdout_buf.getvalue().strip()
        err_text = stderr_buf.getvalue().strip()
        if std_text:
            logs.append("--- PRINT STDOUT ---")
            logs.append(std_text)
        if err_text:
            logs.append("--- PRINT STDERR ---")
            logs.append(err_text)
        combo_logs[combo_id] = logs
        logger.removeHandler(mem_handler)
    consolidated_predictions = pd.DataFrame()
    if consolidated_chunks:
        consolidated_predictions = pd.concat(consolidated_chunks, ignore_index=True)
        pred_keys = ["ba", "mgmt", "kpi", "forecast_type", "model_type", "forecast_date", "run_date"]
        old_rows, updated_rows, final_rows = upsert_consolidated_csv(
            "consolidated_predictions",
            consolidated_predictions,
            pred_keys,
            master_config,
            flavor="predictions",
        )
        logging.info(f"[UPsert] Predictions: old={old_rows}, updates={updated_rows}, final={final_rows}")
    try:
        if not consolidated_predictions.empty:
            cons_all = run_all_cons(master_config, consolidated_predictions)
            if isinstance(cons_all, pd.DataFrame) and not cons_all.empty:
                cons_keys = ["mgmt", "kpi", "forecast_date", "run_date"]
                old_rows, updated_rows, final_rows = upsert_consolidated_csv(
                    "consolidated_cons_predictions_sample",
                    cons_all,
                    cons_keys,
                    master_config,
                    flavor="cons",
                )
                logging.info(f"[UPsert] CONS: old={old_rows}, updates={updated_rows}, final={final_rows}")
            else:
                logging.info("CONS consolidation produced no rows (skipped).")
    except Exception as e:
        logging.exception(f"CONS consolidation failed: {e}")
    if all_importances:
        all_imp_long = pd.concat(all_importances, ignore_index=True)
        fi_keys = ["BA", "MGMT", "KPI", "MODEL", "EXPERIMENT", "Run_date", "VARIABLE"]
        old_rows, updated_rows, final_rows = upsert_consolidated_csv(
            "consolidated_feature_importance",
            all_imp_long,
            fi_keys,
            master_config,
            flavor="featimp",
        )
        logging.info(f"[UPsert] Feature Importance: old={old_rows}, updates={updated_rows}, final={final_rows}")
    try:
        latest_run = pd.to_datetime(consolidated_predictions["run_date"]).max() if not consolidated_predictions.empty else None
    except Exception:
        latest_run = None
    yymm = _yyyymm_from_timestamp(latest_run)
    report_path = f"run_logs_{yymm}.txt"
    total = len(success_combos) + len(failed_combos)
    header = [
        f"RUN SUMMARY (YYMM={yymm})",
        f"Total combos attempted: {total}",
        f"Success: {len(success_combos)}",
        f"Failed : {len(failed_combos)}",
        "",
        "FAILED COMBINATIONS:" if failed_combos else "FAILED COMBINATIONS: (none)",
    ]
    if failed_combos:
        header.extend([f"  - {c}" for c in failed_combos])
    header.append("\n" + "="*80 + "\nPER-COMBO LOGS\n" + "="*80)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(header) + "\n\n")
        for combo_id, logs in combo_logs.items():
            f.write(f"\n--- {combo_id} ---\n")
            if logs:
                f.write("\n".join(logs) + "\n")
            else:
                f.write("(no logs captured)\n")
    print(f"\nSummary: {len(success_combos)} succeeded, {len(failed_combos)} failed.")
    if failed_combos:
        print("Failed combos:")
        for c in failed_combos:
            print("  -", c)
    print(f"Local log file written: {report_path}")
MASTER_CONFIG = {
    "account_name": os.environ.get("ACCOUNT_NAME", "mlwsdevaaaifor7718243172"),
    "container": os.environ.get("CONTAINER", "amls-output"),
    "containers": {
        "models":  os.environ.get("MODELS_CONTAINER",  "outputs"),
        "inputs":  os.environ.get("INPUTS_CONTAINER",  "app-forecasting"),
        "outputs": os.environ.get("OUTPUTS_CONTAINER", "amls-output"),
    },
    "freq": os.environ.get("FREQ", "MS"),
    "forecast_horizon":3,
    "paths": {
        "model_base_prefix":  os.environ.get("MODEL_BASE_PREFIX",  "models"),
        "output_base_prefix": os.environ.get("OUTPUT_BASE_PREFIX", "outputs"),
        "input_path": {
            "combination_csv": os.environ.get("COMBINATION_BLOB", "inputs/app-prod-combination-sheet_1.csv"),
            "mgmt_kpi":        os.environ.get("MGMT_KPI_BLOB",     "outputs/preprocessing/processed_data_merged_2510.csv"),
            "feature_forecast":os.environ.get("FEATURE_FC_BLOB",   "feature_forecast/External_univariate2510.xlsx"),
            "raw_data": os.environ.get("RAW_DATA_BLOB", "data_extraction/raw_data_2510.csv"),
            "oe_forecast":     os.environ.get("OE_FC_BLOB",        "feature_forecast/External_Data_11_11_25_OE_updated_col_names.xlsx"),
        },
    },
}
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    MASTER_CONFIG["_bsc"] = get_blob_service(MASTER_CONFIG)
    run_all_combinations(MASTER_CONFIG)