"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import { verifyEmail } from "@/lib/api";
import { setStoredUser } from "@/lib/auth";

function VerifyEmailContent() {
  const token = useSearchParams().get("token") || "";
  const [message, setMessage] = useState("Verifying your email...");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function run() {
      if (!token) {
        setMessage("");
        setError("Verification token is missing.");
        return;
      }
      try {
        const user = await verifyEmail(token);
        if (!active) return;
        setStoredUser(user);
        setMessage("Email verified successfully. You can continue using GymFixer.");
      } catch (err) {
        if (!active) return;
        setMessage("");
        setError(err instanceof Error ? err.message : "Could not verify email.");
      }
    }
    run();
    return () => { active = false; };
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#fff", fontFamily: "'Barlow', sans-serif", padding: "1.5rem" }}>
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <p style={{ color: "var(--red)", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>Email verification</p>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "2.6rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "1rem" }}>Verify account</h1>
        {message && <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", color: "#10b981", fontSize: "0.9rem" }}><CheckCircle size={16} />{message}</div>}
        {error && <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", color: "var(--red)", fontSize: "0.9rem" }}><AlertCircle size={16} />{error}</div>}
        <p style={{ marginTop: "1.5rem", fontSize: "0.85rem" }}><Link href="/dashboard" style={{ color: "var(--red)", fontWeight: 700 }}>Go to dashboard</Link></p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={null}><VerifyEmailContent /></Suspense>;
}
