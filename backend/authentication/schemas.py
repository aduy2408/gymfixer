import re
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


PASSWORD_SPECIAL_RE = re.compile(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/;\'`~]')


def normalize_email(value: EmailStr | str) -> str:
    return str(value).strip().lower()


def validate_password_strength(value: str) -> str:
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password must be 72 bytes or fewer")
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Za-z]", value):
        raise ValueError("Password must contain at least one letter")
    if not re.search(r"\d", value):
        raise ValueError("Password must contain at least one number")
    if not PASSWORD_SPECIAL_RE.search(value):
        raise ValueError("Password must contain at least one special character")
    return value


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        if len(value) > 120:
            raise ValueError("Name must be 120 characters or fewer")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: EmailStr) -> str:
        return normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: EmailStr) -> str:
        return normalize_email(value)


class Token(BaseModel):
    access_token: str
    token_type: str


class AuthResponse(Token):
    user: "UserOut"


class TokenData(BaseModel):
    user_id: Optional[int] = None


SubscriptionTier = Literal["free", "trial", "paid"]
UserRole = Literal["user", "admin"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    is_verified: bool
    auth_provider: str
    subscription_tier: SubscriptionTier = "free"
    role: UserRole = "user"
    trial_started_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    premium_expires_at: Optional[datetime] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None


ProfileGender = Literal["male", "female", "other", ""]
ProfileGoal = Literal["fat_loss", "muscle", "strength", "endurance", "rehab", "general", ""]
DiscoverySource = Literal["facebook", "tiktok", "word_of_mouth", ""]


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    height_cm: Optional[int] = Field(default=None, ge=100, le=250)
    weight_kg: Optional[int] = Field(default=None, ge=30, le=300)
    age: Optional[int] = Field(default=None, ge=10, le=100)
    gender: Optional[ProfileGender] = None
    goal: Optional[ProfileGoal] = None
    discovery_source: Optional[DiscoverySource] = None

    @field_validator("name")
    @classmethod
    def validate_optional_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        if len(value) > 120:
            raise ValueError("Name must be 120 characters or fewer")
        return value

    @field_validator("email")
    @classmethod
    def validate_optional_email(cls, value: Optional[EmailStr]) -> Optional[str]:
        if value is None:
            return value
        return normalize_email(value)


class UserProfileOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    subscription_tier: SubscriptionTier = "free"
    role: UserRole = "user"
    trial_started_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    premium_expires_at: Optional[datetime] = None
    height_cm: Optional[int] = None
    weight_kg: Optional[int] = None
    age: Optional[int] = None
    gender: str = ""
    goal: str = ""
    discovery_source: str = ""
    created_at: datetime
    updated_at: Optional[datetime] = None


class GoogleToken(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: EmailStr) -> str:
        return normalize_email(value)


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: EmailStr) -> str:
        return normalize_email(value)
