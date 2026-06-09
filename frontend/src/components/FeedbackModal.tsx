"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send, Star, X } from "lucide-react";
import { FeedbackSource, submitFeedback } from "@/lib/api";
import { markFeedbackSubmitted } from "@/lib/feedbackPrompt";
import { useI18n } from "@/lib/i18n";

export default function FeedbackModal({
  open,
  source,
  onClose,
}: {
  open: boolean;
  source: FeedbackSource;
  onClose: (submitted?: boolean) => void;
}) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRating(0);
    setMessage("");
    setSaving(false);
    setError("");
    setSent(false);
  }, [open]);

  if (!open) return null;

  const canSubmit = rating > 0 && message.trim().length > 0 && !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      await submitFeedback({ rating, message: message.trim(), source });
      markFeedbackSubmitted();
      setSent(true);
      window.setTimeout(() => onClose(true), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("feedback.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", padding: "1rem", background: "rgba(0,0,0,0.45)" }}>
      <form onSubmit={handleSubmit} style={{ width: "min(440px, 100%)", background: "#fff", borderRadius: 8, border: "1px solid #e8e8e8", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden", fontFamily: "var(--font-ui)" }}>
        <div style={{ padding: "1rem 1rem 0.85rem", borderBottom: "1px solid #eee", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <div style={{ width: 38, height: 38, borderRadius: 6, background: "rgba(214,0,28,0.08)", color: "var(--red)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <MessageSquare size={18} />
            </div>
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 900, lineHeight: 1, textTransform: "uppercase" }}>{t("feedback.title")}</h2>
              <p style={{ fontSize: "0.82rem", color: "#777", lineHeight: 1.55, marginTop: "0.35rem" }}>{t("feedback.copy")}</p>
            </div>
          </div>
          <button type="button" onClick={() => onClose(false)} aria-label={t("common.cancel")} style={{ border: "none", background: "transparent", color: "#777", cursor: "pointer", padding: 2 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#555", marginBottom: "0.45rem" }}>{t("feedback.rating")}</label>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} ${t("feedback.stars")}`} style={{ width: 38, height: 38, border: "1px solid #eee", borderRadius: 6, background: value <= rating ? "var(--red)" : "#fafafa", color: value <= rating ? "#fff" : "#aaa", display: "grid", placeItems: "center", cursor: "pointer" }}>
                  <Star size={17} fill={value <= rating ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#555", marginBottom: "0.45rem" }}>{t("feedback.message")}</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t("feedback.placeholder")}
              maxLength={2000}
              rows={5}
              style={{ width: "100%", resize: "vertical", border: "none", outline: "none", borderRadius: 6, background: "#f2f2f2", padding: "0.85rem", color: "#111", fontSize: "0.88rem", lineHeight: 1.5 }}
            />
          </div>

          {error && <div style={{ border: "1px solid rgba(214,0,28,0.2)", background: "rgba(214,0,28,0.06)", color: "var(--red)", borderRadius: 6, padding: "0.75rem 0.85rem", fontSize: "0.82rem" }}>{error}</div>}
          {sent && <div style={{ border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.08)", color: "#047857", borderRadius: 6, padding: "0.75rem 0.85rem", fontSize: "0.82rem" }}>{t("feedback.thanks")}</div>}

          <div style={{ display: "flex", gap: "0.65rem" }}>
            <button type="button" onClick={() => onClose(false)} className="btn-outline-red" disabled={saving} style={{ flex: 1, justifyContent: "center", borderRadius: 4 }}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btn-red" disabled={!canSubmit} style={{ flex: 1, justifyContent: "center", borderRadius: 4, opacity: canSubmit ? 1 : 0.45 }}>
              <Send size={15} />
              {saving ? t("common.sending") : t("feedback.submit")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
