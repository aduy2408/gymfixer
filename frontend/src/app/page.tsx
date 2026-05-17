"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  Play, CheckCircle, ArrowRight, MapPin
} from "lucide-react";

const workoutTypes = [
  {
    image: "/squat.jpg",
    category: "LOWER BODY",
    name: "SQUAT",
    color: "#D6001C",
  },
  {
    image: "/barbell-row.jpg",
    category: "BACK & PULL",
    name: "BARBELL ROW",
    color: "#211551",
  },
  {
    image: "/dumbbell-curls.webp",
    category: "ARMS",
    name: "DUMBBELL CURL",
    color: "#D6001C",
  },
];

const stats = [
  { value: "99.2%", label: "Keypoint Accuracy" },
  { value: "12+", label: "Exercises Supported" },
  { value: "< 2min", label: "Analysis Time" },
  { value: "18", label: "Joints Tracked" },
];

const steps = [
  { num: "01", title: "Upload Your Video", desc: "Record your workout and upload a short clip. Any smartphone video works." },
  { num: "02", title: "AI Pose Analysis", desc: "Our pipeline extracts frames, detects 33 body keypoints, and computes joint angles." },
  { num: "03", title: "Get Your Report", desc: "Receive an annotated playback, joint angle charts, and prioritised corrections." },
];

const faqs = [
  { q: "Which exercises are supported?", a: "Squat, deadlift, bench press, overhead press, lunge, push-up, pull-up, and more." },
  { q: "How long does analysis take?", a: "Most videos under 2 minutes are processed within 60–120 seconds." },
  { q: "Is my video data private?", a: "Yes. All videos are encrypted, stored securely, and never shared with third parties." },
];

const tickerItems = [
  "FORM TRAINING", "LIFE CHANGING", "INJURY PREVENTION", "AI POWERED", "REAL RESULTS",
  "FORM TRAINING", "LIFE CHANGING", "INJURY PREVENTION", "AI POWERED", "REAL RESULTS",
];

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const },
  }),
};

export default function LandingPage() {
  return (
    <div style={{ background: "var(--white)", color: "var(--black)" }}>

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
          {["Features", "How It Works", "FAQ"].map((item) => (
            <a
              key={item}
              href={`/#${item.toLowerCase().replace(/ /g, "-")}`}
              className="text-sm font-bold uppercase tracking-wider transition-colors"
              style={{ color: "var(--black)", letterSpacing: "0.08em" }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--red)")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--black)")}
            >
              {item}
            </a>
          ))}
          <Link
            href="/pricing"
            className="text-sm font-bold uppercase tracking-wider transition-colors"
            style={{ color: "var(--black)", letterSpacing: "0.08em" }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--red)")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--black)")}
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

      {/* ─── Hero ─── */}
      <section
        className="relative flex flex-col justify-center overflow-hidden"
        style={{ minHeight: "100vh" }}
      >
        {/* Background image */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "url('/landing_image.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
          }}
        >
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to right, rgba(0,0,0,0.82) 48%, rgba(0,0,0,0.25) 100%)" }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 px-6 md:px-16 pt-28 pb-24 max-w-3xl">
          {/* <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="label-small mb-5"
            style={{ color: "var(--red)" }}
          >
            AI-Powered Workout Coaching
          </motion.p> */}

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="heading-condensed mb-6"
            style={{ fontSize: "clamp(3.5rem, 8vw, 6.5rem)", color: "var(--white)" }}
          >
            PERFECT YOUR FORM.
            <br />
            <span style={{ color: "var(--red)" }}>PREVENT INJURIES.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg mb-10 max-w-xl leading-relaxed"
            style={{ color: "var(--text-on-dark)", fontWeight: 300 }}
          >
            Upload your workout video and get instant AI-powered pose analysis — joint angle tracking,
            posture corrections, and an injury risk score in under 2 minutes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap gap-4"
          >
            <Link href="/auth/register">
              <button className="btn-red px-8 py-4 text-base">
                Start For Free <ArrowRight size={18} />
              </button>
            </Link>
            <button className="btn-outline-white px-8 py-4 text-base">
              <Play size={16} fill="currentColor" /> Watch Demo
            </button>
          </motion.div>
        </div>
      </section>

      {/* ─── Ticker ─── */}
      <div className="ticker-wrap">
        <div className="ticker-inner">
          {tickerItems.map((item, i) => (
            <span key={i} className="ticker-item">
              {item} <span className="ticker-dot">★</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─── Stats ─── */}
      <section className="py-20 px-6 md:px-16" style={{ background: "var(--white)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="flex justify-center gap-2 mb-4">
              {["★", "★", "★"].map((s, i) => <span key={i} className="star-red">{s}</span>)}
            </div>
            <p className="label-small mb-3" style={{ color: "var(--red)" }}>Backed by Science</p>
            <h2 className="heading-condensed" style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}>
              WHY PTT WORKS
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="text-center"
              >
                <p
                  className="heading-condensed mb-2"
                  style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)", color: "var(--red)" }}
                >
                  {s.value}
                </p>
                <div className="divider-red mx-auto mb-3" />
                <p className="label-small" style={{ color: "var(--gray-dark)" }}>{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>



      {/* ─── Workout Types ─── */}
      <section id="features" style={{ background: "var(--white)", overflow: "hidden" }}>
        <div style={{ padding: "4rem 4rem 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <h2 className="heading-condensed" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
              PTT WORKOUT TYPES
            </h2>
            <Link href="/auth/register">
              <button className="btn-red" style={{ padding: "0.65rem 1.75rem", fontSize: "0.78rem", borderRadius: 4, whiteSpace: "nowrap" }}>
                GET STARTED
              </button>
            </Link>
          </div>
        </div>

        {/* Full-bleed image strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
          {workoutTypes.map((w, i) => (
            <motion.div
              key={w.name}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden" }}
            >
              {/* Background image */}
              <img
                src={w.image}
                alt={w.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center top",
                  display: "block",
                  transition: "transform 0.4s ease",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLImageElement).style.transform = "scale(1.04)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLImageElement).style.transform = "scale(1)")}
              />

              {/* Gradient overlay */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)",
              }} />

              {/* Border between cards */}
              {i < workoutTypes.length - 1 && (
                <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.15)" }} />
              )}

              {/* Label overlay */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "1.5rem",
              }}>
                <p style={{
                  fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.15em", color: "rgba(255,255,255,0.7)", marginBottom: "0.4rem",
                }}>
                  {w.category}
                </p>
                <div style={{
                  display: "inline-block",
                  background: w.color,
                  padding: "0.3rem 0.85rem",
                  marginBottom: "1rem",
                }}>
                  <p style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 800, fontSize: "1.4rem",
                    textTransform: "uppercase", color: "#fff", lineHeight: 1,
                  }}>
                    {w.name}
                  </p>
                </div>
                <br />
                <Link href="/auth/register">
                  <button style={{
                    background: "var(--red)", color: "#fff",
                    border: "none", padding: "0.55rem 1.4rem",
                    fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.08em", cursor: "pointer", borderRadius: 3,
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#b0001a")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--red)")}
                  >
                    View Now
                  </button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section
        id="how-it-works"
        className="py-24 px-6 md:px-16"
        style={{ background: "var(--navy)" }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="label-small mb-3" style={{ color: "var(--red)" }}>Simple Process</p>
            <h2 className="heading-condensed" style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", color: "var(--white)" }}>
              HOW IT <span style={{ color: "var(--red)" }}>WORKS</span>
            </h2>
            <div className="divider-red mx-auto mt-5" />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="relative text-center md:text-left"
              >
                <div className="relative">
                  <p
                    className="heading-condensed select-none"
                    style={{
                      fontSize: "clamp(5rem, 10vw, 8rem)",
                      color: "rgba(255,255,255,0.07)",
                      lineHeight: 1,
                      position: "absolute",
                      top: "-1.5rem",
                      left: 0,
                    }}
                  >
                    {s.num}
                  </p>
                  <div className="relative pt-10 pl-1">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
                      style={{ background: "var(--red)", color: "white", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1rem" }}
                    >
                      {parseInt(s.num)}
                    </div>
                    <h3 className="heading-condensed text-2xl mb-3" style={{ color: "var(--white)" }}>
                      {s.title.toUpperCase()}
                    </h3>
                    <p style={{ color: "var(--text-muted-dark)", lineHeight: 1.7, fontSize: "0.9rem", fontWeight: 300 }}>{s.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Ticker 2 ─── */}
      <div className="ticker-wrap">
        <div className="ticker-inner">
          {tickerItems.map((item, i) => (
            <span key={i} className="ticker-item">
              {item} <span className="ticker-dot">★</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─── Testimonials ─── */}
      <section className="py-24 px-6 md:px-16" style={{ background: "var(--white)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="label-small mb-3" style={{ color: "var(--red)" }}>Feel the Love</p>
            <h2 className="heading-condensed" style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}>
              WHAT MEMBERS SAY
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "BRITTANY S.",
                location: "California, USA",
                review: "I was constantly second-guessing my squat depth. PTT gave me frame-by-frame feedback I never got from a gym mirror — my form improved in two weeks.",
              },
              {
                name: "MAXIME G.",
                location: "Ontario, Canada",
                review: "I've been using PTT for three months now, and I can confidently say it has been a transformative experience. The joint angle breakdowns are incredibly detailed.",
              },
              {
                name: "ZUBAIR K.",
                location: "Alberta, Canada",
                review: "For over a year I ignored a hip hinge problem on my deadlift. PTT spotted it on the first upload. I've not had a back tweak since fixing it.",
              },
            ].map((t, i) => (
              <motion.div
                key={t.name}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                style={{
                  background: "var(--white)",
                  border: "1px solid var(--gray-mid)",
                  padding: "2rem",
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: "1.25rem",
                }}
              >
                {/* Stars */}
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} style={{ color: "var(--red)", fontSize: "1rem" }}>★</span>
                  ))}
                </div>
                {/* Quote */}
                <p style={{ fontSize: "0.9rem", lineHeight: 1.75, color: "#333", fontWeight: 300, flex: 1 }}>
                  {t.review}
                </p>
                {/* Attribution */}
                <div style={{ borderTop: "1px solid var(--gray-mid)", paddingTop: "1rem" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.name}</p>
                  <p style={{ fontSize: "0.75rem", color: "#aaa", marginTop: "0.1rem" }}>{t.location}</p>
                </div>
                {/* Big red quotemark */}
                <p style={{ fontFamily: "Georgia, serif", fontSize: "4rem", color: "var(--red)", lineHeight: 0.6, userSelect: "none" }}>&ldquo;</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-24 px-6 md:px-16" style={{ background: "var(--gray-light)" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="label-small mb-3" style={{ color: "var(--red)" }}>Get Answers</p>
            <h2 className="heading-condensed" style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}>
              FREQUENTLY ASKED <span style={{ color: "var(--red)" }}>QUESTIONS</span>
            </h2>
            <div className="divider-red mx-auto mt-5" />
          </div>
          <div className="space-y-4">
            {faqs.map((fq, i) => (
              <motion.div
                key={i}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="rounded-2xl p-6"
                style={{ background: "var(--white)", border: "1px solid var(--gray-mid)" }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "var(--red)" }}
                  >
                    <CheckCircle size={16} color="white" />
                  </div>
                  <div>
                    <p className="font-bold text-base mb-1" style={{ fontFamily: "'Barlow', sans-serif" }}>{fq.q}</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--gray-dark)", fontWeight: 400 }}>{fq.a}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section
        className="py-28 px-6 md:px-16 text-center"
        style={{ background: "var(--navy)" }}
      >
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="max-w-2xl mx-auto"
        >
          <div className="flex justify-center gap-2 mb-5">
            {["★", "★", "★"].map((s, i) => <span key={i} className="star-red">{s}</span>)}
          </div>
          <h2
            className="heading-condensed mb-6"
            style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", color: "var(--white)" }}
          >
            READY TO TRAIN
            <br />
            <span style={{ color: "var(--red)" }}>SMARTER?</span>
          </h2>
          <p className="text-lg mb-10" style={{ color: "var(--text-on-dark)", fontWeight: 300 }}>
            Join thousands of athletes improving their form with PTT.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <button className="btn-red px-10 py-4 text-base">
                Create Free Account <ArrowRight size={18} />
              </button>
            </Link>
            <button className="btn-outline-white px-10 py-4 text-base">
              <MapPin size={16} /> Find a Gym
            </button>
          </div>
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
            {["Features", "How It Works", "FAQ"].map((item) => (
              <a
                key={item}
                href={`/#${item.toLowerCase().replace(/ /g, "-")}`}
                className="text-xs uppercase tracking-wide hover:text-white transition-colors"
                style={{ letterSpacing: "0.08em" }}
              >
                {item}
              </a>
            ))}
            <Link
              href="/pricing"
              className="text-xs uppercase tracking-wide hover:text-white transition-colors"
              style={{ letterSpacing: "0.08em" }}
            >
              Pricing
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
