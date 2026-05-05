import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Next.js demo", template: "%s · Next.js demo" },
  description: "App Router demo for the Senior Frontend Interview Prep book.",
};

export const viewport: Viewport = {
  themeColor: "#0c0f14",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
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
