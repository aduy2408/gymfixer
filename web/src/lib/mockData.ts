// ==========================================================
// MOCK DATA — For frontend design/prototype purposes only.
// Replace with real API calls when backend is ready.
// ==========================================================

export const mockUser = {
    id: "u_001",
    name: "Alex Johnson",
    email: "alex.johnson@example.com",
    avatar: null,
    createdAt: "2025-08-01",
};

export const mockProfile = {
    height: 175,
    weight: 72,
    age: 28,
    gender: "Male",
    fitnessGoal: "Muscle Gain",
};

export const mockUploads = [
    {
        id: "v_001",
        filename: "squat_session.mp4",
        exercise: "Squat",
        uploadedAt: "2026-02-20T09:14:00Z",
        status: "completed",
        duration: "00:42",
        score: 87,
    },
    {
        id: "v_002",
        filename: "deadlift_practice.mp4",
        exercise: "Deadlift",
        uploadedAt: "2026-02-18T14:30:00Z",
        status: "completed",
        duration: "01:05",
        score: 74,
    },
    {
        id: "v_003",
        filename: "pushup_form.mp4",
        exercise: "Push-up",
        uploadedAt: "2026-02-16T08:00:00Z",
        status: "completed",
        duration: "00:30",
        score: 92,
    },
    {
        id: "v_004",
        filename: "lunge_test.mp4",
        exercise: "Lunge",
        uploadedAt: "2026-02-23T11:00:00Z",
        status: "processing",
        duration: "00:55",
        score: null,
    },
];

export const mockAnalysis = {
    uploadId: "v_001",
    exercise: "Squat",
    score: 87,
    processedAt: "2026-02-20T09:15:30Z",
    keyIssues: [
        {
            joint: "Left Knee",
            severity: "high",
            description: "Knee caving inward (valgus collapse). Keep knees aligned with toes.",
        },
        {
            joint: "Hip",
            severity: "medium",
            description: "Hip depth insufficient. Lower until thighs are parallel to the floor.",
        },
        {
            joint: "Back",
            severity: "low",
            description: "Slight forward lean detected. Maintain a neutral spine throughout.",
        },
    ],
    jointAngles: [
        { frame: 0, kneeLeft: 170, kneeRight: 172, hip: 168, ankle: 85 },
        { frame: 10, kneeLeft: 150, kneeRight: 153, hip: 150, ankle: 82 },
        { frame: 20, kneeLeft: 120, kneeRight: 125, hip: 130, ankle: 78 },
        { frame: 30, kneeLeft: 95, kneeRight: 100, hip: 108, ankle: 74 },
        { frame: 40, kneeLeft: 85, kneeRight: 92, hip: 96, ankle: 72 },
        { frame: 50, kneeLeft: 90, kneeRight: 96, hip: 102, ankle: 75 },
        { frame: 60, kneeLeft: 110, kneeRight: 115, hip: 118, ankle: 79 },
        { frame: 70, kneeLeft: 135, kneeRight: 140, hip: 138, ankle: 82 },
        { frame: 80, kneeLeft: 158, kneeRight: 162, hip: 156, ankle: 85 },
        { frame: 90, kneeLeft: 170, kneeRight: 171, hip: 169, ankle: 86 },
    ],
    referenceAngles: {
        kneeIdeal: 90,
        hipIdeal: 95,
    },
    frames: [
        { time: "0:00", annotation: "Starting position — good posture" },
        { time: "0:08", annotation: "Descent begins" },
        { time: "0:18", annotation: "⚠ Knee valgus detected" },
        { time: "0:28", annotation: "Bottom position — insufficient depth" },
        { time: "0:38", annotation: "Ascent — good drive" },
    ],
};

export const mockProgress = [
    { week: "Jan W3", avgScore: 72 },
    { week: "Jan W4", avgScore: 76 },
    { week: "Feb W1", avgScore: 79 },
    { week: "Feb W2", avgScore: 83 },
    { week: "Feb W3", avgScore: 87 },
];

// ----- Mock auth helpers (localStorage-based for prototype) -----
export const mockLogin = (email: string, password: string): boolean => {
    // Accept any non-empty credentials for prototype
    return email.length > 0 && password.length >= 6;
};

export const mockRegister = (email: string, password: string): boolean => {
    return email.includes("@") && password.length >= 6;
};

export const setAuthToken = (token: string) => {
    if (typeof window !== "undefined") localStorage.setItem("fg_token", token);
};
export const getAuthToken = () => {
    if (typeof window !== "undefined") return localStorage.getItem("fg_token");
    return null;
};
export const clearAuth = () => {
    if (typeof window !== "undefined") localStorage.removeItem("fg_token");
};
export const isAuthenticated = () => !!getAuthToken();

// ----- Diet & Tracker mock data -----
export const mockDiet = {
    // Daily calorie summary
    calorieGoal: 2800,
    calorieConsumed: 1940,
    calorieBurned: 380,

    // Macro targets (grams)
    macros: {
        protein: { goal: 180, consumed: 124 },
        carbs:   { goal: 310, consumed: 218 },
        fat:     { goal: 78,  consumed: 52  },
    },

    // Today's meals
    meals: [
        {
            name: "Breakfast",
            time: "07:30",
            calories: 520,
            items: [
                { name: "Oatmeal with banana", calories: 310, protein: 8, carbs: 58, fat: 5 },
                { name: "3 Boiled eggs", calories: 210, protein: 18, carbs: 1, fat: 14 },
            ],
        },
        {
            name: "Lunch",
            time: "12:00",
            calories: 750,
            items: [
                { name: "Grilled chicken breast (200g)", calories: 330, protein: 62, carbs: 0, fat: 7 },
                { name: "Brown rice (150g)", calories: 190, protein: 4, carbs: 40, fat: 1 },
                { name: "Steamed broccoli & carrot", calories: 80,  protein: 3,  carbs: 16, fat: 0 },
                { name: "Olive oil dressing", calories: 150, protein: 0, carbs: 0, fat: 17 },
            ],
        },
        {
            name: "Snack",
            time: "15:30",
            calories: 220,
            items: [
                { name: "Whey protein shake", calories: 130, protein: 25, carbs: 5, fat: 2 },
                { name: "Mixed nuts (30g)", calories: 90,  protein: 3,  carbs: 3, fat: 8 },
            ],
        },
        {
            name: "Dinner",
            time: "19:00",
            calories: 450,
            items: [
                { name: "Salmon fillet (180g)", calories: 270, protein: 34, carbs: 0, fat: 14 },
                { name: "Sweet potato (120g)", calories: 110, protein: 2, carbs: 26, fat: 0 },
                { name: "Green salad", calories: 70,  protein: 2, carbs: 10, fat: 2 },
            ],
        },
    ],

    // Last 7-day calorie history
    weeklyLog: [
        { day: "Mon", calories: 2640, goal: 2800 },
        { day: "Tue", calories: 2810, goal: 2800 },
        { day: "Wed", calories: 2550, goal: 2800 },
        { day: "Thu", calories: 2900, goal: 2800 },
        { day: "Fri", calories: 2720, goal: 2800 },
        { day: "Sat", calories: 2980, goal: 2800 },
        { day: "Sun", calories: 1940, goal: 2800, isToday: true },
    ],

    // AI meal suggestions
    mealSuggestions: [
        {
            id: "ms_01",
            name: "High-Protein Muscle Builder",
            tag: "Recommended",
            tagColor: "#10b981",
            description: "Optimised for maximum muscle protein synthesis. Lean proteins + complex carbs.",
            calories: 2820,
            protein: 185,
            carbs: 300,
            fat: 72,
            meals: ["Egg white omelette", "Chicken & rice bowl", "Tuna sandwich", "Beef stir-fry + quinoa"],
        },
        {
            id: "ms_02",
            name: "Clean Bulk Plan",
            tag: "Popular",
            tagColor: "#6366f1",
            description: "Slight calorie surplus with whole foods. Great for steady lean mass gains.",
            calories: 3050,
            protein: 175,
            carbs: 360,
            fat: 80,
            meals: ["Greek yogurt + granola", "Turkey wrap", "Protein smoothie", "Salmon + brown rice"],
        },
        {
            id: "ms_03",
            name: "Balanced Recovery",
            tag: "Rest Days",
            tagColor: "#f59e0b",
            description: "Lower calories on rest days with anti-inflammatory foods to aid recovery.",
            calories: 2400,
            protein: 160,
            carbs: 240,
            fat: 70,
            meals: ["Overnight oats", "Grilled chicken salad", "Cottage cheese + fruit", "Baked cod + veggies"],
        },
    ],

    // Whey / protein supplement recommendations
    supplements: [
        {
            id: "sup_01",
            brand: "Optimum Nutrition",
            name: "Gold Standard Whey",
            flavor: "Double Rich Chocolate",
            caloriesPerServing: 120,
            proteinPerServing: 24,
            servingSize: "29.4g",
            timing: "Post-workout",
            badge: "Best Overall",
            badgeColor: "#10b981",
            description: "Industry gold standard — fast-absorbing whey isolate blend. Perfect after lifting.",
        },
        {
            id: "sup_02",
            brand: "Dymatize",
            name: "ISO100 Hydrolyzed",
            flavor: "Fruity Pebbles",
            caloriesPerServing: 110,
            proteinPerServing: 25,
            servingSize: "29g",
            timing: "Post-workout / Morning",
            badge: "Fast Absorbing",
            badgeColor: "#6366f1",
            description: "Hydrolyzed whey isolate — digests fastest. Ideal for quick muscle recovery.",
        },
        {
            id: "sup_03",
            brand: "BSN",
            name: "Syntha-6",
            flavor: "Vanilla Ice Cream",
            caloriesPerServing: 200,
            proteinPerServing: 22,
            servingSize: "47g",
            timing: "Between meals / Before bed",
            badge: "Sustained Release",
            badgeColor: "#f59e0b",
            description: "Multi-protein blend (whey + casein) for sustained amino acid delivery. Great as a snack.",
        },
        {
            id: "sup_04",
            brand: "MyProtein",
            name: "Impact Whey Isolate",
            flavor: "Strawberry Cream",
            caloriesPerServing: 93,
            proteinPerServing: 23,
            servingSize: "25g",
            timing: "Any time",
            badge: "Budget Pick",
            badgeColor: "#ef4444",
            description: "High protein-to-calorie ratio at an affordable price. Great for hitting daily protein goals.",
        },
    ],
};

// ----- Workout Plans mock data -----
export const mockWorkoutPlans = {
    // Currently active plan
    activePlanId: "plan_ppl",

    // Weekly schedule for current week (Mon–Sun)
    weekSchedule: [
        { day: "Mon", label: "Push A", type: "push", done: true },
        { day: "Tue", label: "Pull A", type: "pull", done: true },
        { day: "Wed", label: "Legs A", type: "legs", done: false, isToday: true },
        { day: "Thu", label: "Rest", type: "rest", done: false },
        { day: "Fri", label: "Push B", type: "push", done: false },
        { day: "Sat", label: "Pull B", type: "pull", done: false },
        { day: "Sun", label: "Rest", type: "rest", done: false },
    ],

    // Volume stats (sets completed this week)
    weekStats: {
        totalSets: 38,
        setsGoal: 60,
        totalReps: 486,
        avgIntensity: 72, // % of 1RM
        sessionsCompleted: 2,
        sessionsGoal: 5,
    },

    // Available training plans
    plans: [
        {
            id: "plan_ppl",
            name: "Push / Pull / Legs",
            badge: "Active",
            badgeColor: "#10b981",
            level: "Intermediate",
            goal: "Muscle Gain",
            daysPerWeek: 6,
            weeksTotal: 12,
            currentWeek: 4,
            description: "Classic PPL split — 6 sessions/week targeting each muscle group twice. Optimal for muscle hypertrophy and strength gains.",
            muscleGroups: ["Chest", "Shoulders", "Triceps", "Back", "Biceps", "Quads", "Hamstrings", "Glutes"],
        },
        {
            id: "plan_upper_lower",
            name: "Upper / Lower Split",
            badge: "Recommended",
            badgeColor: "#6366f1",
            level: "Beginner–Intermediate",
            goal: "Strength & Size",
            daysPerWeek: 4,
            weeksTotal: 8,
            currentWeek: 0,
            description: "4-day split alternating upper and lower body. Great for balanced development with built-in recovery days.",
            muscleGroups: ["Chest", "Back", "Shoulders", "Arms", "Quads", "Hamstrings", "Calves"],
        },
        {
            id: "plan_fullbody",
            name: "Full Body 3×/Week",
            badge: "Beginner",
            badgeColor: "#f59e0b",
            level: "Beginner",
            goal: "General Fitness",
            daysPerWeek: 3,
            weeksTotal: 6,
            currentWeek: 0,
            description: "Hit every major muscle group 3x per week with compound lifts. Perfect for building a foundation of strength.",
            muscleGroups: ["Full Body", "Core", "Compound Movements"],
        },
    ],

    // Today's workout (Legs A)
    todaySession: {
        name: "Legs A",
        type: "legs",
        estimatedDuration: "55–70 min",
        exercises: [
            {
                id: "ex_1",
                name: "Barbell Back Squat",
                sets: 4,
                reps: "6–8",
                restSec: 150,
                rpe: "8",
                notes: "Focus on depth — thighs parallel or below. Reviewed in your last analysis.",
                linked: true, // has a PTT analysis linked
                linkedScore: 87,
            },
            {
                id: "ex_2",
                name: "Romanian Deadlift",
                sets: 3,
                reps: "10–12",
                restSec: 120,
                rpe: "7",
                notes: "Keep bar close to legs, neutral spine, feel the hamstring stretch.",
                linked: false,
            },
            {
                id: "ex_3",
                name: "Leg Press",
                sets: 3,
                reps: "12–15",
                restSec: 90,
                rpe: "7",
                notes: "Full range of motion, don't lock knees at top.",
                linked: false,
            },
            {
                id: "ex_4",
                name: "Walking Lunges",
                sets: 3,
                reps: "10 each leg",
                restSec: 90,
                rpe: "6",
                notes: "Drive through front heel, keep torso upright.",
                linked: false,
            },
            {
                id: "ex_5",
                name: "Leg Curl (Machine)",
                sets: 3,
                reps: "12–15",
                restSec: 60,
                rpe: "7",
                notes: "Controlled tempo — 2s up, 2s down.",
                linked: false,
            },
            {
                id: "ex_6",
                name: "Standing Calf Raise",
                sets: 4,
                reps: "15–20",
                restSec: 60,
                rpe: "6",
                notes: "Full ROM — go all the way up and all the way down.",
                linked: false,
            },
        ],
    },

    // 4-week progress log (volume in sets × avg load kg)
    progressLog: [
        { week: "Week 1", volume: 2100, sessions: 5 },
        { week: "Week 2", volume: 2450, sessions: 6 },
        { week: "Week 3", volume: 2780, sessions: 5 },
        { week: "Week 4", volume: 1520, sessions: 2, isCurrentWeek: true },
    ],
};

