import type { Metadata, Viewport } from "next";
import { Lora, Sora, Martian_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-head",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const martianMono = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Covenant",
  description: "A verified-impact grants platform on GenLayer - each milestone releases funds only once a validator independently verifies it.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1C1712",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${lora.variable} ${sora.variable} ${martianMono.variable}`} data-scroll-behavior="smooth">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
