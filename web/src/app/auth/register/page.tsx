"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, CheckCircle, Activity } from "lucide-react";
import { setAuthToken } from "@/lib/mockData";
import { login, register } from "@/lib/api";

const passwordChecks = [
    { label: "At least 6 characters", test: (p: string) => p.length >= 6 },
    { label: "Contains a number", test: (p: string) => /\d/.test(p) },
    { label: "Contains a letter", test: (p: string) => /[a-zA-Z]/.test(p) },
];

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!form.name.trim()) return setError("Full name is required.");
        if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) return setError("Enter a valid email.");
        if (form.password.length < 6) return setError("Password must be at least 6 characters.");
        if (form.password !== form.confirm) return setError("Passwords do not match.");

        setLoading(true);
        try {
            const createdUser = await register(form.name.trim(), form.email, form.password);
            const data = await login(form.email, form.password);
            setAuthToken(data.access_token);
            localStorage.setItem("ptt_user", JSON.stringify({
                id: createdUser.id,
                email: createdUser.email,
                name: createdUser.name,
            }));
            router.push("/onboarding/intro");
        } catch (err) {
            setLoading(false);
            return setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
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

    const LabelStyle: React.CSSProperties = {
        display: "block",
        fontSize: "0.72rem",
        fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        marginBottom: "0.4rem",
        color: "#333",
    };

    return (
        <div style={{ minHeight: "100vh", display: "flex", background: "#fff", fontFamily: "'Barlow', sans-serif" }}>

            {/* Left — brand panel */}
            <div
                className="hidden lg:flex flex-col justify-between w-5/12 p-14"
                style={{ background: "var(--navy)" }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Activity size={16} color="white" />
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.2rem", letterSpacing: "0.05em", color: "#fff", textTransform: "uppercase" }}>
                        PTT<span style={{ color: "var(--red)" }}>.</span>
                    </span>
                </div>

                <div>
                    <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "1rem" }}>
                        Free to get started
                    </p>
                    <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "3.5rem", textTransform: "uppercase", lineHeight: 0.95, color: "#fff", marginBottom: "1.5rem" }}>
                        START YOUR<br />
                        <span style={{ color: "var(--red)" }}>FITNESS JOURNEY.</span>
                    </h2>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", lineHeight: 1.7, maxWidth: 340, fontWeight: 300 }}>
                        Create your profile, set your goals, and let AI coach your every rep.
                    </p>

                    <div style={{ marginTop: "2.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        {[
                            { value: "Free", label: "To get started" },
                            { value: "2 min", label: "To first analysis" },
                            { value: "18+", label: "Joints tracked" },
                            { value: "∞", label: "Videos stored" },
                        ].map((s) => (
                            <div key={s.label} style={{ padding: "1rem", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}>
                                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.8rem", color: "var(--red)", lineHeight: 1 }}>{s.value}</p>
                                <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: "0.25rem", fontWeight: 300 }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>© 2026 PTT</p>
            </div>

            {/* Right — form */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem", overflowY: "auto" }}>
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
                        Free forever
                    </p>
                    <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2.6rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.5rem" }}>
                        GET STARTED NOW
                    </h1>
                    <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "2rem", fontWeight: 300 }}>
                        No credit card required.
                    </p>

                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {/* Name */}
                        <div>
                            <label style={LabelStyle}>Full Name</label>
                            <input id="reg-name" type="text" value={form.name} onChange={update("name")}
                                placeholder="Alex Johnson" style={inputStyle}
                                onFocus={(e) => (e.target.style.background = "#e8e8e8")}
                                onBlur={(e) => (e.target.style.background = "#f2f2f2")} />
                        </div>

                        {/* Email */}
                        <div>
                            <label style={LabelStyle}>Email Address</label>
                            <input id="reg-email" type="email" value={form.email} onChange={update("email")}
                                placeholder="you@example.com" style={inputStyle} autoComplete="email"
                                onFocus={(e) => (e.target.style.background = "#e8e8e8")}
                                onBlur={(e) => (e.target.style.background = "#f2f2f2")} />
                        </div>

                        {/* Password */}
                        <div>
                            <label style={LabelStyle}>Password</label>
                            <div style={{ position: "relative" }}>
                                <input id="reg-password" type={showPass ? "text" : "password"} value={form.password}
                                    onChange={update("password")} placeholder="Min. 6 characters"
                                    style={{ ...inputStyle, paddingRight: "2.75rem" }} autoComplete="new-password"
                                    onFocus={(e) => (e.target.style.background = "#e8e8e8")}
                                    onBlur={(e) => (e.target.style.background = "#f2f2f2")} />
                                <button type="button" onClick={() => setShowPass(!showPass)}
                                    style={{ position: "absolute", right: "0.875rem", top: "50%", transform: "translateY(-50%)", color: "#999", background: "none", border: "none", cursor: "pointer" }}>
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {form.password.length > 0 && (
                                <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                    {passwordChecks.map((c) => (
                                        <div key={c.label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem" }}>
                                            <CheckCircle size={11} style={{ color: c.test(form.password) ? "#10b981" : "#ccc" }} />
                                            <span style={{ color: c.test(form.password) ? "#10b981" : "#aaa" }}>{c.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Confirm */}
                        <div>
                            <label style={LabelStyle}>Confirm Password</label>
                            <input id="reg-confirm" type="password" value={form.confirm} onChange={update("confirm")}
                                placeholder="Repeat your password" autoComplete="new-password"
                                style={{ ...inputStyle, borderBottom: form.confirm && form.confirm !== form.password ? "2px solid var(--red)" : "none" }}
                                onFocus={(e) => (e.target.style.background = "#e8e8e8")}
                                onBlur={(e) => (e.target.style.background = "#f2f2f2")} />
                            {form.confirm && form.confirm !== form.password && (
                                <p style={{ fontSize: "0.75rem", color: "var(--red)", marginTop: "0.25rem" }}>Passwords don&apos;t match</p>
                            )}
                        </div>

                        {error && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem", borderRadius: 6, background: "rgba(214,0,28,0.06)", border: "1px solid rgba(214,0,28,0.2)", color: "var(--red)", fontSize: "0.85rem" }}>
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}

                        <button id="reg-submit" type="submit" disabled={loading} className="btn-red"
                            style={{ width: "100%", justifyContent: "center", padding: "1rem", fontSize: "0.85rem", borderRadius: 6, marginTop: "0.5rem", opacity: loading ? 0.75 : 1 }}>
                            {loading ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                        <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    CREATING ACCOUNT…
                                </span>
                            ) : "CREATE ACCOUNT"}
                        </button>
                    </form>

                    <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#bbb", marginTop: "1.25rem" }}>
                        By creating an account you agree to our{" "}
                        <a href="#" style={{ color: "#888", textDecoration: "underline" }}>Terms</a> and{" "}
                        <a href="#" style={{ color: "#888", textDecoration: "underline" }}>Privacy Policy</a>.
                    </p>

                    <p style={{ textAlign: "center", fontSize: "0.875rem", color: "#888", marginTop: "0.75rem" }}>
                        Already have an account?{" "}
                        <Link href="/auth/login" style={{ fontWeight: 700, color: "var(--red)" }}>Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
