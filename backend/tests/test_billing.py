from __future__ import annotations

from datetime import timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

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

    def commit(self):
        return None

    def refresh(self, row):
        return None


class MockWebhookData:
    def __init__(self, order_code, amount, code, status, description="test"):
        self.order_code = order_code
        self.amount = amount
        self.code = code
        self.status = status
        self.description = description


class MockPaymentLink:
    def __init__(self, checkout_url, id):
        self.checkout_url = checkout_url
        self.id = id


class MockPaymentRequests:
    def __init__(self, link_info=None, error=None):
        self.link_info = link_info
        self.error = error
        self.created_data = None

    def create(self, payment_data):
        self.created_data = payment_data
        return MockPaymentLink("http://test.payos.vn/checkout", "payos-link-id")

    def get(self, order_id):
        if self.error:
            raise self.error
        return self.link_info


class MockWebhooks:
    def __init__(self, verified_data):
        self.verified_data = verified_data

    def verify(self, body):
        if self.verified_data is None:
            raise Exception("Invalid signature")
        return self.verified_data


class MockPayOS:
    def __init__(self, verified_data=None, link_info=None, lookup_error=None):
        self.webhooks = MockWebhooks(verified_data)
        self.payment_requests = MockPaymentRequests(link_info, lookup_error)


def test_get_val_helper():
    data = MockWebhookData(123, 59000, "00", "PAID")
    assert billing._get_val(data, "order_code") == 123
    assert billing._get_val(data, "amount") == 59000
    assert billing._get_val(data, "code") == "00"
    assert billing._get_val(data, "status") == "PAID"

    # Test dictionary fallback
    d = {"orderCode": 456, "status": "PENDING"}
    class DummyObj:
        def model_dump(self):
            return d
    dummy = DummyObj()
    assert billing._get_val(dummy, "order_code") == 456
    assert billing._get_val(dummy, "status") == "PENDING"


def test_start_payos_checkout(monkeypatch):
    user = SimpleNamespace(id=1)
    db = FakeDB({User: user})
    
    mock_client = MockPayOS()
    monkeypatch.setattr(billing, "_payos_client", lambda: mock_client)
    monkeypatch.setattr(
        billing,
        "_env",
        lambda name, default="": "5000" if name == "PREMIUM_AMOUNT_VND" else ("test-env" if "PAYOS" in name else default),
    )
    monkeypatch.setattr(billing, "log_usage_event", lambda *args, **kwargs: None)
    
    class FakeRequest:
        pass
    
    res = billing.start_payos_checkout(FakeRequest(), current_user=user, db=db)
    
    assert res["payment_url"] == "http://test.payos.vn/checkout"
    assert res["amount_vnd"] == 5000
    assert len(db.added) == 1
    payment = db.added[0]
    assert payment.user_id == 1
    assert payment.provider == "payos"
    assert payment.amount_vnd == 5000
    assert payment.raw_request_json["amount"] == 5000
    assert payment.vnp_txn_ref == str(payment.id)
    assert payment.vnp_transaction_no == "payos-link-id"


@pytest.mark.anyio
async def test_payos_webhook_success(monkeypatch):
    user = SimpleNamespace(id=1, subscription_tier="free", premium_expires_at=None)
    payment = Payment(
        id=100,
        user_id=1,
        status="pending",
        attempt_type="one_time",
        amount_vnd=59000,
        vnp_txn_ref="100",
        raw_request_json={},
        raw_response_json={},
    )
    db = FakeDB({Payment: payment, User: user, BillingSubscription: None})
    
    mock_data = MockWebhookData(100, 59000, "00", "PAID")
    mock_client = MockPayOS(verified_data=mock_data)
    
    monkeypatch.setattr(billing, "_payos_client", lambda: mock_client)
    monkeypatch.setattr(billing, "log_usage_event", lambda *args, **kwargs: None)
    
    class FakeRequest:
        async def body(self):
            return b"raw-body"
            
    res = await billing.payos_webhook(FakeRequest(), db=db)
    
    assert res["status"] == "success"
    assert payment.status == "paid"
    assert user.subscription_tier == "paid"
    assert db.values[BillingSubscription] is not None
    assert db.values[BillingSubscription].status == "active"


@pytest.mark.anyio
async def test_payos_webhook_failed(monkeypatch):
    user = SimpleNamespace(id=1, subscription_tier="free", premium_expires_at=None)
    payment = Payment(
        id=100,
        user_id=1,
        status="pending",
        attempt_type="one_time",
        amount_vnd=59000,
        vnp_txn_ref="100",
        raw_request_json={},
        raw_response_json={},
    )
    db = FakeDB({Payment: payment, User: user, BillingSubscription: None})
    
    mock_data = MockWebhookData(100, 59000, "01", "FAILED")
    mock_client = MockPayOS(verified_data=mock_data)
    
    monkeypatch.setattr(billing, "_payos_client", lambda: mock_client)
    monkeypatch.setattr(billing, "log_usage_event", lambda *args, **kwargs: None)
    
    class FakeRequest:
        async def body(self):
            return b"raw-body"
            
    res = await billing.payos_webhook(FakeRequest(), db=db)
    
    assert res["status"] == "failed"
    assert payment.status == "failed"
    assert user.subscription_tier == "free"


def test_payos_return_paid(monkeypatch):
    user = SimpleNamespace(id=1, subscription_tier="free", premium_expires_at=None)
    payment = Payment(
        id=100,
        user_id=1,
        status="pending",
        attempt_type="one_time",
        amount_vnd=59000,
        vnp_txn_ref="100",
        raw_request_json={},
        raw_response_json={},
    )
    db = FakeDB({Payment: payment, User: user, BillingSubscription: None})
    
    mock_info = MockWebhookData(100, 59000, "00", "PAID")
    mock_client = MockPayOS(link_info=mock_info)
    
    monkeypatch.setattr(billing, "_payos_client", lambda: mock_client)
    monkeypatch.setattr(billing, "_frontend_url", lambda: "http://localhost:3000")
    monkeypatch.setattr(billing, "log_usage_event", lambda *args, **kwargs: None)
    
    class FakeRequest:
        def __init__(self):
            self.query_params = {"orderCode": "100", "status": "PAID"}
            
    res = billing.payos_return(FakeRequest(), db=db)
    
    assert res.headers["location"] == "http://localhost:3000/payment/result?status=success&txn_ref=100"
    assert payment.status == "paid"
    assert user.subscription_tier == "paid"
    assert payment.raw_response_json["return_params"]["status"] == "PAID"
    assert payment.raw_response_json["payos_lookup"]["status"] == "PAID"


def test_payos_return_lookup_error_stays_pending(monkeypatch):
    user = SimpleNamespace(id=1, subscription_tier="free", premium_expires_at=None)
    payment = Payment(
        id=100,
        user_id=1,
        status="pending",
        attempt_type="one_time",
        amount_vnd=59000,
        vnp_txn_ref="100",
        raw_request_json={},
        raw_response_json={},
    )
    db = FakeDB({Payment: payment, User: user, BillingSubscription: None})

    mock_client = MockPayOS(lookup_error=Exception("PayOS unavailable"))

    monkeypatch.setattr(billing, "_payos_client", lambda: mock_client)
    monkeypatch.setattr(billing, "_frontend_url", lambda: "http://localhost:3000")

    class FakeRequest:
        def __init__(self):
            self.query_params = {"orderCode": "100", "status": "PAID"}

    res = billing.payos_return(FakeRequest(), db=db)

    assert res.headers["location"] == "http://localhost:3000/payment/result?status=pending&txn_ref=100"
    assert payment.status == "pending"
    assert user.subscription_tier == "free"
    assert payment.raw_response_json["return_params"]["status"] == "PAID"
    assert payment.raw_response_json["payos_lookup_error"] == "PayOS unavailable"


def test_payos_return_pending(monkeypatch):
    user = SimpleNamespace(id=1, subscription_tier="free", premium_expires_at=None)
    payment = Payment(
        id=100,
        user_id=1,
        status="pending",
        attempt_type="one_time",
        amount_vnd=59000,
        vnp_txn_ref="100",
        raw_request_json={},
        raw_response_json={},
    )
    db = FakeDB({Payment: payment, User: user, BillingSubscription: None})

    mock_info = MockWebhookData(100, 59000, "01", "PENDING")
    mock_client = MockPayOS(link_info=mock_info)

    monkeypatch.setattr(billing, "_payos_client", lambda: mock_client)
    monkeypatch.setattr(billing, "_frontend_url", lambda: "http://localhost:3000")

    class FakeRequest:
        def __init__(self):
            self.query_params = {"orderCode": "100", "status": "PAID"}

    res = billing.payos_return(FakeRequest(), db=db)

    assert res.headers["location"] == "http://localhost:3000/payment/result?status=pending&txn_ref=100"
    assert payment.status == "pending"
    assert user.subscription_tier == "free"


@pytest.mark.parametrize("payos_status", ["CANCELLED", "FAILED"])
def test_payos_return_failed_statuses(monkeypatch, payos_status):
    user = SimpleNamespace(id=1, subscription_tier="free", premium_expires_at=None)
    payment = Payment(
        id=100,
        user_id=1,
        status="pending",
        attempt_type="one_time",
        amount_vnd=59000,
        vnp_txn_ref="100",
        raw_request_json={},
        raw_response_json={},
    )
    db = FakeDB({Payment: payment, User: user, BillingSubscription: None})

    mock_info = MockWebhookData(100, 59000, "01", payos_status)
    mock_client = MockPayOS(link_info=mock_info)

    monkeypatch.setattr(billing, "_payos_client", lambda: mock_client)
    monkeypatch.setattr(billing, "_frontend_url", lambda: "http://localhost:3000")

    class FakeRequest:
        def __init__(self):
            self.query_params = {"orderCode": "100", "status": payos_status}

    res = billing.payos_return(FakeRequest(), db=db)

    assert res.headers["location"] == "http://localhost:3000/payment/result?status=failed&txn_ref=100"
    assert payment.status == "failed"
    assert user.subscription_tier == "free"


def test_payos_cancel(monkeypatch):
    payment = Payment(
        id=100,
        user_id=1,
        status="pending",
        attempt_type="one_time",
        amount_vnd=59000,
        vnp_txn_ref="100",
        raw_request_json={},
        raw_response_json={},
    )
    db = FakeDB({Payment: payment})
    
    monkeypatch.setattr(billing, "_frontend_url", lambda: "http://localhost:3000")
    
    class FakeRequest:
        def __init__(self):
            self.query_params = {"orderCode": "100"}
            
    res = billing.payos_cancel(FakeRequest(), db=db)
    
    assert res.headers["location"] == "http://localhost:3000/payment/result?status=cancelled&txn_ref=100"
    assert payment.status == "failed"
