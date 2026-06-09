"use client";

const ACTION_COUNT_KEY = "gf_feedback_action_count";
const SUBMITTED_KEY = "gf_feedback_submitted";
const DISMISSED_KEY = "gf_feedback_popup_dismissed";
const OPEN_EVENT = "gymfixer-feedback-open";
const THRESHOLD = 3;

export function recordMeaningfulAction() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SUBMITTED_KEY) === "true" || localStorage.getItem(DISMISSED_KEY) === "true") return;
  const current = Number(localStorage.getItem(ACTION_COUNT_KEY) || "0");
  const next = current + 1;
  localStorage.setItem(ACTION_COUNT_KEY, String(next));
  if (next >= THRESHOLD) {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT));
  }
}

export function listenForFeedbackPrompt(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}

export function markFeedbackSubmitted() {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUBMITTED_KEY, "true");
  localStorage.removeItem(DISMISSED_KEY);
}

export function markFeedbackPopupDismissed() {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISSED_KEY, "true");
}

export function hasHandledFeedbackPrompt() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SUBMITTED_KEY) === "true" || localStorage.getItem(DISMISSED_KEY) === "true";
}
