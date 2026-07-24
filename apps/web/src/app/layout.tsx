import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Sentezy",
  description: "Turn a product link or a couple of sentences into a finished vertical video — presenter, voice, captions and music included.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@600,700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
        {/* Caption fonts — so the live preview matches the fonts the worker burns in. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Oswald:wght@500;700&family=Montserrat:wght@600;800&family=Poppins:wght@600;800&family=Archivo+Black&family=Rubik:wght@500;700&family=Sora:wght@600;700&family=Fredoka:wght@500;600&family=Kanit:wght@600;700&family=Teko:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
