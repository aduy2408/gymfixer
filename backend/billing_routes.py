from __future__ import annotations

import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from authentication.database import get_db
from authentication.models import BillingSubscription, Payment, User
from authentication.utils import get_current_user
from entitlements import add_month, as_aware, now_utc
from usage_events import log_usage_event

router = APIRouter(prefix="/billing", tags=["billing"])

PREMIUM_AMOUNT_VND = 59000
PREMIUM_INTERVAL = "monthly"
PAYMENT_PROVIDER = "vnpay"
VNPAY_VERSION = "2.1.0"
VNPAY_COMMAND = "pay"


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _frontend_url() -> str:
    return _env("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _payment_url() -> str:
    return _env("VNPAY_PAYMENT_URL", "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html")


def _tmn_code() -> str:
    value = _env("VNPAY_TMN_CODE")
    if not value:
        raise HTTPException(status_code=500, detail="VNPAY_TMN_CODE is not configured.")
    return value


def _hash_secret() -> str:
    value = _env("VNPAY_HASH_SECRET")
    if not value:
        raise HTTPException(status_code=500, detail="VNPAY_HASH_SECRET is not configured.")
    return value


def _return_url() -> str:
    return _env("VNPAY_RETURN_URL", f"{_env('BACKEND_PUBLIC_URL', 'http://localhost:5000').rstrip('/')}/billing/vnpay/return")


def _vnpay_time(value: datetime | None = None) -> str:
    current = value or now_utc()
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone(timedelta(hours=7))).strftime("%Y%m%d%H%M%S")


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def _txn_ref(prefix: str) -> str:
    return f"{prefix}{now_utc().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:10]}"


def _hash_data(params: dict[str, Any]) -> str:
    filtered = {
        key: str(value)
        for key, value in params.items()
        if value is not None
        and value != ""
        and key not in {"vnp_secure_hash", "vnp_SecureHash", "vnp_SecureHashType"}
    }
    return urlencode(sorted(filtered.items()))


def vnpay_secure_hash(params: dict[str, Any]) -> str:
    return hmac.new(_hash_secret().encode("utf-8"), _hash_data(params).encode("utf-8"), hashlib.sha512).hexdigest()


def verify_vnpay_signature(params: dict[str, Any]) -> bool:
    provided = str(params.get("vnp_secure_hash") or params.get("vnp_SecureHash") or "")
    if not provided:
        return False
    return hmac.compare_digest(provided.lower(), vnpay_secure_hash(params).lower())


def _signed_url(base_url: str, params: dict[str, Any]) -> str:
    clean = {key: value for key, value in params.items() if value is not None and value != ""}
    clean["vnp_SecureHash"] = vnpay_secure_hash(clean)
    return f"{base_url}?{urlencode(clean)}"


def _vnp_param(payload: dict[str, Any], name: str) -> Any:
    return payload.get(name) if name in payload else payload.get(name.lower())


def _active_subscription(db: Session, user_id: int) -> BillingSubscription | None:
    return (
        db.query(BillingSubscription)
        .filter(BillingSubscription.user_id == user_id)
        .order_by(BillingSubscription.created_at.desc(), BillingSubscription.id.desc())
        .first()
    )


def _activate_subscription(
    db: Session,
    *,
    user: User,
    payment: Payment,
    paid_at: datetime,
) -> BillingSubscription:
    existing = _active_subscription(db, user.id)
    start = max(now_utc(), as_aware(existing.current_period_end) or now_utc()) if existing else now_utc()
    end = add_month(start)
    subscription = existing or BillingSubscription(user_id=user.id)
    subscription.tier = "paid"
    subscription.status = "active"
    subscription.amount_vnd = PREMIUM_AMOUNT_VND
    subscription.interval = PREMIUM_INTERVAL
    subscription.current_period_start = start
    subscription.current_period_end = end
    subscription.next_billing_at = None
    subscription.cancel_at_period_end = True
    subscription.canceled_at = None
    subscription.payment_method_id = None
    db.add(subscription)
    db.flush()
    payment.subscription_id = subscription.id
    payment.payment_method_id = None
    user.subscription_tier = "paid"
    user.premium_expires_at = end
    payment.status = "paid"
    payment.paid_at = paid_at
    return subscription


def _mark_payment_failed(payment: Payment, payload: dict[str, Any]) -> None:
    payment.status = "failed"
    payment.failed_at = now_utc()
    payment.vnp_response_code = _vnp_param(payload, "vnp_ResponseCode")
    payment.vnp_transaction_status = _vnp_param(payload, "vnp_TransactionStatus")
    payment.raw_response_json = payload


def _handle_vnpay_payload(db: Session, payload: dict[str, Any]) -> tuple[str, str, Payment | None]:
    if not verify_vnpay_signature(payload):
        return "97", "Invalid checksum", None

    txn_ref = str(_vnp_param(payload, "vnp_TxnRef") or "")
    payment = db.query(Payment).filter(Payment.vnp_txn_ref == txn_ref).first()
    if not payment:
        return "01", "Order not found", None
    try:
        returned_amount = int(_vnp_param(payload, "vnp_Amount") or 0)
    except (TypeError, ValueError):
        returned_amount = 0
    if payment.amount_vnd * 100 != returned_amount:
        return "04", "Invalid amount", payment
    if payment.status == "paid":
        return "02", "Order already confirmed", payment

    payment.raw_response_json = payload
    payment.vnp_transaction_no = _vnp_param(payload, "vnp_TransactionNo")
    payment.vnp_response_code = _vnp_param(payload, "vnp_ResponseCode")
    payment.vnp_transaction_status = _vnp_param(payload, "vnp_TransactionStatus")

    success = (
        _vnp_param(payload, "vnp_ResponseCode") == "00"
        and _vnp_param(payload, "vnp_TransactionStatus") == "00"
    )
    user = db.query(User).filter(User.id == payment.user_id).first() if payment.user_id else None
    if not user:
        return "01", "User not found", payment

    if not success:
        _mark_payment_failed(payment, payload)
        log_usage_event(db, event_name="payment_failed", user_id=user.id, properties={"attempt_type": payment.attempt_type})
        return "00", "Confirm success", payment

    paid_at = now_utc()
    _activate_subscription(db, user=user, payment=payment, paid_at=paid_at)
    log_usage_event(db, event_name="payment_paid", user_id=user.id, properties={"attempt_type": payment.attempt_type})
    return "00", "Confirm success", payment


@router.post("/vnpay/start")
def start_vnpay_checkout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    txn_ref = _txn_ref("GF")
    created_at = now_utc()
    params = {
        "vnp_Version": VNPAY_VERSION,
        "vnp_Command": VNPAY_COMMAND,
        "vnp_TmnCode": _tmn_code(),
        "vnp_Amount": PREMIUM_AMOUNT_VND * 100,
        "vnp_CurrCode": "VND",
        "vnp_IpAddr": _client_ip(request),
        "vnp_Locale": "vn",
        "vnp_OrderInfo": f"GymFixer Premium user {current_user.id}",
        "vnp_OrderType": "other",
        "vnp_ReturnUrl": _return_url(),
        "vnp_TxnRef": txn_ref,
        "vnp_CreateDate": _vnpay_time(created_at),
        "vnp_ExpireDate": _vnpay_time(created_at + timedelta(minutes=15)),
    }
    payment_url = _signed_url(_payment_url(), params)
    payment = Payment(
        user_id=current_user.id,
        provider=PAYMENT_PROVIDER,
        status="pending",
        attempt_type="one_time",
        amount_vnd=PREMIUM_AMOUNT_VND,
        currency="VND",
        plan_tier="paid",
        interval=PREMIUM_INTERVAL,
        vnp_txn_ref=txn_ref,
        payment_url=payment_url,
        raw_request_json=params,
        raw_response_json={},
    )
    db.add(payment)
    log_usage_event(db, event_name="checkout_started", user_id=current_user.id)
    db.commit()
    db.refresh(payment)
    return {"payment_url": payment_url, "payment_id": payment.id, "amount_vnd": PREMIUM_AMOUNT_VND}


@router.get("/vnpay/ipn")
def vnpay_ipn(request: Request, db: Session = Depends(get_db)) -> dict[str, str]:
    payload = dict(request.query_params)
    code, message, _payment = _handle_vnpay_payload(db, payload)
    db.commit()
    return {"RspCode": code, "Message": message}


@router.get("/vnpay/return")
def vnpay_return(request: Request, db: Session = Depends(get_db)):
    payload = dict(request.query_params)
    code, _message, payment = _handle_vnpay_payload(db, payload)
    db.commit()
    status = "success" if code in {"00", "02"} and payment and payment.status == "paid" else "failed"
    txn_ref = _vnp_param(payload, "vnp_TxnRef") or ""
    return RedirectResponse(f"{_frontend_url()}/payment/result?status={status}&txn_ref={txn_ref}")
