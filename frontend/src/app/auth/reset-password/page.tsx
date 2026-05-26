"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import AuthCard from "@/components/AuthCard";
import { resetPassword } from "@/lib/api";

const checks = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Contains a letter", test: (p: string) => /[a-zA-Z]/.test(p) },
  { label: "Contains a number", test: (p: string) => /\d/.test(p) },
  { label: "Contains a special character", test: (p: string) => /[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\/;'`~]/.test(p) },
];

function ResetPasswordContent() {
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
    if (!token) return setError("Reset token is missing.");
    if (!checks.every((check) => check.test(password))) return setError("Password must include a letter, number, and special character.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const data = await resetPassword(token, password);
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      eyebrow="Secure reset"
      title="New password"
      copy="Choose a stronger password. Reset links expire quickly and can be used only once."
      footer={<Link href="/auth/login">Back to login</Link>}
    >
      <form onSubmit={handleSubmit} className="form-stack">
        <input className="field" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="New password" autoComplete="new-password" />
        <input className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" placeholder="Confirm password" autoComplete="new-password" />
        <div style={{ display: "grid", gap: "0.3rem" }}>
          {checks.map((check) => <span key={check.label} style={{ color: check.test(password) ? "#047857" : "var(--ink-muted)", fontSize: "0.78rem", fontWeight: 600 }}>{check.label}</span>)}
        </div>
        {error && <div className="alert-error"><AlertCircle size={16} />{error}</div>}
        {message && <div className="alert-success"><CheckCircle size={16} />{message}</div>}
        <button className="btn-red" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>{loading ? "Updating..." : "Update password"}</button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><ResetPasswordContent /></Suspense>;
}
