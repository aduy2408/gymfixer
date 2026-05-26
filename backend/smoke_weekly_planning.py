from __future__ import annotations

import sys
import types


def _install_import_stubs() -> None:
    db_mod = types.ModuleType("authentication.database")
    db_mod.get_db = lambda: None

    models_mod = types.ModuleType("authentication.models")
    models_mod.User = type("User", (), {})
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
        days_per_week=days_per_week,
        session_minutes=60,
        equipment=["dumbbells", "barbell", "bench"],
        focus_muscles=["chest", "back", "legs"],
    )


def _meal_request(**overrides: object) -> p.MealPlanRequest:
    data: dict[str, object] = {
        "age": 30,
        "height_cm": 175,
        "weight_kg": 80,
        "gender": "male",
        "goal": "muscle",
        "meals_per_day": 4,
        "diet_preference": "none",
        "allergies": "",
        "disliked_foods": "",
        "budget": "medium",
        "cooking_time": "normal",
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


def _assert_meal_totals(payload: p.MealPlanPayload, meals_per_day: int) -> None:
    assert [day.day for day in payload.days] == p.DAYS
    for day in payload.days:
        assert len(day.meals) == meals_per_day
        for meal in day.meals:
            totals = p._sum_ingredients(meal.items)
            assert meal.calories == totals["calories"]
            assert meal.protein_g == totals["protein_g"]
            assert meal.carbs_g == totals["carbs_g"]
            assert meal.fat_g == totals["fat_g"]
            assert all(item.quantity > 0 and item.calories > 0 for item in meal.items)


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

    food = {"name": "Chicken breast", "quantity": 100, "unit": "g", "calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 4}

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
    request = _meal_request(allergies="egg, chicken, dairy, nuts, fish")
    payload = p._fallback_meal_plan(request)
    assert not p._meal_plan_has_blocked_food(payload, request)

    vegan_payload = p._fallback_meal_plan(_meal_request(diet_preference="vegan"))
    assert not p._meal_plan_has_blocked_food(vegan_payload, _meal_request(diet_preference="vegan"))


def main() -> None:
    p.GEMINI_API_KEY = ""
    for days_per_week in (1, 3, 4, 5, 7):
        payload, source = p._generate_workout_plan(_workout_request(days_per_week=days_per_week))
        assert source == "fallback"
        _assert_workout_plan(payload, days_per_week)

    _assert_meal_slots()
    _assert_workout_sync_order()
    _assert_diet_and_allergy()
    _assert_gemini_paths()
    print("weekly planning smoke ok")


if __name__ == "__main__":
    main()
