import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


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


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    is_verified: bool
    auth_provider: str
    created_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


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
