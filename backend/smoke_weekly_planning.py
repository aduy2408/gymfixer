from __future__ import annotations

import sys
import types


def _install_import_stubs() -> None:
    db_mod = types.ModuleType("authentication.database")
    db_mod.get_db = lambda: None

    models_mod = types.ModuleType("authentication.models")
    models_mod.User = type("User", (), {})
    models_mod.UsageEvent = type("UsageEvent", (), {})
    models_mod.WorkoutSession = type("WorkoutSession", (), {})
    models_mod.WeeklyMealPlan = type("WeeklyMealPlan", (), {})
    models_mod.WeeklyWorkoutPlan = type("WeeklyWorkoutPlan", (), {})

    utils_mod = types.ModuleType("authentication.utils")
    utils_mod.get_current_user = lambda: None

    usage_mod = types.ModuleType("usage_events")
    usage_mod.log_usage_event = lambda *args, **kwargs: None

    sys.modules["authentication.database"] = db_mod
    sys.modules["authentication.models"] = models_mod
    sys.modules["authentication.utils"] = utils_mod
    sys.modules["usage_events"] = usage_mod


_install_import_stubs()

import plan_routes as p  # noqa: E402


def _workout_request(days_per_week: int = 4) -> p.WorkoutPlanRequest:
    return p.WorkoutPlanRequest(
        age=30,
        height_cm=175,
        weight_kg=80,
        gender="male",
        goal="muscle",
        level="intermediate",
        training_location="gym",
        days_per_week=days_per_week,
        session_minutes=60,
        equipment=[],
        current_loads="Squat 80kg x 5, bench press 60kg x 5",
        focus_muscles=["chest", "back", "legs"],
    )


def _meal_request(**overrides: object) -> p.MealPlanRequest:
    data: dict[str, object] = {
        "age": 30,
        "height_cm": 175,
        "weight_kg": 80,
        "gender": "male",
        "goal": "muscle",
        "activity_level": "moderate",
        "meals_per_day": 4,
        "diet_preference": "none",
        "allergies": "",
        "disliked_foods": "",
        "budget": "medium",
        "cooking_time": "normal",
        "budget_vnd_per_day": 120000,
        "cooking_time_hours_per_day": 1.0,
        "target_calories": 2600,
        "adjust_for_workout_plan": False,
    }
    data.update(overrides)
    return p.MealPlanRequest(**data)


def _assert_workout_plan(payload: p.WorkoutPlanPayload, days_per_week: int) -> None:
    assert [day.day for day in payload.days] == p.DAYS
    assert len({day.day for day in payload.days}) == 7
    assert sum(day.type == "training" for day in payload.days) == days_per_week
    for day in payload.days:
        if day.type == "rest":
            assert day.estimated_minutes == 0
            assert not day.exercises
        if day.type == "mobility":
            assert day.estimated_minutes <= 30
        if day.type == "training":
            assert all(exercise.load_recommendation for exercise in day.exercises)


def _assert_vietnamese_meal_plan(payload: p.MealPlanPayload) -> None:
    food_names = [item.name for day in payload.days for meal in day.meals for item in meal.items]
    assert food_names
    assert all(name in p.FOOD_DATABASE for name in food_names)
    assert any(any(ord(char) > 127 for char in name) for name in food_names)
    assert not any(name in {"Chicken breast", "Greek yogurt", "Cooked quinoa", "Whole-grain toast"} for name in food_names)
    assert all(item.name_en and item.name_vi for day in payload.days for meal in day.meals for item in meal.items)
    assert all(meal.name_en and meal.name_vi for day in payload.days for meal in day.meals)


def _assert_meal_totals(payload: p.MealPlanPayload, meals_per_day: int) -> None:
    assert [day.day for day in payload.days] == p.DAYS
    assert payload.nutrition_metrics is not None
    for day in payload.days:
        assert len(day.meals) == meals_per_day
        for meal in day.meals:
            totals = p._sum_ingredients(meal.items)
            assert meal.calories == totals["calories"]
            assert meal.protein_g == totals["protein_g"]
            assert meal.carbs_g == totals["carbs_g"]
            assert meal.fat_g == totals["fat_g"]
            assert meal.estimated_cost_vnd == totals["estimated_cost_vnd"]
            assert all(item.quantity > 0 and item.calories > 0 for item in meal.items)
            assert all(item.estimated_cost_vnd >= 0 for item in meal.items)
        assert day.estimated_cost_vnd == sum(meal.estimated_cost_vnd for meal in day.meals)
    _assert_vietnamese_meal_plan(payload)


def _assert_workout_equipment_defaults() -> None:
    home_request = _workout_request()
    home_request.training_location = "home"
    assert "bodyweight" in p._effective_workout_equipment(home_request)

    gym_request = _workout_request()
    assert "barbell" in p._effective_workout_equipment(gym_request)

    custom_request = _workout_request()
    custom_request.equipment = ["kettlebell"]
    assert p._effective_workout_equipment(custom_request) == ["kettlebell"]

    home_payload = p._fallback_workout_plan(home_request)
    assert all(
        "Bodyweight" in exercise.load_recommendation
        for day in home_payload.days
        if day.type == "training"
        for exercise in day.exercises
    )

    gym_payload = p._fallback_workout_plan(gym_request)
    assert any(
        "logged load" in exercise.load_recommendation
        for day in gym_payload.days
        if day.type == "training"
        for exercise in day.exercises
    )


def _assert_tdee_metrics() -> None:
    request = _meal_request(target_calories=None, activity_level="active", budget_vnd_per_day=90000, cooking_time_hours_per_day=1.5)
    metrics = p._nutrition_metrics(request)
    assert metrics.activity_factor == p.ACTIVITY_FACTORS["active"]
    assert metrics.tdee > metrics.bmr
    assert metrics.target_calories == p._base_meal_targets(request).calories
    payload = p._fallback_meal_plan(request)
    assert payload.nutrition_metrics is not None
    assert payload.nutrition_metrics.budget_vnd_per_day == 90000
    assert payload.nutrition_metrics.cooking_time_hours_per_day == 1.5
    assert all(day.estimated_cost_vnd > 0 for day in payload.days)


def _assert_v2_prompt_contracts() -> None:
    captured: dict[str, str] = {}

    workout_food = {"name": "Bodyweight Squat", "sets": 3, "reps": "10-12", "rest_sec": 60, "notes": "", "load_recommendation": "Bodyweight"}

    def workout_ok(prompt: str) -> dict[str, object]:
        captured["workout"] = prompt
        return {
            "days": [
                {
                    "day": day,
                    "type": "training" if day in {"Mon", "Wed", "Fri"} else "rest",
                    "title": "Home strength" if day in {"Mon", "Wed", "Fri"} else "Rest day",
                    "estimated_minutes": 45 if day in {"Mon", "Wed", "Fri"} else 0,
                    "exercises": [workout_food] if day in {"Mon", "Wed", "Fri"} else [],
                }
                for day in p.DAYS
            ],
            "safety_notes": ["Keep two reps in reserve."],
        }

    p.GEMINI_API_KEY = "test-key"
    p._call_gemini_json = workout_ok
    workout_payload, source = p._generate_workout_plan(
        _workout_request(days_per_week=3).model_copy(update={"training_location": "home", "equipment": [], "current_loads": "Squat 80kg x 5"})
    )
    assert source == "gemini"
    _assert_workout_plan(workout_payload, 3)
    assert "Effective equipment context" in captured["workout"]
    assert "bodyweight" in captured["workout"]
    assert "current_loads" in captured["workout"]
    assert "load_recommendation" in captured["workout"]

    food = {"name": "Ức gà", "quantity": 100, "unit": "g", "calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 4, "estimated_cost_vnd": 10500}

    def meal_ok(prompt: str) -> dict[str, object]:
        captured["meal"] = prompt
        return {
            "daily_targets": {"calories": 2600, "protein_g": 160, "carbs_g": 300, "fat_g": 72},
            "days": [
                {
                    "day": day,
                    "meals": [
                        {"name": "Lunch", "time": "21:00", "items": [food], "calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 4}
                        for _ in range(4)
                    ],
                }
                for day in p.DAYS
            ],
            "safety_notes": [],
        }

    p._call_gemini_json = meal_ok
    request = _meal_request(target_calories=None, activity_level="very_active", budget_vnd_per_day=80000, cooking_time_hours_per_day=2)
    meal_payload, source = p._generate_meal_plan(request)
    assert source == "gemini"
    _assert_meal_totals(meal_payload, request.meals_per_day)
    assert "Vietnamese, Vietnam-friendly" in captured["meal"]
    assert "budget_vnd_per_day" in captured["meal"]
    assert "cooking_time_hours_per_day" in captured["meal"]
    assert "activity_level" in captured["meal"]
    assert "Ức gà" in captured["meal"]


def _assert_meal_slots() -> None:
    expected_last = {
        1: ("Main Meal", "12:00"),
        2: ("Dinner", "18:30"),
        3: ("Dinner", "19:00"),
        4: ("Dinner", "19:30"),
        5: ("Dinner", "20:00"),
        6: ("Evening Snack", "21:00"),
    }
    for meals_per_day in range(1, 7):
        payload = p._fallback_meal_plan(_meal_request(meals_per_day=meals_per_day))
        _assert_meal_totals(payload, meals_per_day)
        for day in payload.days:
            assert (day.meals[-1].name, day.meals[-1].time) == expected_last[meals_per_day]
            assert not any(meal.name == "Lunch" and meal.time >= "14:00" for meal in day.meals)


def _assert_workout_sync_order() -> None:
    p.GEMINI_API_KEY = ""
    workout_payload, _ = p._generate_workout_plan(_workout_request(days_per_week=3))

    class Row:
        id = 123
        plan_json = workout_payload.model_dump()

    request = _meal_request(adjust_for_workout_plan=True)
    payload, _ = p._generate_meal_plan(request, workout_plan_row=Row())
    _assert_meal_totals(payload, request.meals_per_day)
    schedule = p._workout_schedule_from_row(Row())
    assert schedule is not None
    totals = {day.day: p._day_calories(day) for day in payload.days}
    training = [totals[day] for day, day_type in schedule.items() if day_type == "training"]
    rest = [totals[day] for day, day_type in schedule.items() if day_type == "rest"]
    mobility = [totals[day] for day, day_type in schedule.items() if day_type == "mobility"]
    assert min(training) >= max(rest) + p.REST_DAY_CALORIE_MARGIN
    if mobility:
        assert min(training) >= max(mobility) + p.MOBILITY_DAY_CALORIE_MARGIN


def _assert_gemini_paths() -> None:
    p.GEMINI_API_KEY = ""
    payload, source = p._generate_meal_plan(_meal_request())
    assert source == "fallback"
    assert payload.generation_diagnostics is not None
    assert payload.generation_diagnostics.fallback_reason == "missing_api_key"

    p.GEMINI_API_KEY = "test-key"
    p._call_gemini_json = lambda prompt: (_ for _ in ()).throw(p.GeminiCallError("timeout", "timeout"))
    payload, source = p._generate_meal_plan(_meal_request())
    assert source == "fallback"
    assert payload.generation_diagnostics is not None
    assert payload.generation_diagnostics.attempted_gemini is True
    assert payload.generation_diagnostics.fallback_reason == "timeout"

    food = {"name": "Ức gà", "quantity": 100, "unit": "g", "calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 4, "estimated_cost_vnd": 10500}

    def gemini_ok(prompt: str) -> dict[str, object]:
        return {
            "daily_targets": {"calories": 2600, "protein_g": 160, "carbs_g": 300, "fat_g": 72},
            "days": [
                {
                    "day": day,
                    "meals": [
                        {"name": "Lunch", "time": "21:00", "items": [food], "calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 4}
                        for _ in range(6)
                    ],
                }
                for day in p.DAYS
            ],
            "safety_notes": [],
        }

    p._call_gemini_json = gemini_ok
    payload, source = p._generate_meal_plan(_meal_request(meals_per_day=6))
    assert source == "gemini"
    assert payload.days[0].meals[2].name == "Lunch"
    assert payload.days[0].meals[2].time == "12:30"
    assert payload.days[0].meals[-1].name == "Evening Snack"
    assert payload.days[0].meals[-1].time == "21:00"


def _assert_diet_and_allergy() -> None:
    request = _meal_request(allergies="trứng, gà, sữa, đậu phộng, cá")
    payload = p._fallback_meal_plan(request)
    assert not p._meal_plan_has_blocked_food(payload, request)

    vegan_payload = p._fallback_meal_plan(_meal_request(diet_preference="vegan"))
    assert not p._meal_plan_has_blocked_food(vegan_payload, _meal_request(diet_preference="vegan"))
    _assert_vietnamese_meal_plan(vegan_payload)


def _assert_legacy_plan_compatibility() -> None:
    legacy_workout = {
        "days": [
            {
                "day": day,
                "type": "training" if day == "Mon" else "rest",
                "title": "Legacy training" if day == "Mon" else "Rest day",
                "estimated_minutes": 45 if day == "Mon" else 0,
                "exercises": [{"name": "Squat", "sets": 3, "reps": "8-10", "rest_sec": 90, "notes": ""}] if day == "Mon" else [],
            }
            for day in p.DAYS
        ],
        "safety_notes": [],
    }
    assert p.WorkoutPlanPayload.model_validate(legacy_workout).days[0].exercises[0].load_recommendation == ""

    legacy_meal = {
        "daily_targets": {"calories": 2200, "protein_g": 140, "carbs_g": 240, "fat_g": 61},
        "days": [
            {
                "day": day,
                "meals": [
                    {
                        "name": "Breakfast",
                        "time": "07:30",
                        "items": [{"name": "Cơm trắng", "quantity": 100, "unit": "g", "calories": 130, "protein_g": 3, "carbs_g": 28, "fat_g": 0}],
                        "calories": 130,
                        "protein_g": 3,
                        "carbs_g": 28,
                        "fat_g": 0,
                    }
                ],
            }
            for day in p.DAYS
        ],
        "safety_notes": [],
    }
    parsed = p.MealPlanPayload.model_validate(legacy_meal)
    assert parsed.nutrition_metrics is None
    assert parsed.days[0].estimated_cost_vnd == 0
    assert parsed.days[0].meals[0].items[0].estimated_cost_vnd == 0
    assert parsed.days[0].meals[0].name_en == "Breakfast"
    assert parsed.days[0].meals[0].name_vi == "Bữa sáng"
    assert parsed.days[0].meals[0].items[0].name_en == "White rice"
    assert parsed.days[0].meals[0].items[0].name_vi == "Cơm trắng"


def main() -> None:
    p.GEMINI_API_KEY = ""
    for days_per_week in (1, 3, 4, 5, 7):
        payload, source = p._generate_workout_plan(_workout_request(days_per_week=days_per_week))
        assert source == "fallback"
        _assert_workout_plan(payload, days_per_week)

    _assert_workout_equipment_defaults()
    _assert_tdee_metrics()
    _assert_v2_prompt_contracts()
    _assert_meal_slots()
    _assert_workout_sync_order()
    _assert_diet_and_allergy()
    _assert_legacy_plan_compatibility()
    _assert_gemini_paths()
    print("weekly planning v2 smoke ok")


if __name__ == "__main__":
    main()
