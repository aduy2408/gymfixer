"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Activity,
    BarChart2,
    CheckCircle,
    FileVideo,
    Film,
    Loader2,
    Upload,
    X,
} from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import {
    analyzeVideo,
    ExerciseId,
    saveLatestAnalysis,
    VideoAnalysisResult,
} from "@/lib/api";
import { mockProfile } from "@/lib/mockData";

const exerciseOptions: Array<{ id: ExerciseId; label: string }> = [
    { id: "squat", label: "Squat" },
    { id: "bicep_curl", label: "Bicep Curl" },
];

const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 6,
};

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "0.4rem",
    color: "#555",
};

const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#f2f2f2",
    border: "none",
    borderRadius: 4,
    padding: "11px 14px",
    fontSize: "0.86rem",
    color: "#0a0a0a",
    outline: "none",
};

export default function DashboardPage() {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [exercise, setExercise] = useState<ExerciseId>("squat");
    const [callLlm, setCallLlm] = useState(false);
    const [includePreview, setIncludePreview] = useState(true);
    const [sampleFps, setSampleFps] = useState(8);
    const [maxFrames, setMaxFrames] = useState(360);
    const [previewMaxFrames, setPreviewMaxFrames] = useState(24);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [lastResult, setLastResult] = useState<VideoAnalysisResult | null>(null);

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
                callLlm,
                sampleFps,
                maxFrames,
                includePreview,
                previewMaxFrames,
            });
            const id = `analysis_${Date.now()}`;
            saveLatestAnalysis({
                id,
                fileName: file.name,
                analyzedAt: new Date().toISOString(),
                result,
            });
            setLastResult(result);
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
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Barlow', sans-serif" }}>
            <DashboardNav />

            <main style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
                <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.75rem" }}
                    >
                        <div>
                            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.3rem" }}>
                                Posture analysis
                            </p>
                            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.35rem" }}>
                                Analyse Workout Video
                            </h1>
                            <p style={{ fontSize: "0.82rem", color: "#888", fontWeight: 300 }}>
                                FastAPI video analysis · Goal: {mockProfile.fitnessGoal}
                            </p>
                        </div>
                    </motion.div>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ ...cardStyle, padding: "1.25rem" }}>
                            <div
                                onClick={() => fileRef.current?.click()}
                                onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={onDrop}
                                style={{
                                    border: `2px dashed ${dragOver ? "var(--red)" : file ? "#ccc" : "#ddd"}`,
                                    borderRadius: 4,
                                    background: dragOver ? "rgba(214,0,28,0.03)" : "#fafafa",
                                    minHeight: 190,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    marginBottom: "1.25rem",
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

                            <div style={{ marginBottom: "1.25rem" }}>
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
                                                padding: "0.75rem 0.9rem",
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

                            <div className="grid gap-4 md:grid-cols-3" style={{ marginBottom: "1.25rem" }}>
                                <div>
                                    <label style={labelStyle}>Sample FPS</label>
                                    <input type="number" min={1} max={30} value={sampleFps} onChange={(event) => setSampleFps(Number(event.target.value))} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Max Frames</label>
                                    <input type="number" min={30} max={2000} step={30} value={maxFrames} onChange={(event) => setMaxFrames(Number(event.target.value))} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Previews</label>
                                    <input type="number" min={4} max={80} step={4} value={previewMaxFrames} disabled={!includePreview} onChange={(event) => setPreviewMaxFrames(Number(event.target.value))} style={inputStyle} />
                                </div>
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "#555" }}>
                                        <input type="checkbox" checked={callLlm} onChange={(event) => setCallLlm(event.target.checked)} />
                                        Gemini coaching
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "#555" }}>
                                        <input type="checkbox" checked={includePreview} onChange={(event) => setIncludePreview(event.target.checked)} />
                                        Skeleton preview
                                    </label>
                                </div>
                                <button
                                    id="analyse-submit"
                                    onClick={handleAnalyze}
                                    disabled={!file || isLoading}
                                    className="btn-red"
                                    style={{ borderRadius: 4, padding: "0.85rem 1.4rem", opacity: file && !isLoading ? 1 : 0.45, cursor: file && !isLoading ? "pointer" : "not-allowed" }}
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

                        <aside style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} style={{ ...cardStyle, padding: "1rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.75rem" }}>
                                    <Activity size={14} color="var(--red)" />
                                    <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999" }}>Backend Pipeline</p>
                                </div>
                                {[
                                    "Uploads to FastAPI",
                                    "Samples frames with OpenCV",
                                    "Runs MediaPipe pose analysis",
                                    "Returns coaching and skeleton previews",
                                ].map((item) => (
                                    <div key={item} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0", fontSize: "0.8rem", color: "#666" }}>
                                        <CheckCircle size={12} color="#10b981" />
                                        {item}
                                    </div>
                                ))}
                            </motion.div>

                            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} style={{ ...cardStyle, padding: "1rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.75rem" }}>
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
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.35rem", lineHeight: 1, color: "var(--red)" }}>{value}</p>
            <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", marginTop: "0.25rem" }}>{label}</p>
        </div>
    );
}
