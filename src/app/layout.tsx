import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'LuckyTimes | Midnight Premium', description: 'Plataforma de gestión de sorteos, puestos y tiquetes.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
