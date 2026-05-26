"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Activity, CheckCircle, ArrowRight } from "lucide-react";

const plans = [
    {
        name: "FREE",
        price: "$0",
        period: "/ forever",
        description: "Perfect for testing our AI capabilities.",
        features: [
            "5 Video Uploads per month",
            "Basic Pose Analysis",
            "Standard Processing Time",
            "Community Support",
        ],
        buttonText: "Get Started Free",
        buttonClass: "btn-outline-red",
        isPopular: false,
        color: "var(--black)",
    },
    {
        name: "PLUS",
        price: "$15",
        period: "/ month",
        description: "For dedicated athletes wanting regular feedback.",
        features: [
            "50 Video Uploads per month",
            "Advanced Joint Angle Tracking",
            "Fast Processing (< 2min)",
            "Progress History Dashboard",
            "Priority Email Support",
        ],
        buttonText: "Start 7-Day Trial",
        buttonClass: "btn-red",
        isPopular: true,
        color: "var(--red)",
    },
    {
        name: "PRO",
        price: "$39",
        period: "/ month",
        description: "Elite tier for coaches and professional athletes.",
        features: [
            "Unlimited Video Uploads",
            "Personalized AI Coaching Insights",
            "Instant Processing (GPU Priority)",
            "3D Pose Export (FBX integration)",
            "1-on-1 Expert Feedback Sessions",
        ],
        buttonText: "Upgrade to Pro",
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

export default function PricingPage() {
    return (
        <div style={{ background: "var(--white)", color: "var(--black)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

            {/* ─── Navbar ─── */}
            <nav
                className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-16 py-4"
                style={{
                    background: "rgba(255,255,255,0.96)",
                    backdropFilter: "blur(12px)",
                    borderBottom: "1px solid var(--gray-mid)",
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
                <div className="hidden md:flex flex-1 justify-center items-center gap-8 lg:gap-10 whitespace-nowrap">
                    {[
                        { label: "Home", href: "/#home" },
                        { label: "Features", href: "/#features" },
                        { label: "How It Works", href: "/#how-it-works" },
                        { label: "FAQ", href: "/#faq" },
                        { label: "Pricing", href: "/pricing" },
                    ].map((item) => (
                        <Link
                            key={item.label}
                            href={item.href}
                            className="text-sm font-bold uppercase tracking-wider transition-colors"
                            style={{ color: item.label === "Pricing" ? "var(--red)" : "var(--black)", letterSpacing: "0.08em" }}
                            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--red)")}
                            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = item.label === "Pricing" ? "var(--red)" : "var(--black)")}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                {/* Right Side: Auth Buttons */}
                <div className="flex-1 flex justify-end items-center gap-3">
                    <Link href="/auth/login">
                        <button className="btn-outline-red text-sm px-4 py-2">Log In</button>
                    </Link>
                    <Link href="/auth/register">
                        <button className="btn-red text-sm px-4 py-2">Start Free Trial</button>
                    </Link>
                </div>
            </nav>

            {/* ─── Hero Section ─── */}
            <section className="px-6 md:px-16 text-center" style={{ minHeight: "calc(100vh - 68px)", display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: "5.5rem", paddingBottom: "2rem", background: "var(--gray-light)", flex: 1 }}>
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                >
                    <p className="label-small mb-2" style={{ color: "var(--red)" }}>Transparent Pricing</p>
                    <h1 className="heading-condensed mb-3" style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}>
                        CHOOSE YOUR <span style={{ color: "var(--red)" }}>PLAN</span>
                    </h1>
                    <p className="text-sm max-w-2xl mx-auto mb-6" style={{ color: "var(--gray-dark)", fontWeight: 400 }}>
                        Whether you&apos;re just starting out or you&apos;re a professional athlete, we have a plan designed to perfect your form and maximize your potential.
                    </p>
                </motion.div>

                {/* ─── Pricing Cards ─── */}
                <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-5 items-stretch">
                    {plans.map((plan, i) => (
                        <motion.div
                            key={plan.name}
                            custom={i}
                            initial="hidden"
                            animate="visible"
                            variants={fadeUp}
                            className={`relative flex flex-col rounded-xl overflow-hidden transition-transform duration-300 hover:-translate-y-1`}
                            style={{
                                background: plan.name === "PRO" ? "var(--navy)" : "var(--white)",
                                color: plan.name === "PRO" ? "var(--white)" : "var(--black)",
                                border: plan.name === "PRO" ? "none" : plan.name === "PLUS" ? "2px solid var(--red)" : "1px solid var(--gray-mid)",
                                boxShadow: plan.isPopular ? "0 20px 40px rgba(214, 0, 28, 0.15)" : "0 10px 30px rgba(0,0,0,0.05)",
                                zIndex: plan.isPopular ? 10 : 1,
                            }}
                        >
                            {plan.isPopular && (
                                <div style={{ background: "var(--red)", color: "white", padding: "0.3rem", textAlign: "center", fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                    Most Popular
                                </div>
                            )}
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="heading-condensed text-xl mb-1" style={{ color: plan.name === "PRO" ? "var(--white)" : "var(--black)" }}>{plan.name}</h3>
                                <div className="flex items-baseline gap-1 mb-3">
                                    <span className="heading-condensed" style={{ fontSize: "2.5rem", lineHeight: 1, color: plan.name === "PRO" ? "var(--white)" : "var(--black)" }}>{plan.price}</span>
                                    <span style={{ color: plan.name === "PRO" ? "rgba(255,255,255,0.6)" : "var(--gray-dark)", fontWeight: 500 }}>{plan.period}</span>
                                </div>
                                <p className="text-sm mb-4" style={{ color: plan.name === "PRO" ? "rgba(255,255,255,0.8)" : "var(--gray-dark)" }}>{plan.description}</p>

                                <div className="divider-red mb-4" style={{ background: plan.name === "PRO" ? "rgba(255,255,255,0.2)" : "var(--gray-mid)" }} />

                                <ul className="space-y-2.5 mb-5 flex-1">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <div className="mt-0.5 shrink-0" style={{ color: plan.name === "PRO" ? "var(--red)" : "var(--red)" }}>
                                                <CheckCircle size={15} />
                                            </div>
                                            <span className="text-xs font-medium" style={{ color: plan.name === "PRO" ? "rgba(255,255,255,0.9)" : "var(--black)" }}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link href={plan.name === "FREE" ? "/auth/register" : "/dashboard/plans"} style={{ width: "100%" }}>
                                    <button
                                        className={plan.buttonClass}
                                        style={{ width: "100%", padding: "0.65rem", fontSize: "0.8rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}
                                    >
                                        {plan.buttonText} {plan.name !== "FREE" && <ArrowRight size={18} />}
                                    </button>
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* ─── FAQ Reference ─── */}
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    className="mt-5"
                >
                    <p className="text-xs" style={{ color: "var(--gray-dark)" }}>
                        Have questions about our plans? <Link href="/#faq" style={{ color: "var(--red)", fontWeight: 600, textDecoration: "underline" }}>Check out our FAQ</Link>.
                    </p>
                </motion.div>
            </section>

            {/* ─── Footer ─── */}
            <footer
                className="px-6 md:px-16 py-6"
                style={{ background: "var(--black)", color: "rgba(255,255,255,0.5)" }}
            >
                <div className="max-w-6xl mx-auto text-center">
                    <p className="text-xs">© 2026 PTT. All rights reserved. · Privacy Policy · Terms of Service</p>
                </div>
            </footer>
        </div>
    );
}
