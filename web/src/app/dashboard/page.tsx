"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { TrendingUp, Activity, Clock, Award, ChevronRight, Plus, BarChart2 } from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import { mockUploads, mockProfile, mockProgress } from "@/lib/mockData";

const scoreColor = (s: number) => s >= 85 ? "#10b981" : s >= 70 ? "#f59e0b" : "var(--red)";

export default function DashboardPage() {
    const completed = mockUploads.filter((u) => u.status === "completed");
    const avgScore = Math.round(completed.reduce((a, u) => a + (u.score ?? 0), 0) / completed.length);
    const bestScore = Math.max(...completed.map((u) => u.score ?? 0));

    const card: React.CSSProperties = {
        background: "#fff",
        border: "1px solid #e8e8e8",
        borderRadius: 6,
        padding: "1.25rem",
    };

    const statCards = [
        { label: "Avg Form Score", value: avgScore, unit: "/100", icon: Award, accent: "var(--red)" },
        { label: "Best Score", value: bestScore, unit: "/100", icon: TrendingUp, accent: "#10b981" },
        { label: "Total Sessions", value: mockUploads.length, unit: "", icon: Activity, accent: "var(--navy)" },
        { label: "This Week", value: 2, unit: " sessions", icon: Clock, accent: "#f59e0b" },
    ];

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Barlow', sans-serif" }}>
            <DashboardNav />

            <main style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
                <div style={{ maxWidth: 1100, margin: "0 auto" }}>

                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem" }}>
                        <div>
                            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.3rem" }}>
                                Welcome back
                            </p>
                            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.3rem" }}>
                                Alex Johnson
                            </h1>
                            <p style={{ fontSize: "0.8rem", color: "#888", fontWeight: 300 }}>
                                Goal: {mockProfile.fitnessGoal} · {mockProfile.height}cm · {mockProfile.weight}kg
                            </p>
                        </div>
                        <Link href="/dashboard/upload">
                            <button className="btn-red" style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.75rem 1.5rem", fontSize: "0.8rem", borderRadius: 4 }}>
                                <Plus size={15} /> UPLOAD VIDEO
                            </button>
                        </Link>
                    </motion.div>

                    {/* Stat cards — flush grid separated by borders */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8", marginBottom: "1.5rem" }}>
                        {statCards.map((s, i) => (
                            <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                                style={{ background: "#fff", padding: "1.25rem 1.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                    <s.icon size={14} color={s.accent} />
                                    <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999" }}>{s.label}</p>
                                </div>
                                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", lineHeight: 1, color: s.accent }}>
                                    {s.value}<span style={{ fontSize: "0.9rem", color: "#bbb", fontWeight: 400 }}>{s.unit}</span>
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Main content grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem" }}>

                        {/* Recent sessions */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                                <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#333" }}>Recent Sessions</p>
                                <Link href="/dashboard/history">
                                    <span style={{ fontSize: "0.75rem", color: "var(--red)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.2rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                        View all <ChevronRight size={12} />
                                    </span>
                                </Link>
                            </div>

                            <div style={{ border: "1px solid #e8e8e8", display: "flex", flexDirection: "column" }}>
                                {mockUploads.map((u, i) => (
                                    <motion.div key={u.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.06 }}>
                                        <Link href={u.status === "completed" ? `/dashboard/analysis/${u.id}` : "#"}>
                                            <div
                                                style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.9rem 1.1rem", background: "#fff", borderBottom: i < mockUploads.length - 1 ? "1px solid #f0f0f0" : "none", cursor: "pointer", transition: "background 0.12s" }}
                                                onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.background = "#fafafa"}
                                                onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.background = "#fff"}
                                            >
                                                <div style={{ width: 36, height: 36, borderRadius: 4, background: "#f2f2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                    <Activity size={16} color="#555" />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.15rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.exercise}</p>
                                                    <p style={{ fontSize: "0.75rem", color: "#999", fontWeight: 300 }}>
                                                        {u.filename} · {u.duration} · {new Date(u.uploadedAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                                                    {u.status === "completed" && u.score ? (
                                                        <div style={{ textAlign: "right" }}>
                                                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.4rem", color: scoreColor(u.score), lineHeight: 1 }}>{u.score}</p>
                                                            <p style={{ fontSize: "0.65rem", color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em" }}>score</p>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "0.2rem 0.6rem", borderRadius: 3 }}>Processing</span>
                                                    )}
                                                    <ChevronRight size={14} color="#ccc" />
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Right column */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                            {/* Body metrics */}
                            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} style={card}>
                                <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginBottom: "0.75rem" }}>Body Metrics</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    {[
                                        { label: "Height", value: `${mockProfile.height} cm` },
                                        { label: "Weight", value: `${mockProfile.weight} kg` },
                                        { label: "Age", value: `${mockProfile.age} yrs` },
                                        { label: "Gender", value: mockProfile.gender },
                                        { label: "Goal", value: mockProfile.fitnessGoal },
                                    ].map((m) => (
                                        <div key={m.label} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid #f5f5f5" }}>
                                            <span style={{ fontSize: "0.78rem", color: "#aaa" }}>{m.label}</span>
                                            <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>{m.value}</span>
                                        </div>
                                    ))}
                                </div>
                                <Link href="/dashboard/profile">
                                    <button style={{ marginTop: "0.75rem", width: "100%", padding: "0.5rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", border: "1px solid #e8e8e8", borderRadius: 4, background: "none", cursor: "pointer", color: "#666", transition: "border-color 0.15s, color 0.15s" }}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--red)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e8e8e8"; (e.currentTarget as HTMLButtonElement).style.color = "#666"; }}>
                                        Edit Profile
                                    </button>
                                </Link>
                            </motion.div>

                            {/* Form score trend */}
                            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }} style={card}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem" }}>
                                    <BarChart2 size={13} color="var(--red)" />
                                    <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999" }}>Form Score Trend</p>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    {mockProgress.map((p, i) => (
                                        <div key={p.week} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                            <span style={{ fontSize: "0.7rem", color: "#aaa", width: 48, flexShrink: 0 }}>{p.week}</span>
                                            <div style={{ flex: 1, height: 4, background: "#f0f0f0", borderRadius: 2 }}>
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${p.avgScore}%` }}
                                                    transition={{ delay: 0.4 + i * 0.1, duration: 0.5, ease: "easeOut" }}
                                                    style={{ height: 4, background: "var(--red)", borderRadius: 2 }}
                                                />
                                            </div>
                                            <span style={{ fontSize: "0.75rem", fontWeight: 700, width: 28, textAlign: "right" }}>{p.avgScore}</span>
                                        </div>
                                    ))}
                                </div>
                                <p style={{ fontSize: "0.72rem", color: "#10b981", marginTop: "0.6rem", display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 600 }}>
                                    <TrendingUp size={11} /> +15 pts over 5 weeks
                                </p>
                            </motion.div>

                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
