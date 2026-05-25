"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Dumbbell, History, RotateCcw } from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import { AnalyticsSummary, fetchAnalyticsSummary } from "@/lib/api";

const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 6,
};

function isProblemFeedback(item: string) {
    const lower = item.toLowerCase();
    return ![
        "hold still",
        "move into frame",
        "can't see",
        "no person detected",
        "ready for the next",
        "curl up",
        "good",
        "great",
        "nice",
        "excellent",
        "strong",
    ].some((phrase) => lower.includes(phrase));
}

export default function StatisticsPage() {
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetchAnalyticsSummary()
            .then((data) => {
                if (!cancelled) setAnalytics(data);
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : "Could not load statistics.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const formIssues = useMemo(() => {
        return Object.entries(analytics?.top_feedback || {})
            .filter(([item]) => isProblemFeedback(item))
            .slice(0, 8);
    }, [analytics]);

    const maxIssueCount = Math.max(1, ...formIssues.map(([, count]) => count));
    const exerciseRows = Object.keys(analytics?.sessions_by_exercise || {});

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Barlow', sans-serif" }}>
            <DashboardNav />
            <main style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
                <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                        <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.35rem" }}>
                            Training data
                        </p>
                        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2.25rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.35rem" }}>
                            Statistics
                        </h1>
                        <p style={{ fontSize: "0.84rem", color: "#888" }}>
                            Common form issues and workout trends from your saved analyses.
                        </p>
                    </motion.div>

                    {error && (
                        <div style={{ ...cardStyle, padding: "1rem", color: "var(--red)", marginBottom: "1rem", fontSize: "0.88rem" }}>
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <Metric label="Sessions" value={loading ? "..." : analytics?.total_sessions ?? 0} />
                        <Metric label="Total Reps" value={loading ? "..." : analytics?.total_reps ?? 0} />
                        <Metric label="Avg Quality" value={analytics?.avg_quality_ratio == null ? "n/a" : `${Math.round(analytics.avg_quality_ratio * 100)}%`} />
                        <Metric label="Avg Processing" value={analytics?.avg_processing_ms == null ? "n/a" : `${Math.round(analytics.avg_processing_ms / 1000)}s`} />
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} style={{ ...cardStyle, padding: "1.25rem" }}>
                            <h2 className="font-bold text-base mb-4 flex items-center gap-2">
                                <AlertTriangle size={17} style={{ color: "#f59e0b" }} /> Most Common Form Issues
                            </h2>
                            {formIssues.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                                    {formIssues.map(([issue, count]) => (
                                        <div key={issue}>
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.35rem" }}>
                                                <p style={{ fontSize: "0.88rem", color: "#444", lineHeight: 1.35 }}>{issue}</p>
                                                <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--red)", whiteSpace: "nowrap" }}>{count} frames</span>
                                            </div>
                                            <div style={{ height: 7, background: "#f0f0f0", borderRadius: 999, overflow: "hidden" }}>
                                                <div style={{ height: "100%", width: `${Math.max(8, (count / maxIssueCount) * 100)}%`, background: "var(--red)" }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState text="No form issues have been recorded yet. Run a few video analyses first." />
                            )}
                        </motion.section>

                        <aside style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <section style={{ ...cardStyle, padding: "1rem" }}>
                                <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                                    <Dumbbell size={16} style={{ color: "var(--navy)" }} /> Exercises
                                </h2>
                                {exerciseRows.length > 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                                        {exerciseRows.map((exercise) => (
                                            <div key={exercise} style={{ border: "1px solid #eee", borderRadius: 4, padding: "0.75rem", background: "#fafafa" }}>
                                                <p style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555", marginBottom: "0.45rem" }}>
                                                    {exercise.replaceAll("_", " ")}
                                                </p>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                                                    <SmallMetric label="Sessions" value={analytics?.sessions_by_exercise[exercise] ?? 0} />
                                                    <SmallMetric label="Reps" value={analytics?.reps_by_exercise[exercise] ?? 0} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState text="No exercise history yet." />
                                )}
                            </section>

                            <section style={{ ...cardStyle, padding: "1rem" }}>
                                <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                                    <History size={16} style={{ color: "var(--red)" }} /> Recent Sessions
                                </h2>
                                {analytics?.recent_sessions?.length ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                                        {analytics.recent_sessions.map((session) => (
                                            <Link key={session.id} href={`/dashboard/analysis/${session.id}`}>
                                                <div style={{ border: "1px solid #eee", borderRadius: 4, padding: "0.7rem", background: "#fafafa", cursor: "pointer" }}>
                                                    <p style={{ fontSize: "0.78rem", fontWeight: 800, color: "#444", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                                        {session.exercise.replaceAll("_", " ")}
                                                    </p>
                                                    <p style={{ fontSize: "0.72rem", color: "#999", marginTop: "0.25rem" }}>
                                                        {session.summary?.rep_count ?? 0} reps · {session.status}
                                                    </p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState text="No recent sessions yet." />
                                )}
                            </section>
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    );
}

function Metric({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={{ ...cardStyle, padding: "1rem" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", lineHeight: 1, color: "var(--red)" }}>{value}</p>
            <p style={{ fontSize: "0.7rem", color: "#999", marginTop: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
        </div>
    );
}

function SmallMetric({ label, value }: { label: string; value: string | number }) {
    return (
        <div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.25rem", color: "var(--red)", lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: "0.64rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "0.2rem" }}>{label}</p>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", color: "#888", fontSize: "0.84rem", lineHeight: 1.5 }}>
            <RotateCcw size={14} />
            <span>{text}</span>
        </div>
    );
}
