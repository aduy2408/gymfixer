"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Video, X, CheckCircle, Film, Loader2, ChevronRight } from "lucide-react";
import DashboardNav from "@/components/DashboardNav";

const exercises = [
    "Squat", "Deadlift", "Bench Press", "Overhead Press",
    "Lunge", "Push-up", "Pull-up", "Romanian Deadlift",
    "Hip Thrust", "Barbell Row", "Other",
];

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#f2f2f2",
    border: "none",
    borderRadius: 4,
    padding: "11px 14px",
    fontSize: "0.9rem",
    color: "#0a0a0a",
    outline: "none",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: "0.4rem",
    color: "#555",
};

export default function UploadPage() {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [exercise, setExercise] = useState("");
    const [notes, setNotes] = useState("");
    const [state, setState] = useState<UploadState>("idle");
    const [progress, setProgress] = useState(0);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith("video/")) setFile(f);
    }, []);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) setFile(f);
    };

    const handleUpload = async () => {
        if (!file || !exercise) return;
        setState("uploading");
        for (let i = 0; i <= 100; i += 10) {
            await new Promise((r) => setTimeout(r, 80));
            setProgress(i);
        }
        setState("processing");
        await new Promise((r) => setTimeout(r, 2000));
        setState("done");
        await new Promise((r) => setTimeout(r, 1200));
        router.push("/dashboard/analysis/v_001");
    };

    const sizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : 0;

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Barlow', sans-serif" }}>
            <DashboardNav />
            <main style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
                <div style={{ maxWidth: 900, margin: "0 auto" }}>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

                        <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "0.4rem" }}>New Session</p>
                        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.4rem" }}>
                            UPLOAD WORKOUT VIDEO
                        </h1>
                        <p style={{ fontSize: "0.82rem", color: "#999", fontWeight: 300, marginBottom: "2rem" }}>
                            MP4 · MOV · AVI &nbsp;·&nbsp; Max 500 MB &nbsp;·&nbsp; Recommended 10–120 s
                        </p>

                        {/* Drop zone */}
                        <div
                            onClick={() => fileRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={onDrop}
                            style={{
                                border: `2px dashed ${dragOver ? "var(--red)" : file ? "#ccc" : "#ddd"}`,
                                borderRadius: 4,
                                background: dragOver ? "rgba(214,0,28,0.03)" : "#fff",
                                minHeight: 180,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                marginBottom: "1.5rem",
                                transition: "border-color 0.15s, background 0.15s",
                            }}
                        >
                            <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={onFileChange} />
                            <AnimatePresence mode="wait">
                                {file ? (
                                    <motion.div key="file" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: "1.5rem" }}>
                                        <Film size={36} color="#555" style={{ margin: "0 auto 0.75rem" }} />
                                        <p style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>{file.name}</p>
                                        <p style={{ fontSize: "0.78rem", color: "#999" }}>{sizeMB} MB</p>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setFile(null); setState("idle"); setProgress(0); }}
                                            style={{ marginTop: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", padding: "0.3rem 0.75rem", border: "1px solid #ddd", borderRadius: 3, background: "none", cursor: "pointer", color: "#888" }}
                                        >
                                            <X size={11} /> Remove
                                        </button>
                                    </motion.div>
                                ) : (
                                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: "1.5rem" }}>
                                        <Upload size={36} color="#ccc" style={{ margin: "0 auto 0.75rem" }} />
                                        <p style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem", color: "#444" }}>Drag & drop your video here</p>
                                        <p style={{ fontSize: "0.78rem", color: "#aaa" }}>or click to browse</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Exercise type */}
                        <div style={{ marginBottom: "1.5rem" }}>
                            <label style={labelStyle}>Exercise Type *</label>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8" }}>
                                {exercises.map((ex) => (
                                    <button
                                        key={ex}
                                        type="button"
                                        onClick={() => setExercise(ex)}
                                        style={{
                                            background: exercise === ex ? "var(--red)" : "#fff",
                                            color: exercise === ex ? "#fff" : "#444",
                                            border: "none",
                                            padding: "0.65rem 0.75rem",
                                            fontSize: "0.8rem",
                                            fontWeight: exercise === ex ? 700 : 400,
                                            cursor: "pointer",
                                            textAlign: "left",
                                            transition: "background 0.12s",
                                        }}
                                    >
                                        {ex}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        <div style={{ marginBottom: "1.5rem" }}>
                            <label style={labelStyle}>Notes (optional)</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g. felt right knee discomfort"
                                rows={2}
                                style={{ ...inputStyle, resize: "none" }}
                                onFocus={(e) => (e.target.style.background = "#e8e8e8")}
                                onBlur={(e) => (e.target.style.background = "#f2f2f2")}
                            />
                        </div>

                        {/* Progress */}
                        <AnimatePresence>
                            {(state === "uploading" || state === "processing" || state === "done") && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    style={{ borderLeft: "3px solid var(--red)", background: "#fff", border: "1px solid #e8e8e8", borderRadius: 4, padding: "0.9rem 1.1rem", marginBottom: "1rem" }}>
                                    {state === "uploading" && (
                                        <>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
                                                <span style={{ color: "#555" }}>Uploading…</span>
                                                <span style={{ fontWeight: 700, color: "var(--red)" }}>{progress}%</span>
                                            </div>
                                            <div style={{ height: 3, background: "#f0f0f0", borderRadius: 2 }}>
                                                <motion.div style={{ height: 3, background: "var(--red)", width: `${progress}%`, borderRadius: 2 }} />
                                            </div>
                                        </>
                                    )}
                                    {state === "processing" && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.82rem", color: "#555" }}>
                                            <Loader2 size={15} className="animate-spin" color="var(--red)" />
                                            AI is analysing your pose — this takes 30–120 seconds…
                                        </div>
                                    )}
                                    {state === "done" && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.82rem", color: "#10b981" }}>
                                            <CheckCircle size={15} /> Analysis complete! Redirecting…
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit */}
                        <button
                            id="upload-submit"
                            onClick={handleUpload}
                            disabled={!file || !exercise || state !== "idle"}
                            className="btn-red"
                            style={{
                                width: "100%",
                                justifyContent: "center",
                                padding: "0.95rem",
                                fontSize: "0.85rem",
                                borderRadius: 4,
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                opacity: file && exercise && state === "idle" ? 1 : 0.4,
                                cursor: file && exercise && state === "idle" ? "pointer" : "not-allowed",
                            }}
                        >
                            {state === "idle" ? <><Video size={16} /> ANALYSE MY WORKOUT</> : <><Loader2 size={16} className="animate-spin" /> PROCESSING…</>}
                        </button>

                        {/* Tips */}
                        <div style={{ marginTop: "2rem", borderTop: "1px solid #e8e8e8", paddingTop: "1.5rem" }}>
                            <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#bbb", marginBottom: "0.75rem" }}>Tips for best results</p>
                            <ul style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                {[
                                    "Film from the side or 45° angle",
                                    "Ensure full body is visible in frame",
                                    "Good lighting — avoid silhouettes",
                                    "10–60 second clips work best",
                                    "Wear form-fitting clothes if possible",
                                ].map((tip) => (
                                    <li key={tip} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "#888" }}>
                                        <ChevronRight size={11} color="var(--red)" style={{ flexShrink: 0 }} />
                                        {tip}
                                    </li>
                                ))}
                            </ul>
                        </div>

                    </motion.div>
                </div>
            </main>
        </div>
    );
}
