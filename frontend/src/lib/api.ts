"use client";

export type ExerciseId = "squat" | "bicep_curl";

export type VideoAnalysisResult = {
  exercise: string;
  summary: {
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
  callLlm: boolean;
  sampleFps: number;
  maxFrames: number;
  includePreview: boolean;
  previewMaxFrames: number;
}): Promise<VideoAnalysisResult> {
  const formData = new FormData();
  formData.append("exercise", params.exercise);
  formData.append("file", params.file);
  formData.append("call_llm", String(params.callLlm));
  formData.append("sample_fps", String(params.sampleFps));
  formData.append("max_frames", String(params.maxFrames));
  formData.append("include_preview", String(params.includePreview));
  formData.append("preview_max_frames", String(params.previewMaxFrames));

  const response = await fetch(`${apiBase()}/posture/analyze-video`, {
    method: "POST",
    body: formData,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || "Video analysis failed.");
  }
  return data;
}

export function saveLatestAnalysis(analysis: StoredAnalysis) {
  latestAnalysisMemory = analysis;
  localStorage.removeItem("ptt_latest_analysis");
}

export function readLatestAnalysis(): StoredAnalysis | null {
  return latestAnalysisMemory;
}
