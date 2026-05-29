"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
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
import { fetchWorkout, readLatestAnalysis, StoredAnalysis, workoutToStoredAnalysis } from "@/lib/api";

const metricStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 6,
    padding: "0.75rem",
};

function isProblemFeedback(item: string) {
    const lower = item.toLowerCase();
    if ([
        "hold still",
        "starting analysis",
        "move into frame",
        "move fully into frame",
        "can't see",
        "ready for the next",
        "curl up",
        "squeeze at the top",
        "good",
        "great",
        "nice",
        "excellent",
        "strong",
    ].some((phrase) => lower.includes(phrase))) {
        return false;
    }
    return [
        "don't",
        "avoid",
        "too ",
        "short",
        "caving",
        "collapse",
        "lean",
        "shrug",
        "flare",
        "travel forward",
        "wrist neutral",
        "elbows pinned",
        "elbows tucked",
        "knees",
        "deeper",
        "extension",
        "neutral spine",
        "chest up",
    ].some((marker) => lower.includes(marker));
}

export default function AnalysisPage() {
    const params = useParams<{ id: string }>();
    const [analysis, setAnalysis] = useState<StoredAnalysis | null>(() => {
        const cached = readLatestAnalysis();
        return cached?.id === params.id ? cached : null;
    });
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        let cancelled = false;
        const cached = readLatestAnalysis();
        const matchingCached = cached?.id === params.id ? cached : null;

        fetchWorkout(params.id)
            .then((workout) => {
                if (cancelled) return;
                const persisted = workoutToStoredAnalysis(workout);
                if (matchingCached) {
                    persisted.result.frame_log = matchingCached.result.frame_log;
                    persisted.result.preview_frames = matchingCached.result.preview_frames;
                }
                setAnalysis(persisted);
            })
            .catch((err) => {
                if (cancelled) return;
                setLoadError(err instanceof Error ? err.message : "Could not load analysis.");
                if (!matchingCached) setAnalysis(null);
            });

        return () => {
            cancelled = true;
        };
    }, [params.id]);

    const result = analysis?.result;
    if (!analysis || !result) {
        return (
            <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "var(--font-ui)" }}>
                <DashboardNav />
                <main style={{ flex: 1, padding: "2rem 2.5rem" }}>
                    <div style={{ maxWidth: 760, margin: "0 auto", ...metricStyle, padding: "2rem" }}>
                        <Link href="/dashboard">
                            <button className="flex items-center gap-1.5 text-xs mb-3" style={{ color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                <ArrowLeft size={15} /> Back to Dashboard
                            </button>
                        </Link>
                        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2rem", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                            No Analysis Found
                        </h1>
                        <p style={{ color: "#777", fontSize: "0.9rem", lineHeight: 1.6 }}>
                            {loadError || `Run a video analysis from the dashboard first. Analysis id requested: ${params.id}.`}
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
    const mistakeFrames = result.preview_frames || [];
    const angleStats = Object.entries(result.summary.angle_stats || {}).slice(0, 8);
    const formIssues = Object.keys(result.summary.top_feedback || {})
        .filter(isProblemFeedback)
        .slice(0, 8);

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "var(--font-ui)" }}>
            <DashboardNav />

            <main style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.75rem" }}>
                <div style={{ maxWidth: 1040, margin: "0 auto" }}>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                        <Link href="/dashboard">
                            <button className="flex items-center gap-1.5 text-xs mb-3" style={{ color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                <ArrowLeft size={15} /> Back to Dashboard
                            </button>
                        </Link>

                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.35rem" }}>
                                    Analysis {analysis.id}
                                </p>
                                <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.8rem", textTransform: "uppercase", lineHeight: 1, color: "var(--red)" }}>
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
                        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4"
                    >
                        <Metric label="Quality" value={`${qualityScore}%`} color={qualityScore >= 80 ? "#10b981" : qualityScore >= 60 ? "#f59e0b" : "var(--red)"} />
                        <Metric label="Reps" value={result.summary.rep_count} color="var(--red)" />
                        <Metric label="Frames Analysed" value={result.summary.frames_analyzed} color="var(--navy)" />
                        <Metric label="Processing" value={`${Math.round(result.summary.processing_ms / 1000)}s`} color="#f59e0b" />
                        <Metric label="View" value={(result.summary.camera_view || result.camera_view || "side").replace("_", " ")} color="#555" />
                        <Metric label="Backend" value={result.summary.pose_backend || result.pose_backend || "mediapipe"} color="#555" />
                    </motion.div>

                    <div className="grid md:grid-cols-5 gap-4 mb-4">
                        <motion.section
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="md:col-span-2"
                        >
                            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                                <FileVideo size={16} style={{ color: "var(--navy)" }} /> Key Correction Frames
                                {mistakeFrames.length > 0 && (
                                    <span style={{ color: "#999", fontSize: "0.75rem", fontWeight: 500 }}>
                                        ({mistakeFrames.length} frames)
                                    </span>
                                )}
                            </h2>
                            <div style={{ ...metricStyle, padding: "0.75rem" }}>
                                {mistakeFrames.length > 0 ? (
                                    <div className="grid gap-3">
                                        {mistakeFrames.map((frame) => (
                                            <figure key={`${frame.frame_index}-${frame.status}`} style={{ border: "1px solid #e8e8e8", borderRadius: 4, overflow: "hidden", background: "#fafafa" }}>
                                                <img src={frame.image} alt={`Frame ${frame.frame_index}`} style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "contain", background: "#111" }} />
                                                <figcaption style={{ padding: "0.65rem", fontSize: "0.72rem", color: "#777" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", marginBottom: frame.feedback?.length ? "0.35rem" : 0 }}>
                                                        <span>Frame {frame.frame_index}</span>
                                                        <span>{frame.preview_reason === "new_issue" ? "new issue" : frame.phase || frame.status}</span>
                                                    </div>
                                                    {frame.feedback?.length ? (
                                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                            {(frame.problem_feedback?.length ? frame.problem_feedback : (frame.feedback || []).filter(isProblemFeedback)).map((item) => (
                                                                <span
                                                                    key={item}
                                                                    style={{ color: "var(--red)", lineHeight: 1.35 }}
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
                                        No key correction frames were returned. Enable skeleton preview before running the next analysis.
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
                            <h2 className="font-bold text-sm mb-2 flex items-center gap-2">
                                <BarChart2 size={16} style={{ color: "var(--red)" }} /> Joint Angles
                            </h2>
                            <div style={{ ...metricStyle, padding: "1rem", marginBottom: "1rem" }}>
                                {angleStats.length > 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {angleStats.map(([name, stats]) => (
                                            <div key={name} style={{ border: "1px solid #eee", borderRadius: 4, padding: "0.8rem", background: "#fafafa" }}>
                                                <p style={{ fontSize: "0.72rem", color: "#777", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: "0.55rem" }}>
                                                    {name.replaceAll("_", " ")}
                                                </p>
                                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                                                    <AngleValue label="Min" value={stats.min} />
                                                    <AngleValue label="Avg" value={stats.avg} emphasis />
                                                    <AngleValue label="Max" value={stats.max} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: "#888", fontSize: "0.85rem" }}>No usable angle stats were returned.</p>
                                )}
                            </div>

                            <div style={{ ...metricStyle, padding: "0.75rem" }}>
                                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                                    <AlertTriangle size={15} style={{ color: "#f59e0b" }} /> Form Issues
                                </h3>
                                {formIssues.length > 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                                        {formIssues.map((item) => (
                                            <div key={item} style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", fontSize: "0.88rem", color: "#555", lineHeight: 1.45 }}>
                                                <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--red)", marginTop: "0.43rem", flexShrink: 0 }} />
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: "#888", fontSize: "0.85rem" }}>No reliable form issues were detected in usable frames.</p>
                                )}
                            </div>
                        </motion.section>
                    </div>

                    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                        <h2 className="font-bold text-base mb-2 flex items-center gap-2">
                            <Activity size={18} style={{ color: "var(--red)" }} /> Coaching
                        </h2>
                        <div style={{ ...metricStyle, padding: "0.9rem" }}>
                            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                <Info size={16} style={{ color: "var(--red)", marginTop: 2, flexShrink: 0 }} />
                                <div>
                                    <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--red)", marginBottom: "0.5rem" }}>
                                        {result.llm.enabled ? `Gemini ${result.llm.model}` : "Recommendations"}
                                    </p>
                                    {result.llm.enabled && (
                                        <p style={{ fontSize: "0.72rem", color: "#999", marginBottom: "0.75rem" }}>
                                            Max output: {result.llm.max_output_tokens ?? "n/a"}
                                            {result.llm.finish_reason ? ` · Finish: ${result.llm.finish_reason}` : ""}
                                            {result.llm.prompt_chars ? ` · Prompt: ${result.llm.prompt_chars} chars` : ""}
                                        </p>
                                    )}
                                    <MarkdownContent content={result.llm.recommendations} />
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

function MarkdownContent({ content }: { content?: string }) {
    if (!content?.trim()) {
        return <p style={{ color: "#888", fontSize: "0.85rem" }}>No coaching recommendations were returned.</p>;
    }

    const lines = content.split(/\r?\n/);
    const blocks: React.ReactNode[] = [];
    let listItems: string[] = [];
    let listType: "ul" | "ol" | null = null;

    const flushList = () => {
        if (!listType || listItems.length === 0) return;
        const items = listItems.map((item, index) => <li key={index}>{renderInlineMarkdown(item)}</li>);
        blocks.push(
            listType === "ol" ? (
                <ol key={`ol-${blocks.length}`} style={{ margin: "0.45rem 0 0.75rem 1.15rem", paddingLeft: "0.5rem", lineHeight: 1.65 }}>
                    {items}
                </ol>
            ) : (
                <ul key={`ul-${blocks.length}`} style={{ margin: "0.45rem 0 0.75rem 1.15rem", paddingLeft: "0.5rem", lineHeight: 1.65 }}>
                    {items}
                </ul>
            )
        );
        listItems = [];
        listType = null;
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) {
            flushList();
            return;
        }

        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
            flushList();
            blocks.push(
                <h3 key={`h-${blocks.length}`} style={{ fontSize: heading[1].length === 1 ? "1rem" : "0.9rem", fontWeight: 800, color: "#222", margin: blocks.length ? "0.9rem 0 0.4rem" : "0 0 0.4rem" }}>
                    {renderInlineMarkdown(heading[2])}
                </h3>
            );
            return;
        }

        const unordered = line.match(/^[-*]\s+(.+)$/);
        if (unordered) {
            if (listType !== "ul") flushList();
            listType = "ul";
            listItems.push(unordered[1]);
            return;
        }

        const ordered = line.match(/^\d+[.)]\s+(.+)$/);
        if (ordered) {
            if (listType !== "ol") flushList();
            listType = "ol";
            listItems.push(ordered[1]);
            return;
        }

        flushList();
        blocks.push(
            <p key={`p-${blocks.length}`} style={{ margin: "0 0 0.65rem", lineHeight: 1.65 }}>
                {renderInlineMarkdown(line)}
            </p>
        );
    });

    flushList();

    return (
        <div style={{ color: "#4b5563", fontSize: "0.86rem", lineHeight: 1.6 }}>
            {blocks}
        </div>
    );
}

function renderInlineMarkdown(text: string) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={index} style={{ color: "#111", fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
    });
}

function Metric({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div style={metricStyle}>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.45rem", lineHeight: 1, color }}>
                {value}
            </p>
            <p style={{ fontSize: "0.7rem", color: "#999", marginTop: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {label}
            </p>
        </div>
    );
}

function AngleValue({ label, value, emphasis = false }: { label: string; value?: number; emphasis?: boolean }) {
    return (
        <div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: emphasis ? "1.45rem" : "1.15rem", lineHeight: 1, color: emphasis ? "var(--red)" : "#333" }}>
                {value === undefined ? "n/a" : `${Math.round(value)}°`}
            </p>
            <p style={{ fontSize: "0.62rem", color: "#999", marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
        </div>
    );
}
