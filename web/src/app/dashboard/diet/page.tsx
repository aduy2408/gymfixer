"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Flame, Target, TrendingUp, ChevronDown, ChevronUp,
    Zap, Apple, Dumbbell, Clock, Star, ShoppingBag, Utensils, BarChart2
} from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import { mockDiet, mockProfile } from "@/lib/mockData";

// ── helpers ──────────────────────────────────────────────────────────────────
const pct = (a: number, b: number) => Math.min(100, Math.round((a / b) * 100));

const MacroBar = ({
    label, consumed, goal, color,
}: { label: string; consumed: number; goal: number; color: string }) => (
    <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#666" }}>{label}</span>
            <span style={{ fontSize: "0.72rem", color: "#888" }}>
                <span style={{ fontWeight: 700, color: "#333" }}>{consumed}g</span> / {goal}g
            </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "#f0f0f0", overflow: "hidden" }}>
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct(consumed, goal)}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                style={{ height: "100%", borderRadius: 3, background: color }}
            />
        </div>
        <p style={{ fontSize: "0.65rem", color: "#bbb", marginTop: "0.2rem", textAlign: "right" }}>{pct(consumed, goal)}%</p>
    </div>
);

const MealRow = ({ meal, idx }: { meal: typeof mockDiet.meals[0]; idx: number }) => {
    const [open, setOpen] = useState(false);
    const mealColors: Record<string, string> = {
        Breakfast: "#f59e0b",
        Lunch: "#10b981",
        Snack: "#6366f1",
        Dinner: "var(--red)",
    };
    const color = mealColors[meal.name] ?? "#888";
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07 }}
            style={{ border: "1px solid #f0f0f0", borderRadius: 6, overflow: "hidden", background: "#fff" }}
        >
            <button
                onClick={() => setOpen(!open)}
                style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.85rem 1rem", background: "none", border: "none", cursor: "pointer",
                    textAlign: "left",
                }}
            >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#333" }}>{meal.name}</p>
                    <p style={{ fontSize: "0.7rem", color: "#aaa" }}>{meal.time} · {meal.items.length} items</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.3rem", color, lineHeight: 1 }}>{meal.calories}</p>
                    <p style={{ fontSize: "0.6rem", color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em" }}>kcal</p>
                </div>
                {open ? <ChevronUp size={14} color="#bbb" /> : <ChevronDown size={14} color="#bbb" />}
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
                        <div style={{ borderTop: "1px solid #f5f5f5", padding: "0.5rem 1rem 0.75rem" }}>
                            {meal.items.map((item, i) => (
                                <div key={i} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "0.4rem 0",
                                    borderBottom: i < meal.items.length - 1 ? "1px solid #fafafa" : "none",
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: "0.78rem", color: "#444" }}>{item.name}</p>
                                        <p style={{ fontSize: "0.65rem", color: "#bbb" }}>
                                            P: {item.protein}g · C: {item.carbs}g · F: {item.fat}g
                                        </p>
                                    </div>
                                    <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#555" }}>{item.calories} kcal</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ── main component ────────────────────────────────────────────────────────────
export default function DietTrackerPage() {
    const { calorieGoal, calorieConsumed, calorieBurned, macros, meals, weeklyLog, mealSuggestions, supplements } = mockDiet;
    const calorieRemaining = calorieGoal - calorieConsumed + calorieBurned;
    const consumedPct = pct(calorieConsumed, calorieGoal);
    const maxCal = Math.max(...weeklyLog.map(d => d.calories), calorieGoal) * 1.05;

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
                        style={{ marginBottom: "1.75rem" }}>
                        <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.3rem" }}>
                            Nutrition Hub
                        </p>
                        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.3rem" }}>
                            Diet &amp; Tracker
                        </h1>
                        <p style={{ fontSize: "0.8rem", color: "#888", fontWeight: 300 }}>
                            Goal: {mockProfile.fitnessGoal} · {mockProfile.weight} kg · Today, March 16 2026
                        </p>
                    </motion.div>

                    {/* ── Calorie overview cards ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8", marginBottom: "1.5rem" }}>
                        {[
                            { label: "Daily Goal", value: calorieGoal, color: "#6366f1", icon: Target },
                            { label: "Consumed", value: calorieConsumed, color: "var(--red)", icon: Utensils },
                            { label: "Remaining", value: calorieRemaining, color: "#10b981", icon: Flame },
                            { label: "Burned", value: calorieBurned, color: "#f59e0b", icon: Zap },
                        ].map((s, i) => (
                            <motion.div key={s.label}
                                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                                style={{ background: "#fff", padding: "1.25rem 1.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                    <s.icon size={14} color={s.color} />
                                    <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999" }}>{s.label}</p>
                                </div>
                                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", lineHeight: 1, color: s.color }}>
                                    {s.value}<span style={{ fontSize: "0.8rem", color: "#bbb", fontWeight: 400 }}> kcal</span>
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* ── Two-column layout ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", marginBottom: "1.5rem" }}>

                        {/* Left: Today's meals */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                            {/* Calorie progress bar */}
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={card}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                                    <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999" }}>Today's Calorie Progress</p>
                                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--red)" }}>{consumedPct}%</span>
                                </div>
                                <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden", marginBottom: "0.5rem" }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${consumedPct}%` }}
                                        transition={{ duration: 0.8, ease: "easeOut" }}
                                        style={{
                                            height: "100%", borderRadius: 4,
                                            background: "linear-gradient(90deg, var(--red) 0%, #ff6b6b 100%)",
                                        }}
                                    />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: "0.7rem", color: "#aaa" }}>0 kcal</span>
                                    <span style={{ fontSize: "0.7rem", color: "#aaa" }}>{calorieConsumed} / {calorieGoal} kcal consumed</span>
                                    <span style={{ fontSize: "0.7rem", color: "#aaa" }}>{calorieGoal} kcal</span>
                                </div>
                            </motion.div>

                            {/* Meals list */}
                            <div>
                                <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#333", marginBottom: "0.6rem" }}>
                                    Today&apos;s Meals
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    {meals.map((meal, i) => <MealRow key={meal.name} meal={meal} idx={i} />)}
                                </div>
                            </div>
                        </div>

                        {/* Right: Macros + weekly chart */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                            {/* Macro tracker */}
                            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} style={card}>
                                <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginBottom: "1rem" }}>
                                    Macronutrients
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    <MacroBar label="Protein" consumed={macros.protein.consumed} goal={macros.protein.goal} color="var(--red)" />
                                    <MacroBar label="Carbs" consumed={macros.carbs.consumed} goal={macros.carbs.goal} color="#6366f1" />
                                    <MacroBar label="Fat" consumed={macros.fat.consumed} goal={macros.fat.goal} color="#f59e0b" />
                                </div>
                                <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#fafafa", borderRadius: 4, border: "1px solid #f0f0f0" }}>
                                    <p style={{ fontSize: "0.65rem", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.3rem" }}>Tip</p>
                                    <p style={{ fontSize: "0.72rem", color: "#666", lineHeight: 1.5 }}>
                                        You need <strong>{macros.protein.goal - macros.protein.consumed}g more protein</strong> today. Have a whey shake after your next workout!
                                    </p>
                                </div>
                            </motion.div>

                            {/* Weekly bar chart */}
                            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }} style={card}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1rem" }}>
                                    <BarChart2 size={13} color="var(--red)" />
                                    <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999" }}>Weekly Calories</p>
                                </div>
                                <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: 80 }}>
                                    {weeklyLog.map((d, i) => {
                                        const h = Math.round((d.calories / maxCal) * 80);
                                        const isToday = !!d.isToday;
                                        return (
                                            <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: h }}
                                                    transition={{ delay: 0.4 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                                                    style={{
                                                        width: "100%", borderRadius: "3px 3px 0 0",
                                                        background: isToday ? "var(--red)" : "#e8e8e8",
                                                        transition: "background 0.2s",
                                                    }}
                                                />
                                                <span style={{ fontSize: "0.6rem", color: isToday ? "var(--red)" : "#bbb", fontWeight: isToday ? 700 : 400 }}>{d.day}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                                    <span style={{ fontSize: "0.65rem", color: "#bbb" }}>Goal: {calorieGoal} kcal</span>
                                    <span style={{ fontSize: "0.65rem", color: "#10b981", fontWeight: 700 }}>
                                        <TrendingUp size={10} style={{ display: "inline", marginRight: 3 }} />Avg: {Math.round(weeklyLog.reduce((a, d) => a + d.calories, 0) / weeklyLog.length)} kcal
                                    </span>
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    {/* ── AI Meal Suggestions ── */}
                    <div style={{ marginBottom: "1.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.8rem" }}>
                            <Apple size={14} color="var(--red)" />
                            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#333" }}>
                                AI Meal Suggestions
                            </p>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                            {mealSuggestions.map((s, i) => (
                                <motion.div
                                    key={s.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 + i * 0.1 }}
                                    style={{ ...card, padding: "1.1rem", display: "flex", flexDirection: "column", gap: "0.65rem", cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s" }}
                                    whileHover={{ scale: 1.01, boxShadow: "0 4px 16px rgba(0,0,0,0.07)" }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1rem", textTransform: "uppercase", lineHeight: 1.2, flex: 1 }}>{s.name}</p>
                                        <span style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff", background: s.tagColor, padding: "0.2rem 0.5rem", borderRadius: 3, flexShrink: 0, marginLeft: "0.5rem" }}>{s.tag}</span>
                                    </div>
                                    <p style={{ fontSize: "0.73rem", color: "#777", lineHeight: 1.5 }}>{s.description}</p>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem" }}>
                                        {[
                                            { label: "Protein", value: `${s.protein}g`, color: "var(--red)" },
                                            { label: "Carbs", value: `${s.carbs}g`, color: "#6366f1" },
                                            { label: "Fat", value: `${s.fat}g`, color: "#f59e0b" },
                                        ].map(m => (
                                            <div key={m.label} style={{ background: "#f9f9f9", borderRadius: 4, padding: "0.4rem 0.3rem", textAlign: "center" }}>
                                                <p style={{ fontSize: "0.75rem", fontWeight: 800, color: m.color }}>{m.value}</p>
                                                <p style={{ fontSize: "0.58rem", color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: "0.5rem" }}>
                                        <p style={{ fontSize: "0.65rem", color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>Includes</p>
                                        <ul style={{ margin: 0, padding: "0 0 0 0.9rem" }}>
                                            {s.meals.map((m, mi) => (
                                                <li key={mi} style={{ fontSize: "0.72rem", color: "#666", lineHeight: 1.6 }}>{m}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f0f0f0", paddingTop: "0.5rem", marginTop: "auto" }}>
                                        <span style={{ fontSize: "0.68rem", color: "#aaa" }}>Total</span>
                                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#333" }}>{s.calories} <span style={{ fontSize: "0.7rem", color: "#bbb", fontWeight: 400 }}>kcal</span></span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* ── Protein / Whey Recommendations ── */}
                    <div style={{ marginBottom: "2rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.8rem" }}>
                            <Dumbbell size={14} color="var(--red)" />
                            <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#333" }}>
                                Whey &amp; Protein Recommendations
                            </p>
                            <span style={{ fontSize: "0.6rem", color: "#888", background: "#f0f0f0", padding: "0.15rem 0.5rem", borderRadius: 3, fontWeight: 600 }}>
                                Based on your Muscle Gain goal
                            </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                            {supplements.map((sup, i) => (
                                <motion.div
                                    key={sup.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 + i * 0.08 }}
                                    style={{ ...card, display: "flex", gap: "1rem", padding: "1.1rem 1.25rem", cursor: "pointer", transition: "box-shadow 0.15s" }}
                                    whileHover={{ boxShadow: "0 4px 16px rgba(0,0,0,0.07)" }}
                                >
                                    {/* Icon placeholder */}
                                    <div style={{ width: 48, height: 48, borderRadius: 6, background: `${sup.badgeColor}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <ShoppingBag size={20} color={sup.badgeColor} />
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.2rem" }}>
                                            <div>
                                                <p style={{ fontSize: "0.65rem", color: "#bbb", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{sup.brand}</p>
                                                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.05rem", textTransform: "uppercase", lineHeight: 1.1 }}>{sup.name}</p>
                                            </div>
                                            <span style={{ fontSize: "0.58rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#fff", background: sup.badgeColor, padding: "0.18rem 0.45rem", borderRadius: 3, whiteSpace: "nowrap", flexShrink: 0 }}>
                                                {sup.badge}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: "0.72rem", color: "#777", lineHeight: 1.5, marginBottom: "0.5rem" }}>{sup.description}</p>

                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.65rem", color: "#666", background: "#f5f5f5", padding: "0.2rem 0.5rem", borderRadius: 3 }}>
                                                <Star size={9} color="#f59e0b" fill="#f59e0b" />
                                                {sup.flavor}
                                            </span>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.65rem", color: "#666", background: "#f5f5f5", padding: "0.2rem 0.5rem", borderRadius: 3 }}>
                                                <Flame size={9} color="var(--red)" />
                                                {sup.caloriesPerServing} kcal · {sup.proteinPerServing}g protein
                                            </span>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.65rem", color: "#666", background: "#f5f5f5", padding: "0.2rem 0.5rem", borderRadius: 3 }}>
                                                <Clock size={9} color="#6366f1" />
                                                {sup.timing}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
