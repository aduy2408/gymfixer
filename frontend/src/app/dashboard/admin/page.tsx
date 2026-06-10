"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Clock3, MessageSquare, PieChart as PieIcon, Star, Users } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import DashboardNav from "@/components/DashboardNav";
import { AdminAnalytics, AdminFeedbackItem, AdminRange, fetchAdminAnalytics, fetchAdminFeedback, logUsageEvent } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { localeFor, useI18n } from "@/lib/i18n";

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e8e8e8",
  borderRadius: 6,
};

const chartColors = ["var(--red)", "#111827", "#f59e0b", "#10b981", "#6366f1", "#8b5cf6", "#64748b"];
const ranges: AdminRange[] = ["7d", "30d", "all"];

type ChartRow = {
  label: string;
  count: number;
  percentage: number;
};

export default function AdminPage() {
  const { t } = useI18n();
  const user = useMemo(() => (typeof window === "undefined" ? null : getStoredUser()), []);
  const isAdmin = user?.role === "admin";
  const [range, setRange] = useState<AdminRange>("30d");
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedbackItem[]>([]);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    void logUsageEvent("admin_viewed", { range });
    Promise.all([fetchAdminAnalytics(range), fetchAdminFeedback()])
      .then(([analyticsData, feedbackData]) => {
        if (cancelled) return;
        setAnalytics(analyticsData);
        setFeedback(feedbackData);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("common.unknownError"));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, range, t]);

  const changeRange = (next: AdminRange) => {
    setRange(next);
    setLoading(true);
    setError("");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "var(--font-ui)" }}>
      <DashboardNav />
      <main style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.75rem" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", marginBottom: "1rem" }}>
            <div>
              <p style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "0.4rem" }}>
                {t("nav.admin")}
              </p>
              <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.8rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.35rem" }}>
                {t("admin.title")}
              </h1>
              <p style={{ fontSize: "0.84rem", color: "#888", lineHeight: 1.55 }}>{t("admin.copy")}</p>
            </div>
            {isAdmin && (
              <div style={{ display: "flex", gap: 2, background: "#e8e8e8", border: "1px solid #e8e8e8", borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                {ranges.map((item) => (
                  <button key={item} type="button" onClick={() => changeRange(item)} style={{ border: "none", background: range === item ? "var(--red)" : "#fff", color: range === item ? "#fff" : "#333", padding: "0.55rem 0.75rem", fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", cursor: "pointer" }}>
                    {t(`admin.range.${item}`)}
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {!isAdmin && (
            <div style={{ ...cardStyle, padding: "1rem", color: "var(--red)", fontSize: "0.88rem", fontWeight: 700 }}>
              {t("admin.denied")}
            </div>
          )}

          {isAdmin && loading && (
            <div style={{ ...cardStyle, padding: "1rem", color: "#777", fontSize: "0.85rem" }}>{t("common.loading")}</div>
          )}

          {isAdmin && error && (
            <div style={{ ...cardStyle, padding: "1rem", color: "var(--red)", fontSize: "0.85rem" }}>{error}</div>
          )}

          {isAdmin && !loading && !error && analytics && (
            <>
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" style={{ marginBottom: "1rem" }}>
                <AdminMetric icon={<Users size={18} />} label={t("admin.users")} value={analytics.user_counts.total} />
                <AdminMetric icon={<Users size={18} />} label={t("admin.newUsers")} value={analytics.user_counts.new} />
                <AdminMetric icon={<MessageSquare size={18} />} label={t("feedback.nav")} value={analytics.feedback_summary.count} />
                <AdminMetric icon={<Star size={18} />} label={t("admin.rating")} value={analytics.feedback_summary.average_rating ?? t("common.none")} />
                <AdminMetric icon={<PieIcon size={18} />} label={t("admin.videoAnalyses")} value={analytics.top_metrics.video_analyses} />
                <AdminMetric icon={<BarChart3 size={18} />} label={t("admin.planGenerations")} value={analytics.top_metrics.plan_generations} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2" style={{ marginBottom: "1rem" }}>
                <AnalyticsBreakdownCard title={t("admin.sources")} rows={analytics.discovery_sources.map((row) => ({ label: formatSource(row.source, t), count: row.count, percentage: row.percentage }))} />
                <AnalyticsBreakdownCard title={t("admin.usage")} rows={analytics.feature_usage.map((row) => ({ label: row.feature, count: row.count, percentage: row.percentage }))} />
                <AnalyticsBreakdownCard title={t("admin.feedbackSources")} rows={analytics.feedback_sources.map((row) => ({ label: formatFeedbackSource(row.source), count: row.count, percentage: row.percentage }))} />
                <AnalyticsBreakdownCard title={t("admin.ratingDistribution")} rows={analytics.rating_distribution.map((row) => ({ label: `${row.rating} ${t("feedback.stars")}`, count: row.count, percentage: row.percentage }))} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
                <FeedbackTable feedback={feedback} t={t} />
                <RecentEventsTable events={analytics.recent_events} t={t} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.6rem 0.45rem",
  fontSize: "0.64rem",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const tdStyle: React.CSSProperties = {
  padding: "0.68rem 0.45rem",
};

function AdminMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ ...cardStyle, padding: "0.85rem" }}>
      <div style={{ color: "var(--red)", marginBottom: "0.45rem" }}>{icon}</div>
      <p style={{ fontSize: "0.62rem", fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem" }}>{label}</p>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.45rem", lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function AnalyticsBreakdownCard({ title, rows }: { title: string; rows: ChartRow[] }) {
  const { t } = useI18n();
  const [view, setView] = useState<"pie" | "list">("pie");
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const data = rows.filter((row) => row.count > 0);

  return (
    <section style={{ ...cardStyle, padding: "1rem", minHeight: 315 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "0.85rem" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.12rem", textTransform: "uppercase" }}>{title}</h2>
        <div style={{ display: "flex", gap: 1, background: "#eee", borderRadius: 5, overflow: "hidden" }}>
          {(["pie", "list"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setView(item)} style={{ border: "none", background: view === item ? "var(--red)" : "#fff", color: view === item ? "#fff" : "#555", padding: "0.38rem 0.55rem", fontSize: "0.66rem", fontWeight: 900, textTransform: "uppercase", cursor: "pointer" }}>
              {t(`admin.view.${item}`)}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p style={{ fontSize: "0.84rem", color: "#888" }}>n/a</p>
      ) : view === "pie" ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 1fr) minmax(0, 1fr)", gap: "0.75rem", alignItems: "center" }}>
          <div style={{ height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="label" innerRadius={48} outerRadius={82} paddingAngle={2}>
                  {data.map((row, index) => (
                    <Cell key={row.label} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            {data.slice(0, 6).map((row, index) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.76rem" }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: chartColors[index % chartColors.length], flexShrink: 0 }} />
                <span style={{ flex: 1, color: "#333", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
                <span style={{ color: "#888" }}>{row.percentage}%</span>
              </div>
            ))}
            <p style={{ marginTop: "0.25rem", color: "#999", fontSize: "0.72rem" }}>{t("common.total")}: {total}</p>
          </div>
        </div>
      ) : (
        <CompactList rows={data} />
      )}
    </section>
  );
}

function CompactList({ rows }: { rows: ChartRow[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.58rem" }}>
      {rows.map((row) => (
        <div key={row.label}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: "0.65rem", marginBottom: "0.22rem", fontSize: "0.78rem", alignItems: "center" }}>
            <span style={{ fontWeight: 800, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
            <span style={{ color: "#777" }}>{row.count}</span>
            <span style={{ color: "#999" }}>{row.percentage}%</span>
          </div>
          <div style={{ height: 6, background: "#f0f0f0", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(5, row.percentage)}%`, height: "100%", background: "var(--red)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedbackTable({ feedback, t }: { feedback: AdminFeedbackItem[]; t: (key: string) => string }) {
  return (
    <section style={{ ...cardStyle, padding: "1rem" }}>
      <SectionTitle icon={<BarChart3 size={17} />} title={t("admin.feedback")} />
      {feedback.length === 0 ? (
        <p style={{ fontSize: "0.84rem", color: "#888" }}>{t("admin.noFeedback")}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#777", borderBottom: "1px solid #eee" }}>
                <th style={thStyle}>User</th>
                <th style={thStyle}>{t("feedback.rating")}</th>
                <th style={thStyle}>{t("feedback.message")}</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Date</th>
              </tr>
            </thead>
            <tbody>
              {feedback.slice(0, 20).map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f1f1", verticalAlign: "top" }}>
                  <td style={tdStyle}>
                    <strong style={{ display: "block", color: "#222" }}>{item.user_name}</strong>
                    <span style={{ color: "#999" }}>User ID: {item.user_id}</span>
                  </td>
                  <td style={tdStyle}>{item.rating}/5</td>
                  <td style={{ ...tdStyle, minWidth: 220, lineHeight: 1.45 }}>{item.message}</td>
                  <td style={tdStyle}>{formatFeedbackSource(item.source)}</td>
                  <td style={tdStyle}>{new Date(item.created_at).toLocaleDateString(localeFor(t))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentEventsTable({ events, t }: { events: AdminAnalytics["recent_events"]; t: (key: string) => string }) {
  return (
    <section style={{ ...cardStyle, padding: "1rem" }}>
      <SectionTitle icon={<Clock3 size={17} />} title={t("admin.recentEvents")} />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
        {events.length === 0 ? (
          <p style={{ fontSize: "0.84rem", color: "#888" }}>n/a</p>
        ) : events.slice(0, 18).map((event) => (
          <div key={event.id} style={{ borderBottom: "1px solid #f1f1f1", paddingBottom: "0.65rem" }}>
            <p style={{ fontSize: "0.78rem", fontWeight: 900, color: "#222", textTransform: "capitalize" }}>{formatEventName(event.event_name)}</p>
            <p style={{ fontSize: "0.72rem", color: "#888", marginTop: "0.16rem" }}>
              {event.user_id ? `User ID: ${event.user_id}` : "anonymous"} · {new Date(event.created_at).toLocaleString(localeFor(t), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
      <span style={{ color: "var(--red)" }}>{icon}</span>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.12rem", textTransform: "uppercase" }}>{title}</h2>
    </div>
  );
}

function formatSource(source: string, t: (key: string) => string) {
  if (source === "facebook") return t("onboarding.discovery.facebook");
  if (source === "tiktok") return t("onboarding.discovery.tiktok");
  if (source === "word_of_mouth") return t("onboarding.discovery.wordOfMouth");
  return source || "unknown";
}

function formatFeedbackSource(source: string) {
  if (source === "popup") return "Popup";
  if (source === "sidebar") return "Sidebar";
  return source || "unknown";
}

function formatEventName(eventName: string) {
  return eventName.replaceAll("_", " ");
}
