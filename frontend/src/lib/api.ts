"use client";

import { getAuthToken } from "@/lib/auth";

export type ExerciseId = "squat" | "lunge" | "bicep_curl" | "romanian_deadlift";
export type CameraView = "auto" | "side" | "front" | "three_quarter";
export type PoseBackend = "mediapipe" | "vitpose";
export type SubscriptionTier = "free" | "trial" | "paid";
export type UserRole = "user" | "admin";

export type AuthUser = {
  id: number | string;
  name: string;
  email: string;
  is_verified?: boolean;
  auth_provider?: string;
  subscription_tier?: SubscriptionTier;
  role?: UserRole;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  premium_expires_at?: string | null;
  created_at?: string;
  last_login_at?: string | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export type UserProfile = {
  id: number | string;
  name: string;
  email: string;
  subscription_tier?: SubscriptionTier;
  role?: UserRole;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  premium_expires_at?: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
  gender: "male" | "female" | "other" | "";
  goal: "fat_loss" | "muscle" | "strength" | "endurance" | "rehab" | "general" | "";
  discovery_source: "facebook" | "tiktok" | "word_of_mouth" | "";
  created_at: string;
  updated_at?: string | null;
};

export type UserProfileUpdate = Partial<{
  name: string;
  email: string;
  height_cm: number;
  weight_kg: number;
  age: number;
  gender: UserProfile["gender"];
  goal: UserProfile["goal"];
  discovery_source: UserProfile["discovery_source"];
}>;

export type FeedbackSource = "popup" | "sidebar";

export type FeedbackCreate = {
  rating: number;
  message: string;
  source: FeedbackSource;
};

export type FeedbackItem = {
  id: number;
  rating: number;
  message: string;
  source: FeedbackSource | string;
  created_at: string;
};

export type AdminFeedbackItem = FeedbackItem & {
  user_id: number;
  user_name: string;
};

export type AdminRange = "7d" | "30d" | "all";

export type AnalyticsDatum = {
  count: number;
  percentage: number;
};

export type AdminAnalytics = {
  range: AdminRange;
  user_counts: {
    total: number;
    new: number;
    admins: number;
    regular: number;
  };
  top_metrics: {
    video_analyses: number;
    plan_generations: number;
  };
  discovery_sources: Array<AnalyticsDatum & { source: string }>;
  feature_usage: Array<AnalyticsDatum & { feature: string }>;
  feedback_sources: Array<AnalyticsDatum & { source: string }>;
  rating_distribution: Array<AnalyticsDatum & { rating: number }>;
  usage_events: Array<AnalyticsDatum & { event_name: string }>;
  feedback_summary: {
    count: number;
    average_rating: number | null;
  };
  recent_events: Array<{
    id: number;
    event_name: string;
    user_id: number | null;
    user_name: string | null;
    properties: Record<string, string | number | boolean | null>;
    created_at: string;
  }>;
};

export type ClientUsageEventName =
  | "dashboard_viewed"
  | "admin_viewed"
  | "feedback_popup_shown"
  | "feedback_popup_dismissed"
  | "feedback_sidebar_opened"
  | "onboarding_intro_viewed"
  | "onboarding_metrics_started"
  | "onboarding_completed"
  | "quota_error_shown"
  | "plan_generation_failed";

export type SubscriptionSummary = {
  tier: SubscriptionTier;
  stored_tier: SubscriptionTier;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  premium_expires_at?: string | null;
  trial_expired: boolean;
  window: "month" | "trial";
  window_started_at: string;
  resets_at: string | null;
  limits: {
    video_analyses: number | null;
    ai_coaching: number | null;
    workout_plans: number | null;
    meal_plans: number | null;
    history_items: number | null;
  };
  usage: {
    video_analyses: number;
    ai_coaching: number;
    workout_plans: number;
    meal_plans: number;
  };
  remaining: {
    video_analyses: number | null;
    ai_coaching: number | null;
    workout_plans: number | null;
    meal_plans: number | null;
  };
  features: {
    vitpose: boolean;
    ai_coaching: boolean;
    full_history: boolean;
  };
  billing?: {
    status: "active" | "past_due" | "canceled" | "expired" | string;
    amount_vnd: number;
    interval: "monthly" | string;
    current_period_start: string | null;
    current_period_end: string | null;
    next_billing_at: string | null;
    cancel_at_period_end: boolean;
    payment_method: null | {
      id: number;
      provider: string;
      masked_card: string | null;
      bank_code: string | null;
      card_type: string | null;
      status: string;
    };
  } | null;
};

export type VideoAnalysisResult = {
  session_id?: number;
  analysis_id?: number;
  exercise: string;
  camera_view?: CameraView | string;
  pose_backend?: string;
  summary: {
    camera_view?: CameraView | string;
    camera_view_requested?: CameraView | string;
    camera_view_counts?: Record<string, number>;
    camera_view_confidence?: number | null;
    pose_backend?: string;
    frames_received: number;
    frames_analyzed: number;
    waiting_for_subject_frames?: number;
    unsupported_view_frames?: number;
    rep_count: number;
    rep_breakdown?: Array<{
      rep_number: number;
      completed: boolean;
      start_frame: number | null;
      end_frame: number | null;
      start_ms: number | null;
      end_ms: number | null;
      duration_ms: number | null;
      frame_count: number;
      phases: string[];
      issues: string[];
      issue_counts: Record<string, number>;
      angle_stats?: Record<string, { min?: number; avg?: number; max?: number }>;
    }>;
    processing_ms: number;
    top_feedback?: Record<string, number>;
    angle_stats?: Record<string, { min?: number; avg?: number; max?: number }>;
    analysis_quality?: {
      active_window_usable_ratio?: number;
      usable_frames?: number;
      setup_frames_before_subject_visible?: number;
    };
  };
  llm: {
    enabled: boolean;
    model: string;
    max_output_tokens?: number;
    prompt_chars?: number;
    finish_reason?: string | null;
    usage_metadata?: Record<string, unknown> | null;
    recommendations: string;
    error: string | null;
  };
  frame_log?: Array<{
    frame_index: number;
    timestamp_ms: number | null;
    status: string;
    phase?: string | null;
    rep_count?: number | null;
    angles?: Record<string, number>;
    feedback?: string[];
    problem_feedback?: string[];
  }>;
  preview_frames?: Array<{
    frame_index: number;
    timestamp_ms: number | null;
    width?: number;
    height?: number;
    status: string;
    phase?: string | null;
    rep_count?: number | null;
    feedback?: string[];
    problem_feedback?: string[];
    preview_reason?: string;
    image: string;
  }>;
};

export type StoredAnalysis = {
  id: string;
  fileName: string;
  analyzedAt: string;
  result: VideoAnalysisResult;
};

export type WorkoutSession = {
  id: number;
  exercise: string;
  camera_view: CameraView | string;
  pose_backend: string;
  file_name: string | null;
  file_size_bytes: number | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  analysis_id: number | null;
  summary: VideoAnalysisResult["summary"] | null;
  analysis?: {
    id: number;
    summary: VideoAnalysisResult["summary"];
    top_feedback: Record<string, number>;
    angle_stats: Record<string, unknown>;
    llm: VideoAnalysisResult["llm"];
    created_at: string;
  };
};

export type AnalyticsSummary = {
  total_sessions: number;
  completed_sessions?: number;
  total_reps: number;
  sessions_by_exercise: Record<string, number>;
  reps_by_exercise: Record<string, number>;
  avg_quality_ratio: number | null;
  avg_processing_ms: number | null;
  top_feedback: Record<string, number>;
  top_rep_issues?: Record<string, number>;
  rep_issues_by_exercise?: Record<string, Record<string, number>>;
  top_failures?: Record<string, number>;
  llm_enabled_count: number;
  recent_sessions: WorkoutSession[];
};

export type WorkoutPlanRequest = {
  age: number;
  height_cm: number;
  weight_kg: number;
  gender: "male" | "female" | "other" | "";
  goal: "fat_loss" | "muscle" | "strength" | "endurance" | "rehab" | "general";
  level: "beginner" | "intermediate" | "advanced";
  training_location: "home" | "gym";
  days_per_week: number;
  session_minutes: number;
  equipment: string[];
  current_loads?: string;
  injuries?: string;
  focus_muscles?: string[];
};

export type WorkoutPlan = {
  id: number;
  generation_source: "gemini" | "fallback";
  generation_diagnostics?: {
    attempted_gemini: boolean;
    fallback_reason?: "missing_api_key" | "timeout" | "network_error" | "http_error" | "invalid_response" | "schema_error" | null;
    duration_ms?: number | null;
  } | null;
  days: Array<{
    day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
    type: "training" | "rest" | "mobility";
    title: string;
    estimated_minutes: number;
    exercises: Array<{
      name: string;
      sets: number;
      reps: string;
      rest_sec: number;
      notes?: string;
      load_recommendation?: string;
    }>;
  }>;
  safety_notes: string[];
};

export type MealPlanRequest = {
  age: number;
  height_cm: number;
  weight_kg: number;
  gender: "male" | "female" | "other" | "";
  goal: "fat_loss" | "muscle" | "strength" | "endurance" | "general";
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active";
  meals_per_day: number;
  diet_preference: "none" | "vegetarian" | "vegan" | "halal" | "low_carb";
  allergies?: string;
  disliked_foods?: string;
  budget: "low" | "medium" | "high";
  cooking_time: "minimal" | "normal" | "meal_prep";
  budget_vnd_per_day: number;
  cooking_time_hours_per_day: number;
  target_calories?: number | null;
  adjust_for_workout_plan: boolean;
};

export type MealPlan = {
  id: number;
  generation_source: "gemini" | "fallback";
  generation_diagnostics?: {
    attempted_gemini: boolean;
    fallback_reason?: "missing_api_key" | "timeout" | "network_error" | "http_error" | "invalid_response" | "schema_error" | null;
    duration_ms?: number | null;
  } | null;
  daily_targets: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  nutrition_metrics?: {
    bmr: number;
    tdee: number;
    activity_level: MealPlanRequest["activity_level"];
    activity_factor: number;
    goal_adjustment_calories: number;
    target_calories: number;
    budget_vnd_per_day: number;
    cooking_time_hours_per_day: number;
  } | null;
  workout_sync?: {
    enabled: boolean;
    source_workout_plan_id: number | null;
    applied: boolean;
    note: string;
    schedule?: Record<string, string> | null;
  } | null;
  days: Array<{
    day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
    estimated_cost_vnd?: number;
    meals: Array<{
      name: string;
      name_en?: string;
      name_vi?: string;
      time?: string;
      items: Array<
        | string
        | {
            name: string;
            name_en?: string;
            name_vi?: string;
            quantity: number;
            unit: "g" | "ml" | "large" | "piece" | "slice" | "scoop" | "tbsp" | "cup";
            calories: number;
            protein_g: number;
            carbs_g: number;
            fat_g: number;
            estimated_cost_vnd?: number;
          }
      >;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      estimated_cost_vnd?: number;
    }>;
  }>;
  safety_notes: string[];
};

let latestAnalysisMemory: StoredAnalysis | null = null;
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const VIDEO_ANALYSIS_TIMEOUT_MS = 180000;

export function apiBase(): string {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envBase) {
    const normalized = envBase.replace(/\/$/, "");
    if (/^https?:\/\//i.test(normalized)) return normalized;
    return `https://${normalized}`;
  }
  return "http://localhost:5000";
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  const requestUrl = input instanceof Request ? input.url : input.toString();
  try {
    const hostname = new URL(requestUrl).hostname;
    if (hostname.endsWith(".ngrok-free.app")) {
      headers.set("ngrok-skip-browser-warning", "true");
    }
  } catch {
    // Relative URLs are resolved before reaching this helper in normal API calls.
  }
  try {
    return await fetch(input, { ...init, headers, signal: init.signal || controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out. Check that the backend is reachable at ${apiBase()}.`);
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string" ? detail : detail?.message || data?.message || fallback;
    const error = new Error(message);
    if (detail && typeof detail === "object") {
      Object.assign(error, { code: detail.code, subscription: detail.subscription });
    }
    throw error;
  }
  return data as T;
}

function apiPath(path: string): string {
  return path.startsWith("http://") || path.startsWith("https://") ? path : `${apiBase()}${path}`;
}

async function authFetch(path: string, init: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const timeoutMs = path.startsWith("/posture/analyze-video")
    ? VIDEO_ANALYSIS_TIMEOUT_MS
    : DEFAULT_REQUEST_TIMEOUT_MS;
  return fetchWithTimeout(apiPath(path), { ...init, headers }, timeoutMs);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetchWithTimeout(`${apiBase()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseResponse<AuthResponse>(response, "Invalid email or password.");
}

export async function register(name: string, email: string, password: string): Promise<AuthUser> {
  const response = await fetchWithTimeout(`${apiBase()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return parseResponse<AuthUser>(response, "Registration failed.");
}

export async function getMe(): Promise<AuthUser> {
  const response = await authFetch(`${apiBase()}/auth/me`);
  return parseResponse<AuthUser>(response, "Could not load user.");
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const response = await authFetch("/auth/profile");
  return parseResponse<UserProfile>(response, "Could not load profile.");
}

export async function fetchSubscription(): Promise<SubscriptionSummary> {
  const response = await authFetch("/auth/subscription");
  return parseResponse<SubscriptionSummary>(response, "Could not load subscription.");
}

export async function startTrial(): Promise<SubscriptionSummary> {
  const response = await authFetch("/auth/trial/start", { method: "POST" });
  return parseResponse<SubscriptionSummary>(response, "Could not start trial.");
}

export async function createPayosCheckout(): Promise<{ payment_url: string; payment_id: number; amount_vnd: number }> {
  const response = await authFetch("/billing/payos/start", { method: "POST" });
  return parseResponse<{ payment_url: string; payment_id: number; amount_vnd: number }>(response, "Could not start payment.");
}

export async function submitFeedback(params: FeedbackCreate): Promise<FeedbackItem> {
  const response = await authFetch("/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseResponse<FeedbackItem>(response, "Could not submit feedback.");
}

export async function fetchAdminFeedback(): Promise<AdminFeedbackItem[]> {
  const response = await authFetch("/admin/feedback");
  return parseResponse<AdminFeedbackItem[]>(response, "Could not load feedback.");
}

export async function fetchAdminAnalytics(range: AdminRange = "30d"): Promise<AdminAnalytics> {
  const response = await authFetch(`/admin/analytics?range=${encodeURIComponent(range)}`);
  const data = await parseResponse<Partial<AdminAnalytics>>(response, "Could not load admin analytics.");
  const usageEvents = data.usage_events || [];
  const videoAnalyses = data.top_metrics?.video_analyses
    ?? usageEvents.find((row) => row.event_name === "analysis_completed")?.count
    ?? 0;
  const planGenerations = data.top_metrics?.plan_generations
    ?? usageEvents
      .filter((row) => row.event_name === "weekly_workout_plan_created" || row.event_name === "weekly_meal_plan_created")
      .reduce((sum, row) => sum + row.count, 0);
  return {
    range: data.range || range,
    user_counts: {
      total: data.user_counts?.total ?? 0,
      new: data.user_counts?.new ?? 0,
      admins: data.user_counts?.admins ?? 0,
      regular: data.user_counts?.regular ?? 0,
    },
    top_metrics: {
      video_analyses: videoAnalyses,
      plan_generations: planGenerations,
    },
    discovery_sources: withPercent(data.discovery_sources || []),
    feature_usage: data.feature_usage || withPercent(
      usageEvents.map((row) => ({ feature: row.event_name.replaceAll("_", " "), count: row.count })),
    ),
    feedback_sources: withPercent(data.feedback_sources || []),
    rating_distribution: withPercent(data.rating_distribution || []),
    usage_events: withPercent(usageEvents),
    feedback_summary: {
      count: data.feedback_summary?.count ?? 0,
      average_rating: data.feedback_summary?.average_rating ?? null,
    },
    recent_events: data.recent_events || [],
  };
}

function withPercent<T extends { count: number; percentage?: number }>(rows: T[]): Array<T & { percentage: number }> {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows.map((row) => ({
    ...row,
    percentage: row.percentage ?? (total ? Math.round((row.count / total) * 1000) / 10 : 0),
  }));
}

export async function logUsageEvent(
  eventName: ClientUsageEventName,
  properties: Record<string, string | number | boolean | null> = {},
): Promise<{ ok: boolean }> {
  if (!getAuthToken()) return { ok: false };
  try {
    const response = await authFetch("/usage-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_name: eventName, properties }),
    });
    if (!response.ok) return { ok: false };
    return parseResponse<{ ok: boolean }>(response, "Could not log usage event.");
  } catch {
    return { ok: false };
  }
}

export async function updateUserProfile(params: UserProfileUpdate): Promise<UserProfile> {
  const response = await authFetch("/auth/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseResponse<UserProfile>(response, "Could not save profile.");
}

export async function logout(): Promise<{ message: string }> {
  const response = await authFetch(`${apiBase()}/auth/logout`, { method: "POST" });
  return parseResponse<{ message: string }>(response, "Could not log out.");
}

export async function loginWithGoogle(token: string): Promise<AuthResponse> {
  const response = await fetchWithTimeout(`${apiBase()}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return parseResponse<AuthResponse>(response, "Google sign-in failed.");
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const response = await fetch(`${apiBase()}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseResponse<{ message: string }>(response, "Could not request password reset.");
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const response = await fetch(`${apiBase()}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  return parseResponse<{ message: string }>(response, "Could not reset password.");
}

export async function verifyEmail(token: string): Promise<AuthUser> {
  const response = await fetch(`${apiBase()}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return parseResponse<AuthUser>(response, "Could not verify email.");
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  const response = await fetch(`${apiBase()}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseResponse<{ message: string }>(response, "Could not send verification email.");
}

export async function analyzeVideo(params: {
  file: File;
  exercise: ExerciseId;
  cameraView: CameraView;
  poseBackend: PoseBackend;
  callLlm: boolean;
  language: "en" | "vi";
  sampleFps: number;
  maxFrames: number;
  includePreview: boolean;
  previewMaxFrames: number;
}): Promise<VideoAnalysisResult> {
  const formData = new FormData();
  formData.append("exercise", params.exercise);
  formData.append("camera_view", params.cameraView);
  formData.append("pose_backend", params.poseBackend);
  formData.append("file", params.file);
  formData.append("call_llm", String(params.callLlm));
  formData.append("language", params.language);
  formData.append("sample_fps", String(params.sampleFps));
  formData.append("max_frames", String(params.maxFrames));
  formData.append("include_preview", String(params.includePreview));
  formData.append("preview_max_frames", String(params.previewMaxFrames));
  const response = await authFetch("/posture/analyze-video", {
    method: "POST",
    body: formData,
  });
  return parseResponse<VideoAnalysisResult>(response, "Video analysis failed.");
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const response = await authFetch("/analytics/summary");
  return parseResponse<AnalyticsSummary>(response, "Could not load analytics.");
}

export async function fetchWorkout(sessionId: string | number): Promise<WorkoutSession> {
  const response = await authFetch(`/workouts/${sessionId}`);
  return parseResponse<WorkoutSession>(response, "Could not load workout.");
}

export async function fetchWorkouts(limit = 100): Promise<WorkoutSession[]> {
  const response = await authFetch(`/workouts?limit=${encodeURIComponent(String(limit))}`);
  return parseResponse<WorkoutSession[]>(response, "Could not load workout history.");
}

export async function createWorkoutPlan(params: WorkoutPlanRequest): Promise<WorkoutPlan> {
  const response = await authFetch("/plans/workout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseResponse<WorkoutPlan>(response, "Could not create workout plan.");
}

export async function fetchLatestWorkoutPlan(): Promise<WorkoutPlan> {
  const response = await authFetch("/plans/workout/latest");
  return parseResponse<WorkoutPlan>(response, "No workout plan found.");
}

export async function createMealPlan(params: MealPlanRequest): Promise<MealPlan> {
  const response = await authFetch("/plans/meals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseResponse<MealPlan>(response, "Could not create meal plan.");
}

export async function fetchLatestMealPlan(): Promise<MealPlan> {
  const response = await authFetch("/plans/meals/latest");
  return parseResponse<MealPlan>(response, "No meal plan found.");
}

export function workoutToStoredAnalysis(workout: WorkoutSession): StoredAnalysis {
  const analysis = workout.analysis;
  const summary = analysis?.summary || workout.summary;
  if (!summary) {
    throw new Error("Workout has no analysis summary.");
  }

  return {
    id: String(workout.id),
    fileName: workout.file_name || "Uploaded video",
    analyzedAt: workout.completed_at || workout.created_at,
    result: {
      session_id: workout.id,
      analysis_id: workout.analysis_id || analysis?.id,
      exercise: workout.exercise,
      camera_view: workout.camera_view,
      pose_backend: workout.pose_backend,
      summary,
      llm: analysis?.llm || {
        enabled: false,
        model: "n/a",
        recommendations: "No persisted coaching text is available for this analysis.",
        error: null,
      },
      frame_log: [],
      preview_frames: [],
    },
  };
}

export function saveLatestAnalysis(analysis: StoredAnalysis) {
  latestAnalysisMemory = analysis;
  if (typeof window !== "undefined") {
    sessionStorage.setItem("gf_latest_analysis", JSON.stringify(analysis));
  }
}

export function readLatestAnalysis(): StoredAnalysis | null {
  if (latestAnalysisMemory) return latestAnalysisMemory;
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("gf_latest_analysis");
  if (!raw) return null;
  try {
    latestAnalysisMemory = JSON.parse(raw) as StoredAnalysis;
    return latestAnalysisMemory;
  } catch {
    return null;
  }
}
