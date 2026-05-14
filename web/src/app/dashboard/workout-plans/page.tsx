"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Dumbbell, CalendarDays, ChevronRight, CheckCircle2,
    Clock, Flame, BarChart2, TrendingUp, Activity,
    ChevronDown, ChevronUp, Link as LinkIcon, Star, Play,
} from "lucide-react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { mockWorkoutPlans } from "@/lib/mockData";

// ── helpers ───────────────────────────────────────────────────────────────────
const pct = (a: number, b: number) => Math.min(100, Math.round((a / b) * 100));

const typeColor: Record<string, string> = {
    push: "var(--red)",
    pull: "#6366f1",
    legs: "#10b981",
    rest: "#e8e8e8",
};
const typeTextColor: Record<string, string> = {
    push: "#fff",
    pull: "#fff",
    legs: "#fff",
    rest: "#aaa",
};

// ── sub-components ────────────────────────────────────────────────────────────
const ExerciseRow = ({
    ex,
    idx,
}: {
    ex: typeof mockWorkoutPlans.todaySession.exercises[0];
    idx: number;
}) => {
    const [open, setOpen] = useState(false);
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            style={{ border: "1px solid #f0f0f0", borderRadius: 6, background: "#fff", overflow: "hidden" }}
        >
            <button
                onClick={() => setOpen(!open)}
                style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.85rem 1rem", background: "none", border: "none", cursor: "pointer",
                    textAlign: "left",
                }}
            >
                {/* Set # badge */}
                <div style={{
                    width: 28, height: 28, borderRadius: 4, background: "#f5f5f5",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 800, fontSize: "0.9rem", color: "#888",
                }}>
                    {idx + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#222" }}>{ex.name}</p>
                        {ex.linked && (
                            <span style={{
                                display: "inline-flex", alignItems: "center", gap: "0.2rem",
                                fontSize: "0.58rem", fontWeight: 800, textTransform: "uppercase",
                                letterSpacing: "0.07em", color: "#10b981",
                                background: "rgba(16,185,129,0.1)", padding: "0.15rem 0.4rem", borderRadius: 3,
                            }}>
                                <LinkIcon size={8} /> PTT {ex.linkedScore}
                            </span>
                        )}
                    </div>
                    <p style={{ fontSize: "0.7rem", color: "#aaa" }}>
                        {ex.sets} sets · {ex.reps} reps · RPE {ex.rpe} · {ex.restSec}s rest
                    </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.2rem", color: "var(--red)", lineHeight: 1 }}>{ex.sets}</p>
                        <p style={{ fontSize: "0.6rem", color: "#bbb", textTransform: "uppercase" }}>sets</p>
                    </div>
                    {open ? <ChevronUp size={14} color="#bbb" /> : <ChevronDown size={14} color="#bbb" />}
                </div>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: "hidden" }}
                    >
                        <div style={{ borderTop: "1px solid #f5f5f5", padding: "0.75rem 1rem", background: "#fafafa", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <p style={{ fontSize: "0.75rem", color: "#555", lineHeight: 1.6 }}>
                                💡 {ex.notes}
                            </p>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                {[
                                    { label: "Sets", value: ex.sets },
                                    { label: "Reps", value: ex.reps },
                                    { label: "RPE", value: ex.rpe },
                                    { label: "Rest", value: `${ex.restSec}s` },
                                ].map(d => (
                                    <div key={d.label} style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 4, padding: "0.35rem 0.65rem", textAlign: "center" }}>
                                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1rem", color: "#333", lineHeight: 1 }}>{d.value}</p>
                                        <p style={{ fontSize: "0.58rem", color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em" }}>{d.label}</p>
                                    </div>
                                ))}
                            </div>
                            {ex.linked && (
                                <Link href="/dashboard/analysis/v_001">
                                    <button style={{
                                        display: "inline-flex", alignItems: "center", gap: "0.35rem",
                                        padding: "0.4rem 0.75rem", borderRadius: 4, border: "1px solid #10b981",
                                        background: "rgba(16,185,129,0.08)", color: "#10b981",
                                        fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                                        letterSpacing: "0.06em", cursor: "pointer",
                                    }}>
                                        <Activity size={11} /> View Form Analysis · Score {ex.linkedScore}
                                    </button>
                                </Link>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ── main component ────────────────────────────────────────────────────────────
export default function WorkoutPlansPage() {
    const { weekSchedule, weekStats, plans, todaySession, progressLog, activePlanId } = mockWorkoutPlans;
    const activePlan = plans.find(p => p.id === activePlanId)!;
    const [selectedPlanId, setSelectedPlanId] = useState(activePlanId);
    const selectedPlan = plans.find(p => p.id === selectedPlanId)!;

    const maxVol = Math.max(...progressLog.map(p => p.volume)) * 1.1;

    const card: React.CSSProperties = {
        background: "#fff", border: "1px solid #e8e8e8", borderRadius: 6, padding: "1.25rem",
    };

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Barlow', sans-serif" }}>
            <DashboardNav />

            <main style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
                <div style={{ maxWidth: 1100, margin: "0 auto" }}>

                    {/* ── Header ── */}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.75rem" }}>
                        <div>
                            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.3rem" }}>
                                Training Program
                            </p>
                            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.3rem" }}>
                                Workout Plans
                            </h1>
                            <p style={{ fontSize: "0.8rem", color: "#888", fontWeight: 300 }}>
                                Week {activePlan.currentWeek} of {activePlan.weeksTotal} · {activePlan.name}
                            </p>
                        </div>
                        <Link href="/dashboard/upload">
                            <button className="btn-red" style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.75rem 1.5rem", fontSize: "0.8rem", borderRadius: 4 }}>
                                <Play size={14} fill="white" /> Upload Session
                            </button>
                        </Link>
                    </motion.div>

                    {/* ── Weekly Volume Stats ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8", marginBottom: "1.5rem" }}>
                        {[
                            { label: "Sessions Done", value: `${weekStats.sessionsCompleted}/${weekStats.sessionsGoal}`, color: "var(--red)", icon: CalendarDays },
                            { label: "Sets This Week", value: `${weekStats.totalSets}/${weekStats.setsGoal}`, color: "#6366f1", icon: Dumbbell },
                            { label: "Total Reps", value: weekStats.totalReps, color: "#10b981", icon: TrendingUp },
                            { label: "Avg Intensity", value: `${weekStats.avgIntensity}%`, color: "#f59e0b", icon: Flame },
                        ].map((s, i) => (
                            <motion.div key={s.label}
                                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                                style={{ background: "#fff", padding: "1.25rem 1.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                    <s.icon size={14} color={s.color} />
                                    <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999" }}>{s.label}</p>
                                </div>
                                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", lineHeight: 1, color: s.color }}>
                                    {s.value}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* ── Week Schedule ── */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        style={{ ...card, marginBottom: "1.5rem" }}>
                        <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginBottom: "0.9rem" }}>
                            This Week
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.5rem" }}>
                            {weekSchedule.map((d) => {
                                const isRest = d.type === "rest";
                                const bg = d.done ? typeColor[d.type] : d.isToday ? `${typeColor[d.type]}22` : "#f5f5f5";
                                const border = d.isToday ? `2px solid ${typeColor[d.type]}` : "2px solid transparent";
                                const textCol = d.done ? typeTextColor[d.type] : d.isToday ? typeColor[d.type] : "#aaa";
                                return (
                                    <div key={d.day} style={{ borderRadius: 5, border, background: bg, padding: "0.6rem 0.3rem", textAlign: "center", position: "relative" }}>
                                        <p style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: textCol, marginBottom: "0.3rem" }}>{d.day}</p>
                                        <p style={{ fontSize: "0.65rem", fontWeight: d.done || d.isToday ? 700 : 400, color: textCol, lineHeight: 1.3 }}>{d.label}</p>
                                        {d.done && !isRest && (
                                            <CheckCircle2 size={10} color="#fff" style={{ position: "absolute", top: 4, right: 4 }} />
                                        )}
                                        {d.isToday && (
                                            <div style={{ fontSize: "0.55rem", fontWeight: 800, color: typeColor[d.type], textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "0.2rem" }}>TODAY</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* ── Main grid: Today's session + Right column ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", marginBottom: "1.5rem" }}>

                        {/* Today's workout */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: typeColor[todaySession.type] }} />
                                    <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#333" }}>
                                        Today — {todaySession.name}
                                    </p>
                                </div>
                                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: "#888" }}>
                                    <Clock size={11} />{todaySession.estimatedDuration}
                                </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                {todaySession.exercises.map((ex, i) => (
                                    <ExerciseRow key={ex.id} ex={ex} idx={i} />
                                ))}
                            </div>
                        </div>

                        {/* Right column */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                            {/* Volume trend chart */}
                            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} style={card}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1rem" }}>
                                    <BarChart2 size={13} color="var(--red)" />
                                    <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999" }}>Volume Progress</p>
                                </div>
                                <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: 72, marginBottom: "0.5rem" }}>
                                    {progressLog.map((p, i) => {
                                        const h = Math.round((p.volume / maxVol) * 72);
                                        return (
                                            <div key={p.week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: h }}
                                                    transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: "easeOut" }}
                                                    style={{
                                                        width: "100%", borderRadius: "3px 3px 0 0",
                                                        background: p.isCurrentWeek ? "var(--red)" : "#e0e0e0",
                                                    }}
                                                />
                                                <span style={{ fontSize: "0.58rem", color: p.isCurrentWeek ? "var(--red)" : "#bbb", fontWeight: p.isCurrentWeek ? 700 : 400 }}>
                                                    {p.week.replace("Week ", "W")}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p style={{ fontSize: "0.65rem", color: "#10b981", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                    <TrendingUp size={10} /> +32% volume vs Week 1
                                </p>
                            </motion.div>

                            {/* Muscle groups */}
                            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }} style={card}>
                                <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginBottom: "0.75rem" }}>
                                    Muscle Coverage
                                </p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                                    {activePlan.muscleGroups.map((m) => (
                                        <span key={m} style={{
                                            fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                                            letterSpacing: "0.06em", padding: "0.25rem 0.6rem",
                                            borderRadius: 3, background: "var(--red)", color: "#fff",
                                        }}>{m}</span>
                                    ))}
                                </div>
                            </motion.div>

                            {/* Sessions progress */}
                            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.42 }} style={card}>
                                <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginBottom: "0.75rem" }}>
                                    Weekly Sessions
                                </p>
                                <div style={{ height: 6, borderRadius: 3, background: "#f0f0f0", overflow: "hidden", marginBottom: "0.4rem" }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct(weekStats.sessionsCompleted, weekStats.sessionsGoal)}%` }}
                                        transition={{ duration: 0.7, ease: "easeOut", delay: 0.5 }}
                                        style={{ height: "100%", borderRadius: 3, background: "var(--red)" }}
                                    />
                                </div>
                                <p style={{ fontSize: "0.7rem", color: "#888" }}>
                                    <span style={{ fontWeight: 700, color: "#333" }}>{weekStats.sessionsCompleted}</span> of {weekStats.sessionsGoal} sessions completed
                                </p>
                            </motion.div>
                        </div>
                    </div>

                    {/* ── All Plans ── */}
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.8rem" }}>
                            <Star size={14} color="var(--red)" />
                            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#333" }}>
                                Training Plans
                            </p>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                            {plans.map((plan, i) => {
                                const isSelected = selectedPlanId === plan.id;
                                const isActive = activePlanId === plan.id;
                                return (
                                    <motion.div
                                        key={plan.id}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 + i * 0.1 }}
                                        onClick={() => setSelectedPlanId(plan.id)}
                                        style={{
                                            ...card,
                                            cursor: "pointer",
                                            border: isSelected ? `2px solid var(--red)` : "1px solid #e8e8e8",
                                            padding: "1.1rem",
                                            display: "flex", flexDirection: "column", gap: "0.65rem",
                                            position: "relative",
                                        }}
                                        whileHover={{ scale: 1.01, boxShadow: "0 4px 16px rgba(0,0,0,0.07)" }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.05rem", textTransform: "uppercase", lineHeight: 1.2, flex: 1 }}>
                                                {plan.name}
                                            </p>
                                            <span style={{
                                                fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase",
                                                letterSpacing: "0.07em", color: "#fff", background: plan.badgeColor,
                                                padding: "0.18rem 0.45rem", borderRadius: 3, flexShrink: 0, marginLeft: "0.5rem",
                                            }}>{plan.badge}</span>
                                        </div>

                                        <p style={{ fontSize: "0.73rem", color: "#777", lineHeight: 1.5 }}>{plan.description}</p>

                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem" }}>
                                            {[
                                                { label: "Level", value: plan.level.split("–")[0] },
                                                { label: "Days/Wk", value: plan.daysPerWeek },
                                                { label: "Weeks", value: plan.weeksTotal },
                                            ].map(m => (
                                                <div key={m.label} style={{ background: "#f9f9f9", borderRadius: 4, padding: "0.4rem 0.3rem", textAlign: "center" }}>
                                                    <p style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333" }}>{m.value}</p>
                                                    <p style={{ fontSize: "0.58rem", color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {isActive && plan.currentWeek > 0 && (
                                            <div>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                                                    <span style={{ fontSize: "0.65rem", color: "#aaa" }}>Progress</span>
                                                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--red)" }}>Week {plan.currentWeek}/{plan.weeksTotal}</span>
                                                </div>
                                                <div style={{ height: 4, borderRadius: 2, background: "#f0f0f0", overflow: "hidden" }}>
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${pct(plan.currentWeek, plan.weeksTotal)}%` }}
                                                        transition={{ duration: 0.7, ease: "easeOut", delay: 0.4 + i * 0.1 }}
                                                        style={{ height: "100%", borderRadius: 2, background: "var(--red)" }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            style={{
                                                width: "100%", padding: "0.5rem",
                                                border: isActive ? "none" : "1px solid #e8e8e8",
                                                borderRadius: 4, cursor: "pointer",
                                                background: isActive ? "var(--red)" : "#fafafa",
                                                color: isActive ? "#fff" : "#555",
                                                fontSize: "0.72rem", fontWeight: 700,
                                                textTransform: "uppercase", letterSpacing: "0.06em",
                                                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                                            }}
                                        >
                                            {isActive ? <><CheckCircle2 size={13} /> Currently Active</> : <>Switch to This Plan <ChevronRight size={12} /></>}
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
