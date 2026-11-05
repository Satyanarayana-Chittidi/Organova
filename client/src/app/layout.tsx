import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});
const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});
export const metadata: Metadata = {
    title: 'Organova • Organ Donation & Blood Matching Platform',
    description: 'Real-time organ viability tracking, 20-minute algorithmic matching, and emergency blood supply chain.',
    icons: {
        icon: [
            { url: '/images/logo.png', type: 'image/png' },
            { url: '/favicon.ico' },
        ],
        shortcut: '/images/logo.png',
        apple: '/images/logo.png',
    },
};
export default function RootLayout({ children, }: {
    children: React.ReactNode;
}) {
    return (<html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('app-theme');
                if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch (_) {}
            `,
        }}/>
      </head>
      <body className="min-h-full flex flex-col bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>
            <SocketProvider>
              <Suspense fallback={<div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800"/>}>
                <Navbar />
              </Suspense>
              <main className="flex-1 flex flex-col">{children}</main>
              <Footer />
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>);
}
