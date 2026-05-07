from abc import ABC, abstractmethod
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.holtwinters import ExponentialSmoothing
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.tree import DecisionTreeRegressor
from xgboost import XGBRegressor
from sklearn.svm import SVR
from sklearn.linear_model import LinearRegression
from prophet import Prophet
from lightgbm import LGBMRegressor
from sklearn.ensemble import ExtraTreesRegressor
from prophet.utilities import regressor_coefficients
n_jobs=1
class BaseModel(ABC):
    def __init__(self, logger, ):
        self.logger = logger 
class BaseUnivariateModel(BaseModel):
    def __init__(self, logger, ):
        super().__init__(logger, )
    @abstractmethod
    def retrain(self, y, params=None):
        pass
    @abstractmethod
    def predict(self, steps, model=None):
        pass
    @abstractmethod
    def predict_rolling_with_actual_data(self, steps, n, y_train_actuals, y_future_actuals, params=None):
        pass
    @abstractmethod
    def predict_rolling_without_actual_data(self, steps, n, y_train_actuals, params=None):
        pass
class BaseMultivariateModel(BaseModel):
    def __init__(self, logger, ):
        super().__init__(logger, )
    @abstractmethod
    def retrain(self, X, y, params=None):
        pass
    @abstractmethod
    def predict(self, X, steps, model=None):
        pass
    @abstractmethod
    def predict_rolling_with_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_actuals, y_future_actuals, X_future_forecast, params=None):
        pass
    @abstractmethod
    def predict_rolling_without_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_forecast, params=None):
        pass
def get_model_object(model_name, logger, model=None):
    if model_name=='sarima_univariate':
        return SarimaUnivariateModel(logger=logger,model=model)
    elif model_name=='sarima_multivariate':
        return SarimaMultivariateModel(logger=logger,model=model)
    elif model_name=='prophet_univariate':
        return ProphetUnivariateModel(logger=logger,model=model)
    elif model_name=='holtwinters_univariate':
        return HoltWintersModel(logger=logger,model=model)
    elif model_name=='randomforest_multivariate':
        return RandomForestMultivariateModel(logger=logger,model=model)
    elif model_name=='decisiontree_multivariate':
        return DecisionTreeMultivariateModel(logger=logger,model=model)
    elif model_name=='xgboostlinear_multivariate':
        return XGBoostLinearMultivariateModel(logger=logger,model=model)
    elif model_name=='xgboosttree_multivariate':
        return XGBoostTreeMultivariateModel(logger=logger,model=model)
    elif model_name=="lightgbm_multivariate":
        return LightGBMMultivariateModel(logger=logger,model=model)
    elif model_name=="extratree_multivariate":
        return ExtraTreeMultivariateModel(logger=logger,model=model)
    elif model_name=='svr_multivariate':
        return SVRMultivariateModel(logger=logger,model=model)
    elif model_name=='linearregression_multivariate':
        return LinearRegressionMultivariateModel(logger=logger,model=model)
    elif model_name=='prophet_multivariate':
        return ProphetMultivariateModel(logger=logger,model=model)
    else:
        return None
def get_model_type(model_name: str):
    if model_name=='sarima_univariate':
        return 0
    elif model_name=='sarima_multivariate':
        return 'linear'
    elif model_name=='prophet_univariate':
        return 0
    elif model_name=='holtwinters_univariate':
        return 0
    elif model_name=='randomforest_multivariate':
        return 'tree'
    elif model_name=='decisiontree_multivariate':
        return 'tree'
    elif model_name=='xgboost_multivariate':
        return 'tree'
    elif model_name=='svr_multivariate':
        return 'linear'
    elif model_name=='linearregression_multivariate':
        return 'linear'
    elif model_name=='prophet_multivariate':
        return 'linear'
    else:
        return 0
class SarimaUnivariateModel(BaseUnivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger)
        self.model=model
        self.params=params
        self.model_name='sarima_univariate'
    def retrain(self, y, params=None):
        if params!=None:
            self.params=params
        self.model = SARIMAX(y, order=self.params['order'], seasonal_order=self.params['seasonal_order'], enforce_stationarity=False, enforce_invertibility=False).fit()
        train_predictions = self.model.fittedvalues.to_numpy()
        return train_predictions, self.model, self.params
    def predict(self, steps, model=None):
        if model!=None:
            self.model=model
        forecast = self.model.get_forecast(steps=steps).predicted_mean
        return np.array(forecast)
    def predict_rolling_with_actual_data(self, steps, n, y_train_actuals, y_future_actuals, params=None):
        if steps==len(y_future_actuals)+1 and n<=steps:
            return None
        if params!=None:
            self.params=params
        final_forecasts=np.array([])
        self.retrain(y_train_actuals, self.params)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n)
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(pd.concat([y_train_actuals, y_future_actuals[0:i]], axis=0), self.params)
        return final_forecasts[0:steps]
    def predict_rolling_without_actual_data(self, steps, n, y_train_actuals, params=None):
        if n<=steps:
            return None
        if params!=None:
            self.params=params
        final_forecasts=np.array([])
        self.retrain(y_train_actuals, self.params)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n)
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(pd.concat([y_train_actuals, final_forecasts[0:i]], axis=0), self.params)
        return final_forecasts[0:steps]
class SarimaMultivariateModel(BaseMultivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger, )
        self.logger=logger
        self.model=model
        self.params=params
        self.model_name='sarima_multivariate'
    def retrain(self, X, y, params=None):
        if params!=None:
            self.params=params
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        self.X_train=X
        self.y_train=y
        self.model = SARIMAX(y, exog=X, order=self.params['order'], seasonal_order=self.params['seasonal_order'], enforce_stationarity=False, enforce_invertibility=False).fit()
        train_predictions = self.model.fittedvalues.to_numpy()
        return train_predictions, self.model, self.params
    def predict(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]        
        if model!=None:
            self.model=model
        forecast = self.model.get_forecast(steps=steps, exog=X).predicted_mean
        return np.array(forecast)
    def predict_with_lag_features(self, X, steps, lag_features, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        if lag_features==[]:
            return self.predict(X=X, steps=steps), X
        else:
            lags=[int(i.split('_')[1]) for i in lag_features]
            forecast_dates=list(X.index)
            forecast=[]
            for step in range(0,steps):
                for lag in lags:
                    if step-lag<0:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=self.y_train[step-lag]
                    else:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=forecast[step-lag]
                step_forecast=self.predict(X=X.loc[forecast_dates[0:step+1], :], steps=step+1)[-1]
                forecast.append(step_forecast)
            return forecast, X
    def predict_rolling_with_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_actuals, y_future_actuals, X_future_forecast, params=None):
        print(steps)
        print(n)
        print(len(y_future_actuals))
        print(len(X_future_forecast))
        if (steps == len(y_future_actuals) + 1 and n <= steps and steps==len(X_future_forecast))==False:
            raise Exception("predict_rolling_with_actual_data called wrongly")
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        print('train_actuals')
        self.logger.info(X_train_actuals)
        self.logger.info(y_train_actuals)
        self.logger.info('future_actuals')
        self.logger.info(X_future_actuals)
        self.logger.info(y_future_actuals)
        self.logger.info('x_future_forecast')
        self.logger.info(X_future_forecast)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_actuals[0:i]], axis=0), y=pd.concat([y_train_actuals, y_future_actuals[0:i]], axis=0))
            self.logger.info(i)
            self.logger.info('x_future_forecast to be used')
            self.logger.info(X_future_forecast.iloc[i-1:i+n-1])
            self.logger.info('forecast')
            self.logger.info(final_forecasts)
            self.logger.info('train again on future actuals')
            self.logger.info(pd.concat([X_train_actuals, X_future_actuals[0:i]], axis=0))
            self.logger.info(pd.concat([y_train_actuals, y_future_actuals[0:i]]))
        return final_forecasts[:steps]
    def predict_rolling_without_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_forecast, params=None):
        if n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_forecast[0:i]], axis=0), y=pd.concat([y_train_actuals, final_forecasts[0:i]], axis=0))
        return final_forecasts[:steps]
class HoltWintersModel(BaseUnivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger)
        self.model = model
        self.params=params
        self.model_name='holtwinters_univariate'
    def retrain(self, y, params=None):
        if params!=None:
            self.params=params
        self.model = ExponentialSmoothing(y, seasonal=self.params['seasonal'], 
                        seasonal_periods=self.params['seasonal_periods']).fit()
        predictions = self.model.fittedvalues.to_numpy()
        return predictions, self.model, self.params
    def predict(self, steps, model=None):
        if model!=None:
            self.model=model        
        return np.array(self.model.forecast(steps))
class ProphetMultivariateModel(BaseMultivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger, )
        self.model = model
        self.params = params or {}
        self.train_y = None
        self.train_x = None
        self.model_name = 'prophet_multivariate'
    def retrain(self, X, y, model=None, params=None):
        if model==None:
            if params!=None:
                self.params=params
            cols=list(X.columns)
            cols.sort()
            X=X[cols]
            self.train_y = y
            self.train_x = X
            extra_seasonalities = self.params.pop('extra_seasonalities', [])
            self.model = Prophet(**self.params)
            for seasonality in extra_seasonalities:
                self.model.add_seasonality(
                    name=seasonality.get("name"),
                    period=seasonality.get("period"),
                    fourier_order=seasonality.get("fourier_orders"))
            for regressor in X.columns:
                self.model.add_regressor(regressor)
            df = pd.DataFrame({**{"ds": y.index, "y": y.values},**{i:X[i].values for i in X.columns}})
            self.model.fit(df, seed=101)
        else:
            modelprophet=model
            self.params={
            'growth':modelprophet.growth,
            'n_changepoints':modelprophet.n_changepoints,
            'changepoint_range':modelprophet.changepoint_range,
            'yearly_seasonality':modelprophet.yearly_seasonality,
            'weekly_seasonality':modelprophet.weekly_seasonality,
            'daily_seasonality':modelprophet.daily_seasonality,
            'holidays':modelprophet.holidays,
            'seasonality_mode':modelprophet.seasonality_mode,
            'seasonality_prior_scale':modelprophet.seasonality_prior_scale,
            'holidays_prior_scale':modelprophet.holidays_prior_scale,
            'changepoint_prior_scale':modelprophet.changepoint_prior_scale,
            'mcmc_samples':modelprophet.mcmc_samples,
            'interval_width':modelprophet.interval_width,
            'uncertainty_samples':modelprophet.uncertainty_samples,
            'scaling': modelprophet.scaling,
            'holidays_mode':modelprophet.holidays_mode,
            }
            cols=list(X.columns)
            cols.sort()
            X=X[cols]
            self.train_y = y
            self.train_x = X
            df = pd.DataFrame({**{"ds": y.index, "y": y.values},**{i:X[i].values for i in X.columns}})
            self.model = Prophet(**self.params)
            self.model.fit(df, seed=101)
        predictions = self.model.predict(df)
        train_predictions = predictions['yhat'].values
        trend = pd.Series(predictions['trend'].values, index=y.index)
        seasonal = pd.Series(predictions['yearly'].values, index=y.index)
        return train_predictions, self.model, self.params, pd.DataFrame({'TREND':trend, 'SEASONALITY':seasonal})
    def predict(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]        
        if model:
            self.model = model
        if self.model is None or self.train_y is None:
            raise ValueError("Model is not trained yet. Please call retrain() before predict().")
        freq = pd.infer_freq(self.train_y.index)
        if freq is None:
            freq = 'MS'  
        future = self.model.make_future_dataframe(periods=steps, freq=freq, include_history=True)
        history_future_x=pd.concat([self.train_x, X], axis=0)
        for regressor in X.columns:
            future[regressor]=history_future_x[regressor].values
        forecast = self.model.predict(future)
        expected_len = len(self.train_y) + steps
        if len(forecast) < expected_len:
            raise ValueError("Prophet forecast length is shorter than expected.")
        predicted = forecast.iloc[len(self.train_y):]['yhat'].values        
        return predicted
    def predict_with_lag_features(self, X, steps, lag_features, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        if lag_features==[]:
            return self.predict(X=X, steps=steps), X
        else:
            lags=[int(i.split('_')[1]) for i in lag_features]
            forecast_dates=list(X.index)
            forecast=[]
            for step in range(0,steps):
                for lag in lags:
                    if step-lag<0:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=self.train_y[step-lag]
                    else:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=forecast[step-lag]
                step_forecast=self.predict(X=X.loc[forecast_dates[0:step+1], :], steps=step+1)[-1]
                forecast.append(step_forecast)
            return forecast, X
    def get_trend_seasonal(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]                
        if model:
            self.model = model
        if self.model is None or self.train_y is None:
            raise ValueError("Model is not trained yet. Please call retrain() before predict().")
        freq = pd.infer_freq(self.train_y.index)
        if freq is None:
            freq = 'MS'  
        future = self.model.make_future_dataframe(periods=steps, freq=freq, include_history=True)
        history_future_x=pd.concat([self.train_x, X], axis=0)
        for regressor in X.columns:
            future[regressor]=history_future_x[regressor].values
        forecast = self.model.predict(future)
        expected_len = len(self.train_y) + steps
        if len(forecast) < expected_len:
            raise ValueError("Prophet forecast length is shorter than expected.")
        predicted = forecast.iloc[len(self.train_y):]['yhat'].values
        trend = pd.Series(forecast.iloc[len(self.train_y):]['trend'].values, index=X.index)
        seasonal = pd.Series(forecast.iloc[len(self.train_y):]['yearly'].values, index=X.index)
        return predicted, pd.DataFrame({'TREND':trend, 'SEASONALITY':seasonal})
    def get_train_trend_seasonal(self, X, y, model=None):
        self.train_y=y
        self.train_x=X      
        if model:
            self.model = model
        if self.model is None or self.train_y is None:
            raise ValueError("Model is not trained yet. Please call retrain() before predict().")
        freq = pd.infer_freq(self.train_y.index)
        if freq is None:
            freq = 'MS'  
        future = self.model.make_future_dataframe(periods=0, freq=freq, include_history=True)
        history_x=self.train_x
        for regressor in X.columns:
            future[regressor]=history_x[regressor].values
        forecast = self.model.predict(future)
        expected_len = len(self.train_y)
        if len(forecast) < expected_len:
            raise ValueError("Prophet forecast length is shorter than expected.")
        predicted = forecast.iloc[0:len(self.train_y)]['yhat'].values
        trend = pd.Series(forecast.iloc[0:len(self.train_y)]['trend'].values, index=X.index)
        seasonal = pd.Series(forecast.iloc[0:len(self.train_y)]['yearly'].values, index=X.index)
        return predicted, pd.DataFrame({'TREND':trend, 'SEASONALITY':seasonal})
    def get_trend_seasonal_with_lag_features(self, X, steps, lag_features, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        if lag_features==[]:
            return self.get_trend_seasonal(X=X, steps=steps)[1]
        else:
            lags=[int(i.split('_')[1]) for i in lag_features]
            forecast_dates=list(X.index)
            forecast=[]
            for step in range(0,steps):
                for lag in lags:
                    if step-lag<0:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=self.train_y[step-lag]
                    else:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=forecast[step-lag]
                step_forecast, trend_seasonal_df=self.get_trend_seasonal(X=X.loc[forecast_dates[0:step+1], :], steps=step+1)
                step_forecast=step_forecast[-1]
                forecast.append(step_forecast)
            return trend_seasonal_df
    def get_forecast_interval(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]        
        if model:
            self.model = model
        if self.model is None or self.train_y is None:
            raise ValueError("Model is not trained yet. Please call retrain() before predict().")
        freq = pd.infer_freq(self.train_y.index)
        if freq is None:
            freq = 'MS'  
        future = self.model.make_future_dataframe(periods=steps, freq=freq, include_history=True)
        history_future_x=pd.concat([self.train_x, X], axis=0)
        for regressor in X.columns:
            future[regressor]=history_future_x[regressor].values
        forecast = self.model.predict(future)
        expected_len = len(self.train_y) + steps
        if len(forecast) < expected_len:
            raise ValueError("Prophet forecast length is shorter than expected.")
        predicted = forecast.iloc[len(self.train_y):]['yhat'].values        
        lower = forecast.iloc[len(self.train_y):]['yhat_lower'].values  
        upper = forecast.iloc[len(self.train_y):]['yhat_upper'].values  
        return predicted, pd.DataFrame({'lower_bound':lower, 'upper_bound':upper})
    def get_full_decomposition(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]        
        if model:
            self.model = model
        if self.model is None or self.train_y is None:
            raise ValueError("Model is not trained yet. Please call retrain() before predict().")
        freq = pd.infer_freq(self.train_y.index)
        if freq is None:
            freq = 'MS'  
        future = self.model.make_future_dataframe(periods=steps, freq=freq, include_history=True)
        history_future_x=pd.concat([self.train_x, X], axis=0)
        for regressor in X.columns:
            future[regressor]=history_future_x[regressor].values
        forecast = self.model.predict(future)
        expected_len = len(self.train_y) + steps
        if len(forecast) < expected_len:
            raise ValueError("Prophet forecast length is shorter than expected.")
        coeffs_df=regressor_coefficients(self.model)
        output_cols=[i for i in forecast.columns if '_lower' not in i and '_upper' not in i]
        upper_lower=['ds']+[i for i in forecast.columns if '_lower' in i or '_upper' in i]
        predicted = forecast.iloc[len(self.train_y):]['yhat'].values  
        return predicted, coeffs_df, forecast[output_cols], forecast[upper_lower]
    def get_full_decomposition_with_lag_features(self, X, steps, lag_features, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        if lag_features==[]:
            return self.get_full_decomposition(X=X, steps=steps)
        else:
            lags=[int(i.split('_')[1]) for i in lag_features]
            forecast_dates=list(X.index)
            forecast=[]
            for step in range(0,steps):
                for lag in lags:
                    if step-lag<0:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=self.train_y[step-lag]
                    else:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=forecast[step-lag]
                step_forecast, coeffs_df, output_cols, upper_lower=self.get_full_decomposition(X=X.loc[forecast_dates[0:step+1], :], steps=step+1)
                step_forecast=step_forecast[-1]
                forecast.append(step_forecast)
            return forecast, coeffs_df, output_cols, upper_lower
    def predict_rolling_with_actual_data(self, steps, n, y_train_actuals, y_future_actuals, params=None):
        if steps==len(y_future_actuals)+1 and n<=steps:
            return None
        if params!=None:
            self.params=params
        final_forecasts=np.array([])
        self.retrain(y_train_actuals, self.params)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n)
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(pd.concat([y_train_actuals, y_future_actuals[0:i]], axis=0), self.params)
        return final_forecasts[0:steps]
    def predict_rolling_without_actual_data(self, steps, n, y_train_actuals, params=None):
        if n<=steps:
            return None
        if params!=None:
            self.params=params
        final_forecasts=np.array([])
        self.retrain(y_train_actuals, self.params)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n)
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(pd.concat([y_train_actuals, final_forecasts[0:i]], axis=0), self.params)
        return final_forecasts[0:steps]
class ProphetUnivariateModel(BaseUnivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger,)
        self.model = model
        self.params = params or {}
        self.train_y = None
        self.model_name = 'prophet_univariate'
    def retrain(self, y, params=None):
        if params:
            self.params = params
        self.train_y = y
        try:
            self.model = Prophet(
                seasonality_mode=self.params["seasonality_mode"],
                changepoint_prior_scale=self.params["changepoint_prior_scale"],
                n_changepoints=self.params["n_changepoints"],
                yearly_seasonality = self.params["yearly_seasonality"],
                uncertainty_samples = self.params["uncertainty_samples"],
                changepoint_range = self.params["changepoint_range"]
            )
            extra_seasonalities = self.params.get("extra_seasonalities", [])
            for seasonality in extra_seasonalities:
                self.model.add_seasonality(
                    name=seasonality.get("name"),
                    period=seasonality.get("period"),
                    fourier_order=seasonality.get("fourier_orders")
                )
            df = pd.DataFrame({"ds": y.index, "y": y.values})
            self.model.fit(df)
            predictions = self.model.predict(df)
            train_predictions = predictions['yhat'].values
            return train_predictions, self.model, self.params
        except Exception as e:
            raise ValueError(f"Prophet fitting failed: {e}")
    def predict(self, steps, model=None):
        if model:
            self.model = model
        if self.model is None or self.train_y is None:
            raise ValueError("Model is not trained yet. Please call retrain() before predict().")
        freq = pd.infer_freq(self.train_y.index)
        if freq is None:
            freq = 'M'  
        future = self.model.make_future_dataframe(periods=steps, freq=freq, include_history=True)
        forecast = self.model.predict(future)
        expected_len = len(self.train_y) + steps
        if len(forecast) < expected_len:
            raise ValueError("Prophet forecast length is shorter than expected.")
        predicted = forecast.iloc[len(self.train_y):]['yhat'].values        
        return predicted
    def predict_rolling_with_actual_data(self, steps, n, y_train_actuals, y_future_actuals, params=None):
        if steps==len(y_future_actuals)+1 and n<=steps:
            return None
        if params!=None:
            self.params=params
        final_forecasts=np.array([])
        self.retrain(y_train_actuals, self.params)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n)
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(pd.concat([y_train_actuals, y_future_actuals[0:i]], axis=0), self.params)
        return final_forecasts[0:steps]
    def predict_rolling_without_actual_data(self, steps, n, y_train_actuals, params=None):
        if n<=steps:
            return None
        if params!=None:
            self.params=params
        final_forecasts=np.array([])
        self.retrain(y_train_actuals, self.params)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n)
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(pd.concat([y_train_actuals, final_forecasts[0:i]], axis=0), self.params)
        return final_forecasts[0:steps]
class RandomForestMultivariateModel(BaseMultivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger, )
        self.model = model
        self.params = params
        self.extra_params = {'random_state': 101, 'n_jobs': n_jobs}
        self.model_name='randomforest_multivariate'
    def retrain(self, X, y, params=None):
        if params is not None:
            self.params = params
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        self.X_train=X
        self.y_train=y
        if self.model==None:
            self.model = RandomForestRegressor(**{**self.params, **self.extra_params})
        self.model.fit(X, y)
        train_predictions = self.model.predict(X)
        return train_predictions, self.model, self.params
    def predict(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]        
        if model is not None:
            self.model = model
        forecast = self.model.predict(X)
        return forecast
    def predict_with_lag_features(self, X, steps, lag_features, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        if lag_features==[]:
            return self.predict(X=X, steps=steps), X
        else:
            lags=[int(i.split('_')[1]) for i in lag_features]
            forecast_dates=list(X.index)
            forecast=[]
            for step in range(0,steps):
                for lag in lags:
                    if step-lag<0:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=self.y_train[step-lag]
                    else:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=forecast[step-lag]
                step_forecast=self.predict(X=X.loc[forecast_dates[0:step+1], :], steps=step+1)[-1]
                forecast.append(step_forecast)
            return forecast, X
    def predict_rolling_with_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_actuals, y_future_actuals, X_future_forecast, params=None):
        if steps == len(y_future_actuals) + 1 and n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_actuals[0:i]], axis=0), y=pd.concat([y_train_actuals, y_future_actuals[0:i]], axis=0))
        return final_forecasts[:steps]
    def predict_rolling_without_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_forecast, params=None):
        if n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_forecast[0:i]], axis=0), y=pd.concat([y_train_actuals, final_forecasts[0:i]], axis=0))
        return final_forecasts[:steps]
class DecisionTreeMultivariateModel(BaseMultivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger, )
        self.model = model
        self.params = params
        self.extra_params = {'random_state': 101}
        self.model_name = 'decisiontree_multivariate'
    def retrain(self, X, y, params=None):
        if params is not None:
            self.params = params
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        self.X_train=X
        self.y_train=y
        if self.model==None:
            self.model = DecisionTreeRegressor(**{**self.params, **self.extra_params})
        self.model.fit(X, y)
        train_predictions = self.model.predict(X)
        return train_predictions, self.model, self.params
    def predict(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]        
        if model is not None:
            self.model = model
        forecast = self.model.predict(X)
        return forecast
    def predict_with_lag_features(self, X, steps, lag_features, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        if lag_features==[]:
            return self.predict(X=X, steps=steps), X
        else:
            lags=[int(i.split('_')[1]) for i in lag_features]
            forecast_dates=list(X.index)
            forecast=[]
            for step in range(0,steps):
                for lag in lags:
                    if step-lag<0:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=self.y_train[step-lag]
                    else:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=forecast[step-lag]
                step_forecast=self.predict(X=X.loc[forecast_dates[0:step+1], :], steps=step+1)[-1]
                forecast.append(step_forecast)
            return forecast, X
    def predict_rolling_with_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_actuals, y_future_actuals, X_future_forecast, params=None):
        if steps == len(y_future_actuals) + 1 and n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_actuals[0:i]], axis=0), y=pd.concat([y_train_actuals, y_future_actuals[0:i]], axis=0))
        return final_forecasts[:steps]
    def predict_rolling_without_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_forecast, params=None):
        if n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_forecast[0:i]], axis=0), y=pd.concat([y_train_actuals, final_forecasts[0:i]], axis=0))
        return final_forecasts[:steps]
class XGBoostTreeMultivariateModel(BaseMultivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger, )
        self.model = model
        self.params = params
        self.model_name = 'xgboosttree_multivariate'
        self.X_train=None
        self.y_train=None
        self.extra_params = {'booster':'gbtree','random_state': 101, 'n_jobs': n_jobs}
    def retrain(self, X, y, params=None):
        if params is not None:
            self.params = params
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        self.X_train=X
        self.y_train=y
        if self.model==None:
            self.model = XGBRegressor(**{**self.params, **self.extra_params})
        self.model.fit(X, y)
        train_predictions = self.model.predict(X)
        return train_predictions, self.model, self.params
    def predict(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        forecast = self.model.predict(X)
        return forecast
    def predict_with_lag_features(self, X, steps, lag_features, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        if lag_features==[]:
            return self.predict(X=X, steps=steps), X
        else:
            lags=[int(i.split('_')[1]) for i in lag_features]
            forecast_dates=list(X.index)
            forecast=[]
            for step in range(0,steps):
                for lag in lags:
                    if step-lag<0:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=self.y_train[step-lag]
                    else:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=forecast[step-lag]
                step_forecast=self.predict(X=X.loc[forecast_dates[0:step+1], :], steps=step+1)[-1]
                forecast.append(step_forecast)
            return forecast, X
    def predict_rolling_with_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_actuals, y_future_actuals, X_future_forecast, params=None):
        if steps == len(y_future_actuals) + 1 and n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        print('train_actuals')
        print(X_train_actuals)
        print(y_train_actuals)
        print('future_actuals')
        print(X_future_actuals)
        print(y_future_actuals)
        print('x_future_forecast')
        print(X_future_forecast)
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_actuals[0:i]], axis=0), y=pd.concat([y_train_actuals, y_future_actuals[0:i]], axis=0))
            print(i)
            print('x_future_forecast to be used')
            print(X_future_forecast.iloc[i-1:i+n-1])
            print('forecast')
            print(final_forecasts)
            print('train again on future actuals')
            print(pd.concat([X_train_actuals, X_future_actuals[0:i]], axis=0))
            print(pd.concat([y_train_actuals, y_future_actuals[0:i]]))
        return final_forecasts[:steps]
    def predict_rolling_without_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_forecast, params=None):
        if n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_forecast[0:i]], axis=0), y=pd.concat([y_train_actuals, final_forecasts[0:i]], axis=0))
        return final_forecasts[:steps]
class XGBoostLinearMultivariateModel(BaseMultivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger, )
        self.model = model
        self.params = params
        self.model_name = 'xgboostlinear_multivariate'
        self.extra_params = {'booster':'gblinear','random_state': 101, 'n_jobs': n_jobs}
    def retrain(self, X, y, params=None):
        if params is not None:
            self.params = params
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        self.X_train=X
        self.y_train=y
        if self.model==None:
            self.model = XGBRegressor(**{**self.params, **self.extra_params})
        self.model.fit(X, y)
        train_predictions = self.model.predict(X)
        return train_predictions, self.model, self.params
    def predict(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]        
        if model is not None:
            self.model = model
        forecast = self.model.predict(X)
        return forecast
    def predict_with_lag_features(self, X, steps, lag_features, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        if lag_features==[]:
            return self.predict(X=X, steps=steps), X
        else:
            lags=[int(i.split('_')[1]) for i in lag_features]
            forecast_dates=list(X.index)
            forecast=[]
            for step in range(0,steps):
                for lag in lags:
                    if step-lag<0:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=self.y_train[step-lag]
                    else:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=forecast[step-lag]
                step_forecast=self.predict(X=X.loc[forecast_dates[0:step+1], :], steps=step+1)[-1]
                forecast.append(step_forecast)
            return forecast, X
    def predict_rolling_with_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_actuals, y_future_actuals, X_future_forecast, params=None):
        if steps == len(y_future_actuals) + 1 and n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        print('train_actuals')
        print(X_train_actuals)
        print(y_train_actuals)
        print('future_actuals')
        print(X_future_actuals)
        print(y_future_actuals)
        print('x_future_forecast')
        print(X_future_forecast)
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_actuals[0:i]], axis=0), y=pd.concat([y_train_actuals, y_future_actuals[0:i]], axis=0))
            print(i)
            print('x_future_forecast to be used')
            print(X_future_forecast.iloc[i-1:i+n-1])
            print('forecast')
            print(final_forecasts)
            print('train again on future actuals')
            print(pd.concat([X_train_actuals, X_future_actuals[0:i]], axis=0))
            print(pd.concat([y_train_actuals, y_future_actuals[0:i]]))
        return final_forecasts[:steps]
    def predict_rolling_without_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_forecast, params=None):
        if n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_forecast[0:i]], axis=0), y=pd.concat([y_train_actuals, final_forecasts[0:i]], axis=0))
        return final_forecasts[:steps]
class LightGBMMultivariateModel(BaseMultivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger)
        self.model = model
        self.params = params
        self.model_name = 'lightgbm_multivariate'
        self.extra_params = {'random_state': 101, 'n_jobs': n_jobs, 'verbosity': -1}
    def retrain(self, X, y, params=None):
        if params is not None:
            self.params = params
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        self.X_train=X
        self.y_train=y
        if self.model==None:
            self.model = LGBMRegressor(**{**self.params, **self.extra_params})
        self.model.fit(X, y)
        train_predictions = self.model.predict(X)
        return train_predictions, self.model, self.params
    def predict(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]        
        if model is not None:
            self.model = model
        forecast = self.model.predict(X)
        return forecast
    def predict_with_lag_features(self, X, steps, lag_features, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        if lag_features==[]:
            return self.predict(X=X, steps=steps), X
        else:
            lags=[int(i.split('_')[1]) for i in lag_features]
            forecast_dates=list(X.index)
            forecast=[]
            for step in range(0,steps):
                for lag in lags:
                    if step-lag<0:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=self.y_train[step-lag]
                    else:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=forecast[step-lag]
                step_forecast=self.predict(X=X.loc[forecast_dates[0:step+1], :], steps=step+1)[-1]
                forecast.append(step_forecast)
            return forecast, X
    def predict_rolling_with_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_actuals, y_future_actuals, X_future_forecast, params=None):
        if steps == len(y_future_actuals) + 1 and n <= steps and steps == len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts = np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1, steps, n):
            forecast = self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1])
            final_forecasts = np.concatenate((final_forecasts, forecast))
            self.retrain(
                params=self.params,
                X=pd.concat([X_train_actuals, X_future_actuals[0:i]], axis=0),
                y=pd.concat([y_train_actuals, y_future_actuals[0:i]], axis=0)
            )
        return final_forecasts[:steps]
    def predict_rolling_without_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_forecast, params=None):
        if n <= steps and steps == len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts = np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1, steps, n):
            forecast = self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1])
            final_forecasts = np.concatenate((final_forecasts, forecast))
            self.retrain(
                params=self.params,
                X=pd.concat([X_train_actuals, X_future_forecast[0:i]], axis=0),
                y=pd.concat([y_train_actuals, final_forecasts[0:i]], axis=0)
            )
        return final_forecasts[:steps]
class ExtraTreeMultivariateModel(BaseMultivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger)
        self.model = model
        self.params = params
        self.model_name = 'extratree_multivariate'
        self.extra_params = {'random_state': 101, 'n_jobs': n_jobs}
    def retrain(self, X, y, params=None):
        if params is not None:
            self.params = params
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        self.X_train=X
        self.y_train=y
        if self.model==None:
            self.model = ExtraTreesRegressor(**{**self.params, **self.extra_params})
        self.model.fit(X, y)
        train_predictions = self.model.predict(X)
        return train_predictions, self.model, self.params
    def predict(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]        
        if model is not None:
            self.model = model
        forecast = self.model.predict(X)
        return forecast
    def predict_with_lag_features(self, X, steps, lag_features, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        if lag_features==[]:
            return self.predict(X=X, steps=steps), X
        else:
            lags=[int(i.split('_')[1]) for i in lag_features]
            forecast_dates=list(X.index)
            forecast=[]
            for step in range(0,steps):
                for lag in lags:
                    if step-lag<0:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=self.y_train[step-lag]
                    else:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=forecast[step-lag]
                step_forecast=self.predict(X=X.loc[forecast_dates[0:step+1], :], steps=step+1)[-1]
                forecast.append(step_forecast)
            return forecast, X
    def predict_rolling_with_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_actuals, y_future_actuals, X_future_forecast, params=None):
        if steps == len(y_future_actuals) + 1 and n <= steps and steps == len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts = np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1, steps, n):
            forecast = self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1])
            final_forecasts = np.concatenate((final_forecasts, forecast))
            self.retrain(
                params=self.params,
                X=pd.concat([X_train_actuals, X_future_actuals[0:i]], axis=0),
                y=pd.concat([y_train_actuals, y_future_actuals[0:i]], axis=0)
            )
        return final_forecasts[:steps]
    def predict_rolling_without_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_forecast, params=None):
        if n <= steps and steps == len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts = np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1, steps, n):
            forecast = self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1])
            final_forecasts = np.concatenate((final_forecasts, forecast))
            self.retrain(
                params=self.params,
                X=pd.concat([X_train_actuals, X_future_forecast[0:i]], axis=0),
                y=pd.concat([y_train_actuals, final_forecasts[0:i]], axis=0)
            )
        return final_forecasts[:steps]
class SVRMultivariateModel(BaseMultivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger, )
        self.model = model
        self.params = params
        self.model_name = 'svr_multivariate'
        self.extra_params = {}
    def retrain(self, X, y, params=None):
        if params is not None:
            self.params = params
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        self.X_train=X
        self.y_train=y
        if self.model==None:
            self.model = SVR(**{**self.params, **self.extra_params})
        self.model.fit(X, y)
        train_predictions = self.model.predict(X)
        return train_predictions, self.model, self.params
    def predict(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]        
        if model is not None:
            self.model = model
        forecast = self.model.predict(X)
        return forecast
    def predict_with_lag_features(self, X, steps, lag_features, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        if lag_features==[]:
            return self.predict(X=X, steps=steps), X
        else:
            lags=[int(i.split('_')[1]) for i in lag_features]
            forecast_dates=list(X.index)
            forecast=[]
            for step in range(0,steps):
                for lag in lags:
                    if step-lag<0:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=self.y_train[step-lag]
                    else:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=forecast[step-lag]
                step_forecast=self.predict(X=X.loc[forecast_dates[0:step+1], :], steps=step+1)[-1]
                forecast.append(step_forecast)
            return forecast, X
    def predict_rolling_with_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_actuals, y_future_actuals, X_future_forecast, params=None):
        if steps == len(y_future_actuals) + 1 and n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_actuals[0:i]], axis=0), y=pd.concat([y_train_actuals, y_future_actuals[0:i]], axis=0))
        return final_forecasts[:steps]
    def predict_rolling_without_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_forecast, params=None):
        if n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_forecast[0:i]], axis=0), y=pd.concat([y_train_actuals, final_forecasts[0:i]], axis=0))
        return final_forecasts[:steps]
class LinearRegressionMultivariateModel(BaseMultivariateModel):
    def __init__(self, logger, model=None, params=None):
        super().__init__(logger, )
        self.model = model
        self.params = params
        self.model_name = 'linearregression_multivariate'
    def retrain(self, X, y, params=None):
        if params is not None:
            self.params = params
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        self.X_train=X
        self.y_train=y
        if self.model==None:
            self.model = LinearRegression()
        self.model.fit(X, y)
        train_predictions = self.model.predict(X)
        return train_predictions, self.model, self.params
    def predict(self, X, steps, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]        
        if model is not None:
            self.model = model
        forecast = self.model.predict(X)
        return forecast
    def predict_with_lag_features(self, X, steps, lag_features, model=None):
        cols=list(X.columns)
        cols.sort()
        X=X[cols]
        if model is not None:
            self.model = model
        if lag_features==[]:
            return self.predict(X=X, steps=steps), X
        else:
            lags=[int(i.split('_')[1]) for i in lag_features]
            forecast_dates=list(X.index)
            forecast=[]
            for step in range(0,steps):
                for lag in lags:
                    if step-lag<0:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=self.y_train[step-lag]
                    else:
                        X.loc[forecast_dates[step], f'LAG_{lag}']=forecast[step-lag]
                step_forecast=self.predict(X=X.loc[forecast_dates[0:step+1], :], steps=step+1)[-1]
                forecast.append(step_forecast)
            return forecast, X
    def predict_rolling_with_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_actuals, y_future_actuals, X_future_forecast, params=None):
        if steps == len(y_future_actuals) + 1 and n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_actuals[0:i]], axis=0), y=pd.concat([y_train_actuals, y_future_actuals[0:i]], axis=0))
        return final_forecasts[:steps]
    def predict_rolling_without_actual_data(self, steps, n, X_train_actuals, y_train_actuals, X_future_forecast, params=None):
        if n <= steps and steps==len(X_future_forecast):
            return None
        if params is not None:
            self.params = params
        final_forecasts=np.array([])
        self.retrain(params=self.params, X=X_train_actuals, y=y_train_actuals)
        for i in range(1,steps,n):
            forecast=self.predict(steps=n, X=X_future_forecast.iloc[i-1:i+n-1], )
            final_forecasts=np.concatenate((final_forecasts, forecast))
            self.retrain(params=self.params, X=pd.concat([X_train_actuals, X_future_forecast[0:i]], axis=0), y=pd.concat([y_train_actuals, final_forecasts[0:i]], axis=0))
        return final_forecasts[:steps]