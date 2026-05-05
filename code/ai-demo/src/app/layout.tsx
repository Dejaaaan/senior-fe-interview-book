import type { ReactNode } from "react";

export const metadata = { title: "AI demo" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: "1rem",
          maxWidth: 720,
          marginInline: "auto",
        }}
      >
        {children}
      </body>
    </html>
  );
}
