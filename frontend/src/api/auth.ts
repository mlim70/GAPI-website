// frontend/src/api/auth.ts
import TokenManager from '../utils/tokenManager.js';

async function request<R = unknown>(
  path: string,
  options: RequestInit & { json?: any; formData?: FormData; requireAuth?: boolean } = {}
): Promise<R> {
  console.log('🌐 API Request:', { path, method: options.method, requireAuth: options.requireAuth });
  
  // Check token validity if auth is required
  if (options.requireAuth) {
    const token = TokenManager.getToken();
    console.log('🔍 Auth check - Token exists:', !!token, 'Token valid:', token ? TokenManager.isTokenValid(token) : false);
    if (!token || !TokenManager.isTokenValid(token)) {
      console.log('❌ Auth check failed - logging out');
      TokenManager.logout();
      throw new Error('Authentication required');
    }
  }

  const headers: Record<string, string> = options.formData
    ? {}
    : { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) };

  // Add authorization header if token exists and is valid
  // Skip token check for login and register endpoints to avoid conflicts
  const isAuthEndpoint = path === '/auth/login' || path === '/auth/register';
  console.log('🔑 Auth endpoint check:', { isAuthEndpoint, path });
  
  if (!isAuthEndpoint) {
    const token = TokenManager.getToken();
    if (token && TokenManager.isTokenValid(token)) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('🔑 Added Authorization header');
    }
  } else {
    console.log('🔑 Skipping token check for auth endpoint');
  }

  const body = options.formData
    ? options.formData
    : JSON.stringify(options.json ?? {});

  console.log('📤 Making fetch request to:', `/api${path}`);
  console.log('📤 Request headers:', headers);
  console.log('📤 Request body:', options.formData ? 'FormData' : options.json);

  const res = await fetch(`/api${path}`, { ...options, headers, body });

  console.log('📥 Response status:', res.status, res.statusText);
  console.log('📥 Response headers:', Object.fromEntries(res.headers.entries()));

  if (!res.ok) {
    console.log('❌ Request failed with status:', res.status);
    
    // 401 is session expiration for non-auth endpoints
    // 401 is invalid credentials for auth endpoints
    const isAuthEndpoint = path === '/auth/login' || path === '/auth/register';
    
    if (res.status === 401 && !isAuthEndpoint) {
      console.log('❌ 401 Unauthorized - logging out');
      TokenManager.logout();
      throw new Error('Session expired. Please log in again.');
    }
    
    const errorData = await res.json();
    console.log('❌ Error response data:', errorData);
    throw new Error(errorData.message ?? res.statusText);
  }
  
  const responseData = await res.json();
  console.log('✅ Request successful, response data:', responseData);
  return responseData;
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
