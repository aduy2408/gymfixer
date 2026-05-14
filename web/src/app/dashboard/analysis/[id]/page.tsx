"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import {
    Activity, AlertTriangle, CheckCircle, ArrowLeft,
    Play, Download, Share2, Info, TrendingDown
} from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import { mockAnalysis } from "@/lib/mockData";

const severityConfig = {
    high: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" },
    medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
    low: { color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)" },
};

const scoreColor = (s: number) => s >= 85 ? "#10b981" : s >= 70 ? "#f59e0b" : "#ef4444";

// Mock skeleton keypoints for canvas illustration
const SKELETON_CONNECTIONS = [
    // torso
    [0, 1], [1, 2], [2, 3], [3, 0],
    // left arm
    [1, 5], [5, 7],
    // right arm
    [2, 6], [6, 8],
    // left leg
    [0, 9], [9, 11],
    // right leg
    [3, 10], [10, 12],
];

const MOCK_KEYPOINTS = [
    { x: 0.50, y: 0.12 }, // head
    { x: 0.43, y: 0.28 }, // l shoulder
    { x: 0.57, y: 0.28 }, // r shoulder
    { x: 0.57, y: 0.48 }, // r hip
    { x: 0.43, y: 0.48 }, // l hip
    { x: 0.32, y: 0.44 }, // l elbow
    { x: 0.68, y: 0.44 }, // r elbow
    { x: 0.26, y: 0.58 }, // l wrist
    { x: 0.74, y: 0.58 }, // r wrist
    { x: 0.43, y: 0.68 }, // l knee (flagged)
    { x: 0.57, y: 0.65 }, // r knee
    { x: 0.41, y: 0.88 }, // l ankle
    { x: 0.59, y: 0.88 }, // r ankle
];

function SkeletonViewer() {
    const W = 280, H = 360;
    return (
        <div
            className="rounded-md overflow-hidden relative flex items-center justify-center"
            style={{ background: "#fff", border: "1px solid #e8e8e8", minHeight: H }}
        >
            <svg width={W} height={H} style={{ display: "block" }}>
                {/* background person silhouette hint */}
                <rect width={W} height={H} fill="transparent" />

                {/* skeleton connections */}
                {SKELETON_CONNECTIONS.map(([a, b], i) => {
                    const from = MOCK_KEYPOINTS[a];
                    const to = MOCK_KEYPOINTS[b];
                    const isError = (a === 9 || b === 9); // left knee flagged
                    return (
                        <line
                            key={i}
                            x1={from.x * W} y1={from.y * H}
                            x2={to.x * W} y2={to.y * H}
                            stroke={isError ? "#ef4444" : "var(--navy)"}
                            strokeWidth={isError ? 3 : 2}
                            strokeOpacity={0.8}
                        />
                    );
                })}

                {/* keypoints */}
                {MOCK_KEYPOINTS.map((kp, i) => {
                    const isError = i === 9;
                    return (
                        <g key={i}>
                            <circle
                                cx={kp.x * W} cy={kp.y * H} r={isError ? 8 : 5}
                                fill={isError ? "#ef4444" : "var(--red)"}
                                stroke={isError ? "#ef4444" : "var(--navy)"}
                                strokeWidth={2}
                                strokeOpacity={0.7}
                            />
                            {isError && (
                                <circle
                                    cx={kp.x * W} cy={kp.y * H} r={14}
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth={1.5}
                                    strokeOpacity={0.4}
                                />
                            )}
                        </g>
                    );
                })}

                {/* error label */}
                <text x={MOCK_KEYPOINTS[9].x * W + 18} y={MOCK_KEYPOINTS[9].y * H + 4}
                    fill="#ef4444" fontSize={11} fontWeight="600">⚠ Knee error</text>
            </svg>

            {/* Frame time overlay */}
            <div
                className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-md text-xs"
                style={{ background: "rgba(255,255,255,0.9)", border: "1px solid #e8e8e8" }}
            >
                <span style={{ color: "#666" }}>Frame 40 / 90</span>
                <span style={{ color: "#ef4444" }}>⚠ Issue detected</span>
            </div>
        </div>
    );
}

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="p-3 rounded-md text-xs" style={{ background: "#fff", border: "1px solid #e8e8e8" }}>
            <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Frame {label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}°</p>
            ))}
        </div>
    );
}

export default function AnalysisPage({ params }: { params: { id: string } }) {
    const d = mockAnalysis;

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Barlow', sans-serif" }}>
            <DashboardNav />

            <main style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
                <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                        <Link href="/dashboard">
                            <button className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                <ArrowLeft size={15} /> Back to Dashboard
                            </button>
                        </Link>

                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2.5rem", textTransform: "uppercase", lineHeight: 1, color: "var(--red)" }}>
                                    {d.exercise} Analysis
                                </h1>
                                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                                    Processed {new Date(d.processedAt).toLocaleString()}
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <button className="btn-outline-red" style={{ padding: "0.6rem 1.2rem", fontSize: "0.75rem", borderRadius: 4 }}>
                                    <Download size={15} /> Export Report
                                </button>
                                <button className="btn-outline-red" style={{ padding: "0.6rem 1.2rem", fontSize: "0.75rem", borderRadius: 4 }}>
                                    <Share2 size={15} /> Share
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Score banner */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
                    >
                        {[
                            { label: "Form Score", value: `${d.score}`, unit: "/100", color: scoreColor(d.score) },
                            { label: "Issues Found", value: `${d.keyIssues.length}`, unit: "", color: "#f59e0b" },
                            { label: "Frames Analysed", value: "1,260", unit: "", color: "var(--navy)" },
                            { label: "Exercise", value: d.exercise, unit: "", color: "var(--red)" },
                        ].map((m, i) => (
                            <motion.div
                                key={m.label}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + i * 0.07 }}
                                className="glass p-4"
                            >
                                <p className="text-2xl font-black" style={{ color: m.color }}>
                                    {m.value}<span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>{m.unit}</span>
                                </p>
                                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Main grid */}
                    <div className="grid md:grid-cols-5 gap-6 mb-8">
                        {/* Skeleton viewer */}
                        <motion.div
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.25 }}
                            className="md:col-span-2"
                        >
                            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                                <Activity size={16} style={{ color: "var(--navy)" }} /> Pose Overlay
                            </h2>
                            <SkeletonViewer />

                            {/* Frame timeline */}
                            <div className="mt-3 space-y-1.5">
                                {d.frames.map((fr, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-2 px-3 py-2 rounded-md text-xs cursor-pointer transition-all"
                                        style={{ background: "#fff", border: "1px solid #e8e8e8" }}
                                    >
                                        <span className="font-mono w-8 flex-shrink-0" style={{ color: "var(--navy)" }}>{fr.time}</span>
                                        <span style={{ color: fr.annotation.startsWith("⚠") ? "#f59e0b" : "var(--text-muted)" }}>
                                            {fr.annotation}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Joint angle chart */}
                        <motion.div
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.35 }}
                            className="md:col-span-3"
                        >
                            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                                <TrendingDown size={16} style={{ color: "var(--red)" }} /> Joint Angle Analysis
                            </h2>
                            <div className="glass p-4 mb-4" style={{ height: 280 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={d.jointAngles} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis
                                            dataKey="frame"
                                            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                                            label={{ value: "Frame", position: "insideBottom", offset: -2, fontSize: 10, fill: "var(--text-muted)" }}
                                        />
                                        <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} domain={[60, 180]} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                                        <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Knee ideal 90°", fontSize: 10, fill: "#ef4444" }} />
                                        <Line type="monotone" dataKey="kneeLeft" name="Knee L" stroke="#ef4444" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="kneeRight" name="Knee R" stroke="var(--navy)" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="hip" name="Hip" stroke="var(--red)" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="ankle" name="Ankle" stroke="#06d6a0" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Per-joint summary bars */}
                            <div className="glass p-4">
                                <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>Min/Max Range per Joint</p>
                                {[
                                    { joint: "Left Knee", min: 85, max: 170, ideal: 90, flag: true },
                                    { joint: "Right Knee", min: 92, max: 172, ideal: 90, flag: false },
                                    { joint: "Hip", min: 96, max: 169, ideal: 95, flag: false },
                                    { joint: "Ankle", min: 72, max: 86, ideal: 75, flag: false },
                                ].map((j) => (
                                    <div key={j.joint} className="flex items-center gap-3 mb-2.5">
                                        <span className="text-xs w-20 flex-shrink-0" style={{ color: j.flag ? "#ef4444" : "var(--text-muted)" }}>
                                            {j.flag ? "⚠ " : ""}{j.joint}
                                        </span>
                                        <div className="flex-1 relative h-4 rounded-sm overflow-hidden" style={{ background: "#f0f0f0" }}>
                                            <div
                                                className="h-4 rounded-sm absolute"
                                                style={{
                                                    left: `${(j.min / 180) * 100}%`,
                                                    width: `${((j.max - j.min) / 180) * 100}%`,
                                                    background: j.flag ? "#ef4444" : "var(--navy)",
                                                }}
                                            />
                                            <div
                                                className="w-0.5 h-4 absolute"
                                                style={{ left: `${(j.ideal / 180) * 100}%`, background: "white", opacity: 0.4 }}
                                            />
                                        </div>
                                        <span className="text-xs w-20 text-right" style={{ color: "var(--text-muted)" }}>
                                            {j.min}° – {j.max}°
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* Issues & feedback */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 }}
                    >
                        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <AlertTriangle size={18} style={{ color: "#f59e0b" }} /> Correction Feedback
                        </h2>
                        <div className="space-y-4">
                            {d.keyIssues.map((issue, i) => {
                                const cfg = severityConfig[issue.severity as keyof typeof severityConfig];
                                return (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.5 + i * 0.1 }}
                                        className="p-5 rounded-md flex items-start gap-4"
                                        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                                    >
                                        <span className="text-xl flex-shrink-0 mt-0.5">{cfg.icon}</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-sm" style={{ color: cfg.color }}>{issue.joint}</p>
                                                <span
                                                    className="badge text-xs px-2 py-0.5"
                                                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 999 }}
                                                >
                                                    {issue.severity}
                                                </span>
                                            </div>
                                            <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                                                {issue.description}
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Next steps */}
                        <div
                            className="mt-6 p-5 rounded-md flex items-start gap-3"
                            style={{ background: "#fff", border: "1px solid #e8e8e8" }}
                        >
                            <Info size={16} style={{ color: "var(--red)", marginTop: 2, flexShrink: 0 }} />
                            <div>
                                <p className="font-semibold text-sm mb-1" style={{ color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recommended next steps</p>
                                <ul className="text-sm space-y-1" style={{ color: "var(--text-secondary)" }}>
                                    <li>• Practice goblet squats to reinforce knee alignment</li>
                                    <li>• Strengthen hip abductors (clamshells, banded walks)</li>
                                    <li>• Focus on slower descent tempo — 3-second lowering phase</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Link href="/dashboard/upload">
                                <button className="btn-red" style={{ padding: "0.8rem 1.5rem", fontSize: "0.8rem", borderRadius: 4 }}>
                                    <Play size={15} /> UPLOAD ANOTHER VIDEO
                                </button>
                            </Link>
                            <Link href="/dashboard">
                                <button className="btn-outline-red" style={{ padding: "0.8rem 1.5rem", fontSize: "0.8rem", borderRadius: 4 }}>
                                    BACK TO DASHBOARD
                                </button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
