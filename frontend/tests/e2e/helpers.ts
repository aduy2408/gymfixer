import { expect, Page } from "@playwright/test";

export const freeSubscription = {
  tier: "free",
  stored_tier: "free",
  trial_started_at: null,
  trial_ends_at: null,
  trial_expired: false,
  window: "month",
  window_started_at: "2026-06-01T00:00:00Z",
  resets_at: "2026-07-01T00:00:00Z",
  limits: {
    video_analyses: 5,
    ai_coaching: 0,
    workout_plans: 1,
    meal_plans: 1,
    history_items: 5,
  },
  usage: {
    video_analyses: 2,
    ai_coaching: 0,
    workout_plans: 0,
    meal_plans: 0,
  },
  remaining: {
    video_analyses: 3,
    ai_coaching: 0,
    workout_plans: 1,
    meal_plans: 1,
  },
  features: {
    vitpose: false,
    ai_coaching: false,
    full_history: false,
  },
};

export const trialSubscription = {
  ...freeSubscription,
  tier: "trial",
  stored_tier: "trial",
  trial_started_at: "2026-06-01T00:00:00Z",
  trial_ends_at: "2026-06-08T00:00:00Z",
  window: "trial",
  limits: {
    video_analyses: 20,
    ai_coaching: 5,
    workout_plans: 5,
    meal_plans: 5,
    history_items: null,
  },
  remaining: {
    video_analyses: 18,
    ai_coaching: 5,
    workout_plans: 5,
    meal_plans: 5,
  },
  features: {
    vitpose: true,
    ai_coaching: true,
    full_history: true,
  },
};

export const paidSubscription = {
  ...freeSubscription,
  tier: "paid",
  stored_tier: "paid",
  premium_expires_at: "2026-07-20T00:00:00Z",
  limits: {
    video_analyses: 100,
    ai_coaching: 50,
    workout_plans: 30,
    meal_plans: 30,
    history_items: null,
  },
  remaining: {
    video_analyses: 98,
    ai_coaching: 50,
    workout_plans: 30,
    meal_plans: 30,
  },
  features: {
    vitpose: true,
    ai_coaching: true,
    full_history: true,
  },
  billing: {
    status: "active",
    amount_vnd: 59000,
    interval: "monthly",
    current_period_start: "2026-06-20T00:00:00Z",
    current_period_end: "2026-07-20T00:00:00Z",
    next_billing_at: "2026-07-20T00:00:00Z",
    cancel_at_period_end: false,
    payment_method: {
      id: 1,
      provider: "vnpay",
      masked_card: "9704xxxx1234",
      bank_code: "NCB",
      card_type: "ATM",
      status: "active",
    },
  },
};

export async function seedLoggedInUser(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("gf_token", "test-token");
    localStorage.setItem(
      "gf_user",
      JSON.stringify({
        id: 1,
        name: "Test User",
        email: "test@example.com",
        subscription_tier: "free",
        role: "user",
      })
    );
  });
}

export async function mockDashboardApi(page: Page, subscription = freeSubscription, role: "user" | "admin" = "user") {
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      json: {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        is_verified: true,
        auth_provider: "local",
        subscription_tier: subscription.tier,
        role,
        trial_started_at: subscription.trial_started_at,
        trial_ends_at: subscription.trial_ends_at,
        created_at: "2026-06-01T00:00:00Z",
        last_login_at: null,
      },
    });
  });
  await page.route("**/auth/profile", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          id: 1,
          name: "Test User",
          email: "test@example.com",
          subscription_tier: subscription.tier,
          role,
          trial_started_at: subscription.trial_started_at,
          trial_ends_at: subscription.trial_ends_at,
          height_cm: 175,
          weight_kg: 72,
          age: 28,
          gender: "male",
          goal: "muscle",
          discovery_source: "facebook",
          created_at: "2026-06-01T00:00:00Z",
          updated_at: "2026-06-01T00:00:00Z",
        },
      });
      return;
    }
    await route.fulfill({ json: {} });
  });
  await page.route("**/auth/subscription", async (route) => {
    await route.fulfill({ json: subscription });
  });
  await page.route("**/feedback", async (route) => {
    await route.fulfill({
      json: {
        id: 1,
        rating: 5,
        message: "Helpful",
        source: "sidebar",
        created_at: "2026-06-09T00:00:00Z",
      },
    });
  });
  await page.route("**/usage-events", async (route) => {
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/admin/analytics**", async (route) => {
    await route.fulfill({
      json: {
        range: "30d",
        user_counts: { total: 3, new: 2, admins: 1, regular: 2 },
        top_metrics: { video_analyses: 5, plan_generations: 2 },
        discovery_sources: [
          { source: "facebook", count: 2, percentage: 66.7 },
          { source: "tiktok", count: 1, percentage: 33.3 },
        ],
        feature_usage: [
          { feature: "Video Analysis", count: 5, percentage: 71.4 },
          { feature: "Workout Plans", count: 2, percentage: 28.6 },
        ],
        feedback_sources: [
          { source: "sidebar", count: 1, percentage: 100 },
        ],
        rating_distribution: [
          { rating: 5, count: 1, percentage: 100 },
        ],
        usage_events: [
          { event_name: "analysis_completed", count: 5, percentage: 71.4 },
          { event_name: "weekly_workout_plan_created", count: 2, percentage: 28.6 },
        ],
        feedback_summary: { count: 1, average_rating: 5 },
        recent_events: [
          {
            id: 1,
            event_name: "analysis_completed",
            user_id: 1,
            user_name: "Test User",
            properties: { feature: "video_analysis" },
            created_at: "2026-06-09T00:00:00Z",
          },
        ],
      },
    });
  });
  await page.route("**/admin/feedback", async (route) => {
    await route.fulfill({
      json: [
        {
          id: 1,
          user_id: 1,
          user_name: "Test User",
          rating: 5,
          message: "Helpful",
          source: "sidebar",
          created_at: "2026-06-09T00:00:00Z",
        },
      ],
    });
  });
  await page.route("**/auth/trial/start", async (route) => {
    await route.fulfill({ json: trialSubscription });
  });
  await page.route("**/analytics/summary", async (route) => {
    await route.fulfill({
      json: {
        total_sessions: 2,
        completed_sessions: 2,
        total_reps: 24,
        sessions_by_exercise: { squat: 1, bicep_curl: 1 },
        reps_by_exercise: { squat: 12, bicep_curl: 12 },
        avg_quality_ratio: 0.82,
        avg_processing_ms: 1500,
        top_feedback: { "Keep knees aligned.": 9 },
        top_rep_issues: { "Keep knees aligned.": 3, "Go deeper.": 2 },
        rep_issues_by_exercise: {
          squat: { "Keep knees aligned.": 3, "Go deeper.": 2 },
          bicep_curl: { "Control the lowering phase.": 1 },
        },
        top_failures: { "Keep knees aligned.": 3, "Go deeper.": 2 },
        llm_enabled_count: 0,
        recent_sessions: [],
      },
    });
  });
  await page.route("**/plans/workout/latest", async (route) => {
    await route.fulfill({ status: 404, json: { detail: "No workout plan found." } });
  });
  await page.route("**/plans/meals/latest", async (route) => {
    await route.fulfill({ status: 404, json: { detail: "No meal plan found." } });
  });
}

export async function mockLatestMealPlan(page: Page) {
  await page.unroute("**/plans/meals/latest").catch(() => {});
  await page.route("**/plans/meals/latest", async (route) => {
    await route.fulfill({
      json: {
        id: 7,
        generation_source: "fallback",
        daily_targets: { calories: 2200, protein_g: 140, carbs_g: 240, fat_g: 61 },
        nutrition_metrics: {
          bmr: 1600,
          tdee: 2300,
          activity_level: "moderate",
          activity_factor: 1.55,
          goal_adjustment_calories: 250,
          target_calories: 2550,
          budget_vnd_per_day: 120000,
          cooking_time_hours_per_day: 1,
        },
        workout_sync: { enabled: false, source_workout_plan_id: null, applied: false, note: "", schedule: null },
        days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
          day,
          estimated_cost_vnd: 15000,
          meals: [
            {
              name: "Breakfast",
              name_en: "Breakfast",
              name_vi: "Bữa sáng",
              time: "07:30",
              items: [
                {
                  name: "Cơm trắng",
                  name_en: "White rice",
                  name_vi: "Cơm trắng",
                  quantity: 100,
                  unit: "g",
                  calories: 130,
                  protein_g: 3,
                  carbs_g: 28,
                  fat_g: 0,
                  estimated_cost_vnd: 1300,
                },
              ],
              calories: 130,
              protein_g: 3,
              carbs_g: 28,
              fat_g: 0,
              estimated_cost_vnd: 1300,
            },
          ],
        })),
        safety_notes: [],
      },
    });
  });
}

export async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(hasOverflow).toBe(false);
}
