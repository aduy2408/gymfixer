"use client";

import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "@/lib/api";
import { setSession } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
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

  return (
    <button type="button" onClick={() => window.google?.accounts.id.prompt()} disabled={!ready} className="google-btn">
      <span className="google-mark">G</span>
      {ready ? "Continue with Google" : "Loading Google..."}
    </button>
  );
}
