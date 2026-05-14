"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, ArrowRight } from "lucide-react";

const goals = [
    { id: "fat_loss", emoji: "🔥", label: "Fat Loss", desc: "Reduce body fat while preserving muscle" },
    { id: "muscle", emoji: "💪", label: "Muscle Gain", desc: "Build size and strength" },
    { id: "strength", emoji: "🏋️", label: "Strength", desc: "Maximise your 1-rep maxes" },
    { id: "endurance", emoji: "🏃", label: "Endurance", desc: "Improve cardio & stamina" },
    { id: "rehab", emoji: "🩺", label: "Rehabilitation", desc: "Recover safely from injury" },
    { id: "general", emoji: "⚡", label: "General Fitness", desc: "Stay healthy and active" },
];

export default function OnboardingMetricsPage() {
    const router = useRouter();
    const [form, setForm] = useState({ height: "", weight: "", age: "", gender: "", goal: "" });
    const [saving, setSaving] = useState(false);

    const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        if (typeof window !== "undefined") localStorage.setItem("fg_profile", JSON.stringify(form));
        await new Promise((r) => setTimeout(r, 800));
        router.push("/dashboard");
    };

    const isComplete = form.height && form.weight && form.age && form.goal;

    const inputStyle: React.CSSProperties = {
        width: "100%",
        background: "#f2f2f2",
        border: "none",
        borderRadius: 4,
        padding: "12px 14px",
        fontSize: "0.9rem",
        color: "#0a0a0a",
        outline: "none",
    };

    const labelStyle: React.CSSProperties = {
        display: "block",
        fontSize: "0.7rem",
        fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        marginBottom: "0.35rem",
        color: "#333",
    };

    return (
        <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Barlow', sans-serif" }}>
            {/* Top bar */}
            <div style={{ borderBottom: "1px solid #e8e8e8", padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 4, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Activity size={15} color="white" />
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        PTT<span style={{ color: "var(--red)" }}>.</span>
                    </span>
                </div>

                {/* Step indicator */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <div style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #ddd", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, color: "#10b981" }}>✓</div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#bbb" }}>Introduction</span>
                    </div>
                    <div style={{ width: 32, height: 1, background: "#e8e8e8" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <div style={{ width: 24, height: 24, borderRadius: 4, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#fff" }}>2</div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--red)" }}>Your Metrics</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: 640, margin: "0 auto", padding: "3rem 1.5rem" }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "0.5rem" }}>
                        Step 2 of 2
                    </p>
                    <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "clamp(2rem, 5vw, 3rem)", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.75rem" }}>
                        TELL US ABOUT YOURSELF
                    </h1>
                    <p style={{ color: "#666", fontSize: "0.875rem", lineHeight: 1.7, fontWeight: 300, marginBottom: "2rem" }}>
                        We use this to personalise your pose analysis and recommendations.
                    </p>

                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        {/* Body stats row */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                            {[
                                { key: "height", label: "Height (cm)", placeholder: "175", min: 100, max: 250 },
                                { key: "weight", label: "Weight (kg)", placeholder: "72", min: 30, max: 300 },
                                { key: "age", label: "Age", placeholder: "28", min: 10, max: 100 },
                            ].map(({ key, label, placeholder, min, max }) => (
                                <div key={key}>
                                    <label style={labelStyle}>{label}</label>
                                    <input
                                        id={`metrics-${key}`}
                                        type="number"
                                        min={min} max={max}
                                        value={form[key as keyof typeof form]}
                                        onChange={update(key)}
                                        placeholder={placeholder}
                                        style={inputStyle}
                                        onFocus={(e) => (e.target.style.background = "#e8e8e8")}
                                        onBlur={(e) => (e.target.style.background = "#f2f2f2")}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Gender */}
                        <div>
                            <label style={labelStyle}>Gender (optional)</label>
                            <select
                                id="metrics-gender"
                                value={form.gender}
                                onChange={update("gender") as React.ChangeEventHandler<HTMLSelectElement>}
                                style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
                            >
                                <option value="">Prefer not to say</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        {/* Fitness Goal */}
                        <div>
                            <label style={labelStyle}>Fitness Goal</label>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8" }}>
                                {goals.map((g) => (
                                    <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, goal: g.id }))}
                                        style={{
                                            background: form.goal === g.id ? "var(--red)" : "#fff",
                                            padding: "1rem",
                                            textAlign: "left",
                                            cursor: "pointer",
                                            border: "none",
                                            outline: "none",
                                            transition: "background 0.15s",
                                        }}
                                    >
                                        <p style={{ fontSize: "1.1rem", marginBottom: "0.2rem" }}>{g.emoji}</p>
                                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.95rem", textTransform: "uppercase", color: form.goal === g.id ? "#fff" : "#111", marginBottom: "0.1rem" }}>
                                            {g.label}
                                        </p>
                                        <p style={{ fontSize: "0.72rem", color: form.goal === g.id ? "rgba(255,255,255,0.75)" : "#888", fontWeight: 300, lineHeight: 1.4 }}>
                                            {g.desc}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Submit */}
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            id="metrics-submit"
                            type="submit"
                            disabled={!isComplete || saving}
                            className="btn-red"
                            style={{
                                width: "100%",
                                justifyContent: "center",
                                padding: "1rem",
                                fontSize: "0.85rem",
                                borderRadius: 4,
                                opacity: isComplete && !saving ? 1 : 0.4,
                                cursor: isComplete && !saving ? "pointer" : "not-allowed",
                            }}
                        >
                            {saving ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                        <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    SAVING…
                                </span>
                            ) : (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                                    GO TO DASHBOARD <ArrowRight size={16} />
                                </span>
                            )}
                        </motion.button>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
