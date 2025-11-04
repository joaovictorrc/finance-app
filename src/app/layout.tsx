// src/app/layout.tsx
import "@/app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finance App",
  description: "Organização financeira",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
