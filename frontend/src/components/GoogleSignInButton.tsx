"use client";

import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "@/lib/api";
import { setSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

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
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: string | number;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function GoogleSignInButton({ onSuccess, onError }: { onSuccess: () => void; onError: (message: string) => void }) {
  const { t } = useI18n();
  const initializedRef = useRef(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    const initialize = () => {
      if (!window.google || !buttonRef.current || initializedRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        use_fedcm_for_prompt: false,
        callback: async (response) => {
          if (!response.credential) return onError(t("auth.googleNoCredential"));
          try {
            const data = await loginWithGoogle(response.credential);
            setSession(data.access_token, data.user);
            onSuccess();
          } catch (err) {
            onError(err instanceof Error ? err.message : t("auth.googleFailed"));
          }
        },
      });
      const buttonWidth = Math.max(
        220,
        Math.min(400, Math.floor(buttonRef.current.getBoundingClientRect().width || 360)),
      );
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: buttonWidth,
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
  }, [clientId, onError, onSuccess, t]);

  if (!clientId) {
    return <p className="field-help" style={{ textAlign: "center" }}>{t("auth.googleMissing")}</p>;
  }

  if (scriptError) {
    return <p className="alert-error" style={{ justifyContent: "center" }}>{t("auth.googleLoadError")}</p>;
  }

  const buttonShellStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div style={buttonShellStyle}>
      <div ref={buttonRef} style={{ width: "100%", display: ready ? "flex" : "none", justifyContent: "center" }} />
      {!ready && <p className="field-help" style={{ textAlign: "center" }}>{t("auth.loadingGoogle")}</p>}
    </div>
  );
}
