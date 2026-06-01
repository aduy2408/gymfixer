"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CalendarDays, ChefHat, Dumbbell, Flame, Loader2, RefreshCw, Scale, Utensils } from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import {
    createMealPlan,
    createWorkoutPlan,
    fetchLatestMealPlan,
    fetchLatestWorkoutPlan,
    fetchUserProfile,
    MealPlan,
    MealPlanRequest,
    WorkoutPlan,
    WorkoutPlanRequest,
} from "@/lib/api";

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

type Tab = "workout" | "meal";

const goalOptions = [
    { id: "fat_loss", label: "Fat Loss" },
    { id: "muscle", label: "Muscle Gain" },
    { id: "strength", label: "Strength" },
    { id: "endurance", label: "Endurance" },
    { id: "rehab", label: "Rehab" },
    { id: "general", label: "General Fitness" },
] as const;

export default function PlansPage() {
    const [activeTab, setActiveTab] = useState<Tab>("workout");
    const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
    const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
    const [showWorkoutForm, setShowWorkoutForm] = useState(false);
    const [showMealForm, setShowMealForm] = useState(false);
    const [workoutLoading, setWorkoutLoading] = useState(false);
    const [mealLoading, setMealLoading] = useState(false);
    const [latestLoading, setLatestLoading] = useState(true);
    const [workoutError, setWorkoutError] = useState("");
    const [mealError, setMealError] = useState("");
    const [latestError, setLatestError] = useState("");
    const [useCustomEquipment, setUseCustomEquipment] = useState(false);

    const [workoutForm, setWorkoutForm] = useState({
        age: "28",
        height_cm: "175",
        weight_kg: "72",
        gender: "male",
        goal: "muscle",
        level: "intermediate",
        training_location: "gym",
        days_per_week: "4",
        session_minutes: "60",
        equipment: "",
        current_loads: "",
        injuries: "",
        focus_muscles: "Chest, back, legs",
    });

    const [mealForm, setMealForm] = useState({
        age: "28",
        height_cm: "175",
        weight_kg: "72",
        gender: "male",
        goal: "muscle",
        activity_level: "moderate",
        meals_per_day: "4",
        diet_preference: "none",
        allergies: "",
        disliked_foods: "",
        budget: "medium",
        cooking_time: "normal",
        budget_vnd_per_day: "120000",
        cooking_time_hours_per_day: "1",
        target_calories: "",
        adjust_for_workout_plan: false,
    });
    const isHomeTraining = workoutForm.training_location === "home";

    useEffect(() => {
        let cancelled = false;
        async function loadInitialData() {
            const [profileResult, workoutResult, mealResult] = await Promise.allSettled([
                fetchUserProfile(),
                fetchLatestWorkoutPlan(),
                fetchLatestMealPlan(),
            ]);

            if (cancelled) return;

            if (profileResult.status === "fulfilled") {
                const profile = profileResult.value;
                const metricPatch = {
                    age: profile.age ? String(profile.age) : "28",
                    height_cm: profile.height_cm ? String(profile.height_cm) : "175",
                    weight_kg: profile.weight_kg ? String(profile.weight_kg) : "72",
                    gender: profile.gender || "male",
                    goal: profile.goal || "muscle",
                };
                setWorkoutForm((form) => ({ ...form, ...metricPatch }));
                setMealForm((form) => ({
                    ...form,
                    ...metricPatch,
                    goal: metricPatch.goal === "rehab" ? "general" : metricPatch.goal,
                }));
            }

            if (workoutResult.status === "fulfilled") {
                setWorkoutPlan(workoutResult.value);
            } else if (!isMissingPlanError(workoutResult.reason)) {
                setLatestError((prev) => prev || "Could not load your latest workout plan.");
            }

            if (mealResult.status === "fulfilled") {
                setMealPlan(mealResult.value);
            } else if (!isMissingPlanError(mealResult.reason)) {
                setLatestError((prev) => prev || "Could not load your latest meal plan.");
            }

            setLatestLoading(false);
        }

        loadInitialData();
        return () => {
            cancelled = true;
        };
    }, []);

    const updateWorkout = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        if (key === "training_location" && value === "gym") {
            setUseCustomEquipment(false);
        }
        setWorkoutForm((form) => ({ ...form, [key]: value }));
    };

    const updateMeal = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setMealForm((form) => ({ ...form, [key]: event.target.value }));

    const handleWorkoutSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const validationError = validateNumberFields([
            { label: "Age", value: workoutForm.age, min: 10, max: 100 },
            { label: "Height", value: workoutForm.height_cm, min: 100, max: 250 },
            { label: "Weight", value: workoutForm.weight_kg, min: 30, max: 300 },
            { label: "Days / Week", value: workoutForm.days_per_week, min: 1, max: 7 },
            { label: "Minutes", value: workoutForm.session_minutes, min: 15, max: 180 },
        ]);
        if (validationError) {
            setWorkoutError(validationError);
            return;
        }
        setWorkoutLoading(true);
        setWorkoutError("");
        try {
            const payload: WorkoutPlanRequest = {
                age: Number(workoutForm.age),
                height_cm: Number(workoutForm.height_cm),
                weight_kg: Number(workoutForm.weight_kg),
                gender: workoutForm.gender as WorkoutPlanRequest["gender"],
                goal: workoutForm.goal as WorkoutPlanRequest["goal"],
                level: workoutForm.level as WorkoutPlanRequest["level"],
                training_location: workoutForm.training_location as WorkoutPlanRequest["training_location"],
                days_per_week: Number(workoutForm.days_per_week),
                session_minutes: Number(workoutForm.session_minutes),
                equipment: isHomeTraining && useCustomEquipment ? splitCsv(workoutForm.equipment) : [],
                current_loads: workoutForm.current_loads,
                injuries: workoutForm.injuries,
                focus_muscles: splitCsv(workoutForm.focus_muscles),
            };
            setWorkoutPlan(await createWorkoutPlan(payload));
            setShowWorkoutForm(false);
        } catch (err) {
            setWorkoutError(err instanceof Error ? err.message : "Could not create workout plan.");
        } finally {
            setWorkoutLoading(false);
        }
    };

    const handleMealSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const validationError = validateNumberFields([
            { label: "Age", value: mealForm.age, min: 10, max: 100 },
            { label: "Height", value: mealForm.height_cm, min: 100, max: 250 },
            { label: "Weight", value: mealForm.weight_kg, min: 30, max: 300 },
            { label: "Meals / Day", value: mealForm.meals_per_day, min: 1, max: 6 },
            { label: "Budget (VND/day)", value: mealForm.budget_vnd_per_day, min: 30000, max: 1000000 },
        ]) || validateDecimalField("Cooking Time (hours/day)", mealForm.cooking_time_hours_per_day, 0.25, 8);
        if (validationError) {
            setMealError(validationError);
            return;
        }
        setMealLoading(true);
        setMealError("");
        try {
            const payload: MealPlanRequest = {
                age: Number(mealForm.age),
                height_cm: Number(mealForm.height_cm),
                weight_kg: Number(mealForm.weight_kg),
                gender: mealForm.gender as MealPlanRequest["gender"],
                goal: mealForm.goal as MealPlanRequest["goal"],
                activity_level: mealForm.activity_level as MealPlanRequest["activity_level"],
                meals_per_day: Number(mealForm.meals_per_day),
                diet_preference: mealForm.diet_preference as MealPlanRequest["diet_preference"],
                allergies: mealForm.allergies,
                disliked_foods: mealForm.disliked_foods,
                budget: mealForm.budget as MealPlanRequest["budget"],
                cooking_time: mealForm.cooking_time as MealPlanRequest["cooking_time"],
                budget_vnd_per_day: Number(mealForm.budget_vnd_per_day),
                cooking_time_hours_per_day: Number(mealForm.cooking_time_hours_per_day),
                target_calories: mealForm.target_calories ? Number(mealForm.target_calories) : null,
                adjust_for_workout_plan: mealForm.adjust_for_workout_plan,
            };
            setMealPlan(await createMealPlan(payload));
            setShowMealForm(false);
        } catch (err) {
            setMealError(err instanceof Error ? err.message : "Could not create meal plan.");
        } finally {
            setMealLoading(false);
        }
    };

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Barlow', sans-serif" }}>
            <DashboardNav />
            <main style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
                <div style={{ maxWidth: 1180, margin: "0 auto" }}>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "1.5rem" }}>
                        <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.35rem" }}>
                            Weekly planning
                        </p>
                        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2.25rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.35rem" }}>
                            Plans
                        </h1>
                        <p style={{ fontSize: "0.84rem", color: "#888" }}>
                            Generate a 7-day training plan and meal plan from your goals, metrics, constraints, and preferences.
                        </p>
                        {latestLoading && (
                            <p style={{ fontSize: "0.76rem", color: "#aaa", marginTop: "0.55rem" }}>
                                Loading your saved plans...
                            </p>
                        )}
                        {latestError && (
                            <div style={{ marginTop: "0.75rem" }}>
                                <ErrorBox text={latestError} />
                            </div>
                        )}
                    </motion.div>

                    <div style={{ ...cardStyle, padding: "0.35rem", display: "inline-flex", gap: "0.35rem", marginBottom: "1.25rem" }}>
                        <TabButton active={activeTab === "workout"} onClick={() => setActiveTab("workout")} icon={<Dumbbell size={15} />} label="Workout Plan" />
                        <TabButton active={activeTab === "meal"} onClick={() => setActiveTab("meal")} icon={<ChefHat size={15} />} label="Meal Plan" />
                    </div>

                    {activeTab === "workout" ? (
                        <PlanWorkspace
                            hasPlan={Boolean(workoutPlan)}
                            showForm={showWorkoutForm || !workoutPlan}
                            loading={workoutLoading}
                            updateActionLabel="Update Workout Plan"
                            onShowForm={() => setShowWorkoutForm(true)}
                            form={(
                                <PlanForm title={workoutPlan ? "Update Workout Plan" : "Workout Inputs"} subtitle="Build a conservative week of training." onSubmit={handleWorkoutSubmit} loading={workoutLoading} buttonLabel={workoutPlan ? "Regenerate Workout Plan" : "Generate Workout Plan"} onCancel={workoutPlan ? () => { setWorkoutError(""); setShowWorkoutForm(false); } : undefined}>
                                    <MetricsFields form={workoutForm} update={updateWorkout} />
                                    <SelectField label="Goal" value={workoutForm.goal} onChange={updateWorkout("goal")} options={goalOptions} />
                                    <SelectField label="Level" value={workoutForm.level} onChange={updateWorkout("level")} options={[
                                        { id: "beginner", label: "Beginner" },
                                        { id: "intermediate", label: "Intermediate" },
                                        { id: "advanced", label: "Advanced" },
                                    ]} />
                                    <SelectField label="Training Location" value={workoutForm.training_location} onChange={updateWorkout("training_location")} options={[
                                        { id: "gym", label: "Gym" },
                                        { id: "home", label: "Home" },
                                    ]} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <TextField label="Days / Week" type="number" min={1} max={7} value={workoutForm.days_per_week} onChange={updateWorkout("days_per_week")} />
                                        <TextField label="Minutes" type="number" min={15} max={180} value={workoutForm.session_minutes} onChange={updateWorkout("session_minutes")} />
                                    </div>
                                    {isHomeTraining && (
                                        <>
                                            <ToggleField
                                                checked={useCustomEquipment}
                                                onChange={setUseCustomEquipment}
                                                title="Custom equipment"
                                                description="Use your own equipment list instead of the default home setup."
                                            />
                                            {useCustomEquipment && <TextField label="Equipment" value={workoutForm.equipment} onChange={updateWorkout("equipment")} />}
                                        </>
                                    )}
                                    <TextAreaField label="Current Loads" value={workoutForm.current_loads} onChange={updateWorkout("current_loads")} />
                                    <TextField label="Focus Muscles" value={workoutForm.focus_muscles} onChange={updateWorkout("focus_muscles")} />
                                    <TextAreaField label="Injuries / Limits" value={workoutForm.injuries} onChange={updateWorkout("injuries")} />
                                    {workoutError && <ErrorBox text={workoutError} />}
                                </PlanForm>
                            )}
                            plan={<WorkoutPlanView plan={workoutPlan} loading={workoutLoading} />}
                        />
                    ) : (
                        <PlanWorkspace
                            hasPlan={Boolean(mealPlan)}
                            showForm={showMealForm || !mealPlan}
                            loading={mealLoading}
                            updateActionLabel="Update Meal Plan"
                            onShowForm={() => setShowMealForm(true)}
                            form={(
                                <PlanForm title={mealPlan ? "Update Meal Plan" : "Meal Inputs"} subtitle="Create daily meals for the next week." onSubmit={handleMealSubmit} loading={mealLoading} buttonLabel={mealPlan ? "Regenerate Meal Plan" : "Generate Meal Plan"} onCancel={mealPlan ? () => { setMealError(""); setShowMealForm(false); } : undefined}>
                                    <MetricsFields form={mealForm} update={updateMeal} />
                                    <SelectField label="Goal" value={mealForm.goal} onChange={updateMeal("goal")} options={goalOptions.filter((goal) => goal.id !== "rehab")} />
                                    <SelectField label="Activity Level" value={mealForm.activity_level} onChange={updateMeal("activity_level")} options={[
                                        { id: "sedentary", label: "Sedentary" },
                                        { id: "light", label: "Light" },
                                        { id: "moderate", label: "Moderate" },
                                        { id: "active", label: "Active" },
                                        { id: "very_active", label: "Very Active" },
                                    ]} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <TextField label="Meals / Day" type="number" min={1} max={6} value={mealForm.meals_per_day} onChange={updateMeal("meals_per_day")} />
                                        <TextField label="Budget (VND/day)" type="number" min={30000} max={1000000} value={mealForm.budget_vnd_per_day} onChange={updateMeal("budget_vnd_per_day")} />
                                    </div>
                                    <TextField label="Cooking Time (hours/day)" type="number" min={0.25} max={8} step="0.25" value={mealForm.cooking_time_hours_per_day} onChange={updateMeal("cooking_time_hours_per_day")} />
                                    <SelectField label="Diet Preference" value={mealForm.diet_preference} onChange={updateMeal("diet_preference")} options={[
                                        { id: "none", label: "No Preference" },
                                        { id: "vegetarian", label: "Vegetarian" },
                                        { id: "vegan", label: "Vegan" },
                                        { id: "halal", label: "Halal" },
                                        { id: "low_carb", label: "Low Carb" },
                                    ]} />
                                    <label style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", border: "1px solid #eee", background: mealForm.adjust_for_workout_plan ? "rgba(214,0,28,0.05)" : "#fafafa", borderRadius: 6, padding: "0.8rem", cursor: "pointer" }}>
                                        <input
                                            type="checkbox"
                                            checked={mealForm.adjust_for_workout_plan}
                                            onChange={(event) => setMealForm((form) => ({ ...form, adjust_for_workout_plan: event.target.checked }))}
                                            style={{ marginTop: 2 }}
                                        />
                                        <span>
                                            <span style={{ display: "block", fontSize: "0.78rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: "#333" }}>
                                                Adjust meals based on workout schedule
                                            </span>
                                            <span style={{ display: "block", fontSize: "0.74rem", color: "#888", lineHeight: 1.45, marginTop: "0.25rem" }}>
                                                Uses your latest saved workout plan to raise carbs on training days and reduce them on rest days.
                                            </span>
                                        </span>
                                    </label>
                                    <TextAreaField label="Allergies" value={mealForm.allergies} onChange={updateMeal("allergies")} />
                                    <TextAreaField label="Disliked Foods" value={mealForm.disliked_foods} onChange={updateMeal("disliked_foods")} />
                                    {mealError && <ErrorBox text={mealError} />}
                                </PlanForm>
                            )}
                            plan={<MealPlanView plan={mealPlan} loading={mealLoading} />}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}

function PlanForm({
    title,
    subtitle,
    children,
    onSubmit,
    loading,
    buttonLabel,
    onCancel,
}: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
    onSubmit: (event: React.FormEvent) => void;
    loading: boolean;
    buttonLabel: string;
    onCancel?: () => void;
}) {
    return (
        <form onSubmit={onSubmit} style={{ ...cardStyle, padding: "1.25rem", height: "fit-content" }}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.35rem", textTransform: "uppercase", lineHeight: 1 }}>
                {title}
            </h2>
            <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.35rem", marginBottom: "1rem" }}>{subtitle}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>{children}</div>
            <div style={{ display: "flex", gap: "0.65rem", marginTop: "1rem" }}>
                {onCancel && (
                    <button type="button" onClick={onCancel} className="btn-outline-red" disabled={loading} style={{ flex: 1, justifyContent: "center", borderRadius: 4 }}>
                        Cancel
                    </button>
                )}
                <button type="submit" className="btn-red" disabled={loading} style={{ flex: 1, justifyContent: "center", borderRadius: 4, opacity: loading ? 0.7 : 1 }}>
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    {loading ? "Generating..." : buttonLabel}
                </button>
            </div>
        </form>
    );
}

function PlanWorkspace({
    hasPlan,
    showForm,
    loading,
    updateActionLabel,
    onShowForm,
    form,
    plan,
}: {
    hasPlan: boolean;
    showForm: boolean;
    loading: boolean;
    updateActionLabel: string;
    onShowForm: () => void;
    form: React.ReactNode;
    plan: React.ReactNode;
}) {
    if (!hasPlan) {
        return (
            <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
                {form}
                {plan}
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ ...cardStyle, padding: "0.85rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                    <p style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)" }}>
                        Saved plan
                    </p>
                    <p style={{ fontSize: "0.82rem", color: "#777", marginTop: "0.25rem" }}>
                        This is your latest saved plan. Generate a new one only when your goals or schedule change.
                    </p>
                </div>
                {!showForm && (
                    <button type="button" onClick={onShowForm} className="btn-red" disabled={loading} style={{ borderRadius: 4, padding: "0.65rem 1rem", fontSize: "0.78rem" }}>
                        <RefreshCw size={15} />
                        {updateActionLabel}
                    </button>
                )}
            </div>

            {showForm ? (
                <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
                    {form}
                    {plan}
                </div>
            ) : (
                plan
            )}
        </div>
    );
}

function MetricsFields({
    form,
    update,
}: {
    form: { age: string; height_cm: string; weight_kg: string; gender: string };
    update: (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}) {
    return (
        <>
            <div className="grid grid-cols-3 gap-3">
                <TextField label="Age" type="number" min={10} max={100} value={form.age} onChange={update("age")} />
                <TextField label="Height" type="number" min={100} max={250} value={form.height_cm} onChange={update("height_cm")} />
                <TextField label="Weight" type="number" min={30} max={300} value={form.weight_kg} onChange={update("weight_kg")} />
            </div>
            <SelectField label="Gender" value={form.gender} onChange={update("gender")} options={[
                { id: "", label: "Prefer not to say" },
                { id: "male", label: "Male" },
                { id: "female", label: "Female" },
                { id: "other", label: "Other" },
            ]} />
        </>
    );
}

function TextField({
    label,
    value,
    onChange,
    type = "text",
    min,
    max,
    step,
}: {
    label: string;
    value: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    min?: number;
    max?: number;
    step?: number | string;
}) {
    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <input type={type} min={min} max={max} step={step} value={value} onChange={onChange} style={inputStyle} />
        </div>
    );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void }) {
    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <textarea value={value} onChange={onChange} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
    );
}

function ToggleField({
    checked,
    onChange,
    title,
    description,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    title: string;
    description: string;
}) {
    return (
        <label style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", border: "1px solid #eee", background: checked ? "rgba(214,0,28,0.05)" : "#fafafa", borderRadius: 6, padding: "0.8rem", cursor: "pointer" }}>
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} style={{ marginTop: 2 }} />
            <span>
                <span style={{ display: "block", fontSize: "0.78rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: "#333" }}>
                    {title}
                </span>
                <span style={{ display: "block", fontSize: "0.74rem", color: "#888", lineHeight: 1.45, marginTop: "0.25rem" }}>
                    {description}
                </span>
            </span>
        </label>
    );
}

function SelectField({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    options: ReadonlyArray<{ id: string; label: string }>;
}) {
    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <select value={value} onChange={onChange} style={{ ...inputStyle, cursor: "pointer" }}>
                {options.map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                background: active ? "var(--red)" : "transparent",
                color: active ? "#fff" : "#555",
                border: "none",
                borderRadius: 4,
                padding: "0.65rem 0.85rem",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
            }}
        >
            {icon}
            {label}
        </button>
    );
}

function WorkoutPlanView({ plan, loading }: { plan: WorkoutPlan | null; loading: boolean }) {
    const [selection, setSelection] = useState<{ planId: number | null; day: string }>({ planId: null, day: "Mon" });

    if (loading && !plan) return <PlanPlaceholder text="Generating your workout week..." />;
    if (!plan) return <PlanPlaceholder text="No workout plan yet. Fill the form and generate your first week." />;
    const selectedDay = selection.planId === plan.id && plan.days.some((day) => day.day === selection.day)
        ? selection.day
        : getDefaultWorkoutDay(plan);
    const selected = plan.days.find((day) => day.day === selectedDay) || plan.days[0];

    return (
        <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <PlanHeader title="Workout Week" />
            <SafetyNotes notes={plan.safety_notes} />
            <WeekDaySelector
                days={plan.days}
                selectedDay={selected.day}
                onSelectDay={(day) => setSelection({ planId: plan.id, day })}
                getTitle={(day) => day.day}
                getMeta={(day) => day.type === "training" ? `${day.exercises.length} exercises` : day.type}
            />
            <div style={{ ...cardStyle, padding: "1rem", boxShadow: "0 12px 30px rgba(0, 0, 0, 0.045)" }}>
                <DayHeader day={selected.day} title={selected.title} meta={`${selected.type} · ${selected.estimated_minutes} min`} />
                {selected.exercises.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "0.85rem" }}>
                        {selected.exercises.map((exercise) => (
                            <div key={`${selected.day}-${exercise.name}`} style={{ background: "#f8f8f8", borderRadius: 4, padding: "0.75rem" }}>
                                <p style={{ fontWeight: 800, fontSize: "0.86rem", color: "#333" }}>{exercise.name}</p>
                                <p style={{ fontSize: "0.74rem", color: "#888", marginTop: "0.25rem" }}>
                                    {exercise.sets} sets · {exercise.reps} reps · {exercise.rest_sec}s rest
                                </p>
                                {exercise.load_recommendation && <p style={{ fontSize: "0.74rem", color: "#444", marginTop: "0.35rem", lineHeight: 1.45, fontWeight: 700 }}>Load: {exercise.load_recommendation}</p>}
                                {exercise.notes && <p style={{ fontSize: "0.74rem", color: "#666", marginTop: "0.35rem", lineHeight: 1.45 }}>{exercise.notes}</p>}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ fontSize: "0.82rem", color: "#888", marginTop: "0.85rem" }}>No training scheduled. Recover and prepare for the next session.</p>
                )}
            </div>
        </section>
    );
}

function MealPlanView({ plan, loading }: { plan: MealPlan | null; loading: boolean }) {
    const [selection, setSelection] = useState<{ planId: number | null; day: string }>({ planId: null, day: "Mon" });

    if (loading && !plan) return <PlanPlaceholder text="Generating your meal week..." />;
    if (!plan) return <PlanPlaceholder text="No meal plan yet. Fill the form and generate your first week." />;
    const weekCalories = plan.days.reduce((total, day) => total + day.meals.reduce((sum, meal) => sum + meal.calories, 0), 0);
    const workoutSync = plan.workout_sync;
    const selectedDay = selection.planId === plan.id && plan.days.some((day) => day.day === selection.day)
        ? selection.day
        : plan.days[0]?.day || "Mon";
    const selected = plan.days.find((day) => day.day === selectedDay) || plan.days[0];
    const selectedTotals = sumMealDay(selected);

    return (
        <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <PlanHeader title="Meal Week" />
            <div
                style={{
                    ...cardStyle,
                    padding: "1.1rem",
                    background: "linear-gradient(135deg, #211551 0%, #2f226d 55%, #d6001c 160%)",
                    color: "#fff",
                    boxShadow: "0 20px 50px rgba(33, 21, 81, 0.16)",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                        <p style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.62)", marginBottom: "0.35rem" }}>
                            Nutrition target
                        </p>
                        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "2rem", textTransform: "uppercase", lineHeight: 1 }}>
                            {plan.daily_targets.calories} kcal / day
                        </h2>
                        <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.76)", marginTop: "0.35rem" }}>
                            {Math.round(weekCalories / 7)} kcal average from planned portions.
                        </p>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem", justifyContent: "flex-end" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: "0.55rem 0.85rem", fontSize: "0.76rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            <Scale size={15} /> gram-based portions
                        </div>
                        {workoutSync?.applied && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.12)", borderRadius: 999, padding: "0.55rem 0.85rem", fontSize: "0.76rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                <Dumbbell size={15} /> synced to workouts
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MacroTargetCard label="Calories" value={plan.daily_targets.calories} max={Math.max(plan.daily_targets.calories, 1)} tone="red" />
                <MacroTargetCard label="Protein" value={plan.daily_targets.protein_g} suffix="g" max={Math.max(plan.daily_targets.protein_g, 1)} tone="navy" />
                <MacroTargetCard label="Carbs" value={plan.daily_targets.carbs_g} suffix="g" max={Math.max(plan.daily_targets.carbs_g, 1)} tone="gold" />
                <MacroTargetCard label="Fat" value={plan.daily_targets.fat_g} suffix="g" max={Math.max(plan.daily_targets.fat_g, 1)} tone="green" />
            </div>
            {plan.nutrition_metrics && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <InfoCard label="TDEE" value={`${plan.nutrition_metrics.tdee} kcal`} />
                    <InfoCard label="Activity" value={`${formatActivityLevel(plan.nutrition_metrics.activity_level)} (${plan.nutrition_metrics.activity_factor})`} />
                    <InfoCard label="Budget" value={formatVnd(plan.nutrition_metrics.budget_vnd_per_day)} />
                    <InfoCard label="Cooking" value={`${plan.nutrition_metrics.cooking_time_hours_per_day}h / day`} />
                </div>
            )}
            <SafetyNotes notes={plan.safety_notes} />
            <WeekDaySelector
                days={plan.days}
                selectedDay={selected.day}
                onSelectDay={(day) => setSelection({ planId: plan.id, day })}
                getTitle={(day) => day.day}
                getMeta={(day) => {
                    const workoutType = workoutSync?.schedule?.[day.day];
                    const calories = `${sumMealDay(day).calories} kcal`;
                    return workoutType ? `${formatWorkoutType(workoutType)} · ${calories}` : calories;
                }}
            />
            <div
                style={{
                    ...cardStyle,
                    padding: "1rem",
                    background: "linear-gradient(180deg, #fff 0%, #fbfbfb 100%)",
                    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.045)",
                }}
            >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.85rem" }}>
                    <DayHeader day={selected.day} title={`${selectedTotals.calories} kcal`} meta={`${selected.meals.length} meals · P ${selectedTotals.protein_g}g · C ${selectedTotals.carbs_g}g · F ${selectedTotals.fat_g}g · ${formatVnd(selected.estimated_cost_vnd || 0)}`} />
                    <div style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(214,0,28,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--red)", flexShrink: 0 }}>
                        <Flame size={16} />
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "0.85rem" }}>
                    {selected.meals.map((meal, index) => (
                        <MealCard key={`${selected.day}-${meal.name}-${index}`} meal={meal} />
                    ))}
                </div>
            </div>
        </section>
    );
}

type Meal = MealPlan["days"][number]["meals"][number];
type MealIngredient = Exclude<Meal["items"][number], string>;
type MealDay = MealPlan["days"][number];

function WeekDaySelector<TDay extends { day: string },>({
    days,
    selectedDay,
    onSelectDay,
    getTitle,
    getMeta,
}: {
    days: TDay[];
    selectedDay: string;
    onSelectDay: (day: string) => void;
    getTitle: (day: TDay) => string;
    getMeta: (day: TDay) => string;
}) {
    return (
        <div style={{ ...cardStyle, padding: "0.75rem", overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(92px, 1fr))", gap: "0.55rem", minWidth: 700 }}>
                {days.map((day) => {
                    const active = day.day === selectedDay;
                    return (
                        <button
                            key={day.day}
                            type="button"
                            onClick={() => onSelectDay(day.day)}
                            style={{
                                border: active ? "1px solid var(--red)" : "1px solid #eee",
                                background: active ? "var(--red)" : "#fff",
                                color: active ? "#fff" : "#333",
                                borderRadius: 6,
                                padding: "0.75rem 0.65rem",
                                textAlign: "left",
                                cursor: "pointer",
                                boxShadow: active ? "0 12px 24px rgba(214, 0, 28, 0.16)" : "none",
                                transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
                            }}
                        >
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.25rem", fontWeight: 900, lineHeight: 1 }}>
                                {getTitle(day)}
                            </p>
                            <p style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: active ? "rgba(255,255,255,0.78)" : "#999", marginTop: "0.35rem" }}>
                                {getMeta(day)}
                            </p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function getDefaultWorkoutDay(plan: WorkoutPlan) {
    return plan.days.find((day) => day.type === "training")?.day || plan.days[0]?.day || "Mon";
}

function sumMealDay(day: MealDay) {
    return day.meals.reduce(
        (sum, meal) => ({
            calories: sum.calories + meal.calories,
            protein_g: sum.protein_g + meal.protein_g,
            carbs_g: sum.carbs_g + meal.carbs_g,
            fat_g: sum.fat_g + meal.fat_g,
            estimated_cost_vnd: sum.estimated_cost_vnd + (meal.estimated_cost_vnd || 0),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, estimated_cost_vnd: 0 }
    );
}

function formatWorkoutType(value: string) {
    if (value === "training") return "Training";
    if (value === "mobility") return "Mobility";
    if (value === "rest") return "Rest";
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function MealCard({ meal }: { meal: Meal }) {
    return (
        <div style={{ background: "#fff", border: "1px solid #ededed", borderRadius: 8, padding: "0.85rem", boxShadow: "0 8px 22px rgba(0,0,0,0.035)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: "var(--navy)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Utensils size={14} />
                    </div>
                    <div>
                        <p style={{ fontWeight: 900, fontSize: "0.9rem", color: "#222", textTransform: "uppercase", letterSpacing: "0.03em" }}>{meal.name}</p>
                        <p style={{ fontSize: "0.72rem", color: "#999", marginTop: "0.15rem" }}>{meal.time || "Flexible time"}</p>
                    </div>
                </div>
                <span style={{ borderRadius: 999, background: "rgba(214,0,28,0.08)", color: "var(--red)", padding: "0.38rem 0.55rem", fontSize: "0.72rem", fontWeight: 900, whiteSpace: "nowrap" }}>
                    {meal.calories} kcal
                </span>
            </div>
            <p style={{ fontSize: "0.72rem", color: "#777", marginTop: "0.55rem", fontWeight: 800 }}>
                Estimated cost: {formatVnd(meal.estimated_cost_vnd || 0)}
            </p>
            <div className="grid grid-cols-3 gap-2" style={{ marginTop: "0.75rem" }}>
                <MacroMini label="Protein" value={`${meal.protein_g}g`} color="var(--red)" />
                <MacroMini label="Carbs" value={`${meal.carbs_g}g`} color="#f59e0b" />
                <MacroMini label="Fat" value={`${meal.fat_g}g`} color="#10b981" />
            </div>
            <IngredientList items={meal.items} />
        </div>
    );
}

function IngredientList({ items }: { items: Meal["items"] }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.75rem" }}>
            {items.map((item, index) => {
                if (!isStructuredIngredient(item)) {
                    return (
                        <div key={`${item}-${index}`} style={{ border: "1px solid #f0f0f0", background: "#fafafa", borderRadius: 6, padding: "0.65rem 0.7rem", fontSize: "0.78rem", color: "#555" }}>
                            {item}
                        </div>
                    );
                }
                return (
                    <div key={`${item.name}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)_auto", gap: "0.75rem", alignItems: "center", border: "1px solid #f0f0f0", background: "#fafafa", borderRadius: 6, padding: "0.65rem 0.7rem" }}>
                        <div>
                            <p style={{ fontSize: "0.82rem", fontWeight: 800, color: "#333" }}>{item.name}</p>
                            <p style={{ fontSize: "0.7rem", color: "#999", marginTop: "0.18rem" }}>
                                {item.calories} kcal · P {item.protein_g}g · C {item.carbs_g}g · F {item.fat_g}g · {formatVnd(item.estimated_cost_vnd || 0)}
                            </p>
                        </div>
                        <span style={{ border: "1px solid rgba(33,21,81,0.12)", background: "#fff", color: "var(--navy)", borderRadius: 999, padding: "0.34rem 0.55rem", fontSize: "0.72rem", fontWeight: 900, whiteSpace: "nowrap" }}>
                            {formatQuantity(item)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function MacroTargetCard({ label, value, suffix = "", max, tone }: { label: string; value: number; suffix?: string; max: number; tone: "red" | "navy" | "gold" | "green" }) {
    const colors = {
        red: "var(--red)",
        navy: "var(--navy)",
        gold: "#f59e0b",
        green: "#10b981",
    };
    const color = colors[tone];
    return (
        <div style={{ ...cardStyle, padding: "0.85rem", overflow: "hidden" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.55rem", lineHeight: 1, color }}>{value}{suffix}</p>
            <p style={{ fontSize: "0.66rem", color: "#999", marginTop: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
            <div style={{ height: 5, background: "#f0f0f0", borderRadius: 999, overflow: "hidden", marginTop: "0.7rem" }}>
                <div style={{ width: `${Math.min(100, Math.max(8, (value / max) * 100))}%`, height: "100%", background: color }} />
            </div>
        </div>
    );
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ ...cardStyle, padding: "0.85rem" }}>
            <p style={{ fontSize: "0.95rem", color: "#222", fontWeight: 900, lineHeight: 1.15 }}>{value}</p>
            <p style={{ fontSize: "0.66rem", color: "#999", marginTop: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
        </div>
    );
}

function MacroMini({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div style={{ background: "#f8f8f8", borderRadius: 6, padding: "0.55rem" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.05rem", lineHeight: 1, color }}>{value}</p>
            <p style={{ fontSize: "0.62rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "0.2rem" }}>{label}</p>
        </div>
    );
}

function isStructuredIngredient(item: Meal["items"][number]): item is MealIngredient {
    return typeof item === "object" && item !== null && "quantity" in item && "unit" in item;
}

function formatQuantity(item: MealIngredient) {
    const quantity = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(1);
    if (item.unit === "g" || item.unit === "ml") return `${quantity}${item.unit}`;
    return `${quantity} ${item.unit}`;
}

function formatVnd(value: number) {
    return `${Math.round(value).toLocaleString("vi-VN")} VND`;
}

function formatActivityLevel(value: string) {
    return value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function PlanHeader({ title }: { title: string }) {
    return (
        <div style={{ ...cardStyle, padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <div>
                <p style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.25rem" }}>
                    Active plan
                </p>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.45rem", textTransform: "uppercase", lineHeight: 1 }}>
                    {title}
                </h2>
            </div>
        </div>
    );
}

function DayHeader({ day, title, meta }: { day: string; title: string; meta: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <div style={{ width: 44, height: 44, borderRadius: 4, background: "var(--navy)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>
                {day}
            </div>
            <div>
                <p style={{ fontWeight: 800, fontSize: "0.92rem", color: "#333" }}>{title}</p>
                <p style={{ fontSize: "0.74rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "0.15rem" }}>{meta}</p>
            </div>
        </div>
    );
}

function SafetyNotes({ notes }: { notes: string[] }) {
    if (!notes.length) return null;
    return (
        <div style={{ ...cardStyle, padding: "0.9rem 1rem", display: "flex", gap: "0.65rem", alignItems: "flex-start", color: "#666" }}>
            <AlertTriangle size={17} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {notes.map((note) => (
                    <p key={note} style={{ fontSize: "0.8rem", lineHeight: 1.45 }}>{note}</p>
                ))}
            </div>
        </div>
    );
}

function PlanPlaceholder({ text }: { text: string }) {
    return (
        <section style={{ ...cardStyle, minHeight: 360, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
            <div>
                <CalendarDays size={36} color="#ccc" style={{ margin: "0 auto 0.75rem" }} />
                <p style={{ fontSize: "0.9rem", color: "#888" }}>{text}</p>
            </div>
        </section>
    );
}

function ErrorBox({ text }: { text: string }) {
    return (
        <div style={{ border: "1px solid rgba(214,0,28,0.2)", background: "rgba(214,0,28,0.06)", color: "var(--red)", borderRadius: 4, padding: "0.75rem", fontSize: "0.82rem", lineHeight: 1.4 }}>
            {text}
        </div>
    );
}

function validateNumberFields(fields: Array<{ label: string; value: string; min: number; max: number }>) {
    for (const field of fields) {
        const error = validateNumberField(field.label, field.value, field.min, field.max);
        if (error) return error;
    }
    return "";
}

function validateDecimalField(label: string, value: string, min: number, max: number) {
    if (!value.trim()) return `${label} is required.`;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return `${label} must be a valid number.`;
    if (parsed < min || parsed > max) return `${label} must be between ${min} and ${max}.`;
    return "";
}

function validateNumberField(label: string, value: string, min: number, max: number) {
    if (!value.trim()) return `${label} is required.`;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return `${label} must be a valid number.`;
    if (parsed < min || parsed > max) return `${label} must be between ${min} and ${max}.`;
    return "";
}

function isMissingPlanError(error: unknown) {
    return error instanceof Error && error.message.toLowerCase().includes("no ") && error.message.toLowerCase().includes("plan");
}

function splitCsv(value: string) {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}
