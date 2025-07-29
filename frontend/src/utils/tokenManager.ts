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
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  static setUser(user: any): void {
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
      return decoded.exp > currentTime;
    } catch {
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
    this.removeToken();
    // Redirect to login page using current domain
    window.location.href = '/login';
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