"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Activity } from "lucide-react";
import { loginWithSupabase } from "@/lib/api";
import { setSession } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function completeLogin() {
      try {
        const supabase = getSupabaseClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const token = data.session?.access_token;
        if (!token) throw new Error(t("auth.supabaseNoSession"));

        const auth = await loginWithSupabase(token);
        if (cancelled) return;
        setSession(auth.access_token, auth.user);
        await supabase.auth.signOut();
        router.replace("/dashboard");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("auth.googleFailed"));
        }
      }
    }

    completeLogin();
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", background: "#fff", fontFamily: "var(--font-ui)" }}>
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div style={{ width: 42, height: 42, borderRadius: 6, background: "var(--red)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
          <Activity size={18} color="white" />
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.75rem" }}>
          {error ? t("auth.googleFailed") : t("auth.completingLogin")}
        </h1>
        {error ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1rem", borderRadius: 6, background: "rgba(214,0,28,0.06)", border: "1px solid rgba(214,0,28,0.2)", color: "var(--red)", fontSize: "0.85rem", marginBottom: "1rem" }}>
              <AlertCircle size={14} /> {error}
            </div>
            <Link href="/auth/login" style={{ fontWeight: 700, color: "var(--red)" }}>
              {t("auth.backToLogin")}
            </Link>
          </>
        ) : (
          <p style={{ color: "#888", fontSize: "0.875rem", fontWeight: 300 }}>
            {t("auth.completingLoginCopy")}
          </p>
        )}
      </div>
    </div>
  );
}
