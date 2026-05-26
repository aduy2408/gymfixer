import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .schemas import (
    AuthResponse,
    ForgotPasswordRequest,
    GoogleToken,
    LoginRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserOut,
    VerifyEmailRequest,
)
from .utils import (
    EMAIL_VERIFY_TOKEN_EXPIRE_MINUTES,
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    TOKEN_TYPE_EMAIL_VERIFY,
    TOKEN_TYPE_PASSWORD_RESET,
    consume_one_time_token,
    create_access_token,
    create_one_time_token,
    get_current_user,
    get_password_hash,
    oauth2_scheme,
    revoke_access_token,
    send_reset_password_email,
    send_verification_email,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_response(user: User) -> dict:
    return {
        "access_token": create_access_token(user_id=user.id),
        "token_type": "bearer",
        "user": user,
    }


def _send_verification(db: Session, user: User) -> None:
    token = create_one_time_token(db, user, TOKEN_TYPE_EMAIL_VERIFY, EMAIL_VERIFY_TOKEN_EXPIRE_MINUTES)
    db.flush()
    send_verification_email(user.email, token)


@router.post("/register", response_model=UserOut)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        is_verified=False,
        auth_provider="local",
    )
    db.add(user)
    try:
        db.flush()
        _send_verification(db, user)
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to register user. Please try again later.")

    return user


@router.post("/login", response_model=AuthResponse)
def login(user_in: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not user.hashed_password or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return _auth_response(user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    revoke_access_token(db, token)
    db.commit()
    return {"message": "Logged out successfully"}


@router.post("/google", response_model=AuthResponse)
def google_login(token_in: GoogleToken, db: Session = Depends(get_db)):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="Google authentication is not configured.")

    try:
        id_info = id_token.verify_oauth2_token(token_in.token, requests.Request(), client_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google authentication token.")

    email = str(id_info.get("email", "")).strip().lower()
    google_sub = id_info.get("sub")
    name = id_info.get("name") or email.split("@")[0]
    email_verified = bool(id_info.get("email_verified"))

    if not email or not google_sub or not email_verified:
        raise HTTPException(status_code=400, detail="Google account email must be verified.")

    user = db.query(User).filter(User.google_sub == google_sub).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_sub = google_sub
            user.is_verified = True
            if user.auth_provider != "local":
                user.auth_provider = "google"
        else:
            user = User(
                name=name,
                email=email,
                hashed_password=None,
                is_verified=True,
                auth_provider="google",
                google_sub=google_sub,
            )
            db.add(user)

    user.last_login_at = datetime.now(timezone.utc)
    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not complete Google login.")

    return _auth_response(user)


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if user and user.hashed_password:
        token = create_one_time_token(db, user, TOKEN_TYPE_PASSWORD_RESET, PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
        try:
            send_reset_password_email(user.email, token)
            db.commit()
        except Exception:
            db.rollback()
            raise HTTPException(status_code=500, detail="Could not send password reset email.")

    return {"message": "If that email is in our database, we will send a password reset link."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = consume_one_time_token(db, req.token, TOKEN_TYPE_PASSWORD_RESET)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.hashed_password = get_password_hash(req.new_password)
    if user.auth_provider == "google":
        user.auth_provider = "local"
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update the password.")

    return {"message": "Password updated successfully"}


@router.post("/verify-email", response_model=UserOut)
def verify_email(req: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = consume_one_time_token(db, req.token, TOKEN_TYPE_EMAIL_VERIFY)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user.is_verified = True
    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not verify email.")
    return user


@router.post("/resend-verification")
def resend_verification(req: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if user and not user.is_verified:
        try:
            _send_verification(db, user)
            db.commit()
        except Exception:
            db.rollback()
            raise HTTPException(status_code=500, detail="Could not send verification email.")

    return {"message": "If that email needs verification, we will send a verification link."}
