from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from authentication.database import get_db
from authentication.models import User, WeeklyMealPlan, WeeklyWorkoutPlan
from authentication.utils import get_current_user
from usage_events import log_usage_event


load_dotenv()

router = APIRouter(prefix="/plans", tags=["plans"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_MAX_OUTPUT_TOKENS = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "12000"))
GEMINI_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "60"))
GEMINI_THINKING_LEVEL = os.getenv("GEMINI_THINKING_LEVEL", "minimal")

Goal = Literal["fat_loss", "muscle", "strength", "endurance", "rehab", "general"]
Gender = Literal["male", "female", "other", ""]
GenerationSource = Literal["gemini", "fallback"]
FallbackReason = Literal["missing_api_key", "timeout", "network_error", "http_error", "invalid_response", "schema_error"]
WeekDay = Literal["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
PortionUnit = Literal["g", "ml", "large", "piece", "slice", "scoop", "tbsp", "cup"]

DAYS: list[WeekDay] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
FOOD_DATABASE: dict[str, dict[str, Any]] = {
    "Chicken breast": {"unit": "g", "basis": 100, "calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 3.6, "min": 80, "max": 260},
    "Lean beef": {"unit": "g", "basis": 100, "calories": 176, "protein_g": 26, "carbs_g": 0, "fat_g": 7, "min": 80, "max": 240},
    "Salmon fillet": {"unit": "g", "basis": 100, "calories": 208, "protein_g": 20, "carbs_g": 0, "fat_g": 13, "min": 90, "max": 240},
    "Eggs": {"unit": "large", "basis": 1, "calories": 72, "protein_g": 6.3, "carbs_g": 0.4, "fat_g": 4.8, "min": 1, "max": 5},
    "Greek yogurt": {"unit": "g", "basis": 100, "calories": 59, "protein_g": 10, "carbs_g": 3.6, "fat_g": 0.4, "min": 120, "max": 350},
    "Whey protein": {"unit": "scoop", "basis": 1, "calories": 120, "protein_g": 24, "carbs_g": 3, "fat_g": 2, "min": 1, "max": 2},
    "Tofu": {"unit": "g", "basis": 100, "calories": 144, "protein_g": 15.7, "carbs_g": 3.9, "fat_g": 8.7, "min": 100, "max": 300},
    "Tempeh": {"unit": "g", "basis": 100, "calories": 192, "protein_g": 20, "carbs_g": 7.6, "fat_g": 10.8, "min": 100, "max": 280},
    "Cooked lentils": {"unit": "g", "basis": 100, "calories": 116, "protein_g": 9, "carbs_g": 20, "fat_g": 0.4, "min": 120, "max": 350},
    "Soy yogurt": {"unit": "g", "basis": 100, "calories": 66, "protein_g": 4, "carbs_g": 6, "fat_g": 3, "min": 140, "max": 350},
    "Cooked brown rice": {"unit": "g", "basis": 100, "calories": 123, "protein_g": 2.7, "carbs_g": 25.6, "fat_g": 1, "min": 80, "max": 320},
    "Cooked quinoa": {"unit": "g", "basis": 100, "calories": 120, "protein_g": 4.4, "carbs_g": 21.3, "fat_g": 1.9, "min": 80, "max": 320},
    "Sweet potato": {"unit": "g", "basis": 100, "calories": 86, "protein_g": 1.6, "carbs_g": 20, "fat_g": 0.1, "min": 100, "max": 360},
    "Oats": {"unit": "g", "basis": 100, "calories": 389, "protein_g": 16.9, "carbs_g": 66.3, "fat_g": 6.9, "min": 35, "max": 120},
    "Whole-grain toast": {"unit": "slice", "basis": 1, "calories": 90, "protein_g": 4, "carbs_g": 16, "fat_g": 1.5, "min": 1, "max": 3},
    "Banana": {"unit": "piece", "basis": 1, "calories": 105, "protein_g": 1.3, "carbs_g": 27, "fat_g": 0.4, "min": 1, "max": 2},
    "Berries": {"unit": "g", "basis": 100, "calories": 57, "protein_g": 0.7, "carbs_g": 14, "fat_g": 0.3, "min": 80, "max": 200},
    "Mixed vegetables": {"unit": "g", "basis": 100, "calories": 45, "protein_g": 2, "carbs_g": 9, "fat_g": 0.3, "min": 100, "max": 250},
    "Green salad": {"unit": "g", "basis": 100, "calories": 20, "protein_g": 1.2, "carbs_g": 4, "fat_g": 0.2, "min": 80, "max": 220},
    "Spinach": {"unit": "g", "basis": 100, "calories": 23, "protein_g": 2.9, "carbs_g": 3.6, "fat_g": 0.4, "min": 80, "max": 220},
    "Avocado": {"unit": "g", "basis": 100, "calories": 160, "protein_g": 2, "carbs_g": 8.5, "fat_g": 14.7, "min": 40, "max": 160},
    "Olive oil": {"unit": "tbsp", "basis": 1, "calories": 119, "protein_g": 0, "carbs_g": 0, "fat_g": 13.5, "min": 0.5, "max": 2},
    "Mixed nuts": {"unit": "g", "basis": 100, "calories": 576, "protein_g": 17, "carbs_g": 20, "fat_g": 50, "min": 15, "max": 60},
    "Pumpkin seeds": {"unit": "g", "basis": 100, "calories": 559, "protein_g": 30, "carbs_g": 11, "fat_g": 49, "min": 10, "max": 50},
}
CARB_SOURCE_NAMES = {
    "Cooked brown rice",
    "Cooked quinoa",
    "Sweet potato",
    "Oats",
    "Whole-grain toast",
    "Banana",
    "Berries",
    "Cooked lentils",
}
FAT_SOURCE_NAMES = {"Avocado", "Olive oil", "Mixed nuts", "Pumpkin seeds"}
PROTEIN_SOURCE_NAMES = {
    "Chicken breast",
    "Lean beef",
    "Salmon fillet",
    "Eggs",
    "Greek yogurt",
    "Whey protein",
    "Tofu",
    "Tempeh",
}
CALORIE_TARGET_TOLERANCE = 35
REST_DAY_CALORIE_MARGIN = 150
MOBILITY_DAY_CALORIE_MARGIN = 75
MOBILITY_REST_CALORIE_MARGIN = 50
MAX_NORMALIZED_MEAL_CALORIES = 2900


class GeminiCallError(RuntimeError):
    def __init__(self, reason: FallbackReason, message: str):
        super().__init__(message)
        self.reason = reason


class WorkoutPlanRequest(BaseModel):
    age: int = Field(..., ge=10, le=100)
    height_cm: int = Field(..., ge=100, le=250)
    weight_kg: int = Field(..., ge=30, le=300)
    gender: Gender = ""
    goal: Goal
    level: Literal["beginner", "intermediate", "advanced"]
    days_per_week: int = Field(..., ge=1, le=7)
    session_minutes: int = Field(..., ge=15, le=180)
    equipment: list[str] = Field(default_factory=list, max_length=12)
    injuries: str = Field(default="", max_length=500)
    focus_muscles: list[str] = Field(default_factory=list, max_length=12)

    @field_validator("equipment", "focus_muscles")
    @classmethod
    def clean_list(cls, values: list[str]) -> list[str]:
        return [value.strip()[:80] for value in values if value.strip()]


class ExerciseItem(BaseModel):
    name: str
    sets: int = Field(..., ge=1, le=10)
    reps: str
    rest_sec: int = Field(..., ge=15, le=300)
    notes: str = ""


class WorkoutDay(BaseModel):
    day: WeekDay
    type: Literal["training", "rest", "mobility"]
    title: str
    estimated_minutes: int = Field(..., ge=0, le=240)
    exercises: list[ExerciseItem] = Field(default_factory=list)


class GenerationDiagnostics(BaseModel):
    attempted_gemini: bool = False
    fallback_reason: FallbackReason | None = None
    duration_ms: int | None = None


class WorkoutPlanPayload(BaseModel):
    days: list[WorkoutDay] = Field(..., min_length=7, max_length=7)
    safety_notes: list[str] = Field(default_factory=list)
    generation_diagnostics: GenerationDiagnostics | None = None

    @field_validator("safety_notes", mode="before")
    @classmethod
    def normalise_safety_notes(cls, values: Any) -> Any:
        if isinstance(values, str):
            return [values]
        return values


class WorkoutPlanResponse(WorkoutPlanPayload):
    id: int
    generation_source: GenerationSource


class MealPlanRequest(BaseModel):
    age: int = Field(..., ge=10, le=100)
    height_cm: int = Field(..., ge=100, le=250)
    weight_kg: int = Field(..., ge=30, le=300)
    gender: Gender = ""
    goal: Literal["fat_loss", "muscle", "strength", "endurance", "general"]
    meals_per_day: int = Field(..., ge=1, le=6)
    diet_preference: Literal["none", "vegetarian", "vegan", "halal", "low_carb"] = "none"
    allergies: str = Field(default="", max_length=500)
    disliked_foods: str = Field(default="", max_length=500)
    budget: Literal["low", "medium", "high"] = "medium"
    cooking_time: Literal["minimal", "normal", "meal_prep"] = "normal"
    target_calories: int | None = Field(default=None, ge=1200, le=6000)
    adjust_for_workout_plan: bool = False


class DailyTargets(BaseModel):
    calories: int = Field(..., ge=1000, le=7000)
    protein_g: int = Field(..., ge=20, le=400)
    carbs_g: int = Field(..., ge=20, le=900)
    fat_g: int = Field(..., ge=10, le=250)


class MealIngredient(BaseModel):
    name: str
    quantity: float = Field(..., ge=0)
    unit: PortionUnit
    calories: int = Field(..., ge=0, le=3000)
    protein_g: int = Field(..., ge=0, le=250)
    carbs_g: int = Field(..., ge=0, le=400)
    fat_g: int = Field(..., ge=0, le=200)


class MealItem(BaseModel):
    name: str
    time: str = ""
    items: list[MealIngredient] = Field(default_factory=list)
    calories: int = Field(..., ge=0, le=7000)
    protein_g: int = Field(..., ge=0, le=400)
    carbs_g: int = Field(..., ge=0, le=900)
    fat_g: int = Field(..., ge=0, le=250)

    @field_validator("items", mode="before")
    @classmethod
    def normalise_legacy_items(cls, values: Any) -> Any:
        if isinstance(values, list):
            normalised: list[Any] = []
            for value in values:
                if isinstance(value, str):
                    normalised.append(
                        {
                            "name": value,
                            "quantity": 1,
                            "unit": "piece",
                            "calories": 0,
                            "protein_g": 0,
                            "carbs_g": 0,
                            "fat_g": 0,
                        }
                    )
                else:
                    normalised.append(value)
            return normalised
        return values


class MealDay(BaseModel):
    day: WeekDay
    meals: list[MealItem] = Field(default_factory=list)


class WorkoutSync(BaseModel):
    enabled: bool = False
    source_workout_plan_id: int | None = None
    applied: bool = False
    note: str = ""
    schedule: dict[str, str] | None = None


class MealPlanPayload(BaseModel):
    daily_targets: DailyTargets
    days: list[MealDay] = Field(..., min_length=7, max_length=7)
    safety_notes: list[str] = Field(default_factory=list)
    workout_sync: WorkoutSync | None = None
    generation_diagnostics: GenerationDiagnostics | None = None

    @field_validator("safety_notes", mode="before")
    @classmethod
    def normalise_safety_notes(cls, values: Any) -> Any:
        if isinstance(values, str):
            return [values]
        return values


class MealPlanResponse(MealPlanPayload):
    id: int
    generation_source: GenerationSource


@router.post("/workout", response_model=WorkoutPlanResponse)
def create_workout_plan(
    request: WorkoutPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutPlanResponse:
    payload, source = _generate_workout_plan(request)
    row = WeeklyWorkoutPlan(
        user_id=current_user.id,
        input_json=request.model_dump(),
        plan_json=payload.model_dump(),
        generation_source=source,
    )
    db.add(row)
    db.flush()
    log_usage_event(
        db,
        event_name="weekly_workout_plan_created",
        user_id=current_user.id,
        properties={
            "plan_id": row.id,
            "generation_source": source,
            "goal": request.goal,
            "fallback_reason": payload.generation_diagnostics.fallback_reason if payload.generation_diagnostics else None,
        },
    )
    db.commit()
    db.refresh(row)
    return _workout_response(row)


@router.get("/workout/latest", response_model=WorkoutPlanResponse)
def get_latest_workout_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutPlanResponse:
    row = (
        db.query(WeeklyWorkoutPlan)
        .filter(WeeklyWorkoutPlan.user_id == current_user.id)
        .order_by(WeeklyWorkoutPlan.created_at.desc())
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="No workout plan found.")
    return _workout_response(row)


@router.post("/meals", response_model=MealPlanResponse)
def create_meal_plan(
    request: MealPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MealPlanResponse:
    workout_plan_row = _latest_workout_plan(db, current_user.id) if request.adjust_for_workout_plan else None
    payload, source = _generate_meal_plan(request, workout_plan_row=workout_plan_row)
    row = WeeklyMealPlan(
        user_id=current_user.id,
        input_json=request.model_dump(),
        plan_json=payload.model_dump(),
        generation_source=source,
    )
    db.add(row)
    db.flush()
    log_usage_event(
        db,
        event_name="weekly_meal_plan_created",
        user_id=current_user.id,
        properties={
            "plan_id": row.id,
            "generation_source": source,
            "goal": request.goal,
            "fallback_reason": payload.generation_diagnostics.fallback_reason if payload.generation_diagnostics else None,
        },
    )
    db.commit()
    db.refresh(row)
    return _meal_response(row)


@router.get("/meals/latest", response_model=MealPlanResponse)
def get_latest_meal_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MealPlanResponse:
    row = (
        db.query(WeeklyMealPlan)
        .filter(WeeklyMealPlan.user_id == current_user.id)
        .order_by(WeeklyMealPlan.created_at.desc())
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="No meal plan found.")
    return _meal_response(row)


def _generate_workout_plan(request: WorkoutPlanRequest) -> tuple[WorkoutPlanPayload, GenerationSource]:
    workout_schema = (
        "Required JSON contract: top-level object only with keys days and safety_notes. "
        "days must be an array of exactly 7 objects in this exact order: Mon, Tue, Wed, Thu, Fri, Sat, Sun. "
        "Each day.day must be exactly one of Mon, Tue, Wed, Thu, Fri, Sat, Sun. "
        "Each day.type must be exactly one of training, rest, mobility. Do not output placeholder strings like training|rest|mobility. "
        "Each day.title must be a non-empty string. estimated_minutes must be an integer from 0 to 240. "
        "exercises must be an array. For rest days use estimated_minutes 0 and exercises []. "
        "For mobility days use estimated_minutes 10-30 and 2-5 low-intensity mobility exercises. "
        "For training days include 4-8 exercises. Each exercise must have name string, sets integer 1-10, "
        "reps string, rest_sec integer 15-300, and notes string. "
        "safety_notes must be a JSON array of short strings; if there is one note, return [\"note\"], never a plain string. "
        "Do not include null values or extra top-level keys. "
    )
    prompt = (
        "You are a conservative strength and conditioning coach. Return only strict JSON. "
        "Do not include markdown. Do not diagnose injuries. Build a 7-day workout plan from this input. "
        f"{workout_schema}"
        "Use exactly Mon-Sun once. Use exactly days_per_week training days; if days_per_week is less than 7, include rest or mobility days. "
        f"Input JSON: {json.dumps(request.model_dump(), ensure_ascii=False)}"
    )
    raw_payload, diagnostics = _call_gemini_json_with_diagnostics(prompt)
    if raw_payload is not None:
        try:
            payload = WorkoutPlanPayload.model_validate(raw_payload)
            payload = _normalize_workout_plan_payload(payload, request)
            payload.generation_diagnostics = diagnostics
            return payload, "gemini"
        except ValueError:
            diagnostics.fallback_reason = "schema_error"

    fallback = _fallback_workout_plan(request)
    payload = _normalize_workout_plan_payload(fallback, request, fallback_payload=fallback)
    payload.generation_diagnostics = diagnostics
    return payload, "fallback"


def _generate_meal_plan(
    request: MealPlanRequest,
    *,
    workout_plan_row: WeeklyWorkoutPlan | None = None,
) -> tuple[MealPlanPayload, GenerationSource]:
    workout_schedule = _workout_schedule_from_row(workout_plan_row) if workout_plan_row else None
    workout_sync = _workout_sync_metadata(request, workout_plan_row, workout_schedule)
    meal_slots_json = json.dumps(
        [{"name": slot["name"], "time": slot["time"]} for slot in _meal_slots(request.meals_per_day)],
        ensure_ascii=False,
    )
    allowed_foods = [
        name
        for name in FOOD_DATABASE
        if _diet_allows_food(name, request.diet_preference) and not _food_blocked(name, f"{request.allergies} {request.disliked_foods}")
    ]
    allowed_foods_json = json.dumps(allowed_foods, ensure_ascii=False)
    meal_schema = (
        "Required JSON contract: top-level object only with keys daily_targets, days, and safety_notes. "
        "daily_targets must include integer calories 1000-7000, protein_g 20-400, carbs_g 20-900, fat_g 10-250. "
        "days must be an array of exactly 7 objects in this exact order: Mon, Tue, Wed, Thu, Fri, Sat, Sun. "
        "Each day.day must be exactly one of Mon, Tue, Wed, Thu, Fri, Sat, Sun. "
        "Each day.meals must contain exactly the requested meal slots, no more and no fewer. "
        "Each meal must include name string, time string, items array, calories integer, protein_g integer, carbs_g integer, fat_g integer. "
        "Each item must include name string, quantity positive number, unit exactly one of g, ml, large, piece, slice, scoop, tbsp, cup, "
        "and calories/protein_g/carbs_g/fat_g as non-negative integers. Do not output decimals for calories or macros. "
        "Every meal must have at least one item and every item must have calories greater than 0. "
        "safety_notes must be a JSON array of short strings; if there is one note, return [\"note\"], never a plain string. "
        "Do not include null values, markdown, comments, trailing commas, or extra top-level keys. "
    )
    workout_context = (
        f"Workout schedule JSON: {json.dumps(workout_schedule, ensure_ascii=False)}. "
        "On training days raise calories and carbs, keep protein stable. "
        "On rest days reduce calories and carbs, keep protein stable. "
        "On mobility days use a moderate target between training and rest days. "
        if workout_schedule
        else "No workout schedule is available for meal adjustment. "
    )
    prompt = (
        "You are a conservative sports nutrition assistant. Return only strict JSON. "
        "Do not include markdown. Do not provide medical treatment. Build a 7-day meal plan from this input. "
        "Avoid allergies and disliked foods. Every food item must include a practical portion quantity. "
        f"{meal_schema}"
        f"Use only these exact food names for item.name: {allowed_foods_json}. "
        "Use the matching practical units: grams for meat, fish, tofu, tempeh, lentils, rice, quinoa, potatoes, oats, vegetables, yogurt, nuts, seeds, berries, and avocado; "
        "large for Eggs, scoop for Whey protein, slice for Whole-grain toast, piece for Banana, and tbsp for Olive oil. "
        "Meal calories and macros must equal the sum of that meal's item calories and macros within normal rounding. "
        "Use exactly Mon-Sun once. "
        f"Use exactly these meal slots for every day, in this order: {meal_slots_json}. "
        f"{workout_context}"
        f"Input JSON: {json.dumps(request.model_dump(), ensure_ascii=False)}"
    )
    raw_payload, diagnostics = _call_gemini_json_with_diagnostics(prompt)
    if raw_payload is not None:
        try:
            payload = MealPlanPayload.model_validate(raw_payload)
            if _meal_plan_has_blocked_food(payload, request) or _meal_plan_has_invalid_items(payload):
                raise ValueError("Meal plan contains blocked foods or invalid portions.")
            payload = _normalize_meal_plan_payload(payload, request, workout_schedule=workout_schedule)
            if workout_schedule:
                payload = _enforce_workout_calorie_order(payload, workout_schedule, request)
            if _meal_plan_has_blocked_food(payload, request) or _meal_plan_has_invalid_items(payload):
                raise ValueError("Meal plan contains blocked foods or invalid portions.")
            payload.generation_diagnostics = diagnostics
            return _with_workout_sync(payload, workout_sync), "gemini"
        except ValueError:
            diagnostics.fallback_reason = "schema_error"

    payload = _fallback_meal_plan(request, workout_schedule=workout_schedule)
    payload = _normalize_meal_plan_payload(payload, request, workout_schedule=workout_schedule)
    if workout_schedule:
        payload = _enforce_workout_calorie_order(payload, workout_schedule, request)
    payload.generation_diagnostics = diagnostics
    return _with_workout_sync(payload, workout_sync), "fallback"


def _call_gemini_json_with_diagnostics(prompt: str) -> tuple[dict[str, Any] | None, GenerationDiagnostics]:
    if not GEMINI_API_KEY:
        return None, GenerationDiagnostics(attempted_gemini=False, fallback_reason="missing_api_key")

    started = time.perf_counter()
    try:
        payload = _call_gemini_json(prompt)
        return payload, GenerationDiagnostics(attempted_gemini=True, duration_ms=_elapsed_ms(started))
    except GeminiCallError as exc:
        return None, GenerationDiagnostics(attempted_gemini=True, fallback_reason=exc.reason, duration_ms=_elapsed_ms(started))
    except ValueError:
        return None, GenerationDiagnostics(attempted_gemini=True, fallback_reason="invalid_response", duration_ms=_elapsed_ms(started))
    except RuntimeError:
        return None, GenerationDiagnostics(attempted_gemini=True, fallback_reason="invalid_response", duration_ms=_elapsed_ms(started))


def _elapsed_ms(started: float) -> int:
    return max(0, round((time.perf_counter() - started) * 1000))


def _call_gemini_json(prompt: str) -> dict[str, Any]:
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.25,
            "topP": 0.9,
            "maxOutputTokens": GEMINI_MAX_OUTPUT_TOKENS,
            "responseMimeType": "application/json",
            "thinkingConfig": {
                "thinkingLevel": GEMINI_THINKING_LEVEL,
            },
        },
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=GEMINI_TIMEOUT_SECONDS) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise GeminiCallError("http_error", f"Gemini request failed: HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        reason: FallbackReason = "timeout" if isinstance(exc.reason, TimeoutError) else "network_error"
        raise GeminiCallError(reason, f"Gemini request failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise GeminiCallError("timeout", "Gemini request timed out.") from exc
    except OSError as exc:
        raise GeminiCallError("network_error", f"Gemini request failed: {exc}") from exc

    try:
        text = "".join(part.get("text", "") for part in result["candidates"][0]["content"]["parts"])
    except (KeyError, IndexError, TypeError) as exc:
        raise GeminiCallError("invalid_response", "Gemini response did not contain text output.") from exc
    return _parse_json_object(text)


def _parse_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError("Gemini response was not valid JSON.") from exc
    if not isinstance(parsed, dict):
        raise ValueError("Gemini response JSON must be an object.")
    return parsed


def _fallback_workout_plan(request: WorkoutPlanRequest) -> WorkoutPlanPayload:
    target_days = set(DAYS[: request.days_per_week])
    if request.days_per_week == 7:
        target_days = set(DAYS)
    elif request.days_per_week == 6:
        target_days = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat"}
    elif request.days_per_week == 5:
        target_days = {"Mon", "Tue", "Wed", "Fri", "Sat"}
    elif request.days_per_week == 4:
        target_days = {"Mon", "Tue", "Thu", "Sat"}
    elif request.days_per_week == 3:
        target_days = {"Mon", "Wed", "Fri"}
    elif request.days_per_week == 2:
        target_days = {"Tue", "Fri"}
    elif request.days_per_week == 1:
        target_days = {"Wed"}

    templates = _workout_templates(request)
    training_index = 0
    days: list[WorkoutDay] = []
    for day in DAYS:
        if day not in target_days:
            day_type: Literal["rest", "mobility"] = "mobility" if day in {"Thu", "Sun"} else "rest"
            days.append(
                WorkoutDay(
                    day=day,
                    type=day_type,
                    title="Mobility and recovery" if day_type == "mobility" else "Rest day",
                    estimated_minutes=20 if day_type == "mobility" else 0,
                    exercises=_mobility_exercises() if day_type == "mobility" else [],
                )
            )
            continue
        template = templates[training_index % len(templates)]
        days.append(
            WorkoutDay(
                day=day,
                type="training",
                title=template["title"],
                estimated_minutes=request.session_minutes,
                exercises=[ExerciseItem(**exercise) for exercise in template["exercises"]],
            )
        )
        training_index += 1

    safety_notes = [
        "Stop any movement that causes sharp pain and use easier variations when needed.",
        "Warm up for 5-10 minutes and keep 1-2 reps in reserve on most working sets.",
    ]
    if request.injuries.strip():
        safety_notes.append("Because you reported injuries or limitations, confirm exercise choices with a qualified professional.")
    return WorkoutPlanPayload(days=days, safety_notes=safety_notes)


def _normalize_workout_plan_payload(
    payload: WorkoutPlanPayload,
    request: WorkoutPlanRequest,
    *,
    fallback_payload: WorkoutPlanPayload | None = None,
) -> WorkoutPlanPayload:
    fallback = fallback_payload or _fallback_workout_plan(request)
    fallback_by_day = {day.day: day for day in fallback.days}
    payload_by_day: dict[str, WorkoutDay] = {}
    for day in payload.days:
        if day.day not in payload_by_day:
            payload_by_day[day.day] = day

    normalized_days: list[WorkoutDay] = []
    for day_name in DAYS:
        fallback_day = fallback_by_day[day_name]
        source_day = payload_by_day.get(day_name, fallback_day)
        desired_type = fallback_day.type

        if desired_type == "training":
            exercises = source_day.exercises if source_day.type == "training" and source_day.exercises else fallback_day.exercises
            estimated_minutes = source_day.estimated_minutes if source_day.estimated_minutes > 0 else fallback_day.estimated_minutes
            normalized_days.append(
                WorkoutDay(
                    day=day_name,
                    type="training",
                    title=source_day.title if source_day.type == "training" and source_day.title else fallback_day.title,
                    estimated_minutes=max(15, min(240, estimated_minutes)),
                    exercises=exercises,
                )
            )
            continue

        normalized_days.append(
            WorkoutDay(
                day=day_name,
                type=desired_type,
                title=fallback_day.title,
                estimated_minutes=fallback_day.estimated_minutes,
                exercises=fallback_day.exercises if desired_type == "mobility" else [],
            )
        )

    return WorkoutPlanPayload(
        days=normalized_days,
        safety_notes=_unique_notes(payload.safety_notes + fallback.safety_notes),
        generation_diagnostics=payload.generation_diagnostics,
    )


def _workout_templates(request: WorkoutPlanRequest) -> list[dict[str, Any]]:
    equipment = {item.lower() for item in request.equipment}
    bodyweight_only = not equipment or "bodyweight" in equipment
    strength_reps = "4-6" if request.goal == "strength" else "8-12"
    accessory_reps = "10-15" if request.goal != "strength" else "8-10"
    rest_main = 150 if request.goal == "strength" else 90
    rest_accessory = 75

    if bodyweight_only:
        return [
            {
                "title": "Full Body Strength",
                "exercises": [
                    {"name": "Bodyweight Squat", "sets": 4, "reps": accessory_reps, "rest_sec": rest_main, "notes": "Control depth and tempo."},
                    {"name": "Push-up", "sets": 4, "reps": "6-15", "rest_sec": rest_accessory, "notes": "Elevate hands if needed."},
                    {"name": "Reverse Lunge", "sets": 3, "reps": "8-12 each leg", "rest_sec": rest_accessory, "notes": "Keep knee tracking over toes."},
                    {"name": "Plank", "sets": 3, "reps": "30-60 sec", "rest_sec": 60, "notes": "Brace ribs down."},
                ],
            },
            {
                "title": "Conditioning and Core",
                "exercises": [
                    {"name": "Glute Bridge", "sets": 3, "reps": "12-20", "rest_sec": 60, "notes": "Pause at the top."},
                    {"name": "Incline Push-up", "sets": 3, "reps": "8-15", "rest_sec": 75, "notes": "Keep a straight line."},
                    {"name": "Step-up", "sets": 3, "reps": "10 each leg", "rest_sec": 75, "notes": "Use a stable step."},
                    {"name": "Dead Bug", "sets": 3, "reps": "8 each side", "rest_sec": 45, "notes": "Move slowly."},
                ],
            },
        ]

    return [
        {
            "title": "Lower Body",
            "exercises": [
                {"name": "Squat", "sets": 4, "reps": strength_reps, "rest_sec": rest_main, "notes": "Use a load you can control with clean depth."},
                {"name": "Romanian Deadlift", "sets": 3, "reps": accessory_reps, "rest_sec": rest_main, "notes": "Keep neutral spine and soft knees."},
                {"name": "Walking Lunge", "sets": 3, "reps": "10 each leg", "rest_sec": rest_accessory, "notes": "Drive through the front heel."},
                {"name": "Calf Raise", "sets": 3, "reps": "12-20", "rest_sec": 60, "notes": "Use full range of motion."},
            ],
        },
        {
            "title": "Upper Body",
            "exercises": [
                {"name": "Bench Press or Push-up", "sets": 4, "reps": strength_reps, "rest_sec": rest_main, "notes": "Keep shoulders packed."},
                {"name": "Row", "sets": 4, "reps": accessory_reps, "rest_sec": rest_main, "notes": "Pull elbows toward ribs."},
                {"name": "Overhead Press", "sets": 3, "reps": "6-10", "rest_sec": rest_accessory, "notes": "Brace before each rep."},
                {"name": "Lat Pulldown or Assisted Pull-up", "sets": 3, "reps": "8-12", "rest_sec": rest_accessory, "notes": "Avoid shrugging."},
            ],
        },
        {
            "title": "Full Body",
            "exercises": [
                {"name": "Deadlift Variation", "sets": 3, "reps": "5-8", "rest_sec": rest_main, "notes": "Stop if back position breaks."},
                {"name": "Goblet Squat", "sets": 3, "reps": "10-12", "rest_sec": rest_accessory, "notes": "Smooth controlled reps."},
                {"name": "Dumbbell Press", "sets": 3, "reps": accessory_reps, "rest_sec": rest_accessory, "notes": "Use full comfortable range."},
                {"name": "Farmer Carry", "sets": 3, "reps": "30-45 sec", "rest_sec": 75, "notes": "Stand tall and breathe."},
            ],
        },
    ]


def _mobility_exercises() -> list[ExerciseItem]:
    return [
        ExerciseItem(name="Hip Flexor Stretch", sets=2, reps="45 sec each side", rest_sec=30, notes="Easy breathing."),
        ExerciseItem(name="Thoracic Rotation", sets=2, reps="8 each side", rest_sec=30, notes="Move slowly."),
        ExerciseItem(name="Bodyweight Squat Hold", sets=2, reps="30 sec", rest_sec=45, notes="Stay pain-free."),
    ]


def _fallback_meal_plan(
    request: MealPlanRequest,
    *,
    workout_schedule: dict[str, str] | None = None,
) -> MealPlanPayload:
    targets = _base_meal_targets(request)
    meal_templates = _meal_templates(request)
    meal_slots = _meal_slots(request.meals_per_day)

    days: list[MealDay] = []
    for day_index, day in enumerate(DAYS):
        day_type = workout_schedule.get(day) if workout_schedule else None
        day_targets = _adjust_daily_targets_for_workout(
            base_calories=targets.calories,
            base_protein=targets.protein_g,
            base_fat=targets.fat_g,
            workout_day_type=day_type,
        )
        meals: list[MealItem] = []
        for meal_index, meal_slot in enumerate(meal_slots):
            template = meal_templates[(day_index + meal_index) % len(meal_templates)]
            meal_items = _build_meal_items(
                template,
                target_protein=round(day_targets.protein_g * meal_slot["share"]),
                target_carbs=round(day_targets.carbs_g * meal_slot["share"]),
                target_fat=round(day_targets.fat_g * meal_slot["share"]),
            )
            totals = _sum_ingredients(meal_items)
            meals.append(
                MealItem(
                    name=meal_slot["name"],
                    time=meal_slot["time"],
                    items=meal_items,
                    calories=totals["calories"],
                    protein_g=totals["protein_g"],
                    carbs_g=totals["carbs_g"],
                    fat_g=totals["fat_g"],
                )
            )
        days.append(MealDay(day=day, meals=meals))

    safety_notes = [
        "Use this as general nutrition guidance, not medical advice.",
        "Adjust portions based on hunger, training performance, and weekly body-weight trend.",
    ]
    if workout_schedule:
        safety_notes.append("Meals are adjusted from your latest workout plan: higher carbs on training days and lower carbs on rest days.")
    if request.allergies.strip():
        safety_notes.append("Your listed allergies were considered; verify packaged foods and restaurant meals yourself.")
    return MealPlanPayload(daily_targets=targets, days=days, safety_notes=safety_notes)


def _base_meal_targets(request: MealPlanRequest) -> DailyTargets:
    calories = request.target_calories or _estimate_calories(request)
    protein = max(70, round(request.weight_kg * (2.0 if request.goal in {"muscle", "strength", "fat_loss"} else 1.6)))
    fat = round((calories * 0.25) / 9)
    carbs = max(80, round((calories - protein * 4 - fat * 9) / 4))
    return DailyTargets(calories=calories, protein_g=protein, carbs_g=carbs, fat_g=fat)


def _estimate_calories(request: MealPlanRequest) -> int:
    gender_factor = 5 if request.gender == "male" else -161 if request.gender == "female" else -78
    bmr = 10 * request.weight_kg + 6.25 * request.height_cm - 5 * request.age + gender_factor
    maintenance = bmr * 1.45
    if request.goal == "fat_loss":
        maintenance -= 350
    elif request.goal in {"muscle", "strength"}:
        maintenance += 250
    elif request.goal == "endurance":
        maintenance += 150
    return int(round(max(1200, min(6000, maintenance)) / 50) * 50)


def _latest_workout_plan(db: Session, user_id: int) -> WeeklyWorkoutPlan | None:
    return (
        db.query(WeeklyWorkoutPlan)
        .filter(WeeklyWorkoutPlan.user_id == user_id)
        .order_by(WeeklyWorkoutPlan.created_at.desc())
        .first()
    )


def _workout_schedule_from_row(row: WeeklyWorkoutPlan | None) -> dict[str, str] | None:
    if not row:
        return None
    try:
        payload = WorkoutPlanPayload.model_validate(row.plan_json)
    except ValueError:
        return None
    return {day.day: day.type for day in payload.days}


def _workout_sync_metadata(
    request: MealPlanRequest,
    row: WeeklyWorkoutPlan | None,
    schedule: dict[str, str] | None,
) -> WorkoutSync:
    if not request.adjust_for_workout_plan:
        return WorkoutSync(enabled=False, applied=False, note="Workout schedule adjustment disabled.")
    if row and schedule:
        return WorkoutSync(
            enabled=True,
            source_workout_plan_id=row.id,
            applied=True,
            note="Meal targets were adjusted from your latest workout plan.",
            schedule=schedule,
        )
    if row and not schedule:
        return WorkoutSync(
            enabled=True,
            source_workout_plan_id=row.id,
            applied=False,
            note="Latest workout plan could not be read, so a standard meal plan was generated.",
        )
    return WorkoutSync(
        enabled=True,
        source_workout_plan_id=None,
        applied=False,
        note="No workout plan found, so a standard meal plan was generated.",
    )


def _with_workout_sync(payload: MealPlanPayload, workout_sync: WorkoutSync) -> MealPlanPayload:
    payload.workout_sync = workout_sync
    if workout_sync.enabled and not workout_sync.applied and workout_sync.note:
        if workout_sync.note not in payload.safety_notes:
            payload.safety_notes.append(workout_sync.note)
    return payload


def _normalize_meal_plan_payload(
    payload: MealPlanPayload,
    request: MealPlanRequest,
    *,
    workout_schedule: dict[str, str] | None = None,
    fallback_payload: MealPlanPayload | None = None,
) -> MealPlanPayload:
    fallback = fallback_payload or _fallback_meal_plan(request, workout_schedule=workout_schedule)
    fallback_by_day = {day.day: day for day in fallback.days}
    payload_by_day: dict[str, MealDay] = {}
    for day in payload.days:
        if day.day not in payload_by_day:
            payload_by_day[day.day] = day

    meal_slots = _meal_slots(request.meals_per_day)
    normalized_days: list[MealDay] = []
    for day_name in DAYS:
        source_day = payload_by_day.get(day_name, fallback_by_day[day_name])
        fallback_day = fallback_by_day[day_name]
        meals: list[MealItem] = []

        for meal_index, slot in enumerate(meal_slots):
            source_meal = source_day.meals[meal_index] if meal_index < len(source_day.meals) else fallback_day.meals[meal_index]
            fallback_meal = fallback_day.meals[meal_index]
            if _meal_has_blocked_food(source_meal, request) or _meal_has_invalid_items(source_meal):
                source_meal = fallback_meal
            meals.append(
                _recompute_meal(
                    source_meal.model_copy(
                        update={
                            "name": slot["name"],
                            "time": slot["time"],
                        }
                    )
                )
            )

        normalized_days.append(MealDay(day=day_name, meals=meals))

    return MealPlanPayload(
        daily_targets=_base_meal_targets(request),
        days=normalized_days,
        safety_notes=_unique_notes(payload.safety_notes + fallback.safety_notes),
        workout_sync=payload.workout_sync,
        generation_diagnostics=payload.generation_diagnostics,
    )


def _meal_plan_has_blocked_food(payload: MealPlanPayload, request: MealPlanRequest) -> bool:
    return any(_meal_has_blocked_food(meal, request) for day in payload.days for meal in day.meals)


def _meal_has_blocked_food(meal: MealItem, request: MealPlanRequest) -> bool:
    avoid_text = f"{request.allergies} {request.disliked_foods}"
    return any(_food_blocked(item.name, avoid_text) or not _diet_allows_food(item.name, request.diet_preference) for item in meal.items)


def _meal_plan_has_invalid_items(payload: MealPlanPayload) -> bool:
    return any(_meal_has_invalid_items(meal) for day in payload.days for meal in day.meals)


def _meal_has_invalid_items(meal: MealItem) -> bool:
    if not meal.items:
        return True
    return any(item.quantity <= 0 or item.calories <= 0 for item in meal.items)


def _unique_notes(notes: list[str]) -> list[str]:
    unique: list[str] = []
    for note in notes:
        cleaned = note.strip()
        if cleaned and cleaned not in unique:
            unique.append(cleaned)
    return unique


def _enforce_workout_calorie_order(
    payload: MealPlanPayload,
    workout_schedule: dict[str, str],
    request: MealPlanRequest,
) -> MealPlanPayload:
    base_targets = _base_meal_targets(request)
    target_by_day = {
        day: _adjust_daily_targets_for_workout(
            base_calories=base_targets.calories,
            base_protein=base_targets.protein_g,
            base_fat=base_targets.fat_g,
            workout_day_type=workout_schedule.get(day),
        )
        for day in DAYS
    }

    normalized_days = [
        _adjust_day_calories(
            _recompute_day(day),
            target_by_day.get(day.day, base_targets).calories,
            request,
            prefer=_calorie_boost_preference(request),
        )
        for day in payload.days
    ]
    normalized_days = _enforce_workout_day_gaps(normalized_days, workout_schedule, request)

    safety_notes = list(payload.safety_notes)
    note = "Calories were normalized so workout days stay higher than recovery and rest days."
    if note not in safety_notes:
        safety_notes.append(note)

    return MealPlanPayload(
        daily_targets=base_targets,
        days=normalized_days,
        safety_notes=safety_notes,
        workout_sync=payload.workout_sync,
    )


def _enforce_workout_day_gaps(
    days: list[MealDay],
    workout_schedule: dict[str, str],
    request: MealPlanRequest,
) -> list[MealDay]:
    days = _enforce_training_above_day_type(days, workout_schedule, "rest", REST_DAY_CALORIE_MARGIN, request)
    days = _enforce_training_above_day_type(days, workout_schedule, "mobility", MOBILITY_DAY_CALORIE_MARGIN, request)
    return _enforce_mobility_above_rest(days, workout_schedule, request)


def _enforce_training_above_day_type(
    days: list[MealDay],
    workout_schedule: dict[str, str],
    compared_type: str,
    margin: int,
    request: MealPlanRequest,
) -> list[MealDay]:
    if not _days_for_type(days, workout_schedule, "training") or not _days_for_type(days, workout_schedule, compared_type):
        return days

    min_training = min(_day_calories(day) for day in _days_for_type(days, workout_schedule, "training"))
    max_compared = max(_day_calories(day) for day in _days_for_type(days, workout_schedule, compared_type))
    if min_training >= max_compared + margin:
        return days

    compared_limit = max(1200, min_training - margin)
    lowered_days = [
        _adjust_day_calories(day, compared_limit, request, prefer=_calorie_boost_preference(request))
        if workout_schedule.get(day.day) == compared_type and _day_calories(day) > compared_limit
        else day
        for day in days
    ]

    min_training = min(_day_calories(day) for day in _days_for_type(lowered_days, workout_schedule, "training"))
    max_compared = max(_day_calories(day) for day in _days_for_type(lowered_days, workout_schedule, compared_type))
    if min_training >= max_compared + margin:
        return lowered_days

    training_floor = max_compared + margin
    return [
        _adjust_day_calories(day, training_floor, request, prefer=_calorie_boost_preference(request))
        if workout_schedule.get(day.day) == "training" and _day_calories(day) < training_floor
        else day
        for day in lowered_days
    ]


def _enforce_mobility_above_rest(
    days: list[MealDay],
    workout_schedule: dict[str, str],
    request: MealPlanRequest,
) -> list[MealDay]:
    if not _days_for_type(days, workout_schedule, "mobility") or not _days_for_type(days, workout_schedule, "rest"):
        return days

    min_mobility = min(_day_calories(day) for day in _days_for_type(days, workout_schedule, "mobility"))
    max_rest = max(_day_calories(day) for day in _days_for_type(days, workout_schedule, "rest"))
    if min_mobility >= max_rest + MOBILITY_REST_CALORIE_MARGIN:
        return days

    rest_limit = max(1200, min_mobility - MOBILITY_REST_CALORIE_MARGIN)
    lowered_days = [
        _adjust_day_calories(day, rest_limit, request, prefer=_calorie_boost_preference(request))
        if workout_schedule.get(day.day) == "rest" and _day_calories(day) > rest_limit
        else day
        for day in days
    ]

    min_mobility = min(_day_calories(day) for day in _days_for_type(lowered_days, workout_schedule, "mobility"))
    max_rest = max(_day_calories(day) for day in _days_for_type(lowered_days, workout_schedule, "rest"))
    if min_mobility >= max_rest + MOBILITY_REST_CALORIE_MARGIN:
        return lowered_days

    mobility_floor = max_rest + MOBILITY_REST_CALORIE_MARGIN
    return [
        _adjust_day_calories(day, mobility_floor, request, prefer=_calorie_boost_preference(request))
        if workout_schedule.get(day.day) == "mobility" and _day_calories(day) < mobility_floor
        else day
        for day in lowered_days
    ]


def _days_for_type(days: list[MealDay], workout_schedule: dict[str, str], day_type: str) -> list[MealDay]:
    return [day for day in days if workout_schedule.get(day.day) == day_type]


def _adjust_day_calories(
    day: MealDay,
    target_calories: int,
    request: MealPlanRequest,
    *,
    prefer: str,
) -> MealDay:
    adjusted = _recompute_day(day)
    current_calories = _day_calories(adjusted)
    if current_calories < target_calories - CALORIE_TARGET_TOLERANCE:
        return _increase_day_calories(adjusted, target_calories - current_calories, request, prefer=prefer)
    if current_calories > target_calories + CALORIE_TARGET_TOLERANCE:
        return _decrease_day_calories(adjusted, current_calories - target_calories)
    return adjusted


def _increase_day_calories(
    day: MealDay,
    calories_needed: int,
    request: MealPlanRequest,
    *,
    prefer: str,
) -> MealDay:
    meals = list(day.meals)
    remaining = calories_needed
    source_checks = [_is_carb_source, _is_fat_source]
    if prefer == "fat":
        source_checks.reverse()

    for source_check in source_checks:
        for meal_index in _meal_priority_indexes(meals):
            if remaining <= CALORIE_TARGET_TOLERANCE:
                break
            capacity = _meal_calorie_capacity(meals[meal_index])
            if capacity <= CALORIE_TARGET_TOLERANCE:
                continue
            item_index = _find_item_index(meals[meal_index].items, source_check)
            if item_index is None:
                continue
            before = meals[meal_index].calories
            meals[meal_index] = _adjust_meal_item_calories(
                meals[meal_index],
                item_index,
                min(remaining, capacity),
            )
            delta = meals[meal_index].calories - before
            if delta > 0:
                remaining -= delta

    while remaining > CALORIE_TARGET_TOLERANCE:
        changed = False
        for meal_index in _meal_priority_indexes(meals):
            if remaining <= CALORIE_TARGET_TOLERANCE:
                break
            capacity = _meal_calorie_capacity(meals[meal_index])
            if capacity <= CALORIE_TARGET_TOLERANCE:
                continue
            before = meals[meal_index].calories
            meals[meal_index] = _add_booster_to_meal(
                meals[meal_index],
                min(remaining, capacity),
                request,
                prefer=prefer,
            )
            delta = meals[meal_index].calories - before
            if delta > 0:
                remaining -= delta
                changed = True
        if not changed:
            break

    return MealDay(day=day.day, meals=meals)


def _decrease_day_calories(day: MealDay, calories_to_remove: int) -> MealDay:
    meals = list(day.meals)
    remaining = calories_to_remove
    source_checks = [_is_carb_source, _is_fat_source, _is_low_protein_source, lambda item: not _is_protein_source(item), lambda item: True]

    for source_check in source_checks:
        while remaining > CALORIE_TARGET_TOLERANCE:
            candidate = _find_reduction_candidate(meals, source_check)
            if candidate is None:
                break
            meal_index, item_index = candidate
            before = meals[meal_index].calories
            item = meals[meal_index].items[item_index]
            meals[meal_index] = _adjust_meal_item_calories(
                meals[meal_index],
                item_index,
                -min(remaining, item.calories),
            )
            delta = before - meals[meal_index].calories
            if delta <= 0:
                break
            remaining -= delta
        if remaining <= CALORIE_TARGET_TOLERANCE:
            break

    return MealDay(day=day.day, meals=meals)


def _recompute_day(day: MealDay) -> MealDay:
    return MealDay(day=day.day, meals=[_recompute_meal(meal) for meal in day.meals])


def _recompute_meal(meal: MealItem) -> MealItem:
    totals = _sum_ingredients(meal.items)
    return MealItem(
        name=meal.name,
        time=meal.time,
        items=meal.items,
        calories=totals["calories"],
        protein_g=totals["protein_g"],
        carbs_g=totals["carbs_g"],
        fat_g=totals["fat_g"],
    )


def _day_calories(day: MealDay) -> int:
    return _sum_meal_day(day)["calories"]


def _sum_meal_day(day: MealDay) -> dict[str, int]:
    return {
        "calories": sum(meal.calories for meal in day.meals),
        "protein_g": sum(meal.protein_g for meal in day.meals),
        "carbs_g": sum(meal.carbs_g for meal in day.meals),
        "fat_g": sum(meal.fat_g for meal in day.meals),
    }


def _meal_priority_indexes(meals: list[MealItem]) -> list[int]:
    def priority(meal: MealItem) -> tuple[int, int]:
        name = meal.name.lower()
        if "lunch" in name or "dinner" in name:
            group = 0
        elif "breakfast" in name:
            group = 1
        else:
            group = 2
        return group, -meal.calories

    return sorted(range(len(meals)), key=lambda index: priority(meals[index]))


def _meal_calorie_capacity(meal: MealItem) -> int:
    return max(0, MAX_NORMALIZED_MEAL_CALORIES - meal.calories)


def _find_item_index(items: list[MealIngredient], source_check: Any) -> int | None:
    candidates = [index for index, item in enumerate(items) if source_check(item) and item.calories > 0]
    if not candidates:
        return None
    return max(candidates, key=lambda index: items[index].calories)


def _find_reduction_candidate(meals: list[MealItem], source_check: Any) -> tuple[int, int] | None:
    candidates: list[tuple[int, int, MealIngredient]] = []
    for meal_index, meal in enumerate(meals):
        for item_index, item in enumerate(meal.items):
            if source_check(item) and item.calories > 0:
                candidates.append((meal_index, item_index, item))
    if not candidates:
        return None
    meal_index, item_index, _ = max(candidates, key=lambda candidate: (candidate[2].calories, -candidate[2].protein_g))
    return meal_index, item_index


def _adjust_meal_item_calories(meal: MealItem, item_index: int, calorie_delta: int) -> MealItem:
    items = list(meal.items)
    adjusted_item = _ingredient_with_calorie_delta(items[item_index], calorie_delta)
    if adjusted_item is None:
        del items[item_index]
    else:
        items[item_index] = adjusted_item
    return _recompute_meal(meal.model_copy(update={"items": items}))


def _add_booster_to_meal(
    meal: MealItem,
    calories_to_add: int,
    request: MealPlanRequest,
    *,
    prefer: str,
) -> MealItem:
    food = _booster_food(request, prefer)
    for requested_calories in (calories_to_add, calories_to_add - 25, calories_to_add - 50):
        if requested_calories <= CALORIE_TARGET_TOLERANCE:
            continue
        ingredient = _ingredient_for_calories(food, requested_calories)
        if ingredient.calories <= 0:
            continue
        items = _merge_ingredient(list(meal.items), ingredient)
        adjusted_meal = _recompute_meal(meal.model_copy(update={"items": items}))
        if adjusted_meal.calories <= MAX_NORMALIZED_MEAL_CALORIES:
            return adjusted_meal
    return meal


def _merge_ingredient(items: list[MealIngredient], ingredient: MealIngredient) -> list[MealIngredient]:
    for index, existing in enumerate(items):
        if existing.name.lower() != ingredient.name.lower():
            continue
        food = _ingredient_food(existing.name)
        if food:
            items[index] = _ingredient_from_food_unbounded(food, existing.quantity + ingredient.quantity)
        else:
            items[index] = MealIngredient(
                name=existing.name,
                quantity=existing.quantity + ingredient.quantity,
                unit=existing.unit,
                calories=existing.calories + ingredient.calories,
                protein_g=existing.protein_g + ingredient.protein_g,
                carbs_g=existing.carbs_g + ingredient.carbs_g,
                fat_g=existing.fat_g + ingredient.fat_g,
            )
        return items
    items.append(ingredient)
    return items


def _ingredient_with_calorie_delta(item: MealIngredient, calorie_delta: int) -> MealIngredient | None:
    target_calories = item.calories + calorie_delta
    if target_calories <= 10:
        return None

    food = _ingredient_food(item.name)
    if food:
        quantity = target_calories * float(food["basis"]) / max(float(food["calories"]), 1)
        return _ingredient_from_food_unbounded(food, quantity)

    if item.calories <= 0 or item.quantity <= 0:
        return item

    quantity = _round_quantity_for_unit(item.unit, item.quantity * target_calories / item.calories)
    if quantity <= 0:
        return None
    scale = quantity / item.quantity
    return MealIngredient(
        name=item.name,
        quantity=quantity,
        unit=item.unit,
        calories=max(0, round(item.calories * scale)),
        protein_g=max(0, round(item.protein_g * scale)),
        carbs_g=max(0, round(item.carbs_g * scale)),
        fat_g=max(0, round(item.fat_g * scale)),
    )


def _ingredient_for_calories(food: dict[str, Any], calories: int) -> MealIngredient:
    quantity = calories * float(food["basis"]) / max(float(food["calories"]), 1)
    return _ingredient_from_food_unbounded(food, quantity)


def _ingredient_from_food_unbounded(food: dict[str, Any], quantity: float) -> MealIngredient:
    rounded_quantity = _round_quantity_for_unit(food["unit"], quantity)
    scale = rounded_quantity / float(food["basis"])
    return MealIngredient(
        name=food["name"],
        quantity=rounded_quantity,
        unit=food["unit"],
        calories=max(0, round(float(food["calories"]) * scale)),
        protein_g=max(0, round(float(food["protein_g"]) * scale)),
        carbs_g=max(0, round(float(food["carbs_g"]) * scale)),
        fat_g=max(0, round(float(food["fat_g"]) * scale)),
    )


def _round_quantity_for_unit(unit: str, quantity: float) -> float:
    if quantity <= 0:
        return 0
    if unit == "g":
        return float(max(5, int(round(quantity / 5) * 5)))
    if unit == "tbsp":
        return max(0.5, round(quantity * 2) / 2)
    if unit in {"large", "piece", "slice", "scoop"}:
        return float(max(1, int(round(quantity))))
    return round(quantity, 1)


def _ingredient_food(name: str) -> dict[str, Any] | None:
    if name in FOOD_DATABASE:
        return FOOD_DATABASE[name] | {"name": name}
    normalized_name = name.strip().lower()
    for food_name, food in FOOD_DATABASE.items():
        if food_name.lower() == normalized_name:
            return food | {"name": food_name}
    return None


def _booster_food(request: MealPlanRequest, prefer: str) -> dict[str, Any]:
    avoid_text = f"{request.allergies} {request.disliked_foods}"
    if prefer == "fat" or request.diet_preference == "low_carb":
        candidates = ["Mixed nuts", "Avocado", "Pumpkin seeds", "Olive oil"]
    else:
        candidates = ["Cooked brown rice", "Cooked quinoa", "Sweet potato", "Oats", "Banana"]
    for name in candidates + _safe_food_candidates("fat" if prefer == "fat" else "carb", request.diet_preference):
        if _diet_allows_food(name, request.diet_preference) and not _food_blocked(name, avoid_text):
            return FOOD_DATABASE[name] | {"name": name}
    fallback_name = next((name for name in candidates if _diet_allows_food(name, request.diet_preference)), candidates[0])
    return FOOD_DATABASE[fallback_name] | {"name": fallback_name}


def _calorie_boost_preference(request: MealPlanRequest) -> str:
    return "fat" if request.diet_preference == "low_carb" else "carbs"


def _macro_calories(item: MealIngredient) -> tuple[int, int, int]:
    return item.protein_g * 4, item.carbs_g * 4, item.fat_g * 9


def _is_carb_source(item: MealIngredient) -> bool:
    if _canonical_food_name(item.name) in CARB_SOURCE_NAMES:
        return True
    protein_calories, carb_calories, fat_calories = _macro_calories(item)
    return carb_calories >= protein_calories and carb_calories >= fat_calories


def _is_fat_source(item: MealIngredient) -> bool:
    if _canonical_food_name(item.name) in FAT_SOURCE_NAMES:
        return True
    protein_calories, carb_calories, fat_calories = _macro_calories(item)
    return fat_calories >= protein_calories and fat_calories >= carb_calories


def _is_protein_source(item: MealIngredient) -> bool:
    if _canonical_food_name(item.name) in PROTEIN_SOURCE_NAMES:
        return True
    protein_calories, carb_calories, fat_calories = _macro_calories(item)
    return protein_calories >= carb_calories and protein_calories >= fat_calories


def _is_low_protein_source(item: MealIngredient) -> bool:
    protein_calories, _, _ = _macro_calories(item)
    return protein_calories <= item.calories * 0.25


def _canonical_food_name(name: str) -> str:
    food = _ingredient_food(name)
    return food["name"] if food else name


def _adjust_daily_targets_for_workout(
    *,
    base_calories: int,
    base_protein: int,
    base_fat: int,
    workout_day_type: str | None,
) -> DailyTargets:
    multipliers = {
        "training": 1.10,
        "mobility": 1.03,
        "rest": 0.92,
    }
    multiplier = multipliers.get(workout_day_type or "", 1.0)
    calories = _round_to_nearest_50(base_calories * multiplier)
    protein = base_protein
    fat = base_fat
    carbs = max(60, round((calories - protein * 4 - fat * 9) / 4))
    return DailyTargets(calories=calories, protein_g=protein, carbs_g=carbs, fat_g=fat)


def _round_to_nearest_50(value: float) -> int:
    return int(round(max(1200, min(6000, value)) / 50) * 50)


def _meal_templates(request: MealPlanRequest) -> list[dict[str, Any]]:
    vegan = request.diet_preference == "vegan"
    vegetarian = request.diet_preference in {"vegetarian", "vegan"}
    low_carb = request.diet_preference == "low_carb"
    avoid = f"{request.allergies} {request.disliked_foods}"

    def pick(names: list[str], role: str) -> dict[str, Any]:
        for name in names + _safe_food_candidates(role, request.diet_preference):
            food = FOOD_DATABASE[name] | {"name": name}
            if _diet_allows_food(name, request.diet_preference) and not _food_blocked(name, avoid):
                return food
        fallback_name = next((name for name in names if _diet_allows_food(name, request.diet_preference)), names[-1])
        return FOOD_DATABASE[fallback_name] | {"name": fallback_name}

    if vegan:
        return [
            {"name": "Breakfast", "protein": pick(["Tofu", "Soy yogurt"], "protein"), "carb": pick(["Whole-grain toast", "Oats"], "carb"), "fat": pick(["Avocado", "Pumpkin seeds"], "fat"), "produce": pick(["Spinach", "Berries"], "produce")},
            {"name": "Lunch", "protein": pick(["Cooked lentils", "Tempeh", "Tofu"], "protein"), "carb": pick(["Cooked brown rice", "Cooked quinoa"], "carb"), "fat": pick(["Olive oil", "Avocado"], "fat"), "produce": pick(["Mixed vegetables", "Green salad"], "produce")},
            {"name": "Snack", "protein": pick(["Soy yogurt", "Tofu"], "protein"), "carb": pick(["Berries", "Banana"], "carb"), "fat": pick(["Pumpkin seeds", "Mixed nuts"], "fat"), "produce": pick(["Berries", "Banana"], "produce")},
            {"name": "Dinner", "protein": pick(["Tempeh", "Tofu", "Cooked lentils"], "protein"), "carb": pick(["Cooked quinoa", "Sweet potato"], "carb"), "fat": pick(["Olive oil", "Avocado"], "fat"), "produce": pick(["Mixed vegetables", "Spinach"], "produce")},
        ]
    if vegetarian:
        return [
            {"name": "Breakfast", "protein": pick(["Greek yogurt", "Eggs", "Tofu"], "protein"), "carb": pick(["Oats", "Whole-grain toast"], "carb"), "fat": pick(["Mixed nuts", "Avocado"], "fat"), "produce": pick(["Banana", "Berries"], "produce")},
            {"name": "Lunch", "protein": pick(["Eggs", "Tofu", "Cooked lentils"], "protein"), "carb": pick(["Sweet potato", "Cooked brown rice"], "carb"), "fat": pick(["Olive oil", "Avocado"], "fat"), "produce": pick(["Green salad", "Mixed vegetables"], "produce")},
            {"name": "Snack", "protein": pick(["Greek yogurt", "Whey protein", "Soy yogurt"], "protein"), "carb": pick(["Berries", "Banana"], "carb"), "fat": pick(["Mixed nuts", "Pumpkin seeds"], "fat"), "produce": pick(["Berries", "Banana"], "produce")},
            {"name": "Dinner", "protein": pick(["Tofu", "Tempeh", "Eggs"], "protein"), "carb": pick(["Cooked brown rice", "Cooked quinoa"], "carb"), "fat": pick(["Olive oil", "Avocado"], "fat"), "produce": pick(["Mixed vegetables", "Spinach"], "produce")},
        ]
    if low_carb:
        return [
            {"name": "Breakfast", "protein": pick(["Eggs", "Greek yogurt"], "protein"), "carb": pick(["Spinach", "Berries"], "carb"), "fat": pick(["Avocado", "Mixed nuts"], "fat"), "produce": pick(["Spinach", "Berries"], "produce")},
            {"name": "Lunch", "protein": pick(["Chicken breast", "Lean beef", "Tofu"], "protein"), "carb": pick(["Green salad", "Mixed vegetables"], "carb"), "fat": pick(["Olive oil", "Avocado"], "fat"), "produce": pick(["Green salad", "Mixed vegetables"], "produce")},
            {"name": "Snack", "protein": pick(["Whey protein", "Greek yogurt"], "protein"), "carb": pick(["Berries", "Spinach"], "carb"), "fat": pick(["Mixed nuts", "Pumpkin seeds"], "fat"), "produce": pick(["Berries", "Spinach"], "produce")},
            {"name": "Dinner", "protein": pick(["Salmon fillet", "Chicken breast", "Tempeh"], "protein"), "carb": pick(["Mixed vegetables", "Green salad"], "carb"), "fat": pick(["Olive oil", "Avocado"], "fat"), "produce": pick(["Mixed vegetables", "Green salad"], "produce")},
        ]
    return [
        {"name": "Breakfast", "protein": pick(["Eggs", "Greek yogurt", "Whey protein"], "protein"), "carb": pick(["Oats", "Whole-grain toast"], "carb"), "fat": pick(["Mixed nuts", "Avocado"], "fat"), "produce": pick(["Banana", "Berries"], "produce")},
        {"name": "Lunch", "protein": pick(["Chicken breast", "Lean beef", "Tofu"], "protein"), "carb": pick(["Cooked brown rice", "Cooked quinoa"], "carb"), "fat": pick(["Olive oil", "Avocado"], "fat"), "produce": pick(["Mixed vegetables", "Green salad"], "produce")},
        {"name": "Snack", "protein": pick(["Greek yogurt", "Whey protein", "Soy yogurt"], "protein"), "carb": pick(["Berries", "Banana"], "carb"), "fat": pick(["Mixed nuts", "Pumpkin seeds"], "fat"), "produce": pick(["Berries", "Banana"], "produce")},
        {"name": "Dinner", "protein": pick(["Salmon fillet", "Lean beef", "Chicken breast"], "protein"), "carb": pick(["Sweet potato", "Cooked brown rice"], "carb"), "fat": pick(["Olive oil", "Avocado"], "fat"), "produce": pick(["Green salad", "Mixed vegetables"], "produce")},
    ]


def _safe_food_candidates(role: str, diet_preference: str) -> list[str]:
    candidates = {
        "protein": ["Tofu", "Tempeh", "Cooked lentils", "Soy yogurt", "Greek yogurt", "Eggs", "Lean beef", "Chicken breast"],
        "carb": ["Cooked brown rice", "Cooked quinoa", "Sweet potato", "Oats", "Berries", "Banana"],
        "fat": ["Olive oil", "Avocado", "Pumpkin seeds", "Mixed nuts"],
        "produce": ["Spinach", "Green salad", "Mixed vegetables", "Berries", "Banana"],
    }.get(role, list(FOOD_DATABASE.keys()))
    return [name for name in candidates if _diet_allows_food(name, diet_preference)]


def _diet_allows_food(food_name: str, diet_preference: str) -> bool:
    lower_name = food_name.lower()
    if diet_preference == "halal" and any(token in lower_name for token in {"pork", "bacon", "ham"}):
        return False
    if diet_preference == "vegan" and "soy yogurt" not in lower_name and any(token in lower_name for token in {"chicken", "beef", "salmon", "fish", "egg", "yogurt", "whey", "milk", "meat"}):
        return False
    if diet_preference == "vegetarian" and any(token in lower_name for token in {"chicken", "beef", "salmon", "fish", "meat"}):
        return False
    animal_foods = {"Chicken breast", "Lean beef", "Salmon fillet", "Eggs", "Greek yogurt", "Whey protein"}
    meat_and_fish = {"Chicken breast", "Lean beef", "Salmon fillet"}
    if diet_preference == "vegan":
        return food_name not in animal_foods
    if diet_preference == "vegetarian":
        return food_name not in meat_and_fish
    return True


def _food_blocked(food_name: str, avoid_text: str) -> bool:
    avoid = avoid_text.lower()
    if not avoid.strip():
        return False
    words = {word for word in re.split(r"[^a-zA-Z]+", food_name.lower()) if len(word) >= 3}
    aliases = {
        "eggs": {"egg", "eggs"},
        "chicken breast": {"chicken"},
        "salmon fillet": {"salmon", "fish"},
        "greek yogurt": {"yogurt", "dairy"},
        "soy yogurt": {"soy", "yogurt"},
        "whey protein": {"whey", "dairy"},
        "mixed nuts": {"nuts", "peanut", "almond"},
        "pumpkin seeds": {"seed", "seeds"},
    }
    words.update(aliases.get(food_name.lower(), set()))
    return any(word in avoid for word in words)


def _build_meal_items(
    template: dict[str, Any],
    *,
    target_protein: int,
    target_carbs: int,
    target_fat: int,
) -> list[MealIngredient]:
    protein_food = template["protein"]
    carb_food = template["carb"]
    fat_food = template["fat"]
    produce_food = template["produce"]
    items = [
        _ingredient_from_food(protein_food, _quantity_for_macro(protein_food, "protein_g", max(8, target_protein * 0.75))),
        _ingredient_from_food(carb_food, _quantity_for_macro(carb_food, "carbs_g", max(8, target_carbs * 0.8))),
        _ingredient_from_food(fat_food, _quantity_for_macro(fat_food, "fat_g", max(4, target_fat * 0.65))),
        _ingredient_from_food(produce_food, _default_produce_quantity(produce_food)),
    ]
    deduped: dict[str, MealIngredient] = {}
    for item in items:
        existing = deduped.get(item.name)
        if existing:
            combined_quantity = existing.quantity + item.quantity
            deduped[item.name] = _ingredient_from_food(FOOD_DATABASE[item.name] | {"name": item.name}, combined_quantity)
        else:
            deduped[item.name] = item
    return list(deduped.values())


def _quantity_for_macro(food: dict[str, Any], macro: str, target: float) -> float:
    per_basis = float(food.get(macro) or 0)
    if per_basis <= 0:
        return _round_quantity(food, food["min"])
    raw_quantity = target * float(food["basis"]) / per_basis
    return _round_quantity(food, raw_quantity)


def _default_produce_quantity(food: dict[str, Any]) -> float:
    if food["unit"] in {"piece", "slice"}:
        return _round_quantity(food, 1)
    if food["name"] in {"Avocado"}:
        return _round_quantity(food, 60)
    return _round_quantity(food, 120)


def _round_quantity(food: dict[str, Any], quantity: float) -> float:
    minimum = float(food.get("min", 0))
    maximum = float(food.get("max", quantity))
    quantity = max(minimum, min(maximum, quantity))
    unit = food["unit"]
    if unit == "g":
        return float(int(round(quantity / 5) * 5))
    if unit == "tbsp":
        return round(quantity * 2) / 2
    if unit in {"large", "piece", "slice", "scoop"}:
        return float(max(int(round(quantity)), int(minimum)))
    return round(quantity, 1)


def _ingredient_from_food(food: dict[str, Any], quantity: float) -> MealIngredient:
    scale = quantity / float(food["basis"])
    return MealIngredient(
        name=food["name"],
        quantity=quantity,
        unit=food["unit"],
        calories=round(float(food["calories"]) * scale),
        protein_g=round(float(food["protein_g"]) * scale),
        carbs_g=round(float(food["carbs_g"]) * scale),
        fat_g=round(float(food["fat_g"]) * scale),
    )


def _sum_ingredients(items: list[MealIngredient]) -> dict[str, int]:
    return {
        "calories": sum(item.calories for item in items),
        "protein_g": sum(item.protein_g for item in items),
        "carbs_g": sum(item.carbs_g for item in items),
        "fat_g": sum(item.fat_g for item in items),
    }


def _meal_slots(total: int) -> list[dict[str, Any]]:
    presets: dict[int, list[tuple[str, str, float]]] = {
        1: [("Main Meal", "12:00", 1.0)],
        2: [("Breakfast", "08:00", 0.45), ("Dinner", "18:30", 0.55)],
        3: [("Breakfast", "07:30", 0.3), ("Lunch", "12:30", 0.4), ("Dinner", "19:00", 0.3)],
        4: [
            ("Breakfast", "07:30", 0.25),
            ("Lunch", "12:30", 0.35),
            ("Afternoon Snack", "16:00", 0.15),
            ("Dinner", "19:30", 0.25),
        ],
        5: [
            ("Breakfast", "07:00", 0.22),
            ("Morning Snack", "10:30", 0.12),
            ("Lunch", "13:30", 0.28),
            ("Afternoon Snack", "17:00", 0.12),
            ("Dinner", "20:00", 0.26),
        ],
        6: [
            ("Breakfast", "07:00", 0.18),
            ("Morning Snack", "10:00", 0.1),
            ("Lunch", "12:30", 0.24),
            ("Afternoon Snack", "15:30", 0.1),
            ("Dinner", "18:30", 0.22),
            ("Evening Snack", "21:00", 0.16),
        ],
    }
    return [{"name": name, "time": meal_time, "share": share} for name, meal_time, share in presets[total]]


def _meal_share(index: int, total: int) -> float:
    return float(_meal_slots(total)[index]["share"])


def _meal_time(index: int, total: int) -> str:
    return str(_meal_slots(total)[index]["time"])


def _workout_response(row: WeeklyWorkoutPlan) -> WorkoutPlanResponse:
    payload = WorkoutPlanPayload.model_validate(row.plan_json)
    return WorkoutPlanResponse(id=row.id, generation_source=row.generation_source, **payload.model_dump())


def _meal_response(row: WeeklyMealPlan) -> MealPlanResponse:
    payload = MealPlanPayload.model_validate(row.plan_json)
    return MealPlanResponse(id=row.id, generation_source=row.generation_source, **payload.model_dump())
