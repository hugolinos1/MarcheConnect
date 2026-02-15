
import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MarchéConnect - Gestion Exposants',
  description: 'Solution de gestion des préinscriptions pour votre marché de Noël.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-accent selection:text-accent-foreground">
        {children}
      </body>
    </html>
  );
}
