"use client";

import AuthGuard from "@/components/AuthGuard";
import FeedbackPromptController from "@/components/FeedbackPromptController";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {children}
      <FeedbackPromptController />
    </AuthGuard>
  );
}
