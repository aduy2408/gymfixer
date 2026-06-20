"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Activity, CheckCircle, ArrowRight } from "lucide-react";
import LanguageToggle from "@/components/LanguageToggle";
import { createPayosCheckout } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

const plans = [
    {
        name: "FREE",
        price: "$0",
        periodKey: "pricing.free.period",
        descriptionKey: "pricing.free.desc",
        features: [
            "pricing.free.f1",
            "pricing.free.f2",
            "pricing.free.f3",
            "pricing.free.f4",
        ],
        buttonKey: "pricing.free.cta",
        buttonClass: "btn-outline-red",
        isPopular: false,
        color: "var(--black)",
    },
    {
        name: "TRIAL",
        price: "$0",
        periodKey: "pricing.trial.period",
        descriptionKey: "pricing.trial.desc",
        features: [
            "pricing.trial.f1",
            "pricing.trial.f2",
            "pricing.trial.f3",
            "pricing.trial.f4",
            "pricing.trial.f5",
        ],
        buttonKey: "pricing.trial.cta",
        buttonClass: "btn-red",
        isPopular: true,
        color: "var(--red)",
    },
    {
        name: "PAID",
        price: "59.000đ",
        periodKey: "pricing.paid.period",
        descriptionKey: "pricing.paid.desc",
        features: [
            "pricing.paid.f1",
            "pricing.paid.f2",
            "pricing.paid.f3",
            "pricing.paid.f4",
            "pricing.trial.f5",
        ],
        buttonKey: "pricing.paid.cta",
        buttonClass: "btn-outline-white",
        isPopular: false,
        color: "var(--navy)",
    },
];

const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const },
    }),
};

const navButtonBase: React.CSSProperties = {
    minHeight: 44,
    borderRadius: 999,
    padding: "0.62rem 1.05rem",
    fontSize: "0.76rem",
    fontWeight: 900,
    lineHeight: 1.15,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    whiteSpace: "normal",
    maxWidth: 128,
};

export default function PricingPage() {
    const { t } = useI18n();
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [checkoutError, setCheckoutError] = useState("");

    const startCheckout = async () => {
        if (!getAuthToken()) {
            window.location.href = "/auth/login";
            return;
        }
        setCheckoutError("");
        setCheckoutLoading(true);
        try {
            const checkout = await createPayosCheckout();
            window.location.href = checkout.payment_url;
        } catch (err) {
            setCheckoutError(err instanceof Error ? err.message : t("billing.checkoutError"));
        } finally {
            setCheckoutLoading(false);
        }
    };

    return (
        <div style={{ background: "var(--white)", color: "var(--black)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

            {/* ─── Navbar ─── */}
            <nav
                className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 md:px-10 lg:px-14"
                style={{
                    background: "rgba(255,255,255,0.96)",
                    backdropFilter: "blur(12px)",
                    borderBottom: "1px solid var(--gray-mid)",
                    minHeight: 76,
                    gap: "1rem",
                }}
            >
                {/* Left Side: Logo */}
                <div className="flex-1 flex justify-start">
                    <Link href="/" className="flex items-center gap-2">
                        <div
                            className="w-8 h-8 rounded-md flex items-center justify-center"
                            style={{ background: "var(--red)" }}
                        >
                            <Activity size={16} color="white" />
                        </div>
                        <span
                            className="heading-condensed text-xl tracking-wider"
                            style={{ fontFamily: "var(--font-display)", fontWeight: 900, letterSpacing: "0.05em" }}
                        >
                            PTT<span style={{ color: "var(--red)" }}>.</span>
                        </span>
                    </Link>
                </div>

                {/* Center: Links */}
                <div className="hidden md:flex flex-[1.4] justify-center items-center gap-5 lg:gap-8 whitespace-nowrap">
                    {[
                        { label: t("nav.home"), href: "/#home", active: false },
                        { label: t("nav.features"), href: "/#features", active: false },
                        { label: t("nav.how"), href: "/#how-it-works", active: false },
                        { label: t("nav.faq"), href: "/#faq", active: false },
                        { label: t("nav.pricing"), href: "/pricing", active: true },
                    ].map((item) => (
                        <Link
                            key={item.label}
                            href={item.href}
                            className="text-sm font-bold uppercase transition-colors"
                            style={{ color: item.active ? "var(--red)" : "var(--black)", letterSpacing: "0.06em" }}
                            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--red)")}
                            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = item.active ? "var(--red)" : "var(--black)")}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                {/* Right Side: Auth Buttons */}
                <div className="flex-1 flex justify-end items-center gap-2.5">
                    <Link href="/auth/login">
                        <button
                            type="button"
                            style={{
                                ...navButtonBase,
                                border: "2px solid var(--red)",
                                background: "transparent",
                                color: "var(--red)",
                            }}
                        >
                            {t("auth.login")}
                        </button>
                    </Link>
                    <Link href="/auth/register" className="hidden sm:block">
                        <button
                            type="button"
                            style={{
                                ...navButtonBase,
                                border: "2px solid var(--red)",
                                background: "var(--red)",
                                color: "var(--white)",
                                maxWidth: 144,
                            }}
                        >
                            {t("auth.startFreeTrial")}
                        </button>
                    </Link>
                    <LanguageToggle compact />
                </div>
            </nav>

            {/* ─── Hero Section ─── */}
            <section className="px-5 md:px-10 lg:px-14 text-center" style={{ minHeight: "calc(100vh - 76px)", display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: "7rem", paddingBottom: "2.5rem", background: "var(--gray-light)", flex: 1 }}>
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                >
                    <p className="label-small mb-2" style={{ color: "var(--red)" }}>{t("pricing.eyebrow")}</p>
                    <h1 className="heading-condensed mb-3" style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)" }}>
                        {t("pricing.title")}
                    </h1>
                    <p className="text-sm max-w-2xl mx-auto mb-8" style={{ color: "var(--gray-dark)", fontWeight: 400, lineHeight: 1.65 }}>
                        {t("pricing.copy")}
                    </p>
                </motion.div>

                {/* ─── Pricing Cards ─── */}
                <div className="w-full max-w-6xl mx-auto grid md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
                    {plans.map((plan, i) => (
                        <motion.div
                            key={plan.name}
                            custom={i}
                            initial="hidden"
                            animate="visible"
                            variants={fadeUp}
                            className="relative flex flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-1"
                            style={{
                                background: plan.name === "PAID" ? "var(--navy)" : "var(--white)",
                                color: plan.name === "PAID" ? "var(--white)" : "var(--black)",
                                border: plan.name === "PAID" ? "none" : plan.name === "TRIAL" ? "2px solid var(--red)" : "1px solid var(--gray-mid)",
                                borderRadius: 24,
                                boxShadow: plan.isPopular ? "0 24px 50px rgba(214, 0, 28, 0.14)" : "0 14px 35px rgba(0,0,0,0.06)",
                                zIndex: plan.isPopular ? 10 : 1,
                            }}
                        >
                            {plan.isPopular && (
                                <div style={{ background: "var(--red)", color: "white", padding: "0.5rem", textAlign: "center", fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                    {t("pricing.popular")}
                                </div>
                            )}
                            <div className="flex-1 flex flex-col" style={{ padding: "2rem 1.8rem 1.85rem", textAlign: "left" }}>
                                <h3 className="heading-condensed" style={{ color: plan.name === "PAID" ? "var(--white)" : "var(--black)", fontSize: "1.35rem", textAlign: "center", marginBottom: "1.25rem" }}>{plan.name}</h3>
                                <div className="flex items-end gap-2 mb-4" style={{ minHeight: 58 }}>
                                    <span style={{ fontFamily: "var(--font-ui)", fontSize: "clamp(2.45rem, 4vw, 3.15rem)", lineHeight: 0.9, fontWeight: 900, letterSpacing: "0", color: plan.name === "PAID" ? "var(--white)" : "var(--black)" }}>{plan.price}</span>
                                    <span style={{ color: plan.name === "PAID" ? "rgba(255,255,255,0.68)" : "var(--gray-dark)", fontWeight: 700, fontSize: "1rem", paddingBottom: "0.15rem" }}>{t(plan.periodKey)}</span>
                                </div>
                                <p className="text-sm mb-5" style={{ color: plan.name === "PAID" ? "rgba(255,255,255,0.82)" : "var(--gray-dark)", lineHeight: 1.55, minHeight: 48 }}>{t(plan.descriptionKey)}</p>

                                <div className="divider-red mb-5" style={{ background: plan.name === "PAID" ? "rgba(255,255,255,0.22)" : "var(--gray-mid)", width: 70, height: 5 }} />

                                <ul className="space-y-3 mb-6 flex-1">
                                    {plan.features.map((featureKey, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5">
                                            <div className="mt-0.5 shrink-0" style={{ color: "var(--red)" }}>
                                                <CheckCircle size={17} />
                                            </div>
                                            <span className="text-sm" style={{ color: plan.name === "PAID" ? "rgba(255,255,255,0.92)" : "var(--black)", fontWeight: 700, lineHeight: 1.35 }}>{t(featureKey)}</span>
                                        </li>
                                    ))}
                                </ul>

                                {plan.name === "PAID" ? (
                                    <button
                                        type="button"
                                        onClick={startCheckout}
                                        disabled={checkoutLoading}
                                        className={plan.buttonClass}
                                        style={{ width: "100%", minHeight: 58, padding: "0.7rem 1rem", fontSize: "0.82rem", borderRadius: 999, display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", lineHeight: 1.15 }}
                                    >
                                        {checkoutLoading ? t("billing.redirecting") : t(plan.buttonKey)} <ArrowRight size={18} />
                                    </button>
                                ) : (
                                    <Link href={plan.name === "FREE" ? "/auth/register" : "/dashboard/profile"} style={{ width: "100%" }}>
                                        <button
                                            className={plan.buttonClass}
                                            style={{ width: "100%", minHeight: 58, padding: "0.7rem 1rem", fontSize: "0.82rem", borderRadius: 999, display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", lineHeight: 1.15 }}
                                        >
                                            {t(plan.buttonKey)} {plan.name !== "FREE" && <ArrowRight size={18} />}
                                        </button>
                                    </Link>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
                {checkoutError && (
                    <p className="mt-4 text-xs" style={{ color: "var(--red)", fontWeight: 700 }}>
                        {checkoutError}
                    </p>
                )}

                {/* ─── FAQ Reference ─── */}
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    className="mt-5"
                >
                    <p className="text-xs" style={{ color: "var(--gray-dark)" }}>
                        {t("pricing.faq")} <Link href="/#faq" style={{ color: "var(--red)", fontWeight: 600, textDecoration: "underline" }}>{t("pricing.faq.link")}</Link>.
                    </p>
                </motion.div>
            </section>

            {/* ─── Footer ─── */}
            <footer
                className="px-6 md:px-16 py-6"
                style={{ background: "var(--black)", color: "rgba(255,255,255,0.5)" }}
            >
                <div className="max-w-6xl mx-auto text-center">
                    <p className="text-xs">© 2026 PTT. {t("footer.rights")} · {t("footer.privacy")} · {t("footer.terms")}</p>
                </div>
            </footer>
        </div>
    );
}
