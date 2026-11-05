export type UserRole = 'USER' | 'HOSPITAL' | 'ADMIN';
export type AuthProvider = 'LOCAL' | 'GOOGLE';
export interface User {
    id: string;
    email: string;
    password_hash: string | null;
    role: UserRole;
    auth_provider: AuthProvider;
    google_id: string | null;
    is_active: boolean;
    is_verified: boolean;
    avatar_url?: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface RegisterDTO {
    email: string;
    password: string;
    role?: UserRole;
}
export interface VerifyOtpDTO {
    email: string;
    otp: string;
}
export interface LoginDTO {
    email: string;
    password: string;
}
export interface GoogleAuthDTO {
    credential: string;
}
export interface JWTPayload {
    userId: string;
    email: string;
    role: UserRole;
}
export interface AuthUserResponse {
    id: string;
    email: string;
    role: UserRole;
    auth_provider: AuthProvider;
    is_verified: boolean;
    avatar_url?: string | null;
}
