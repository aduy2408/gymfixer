"use client";

import { getAuthToken } from "./mockData";

export type ExerciseId = "squat" | "bicep_curl";
export type CameraView = "side" | "front" | "three_quarter";
export type PoseBackend = "mediapipe" | "vitpose";

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

type LoginResponse = {
  access_token: string;
  token_type: string;
};

type UserResponse = {
  id: number | string;
  name: string;
  email: string;
};

let latestAnalysisMemory: StoredAnalysis | null = null;

export function apiBase(): string {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envBase) return envBase.replace(/\/$/, "");

  return "http://localhost:5000";
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${apiBase()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || "Invalid email or password.");
  }
  return data;
}

export async function register(name: string, email: string, password: string): Promise<UserResponse> {
  const response = await fetch(`${apiBase()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || "Registration failed.");
  }
  return data;
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
  const token = getAuthToken();

  const response = await fetch(`${apiBase()}/posture/analyze-video`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || "Video analysis failed.");
  }
  return data;
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const response = await authFetch("/analytics/summary");
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || "Could not load analytics.");
  }
  return data;
}

export async function fetchWorkout(sessionId: string | number): Promise<WorkoutSession> {
  const response = await authFetch(`/workouts/${sessionId}`);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || "Could not load workout.");
  }
  return data;
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

async function authFetch(path: string, init: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${apiBase()}${path}`, { ...init, headers });
}

export function saveLatestAnalysis(analysis: StoredAnalysis) {
  latestAnalysisMemory = analysis;
  localStorage.removeItem("ptt_latest_analysis");
}

export function readLatestAnalysis(): StoredAnalysis | null {
  return latestAnalysisMemory;
}
