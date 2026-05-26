"use client";

import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "@/lib/api";
import { setSession } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            use_fedcm_for_prompt?: boolean;
            callback: (response: { credential?: string }) => void;
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function GoogleSignInButton({ onSuccess, onError }: { onSuccess: () => void; onError: (message: string) => void }) {
  const initializedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    const initialize = () => {
      if (!window.google || initializedRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        use_fedcm_for_prompt: false,
        callback: async (response) => {
          if (!response.credential) return onError("Google did not return a credential.");
          try {
            const data = await loginWithGoogle(response.credential);
            setSession(data.access_token, data.user);
            onSuccess();
          } catch (err) {
            onError(err instanceof Error ? err.message : "Google sign-in failed.");
          }
        },
      });
      initializedRef.current = true;
      setReady(true);
    };

    if (window.google) {
      initialize();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener("load", initialize);
      existingScript.addEventListener("error", () => setScriptError(true));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    script.onerror = () => setScriptError(true);
    document.head.appendChild(script);
  }, [clientId, onError, onSuccess]);

  if (!clientId) {
    return <p className="field-help" style={{ textAlign: "center" }}>Google login needs NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend/.env.</p>;
  }

  if (scriptError) {
    return <p className="alert-error" style={{ justifyContent: "center" }}>Could not load Google Sign-In. Check network or Google Cloud origin config.</p>;
  }

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "48px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.75rem",
    padding: "1rem",
    borderRadius: 6,
    border: "1px solid var(--line-strong, #e0e0e0)",
    background: "var(--white, #ffffff)",
    color: "var(--ink, #0a0a0a)",
    fontSize: "0.86rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.045em",
    cursor: ready ? "pointer" : "wait",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  };

  return (
    <button
      type="button"
      onClick={() => window.google?.accounts.id.prompt()}
      disabled={!ready}
      className="google-btn"
      style={buttonStyle}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          fill="#EA4335"
        />
      </svg>
      <span>{ready ? "Continue with Google" : "Loading Google..."}</span>
    </button>
  );
}
