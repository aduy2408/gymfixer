"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, LayoutDashboard, User, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { clearAuth } from "@/lib/mockData";

const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/profile", label: "Profile", icon: User },
];

const sidebarStyle: React.CSSProperties = {
    background: "#fff",
    borderRight: "1px solid #e8e8e8",
    width: 220,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    position: "sticky" as const,
    top: 0,
    fontFamily: "'Barlow', sans-serif",
};

export default function DashboardNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = () => { clearAuth(); router.push("/"); };

    const isActive = (href: string) =>
        href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");

    return (
        <>
            {/* Desktop sidebar */}
            <aside style={sidebarStyle} className="hidden md:flex flex-col">
                {/* Logo */}
                <div style={{ padding: "1.25rem 1.25rem 1rem", borderBottom: "1px solid #f0f0f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 4, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Activity size={14} color="white" />
                        </div>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            PTT<span style={{ color: "var(--red)" }}>.</span>
                        </span>
                    </div>
                </div>

                {/* Nav label */}
                <div style={{ padding: "1rem 1.25rem 0.4rem" }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#bbb" }}>Navigation</p>
                </div>

                {/* Links */}
                <nav style={{ flex: 1, padding: "0 0.75rem", display: "flex", flexDirection: "column", gap: "2px" }}>
                    {navLinks.map(({ href, label, icon: Icon }) => {
                        const active = isActive(href);
                        return (
                            <Link key={href} href={href}>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.6rem",
                                        padding: "0.6rem 0.75rem",
                                        borderRadius: 4,
                                        background: active ? "var(--red)" : "transparent",
                                        color: active ? "#fff" : "#555",
                                        cursor: "pointer",
                                        transition: "background 0.15s, color 0.15s",
                                        fontSize: "0.85rem",
                                        fontWeight: active ? 700 : 400,
                                        textTransform: "uppercase" as const,
                                        letterSpacing: "0.06em",
                                    }}
                                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "#f5f5f5"; }}
                                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                                >
                                    <Icon size={15} />
                                    <span>{label}</span>
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                {/* User + sign out */}
                <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #f0f0f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                        <div style={{ width: 30, height: 30, borderRadius: 4, background: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>A</div>
                        <div>
                            <p style={{ fontSize: "0.8rem", fontWeight: 700, lineHeight: 1.2 }}>Alex Johnson</p>
                            <p style={{ fontSize: "0.7rem", color: "#aaa" }}>Muscle Gain</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.6rem", borderRadius: 4, background: "none", border: "none", color: "#aaa", fontSize: "0.8rem", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(214,0,28,0.05)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#aaa"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                    >
                        <LogOut size={13} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile top bar */}
            <div className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-50"
                style={{ background: "#fff", borderBottom: "1px solid #e8e8e8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: 26, height: 26, borderRadius: 4, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Activity size={13} color="white" />
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        PTT<span style={{ color: "var(--red)" }}>.</span>
                    </span>
                </div>
                <button onClick={() => setMobileOpen(!mobileOpen)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                    {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            <AnimatePresence>
                {mobileOpen && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="md:hidden fixed top-[53px] left-0 right-0 z-40 p-3"
                        style={{ background: "#fff", borderBottom: "1px solid #e8e8e8" }}>
                        {navLinks.map(({ href, label, icon: Icon }) => (
                            <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
                                <div className="flex items-center gap-3 px-3 py-2.5 rounded"
                                    style={{ color: isActive(href) ? "var(--red)" : "#555", fontWeight: isActive(href) ? 700 : 400, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    <Icon size={15} /><span>{label}</span>
                                </div>
                            </Link>
                        ))}
                        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 w-full"
                            style={{ color: "var(--red)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
                            <LogOut size={15} /><span>Sign Out</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
