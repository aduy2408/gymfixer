"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import AuthCard from "@/components/AuthCard";
import { resetPassword } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const checks = [
  { labelKey: "auth.ruleLength", test: (p: string) => p.length >= 8 },
  { labelKey: "auth.ruleLetter", test: (p: string) => /[a-zA-Z]/.test(p) },
  { labelKey: "auth.ruleNumber", test: (p: string) => /\d/.test(p) },
  { labelKey: "auth.ruleSpecial", test: (p: string) => /[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\/;'`~]/.test(p) },
];

function ResetPasswordContent() {
  const { t } = useI18n();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!token) return setError(t("auth.tokenMissing"));
    if (!checks.every((check) => check.test(password))) return setError(t("auth.passwordRuleError"));
    if (password !== confirm) return setError(t("auth.passwordMismatch"));
    setLoading(true);
    try {
      const data = await resetPassword(token, password);
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.resetPasswordError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      eyebrow={t("auth.secureReset")}
      title={t("auth.newPassword")}
      copy={t("auth.newPasswordCopy")}
      footer={<Link href="/auth/login">{t("common.backToLogin")}</Link>}
    >
      <form onSubmit={handleSubmit} className="form-stack">
        <input className="field" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder={t("auth.newPassword")} autoComplete="new-password" />
        <input className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" placeholder={t("auth.confirmPasswordPlaceholder")} autoComplete="new-password" />
        <div style={{ display: "grid", gap: "0.3rem" }}>
          {checks.map((check) => <span key={check.labelKey} style={{ color: check.test(password) ? "#047857" : "var(--ink-muted)", fontSize: "0.78rem", fontWeight: 600 }}>{t(check.labelKey)}</span>)}
        </div>
        {error && <div className="alert-error"><AlertCircle size={16} />{error}</div>}
        {message && <div className="alert-success"><CheckCircle size={16} />{message}</div>}
        <button className="btn-red" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>{loading ? t("common.updating") : t("auth.updatePassword")}</button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><ResetPasswordContent /></Suspense>;
}
