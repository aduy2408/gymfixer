"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, Activity } from "lucide-react";
import { setAuthToken } from "@/lib/mockData";
import { login } from "@/lib/api";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!email) return setError("Email is required.");
        if (!/\S+@\S+\.\S+/.test(email)) return setError("Please enter a valid email address.");
        if (password.length < 6) return setError("Password must be at least 6 characters.");

        setLoading(true);
        try {
            const data = await login(email, password);
            setAuthToken(data.access_token);
            localStorage.setItem("ptt_user", JSON.stringify({ email, name: email.split("@")[0] }));
            router.push("/dashboard");
        } catch (err) {
            setLoading(false);
            return setError(err instanceof Error ? err.message : "Login failed.");
        }
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        background: "#f2f2f2",
        border: "none",
        borderRadius: 6,
        padding: "14px 16px",
        fontSize: "0.95rem",
        color: "#0a0a0a",
        outline: "none",
        transition: "background 0.15s",
    };

    return (
        <div style={{ minHeight: "100vh", display: "flex", background: "#fff", fontFamily: "'Barlow', sans-serif" }}>

            {/* Left — brand panel */}
            <div
                className="hidden lg:flex flex-col justify-between w-5/12 p-14"
                style={{ background: "var(--navy)" }}
            >
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "var(--red)" }}>
                        <Activity size={16} color="white" />
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.2rem", letterSpacing: "0.05em", color: "#fff", textTransform: "uppercase" }}>
                        PTT<span style={{ color: "var(--red)" }}>.</span>
                    </span>
                </div>

                <div>
                    <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "1rem" }}>
                        AI-Powered Coaching
                    </p>
                    <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "3.5rem", textTransform: "uppercase", lineHeight: 0.95, color: "#fff", marginBottom: "1.5rem" }}>
                        TRAIN SMART.<br />
                        <span style={{ color: "var(--red)" }}>LIFT SAFE.</span>
                    </h2>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", lineHeight: 1.7, maxWidth: 340, fontWeight: 300 }}>
                        AI-powered workout analysis that identifies posture errors and keeps you injury-free.
                    </p>

                    <div style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {["Pose detection across 18+ joints", "Frame-by-frame angle analysis", "Personalised correction suggestions"].map((item) => (
                            <div key={item} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red)", flexShrink: 0 }} />
                                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.875rem" }}>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>© 2026 PTT</p>
            </div>

            {/* Right — form */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem" }}>
                <div style={{ width: "100%", maxWidth: 420 }}>

                    {/* Mobile logo */}
                    <div className="lg:hidden" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "2rem" }}>
                        <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Activity size={15} color="white" />
                        </div>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            PTT<span style={{ color: "var(--red)" }}>.</span>
                        </span>
                    </div>

                    <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "0.5rem" }}>
                        Welcome Back
                    </p>
                    <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2.6rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.5rem" }}>
                        SIGN IN
                    </h1>
                    <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "2rem", fontWeight: 300 }}>
                        Sign in to your account to continue.
                    </p>

                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem", color: "#333" }}>
                                Email Address
                            </label>
                            <input
                                id="login-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                style={inputStyle}
                                autoComplete="email"
                                onFocus={(e) => (e.target.style.background = "#e8e8e8")}
                                onBlur={(e) => (e.target.style.background = "#f2f2f2")}
                            />
                        </div>

                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#333" }}>
                                    Password
                                </label>
                                <a href="#" style={{ fontSize: "0.75rem", color: "var(--red)", fontWeight: 600 }}>Forgot password?</a>
                            </div>
                            <div style={{ position: "relative" }}>
                                <input
                                    id="login-password"
                                    type={showPass ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min. 6 characters"
                                    style={{ ...inputStyle, paddingRight: "2.75rem" }}
                                    autoComplete="current-password"
                                    onFocus={(e) => (e.target.style.background = "#e8e8e8")}
                                    onBlur={(e) => (e.target.style.background = "#f2f2f2")}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    style={{ position: "absolute", right: "0.875rem", top: "50%", transform: "translateY(-50%)", color: "#999", background: "none", border: "none", cursor: "pointer" }}
                                >
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem", borderRadius: 6, background: "rgba(214,0,28,0.06)", border: "1px solid rgba(214,0,28,0.2)", color: "var(--red)", fontSize: "0.85rem" }}>
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}

                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading}
                            className="btn-red"
                            style={{ width: "100%", justifyContent: "center", padding: "1rem", fontSize: "0.85rem", borderRadius: 6, marginTop: "0.5rem", opacity: loading ? 0.75 : 1 }}
                        >
                            {loading ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                        <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    SIGNING IN…
                                </span>
                            ) : "SIGN IN"}
                        </button>
                    </form>

                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.5rem 0" }}>
                        <div style={{ flex: 1, height: 1, background: "#e8e8e8" }} />
                        <span style={{ fontSize: "0.75rem", color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em" }}>or</span>
                        <div style={{ flex: 1, height: 1, background: "#e8e8e8" }} />
                    </div>

                    <p style={{ textAlign: "center", fontSize: "0.875rem", color: "#888" }}>
                        Don&apos;t have an account?{" "}
                        <Link href="/auth/register" style={{ fontWeight: 700, color: "var(--red)" }}>
                            Sign up free
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
