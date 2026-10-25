import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'LuckyTimes | Midnight Premium', description: 'Panel administrativo de LuckyTimes, demostración moderna en español.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
