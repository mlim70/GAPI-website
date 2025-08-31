// frontend/src/api/auth.ts
import TokenManager from '../utils/tokenManager';
import { API_URL } from '../config/environment';
import { logger } from '../utils/logger';
import { RegisterResponse, LoginResponse } from '../types';

async function request<R = unknown>(
  path: string,
  options: RequestInit & { json?: any; formData?: FormData; requireAuth?: boolean } = {}
): Promise<R> {
  logger.info('API Request:', { path, method: options.method, requireAuth: options.requireAuth });
  
  // Check token validity if auth is required
  if (options.requireAuth) {
    const token = TokenManager.getToken();
      logger.debug(`🔍 Auth check - Token exists: ${!!token}, Token valid: ${token ? TokenManager.isTokenValid(token) : false}`);
  if (!token || !TokenManager.isTokenValid(token)) {
    logger.warn('❌ Auth check failed - logging out');
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
  logger.debug('🔑 Auth endpoint check:', { isAuthEndpoint, path });
  
  if (!isAuthEndpoint) {
    const token = TokenManager.getToken();
    if (token && TokenManager.isTokenValid(token)) {
      headers['Authorization'] = `Bearer ${token}`;
      logger.debug('🔑 Added Authorization header');
    }
  } else {
    logger.debug('🔑 Skipping token check for auth endpoint');
  }

  const body = options.formData
    ? options.formData
    : JSON.stringify(options.json ?? {});

  logger.debug('📤 Making fetch request to:', `${API_URL}${path}`);
  logger.debug('📤 Request headers:', headers);
  logger.debug('📤 Request body:', options.formData ? 'FormData' : options.json);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers, body });

  logger.debug(`📥 Response status: ${res.status} ${res.statusText}`);
  logger.debug('📥 Response headers:', Object.fromEntries(res.headers.entries()));

  if (!res.ok) {
    logger.warn('❌ Request failed with status:', res.status);
    
    // 401/403 is session expiration for non-auth endpoints
    // 401/403 is invalid credentials for auth endpoints
    const isAuthEndpoint = path === '/auth/login' || path === '/auth/register';
    
    if ((res.status === 401 || res.status === 403) && !isAuthEndpoint) {
      logger.warn('❌ 401/403 - logging out');
      TokenManager.logout();
      throw new Error(res.status === 403 ? 'Account is not active.' : 'Session expired. Please log in again.');
    }
    
    const errorData = await res.json();
    logger.error('❌ Error response data:', errorData);
    throw new Error(errorData.message ?? res.statusText);
  }
  
  const responseData = await res.json();
  logger.info('✅ Request successful, response data:', responseData);
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
    recaptchaToken: string;
  }) =>
    request<RegisterResponse>('/auth/register', {
      method: 'POST',
      json: data,
    }),

  login: (data: { identifier: string; password: string; recaptchaToken: string }) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      json: data,
    }),
};
