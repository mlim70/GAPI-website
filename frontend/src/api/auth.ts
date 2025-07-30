// frontend/src/api/auth.ts
import TokenManager from '../utils/tokenManager.js';

async function request<R = unknown>(
  path: string,
  options: RequestInit & { json?: any; formData?: FormData; requireAuth?: boolean } = {}
): Promise<R> {
  // Check token validity if auth is required
  if (options.requireAuth) {
    const token = TokenManager.getToken();
    if (!token || !TokenManager.isTokenValid(token)) {
      TokenManager.logout();
      throw new Error('Authentication required');
    }
  }

  const headers: Record<string, string> = options.formData
    ? {}
    : { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) };

  // Add authorization header if token exists and is valid
  const token = TokenManager.getToken();
  if (token && TokenManager.isTokenValid(token)) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const body = options.formData
    ? options.formData
    : JSON.stringify(options.json ?? {});

  const res = await fetch(`/api${path}`, { ...options, headers, body });

  if (!res.ok) {
    if (res.status === 401) {
      TokenManager.logout();
      throw new Error('Session expired. Please log in again.');
    }
    throw new Error((await res.json()).message ?? res.statusText);
  }
  return res.json();
}

export const authApi = {
  register: (data: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    levelKey?: string;
    profilePic?: File | null;
  }) => {
    if (data.profilePic) {
      // multipart
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) =>
        v != null ? fd.append(k, v as string | Blob) : void 0
      );
      return request<{ token: string; user: any }>('/auth/register', {
        method: 'POST',
        formData: fd,
      });
    }
    // plain JSON
    return request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      json: data,
    });
  },

  login: (data: { identifier: string; password: string }) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      json: data,
    }),
};
