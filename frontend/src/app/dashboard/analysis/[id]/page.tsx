"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
    Activity,
    ArrowLeft,
    FileVideo,
    Info,
    Play,
} from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import { fetchWorkout, readLatestAnalysis, StoredAnalysis, VideoAnalysisResult, workoutToStoredAnalysis } from "@/lib/api";
import { formatExerciseName, localeFor, useI18n } from "@/lib/i18n";

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
        "elbows pinned",
        "elbows tucked",
        "knees",
        "deeper",
        "extension",
        "neutral spine",
        "chest up",
        "bar close",
    ].some((marker) => lower.includes(marker));
}

type RepBreakdown = NonNullable<VideoAnalysisResult["summary"]["rep_breakdown"]>;
type PreviewFrame = NonNullable<VideoAnalysisResult["preview_frames"]>[number];
type IssueFrame = { issue: string; frame: PreviewFrame };
type CorrectionRep = RepBreakdown[number] & { issueFrames: IssueFrame[] };

function buildRepBreakdownFromFrameLog(result: VideoAnalysisResult): RepBreakdown {
    const totalReps = result.summary.rep_count || 0;
    const frameLog = result.frame_log || [];
    if (totalReps <= 0) return [];
    if (!frameLog.length) return buildPlaceholderReps(totalReps);

    const activePhasesByExercise: Record<string, Set<string>> = {
        bicep_curl: new Set(["CURLING", "CONTRACTED", "LOWERING"]),
        squat: new Set(["DESCENDING", "BOTTOM", "ASCENDING"]),
        lunge: new Set(["DESCENDING", "BOTTOM", "ASCENDING"]),
        romanian_deadlift: new Set(["DESCENDING", "BOTTOM", "ASCENDING"]),
    };
    const activePhases = activePhasesByExercise[result.exercise] || activePhasesByExercise.bicep_curl;
    const reps: RepBreakdown = [];
    let current: {
        rep_number: number;
        start_frame: number | null;
        end_frame: number | null;
        start_ms: number | null;
        end_ms: number | null;
        frame_count: number;
        phases: Set<string>;
        issue_counts: Record<string, number>;
    } | null = null;
    let completedSeen = 0;

    for (const entry of frameLog) {
        if (entry.status !== "ok") continue;
        const phase = entry.phase || "";
        const repCount = entry.rep_count || 0;
        const isActive = activePhases.has(phase);

        if (!current && (isActive || repCount > completedSeen)) {
            current = {
                rep_number: repCount > completedSeen ? repCount : completedSeen + 1,
                start_frame: entry.frame_index,
                end_frame: entry.frame_index,
                start_ms: entry.timestamp_ms,
                end_ms: entry.timestamp_ms,
                frame_count: 0,
                phases: new Set(),
                issue_counts: {},
            };
        }

        if (current) {
            current.end_frame = entry.frame_index;
            current.end_ms = entry.timestamp_ms;
            current.frame_count += 1;
            if (phase) current.phases.add(phase);
            for (const issue of entry.problem_feedback?.length ? entry.problem_feedback : (entry.feedback || []).filter(isProblemFeedback)) {
                current.issue_counts[issue] = (current.issue_counts[issue] || 0) + 1;
            }
        }

        if (current && repCount > completedSeen) {
            current.rep_number = repCount;
            reps.push(finalizeClientRep(current, true));
            current = null;
            completedSeen = repCount;
        }
    }

    if (current) reps.push(finalizeClientRep(current, false));

    const existing = new Set(reps.filter((rep) => rep.completed).map((rep) => rep.rep_number));
    for (let repNumber = 1; repNumber <= totalReps; repNumber += 1) {
        if (!existing.has(repNumber)) reps.push(buildPlaceholderReps(1, repNumber)[0]);
    }

    return reps.sort((a, b) => a.rep_number - b.rep_number);
}

function finalizeClientRep(
    rep: {
        rep_number: number;
        start_frame: number | null;
        end_frame: number | null;
        start_ms: number | null;
        end_ms: number | null;
        frame_count: number;
        phases: Set<string>;
        issue_counts: Record<string, number>;
    },
    completed: boolean,
): RepBreakdown[number] {
    const duration_ms = rep.start_ms !== null && rep.end_ms !== null
        ? Math.max(0, rep.end_ms - rep.start_ms)
        : null;
    return {
        rep_number: rep.rep_number,
        completed,
        start_frame: rep.start_frame,
        end_frame: rep.end_frame,
        start_ms: rep.start_ms,
        end_ms: rep.end_ms,
        duration_ms,
        frame_count: rep.frame_count,
        phases: Array.from(rep.phases),
        issues: Object.keys(rep.issue_counts),
        issue_counts: rep.issue_counts,
        angle_stats: {},
    };
}

function buildPlaceholderReps(total: number, startAt = 1): RepBreakdown {
    return Array.from({ length: total }, (_, index) => ({
        rep_number: startAt + index,
        completed: true,
        start_frame: null,
        end_frame: null,
        start_ms: null,
        end_ms: null,
        duration_ms: null,
        frame_count: 0,
        phases: [],
        issues: [],
        issue_counts: {},
        angle_stats: {},
    }));
}

function buildCorrectionReps(result: VideoAnalysisResult, repBreakdown: RepBreakdown): CorrectionRep[] {
    const frames = (result.preview_frames || []).filter((frame) => {
        if (frame.status !== "ok") return false;
        const issues = frame.problem_feedback?.length
            ? frame.problem_feedback
            : (frame.feedback || []).filter(isProblemFeedback);
        return issues.length > 0;
    });

    return repBreakdown.map((rep) => {
        const issues = Array.from(new Set(rep.issues?.filter(isProblemFeedback) || []));
        const issueFrames = issues.map((issue) => {
            const frame = frames.find((candidate) => {
                const inRepWindow = rep.start_frame !== null && rep.end_frame !== null
                    ? candidate.frame_index >= rep.start_frame && candidate.frame_index <= rep.end_frame
                    : candidate.rep_count === rep.rep_number || candidate.rep_count === rep.rep_number - 1;
                if (!inRepWindow) return false;
                const frameIssues = candidate.problem_feedback?.length
                    ? candidate.problem_feedback
                    : (candidate.feedback || []).filter(isProblemFeedback);
                return frameIssues.includes(issue);
            });
            return { issue, frame };
        }).filter((item): item is { issue: string; frame: PreviewFrame } => Boolean(item.frame));
        return { ...rep, issueFrames };
    }).filter((rep) => rep.issueFrames.length > 0);
}

function countRepIssues(reps: CorrectionRep[]) {
    return reps.reduce((total, rep) => total + rep.issueFrames.length, 0);
}

function inferVideoDuration(result: VideoAnalysisResult, repBreakdown: RepBreakdown) {
    const timestamps = [
        ...repBreakdown.flatMap((rep) => [rep.start_ms, rep.end_ms]),
        ...(result.frame_log || []).map((frame) => frame.timestamp_ms),
        ...(result.preview_frames || []).map((frame) => frame.timestamp_ms),
    ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!timestamps.length) return null;
    return Math.max(...timestamps) / 1000;
}

export default function AnalysisPage() {
    const { t } = useI18n();
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
                    if (!persisted.result.summary.rep_breakdown?.length && matchingCached.result.summary.rep_breakdown?.length) {
                        persisted.result.summary.rep_breakdown = matchingCached.result.summary.rep_breakdown;
                    }
                }
                setAnalysis(persisted);
            })
            .catch((err) => {
                if (cancelled) return;
                setLoadError(err instanceof Error ? err.message : t("analysis.loadError"));
                if (!matchingCached) setAnalysis(null);
            });

        return () => {
            cancelled = true;
        };
    }, [params.id, t]);

    const result = analysis?.result;
    if (!analysis || !result) {
        return (
            <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "var(--font-ui)" }}>
                <DashboardNav />
                <main style={{ flex: 1, padding: "2rem 2.5rem" }}>
                    <div style={{ maxWidth: 760, margin: "0 auto", ...metricStyle, padding: "2rem" }}>
                        <Link href="/dashboard">
                            <button className="flex items-center gap-1.5 text-xs mb-3" style={{ color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                <ArrowLeft size={15} /> {t("analysis.back")}
                            </button>
                        </Link>
                        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2rem", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                            {t("analysis.notFound")}
                        </h1>
                        <p style={{ color: "#777", fontSize: "0.9rem", lineHeight: 1.6 }}>
                            {loadError || t("analysis.notFoundCopy").replace("{id}", params.id)}
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    const repBreakdown = result.summary.rep_breakdown?.length
        ? result.summary.rep_breakdown
        : buildRepBreakdownFromFrameLog(result);
    const correctionReps = buildCorrectionReps(result, repBreakdown);
    const issueCount = countRepIssues(correctionReps);
    const durationSeconds = inferVideoDuration(result, repBreakdown);

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "var(--font-ui)" }}>
            <DashboardNav />

            <main style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.75rem" }}>
                <div style={{ maxWidth: 1040, margin: "0 auto" }}>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                        <Link href="/dashboard">
                            <button className="flex items-center gap-1.5 text-xs mb-3" style={{ color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                <ArrowLeft size={15} /> {t("analysis.back")}
                            </button>
                        </Link>

                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.35rem" }}>
                                    {t("analysis.title")} {analysis.id}
                                </p>
                                <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.8rem", textTransform: "uppercase", lineHeight: 1, color: "var(--red)" }}>
                                    {formatExerciseName(result.exercise, t)} {t("analysis.report")}
                                </h1>
                                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                                    {analysis.fileName} · {new Date(analysis.analyzedAt).toLocaleString(localeFor(t))}
                                </p>
                            </div>

                            <Link href="/dashboard">
                                <button className="btn-red" style={{ padding: "0.75rem 1.2rem", fontSize: "0.75rem", borderRadius: 4 }}>
                                    <Play size={15} /> {t("analysis.another")}
                                </button>
                            </Link>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4"
                    >
                        <Metric label={t("common.reps")} value={result.summary.rep_count} color="var(--red)" />
                        <Metric label={t("common.duration")} value={durationSeconds === null ? t("common.none") : `${Math.round(durationSeconds)}s`} color="var(--navy)" />
                        <Metric label={t("common.issues")} value={issueCount} color="#f59e0b" />
                    </motion.div>

                    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 mb-4 items-start">
                        <motion.section
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                                <FileVideo size={16} style={{ color: "var(--navy)" }} /> {t("analysis.errors")}
                                {correctionReps.length > 0 && (
                                    <span style={{ color: "#999", fontSize: "0.75rem", fontWeight: 500 }}>
                                        ({correctionReps.length} {t("common.reps").toLowerCase()})
                                    </span>
                                )}
                            </h2>
                            <div style={{ ...metricStyle, padding: "0.75rem" }}>
                                {correctionReps.length > 0 ? (
                                    <div className="grid gap-3">
                                        {correctionReps.map((rep) => {
                                            return (
                                                <div key={`rep-${rep.rep_number}-${rep.start_frame ?? "missing"}`} style={{ border: "1px solid #e8e8e8", borderRadius: 4, padding: "0.75rem", background: "#fafafa" }}>
                                                    <div style={{ fontSize: "0.78rem", color: "#777" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                                            <span style={{ fontWeight: 800, color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("analysis.rep")} {rep.rep_number}</span>
                                                            <span>{rep.duration_ms ? `${(rep.duration_ms / 1000).toFixed(1)}s` : rep.completed ? t("common.completed") : t("common.incomplete")}</span>
                                                        </div>
                                                        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                                            {rep.issueFrames.map(({ issue, frame }) => (
                                                                <figure key={`${rep.rep_number}-${issue}`} style={{ border: "1px solid #e8e8e8", borderRadius: 4, overflow: "hidden", background: "#fff" }}>
                                                                    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#111" }}>
                                                                        <Image
                                                                            src={frame.image}
                                                                            alt={`${t("analysis.rep")} ${rep.rep_number} ${t("common.issue")}`}
                                                                            fill
                                                                            unoptimized
                                                                            sizes="(max-width: 768px) 100vw, 320px"
                                                                            style={{ objectFit: "contain" }}
                                                                        />
                                                                    </div>
                                                                    <figcaption style={{ padding: "0.65rem", color: "#555", lineHeight: 1.35 }}>
                                                                        <span style={{ color: "var(--red)", fontWeight: 800 }}>{t("common.issue")}:</span> {issue}
                                                                    </figcaption>
                                                                </figure>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: "0.85rem", color: "#888", lineHeight: 1.6 }}>
                                        {t("analysis.noIssues")}
                                    </p>
                                )}
                            </div>
                        </motion.section>

                        <motion.section
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="lg:sticky lg:top-5"
                        >
                            <h2 className="font-bold text-base mb-2 flex items-center gap-2">
                                <Activity size={18} style={{ color: "var(--red)" }} /> {t("analysis.coaching")}
                            </h2>
                            <div style={{ ...metricStyle, padding: "0.9rem", maxHeight: "calc(100vh - 7rem)", overflowY: "auto" }}>
                                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                    <Info size={16} style={{ color: "var(--red)", marginTop: 2, flexShrink: 0 }} />
                                    <div>
                                        <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--red)", marginBottom: "0.5rem" }}>
                                            {result.llm.enabled ? t("analysis.pttCoaching") : t("analysis.recommendations")}
                                        </p>
                                        {result.llm.enabled && (
                                            <p style={{ fontSize: "0.72rem", color: "#999", marginBottom: "0.75rem" }}>
                                                {t("analysis.maxOutput")}: {result.llm.max_output_tokens ?? t("common.none")}
                                                {result.llm.finish_reason ? ` · ${t("analysis.finish")}: ${result.llm.finish_reason}` : ""}
                                                {result.llm.prompt_chars ? ` · ${t("analysis.prompt")}: ${result.llm.prompt_chars} ${t("analysis.chars")}` : ""}
                                            </p>
                                        )}
                                        <MarkdownContent content={result.llm.recommendations} emptyText={t("analysis.noCoaching")} />
                                        {result.llm.error && (
                                            <p style={{ color: "var(--red)", fontSize: "0.8rem", marginTop: "0.75rem" }}>{result.llm.error}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.section>
                    </div>
                </div>
            </main>
        </div>
    );
}

function MarkdownContent({ content, emptyText }: { content?: string; emptyText: string }) {
    const cleanedContent = stripVisibilityNotes(content || "");
    if (!cleanedContent.trim()) {
        return <p style={{ color: "#888", fontSize: "0.85rem" }}>{emptyText}</p>;
    }

    const lines = cleanedContent.split(/\r?\n/);
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

function stripVisibilityNotes(content: string) {
    const blocked = [
        "no person detected",
        "no pose",
        "move into frame",
        "move fully into frame",
        "can't see",
        "visibility",
        "waiting frame",
        "data quality",
    ];
    return content
        .split(/\r?\n/)
        .filter((line) => !blocked.some((phrase) => line.toLowerCase().includes(phrase)))
        .join("\n")
        .trim();
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
