import { request } from './request';

export const login = (username, password) =>
  request('/api/auth/login', { method: 'POST', body: { username, password } });

export const register = (username, password, nickname) =>
  request('/api/auth/register', { method: 'POST', body: { username, password, nickname } });

export const fetchMe = () => request('/api/auth/me');
