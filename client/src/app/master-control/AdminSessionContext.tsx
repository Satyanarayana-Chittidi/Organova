'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { authApi, setAdminToken } from '@/lib/api';
import { AuthUser } from '@/context/AuthContext';
interface AdminSessionContextType {
    isAdminUnlocked: boolean;
    adminUser: AuthUser | null;
    unlockAdmin: (email: string, password: string) => Promise<void>;
    lockTerminal: () => void;
}
const AdminSessionContext = createContext<AdminSessionContextType | undefined>(undefined);
export function AdminSessionProvider({ children }: {
    children: ReactNode;
}) {
    const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
    const [adminUser, setAdminUser] = useState<AuthUser | null>(null);
    const unlockAdmin = async (email: string, password: string): Promise<void> => {
        const trimmedEmail = email.trim().toLowerCase();
        const res = await authApi.login({ email: trimmedEmail, password });
        const user = res.data?.user;
        const token = res.data?.token;
        if (!user || user.role !== 'ADMIN') {
            setAdminToken(null);
            setAdminUser(null);
            setIsAdminUnlocked(false);
            throw new Error('Access Denied: Email is not authorized for administrative access.');
        }
        setAdminToken(token);
        setAdminUser(user);
        setIsAdminUnlocked(true);
    };
    const lockTerminal = (): void => {
        setAdminToken(null);
        setAdminUser(null);
        setIsAdminUnlocked(false);
    };
    return (<AdminSessionContext.Provider value={{
            isAdminUnlocked,
            adminUser,
            unlockAdmin,
            lockTerminal,
        }}>
      {children}
    </AdminSessionContext.Provider>);
}
export function useAdminSession() {
    const context = useContext(AdminSessionContext);
    if (!context) {
        throw new Error('useAdminSession must be used within an AdminSessionProvider');
    }
    return context;
}
