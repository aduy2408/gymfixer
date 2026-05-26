"use client";

import { getAuthToken } from "@/lib/auth";

export type ExerciseId = "squat" | "bicep_curl";
export type CameraView = "side" | "front" | "three_quarter";
export type PoseBackend = "mediapipe" | "vitpose";

export type AuthUser = {
  id: number | string;
  name: string;
  email: string;
  is_verified?: boolean;
  auth_provider?: string;
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
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
  gender: "male" | "female" | "other" | "";
  goal: "fat_loss" | "muscle" | "strength" | "endurance" | "rehab" | "general" | "";
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
}>;

export type VideoAnalysisResult = {
  session_id?: number;
  analysis_id?: number;
  exercise: string;
  camera_view?: CameraView | string;
  pose_backend?: string;
  summary: {
    camera_view?: CameraView | string;
    pose_backend?: string;
    frames_received: number;
    frames_analyzed: number;
    waiting_for_subject_frames?: number;
    rep_count: number;
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
  total_reps: number;
  sessions_by_exercise: Record<string, number>;
  reps_by_exercise: Record<string, number>;
  avg_quality_ratio: number | null;
  avg_processing_ms: number | null;
  top_feedback: Record<string, number>;
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
  days_per_week: number;
  session_minutes: number;
  equipment: string[];
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
  meals_per_day: number;
  diet_preference: "none" | "vegetarian" | "vegan" | "halal" | "low_carb";
  allergies?: string;
  disliked_foods?: string;
  budget: "low" | "medium" | "high";
  cooking_time: "minimal" | "normal" | "meal_prep";
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
  workout_sync?: {
    enabled: boolean;
    source_workout_plan_id: number | null;
    applied: boolean;
    note: string;
    schedule?: Record<string, string> | null;
  } | null;
  days: Array<{
    day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
    meals: Array<{
      name: string;
      time?: string;
      items: Array<
        | string
        | {
            name: string;
            quantity: number;
            unit: "g" | "ml" | "large" | "piece" | "slice" | "scoop" | "tbsp" | "cup";
            calories: number;
            protein_g: number;
            carbs_g: number;
            fat_g: number;
          }
      >;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    }>;
  }>;
  safety_notes: string[];
};

let latestAnalysisMemory: StoredAnalysis | null = null;

export function apiBase(): string {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  return "http://localhost:5000";
}

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || fallback);
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
  return fetch(apiPath(path), { ...init, headers });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${apiBase()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseResponse<AuthResponse>(response, "Invalid email or password.");
}

export async function register(name: string, email: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${apiBase()}/auth/register`, {
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
  const response = await fetch(`${apiBase()}/auth/google`, {
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
