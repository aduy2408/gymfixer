"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    BarChart2,
    FileVideo,
    Film,
    Loader2,
    Upload,
    X,
} from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import {
    analyzeVideo,
    AnalyticsSummary,
    CameraView,
    ExerciseId,
    fetchAnalyticsSummary,
    fetchSubscription,
    PoseBackend,
    saveLatestAnalysis,
    SubscriptionSummary,
    VideoAnalysisResult,
    logUsageEvent,
} from "@/lib/api";
import { tierLabel, translateKey, useI18n } from "@/lib/i18n";
import { mockProfile } from "@/lib/mockData";
import { recordMeaningfulAction } from "@/lib/feedbackPrompt";

const exerciseOptions: Array<{ id: ExerciseId; labelKey: string }> = [
    { id: "squat", labelKey: "dashboard.exercise.squat" },
    { id: "lunge", labelKey: "dashboard.exercise.lunge" },
    { id: "bicep_curl", labelKey: "dashboard.exercise.bicepCurl" },
    { id: "romanian_deadlift", labelKey: "dashboard.exercise.romanianDeadlift" },
    { id: "plank", labelKey: "dashboard.exercise.plank" },
];

// Camera view selector is intentionally disabled for now. The backend
// auto-detects the effective view per frame, including videos where the user
// rotates between side and front. To re-enable manual selection, restore this
// options array and the commented UI block in DashboardPage.
// const cameraViewOptions: Array<{ id: CameraView; labelKey?: string; label?: string }> = [
//     { id: "auto", labelKey: "dashboard.camera.auto" },
//     { id: "side", labelKey: "dashboard.camera.side" },
//     { id: "front", labelKey: "dashboard.camera.front" },
//     { id: "three_quarter", label: "45°" },
// ];

const DEFAULT_MAX_FRAMES = 240;
const DEFAULT_MISTAKE_FRAMES = 12;
const DEFAULT_SAMPLE_FPS = 8;

const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 6,
};

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.64rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "0.3rem",
    color: "#555",
};

export default function DashboardPage() {
    const router = useRouter();
    const { language, t } = useI18n();
    const fileRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [exercise, setExercise] = useState<ExerciseId>("squat");
    const cameraView: CameraView = "auto";
    const [poseBackend, setPoseBackend] = useState<PoseBackend>("mediapipe");
    const [callLlm, setCallLlm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [lastResult, setLastResult] = useState<VideoAnalysisResult | null>(null);
    const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [analyticsError, setAnalyticsError] = useState("");
    const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);

    useEffect(() => {
        void logUsageEvent("dashboard_viewed");
        let cancelled = false;
        fetchAnalyticsSummary()
            .then((data) => {
                if (!cancelled) setAnalytics(data);
            })
            .catch((err) => {
                if (!cancelled) setAnalyticsError(err instanceof Error ? err.message : t("dashboard.analyticsError"));
            });
        fetchSubscription()
            .then((data) => {
                if (!cancelled) setSubscription(data);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [t]);

    useEffect(() => {
        if (subscription && !subscription.features.ai_coaching && callLlm) {
            setCallLlm(false);
        }
        if (subscription && !subscription.features.vitpose && poseBackend === "vitpose") {
            setPoseBackend("mediapipe");
        }
    }, [subscription, callLlm, poseBackend]);

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        setDragOver(false);
        const nextFile = event.dataTransfer.files[0];
        if (nextFile?.type.startsWith("video/")) setFile(nextFile);
    }, []);

    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setFile(event.target.files?.[0] || null);
    };

    useEffect(() => {
        if (!file) {
            setVideoDurationSeconds(null);
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = objectUrl;
        video.onloadedmetadata = () => {
            setVideoDurationSeconds(Number.isFinite(video.duration) ? video.duration : null);
            URL.revokeObjectURL(objectUrl);
        };
        video.onerror = () => {
            setVideoDurationSeconds(null);
            URL.revokeObjectURL(objectUrl);
        };
        return () => {
            video.onloadedmetadata = null;
            video.onerror = null;
            URL.revokeObjectURL(objectUrl);
        };
    }, [file]);

    const handleAnalyze = async () => {
        if (!file || isLoading) return;

        setIsLoading(true);
        setError("");
        setLastResult(null);

        try {
            const result = await analyzeVideo({
                file,
                exercise,
                cameraView,
                poseBackend,
                callLlm,
                language,
                sampleFps: DEFAULT_SAMPLE_FPS,
                maxFrames: DEFAULT_MAX_FRAMES,
                includePreview: true,
                previewMaxFrames: DEFAULT_MISTAKE_FRAMES,
            });
            const id = result.session_id ? String(result.session_id) : `analysis_${Date.now()}`;
            saveLatestAnalysis({
                id,
                fileName: file.name,
                analyzedAt: new Date().toISOString(),
                result,
            });
            setLastResult(result);
            recordMeaningfulAction();
            fetchAnalyticsSummary().then(setAnalytics).catch(() => {});
            fetchSubscription().then(setSubscription).catch(() => {});
            router.push(`/dashboard/analysis/${id}`);
        } catch (err) {
            const maybeSub = (err as Error & { subscription?: SubscriptionSummary }).subscription;
            if (maybeSub) setSubscription(maybeSub);
            const code = (err as Error & { code?: string }).code || "";
            if (maybeSub || code) {
                void logUsageEvent("quota_error_shown", {
                    feature: "video_analysis",
                    code: code || "subscription_limit",
                    tier: maybeSub?.tier || null,
                    message_short: err instanceof Error ? err.message : t("dashboard.analysisFailed"),
                });
            }
            setError(err instanceof Error ? err.message : t("dashboard.analysisFailed"));
        } finally {
            setIsLoading(false);
        }
    };

    const fileSize = file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "";
    const issueCount = lastResult ? countRepIssues(lastResult.summary.rep_breakdown) : 0;

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "var(--font-ui)" }}>
            <DashboardNav />

            <main style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.75rem" }}>
                <div style={{ maxWidth: 1040, margin: "0 auto" }}>
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}
                    >
                        <div>
                            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.3rem" }}>
                                {t("dashboard.eyebrow")}
                            </p>
                            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.25rem" }}>
                                {t("dashboard.title")}
                            </h1>
                            <p style={{ fontSize: "0.82rem", color: "#888", fontWeight: 300 }}>
                                {t("dashboard.subtitle")} · {t("dashboard.goal")}: {translateKey(`dashboard.goal.${mockProfile.fitnessGoal}`, t, mockProfile.fitnessGoal)}
                            </p>
                        </div>
                    </motion.div>

                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ ...cardStyle, padding: "0.9rem", marginBottom: "1rem" }}
                    >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <Metric label={t("common.sessions")} value={analytics?.total_sessions ?? "0"} />
                            <Metric label={t("common.reps")} value={analytics?.total_reps ?? "0"} />
                            <Metric label={t("subscription.videoQuota")} value={formatRemaining(subscription?.remaining.video_analyses, subscription?.limits.video_analyses, t)} />
                        </div>
                        {analyticsError && (
                            <p style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "var(--red)" }}>{analyticsError}</p>
                        )}
                    </motion.section>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ ...cardStyle, padding: "0.9rem" }}>
                            <div
                                onClick={() => fileRef.current?.click()}
                                onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={onDrop}
                                style={{
                                    border: `2px dashed ${dragOver ? "var(--red)" : file ? "#ccc" : "#ddd"}`,
                                    borderRadius: 4,
                                    background: dragOver ? "rgba(214,0,28,0.03)" : "#fafafa",
                                    minHeight: 140,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    marginBottom: "0.9rem",
                                }}
                            >
                                <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={onFileChange} />
                                {file ? (
                                    <div style={{ textAlign: "center", padding: "1.5rem" }}>
                                        <Film size={36} color="#555" style={{ margin: "0 auto 0.75rem" }} />
                                        <p style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>{file.name}</p>
                                        <p style={{ fontSize: "0.78rem", color: "#999" }}>{fileSize}</p>
                                        <button
                                            onClick={(event) => { event.stopPropagation(); setFile(null); }}
                                            style={{ marginTop: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", padding: "0.3rem 0.75rem", border: "1px solid #ddd", borderRadius: 3, background: "#fff", cursor: "pointer", color: "#888" }}
                                        >
                                            <X size={11} /> {t("common.remove")}
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: "center", padding: "1.5rem" }}>
                                        <Upload size={36} color="#ccc" style={{ margin: "0 auto 0.75rem" }} />
                                        <p style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem", color: "#444" }}>{t("dashboard.drop")}</p>
                                        <p style={{ fontSize: "0.78rem", color: "#aaa" }}>{t("dashboard.browse")}</p>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: "0.9rem" }}>
                                <label style={labelStyle}>{t("dashboard.exercise")}</label>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8" }}>
                                    {exerciseOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setExercise(option.id)}
                                            style={{
                                                background: exercise === option.id ? "var(--red)" : "#fff",
                                                color: exercise === option.id ? "#fff" : "#444",
                                                border: "none",
                                                padding: "0.55rem 0.75rem",
                                                fontSize: "0.82rem",
                                                fontWeight: exercise === option.id ? 700 : 500,
                                                cursor: "pointer",
                                                textAlign: "left",
                                            }}
                                        >
                                                {t(option.labelKey)}
                                        </button>
                                    ))}
                                </div>
                                <p style={{ fontSize: "0.78rem", color: "#888", lineHeight: 1.55, marginTop: "0.55rem" }}>
                                    {exercise === "romanian_deadlift" ? t("dashboard.rdlCameraHint") : t("dashboard.clipHint")}
                                </p>
                            </div>

                            {/*
                            Manual camera-view selection is disabled while auto
                            detection is the product default. Re-enable this
                            block together with cameraViewOptions/useState above
                            if manual override is needed again.
                            <div style={{ marginBottom: "0.9rem" }}>
                                <label style={labelStyle}>{t("dashboard.camera")}</label>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8" }}>
                                    {cameraViewOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setCameraView(option.id)}
                                            style={{
                                                background: cameraView === option.id ? "var(--navy)" : "#fff",
                                                color: cameraView === option.id ? "#fff" : "#444",
                                                border: "none",
                                                padding: "0.5rem 0.7rem",
                                                fontSize: "0.8rem",
                                                fontWeight: cameraView === option.id ? 700 : 500,
                                                cursor: "pointer",
                                                textAlign: "left",
                                            }}
                                        >
                                                {option.labelKey ? t(option.labelKey) : option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            */}

                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "#555" }}>
                                        <input
                                            type="checkbox"
                                            checked={callLlm}
                                            disabled={subscription ? !subscription.features.ai_coaching : false}
                                            onChange={(event) => setCallLlm(event.target.checked)}
                                        />
                                        {t("dashboard.ai")} {subscription && !subscription.features.ai_coaching ? `(${tierLabel(subscription.tier, t)} ${t("common.upgrade")})` : ""}
                                    </label>
                                </div>
                                <button
                                    id="analyse-submit"
                                    onClick={handleAnalyze}
                                    disabled={!file || isLoading}
                                    className="btn-red"
                                    style={{ borderRadius: 4, padding: "0.65rem 1.1rem", opacity: file && !isLoading ? 1 : 0.45, cursor: file && !isLoading ? "pointer" : "not-allowed" }}
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <FileVideo size={16} />}
                                    {isLoading ? t("dashboard.submitting") : t("dashboard.submit")}
                                </button>
                            </div>

                            {error && (
                                <div style={{ marginTop: "1rem", border: "1px solid rgba(214,0,28,0.2)", background: "rgba(214,0,28,0.06)", color: "var(--red)", borderRadius: 4, padding: "0.8rem 1rem", fontSize: "0.85rem" }}>
                                    {error}
                                </div>
                            )}
                        </motion.section>

                        <aside style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} style={{ ...cardStyle, padding: "0.8rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.55rem" }}>
                                    <BarChart2 size={14} color="var(--navy)" />
                                    <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999" }}>{t("dashboard.latest")}</p>
                                </div>
                                {lastResult ? (
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                                        <Metric label={t("common.reps")} value={lastResult.summary.rep_count} />
                                        <Metric label={t("common.duration")} value={formatDuration(videoDurationSeconds, lastResult)} />
                                        <Metric label={t("common.issues")} value={issueCount} />
                                    </div>
                                ) : (
                                    <p style={{ fontSize: "0.82rem", color: "#888", lineHeight: 1.6 }}>
                                        {t("dashboard.resultHint")}
                                    </p>
                                )}
                            </motion.div>
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    );
}

function Metric({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={{ background: "#f7f7f7", borderRadius: 4, padding: "0.65rem", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.35rem", lineHeight: 1, color: "var(--red)" }}>{value}</p>
            <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", marginTop: "0.25rem" }}>{label}</p>
        </div>
    );
}

function formatRemaining(remaining: number | null | undefined, limit: number | null | undefined, t: (key: string) => string) {
    if (limit === undefined) return t("common.none");
    if (limit === null) return "∞";
    return `${remaining ?? 0}/${limit}`;
}

function countRepIssues(repBreakdown: VideoAnalysisResult["summary"]["rep_breakdown"] | undefined) {
    if (!repBreakdown?.length) return 0;
    return repBreakdown.reduce((total, rep) => {
        const issues = rep.issues?.length ? rep.issues : Object.keys(rep.issue_counts || {});
        return total + issues.length;
    }, 0);
}

function formatDuration(seconds: number | null, result: VideoAnalysisResult) {
    const durationSeconds = seconds ?? inferDurationFromReps(result);
    if (durationSeconds === null) return "n/a";
    return `${Math.round(durationSeconds)}s`;
}

function inferDurationFromReps(result: VideoAnalysisResult) {
    const repBreakdown = result.summary.rep_breakdown || [];
    const endTimes = repBreakdown
        .map((rep) => rep.end_ms)
        .filter((value): value is number => typeof value === "number");
    if (!endTimes.length) return null;
    return Math.max(...endTimes) / 1000;
}
