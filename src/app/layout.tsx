import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Narriva — Transcrição e organização de áudios",
  description: "Importação, transcrição e análise de áudios em português brasileiro.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${sourceSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden">{children}</body>
    </html>
  );
}
