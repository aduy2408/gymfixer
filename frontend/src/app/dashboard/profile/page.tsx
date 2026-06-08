"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ShieldAlert, Loader2, Save, User as UserIcon, Crown, Edit2 } from "lucide-react";
import DashboardNav from "@/components/DashboardNav";
import { fetchUserProfile, fetchSubscription, updateUserProfile, SubscriptionSummary } from "@/lib/api";
import { useI18n, tierLabel } from "@/lib/i18n";

const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 6,
};

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "0.4rem",
    color: "#555",
};

const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#f2f2f2",
    border: "none",
    borderRadius: 4,
    padding: "11px 14px",
    fontSize: "0.86rem",
    color: "#0a0a0a",
    outline: "none",
};

export default function ProfilePage() {
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [originalForm, setOriginalForm] = useState<any>(null);
    const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);

    const [form, setForm] = useState({
        full_name: "",
        email: "",
        is_verified: false,
    });

    useEffect(() => {
        let cancelled = false;
        async function loadData() {
            try {
                const [profileResult, subResult] = await Promise.allSettled([
                    fetchUserProfile(),
                    fetchSubscription()
                ]);

                if (cancelled) return;

                if (profileResult.status === "fulfilled") {
                    const data = profileResult.value;
                    const initialForm = {
                        full_name: data.name || "",
                        email: data.email || "",
                        is_verified: data.is_verified || false,
                    };
                    setForm(initialForm);
                    setOriginalForm(initialForm);
                } else {
                    setError(t("profile.loadError"));
                }

                if (subResult.status === "fulfilled") {
                    setSubscription(subResult.value);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadData();
        return () => { cancelled = true; };
    }, [t]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        setSaving(true);
        setError("");
        setSuccessMsg("");
        try {
            const updated = await updateUserProfile({ name: form.full_name });
            setOriginalForm({ ...form, full_name: updated.name || form.full_name });
            setIsEditing(false);
            setSuccessMsg(t("profile.saved"));
            window.dispatchEvent(new Event("userProfileUpdated"));
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (err) {
            setError(t("profile.saveErrorShort"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Barlow', sans-serif" }}>
            <DashboardNav />
            <main style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
                <div style={{ maxWidth: 900, margin: "0 auto" }}>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "1.5rem" }}>
                        <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--red)", marginBottom: "0.35rem" }}>
                            {t("profile.eyebrow")}
                        </p>
                        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2.25rem", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.35rem" }}>
                            {t("profile.title")}
                        </h1>
                        <p style={{ fontSize: "0.84rem", color: "#888" }}>
                            {t("profile.copy")}
                        </p>
                    </motion.div>

                    {loading ? (
                        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
                            <Loader2 size={32} className="animate-spin" color="#ccc" />
                        </div>
                    ) : (
                        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                            <form onSubmit={handleSave} style={{ ...cardStyle, padding: "1.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "2rem" }}>
                                <div style={{ position: "relative", width: 80, height: 80, borderRadius: "50%", background: "#f0f0f0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <UserIcon size={40} color="#bbb" />
                                </div>
                                    <div>
                                        <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>{form.full_name || t("common.defaultUser")}</h3>
                                        <p style={{ fontSize: "0.8rem", color: "#777", marginTop: "0.2rem" }}>{form.email}</p>
                                    </div>
                                </div>

                            <div>
                                <label style={labelStyle}>{t("profile.fullName")}</label>
                                <input type="text" name="full_name" value={form.full_name} onChange={handleChange} style={{ ...inputStyle, background: isEditing ? "#f2f2f2" : "#fafafa", cursor: isEditing ? "text" : "not-allowed" }} disabled={!isEditing} required />
                            </div>
                                <div style={{ marginTop: "1rem" }}>
                                    <label style={labelStyle}>{t("profile.email")}</label>
                                    <input type="email" value={form.email} style={{ ...inputStyle, background: "#fafafa", color: "#888", cursor: "not-allowed" }} disabled />
                                </div>

                                {error && <p style={{ color: "var(--red)", fontSize: "0.8rem", marginTop: "1rem" }}>{error}</p>}
                                {successMsg && <p style={{ color: "#10b981", fontSize: "0.8rem", marginTop: "1rem" }}>{successMsg}</p>}

                                <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                                    {!isEditing ? (
                                        <button type="button" onClick={(e) => { e.preventDefault(); setIsEditing(true); setSuccessMsg(""); }} className="btn-red" style={{ borderRadius: 4, padding: "0.65rem 1.5rem" }}>
                                            <Edit2 size={16} /> {t("profile.edit")}
                                        </button>
                                    ) : (
                                        <>
                                            <button type="button" onClick={() => { setIsEditing(false); setForm(originalForm); setError(""); }} className="btn-outline-red" disabled={saving} style={{ borderRadius: 4, padding: "0.65rem 1.5rem" }}>
                                                {t("common.cancel")}
                                            </button>
                                            <button type="submit" className="btn-red" disabled={saving} style={{ borderRadius: 4, padding: "0.65rem 1.5rem", opacity: saving ? 0.7 : 1 }}>
                                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                                {t("profile.save")}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </form>

                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <div style={{ ...cardStyle, padding: "1.25rem", background: "linear-gradient(135deg, #211551 0%, #2f226d 100%)", color: "#fff" }}>
                                    <p style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem" }}>{t("subscription.current")}</p>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.25rem", fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif" }}>
                                        <Crown size={20} color="#f59e0b" /> {subscription ? tierLabel(subscription.tier, t) : "..."}
                                    </div>
                                </div>
                                <div style={{ ...cardStyle, padding: "1.25rem", display: "flex", alignItems: "center", gap: "0.85rem" }}>
                                    {form.is_verified ? <CheckCircle size={24} color="#10b981" /> : <ShieldAlert size={24} color="#f59e0b" />}
                                    <div>
                                        <p style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555" }}>{t("profile.verificationStatus")}</p>
                                        <p style={{ fontSize: "0.95rem", fontWeight: 700, color: form.is_verified ? "#10b981" : "#f59e0b", marginTop: "0.15rem" }}>{form.is_verified ? t("profile.verified") : t("profile.unverified")}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}