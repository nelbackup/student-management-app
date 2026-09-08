import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Student & Roster Management',
  description: 'Online Student Roster Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-HK">
      <body className="bg-gray-100 text-gray-900">{children}</body>
    </html>
  );
}
