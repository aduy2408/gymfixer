"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Activity, Search, ChevronRight } from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import { mockUploads } from "@/lib/mockData";

const scoreColor = (s: number | null) =>
    s === null ? "#bbb" : s >= 85 ? "#10b981" : s >= 70 ? "#f59e0b" : "var(--red)";

const exerciseEmoji: Record<string, string> = {
    "Squat": "🏋️", "Deadlift": "💪", "Push-up": "🤸", "Lunge": "🦵",
    "Bench Press": "💺", "Overhead Press": "⬆️", "Pull-up": "🔄",
};

export default function HistoryPage() {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "completed" | "processing">("all");

    const filtered = mockUploads.filter((u) => {
        const matchSearch =
            u.exercise.toLowerCase().includes(search.toLowerCase()) ||
            u.filename.toLowerCase().includes(search.toLowerCase());
        const matchStatus = filter === "all" || u.status === filter;
        return matchSearch && matchStatus;
    });

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Barlow', sans-serif" }}>
            <DashboardNav />
            <main style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
                <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

                        <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "0.4rem" }}>All Sessions</p>
                        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.4rem" }}>
                            UPLOAD HISTORY
                        </h1>
                        <p style={{ fontSize: "0.82rem", color: "#999", fontWeight: 300, marginBottom: "2rem" }}>
                            {mockUploads.length} workout analyses total
                        </p>

                        {/* Search + filter bar */}
                        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", alignItems: "center" }}>
                            <div style={{ position: "relative", flex: 1 }}>
                                <Search size={14} color="#bbb" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search exercise or filename…"
                                    style={{
                                        width: "100%",
                                        paddingLeft: "2.25rem",
                                        paddingRight: "1rem",
                                        paddingTop: "0.65rem",
                                        paddingBottom: "0.65rem",
                                        background: "#fff",
                                        border: "1px solid #e8e8e8",
                                        borderRadius: 4,
                                        fontSize: "0.85rem",
                                        color: "#333",
                                        outline: "none",
                                    }}
                                />
                            </div>
                            <div style={{ display: "flex", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8", borderRadius: 4, overflow: "hidden" }}>
                                {(["all", "completed", "processing"] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        style={{
                                            padding: "0.6rem 1rem",
                                            background: filter === f ? "var(--red)" : "#fff",
                                            color: filter === f ? "#fff" : "#666",
                                            border: "none",
                                            fontSize: "0.75rem",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.06em",
                                            cursor: "pointer",
                                            transition: "background 0.12s",
                                        }}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* List */}
                        {filtered.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "4rem 0", border: "1px solid #e8e8e8", background: "#fff", borderRadius: 4 }}>
                                <Activity size={28} color="#ddd" style={{ margin: "0 auto 0.75rem" }} />
                                <p style={{ color: "#bbb", fontSize: "0.875rem" }}>No sessions found</p>
                            </div>
                        ) : (
                            <div style={{ border: "1px solid #e8e8e8", display: "flex", flexDirection: "column" }}>
                                {filtered.map((u, i) => (
                                    <motion.div
                                        key={u.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.06 }}
                                    >
                                        <Link href={u.status === "completed" ? `/dashboard/analysis/${u.id}` : "#"}>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "1rem",
                                                    padding: "1rem 1.1rem",
                                                    background: "#fff",
                                                    borderBottom: i < filtered.length - 1 ? "1px solid #f0f0f0" : "none",
                                                    cursor: "pointer",
                                                    transition: "background 0.12s",
                                                }}
                                                onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.background = "#fafafa"}
                                                onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.background = "#fff"}
                                            >
                                                {/* Icon */}
                                                <div style={{ width: 40, height: 40, borderRadius: 4, background: "#f2f2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
                                                    {exerciseEmoji[u.exercise] ?? "💪"}
                                                </div>

                                                {/* Info */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.15rem" }}>{u.exercise}</p>
                                                    <p style={{ fontSize: "0.75rem", color: "#aaa", fontWeight: 300, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        {u.filename} · {u.duration} · {new Date(u.uploadedAt).toLocaleDateString()}
                                                    </p>
                                                </div>

                                                {/* Score / status */}
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                                                    {u.status === "completed" && u.score !== null ? (
                                                        <div style={{ textAlign: "right" }}>
                                                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.5rem", color: scoreColor(u.score), lineHeight: 1 }}>{u.score}</p>
                                                            <p style={{ fontSize: "0.65rem", color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em" }}>score</p>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#f59e0b", background: "rgba(245,158,11,0.08)", padding: "0.2rem 0.6rem", borderRadius: 3 }}>Processing</span>
                                                    )}
                                                    <ChevronRight size={14} color="#ddd" />
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
