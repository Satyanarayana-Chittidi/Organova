'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
type Theme = 'light' | 'dark';
interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export function ThemeProvider({ children }: {
    children: React.ReactNode;
}) {
    const [theme, setThemeState] = useState<Theme>('light');
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const stored = localStorage.getItem('app-theme') as Theme | null;
        let initialTheme: Theme = 'light';
        if (stored === 'light' || stored === 'dark') {
            initialTheme = stored;
        }
        else if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            initialTheme = 'dark';
        }
        setThemeState(initialTheme);
        applyTheme(initialTheme);
        setMounted(true);
    }, []);
    const applyTheme = (targetTheme: Theme) => {
        if (typeof document === 'undefined')
            return;
        const root = document.documentElement;
        if (targetTheme === 'dark') {
            root.classList.add('dark');
            root.style.colorScheme = 'dark';
        }
        else {
            root.classList.remove('dark');
            root.style.colorScheme = 'light';
        }
    };
    const setTheme = (targetTheme: Theme) => {
        setThemeState(targetTheme);
        localStorage.setItem('app-theme', targetTheme);
        applyTheme(targetTheme);
    };
    const toggleTheme = () => {
        const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
    };
    return (<ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>);
}
export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
