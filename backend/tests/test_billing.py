from __future__ import annotations

from datetime import timedelta
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import billing_routes as billing
from authentication.models import BillingSubscription, Payment, User


class FakeQuery:
    def __init__(self, entity, values):
        self.entity = entity
        self.values = values

    def filter(self, *args):
        return self

    def order_by(self, *args):
        return self

    def first(self):
        return self.values.get(self.entity)


class FakeDB:
    def __init__(self, values):
        self.values = values
        self.added = []
        self.next_id = 100

    def query(self, entity):
        return FakeQuery(entity, self.values)

    def add(self, row):
        if getattr(row, "id", None) is None:
            row.id = self.next_id
            self.next_id += 1
        self.added.append(row)
        if isinstance(row, BillingSubscription):
            self.values[BillingSubscription] = row

    def flush(self):
        return None


def pay_payload(txn_ref: str = "GF123", amount: str = "5900000") -> dict[str, str]:
    return {
        "vnp_TxnRef": txn_ref,
        "vnp_Amount": amount,
        "vnp_ResponseCode": "00",
        "vnp_TransactionStatus": "00",
        "vnp_TransactionNo": "999",
        "vnp_BankCode": "NCB",
    }


def test_vnpay_pay_signature_round_trip(monkeypatch):
    monkeypatch.setattr(billing, "_hash_secret", lambda: "test-secret")
    params = {
        "vnp_Amount": "5900000",
        "vnp_Command": "pay",
        "vnp_TxnRef": "GF123",
    }
    params["vnp_SecureHash"] = billing.vnpay_secure_hash(params)

    assert billing.verify_vnpay_signature(params) is True
    params["vnp_Amount"] = "100"
    assert billing.verify_vnpay_signature(params) is False


def test_signed_url_uses_standard_pay_hash_parameter(monkeypatch):
    monkeypatch.setattr(billing, "_hash_secret", lambda: "test-secret")
    url = billing._signed_url(
        "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
        {"vnp_Command": "pay", "vnp_Amount": 5900000},
    )
    query = parse_qs(urlparse(url).query)

    assert query["vnp_Command"] == ["pay"]
    assert query["vnp_Amount"] == ["5900000"]
    assert "vnp_SecureHash" in query
    assert "vnp_secure_hash" not in query


def test_successful_pay_ipn_activates_one_month_without_autorenew(monkeypatch):
    user = SimpleNamespace(id=1, subscription_tier="free", premium_expires_at=None)
    payment = Payment(
        id=10,
        user_id=1,
        status="pending",
        attempt_type="one_time",
        amount_vnd=59000,
        vnp_txn_ref="GF123",
        raw_request_json={},
        raw_response_json={},
    )
    db = FakeDB({Payment: payment, User: user, BillingSubscription: None})
    monkeypatch.setattr(billing, "verify_vnpay_signature", lambda payload: True)
    monkeypatch.setattr(billing, "log_usage_event", lambda *args, **kwargs: None)

    code, _message, handled = billing._handle_vnpay_payload(db, pay_payload())

    subscription = db.values[BillingSubscription]
    assert code == "00"
    assert handled is payment
    assert payment.status == "paid"
    assert payment.payment_method_id is None
    assert user.subscription_tier == "paid"
    assert user.premium_expires_at == subscription.current_period_end
    assert subscription.amount_vnd == 59000
    assert subscription.next_billing_at is None
    assert subscription.cancel_at_period_end is True


def test_ipn_rejects_wrong_amount_and_is_idempotent(monkeypatch):
    payment = Payment(
        id=10,
        user_id=1,
        status="pending",
        attempt_type="one_time",
        amount_vnd=59000,
        vnp_txn_ref="GF123",
        raw_request_json={},
        raw_response_json={},
    )
    db = FakeDB({Payment: payment})
    monkeypatch.setattr(billing, "verify_vnpay_signature", lambda payload: True)

    code, _message, _handled = billing._handle_vnpay_payload(db, pay_payload(amount="100"))
    assert code == "04"

    payment.status = "paid"
    code, _message, _handled = billing._handle_vnpay_payload(db, pay_payload())
    assert code == "02"


def test_second_one_time_payment_extends_existing_period(monkeypatch):
    current_end = billing.now_utc() + timedelta(days=5)
    user = SimpleNamespace(id=1, subscription_tier="paid", premium_expires_at=current_end)
    subscription = BillingSubscription(
        id=30,
        user_id=1,
        status="active",
        amount_vnd=59000,
        interval="monthly",
        current_period_end=current_end,
        cancel_at_period_end=True,
    )
    payment = Payment(
        id=40,
        user_id=1,
        status="pending",
        attempt_type="one_time",
        amount_vnd=59000,
        vnp_txn_ref="GF456",
        raw_request_json={},
        raw_response_json={},
    )
    db = FakeDB({Payment: payment, User: user, BillingSubscription: subscription})
    monkeypatch.setattr(billing, "verify_vnpay_signature", lambda payload: True)
    monkeypatch.setattr(billing, "log_usage_event", lambda *args, **kwargs: None)

    code, _message, _handled = billing._handle_vnpay_payload(db, pay_payload("GF456"))

    assert code == "00"
    assert subscription.current_period_start == current_end
    assert subscription.current_period_end == billing.add_month(current_end)
    assert subscription.next_billing_at is None
    assert user.premium_expires_at == subscription.current_period_end
