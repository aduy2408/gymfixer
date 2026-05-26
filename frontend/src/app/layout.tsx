import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GymFixer — AI Workout Form Coaching",
  description: "AI-powered workout pose analysis. Upload workout videos and get clear feedback on form, joint angles, and posture corrections.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
