"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Shield, Video, Cpu, ArrowRight, CheckCircle } from "lucide-react";

const features = [
    {
        icon: Video,
        title: "Video Upload & Processing",
        desc: "Upload workout videos in MP4, MOV, or AVI. Our pipeline extracts frames automatically.",
    },
    {
        icon: Cpu,
        title: "AI Pose Estimation",
        desc: "MediaPipe tracks 33 body landmarks per frame — shoulders, elbows, hips, knees, and more.",
    },
    {
        icon: Activity,
        title: "Joint Angle Analysis",
        desc: "We compute real-time joint angles and compare them against biomechanical reference ranges.",
    },
    {
        icon: Shield,
        title: "Privacy First",
        desc: "Videos are encrypted in transit and at rest. You own your data — delete any time.",
    },
];

export default function OnboardingIntroPage() {
    const router = useRouter();

    return (
        <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Barlow', sans-serif" }}>
            {/* Top bar */}
            <div style={{ borderBottom: "1px solid #e8e8e8", padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 4, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Activity size={15} color="white" />
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        PTT<span style={{ color: "var(--red)" }}>.</span>
                    </span>
                </div>

                {/* Step indicator */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <div style={{ width: 24, height: 24, borderRadius: 4, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#fff" }}>1</div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--red)" }}>Introduction</span>
                    </div>
                    <div style={{ width: 32, height: 1, background: "#ddd" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <div style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #ddd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#bbb" }}>2</div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#bbb" }}>Your Metrics</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem" }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "0.5rem" }}>
                        Step 1 of 2
                    </p>
                    <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "clamp(2rem, 5vw, 3rem)", textTransform: "uppercase", lineHeight: 1, marginBottom: "0.75rem" }}>
                        HOW FITFORM AI WORKS
                    </h1>
                    <p style={{ color: "#666", fontSize: "0.9rem", lineHeight: 1.7, maxWidth: 520, fontWeight: 300, marginBottom: "2.5rem" }}>
                        Before you upload your first video, here&apos;s how our platform works — and how we keep your data safe.
                    </p>

                    {/* Feature cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1px", background: "#e8e8e8", border: "1px solid #e8e8e8", marginBottom: "2rem" }}>
                        {features.map((f, i) => (
                            <motion.div
                                key={f.title}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * i + 0.2, duration: 0.4 }}
                                style={{ background: "#fff", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 4, background: "#f2f2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <f.icon size={16} color="#333" />
                                    </div>
                                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                        {f.title}
                                    </p>
                                </div>
                                <p style={{ color: "#666", fontSize: "0.85rem", lineHeight: 1.65, fontWeight: 300 }}>{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Privacy note */}
                    <div style={{ border: "1px solid #e8e8e8", borderLeft: "3px solid var(--red)", padding: "1rem 1.25rem", marginBottom: "2rem", background: "#fafafa" }}>
                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <CheckCircle size={15} style={{ color: "var(--red)", flexShrink: 0, marginTop: 2 }} />
                            <p style={{ fontSize: "0.82rem", color: "#555", lineHeight: 1.6, fontWeight: 300 }}>
                                <strong style={{ color: "#111", fontWeight: 700 }}>Privacy Policy:</strong> Your videos are processed securely
                                on our servers and never shared with third parties. You can delete your data at any time from your profile settings.
                                By continuing, you agree to our <a href="#" style={{ color: "var(--red)", fontWeight: 600 }}>Terms of Service</a>.
                            </p>
                        </div>
                    </div>

                    <button
                        id="onboarding-continue"
                        onClick={() => router.push("/onboarding/metrics")}
                        className="btn-red"
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.9rem 2.5rem", borderRadius: 4, fontSize: "0.85rem" }}
                    >
                        CONTINUE <ArrowRight size={16} />
                    </button>
                </motion.div>
            </div>
        </div>
    );
}
