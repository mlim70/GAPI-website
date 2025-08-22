// frontend/src/utils/tokenManager.ts
import { jwtDecode } from 'jwt-decode';

interface JWTPayload {
  id: string;
  exp: number;
  iat: number;
}

class TokenManager {
  private static readonly TOKEN_KEY = 'token';
  private static readonly USER_KEY = 'user';
  private static readonly REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

  static setToken(token: string): void {
    console.log('💾 Setting token in localStorage');
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  static clearInvalidToken(): void {
    const token = this.getToken();
    console.log('🧹 clearInvalidToken - Token exists:', !!token);
    if (token) {
      const isValid = this.isTokenValid(token);
      console.log('🧹 clearInvalidToken - Token valid:', isValid);
      if (!isValid) {
        console.log('🧹 clearInvalidToken - Removing invalid token');
        this.removeToken();
      }
    }
  }

  static setUser(user: any): void {
    console.log('💾 Setting user in localStorage:', user ? 'User data exists' : 'No user data');
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  static getUser(): any | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  static isTokenValid(token: string): boolean {
    try {
      const decoded = jwtDecode<JWTPayload>(token);
      const currentTime = Date.now() / 1000;
      const isValid = decoded.exp > currentTime;
      console.log('🔍 Token validation:', { 
        exp: decoded.exp, 
        currentTime, 
        isValid,
        timeUntilExpiry: decoded.exp - currentTime 
      });
      return isValid;
    } catch (error) {
      console.log('🔍 Token validation failed - invalid token format:', error);
      return false;
    }
  }

  static isTokenExpiringSoon(token: string): boolean {
    try {
      const decoded = jwtDecode<JWTPayload>(token);
      const currentTime = Date.now();
      const expiryTime = decoded.exp * 1000;
      return (expiryTime - currentTime) < this.REFRESH_THRESHOLD;
    } catch {
      return true; // If we can't decode, assume it's expiring
    }
  }

  static getTokenExpiry(token: string): Date | null {
    try {
      const decoded = jwtDecode<JWTPayload>(token);
      return new Date(decoded.exp * 1000);
    } catch {
      return null;
    }
  }

  static logout(): void {
    // Clear user data first to trigger storage event
    localStorage.removeItem(this.USER_KEY);
    // Then clear token
    localStorage.removeItem(this.TOKEN_KEY);
    // Don't redirect here - let the calling component handle navigation
  }

  static checkTokenAndLogout(): void {
    const token = this.getToken();
    if (token && !this.isTokenValid(token)) {
      this.logout();
    }
  }

  // Auto-check token validity on page load
  static init(): void {
    this.checkTokenAndLogout();
    
    // Check token validity every minute
    setInterval(() => {
      this.checkTokenAndLogout();
    }, 60 * 1000);
  }
}

export default TokenManager; 
