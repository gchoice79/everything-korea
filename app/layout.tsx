import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Everything Korea",
  description: "Everything about Korea, in 15 languages.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
