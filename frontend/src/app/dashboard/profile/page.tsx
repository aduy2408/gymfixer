"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Save, CheckCircle } from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import { mockProfile, mockUser } from "@/lib/mockData";
import Link from "next/link";

const goals = [
    { id: "fat_loss", label: "🔥 Fat Loss" },
    { id: "muscle", label: "💪 Muscle Gain" },
    { id: "strength", label: "🏋️ Strength" },
    { id: "endurance", label: "🏃 Endurance" },
    { id: "rehab", label: "🩺 Rehabilitation" },
    { id: "general", label: "⚡ General Fitness" },
];

const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#f2f2f2",
    border: "none",
    borderRadius: 4,
    padding: "9px 12px",
    fontSize: "0.8rem",
    color: "#0a0a0a",
    outline: "none",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.64rem",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: "0.3rem",
    color: "#555",
};

const sectionTitle = (text: string) => (
    <p style={{ fontSize: "0.64rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: "var(--red)", marginBottom: "0.8rem" }}>
        {text}
    </p>
);

const Divider = () => <hr style={{ border: "none", borderTop: "1px solid #e8e8e8", margin: "1.1rem 0" }} />;

export default function ProfilePage() {
    const [form, setForm] = useState({
        name: mockUser.name,
        email: mockUser.email,
        height: String(mockProfile.height),
        weight: String(mockProfile.weight),
        age: String(mockProfile.age),
        gender: mockProfile.gender.toLowerCase(),
        goal: "muscle",
    });
    const [saved, setSaved] = useState(false);

    const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        await new Promise((r) => setTimeout(r, 600));
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "var(--font-ui)" }}>
            <DashboardNav />
            <main style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.75rem" }}>
                <div style={{ maxWidth: 1040, margin: "0 auto" }}>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

                        <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "0.4rem" }}>Your Account</p>
                        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.25rem" }}>
                            PROFILE SETTINGS
                        </h1>
                        <p style={{ fontSize: "0.8rem", color: "#999", fontWeight: 300, marginBottom: "1rem" }}>
                            Manage your account and body metrics
                        </p>

                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: "1rem", marginTop: "1rem" }}>
                            {/* Left Side: Profile Form */}
                            <form onSubmit={handleSave} style={{ background: "#fff", padding: "1rem", borderRadius: 6, border: "1px solid #e8e8e8" }}>

                                {/* ── Account ── */}
                                {sectionTitle("Account")}
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.9rem" }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 4, background: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", fontWeight: 900, color: "#fff", flexShrink: 0 }}>
                                        {form.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{form.name}</p>
                                        <p style={{ fontSize: "0.78rem", color: "#aaa", fontWeight: 300 }}>{form.email}</p>
                                        <p style={{ fontSize: "0.72rem", color: "#ccc", marginTop: "0.15rem" }}>
                                            Member since {new Date(mockUser.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                    <div>
                                        <label style={labelStyle}>Full Name</label>
                                        <input type="text" value={form.name} onChange={update("name")} style={inputStyle}
                                            onFocus={(e) => (e.target.style.background = "#e8e8e8")} onBlur={(e) => (e.target.style.background = "#f2f2f2")} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Email</label>
                                        <input type="email" value={form.email} onChange={update("email")} style={inputStyle}
                                            onFocus={(e) => (e.target.style.background = "#e8e8e8")} onBlur={(e) => (e.target.style.background = "#f2f2f2")} />
                                    </div>
                                </div>

                                <Divider />

                                {/* ── Body Metrics ── */}
                                {sectionTitle("Body Metrics")}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                                    {[
                                        { key: "height", label: "Height (cm)" },
                                        { key: "weight", label: "Weight (kg)" },
                                        { key: "age", label: "Age" },
                                    ].map(({ key, label }) => (
                                        <div key={key}>
                                            <label style={labelStyle}>{label}</label>
                                            <input type="number" value={form[key as keyof typeof form]} onChange={update(key)} style={inputStyle}
                                                onFocus={(e) => (e.target.style.background = "#e8e8e8")} onBlur={(e) => (e.target.style.background = "#f2f2f2")} />
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <label style={labelStyle}>Gender (optional)</label>
                                    <select value={form.gender} onChange={update("gender") as React.ChangeEventHandler<HTMLSelectElement>}
                                        style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}>
                                        <option value="">Prefer not to say</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <Divider />

                                {/* ── Fitness Goal ── */}
                                {sectionTitle("Fitness Goal")}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8" }}>
                                    {goals.map((g) => (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, goal: g.id }))}
                                            style={{
                                                background: form.goal === g.id ? "var(--red)" : "#fff",
                                                color: form.goal === g.id ? "#fff" : "#444",
                                                border: "none",
                                                padding: "0.55rem 0.45rem",
                                                fontSize: "0.72rem",
                                                fontWeight: form.goal === g.id ? 700 : 400,
                                                cursor: "pointer",
                                                textAlign: "center",
                                                transition: "background 0.12s",
                                            }}
                                        >
                                            {g.label}
                                        </button>
                                    ))}
                                </div>

                                <Divider />

                                {/* ── Save button ── */}
                                <button
                                    type="submit"
                                    className="btn-red"
                                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", gap: "0.5rem", padding: "0.65rem", fontSize: "0.78rem", borderRadius: 4 }}
                                >
                                    {saved ? <><CheckCircle size={15} /> SAVED!</> : <><Save size={15} /> SAVE CHANGES</>}
                                </button>

                                <Divider />

                                {/* ── Danger zone ── */}
                                {sectionTitle("Danger Zone")}
                                <p style={{ fontSize: "0.78rem", color: "#aaa", fontWeight: 300, marginBottom: "0.75rem" }}>
                                    Deleting your account permanently removes all data including videos and analyses.
                                </p>
                                <button
                                    type="button"
                                    style={{ padding: "0.5rem 1.1rem", border: "1px solid #eee", borderRadius: 4, background: "none", color: "#ccc", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", transition: "border-color 0.15s, color 0.15s" }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--red)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#eee"; (e.currentTarget as HTMLButtonElement).style.color = "#ccc"; }}
                                >
                                    Delete Account
                                </button>
                            </form>

                            {/* Right Side: Plans Overview */}
                            <div>
                                <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 6, padding: "1rem", position: "sticky", top: "1.25rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.9rem" }}>
                                        <div>
                                            {sectionTitle("Current Subscription")}
                                            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.8rem", lineHeight: 1, color: "var(--black)", marginTop: "-0.25rem" }}>
                                                FREE <span style={{ fontSize: "1rem", color: "#888", fontWeight: 500, fontFamily: "var(--font-ui)", textTransform: "none" }}>Plan</span>
                                            </p>
                                        </div>
                                        <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "0.3rem 0.6rem", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            Active
                                        </div>
                                    </div>

                                    <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: "1rem", lineHeight: 1.45 }}>
                                        You are currently on the Free plan. This gives you access to basic form analysis for up to 5 videos per month.
                                    </p>

                                    <div style={{ padding: "0.9rem", background: "#f9f9f9", borderRadius: 6, border: "1px solid #f0f0f0", marginBottom: "1rem" }}>
                                        <p style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.7rem", color: "#333", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current Features Included</p>
                                        <ul style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                                            {["5 Video Uploads per month", "Basic Pose Analysis", "Standard Processing Time"].map((feature, i) => (
                                                <li key={i} style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.78rem", color: "#555" }}>
                                                    <CheckCircle size={15} color="var(--red)" /> {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                        <Link href="/pricing" style={{ width: "100%" }}>
                                            <button className="btn-red" style={{ width: "100%", padding: "0.65rem", fontSize: "0.78rem", borderRadius: 4 }}>
                                                Upgrade Plan
                                            </button>
                                        </Link>
                                        <button className="btn-outline-red" style={{ width: "100%", padding: "0.65rem", fontSize: "0.78rem", borderRadius: 4 }}>
                                            Manage Billing
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
