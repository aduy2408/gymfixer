"use client";

import { Languages } from "lucide-react";
import { Language, useI18n } from "@/lib/i18n";

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useI18n();
  const options: Language[] = ["en", "vi"];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        border: "1px solid #e5e7eb",
        background: "#fff",
        borderRadius: 6,
        padding: 3,
      }}
      title={t("nav.language")}
    >
      {!compact && <Languages size={14} color="#777" style={{ marginLeft: 4 }} />}
      {options.map((option) => {
        const active = option === language;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setLanguage(option)}
            aria-pressed={active}
            style={{
              border: "none",
              borderRadius: 4,
              background: active ? "var(--red)" : "transparent",
              color: active ? "#fff" : "#444",
              cursor: "pointer",
              fontSize: "0.68rem",
              fontWeight: 800,
              minWidth: 30,
              padding: "0.32rem 0.45rem",
              textTransform: "uppercase",
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
