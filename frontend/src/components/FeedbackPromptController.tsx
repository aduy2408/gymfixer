"use client";

import { useEffect, useState } from "react";
import FeedbackModal from "@/components/FeedbackModal";
import { hasHandledFeedbackPrompt, listenForFeedbackPrompt, markFeedbackPopupDismissed } from "@/lib/feedbackPrompt";
import { logUsageEvent } from "@/lib/api";

export default function FeedbackPromptController() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return listenForFeedbackPrompt(() => {
      if (!hasHandledFeedbackPrompt()) {
        void logUsageEvent("feedback_popup_shown");
        setOpen(true);
      }
    });
  }, []);

  return (
    <FeedbackModal
      open={open}
      source="popup"
      onClose={(submitted) => {
        setOpen(false);
        if (!submitted) {
          void logUsageEvent("feedback_popup_dismissed");
          markFeedbackPopupDismissed();
        }
      }}
    />
  );
}
