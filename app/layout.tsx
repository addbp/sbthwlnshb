import type { Metadata } from 'next';
import { Inter, Cormorant_Garamond } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Sabbath Spa Management System',
  description: 'Digital spa management system for Sabbath Spa & Wellness Hub.',
  // Icons come from the file convention: app/favicon.ico
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className={`${inter.variable} ${cormorant.variable} h-full antialiased`}>
      <body className='min-h-full bg-brandBackground text-brandText font-body'>
        {children}
      </body>
    </html>
  );
}