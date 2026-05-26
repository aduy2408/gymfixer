"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getAuthToken, setStoredUser } from "@/lib/auth";
import { getMe } from "@/lib/api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function verify() {
      const token = getAuthToken();
      if (!token) {
        router.replace("/auth/login");
        return;
      }
      try {
        const user = await getMe();
        if (!active) return;
        setStoredUser(user);
        setReady(true);
      } catch {
        clearSession();
        router.replace("/auth/login");
      }
    }

    verify();
    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "'Barlow', sans-serif" }}>
        <div style={{ color: "#777", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Checking session...</div>
      </div>
    );
  }

  return <>{children}</>;
}
