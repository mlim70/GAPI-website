// backend/src/types/jwt.ts
export interface JwtPayload {
  id: string;
  exp: number;
  iat: number;
}
