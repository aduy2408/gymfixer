"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    BarChart2,
    FileVideo,
    Info,
    Play,
} from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import { readLatestAnalysis, StoredAnalysis } from "@/lib/api";

type ChartRow = {
    frame: number;
} & Record<string, number>;

const metricStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 6,
    padding: "1rem",
};

const lineColors = ["#ef4444", "var(--navy)", "var(--red)", "#10b981", "#f59e0b", "#6366f1"];

function isProblemFeedback(item: string) {
    const lower = item.toLowerCase();
    return !["good", "great", "nice", "excellent", "strong"].some((word) => lower.includes(word));
}

export default function AnalysisPage() {
    const params = useParams<{ id: string }>();
    const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setAnalysis(readLatestAnalysis());
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    const result = analysis?.result;
    const chartData = useMemo<ChartRow[]>(() => {
        if (!result?.frame_log) return [];
        return result.frame_log
            .filter((frame) => frame.angles)
            .slice(0, 160)
            .map((frame) => ({
                frame: frame.frame_index,
                ...frame.angles,
            }));
    }, [result]);

    const angleKeys = useMemo(() => {
        const keys = new Set<string>();
        chartData.forEach((row) => {
            Object.keys(row).forEach((key) => {
                if (key !== "frame") keys.add(key);
            });
        });
        return Array.from(keys);
    }, [chartData]);

    if (!analysis || !result) {
        return (
            <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Barlow', sans-serif" }}>
                <DashboardNav />
                <main style={{ flex: 1, padding: "2rem 2.5rem" }}>
                    <div style={{ maxWidth: 760, margin: "0 auto", ...metricStyle, padding: "2rem" }}>
                        <Link href="/dashboard">
                            <button className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                <ArrowLeft size={15} /> Back to Dashboard
                            </button>
                        </Link>
                        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                            No Analysis Found
                        </h1>
                        <p style={{ color: "#777", fontSize: "0.9rem", lineHeight: 1.6 }}>
                            Run a video analysis from the dashboard first. Analysis id requested: {params.id}.
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    const qualityRatio = result.summary.analysis_quality?.active_window_usable_ratio;
    const qualityScore = qualityRatio === undefined
        ? Math.round((result.summary.frames_analyzed / Math.max(1, result.summary.frames_received)) * 100)
        : Math.round(qualityRatio * 100);
    const topFeedback = Object.entries(result.summary.top_feedback || {}).slice(0, 6);
    const previewFrames = result.preview_frames || [];
    const problemFeedback = Object.entries(result.summary.top_feedback || {})
        .filter(([item]) => isProblemFeedback(item))
        .slice(0, 8);

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Barlow', sans-serif" }}>
            <DashboardNav />

            <main style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
                <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                        <Link href="/dashboard">
                            <button className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                <ArrowLeft size={15} /> Back to Dashboard
                            </button>
                        </Link>

                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.35rem" }}>
                                    Analysis {analysis.id}
                                </p>
                                <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2.4rem", textTransform: "uppercase", lineHeight: 1, color: "var(--red)" }}>
                                    {result.exercise.replace("_", " ")} Report
                                </h1>
                                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                                    {analysis.fileName} · {new Date(analysis.analyzedAt).toLocaleString()}
                                </p>
                            </div>

                            <Link href="/dashboard">
                                <button className="btn-red" style={{ padding: "0.75rem 1.2rem", fontSize: "0.75rem", borderRadius: 4 }}>
                                    <Play size={15} /> Analyse Another
                                </button>
                            </Link>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
                    >
                        <Metric label="Quality" value={`${qualityScore}%`} color={qualityScore >= 80 ? "#10b981" : qualityScore >= 60 ? "#f59e0b" : "var(--red)"} />
                        <Metric label="Reps" value={result.summary.rep_count} color="var(--red)" />
                        <Metric label="Frames Analysed" value={result.summary.frames_analyzed} color="var(--navy)" />
                        <Metric label="Processing" value={`${Math.round(result.summary.processing_ms / 1000)}s`} color="#f59e0b" />
                    </motion.div>

                    <div className="grid md:grid-cols-5 gap-6 mb-8">
                        <motion.section
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="md:col-span-2"
                        >
                            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                                <FileVideo size={16} style={{ color: "var(--navy)" }} /> Skeleton Preview
                                {previewFrames.length > 0 && (
                                    <span style={{ color: "#999", fontSize: "0.75rem", fontWeight: 500 }}>
                                        ({previewFrames.length} frames)
                                    </span>
                                )}
                            </h2>
                            <div style={{ ...metricStyle, padding: "0.75rem" }}>
                                {previewFrames.length > 0 ? (
                                    <div className="grid gap-3">
                                        {previewFrames.map((frame) => (
                                            <figure key={`${frame.frame_index}-${frame.status}`} style={{ border: "1px solid #e8e8e8", borderRadius: 4, overflow: "hidden", background: "#fafafa" }}>
                                                <img src={frame.image} alt={`Frame ${frame.frame_index}`} style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "contain", background: "#111" }} />
                                                <figcaption style={{ padding: "0.65rem", fontSize: "0.72rem", color: "#777" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", marginBottom: frame.feedback?.length ? "0.35rem" : 0 }}>
                                                        <span>Frame {frame.frame_index}</span>
                                                        <span>{frame.phase || frame.status}</span>
                                                    </div>
                                                    {frame.feedback?.length ? (
                                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                            {frame.feedback.map((item) => (
                                                                <span
                                                                    key={item}
                                                                    style={{
                                                                        color: isProblemFeedback(item) ? "var(--red)" : "#10b981",
                                                                        lineHeight: 1.35,
                                                                    }}
                                                                >
                                                                    {item}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </figcaption>
                                            </figure>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: "0.85rem", color: "#888", lineHeight: 1.6 }}>
                                        No preview frames were returned. Enable skeleton preview before running the next analysis.
                                    </p>
                                )}
                            </div>
                        </motion.section>

                        <motion.section
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="md:col-span-3"
                        >
                            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                                <BarChart2 size={16} style={{ color: "var(--red)" }} /> Joint Angles
                            </h2>
                            <div style={{ ...metricStyle, height: 320, marginBottom: "1rem" }}>
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="frame" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                                            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} domain={[0, 180]} />
                                            <Tooltip />
                                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                                            {angleKeys.map((key, index) => (
                                                <Line key={key} type="monotone" dataKey={key} stroke={lineColors[index % lineColors.length]} strokeWidth={2} dot={false} />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "0.85rem" }}>
                                        No usable angle frames were returned.
                                    </div>
                                )}
                            </div>

                            <div style={{ ...metricStyle, padding: "1rem" }}>
                                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                                    <AlertTriangle size={15} style={{ color: "#f59e0b" }} /> Form Issues
                                </h3>
                                {problemFeedback.length > 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                        {problemFeedback.map(([item, count]) => (
                                            <div key={item} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", fontSize: "0.85rem", color: "#555" }}>
                                                <span style={{ color: "var(--red)", fontWeight: 800, minWidth: 36 }}>{count}x</span>
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: "#888", fontSize: "0.85rem" }}>No repeated form issues were detected in usable frames.</p>
                                )}
                            </div>

                            <div style={{ ...metricStyle, padding: "1rem", marginTop: "1rem" }}>
                                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                                    <Info size={15} style={{ color: "var(--navy)" }} /> All Feedback
                                </h3>
                                {topFeedback.length > 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                        {topFeedback.map(([item, count]) => (
                                            <div key={item} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", fontSize: "0.85rem", color: "#555" }}>
                                                <span style={{ color: isProblemFeedback(item) ? "var(--red)" : "#10b981", fontWeight: 800, minWidth: 36 }}>{count}x</span>
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: "#888", fontSize: "0.85rem" }}>No recurring feedback was detected.</p>
                                )}
                            </div>
                        </motion.section>
                    </div>

                    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Activity size={18} style={{ color: "var(--red)" }} /> Coaching
                        </h2>
                        <div style={{ ...metricStyle, padding: "1.25rem" }}>
                            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                <Info size={16} style={{ color: "var(--red)", marginTop: 2, flexShrink: 0 }} />
                                <div>
                                    <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--red)", marginBottom: "0.5rem" }}>
                                        {result.llm.enabled ? `Gemini ${result.llm.model}` : "Rule-based Recommendations"}
                                    </p>
                                    <div style={{ whiteSpace: "pre-wrap", color: "#555", fontSize: "0.9rem", lineHeight: 1.7 }}>
                                        {result.llm.recommendations}
                                    </div>
                                    {result.llm.error && (
                                        <p style={{ color: "var(--red)", fontSize: "0.8rem", marginTop: "0.75rem" }}>{result.llm.error}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.section>
                </div>
            </main>
        </div>
    );
}

function Metric({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div style={metricStyle}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", lineHeight: 1, color }}>
                {value}
            </p>
            <p style={{ fontSize: "0.7rem", color: "#999", marginTop: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {label}
            </p>
        </div>
    );
}
