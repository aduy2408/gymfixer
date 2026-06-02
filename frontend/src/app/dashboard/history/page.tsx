"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarClock, ChevronRight, History, RotateCcw } from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import { fetchWorkouts, WorkoutSession } from "@/lib/api";
import { formatExerciseName, formatStatus, localeFor, useI18n } from "@/lib/i18n";

const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 6,
};

export default function HistoryPage() {
    const { t } = useI18n();
    const [sessions, setSessions] = useState<WorkoutSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        fetchWorkouts(100)
            .then((data) => {
                if (!cancelled) setSessions(data);
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : t("history.loadError"));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [t]);

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "var(--font-ui)" }}>
            <DashboardNav />
            <main style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.75rem" }}>
                <div style={{ maxWidth: 980, margin: "0 auto" }}>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                        <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.35rem" }}>
                            {t("history.eyebrow")}
                        </p>
                        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.35rem" }}>
                            {t("history.title")}
                        </h1>
                        <p style={{ fontSize: "0.84rem", color: "#888" }}>
                            {t("history.copy")}
                        </p>
                    </motion.div>

                    {error && (
                        <div style={{ ...cardStyle, padding: "1rem", color: "var(--red)", marginBottom: "1rem", fontSize: "0.88rem" }}>
                            {error}
                        </div>
                    )}

                    <section style={{ ...cardStyle, padding: "0.85rem" }}>
                        <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                            <History size={17} style={{ color: "var(--red)" }} /> {t("common.sessions")}
                        </h2>

                        {loading ? (
                            <EmptyState text={t("history.loading")} />
                        ) : sessions.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                                {sessions.map((session) => (
                                    <Link key={session.id} href={`/dashboard/analysis/${session.id}`}>
                                        <article style={{ border: "1px solid #eee", borderRadius: 4, background: "#fafafa", padding: "0.85rem", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "0.75rem", alignItems: "center" }}>
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                                                    <p style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#333" }}>
                                                        {formatExerciseName(session.exercise, t)}
                                                    </p>
                                                    <span style={{ fontSize: "0.68rem", fontWeight: 800, color: session.status === "completed" ? "#10b981" : "var(--red)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                                        {formatStatus(session.status, t)}
                                                    </span>
                                                </div>
                                                <p style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "#888" }}>
                                                    <CalendarClock size={13} />
                                                    {new Date(session.completed_at || session.created_at).toLocaleString(localeFor(t))}
                                                </p>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
                                                <SmallMetric label={t("common.reps")} value={session.summary?.rep_count ?? 0} />
                                                <SmallMetric label={t("common.quality")} value={formatQuality(session.summary?.analysis_quality?.active_window_usable_ratio, t)} />
                                                <ChevronRight size={18} style={{ color: "#aaa" }} />
                                            </div>
                                        </article>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <EmptyState text={t("history.empty")} />
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}

function formatQuality(value: number | undefined, t: (key: string) => string) {
    if (value === undefined || value === null) return t("common.none");
    return `${Math.round(value * 100)}%`;
}

function SmallMetric({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={{ minWidth: 56, textAlign: "right" }}>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.15rem", color: "var(--red)", lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: "0.62rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "0.25rem" }}>{label}</p>
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
