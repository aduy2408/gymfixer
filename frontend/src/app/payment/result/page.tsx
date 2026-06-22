"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, CircleX, Clock3 } from "lucide-react";

import { fetchSubscription, SubscriptionSummary } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

function PaymentResultContent() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const requestedStatus = searchParams.get("status") || "pending";
    const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
    const [status, setStatus] = useState(requestedStatus);

    useEffect(() => {
        if (requestedStatus === "cancelled") return;
        let cancelled = false;
        fetchSubscription()
            .then((data) => {
                if (cancelled) return;
                setSubscription(data);
                if (data.tier === "paid") setStatus("success");
                else if (requestedStatus === "success") setStatus("pending");
            })
            .catch(() => {
                if (!cancelled && requestedStatus !== "success") setStatus("failed");
            });
        return () => {
            cancelled = true;
        };
    }, [requestedStatus]);

    const success = status === "success";
    const pending = status === "pending";
    const title = success
        ? t("billing.result.success")
        : pending
            ? t("billing.result.pending")
            : status === "cancelled"
                ? t("billing.result.cancelled")
                : t("billing.result.failed");

    return (
        <main style={{ minHeight: "100vh", background: "#f7f7f7", display: "grid", placeItems: "center", padding: "1.5rem" }}>
            <section style={{ width: "100%", maxWidth: 520, background: "#fff", border: "1px solid #e8e8e8", borderRadius: 8, padding: "2rem", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
                    {success ? (
                        <CheckCircle size={48} color="#10b981" />
                    ) : pending ? (
                        <Clock3 size={48} color="#d6001c" />
                    ) : (
                        <CircleX size={48} color="#d6001c" />
                    )}
                </div>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>
                    {title}
                </h1>
                <p style={{ color: "#666", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.25rem" }}>
                    {success
                        ? t("billing.result.successCopy")
                        : pending
                            ? t("billing.result.pendingCopy")
                            : t("billing.result.failedCopy")}
                </p>
                {subscription?.billing?.current_period_end && success && (
                    <p style={{ color: "#333", fontSize: "0.82rem", fontWeight: 700, marginBottom: "1.25rem" }}>
                        {t("billing.nextCharge")} {new Date(subscription.billing.current_period_end).toLocaleDateString()}
                    </p>
                )}
                <Link href="/dashboard/profile">
                    <button type="button" className="btn-red" style={{ width: "100%", minHeight: 46, borderRadius: 4 }}>
                        {t("billing.result.back")}
                    </button>
                </Link>
            </section>
        </main>
    );
}

export default function PaymentResultPage() {
    return (
        <Suspense fallback={null}>
            <PaymentResultContent />
        </Suspense>
    );
}
