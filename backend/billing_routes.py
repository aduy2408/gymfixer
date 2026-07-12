from __future__ import annotations

import os
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from payos import PayOS
from payos.types import CreatePaymentLinkRequest

from authentication.database import get_db
from authentication.models import BillingSubscription, Payment, User
from authentication.utils import get_current_user
from entitlements import add_month, as_aware, now_utc
from usage_events import log_usage_event

router = APIRouter(prefix="/billing", tags=["billing"])

PREMIUM_INTERVAL = "monthly"
PAYMENT_PROVIDER = "payos"


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _premium_amount_vnd() -> int:
    return int(_env("PREMIUM_AMOUNT_VND", "59000"))


def _frontend_url() -> str:
    return _env("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _payos_client() -> PayOS:
    client_id = _env("PAYOS_CLIENT_ID")
    api_key = _env("PAYOS_API_KEY")
    checksum_key = _env("PAYOS_CHECKSUM_KEY")
    if not client_id or not api_key or not checksum_key:
        raise HTTPException(status_code=500, detail="PayOS credentials are not configured.")
    return PayOS(client_id=client_id, api_key=api_key, checksum_key=checksum_key)


def _get_val(obj: Any, attr_name: str) -> Any:
    if hasattr(obj, attr_name):
        return getattr(obj, attr_name)
    camel = "".join(word.capitalize() if i > 0 else word for i, word in enumerate(attr_name.split("_")))
    if hasattr(obj, camel):
        return getattr(obj, camel)
    try:
        d = obj.model_dump()
    except Exception:
        try:
            d = obj.dict()
        except Exception:
            d = getattr(obj, "__dict__", {})
    if attr_name in d:
        return d[attr_name]
    if camel in d:
        return d[camel]
    return None


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
    subscription.amount_vnd = payment.amount_vnd
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


def _confirm_payos_payment_from_api(db: Session, *, order_code: int, params: dict[str, Any]) -> str:
    payment = db.query(Payment).filter(Payment.id == order_code).first()
    if not payment:
        return "failed"

    if payment.status == "paid":
        payment.raw_response_json = {
            **(payment.raw_response_json or {}),
            "return_params": params,
        }
        db.commit()
        return "success"

    try:
        payment_info = _payos_client().payment_requests.get(order_code)
    except Exception as e:
        payment.raw_response_json = {
            **(payment.raw_response_json or {}),
            "return_params": params,
            "payos_lookup_error": str(e),
        }
        db.commit()
        return "pending"

    info_status = _get_val(payment_info, "status")
    payment.raw_response_json = {
        **(payment.raw_response_json or {}),
        "return_params": params,
        "payos_lookup": {
            "orderCode": _get_val(payment_info, "order_code") or order_code,
            "amount": _get_val(payment_info, "amount"),
            "description": _get_val(payment_info, "description"),
            "status": info_status,
        },
    }

    if info_status == "PAID":
        user = db.query(User).filter(User.id == payment.user_id).first() if payment.user_id else None
        if not user:
            db.commit()
            return "pending"
        _activate_subscription(db, user=user, payment=payment, paid_at=now_utc())
        log_usage_event(db, event_name="payment_paid", user_id=user.id, properties={"attempt_type": payment.attempt_type})
        db.commit()
        return "success"

    if info_status in {"CANCELLED", "FAILED"}:
        payment.status = "failed"
        payment.failed_at = now_utc()
        db.commit()
        return "failed"

    db.commit()
    return "pending"


@router.post("/payos/start")
def start_payos_checkout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    amount_vnd = _premium_amount_vnd()
    payment = Payment(
        user_id=current_user.id,
        provider=PAYMENT_PROVIDER,
        status="pending",
        attempt_type="one_time",
        amount_vnd=amount_vnd,
        currency="VND",
        plan_tier="paid",
        interval=PREMIUM_INTERVAL,
        vnp_txn_ref="",
        raw_request_json={},
        raw_response_json={},
    )
    db.add(payment)
    db.flush()

    order_code = payment.id
    payment.vnp_txn_ref = str(order_code)

    return_url = f"{_env('BACKEND_PUBLIC_URL', 'http://localhost:5000').rstrip('/')}/billing/payos/return"
    cancel_url = f"{_env('BACKEND_PUBLIC_URL', 'http://localhost:5000').rstrip('/')}/billing/payos/cancel"

    payment_request = CreatePaymentLinkRequest(
        order_code=order_code,
        amount=amount_vnd,
        description=f"GymFixer Premium user {current_user.id}",
        cancel_url=cancel_url,
        return_url=return_url,
    )

    try:
        payos_link = _payos_client().payment_requests.create(payment_data=payment_request)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create PayOS payment link: {str(e)}")

    checkout_url = _get_val(payos_link, "checkout_url")
    payos_id = _get_val(payos_link, "id")

    payment.payment_url = checkout_url
    payment.vnp_transaction_no = payos_id
    payment.raw_request_json = {
        "order_code": order_code,
        "amount": amount_vnd,
        "description": payment_request.description,
        "cancel_url": cancel_url,
        "return_url": return_url,
    }

    log_usage_event(db, event_name="checkout_started", user_id=current_user.id)
    db.commit()
    db.refresh(payment)
    return {
        "payment_url": checkout_url,
        "payment_id": payment.id,
        "amount_vnd": amount_vnd,
    }


@router.post("/payos/webhook")
async def payos_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    try:
        webhook_data = _payos_client().webhooks.verify(body)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    order_code = _get_val(webhook_data, "order_code")
    if not order_code:
        raise HTTPException(status_code=400, detail="Missing order_code in webhook data.")

    payment = db.query(Payment).filter(Payment.id == int(order_code)).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Order not found.")

    payment.raw_response_json = {
        "webhook_data": {
            "orderCode": order_code,
            "amount": _get_val(webhook_data, "amount"),
            "description": _get_val(webhook_data, "description"),
            "status": _get_val(webhook_data, "status") or _get_val(webhook_data, "code"),
        }
    }

    user = db.query(User).filter(User.id == payment.user_id).first() if payment.user_id else None
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    code = _get_val(webhook_data, "code")
    status = _get_val(webhook_data, "status")
    success = code == "00" or status == "PAID"

    if success:
        if payment.status != "paid":
            _activate_subscription(db, user=user, payment=payment, paid_at=now_utc())
            log_usage_event(db, event_name="payment_paid", user_id=user.id, properties={"attempt_type": payment.attempt_type})
        db.commit()
        return {"status": "success", "message": "Confirm success"}
    else:
        payment.status = "failed"
        payment.failed_at = now_utc()
        log_usage_event(db, event_name="payment_failed", user_id=user.id, properties={"attempt_type": payment.attempt_type})
        db.commit()
        return {"status": "failed", "message": "Payment failed"}


@router.get("/payos/return")
def payos_return(request: Request, db: Session = Depends(get_db)):
    params = dict(request.query_params)
    order_code = params.get("orderCode")
    status = "failed"
    if order_code:
        status = _confirm_payos_payment_from_api(db, order_code=int(order_code), params=params)
    return RedirectResponse(f"{_frontend_url()}/payment/result?status={status}&txn_ref={order_code}")


@router.get("/payos/cancel")
def payos_cancel(request: Request, db: Session = Depends(get_db)):
    params = dict(request.query_params)
    order_code = params.get("orderCode")
    if order_code:
        payment = db.query(Payment).filter(Payment.id == int(order_code)).first()
        if payment and payment.status == "pending":
            payment.status = "failed"
            payment.failed_at = now_utc()
            payment.raw_response_json = params
            db.commit()
    return RedirectResponse(f"{_frontend_url()}/payment/result?status=cancelled&txn_ref={order_code}")
