import hashlib
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Optional

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from .models import AuthToken, RevokedToken, User

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable not set")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
EMAIL_VERIFY_TOKEN_EXPIRE_MINUTES = int(os.getenv("EMAIL_VERIFY_TOKEN_EXPIRE_MINUTES", str(24 * 60)))
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "15"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

TOKEN_TYPE_EMAIL_VERIFY = "email_verify"
TOKEN_TYPE_PASSWORD_RESET = "password_reset"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    payload = {
        "sub": str(user_id),
        "type": "access",
        "jti": secrets.token_urlsafe(24),
        "exp": now_utc() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_one_time_token(db: Session, user: User, token_type: str, expires_in_minutes: int) -> str:
    db.query(AuthToken).filter(
        AuthToken.user_id == user.id,
        AuthToken.token_type == token_type,
        AuthToken.used_at.is_(None),
    ).update({"used_at": now_utc()}, synchronize_session=False)

    raw_token = secrets.token_urlsafe(48)
    db.add(
        AuthToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            token_type=token_type,
            expires_at=now_utc() + timedelta(minutes=expires_in_minutes),
        )
    )
    return raw_token


def consume_one_time_token(db: Session, raw_token: str, token_type: str) -> User | None:
    token = db.query(AuthToken).filter(
        AuthToken.token_hash == hash_token(raw_token),
        AuthToken.token_type == token_type,
    ).first()
    if not token or token.used_at is not None:
        return None
    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        return None
    token.used_at = now_utc()
    return token.user


def send_email(to_email: str, subject: str, body: str) -> None:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM_EMAIL")
    smtp_name = os.getenv("SMTP_FROM_NAME", "GymFixer")
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"

    if not smtp_host or not smtp_from:
        print("--- EMAIL DEV FALLBACK ---")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(body)
        print("--------------------------")
        return

    message = EmailMessage()
    message["From"] = f"{smtp_name} <{smtp_from}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as smtp:
        if use_tls:
            smtp.starttls()
        if smtp_username and smtp_password:
            smtp.login(smtp_username, smtp_password)
        smtp.send_message(message)


def send_verification_email(email: str, token: str) -> None:
    link = f"{FRONTEND_URL}/auth/verify-email?token={token}"
    send_email(
        email,
        "Verify your GymFixer email",
        f"Verify your email by opening this link:\n\n{link}\n\nThis link expires in {EMAIL_VERIFY_TOKEN_EXPIRE_MINUTES} minutes.",
    )


def send_reset_password_email(email: str, token: str) -> None:
    link = f"{FRONTEND_URL}/auth/reset-password?token={token}"
    send_email(
        email,
        "Reset your GymFixer password",
        f"Reset your password by opening this link:\n\n{link}\n\nThis link expires in {PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes and can only be used once.",
    )


def decode_access_token_or_raise(token: str) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access" or not payload.get("jti") or not payload.get("sub"):
            raise credentials_exception
        return payload
    except jwt.PyJWTError:
        raise credentials_exception


def revoke_access_token(db: Session, token: str) -> None:
    payload = decode_access_token_or_raise(token)
    jti = payload["jti"]
    if db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
        return
    expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    db.add(RevokedToken(jti=jti, expires_at=expires_at))


def is_token_revoked(db: Session, jti: str) -> bool:
    revoked = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
    if not revoked:
        return False
    expires_at = revoked.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        db.delete(revoked)
        return False
    return True


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token_or_raise(token)
    if is_token_revoked(db, payload["jti"]):
        raise credentials_exception

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if user is None:
        raise credentials_exception
    return user
