"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import AuthCard from "@/components/AuthCard";
import { forgotPassword } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!/\S+@\S+\.\S+/.test(email)) return setError(t("common.requiredEmail"));
    setLoading(true);
    try {
      const data = await forgotPassword(email);
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.resetRequestError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      eyebrow={t("auth.passwordRecovery")}
      title={t("auth.resetPassword")}
      copy={t("auth.resetCopy")}
      footer={<Link href="/auth/login">{t("common.backToLogin")}</Link>}
    >
      <form onSubmit={handleSubmit} className="form-stack">
        <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="email" />
        {error && <div className="alert-error"><AlertCircle size={16} />{error}</div>}
        {message && <div className="alert-success"><CheckCircle size={16} />{message}</div>}
        <button className="btn-red" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>{loading ? t("common.sending") : t("auth.resetSend")}</button>
      </form>
    </AuthCard>
  );
}
