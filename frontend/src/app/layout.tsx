import type { Metadata } from "next";
import Script from "next/script";
import { LanguageProvider } from "@/lib/i18n";
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
  const enableAnalytics = process.env.NODE_ENV === "production";

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LanguageProvider>{children}</LanguageProvider>
        {enableAnalytics ? (
          <>
            <Script
              src="https://www.googletagmanager.com/gtag/js?id=G-3CP14K4FVB"
              strategy="afterInteractive"
            />
            <Script id="google-tag-manager" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());

                gtag('config', 'G-3CP14K4FVB');
              `}
            </Script>
            <Script
              src="https://t.contentsquare.net/uxa/168132bcc36cb.js"
              strategy="afterInteractive"
            />
          </>
        ) : null}
      </body>
    </html>
  );
}
