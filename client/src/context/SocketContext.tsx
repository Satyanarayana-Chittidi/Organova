'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { bloodApi } from '@/lib/api';
export interface LiveAlert {
    id: string;
    type: string;
    priority?: string;
    message: string;
    timestamp: string;
    meta?: any;
}
interface SocketContextType {
    socket: Socket | null;
    connected: boolean;
    alerts: LiveAlert[];
    dismissAlert: (id: string) => void;
    clearAlerts: () => void;
    refreshAlerts: () => Promise<void>;
}
const SocketContext = createContext<SocketContextType | undefined>(undefined);
export function SocketProvider({ children }: {
    children: React.ReactNode;
}) {
    const { user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [alerts, setAlerts] = useState<LiveAlert[]>([]);
    const refreshAlerts = useCallback(async () => {
        if (!user) {
            setAlerts([]);
            return;
        }
        try {
            const res = await bloodApi.getActiveAlerts();
            if (res.success && Array.isArray(res.data)) {
                setAlerts(res.data);
            }
        }
        catch (err) {
            console.warn('[ALERTS] Failed to fetch active alerts:', err);
        }
    }, [user]);
    useEffect(() => {
        if (!user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setConnected(false);
            }
            setAlerts([]);
            return;
        }
        refreshAlerts();
        const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ||
            (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');
        const s = io(SOCKET_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
        });
        s.on('connect', () => {
            setConnected(true);
            console.log('[WEBSOCKET] Connected to real-time notification engine.');
        });
        s.on('disconnect', () => {
            setConnected(false);
        });
        s.on('MATCH_OFFER_RECEIVED', (data: any) => {
            const alert: LiveAlert = {
                id: Math.random().toString(),
                type: 'MATCH_OFFER',
                priority: 'CRITICAL',
                message: data.message,
                timestamp: data.timestamp,
                meta: data,
            };
            setAlerts((prev) => [alert, ...prev]);
        });
        s.on('RECIPIENT_MATCH_ALERT', (data: any) => {
            const alert: LiveAlert = {
                id: Math.random().toString(),
                type: 'PATIENT_MATCH',
                priority: 'URGENT',
                message: data.message,
                timestamp: data.timestamp,
            };
            setAlerts((prev) => [alert, ...prev]);
        });
        s.on('BLOOD_REQUEST_ALERT', (data: any) => {
            refreshAlerts();
        });
        s.on('BLOOD_ORDER_STATUS_CHANGED', (data: any) => {
            if (data?.status === 'ALL_CLEARED') {
                setAlerts([]);
            }
            else if (data?.requestId) {
                const reqIdStr = String(data.requestId);
                if (data.status === 'CANCELLED' || data.status === 'COMPLETED') {
                    setAlerts((prev) => prev.filter((a) => {
                        const aReqId = a.meta?.requestId ? String(a.meta.requestId) : null;
                        if (aReqId === reqIdStr)
                            return false;
                        if (a.id === `blood-req-${reqIdStr}` || a.id === `active-pass-${reqIdStr}`)
                            return false;
                        return true;
                    }));
                }
                else if (data.status === 'DONOR_COMMITTED') {
                    setAlerts((prev) => prev.filter((a) => a.id !== `blood-req-${reqIdStr}`));
                }
            }
            refreshAlerts();
        });
        setSocket(s);
        return () => {
            s.disconnect();
        };
    }, [user, refreshAlerts]);
    const dismissAlert = (id: string) => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
    };
    const clearAlerts = () => {
        setAlerts([]);
    };
    return (<SocketContext.Provider value={{ socket, connected, alerts, dismissAlert, clearAlerts, refreshAlerts }}>
      {children}
    </SocketContext.Provider>);
}
export function useSocket() {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
}
