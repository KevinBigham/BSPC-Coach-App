import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BSPC Parent Portal',
  description: 'View your swimmer\'s progress, times, and attendance',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&family=Press+Start+2P&family=Teko:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        <nav className="border-b-2 border-[var(--purple)] px-6 py-4" style={{ backgroundColor: 'var(--bg-deep)' }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <span className="pixel-label">BSPC</span>
              <h1 className="heading text-2xl mt-1">PARENT PORTAL</h1>
            </div>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
