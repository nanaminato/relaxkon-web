const developmentApiUrl = 'http://localhost:5111/';

export const environment = {
  assets: '/assets/i18n/',
  apiUrl: location.hostname === 'localhost' ? developmentApiUrl : `http://${location.hostname}:5111/`,
  production: false,
};

