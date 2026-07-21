import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Infinity Archive — MCU Completionist Watchlist",
  description: "Track every MCU movie, episode, short, and special in release order.",
  appleWebApp: {
    capable: true,
    title: "Infinity Archive",
    statusBarStyle: "black-translucent",
  },
  other: {
    "codex-preview": "development",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Relative URLs keep install assets inside the GitHub Pages project path. */}
        <link rel="manifest" href="./manifest.webmanifest" />
        <link rel="icon" href="./favicon.ico" sizes="any" />
        <link rel="icon" href="./icons/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" sizes="180x180" />
        <meta name="msapplication-TileColor" content="#05080d" />
        <meta name="msapplication-TileImage" content="./icons/mstile-150.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
