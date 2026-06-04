// 极简 fetch 封装
const TOKEN_KEY = 'xhs_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    setToken('');
    if (location.pathname !== '/login') location.href = '/login';
  }

  if (data.code && data.code !== 200) {
    throw new Error(data.message || '请求失败');
  }
  return data.data ?? data;
}
