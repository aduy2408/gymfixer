"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import { verifyEmail } from "@/lib/api";
import { setStoredUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

function VerifyEmailContent() {
  const { t } = useI18n();
  const token = useSearchParams().get("token") || "";
  const [message, setMessage] = useState(t("auth.verifyingEmail"));
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function run() {
      if (!token) {
        setMessage("");
        setError(t("auth.verifyTokenMissing"));
        return;
      }
      try {
        const user = await verifyEmail(token);
        if (!active) return;
        setStoredUser(user);
        setMessage(t("auth.emailVerified"));
      } catch (err) {
        if (!active) return;
        setMessage("");
        setError(err instanceof Error ? err.message : t("auth.verifyEmailError"));
      }
    }
    run();
    return () => { active = false; };
  }, [token, t]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#fff", fontFamily: "'Barlow', sans-serif", padding: "1.5rem" }}>
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <p style={{ color: "var(--red)", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>{t("auth.emailVerification")}</p>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "2.6rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "1rem" }}>{t("auth.verifyAccount")}</h1>
        {message && <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", color: "#10b981", fontSize: "0.9rem" }}><CheckCircle size={16} />{message}</div>}
        {error && <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", color: "var(--red)", fontSize: "0.9rem" }}><AlertCircle size={16} />{error}</div>}
        <p style={{ marginTop: "1.5rem", fontSize: "0.85rem" }}><Link href="/dashboard" style={{ color: "var(--red)", fontWeight: 700 }}>{t("auth.goDashboard")}</Link></p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={null}><VerifyEmailContent /></Suspense>;
}
