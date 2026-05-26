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

export type VideoAnalysisResult = {
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
    image: string;
  }>;
};

export type StoredAnalysis = {
  id: string;
  fileName: string;
  analyzedAt: string;
  result: VideoAnalysisResult;
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

async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
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

  const response = await authFetch(`${apiBase()}/posture/analyze-video`, {
    method: "POST",
    body: formData,
  });
  return parseResponse<VideoAnalysisResult>(response, "Video analysis failed.");
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
