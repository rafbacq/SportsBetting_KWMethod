import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Request failed';
    console.error('[API Error]', message);
    return Promise.reject(new Error(message));
  },
);
