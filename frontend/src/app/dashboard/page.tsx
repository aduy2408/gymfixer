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
    PoseBackend,
    saveLatestAnalysis,
    VideoAnalysisResult,
} from "@/lib/api";
import { mockProfile } from "@/lib/mockData";

const exerciseOptions: Array<{ id: ExerciseId; label: string }> = [
    { id: "squat", label: "Squat" },
    { id: "bicep_curl", label: "Bicep Curl" },
];

const cameraViewOptions: Array<{ id: CameraView; label: string }> = [
    { id: "side", label: "Side" },
    { id: "front", label: "Front" },
    { id: "three_quarter", label: "45°" },
];

const poseBackendOptions: Array<{ id: PoseBackend; label: string }> = [
    { id: "mediapipe", label: "MediaPipe" },
    { id: "vitpose", label: "ViTPose" },
];

const DEFAULT_MAX_FRAMES = 240;
const DEFAULT_MISTAKE_FRAMES = 12;

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

export default function DashboardPage() {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [exercise, setExercise] = useState<ExerciseId>("squat");
    const [cameraView, setCameraView] = useState<CameraView>("side");
    const [poseBackend, setPoseBackend] = useState<PoseBackend>("mediapipe");
    const [callLlm, setCallLlm] = useState(false);
    const [sampleFps, setSampleFps] = useState(8);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [lastResult, setLastResult] = useState<VideoAnalysisResult | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [analyticsError, setAnalyticsError] = useState("");

    useEffect(() => {
        let cancelled = false;
        fetchAnalyticsSummary()
            .then((data) => {
                if (!cancelled) setAnalytics(data);
            })
            .catch((err) => {
                if (!cancelled) setAnalyticsError(err instanceof Error ? err.message : "Could not load analytics.");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        setDragOver(false);
        const nextFile = event.dataTransfer.files[0];
        if (nextFile?.type.startsWith("video/")) setFile(nextFile);
    }, []);

    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setFile(event.target.files?.[0] || null);
    };

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
                sampleFps,
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
            fetchAnalyticsSummary().then(setAnalytics).catch(() => {});
            router.push(`/dashboard/analysis/${id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Video analysis failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const quality = lastResult?.summary.analysis_quality?.active_window_usable_ratio;
    const fileSize = file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "";

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
                                Posture analysis
                            </p>
                            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.25rem" }}>
                                Analyse Workout Video
                            </h1>
                            <p style={{ fontSize: "0.82rem", color: "#888", fontWeight: 300 }}>
                                FastAPI video analysis · Goal: {mockProfile.fitnessGoal}
                            </p>
                        </div>
                    </motion.div>

                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ ...cardStyle, padding: "0.9rem", marginBottom: "1rem" }}
                    >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <Metric label="Sessions" value={analytics?.total_sessions ?? "0"} />
                            <Metric label="Total Reps" value={analytics?.total_reps ?? "0"} />
                            <Metric label="Avg Quality" value={analytics?.avg_quality_ratio === null || analytics?.avg_quality_ratio === undefined ? "n/a" : `${Math.round(analytics.avg_quality_ratio * 100)}%`} />
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
                                            <X size={11} /> Remove
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: "center", padding: "1.5rem" }}>
                                        <Upload size={36} color="#ccc" style={{ margin: "0 auto 0.75rem" }} />
                                        <p style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem", color: "#444" }}>Drop a video here</p>
                                        <p style={{ fontSize: "0.78rem", color: "#aaa" }}>MP4, MOV, or AVI · click to browse</p>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: "0.9rem" }}>
                                <label style={labelStyle}>Exercise Type</label>
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
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: "0.9rem" }}>
                                <label style={labelStyle}>Camera View</label>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8" }}>
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
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: "0.9rem" }}>
                                <label style={labelStyle}>Pose Backend</label>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8" }}>
                                    {poseBackendOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setPoseBackend(option.id)}
                                            style={{
                                                background: poseBackend === option.id ? "var(--navy)" : "#fff",
                                                color: poseBackend === option.id ? "#fff" : "#444",
                                                border: "none",
                                                padding: "0.5rem 0.7rem",
                                                fontSize: "0.8rem",
                                                fontWeight: poseBackend === option.id ? 700 : 500,
                                                cursor: "pointer",
                                                textAlign: "left",
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2" style={{ marginBottom: "0.9rem" }}>
                                <div>
                                    <label style={labelStyle}>Sample FPS</label>
                                    <input type="number" min={1} max={30} value={sampleFps} onChange={(event) => setSampleFps(Number(event.target.value))} style={inputStyle} />
                                </div>
                                <p style={{ fontSize: "0.78rem", color: "#888", lineHeight: 1.55, alignSelf: "end", marginBottom: "0.15rem" }}>
                                    Use clips around 20 seconds. The report highlights distinct mistake frames automatically.
                                </p>
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "#555" }}>
                                        <input type="checkbox" checked={callLlm} onChange={(event) => setCallLlm(event.target.checked)} />
                                        AI Coaching
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
                                    {isLoading ? "Analysing..." : "Analyse Video"}
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
                                    <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999" }}>Latest Result</p>
                                </div>
                                {lastResult ? (
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                                        <Metric label="Reps" value={lastResult.summary.rep_count} />
                                        <Metric label="Frames" value={lastResult.summary.frames_analyzed} />
                                        <Metric label="Time" value={`${Math.round(lastResult.summary.processing_ms / 1000)}s`} />
                                        <Metric label="Quality" value={quality === undefined ? "n/a" : `${Math.round(quality * 100)}%`} />
                                    </div>
                                ) : (
                                    <p style={{ fontSize: "0.82rem", color: "#888", lineHeight: 1.6 }}>
                                        The result page opens automatically after backend analysis finishes.
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
