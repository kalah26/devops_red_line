import axios from 'axios';

// Get API URL from environment variable or use default
const getApiUrl = () => {
  // For runtime environment variables in React (set during container startup)
  if (window._env_ && window._env_.REACT_APP_API_URL) {
    return window._env_.REACT_APP_API_URL;
  }
  
  // For build-time environment variables
  // eslint-disable-next-line no-undef
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
    // eslint-disable-next-line no-undef
    return process.env.REACT_APP_API_URL;
  }
  
  // Fallback to current host with /api path
  return `${window.location.origin}/api`;
};

const api = axios.create({
  baseURL: getApiUrl(),
});

// Debug logging (only in development)
// eslint-disable-next-line no-undef
const isDev = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') || 
            (window._env_ && window._env_.REACT_APP_DEBUG === 'true');

if (isDev) {
  console.log('API Base URL:', getApiUrl());
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 errors by redirecting to login
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
