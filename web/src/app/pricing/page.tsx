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
                            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, letterSpacing: "0.05em" }}
                        >
                            PTT<span style={{ color: "var(--red)" }}>.</span>
                        </span>
                    </Link>
                </div>

                {/* Center: Links */}
                <div className="hidden md:flex flex-1 justify-center items-center gap-12">
                    <Link
                        href="/#features"
                        className="text-sm font-bold uppercase tracking-wider transition-colors"
                        style={{ color: "var(--black)", letterSpacing: "0.08em" }}
                        onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--red)")}
                        onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--black)")}
                    >
                        Features
                    </Link>
                    <Link
                        href="/#how-it-works"
                        className="text-sm font-bold uppercase tracking-wider transition-colors"
                        style={{ color: "var(--black)", letterSpacing: "0.08em" }}
                        onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--red)")}
                        onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--black)")}
                    >
                        How It Works
                    </Link>
                    <Link
                        href="/#faq"
                        className="text-sm font-bold uppercase tracking-wider transition-colors"
                        style={{ color: "var(--black)", letterSpacing: "0.08em" }}
                        onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--red)")}
                        onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--black)")}
                    >
                        FAQ
                    </Link>
                    <Link
                        href="/pricing"
                        className="text-sm font-bold uppercase tracking-wider transition-colors"
                        style={{ color: "var(--red)", letterSpacing: "0.08em" }}
                    >
                        Pricing
                    </Link>
                </div>

                {/* Right Side: Auth Buttons */}
                <div className="flex-1 flex justify-end items-center gap-3">
                    <Link href="/auth/login">
                        <button className="btn-outline-red text-sm px-5 py-2.5">Log In</button>
                    </Link>
                    <Link href="/auth/register">
                        <button className="btn-red text-sm px-5 py-2.5">Start Free Trial</button>
                    </Link>
                </div>
            </nav>

            {/* ─── Hero Section ─── */}
            <section className="pt-36 pb-16 px-6 md:px-16 text-center" style={{ background: "var(--gray-light)", flex: 1 }}>
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                >
                    <p className="label-small mb-3" style={{ color: "var(--red)" }}>Transparent Pricing</p>
                    <h1 className="heading-condensed mb-6" style={{ fontSize: "clamp(3rem, 6vw, 5rem)" }}>
                        CHOOSE YOUR <span style={{ color: "var(--red)" }}>PLAN</span>
                    </h1>
                    <p className="text-lg max-w-2xl mx-auto mb-16" style={{ color: "var(--gray-dark)", fontWeight: 400 }}>
                        Whether you&apos;re just starting out or you&apos;re a professional athlete, we have a plan designed to perfect your form and maximize your potential.
                    </p>
                </motion.div>

                {/* ─── Pricing Cards ─── */}
                <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 items-stretch pb-20">
                    {plans.map((plan, i) => (
                        <motion.div
                            key={plan.name}
                            custom={i}
                            initial="hidden"
                            animate="visible"
                            variants={fadeUp}
                            className={`relative flex flex-col rounded-2xl overflow-hidden transition-transform duration-300 hover:-translate-y-2`}
                            style={{
                                background: plan.name === "PRO" ? "var(--navy)" : "var(--white)",
                                color: plan.name === "PRO" ? "var(--white)" : "var(--black)",
                                border: plan.name === "PRO" ? "none" : plan.name === "PLUS" ? "2px solid var(--red)" : "1px solid var(--gray-mid)",
                                boxShadow: plan.isPopular ? "0 20px 40px rgba(214, 0, 28, 0.15)" : "0 10px 30px rgba(0,0,0,0.05)",
                                zIndex: plan.isPopular ? 10 : 1,
                            }}
                        >
                            {plan.isPopular && (
                                <div style={{ background: "var(--red)", color: "white", padding: "0.4rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                    Most Popular
                                </div>
                            )}
                            <div className="p-8 flex-1 flex flex-col">
                                <h3 className="heading-condensed text-2xl mb-2" style={{ color: plan.name === "PRO" ? "var(--white)" : "var(--black)" }}>{plan.name}</h3>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="heading-condensed" style={{ fontSize: "3.5rem", lineHeight: 1, color: plan.name === "PRO" ? "var(--white)" : "var(--black)" }}>{plan.price}</span>
                                    <span style={{ color: plan.name === "PRO" ? "rgba(255,255,255,0.6)" : "var(--gray-dark)", fontWeight: 500 }}>{plan.period}</span>
                                </div>
                                <p className="text-sm mb-8" style={{ color: plan.name === "PRO" ? "rgba(255,255,255,0.8)" : "var(--gray-dark)" }}>{plan.description}</p>

                                <div className="divider-red mb-8" style={{ background: plan.name === "PRO" ? "rgba(255,255,255,0.2)" : "var(--gray-mid)" }} />

                                <ul className="space-y-4 mb-10 flex-1">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                            <div className="mt-0.5 shrink-0" style={{ color: plan.name === "PRO" ? "var(--red)" : "var(--red)" }}>
                                                <CheckCircle size={18} />
                                            </div>
                                            <span className="text-sm font-medium" style={{ color: plan.name === "PRO" ? "rgba(255,255,255,0.9)" : "var(--black)" }}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link href={plan.name === "FREE" ? "/auth/register" : "/dashboard/plans"} style={{ width: "100%" }}>
                                    <button
                                        className={plan.buttonClass}
                                        style={{ width: "100%", padding: "1rem", fontSize: "1rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}
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
                    className="pb-20"
                >
                    <p className="text-sm" style={{ color: "var(--gray-dark)" }}>
                        Have questions about our plans? <Link href="/#faq" style={{ color: "var(--red)", fontWeight: 600, textDecoration: "underline" }}>Check out our FAQ</Link>.
                    </p>
                </motion.div>
            </section>

            {/* ─── Footer ─── */}
            <footer
                className="px-6 md:px-16 py-10"
                style={{ background: "var(--black)", color: "rgba(255,255,255,0.5)" }}
            >
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "var(--red)" }}>
                            <Activity size={12} color="white" />
                        </div>
                        <span
                            className="font-bold text-base uppercase tracking-widest"
                            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--white)", fontWeight: 900 }}
                        >
                            PTT<span style={{ color: "var(--red)" }}>.</span>
                        </span>
                    </div>
                    <p className="text-xs text-center">© 2026 PTT. All rights reserved. · Privacy Policy · Terms of Service</p>
                    <div className="flex gap-4">
                        <Link href="/#features" className="text-xs uppercase tracking-wide hover:text-white transition-colors" style={{ letterSpacing: "0.08em" }}>Features</Link>
                        <Link href="/#how-it-works" className="text-xs uppercase tracking-wide hover:text-white transition-colors" style={{ letterSpacing: "0.08em" }}>How It Works</Link>
                        <Link href="/pricing" className="text-xs uppercase tracking-wide hover:text-white transition-colors" style={{ letterSpacing: "0.08em" }}>Pricing</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
