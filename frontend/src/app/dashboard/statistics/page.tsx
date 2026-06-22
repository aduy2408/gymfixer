"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Dumbbell, History, RotateCcw } from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import { AnalyticsSummary, fetchAnalyticsSummary } from "@/lib/api";
import { translateFeedbackText } from "@/lib/feedbackText";
import { formatExerciseName, formatStatus, useI18n } from "@/lib/i18n";

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
    const { language, t } = useI18n();
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const rightRailRef = useRef<HTMLElement | null>(null);
    const [rightRailHeight, setRightRailHeight] = useState<number | null>(null);
    const [isDesktopGrid, setIsDesktopGrid] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetchAnalyticsSummary()
            .then((data) => {
                if (!cancelled) setAnalytics(data);
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : t("stats.loadError"));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [t]);

    useEffect(() => {
        const node = rightRailRef.current;
        if (!node || typeof ResizeObserver === "undefined") {
            return;
        }
        const observer = new ResizeObserver(([entry]) => {
            setRightRailHeight(Math.round(entry.contentRect.height));
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const media = window.matchMedia("(min-width: 1024px)");
        const update = () => setIsDesktopGrid(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    const issueGroups = useMemo(() => {
        const grouped = analytics?.rep_issues_by_exercise || {};
        const rows = Object.entries(grouped)
            .map(([exercise, issues]) => {
                const entries = Object.entries(issues)
                    .filter(([item]) => isProblemFeedback(item))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3);
                const total = entries.reduce((sum, [, count]) => sum + count, 0);
                return { exercise, entries, total };
            })
            .filter((group) => group.entries.length > 0)
            .sort((a, b) => b.total - a.total);
        if (rows.length > 0) {
            return rows;
        }
        const fallbackEntries = Object.entries(analytics?.top_rep_issues || analytics?.top_failures || {})
            .filter(([item]) => isProblemFeedback(item))
            .slice(0, 8);
        return fallbackEntries.length
            ? [{ exercise: "all", entries: fallbackEntries, total: fallbackEntries.reduce((sum, [, count]) => sum + count, 0) }]
            : [];
    }, [analytics]);

    const maxIssueCount = Math.max(1, ...issueGroups.flatMap((group) => group.entries.map(([, count]) => count)));
    const exerciseRows = Object.keys(analytics?.sessions_by_exercise || {}).sort(
        (a, b) => (analytics?.sessions_by_exercise[b] ?? 0) - (analytics?.sessions_by_exercise[a] ?? 0)
    );
    const recentSessions = (analytics?.recent_sessions || []).filter((session) => session.status === "completed");
    const completedSessions = analytics?.completed_sessions ?? analytics?.total_sessions ?? 0;
    const issueCardMaxHeight = isDesktopGrid && rightRailHeight ? Math.max(420, rightRailHeight) : undefined;

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Barlow', sans-serif" }}>
            <DashboardNav />
            <main style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
                <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                        <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.35rem" }}>
                            {t("stats.eyebrow")}
                        </p>
                        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2.25rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.35rem" }}>
                            {t("stats.title")}
                        </h1>
                        <p style={{ fontSize: "0.84rem", color: "#888" }}>
                            {t("stats.copy")}
                        </p>
                    </motion.div>

                    {error && (
                        <div style={{ ...cardStyle, padding: "1rem", color: "var(--red)", marginBottom: "1rem", fontSize: "0.88rem" }}>
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <Metric label={t("stats.completedSessions")} value={loading ? "..." : completedSessions} />
                        <Metric label={t("common.reps")} value={loading ? "..." : analytics?.total_reps ?? 0} />
                        <Metric label={t("stats.exerciseTypes")} value={loading ? "..." : exerciseRows.length} />
                        <Metric label={t("stats.aiCoached")} value={loading ? "..." : analytics?.llm_enabled_count ?? 0} />
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <motion.section
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    ...cardStyle,
                                    padding: "1.25rem",
                                    maxHeight: issueCardMaxHeight,
                                    display: "flex",
                                    flexDirection: "column",
                                    overflow: "hidden",
                                }}
                            >
                                <h2 className="font-bold text-base mb-4 flex items-center gap-2">
                                    <AlertTriangle size={17} style={{ color: "#f59e0b" }} /> {t("stats.commonIssues")}
                                </h2>
                                {issueGroups.length > 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto", minHeight: 0, paddingRight: "0.25rem" }}>
                                        {issueGroups.map((group) => (
                                            <div key={group.exercise} style={{ border: "1px solid #eee", borderRadius: 4, padding: "0.85rem", background: "#fafafa" }}>
                                                <p style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555", marginBottom: "0.65rem" }}>
                                                    {group.exercise === "all" ? t("stats.commonIssues") : formatExerciseName(group.exercise, t)}
                                                </p>
                                                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                                    {group.entries.map(([issue, count]) => (
                                                        <div key={`${group.exercise}-${issue}`}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.35rem" }}>
                                                                <p style={{ fontSize: "0.86rem", color: "#444", lineHeight: 1.35 }}>{translateFeedbackText(issue, language)}</p>
                                                                <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--red)", whiteSpace: "nowrap" }}>{count} {t("stats.repOccurrences")}</span>
                                                            </div>
                                                            <div style={{ height: 7, background: "#f0f0f0", borderRadius: 999, overflow: "hidden" }}>
                                                                <div style={{ height: "100%", width: `${Math.max(8, (count / maxIssueCount) * 100)}%`, background: "var(--red)" }} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState text={t("stats.noIssues")} />
                                )}
                            </motion.section>

                        </div>

                        <aside ref={rightRailRef} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <section style={{ ...cardStyle, padding: "1rem" }}>
                                <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                                    <Dumbbell size={16} style={{ color: "var(--navy)" }} /> {t("stats.exercises")}
                                </h2>
                                {exerciseRows.length > 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                                        {exerciseRows.map((exercise) => (
                                            <div key={exercise} style={{ border: "1px solid #eee", borderRadius: 4, padding: "0.75rem", background: "#fafafa" }}>
                                                <p style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555", marginBottom: "0.45rem" }}>
                                                    {formatExerciseName(exercise, t)}
                                                </p>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                                                    <SmallMetric label={t("common.sessions")} value={analytics?.sessions_by_exercise[exercise] ?? 0} />
                                                    <SmallMetric label={t("common.reps")} value={analytics?.reps_by_exercise[exercise] ?? 0} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState text={t("stats.noExercise")} />
                                )}
                            </section>

                            <section style={{ ...cardStyle, padding: "1rem" }}>
                                <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                                    <History size={16} style={{ color: "var(--red)" }} /> {t("stats.recent")}
                                </h2>
                                {recentSessions.length ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                                        {recentSessions.map((session) => (
                                            <Link key={session.id} href={`/dashboard/analysis/${session.id}`}>
                                                <div style={{ border: "1px solid #eee", borderRadius: 4, padding: "0.7rem", background: "#fafafa", cursor: "pointer" }}>
                                                    <p style={{ fontSize: "0.78rem", fontWeight: 800, color: "#444", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                                        {formatExerciseName(session.exercise, t)}
                                                    </p>
                                                    <p style={{ fontSize: "0.72rem", color: "#999", marginTop: "0.25rem" }}>
                                                        {session.summary?.rep_count ?? 0} {t("common.reps").toLowerCase()} · {formatStatus(session.status, t)}
                                                    </p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState text={t("stats.noRecent")} />
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
