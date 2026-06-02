import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  freeSubscription,
  mockDashboardApi,
  mockLatestMealPlan,
  seedLoggedInUser,
} from "./helpers";

test.describe("public bilingual pages", () => {
  test("landing page switches between English and Vietnamese", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("PERFECT YOUR FORM.").first()).toBeVisible();
    await expect(page.getByText("PREVENT INJURIES.").first()).toBeVisible();

    await page.getByRole("button", { name: /^vi$/i }).click();

    await expect(page.getByText("HOÀN THIỆN KỸ THUẬT.").first()).toBeVisible();
    await expect(page.getByText("GIẢM RỦI RO CHẤN THƯƠNG.").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("pricing page shows Free, Trial, Paid plans in both languages", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByText("CHOOSE YOUR PLAN").first()).toBeVisible();
    await expect(page.getByText("FREE").first()).toBeVisible();
    await expect(page.getByText("TRIAL").first()).toBeVisible();
    await expect(page.getByText("PAID").first()).toBeVisible();

    await page.getByRole("button", { name: /^vi$/i }).click();

    await expect(page.getByText("CHỌN GÓI PHÙ HỢP").first()).toBeVisible();
    await expect(page.getByText("Bảng giá minh bạch").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("stored Vietnamese language hydrates without text mismatch", async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().includes("Hydration failed")) {
        hydrationErrors.push(message.text());
      }
    });
    await page.addInitScript(() => localStorage.setItem("gf_lang", "vi"));

    await page.goto("/pricing");

    await expect(page.getByText("CHỌN GÓI PHÙ HỢP").first()).toBeVisible();
    expect(hydrationErrors).toEqual([]);
  });
});

test.describe("authenticated entitlement flows", () => {
  test.beforeEach(async ({ page }) => {
    await seedLoggedInUser(page);
  });

  test("free users see disabled premium analysis controls and quota", async ({ page }) => {
    await mockDashboardApi(page, freeSubscription);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: /Analyse Workout Video/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "ViTPose" })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /AI Coaching/i })).toBeDisabled();
    await expect(page.getByText("3/5").first()).toBeVisible();
  });

  test("quota errors from video analysis are shown to the user", async ({ page }) => {
    const exhaustedSubscription = {
      ...freeSubscription,
      usage: { ...freeSubscription.usage, video_analyses: 5 },
      remaining: { ...freeSubscription.remaining, video_analyses: 0 },
    };

    await mockDashboardApi(page, freeSubscription);
    await page.route("**/posture/analyze-video", async (route) => {
      await route.fulfill({
        status: 403,
        json: {
          detail: {
            code: "quota_exceeded",
            message: "Video analyses limit reached.",
            subscription: exhaustedSubscription,
          },
        },
      });
    });

    await page.goto("/dashboard");
    await page.locator('input[type="file"]').setInputFiles({
      name: "squat.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("fake video"),
    });
    await page.getByRole("button", { name: /Analyse Video/i }).click();

    await expect(page.getByText("Video analyses limit reached.")).toBeVisible();
    await expect(page.getByText("0/5").first()).toBeVisible();
  });

  test("profile can start a trial and updates the subscription card", async ({ page }) => {
    await mockDashboardApi(page, freeSubscription);
    await page.goto("/dashboard/profile");

    await expect(page.getByRole("heading", { name: /PROFILE SETTINGS/i })).toBeVisible();
    await page.getByRole("button", { name: /Start 7-Day Trial/i }).click();

    await expect(page.getByText(/TRIAL\s+Plan/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Start 7-Day Trial/i })).toHaveCount(0);
  });

  test("plans page shows plan quotas and validates workout inputs", async ({ page }) => {
    await mockDashboardApi(page, freeSubscription);
    await page.goto("/dashboard/plans");

    await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();
    await expect(page.getByText(/Free.*1 Workout plans.*1 Meal plans/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workout Inputs" })).toBeVisible();

    const ageInput = page.locator('input[type="number"]').first();
    await expect(ageInput).toHaveAttribute("min", "10");
    await ageInput.fill("9");
    await expect
      .poll(async () => ageInput.evaluate((input) => (input as HTMLInputElement).validity.rangeUnderflow))
      .toBe(true);

    await page.getByRole("button", { name: "Meal Plan" }).click();
    await expect(page.getByRole("heading", { name: "Meal Inputs" })).toBeVisible();
  });

  test("statistics page focuses on completed sessions and occurrence counts", async ({ page }) => {
    await mockDashboardApi(page, freeSubscription);
    await page.goto("/dashboard/statistics");

    await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
    await expect(page.getByText("Completed Sessions")).toBeVisible();
    await expect(page.getByText("Exercise Types")).toBeVisible();
    await expect(page.getByText("AI Coached")).toBeVisible();
    await expect(page.getByText("Keep knees aligned.")).toBeVisible();
    await expect(page.getByText("Go deeper.")).toBeVisible();
    await expect(page.getByText("Control the lowering phase.")).toBeVisible();
    await expect(page.getByText("3 reps")).toBeVisible();
    await expect(page.getByText("2 reps")).toBeVisible();
    await expect(page.getByText("1 reps")).toBeVisible();
    await expect(page.getByText("Most Common Analysis Errors")).toHaveCount(0);
    await expect(page.getByText("Avg Quality")).toHaveCount(0);
    await expect(page.getByText("Avg Processing")).toHaveCount(0);
    await expect(page.getByText("frames")).toHaveCount(0);
  });

  test("meal plan names switch between English and Vietnamese", async ({ page }) => {
    await mockDashboardApi(page, freeSubscription);
    await mockLatestMealPlan(page);
    await page.goto("/dashboard/plans");

    await page.getByRole("button", { name: "Meal Plan" }).click();
    await expect(page.getByText("BREAKFAST").first()).toBeVisible();
    await expect(page.getByText("White rice").first()).toBeVisible();

    const menuButton = page.getByRole("button", { name: /toggle navigation/i });
    if (await menuButton.isVisible()) {
      await page.evaluate(() => localStorage.setItem("gf_lang", "vi"));
      await page.reload();
      await page.getByRole("button", { name: "Thực đơn" }).click();
    } else {
      await page.getByRole("button", { name: /^vi$/i }).first().click();
    }

    await expect(page.getByText("BỮA SÁNG").first()).toBeVisible();
    await expect(page.getByText("Cơm trắng").first()).toBeVisible();
  });
});
