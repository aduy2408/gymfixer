"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Save, CheckCircle } from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import Link from "next/link";
import {
    createPayosCheckout,
    fetchSubscription,
    fetchUserProfile,
    startTrial,
    SubscriptionSummary,
    updateUserProfile,
    UserProfile,
} from "@/lib/api";
import { setStoredUser } from "@/lib/auth";
import { Language, localeFor, tierLabel, useI18n } from "@/lib/i18n";
import { recordMeaningfulAction } from "@/lib/feedbackPrompt";

const goals = [
    { id: "fat_loss", emoji: "🔥", labelKey: "goals.fatLoss" },
    { id: "muscle", emoji: "💪", labelKey: "goals.muscle" },
    { id: "strength", emoji: "🏋️", labelKey: "goals.strength" },
    { id: "endurance", emoji: "🏃", labelKey: "goals.endurance" },
    { id: "rehab", emoji: "🩺", labelKey: "goals.rehab" },
    { id: "general", emoji: "⚡", labelKey: "goals.general" },
];

const discoverySources = [
    { id: "", labelKey: "profile.preferNot" },
    { id: "facebook", labelKey: "onboarding.discovery.facebook" },
    { id: "tiktok", labelKey: "onboarding.discovery.tiktok" },
    { id: "word_of_mouth", labelKey: "onboarding.discovery.wordOfMouth" },
];

const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#f2f2f2",
    border: "none",
    borderRadius: 4,
    padding: "9px 12px",
    fontSize: "0.8rem",
    color: "#0a0a0a",
    outline: "none",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.64rem",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: "0.3rem",
    color: "#555",
};

const sectionTitle = (text: string) => (
    <p style={{ fontSize: "0.64rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: "var(--red)", marginBottom: "0.8rem" }}>
        {text}
    </p>
);

const Divider = () => <hr style={{ border: "none", borderTop: "1px solid #e8e8e8", margin: "1.1rem 0" }} />;

function subscriptionCopy(subscription: SubscriptionSummary, t: (key: string) => string) {
    const tier = tierLabel(subscription.tier, t);
    const analysisLimit = formatLimit(subscription.limits.video_analyses, t);
    const analysisRemaining = formatLimit(subscription.remaining.video_analyses, t);
    if (subscription.tier === "trial") {
        const daysLeft = subscription.trial_ends_at
            ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000))
            : 0;
        return t("profile.trialCopy")
            .replace("{tier}", tier)
            .replace("{remaining}", analysisRemaining)
            .replace("{limit}", analysisLimit)
            .replace("{days}", String(daysLeft));
    }
    return t("profile.subCopy")
        .replace("{tier}", tier)
        .replace("{remaining}", analysisRemaining)
        .replace("{limit}", analysisLimit)
        .replace("{window}", t(`subscription.window.${subscription.window}`));
}

function subscriptionFeatures(subscription: SubscriptionSummary | null, t: (key: string) => string) {
    if (!subscription) return [t("common.loading")];
    return [
        `${formatLimit(subscription.remaining.video_analyses, t)}/${formatLimit(subscription.limits.video_analyses, t)} ${t("subscription.videoQuota")}`,
        `${formatLimit(subscription.remaining.ai_coaching, t)}/${formatLimit(subscription.limits.ai_coaching, t)} ${t("subscription.aiQuota")}`,
    ];
}

function formatLimit(value: number | null | undefined, t: (key: string) => string) {
    if (value === null) return t("common.unlimited");
    if (value === undefined) return t("common.none");
    return String(value);
}

export default function ProfilePage() {
    const { language, setLanguage, t } = useI18n();
    const [form, setForm] = useState({
        name: "",
        email: "",
        height: "",
        weight: "",
        age: "",
        gender: "",
        goal: "",
        discoverySource: "",
    });
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
    const [trialError, setTrialError] = useState("");
    const [startingTrial, setStartingTrial] = useState(false);
    const [billingLoading, setBillingLoading] = useState(false);
    const [billingError, setBillingError] = useState("");

    useEffect(() => {
        let cancelled = false;
        fetchUserProfile()
            .then((data) => {
                if (cancelled) return;
                setProfile(data);
                setForm({
                    name: data.name,
                    email: data.email,
                    height: data.height_cm ? String(data.height_cm) : "",
                    weight: data.weight_kg ? String(data.weight_kg) : "",
                    age: data.age ? String(data.age) : "",
                    gender: data.gender || "",
                    goal: data.goal || "",
                    discoverySource: data.discovery_source || "",
                });
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : t("profile.loadError"));
                setLoading(false);
            });
        fetchSubscription()
            .then((data) => {
                if (!cancelled) setSubscription(data);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [t]);

    const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            const updated = await updateUserProfile({
                name: form.name,
                email: form.email,
                height_cm: form.height ? Number(form.height) : undefined,
                weight_kg: form.weight ? Number(form.weight) : undefined,
                age: form.age ? Number(form.age) : undefined,
                gender: form.gender as "" | "male" | "female" | "other",
                goal: form.goal as "" | "fat_loss" | "muscle" | "strength" | "endurance" | "rehab" | "general",
                discovery_source: form.discoverySource as "" | "facebook" | "tiktok" | "word_of_mouth",
            });
            setProfile(updated);
            setStoredUser({
                id: updated.id,
                name: updated.name,
                email: updated.email,
                subscription_tier: updated.subscription_tier,
                role: updated.role,
                trial_started_at: updated.trial_started_at,
                trial_ends_at: updated.trial_ends_at,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
                setError(err instanceof Error ? err.message : t("profile.saveErrorShort"));
        }
    };

    const handleStartTrial = async () => {
        setTrialError("");
        setStartingTrial(true);
        try {
            const next = await startTrial();
            setSubscription(next);
            setStoredUser({
                id: profile?.id || "",
                name: form.name,
                email: form.email,
                subscription_tier: next.tier,
                role: profile?.role,
                trial_started_at: next.trial_started_at,
                trial_ends_at: next.trial_ends_at,
            });
            recordMeaningfulAction();
        } catch (err) {
            setTrialError(err instanceof Error ? err.message : t("profile.startTrialError"));
        } finally {
            setStartingTrial(false);
        }
    };

    const handleCheckout = async () => {
        setBillingError("");
        setBillingLoading(true);
        try {
            const checkout = await createPayosCheckout();
            window.location.href = checkout.payment_url;
        } catch (err) {
            setBillingError(err instanceof Error ? err.message : t("billing.checkoutError"));
            setBillingLoading(false);
        }
    };

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "var(--font-ui)" }}>
            <DashboardNav />
            <main style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.75rem" }}>
                <div style={{ maxWidth: 1040, margin: "0 auto" }}>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

                        <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "0.4rem" }}>{t("profile.eyebrow")}</p>
                        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.25rem" }}>
                            {t("profile.title")}
                        </h1>
                        <p style={{ fontSize: "0.8rem", color: "#999", fontWeight: 300, marginBottom: "1rem" }}>
                            {t("profile.copy")}
                        </p>

                        {loading && (
                            <div style={{ background: "#fff", padding: "1rem", borderRadius: 6, border: "1px solid #e8e8e8", color: "#777", fontSize: "0.85rem" }}>
                                {t("profile.loading")}
                            </div>
                        )}

                        {!loading && (
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]" style={{ marginTop: "1rem" }}>
                            {/* Left Side: Profile Form */}
                            <form onSubmit={handleSave} style={{ background: "#fff", padding: "1rem", borderRadius: 6, border: "1px solid #e8e8e8" }}>

                                {/* ── Account ── */}
                                {sectionTitle(t("profile.section.account"))}
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.9rem" }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 4, background: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", fontWeight: 900, color: "#fff", flexShrink: 0 }}>
                                        {form.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{form.name}</p>
                                        <p style={{ fontSize: "0.78rem", color: "#aaa", fontWeight: 300 }}>{form.email}</p>
                                        <p style={{ fontSize: "0.72rem", color: "#ccc", marginTop: "0.15rem" }}>
                                            {t("profile.memberSince")} {profile?.created_at ? new Date(profile.created_at).toLocaleDateString(localeFor(t), { month: "long", year: "numeric" }) : t("common.none")}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                    <div>
                                        <label style={labelStyle}>{t("profile.fullName")}</label>
                                        <input type="text" value={form.name} onChange={update("name")} style={inputStyle}
                                            onFocus={(e) => (e.target.style.background = "#e8e8e8")} onBlur={(e) => (e.target.style.background = "#f2f2f2")} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>{t("profile.email")}</label>
                                        <input type="email" value={form.email} onChange={update("email")} style={inputStyle}
                                            onFocus={(e) => (e.target.style.background = "#e8e8e8")} onBlur={(e) => (e.target.style.background = "#f2f2f2")} />
                                    </div>
                                </div>

                                <Divider />

                                {/* ── Body Metrics ── */}
                                {sectionTitle(t("profile.section.preferences"))}
                                <div>
                                    <label style={labelStyle}>{t("nav.language")}</label>
                                    <p style={{ fontSize: "0.78rem", color: "#777", lineHeight: 1.5, marginBottom: "0.7rem" }}>
                                        {t("profile.languageCopy")}
                                    </p>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                                        {([
                                            { value: "en", label: t("profile.language.english") },
                                            { value: "vi", label: t("profile.language.vietnamese") },
                                        ] as Array<{ value: Language; label: string }>).map((option) => {
                                            const active = language === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setLanguage(option.value)}
                                                    aria-pressed={active}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        gap: "0.5rem",
                                                        border: active ? "1px solid var(--red)" : "1px solid #e8e8e8",
                                                        borderRadius: 4,
                                                        background: active ? "rgba(214,0,28,0.06)" : "#fff",
                                                        color: active ? "var(--red)" : "#333",
                                                        cursor: "pointer",
                                                        fontSize: "0.8rem",
                                                        fontWeight: 800,
                                                        padding: "0.7rem 0.85rem",
                                                        textAlign: "left",
                                                        transition: "border-color 0.15s, background 0.15s, color 0.15s",
                                                    }}
                                                >
                                                    <span>{option.label}</span>
                                                    <span style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", color: active ? "var(--red)" : "#999" }}>
                                                        {option.value}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <Divider />

                                {sectionTitle(t("profile.section.metrics"))}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                                    {[
                                        { key: "height", label: t("profile.height") },
                                        { key: "weight", label: t("profile.weight") },
                                        { key: "age", label: t("profile.age") },
                                    ].map(({ key, label }) => (
                                        <div key={key}>
                                            <label style={labelStyle}>{label}</label>
                                            <input type="number" value={form[key as keyof typeof form]} onChange={update(key)} style={inputStyle}
                                                onFocus={(e) => (e.target.style.background = "#e8e8e8")} onBlur={(e) => (e.target.style.background = "#f2f2f2")} />
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <label style={labelStyle}>{t("profile.gender")}</label>
                                    <select value={form.gender} onChange={update("gender") as React.ChangeEventHandler<HTMLSelectElement>}
                                        style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}>
                                        <option value="">{t("profile.preferNot")}</option>
                                        <option value="male">{t("profile.gender.male")}</option>
                                        <option value="female">{t("profile.gender.female")}</option>
                                        <option value="other">{t("profile.gender.other")}</option>
                                    </select>
                                </div>

                                <Divider />

                                {sectionTitle(t("profile.section.discovery"))}
                                <select value={form.discoverySource} onChange={update("discoverySource") as React.ChangeEventHandler<HTMLSelectElement>}
                                    style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}>
                                    {discoverySources.map((source) => (
                                        <option key={source.id || "none"} value={source.id}>{t(source.labelKey)}</option>
                                    ))}
                                </select>

                                <Divider />

                                {/* ── Fitness Goal ── */}
                                {sectionTitle(t("profile.section.goal"))}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8" }}>
                                    {goals.map((g) => (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, goal: g.id }))}
                                            style={{
                                                background: form.goal === g.id ? "var(--red)" : "#fff",
                                                color: form.goal === g.id ? "#fff" : "#444",
                                                border: "none",
                                                padding: "0.55rem 0.45rem",
                                                fontSize: "0.72rem",
                                                fontWeight: form.goal === g.id ? 700 : 400,
                                                cursor: "pointer",
                                                textAlign: "center",
                                                transition: "background 0.12s",
                                            }}
                                        >
                                            {g.emoji} {t(g.labelKey)}
                                        </button>
                                    ))}
                                </div>

                                <Divider />

                                {error && (
                                    <>
                                        <div style={{ border: "1px solid rgba(214,0,28,0.2)", background: "rgba(214,0,28,0.06)", color: "var(--red)", borderRadius: 4, padding: "0.75rem 1rem", fontSize: "0.82rem" }}>
                                            {error}
                                        </div>
                                        <Divider />
                                    </>
                                )}

                                {/* ── Save button ── */}
                                <button
                                    type="submit"
                                    className="btn-red"
                                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", gap: "0.5rem", padding: "0.65rem", fontSize: "0.78rem", borderRadius: 4 }}
                                >
                                    {saved ? <><CheckCircle size={15} /> {t("profile.saved").toUpperCase()}</> : <><Save size={15} /> {t("profile.save").toUpperCase()}</>}
                                </button>

                                <Divider />

                                {/* ── Danger zone ── */}
                                {sectionTitle(t("profile.danger"))}
                                <p style={{ fontSize: "0.78rem", color: "#aaa", fontWeight: 300, marginBottom: "0.75rem" }}>
                                    {t("profile.deleteCopy")}
                                </p>
                                <button
                                    type="button"
                                    style={{ padding: "0.5rem 1.1rem", border: "1px solid #eee", borderRadius: 4, background: "none", color: "#ccc", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", transition: "border-color 0.15s, color 0.15s" }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--red)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#eee"; (e.currentTarget as HTMLButtonElement).style.color = "#ccc"; }}
                                >
                                    {t("profile.delete")}
                                </button>
                            </form>

                            {/* Right Side: Plans Overview */}
                            <div>
                                <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 6, padding: "1rem", position: "sticky", top: "1.25rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.9rem" }}>
                                        <div>
                                            {sectionTitle(t("subscription.current"))}
                                            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.8rem", lineHeight: 1, color: "var(--black)", marginTop: "-0.25rem" }}>
                                                {tierLabel(subscription?.tier || profile?.subscription_tier || "free", t).toUpperCase()} <span style={{ fontSize: "1rem", color: "#888", fontWeight: 500, fontFamily: "var(--font-ui)", textTransform: "none" }}>{t("common.plan")}</span>
                                            </p>
                                        </div>
                                        <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "0.3rem 0.6rem", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            {subscription?.trial_expired ? t("common.expired") : t("common.active")}
                                        </div>
                                    </div>

                                    <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: "1rem", lineHeight: 1.45 }}>
                                        {subscription ? subscriptionCopy(subscription, t) : t("profile.loadingSub")}
                                    </p>

                                    {subscription?.billing && (
                                        <div style={{ padding: "0.9rem", background: "#f9f9f9", borderRadius: 6, border: "1px solid #f0f0f0", marginBottom: "1rem" }}>
                                            <p style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.65rem", color: "#333", textTransform: "uppercase" }}>
                                                {t("billing.title")}
                                            </p>
                                            <p style={{ fontSize: "0.78rem", color: "#555", marginBottom: "0.35rem" }}>
                                                {t("billing.price")}
                                            </p>
                                            <p style={{ fontSize: "0.78rem", color: "#555", marginBottom: "0.35rem" }}>
                                                {t("billing.endsOn")}{" "}
                                                {subscription.billing.current_period_end
                                                    ? new Date(subscription.billing.current_period_end).toLocaleDateString(localeFor(t))
                                                    : t("common.none")}
                                            </p>
                                            {subscription.billing.payment_method && (
                                                <p style={{ fontSize: "0.78rem", color: "#555" }}>
                                                    {t("billing.paymentMethod")}: {subscription.billing.payment_method.masked_card || subscription.billing.payment_method.bank_code || "PayOS"}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div style={{ padding: "0.9rem", background: "#f9f9f9", borderRadius: 6, border: "1px solid #f0f0f0", marginBottom: "1rem" }}>
                                        <p style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.7rem", color: "#333", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("profile.featuresIncluded")}</p>
                                        <ul style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                                            {subscriptionFeatures(subscription, t).map((feature, i) => (
                                                <li key={i} style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.78rem", color: "#555" }}>
                                                    <CheckCircle size={15} color="var(--red)" /> {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {trialError && <div style={{ marginBottom: "0.75rem" }}><p style={{ color: "var(--red)", fontSize: "0.78rem" }}>{trialError}</p></div>}
                                    {billingError && <div style={{ marginBottom: "0.75rem" }}><p style={{ color: "var(--red)", fontSize: "0.78rem" }}>{billingError}</p></div>}

                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                        {subscription?.tier === "free" && !subscription.trial_started_at && (
                                            <button type="button" onClick={handleStartTrial} className="btn-outline-red" disabled={startingTrial} style={{ width: "100%", padding: "0.65rem", fontSize: "0.78rem", borderRadius: 4 }}>
                                                {startingTrial ? t("common.loading") : t("subscription.startTrial")}
                                            </button>
                                        )}
                                        <button type="button" onClick={handleCheckout} disabled={billingLoading} className={subscription?.tier === "paid" ? "btn-outline-red" : "btn-red"} style={{ width: "100%", padding: "0.65rem", fontSize: "0.78rem", borderRadius: 4 }}>
                                            {billingLoading
                                                ? t("billing.redirecting")
                                                : subscription?.tier === "paid"
                                                    ? t("billing.extend")
                                                    : t("profile.upgradePlan")}
                                        </button>
                                        {!subscription?.billing && (
                                            <Link href="/pricing" style={{ width: "100%" }}>
                                                <button className="btn-outline-red" style={{ width: "100%", padding: "0.65rem", fontSize: "0.78rem", borderRadius: 4 }}>
                                                    {t("subscription.manageBilling")}
                                                </button>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
