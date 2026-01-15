import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Gestoría Avanza - Portal de Facturas',
    description: 'Sistema de procesamiento de facturas con IA',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es">
            <body className="min-h-screen bg-slate-50">{children}</body>
        </html>
    );
}
