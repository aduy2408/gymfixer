"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import AuthCard from "@/components/AuthCard";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!/\S+@\S+\.\S+/.test(email)) return setError("Enter a valid email.");
    setLoading(true);
    try {
      const data = await forgotPassword(email);
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request password reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      eyebrow="Password recovery"
      title="Reset password"
      copy="Enter your account email. If it exists, we will send a secure reset link that expires soon."
      footer={<Link href="/auth/login">Back to login</Link>}
    >
      <form onSubmit={handleSubmit} className="form-stack">
        <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="email" />
        {error && <div className="alert-error"><AlertCircle size={16} />{error}</div>}
        {message && <div className="alert-success"><CheckCircle size={16} />{message}</div>}
        <button className="btn-red" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>{loading ? "Sending..." : "Send reset link"}</button>
      </form>
    </AuthCard>
  );
}
