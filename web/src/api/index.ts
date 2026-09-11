import { useAuthStore } from '../stores/auth';

const BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function request<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const auth = useAuthStore();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    auth.logout();
    throw new ApiError(401, '登录已过期，请重新登录');
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = data.message || JSON.stringify(data);
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  devices: () => request('/devices'),
  createDevice: (body: any) =>
    request('/devices', { method: 'POST', body: JSON.stringify(body) }),
  updateDevice: (id: number, body: any) =>
    request(`/devices/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  moveDevice: (id: number, x: number, y: number) =>
    request(`/devices/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ x, y }),
    }),
  setDeviceStatus: (id: number, status: 'normal' | 'fault', faultMessage?: string) =>
    request(`/devices/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, faultMessage }),
    }),
  deleteDevice: (id: number) =>
    request(`/devices/${id}`, { method: 'DELETE' }),

  weather: () => request('/weather'),
  generateWeather: (date: string, kind: string) =>
    request(`/weather/generate?date=${date}&kind=${kind}`, { method: 'POST' }),

  tariff: () => request('/tariffs'),

  scenarios: () => request('/scenarios'),
  saveScenario: (body: any) =>
    request('/scenarios', { method: 'POST', body: JSON.stringify(body) }),
  deleteScenario: (id: number) =>
    request(`/scenarios/${id}`, { method: 'DELETE' }),

  run: (body: any) =>
    request('/simulation/run', { method: 'POST', body: JSON.stringify(body) }),
  baseline: (date?: string) =>
    request(`/simulation/baseline${date ? `?date=${date}` : ''}`),
  compare: (body: any) =>
    request('/simulation/run', { method: 'POST', body: JSON.stringify(body) }).then(
      // 单方案推演复用；对比走专用接口
      (r) => r,
    ),
  compareScenarios: (body: any) =>
    request('/simulation/compare', { method: 'POST', body: JSON.stringify(body) }),

  alarms: (date?: string) =>
    request(`/alarms?scenario=baseline${date ? `&date=${date}` : ''}`),
  syncAlarms: (date?: string) =>
    request(`/alarms/sync${date ? `?date=${date}` : ''}`, { method: 'POST' }),
  updateAlarm: (id: number, status: string) =>
    request(`/alarms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
