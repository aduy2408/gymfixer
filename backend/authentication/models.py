from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    auth_provider = Column(String, default="local", nullable=False)
    google_sub = Column(String, unique=True, nullable=True, index=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    subscription_tier = Column(String, default="free", nullable=False, index=True)
    role = Column(String, default="user", nullable=False, index=True)
    trial_started_at = Column(DateTime(timezone=True), nullable=True)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    premium_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    auth_tokens = relationship("AuthToken", back_populates="user", cascade="all, delete-orphan")
    profile = relationship("UserProfile", back_populates="user", cascade="all, delete-orphan", uselist=False)
    workout_sessions = relationship("WorkoutSession", back_populates="user")
    usage_events = relationship("UsageEvent", back_populates="user")
    feedback_items = relationship("UserFeedback", back_populates="user", cascade="all, delete-orphan")
    weekly_workout_plans = relationship("WeeklyWorkoutPlan", back_populates="user")
    weekly_meal_plans = relationship("WeeklyMealPlan", back_populates="user")
    subscriptions = relationship("BillingSubscription", back_populates="user")
    payment_methods = relationship("PaymentMethod", back_populates="user")
    payments = relationship("Payment", back_populates="user")


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise = Column(String, nullable=False, index=True)
    camera_view = Column(String, nullable=False)
    pose_backend = Column(String, nullable=False)
    source_type = Column(String, nullable=False, default="video_upload")
    file_name = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    sample_fps = Column(Float, nullable=True)
    max_frames = Column(Integer, nullable=True)
    include_preview = Column(Boolean, nullable=False, default=False)
    preview_max_frames = Column(Integer, nullable=True)
    llm_requested = Column(Boolean, nullable=False, default=False)
    status = Column(String, nullable=False, default="processing", index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="workout_sessions")
    analysis_result = relationship(
        "AnalysisResult",
        back_populates="session",
        cascade="all, delete-orphan",
        uselist=False,
    )
    usage_events = relationship("UsageEvent", back_populates="session")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    height_cm = Column(Integer, nullable=True)
    weight_kg = Column(Integer, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    goal = Column(String, nullable=True)
    discovery_source = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="profile")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer,
        ForeignKey("workout_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    frames_received = Column(Integer, nullable=False, default=0)
    frames_analyzed = Column(Integer, nullable=False, default=0)
    rep_count = Column(Integer, nullable=False, default=0)
    processing_ms = Column(Integer, nullable=False, default=0)
    quality_ratio = Column(Float, nullable=True)
    no_pose_frames = Column(Integer, nullable=False, default=0)
    visibility_failed_frames = Column(Integer, nullable=False, default=0)
    waiting_for_subject_frames = Column(Integer, nullable=False, default=0)
    decode_errors = Column(Integer, nullable=False, default=0)
    summary_json = Column(JSONB, nullable=False)
    angle_stats_json = Column(JSONB, nullable=False, default=dict)
    top_feedback_json = Column(JSONB, nullable=False, default=dict)
    visibility_failures_json = Column(JSONB, nullable=False, default=dict)
    rep_breakdown_json = Column(JSONB, nullable=False, default=list)
    llm_enabled = Column(Boolean, nullable=False, default=False)
    llm_model = Column(String, nullable=True)
    llm_usage_json = Column(JSONB, nullable=True)
    llm_recommendations = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session = relationship("WorkoutSession", back_populates="analysis_result")


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id = Column(
        Integer,
        ForeignKey("workout_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_name = Column(String, nullable=False, index=True)
    properties_json = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="usage_events")
    session = relationship("WorkoutSession", back_populates="usage_events")


class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    message = Column(String, nullable=False)
    source = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="feedback_items")


class WeeklyWorkoutPlan(Base):
    __tablename__ = "weekly_workout_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    input_json = Column(JSONB, nullable=False)
    plan_json = Column(JSONB, nullable=False)
    generation_source = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="weekly_workout_plans")


class WeeklyMealPlan(Base):
    __tablename__ = "weekly_meal_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    input_json = Column(JSONB, nullable=False)
    plan_json = Column(JSONB, nullable=False)
    generation_source = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="weekly_meal_plans")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    token_type = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="auth_tokens")


class BillingSubscription(Base):
    __tablename__ = "billing_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_method_id = Column(Integer, ForeignKey("payment_methods.id", ondelete="SET NULL"), nullable=True, index=True)
    tier = Column(String, nullable=False, default="paid")
    status = Column(String, nullable=False, default="active", index=True)
    amount_vnd = Column(Integer, nullable=False, default=59000)
    interval = Column(String, nullable=False, default="monthly")
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True, index=True)
    next_billing_at = Column(DateTime(timezone=True), nullable=True, index=True)
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    canceled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="subscriptions")
    payment_method = relationship("PaymentMethod", back_populates="subscriptions")
    payments = relationship("Payment", back_populates="subscription")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String, nullable=False, default="vnpay")
    token = Column(String, nullable=False)
    masked_card = Column(String, nullable=True)
    bank_code = Column(String, nullable=True)
    card_type = Column(String, nullable=True)
    status = Column(String, nullable=False, default="active", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="payment_methods")
    subscriptions = relationship("BillingSubscription", back_populates="payment_method")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    subscription_id = Column(Integer, ForeignKey("billing_subscriptions.id", ondelete="SET NULL"), nullable=True, index=True)
    payment_method_id = Column(Integer, ForeignKey("payment_methods.id", ondelete="SET NULL"), nullable=True, index=True)
    provider = Column(String, nullable=False, default="vnpay")
    status = Column(String, nullable=False, default="pending", index=True)
    attempt_type = Column(String, nullable=False, default="initial", index=True)
    amount_vnd = Column(Integer, nullable=False)
    currency = Column(String, nullable=False, default="VND")
    plan_tier = Column(String, nullable=False, default="paid")
    interval = Column(String, nullable=False, default="monthly")
    vnp_txn_ref = Column(String, nullable=False, unique=True, index=True)
    vnp_transaction_no = Column(String, nullable=True, index=True)
    vnp_response_code = Column(String, nullable=True)
    vnp_transaction_status = Column(String, nullable=True)
    payment_url = Column(String, nullable=True)
    raw_request_json = Column(JSONB, nullable=False, default=dict)
    raw_response_json = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="payments")
    subscription = relationship("BillingSubscription", back_populates="payments")
    payment_method = relationship("PaymentMethod")
