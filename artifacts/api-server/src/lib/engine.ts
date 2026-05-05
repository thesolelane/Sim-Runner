import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { readdirSync, existsSync } from "fs";
import { logger } from "./logger";

function discoverNixLibPaths(): string {
  const nixStore = "/nix/store";
  if (!existsSync(nixStore)) return "";
  const packages = ["glib-", "dbus-", "mesa-", "mesa-libgbm", "libdrm-", "at-spi2-core", "nss-", "nspr-"];
  try {
    const entries = readdirSync(nixStore);
    return packages
      .map((pkg) => {
        const match = entries.find((e) => e.includes(pkg) && !e.includes(".drv"));
        if (!match) return null;
        const libPath = `${nixStore}/${match}/lib`;
        return existsSync(libPath) ? libPath : null;
      })
      .filter((p): p is string => p !== null)
      .join(":");
  } catch {
    return "";
  }
}

export const NIX_LIB_PATHS = discoverNixLibPaths();

export interface EngineStep {
  order: number;
  name: string;
  description: string;
  fields: string[];
  stepType: string;
  selector?: string;
  actionType?: string;
  confidence?: string;
}

export interface StepExecutionResult {
  stepOrder: number;
  stepName: string;
  status: "passed" | "failed";
  durationMs: number;
  generatedData: Record<string, unknown>;
  errorMessage: string | null;
  screenshot: string | null;
  selectorUsed: string | null;
  actionTaken: string | null;
}

export interface RunOptions {
  headedMode?: boolean;
  timeoutMs?: number;
}

export interface RunResult {
  stepResults: StepExecutionResult[];
  videoPath: string | null;
}

function generateTestValue(field: string): string {
  const f = field.toLowerCase();
  if (f.includes("email")) return `testuser_${Date.now()}@example.com`;
  if (f.includes("password")) return "Sim@12345!";
  if (f.includes("first") && f.includes("name")) return "Alex";
  if (f.includes("last") && f.includes("name")) return "Simrunner";
  if (f.includes("name")) return "Alex Simrunner";
  if (f.includes("phone")) return "+15550001234";
  if (f.includes("username")) return `user_${Date.now()}`;
  if (f.includes("zip") || f.includes("postal")) return "10001";
  if (f.includes("city")) return "New York";
  if (f.includes("address")) return "123 Test Street";
  if (f.includes("dob") || f.includes("birth")) return "01/15/1990";
  return `test_${field}`;
}

async function captureScreenshot(page: Page): Promise<string | null> {
  try {
    const buffer = await page.screenshot({ type: "png", fullPage: false });
    return buffer.toString("base64");
  } catch {
    return null;
  }
}

async function executeStep(
  page: Page,
  step: EngineStep,
  stepTimeout: number,
): Promise<Omit<StepExecutionResult, "stepOrder" | "stepName" | "durationMs">> {
  const actionType = step.actionType || deriveActionType(step);
  const selector = step.selector;
  const generatedData: Record<string, unknown> = {};

  for (const field of step.fields) {
    generatedData[field] = generateTestValue(field);
  }

  try {
    switch (actionType) {
      case "navigate": {
        const target = selector ?? null;
        if (target && (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("/"))) {
          await page.goto(target, { waitUntil: "domcontentloaded", timeout: stepTimeout });
        } else {
          await page.waitForLoadState("domcontentloaded", { timeout: stepTimeout });
        }
        return {
          status: "passed",
          generatedData,
          errorMessage: null,
          screenshot: null,
          selectorUsed: target,
          actionTaken: target ? `Navigated to ${target}` : "Waited for page to be ready",
        };
      }

      case "fill": {
        if (!selector) {
          return {
            status: "failed",
            generatedData,
            errorMessage: "No selector provided for fill action",
            screenshot: await captureScreenshot(page),
            selectorUsed: null,
            actionTaken: null,
          };
        }
        for (const field of step.fields) {
          const value = generatedData[field] as string;
          try {
            const fieldLower = field.toLowerCase();
            let fieldSelector = selector;
            if (step.fields.length > 1) {
              if (fieldLower.includes("password") && fieldLower.includes("confirm")) {
                fieldSelector = `input[type="password"]:nth-of-type(2), input[name*="confirm"], input[id*="confirm"]`;
              } else if (fieldLower.includes("password")) {
                fieldSelector = `input[type="password"]:first-of-type, input[name="password"], input[id="password"]`;
              } else if (fieldLower.includes("email")) {
                fieldSelector = `input[type="email"], input[name="email"], input[id="email"]`;
              }
            }
            await page.fill(fieldSelector, value, { timeout: stepTimeout });
          } catch {
            const fallbacks = [
              `input[placeholder*="${field}" i]`,
              `input[name*="${field.toLowerCase().replace(/\s/g, "")}"]`,
              `input[id*="${field.toLowerCase().replace(/\s/g, "")}"]`,
            ];
            let filled = false;
            for (const fb of fallbacks) {
              try {
                await page.fill(fb, value, { timeout: 3000 });
                filled = true;
                break;
              } catch { /* continue */ }
            }
            if (!filled) {
              throw new Error(`Could not find input for field: ${field}`);
            }
          }
        }
        const submitSelector = `button[type="submit"], input[type="submit"], button:has-text("Sign up"), button:has-text("Register"), button:has-text("Create"), button:has-text("Continue"), button:has-text("Next")`;
        try {
          const submitBtn = page.locator(submitSelector).first();
          if (await submitBtn.isVisible({ timeout: 2000 })) {
            await submitBtn.click({ timeout: stepTimeout });
            await page.waitForLoadState("domcontentloaded", { timeout: stepTimeout });
          }
        } catch { /* no submit button found, that's ok */ }
        return {
          status: "passed",
          generatedData,
          errorMessage: null,
          screenshot: null,
          selectorUsed: selector,
          actionTaken: `Filled form fields: ${step.fields.join(", ")}`,
        };
      }

      case "click": {
        if (!selector) {
          return {
            status: "failed",
            generatedData,
            errorMessage: "No selector provided for click action",
            screenshot: await captureScreenshot(page),
            selectorUsed: null,
            actionTaken: null,
          };
        }
        await page.click(selector, { timeout: stepTimeout });
        await page.waitForLoadState("domcontentloaded", { timeout: stepTimeout }).catch(() => {});
        return {
          status: "passed",
          generatedData,
          errorMessage: null,
          screenshot: null,
          selectorUsed: selector,
          actionTaken: `Clicked element: ${selector}`,
        };
      }

      case "waitForText": {
        const text = step.name;
        const textSelectors = [
          `text=${text}`,
          `h1:has-text("${text}")`,
          `h2:has-text("${text}")`,
          `.has-text("${text}")`,
        ];
        let found = false;
        for (const ts of textSelectors) {
          try {
            await page.waitForSelector(ts, { timeout: Math.min(stepTimeout, 5000) });
            found = true;
            break;
          } catch { /* try next */ }
        }
        const screenshot = found ? null : await captureScreenshot(page);
        return {
          status: found ? "passed" : "failed",
          generatedData,
          errorMessage: found ? null : `Text not found on page: "${step.name}"`,
          screenshot,
          selectorUsed: null,
          actionTaken: found ? `Found content: ${step.name}` : null,
        };
      }

      case "selectOption": {
        if (selector) {
          const values = step.fields.map((f) => generateTestValue(f));
          try {
            await page.selectOption(selector, values[0] ?? "1", { timeout: stepTimeout });
          } catch {
            await page.click(selector, { timeout: stepTimeout });
          }
        }
        return {
          status: "passed",
          generatedData,
          errorMessage: null,
          screenshot: null,
          selectorUsed: selector ?? null,
          actionTaken: `Selected option in: ${selector}`,
        };
      }

      case "consent": {
        const checkboxes = await page.locator(`input[type="checkbox"]`).all();
        for (const cb of checkboxes) {
          try {
            if (!(await cb.isChecked())) {
              await cb.check({ timeout: 3000 });
            }
          } catch { /* skip */ }
        }
        return {
          status: "passed",
          generatedData,
          errorMessage: null,
          screenshot: null,
          selectorUsed: `input[type="checkbox"]`,
          actionTaken: `Checked consent checkboxes`,
        };
      }

      case "confirmation": {
        await page.waitForLoadState("domcontentloaded", { timeout: stepTimeout });
        return {
          status: "passed",
          generatedData,
          errorMessage: null,
          screenshot: null,
          selectorUsed: null,
          actionTaken: `Confirmed completion of flow`,
        };
      }

      default: {
        await page.waitForLoadState("domcontentloaded", { timeout: stepTimeout });
        return {
          status: "passed",
          generatedData,
          errorMessage: null,
          screenshot: null,
          selectorUsed: null,
          actionTaken: `Executed step: ${step.name}`,
        };
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const screenshot = await captureScreenshot(page);
    return {
      status: "failed",
      generatedData,
      errorMessage: `${actionType} action failed: ${errorMessage.slice(0, 300)}`,
      screenshot,
      selectorUsed: selector ?? null,
      actionTaken: null,
    };
  }
}

function deriveActionType(step: EngineStep): string {
  const st = step.stepType;
  if (st === "form") return "fill";
  if (st === "verification") return "fill";
  if (st === "selection") return "selectOption";
  if (st === "consent") return "consent";
  if (st === "confirmation") return "confirmation";
  if (step.fields.length > 0) return "fill";
  return "waitForText";
}

export async function runSimulation(
  targetUrl: string,
  steps: EngineStep[],
  options: RunOptions = {},
): Promise<RunResult> {
  const { headedMode = false, timeoutMs = 15000 } = options;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  const launchArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
  ];

  const ldLibraryPath = [process.env.LD_LIBRARY_PATH, NIX_LIB_PATHS].filter(Boolean).join(":");

  try {
    browser = await chromium.launch({
      headless: !headedMode,
      args: launchArgs,
      env: { ...process.env, LD_LIBRARY_PATH: ldLibraryPath },
    });

    const contextOptions: Parameters<Browser["newContext"]>[0] = {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    };

    let videoDir: string | undefined;
    if (headedMode) {
      videoDir = `/tmp/sim-videos-${Date.now()}`;
      contextOptions.recordVideo = { dir: videoDir, size: { width: 1280, height: 800 } };
    }

    context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    const results: StepExecutionResult[] = [];
    let previousStepFailed = false;

    for (const step of steps) {
      if (previousStepFailed && step.stepType !== "confirmation") {
        results.push({
          stepOrder: step.order,
          stepName: step.name,
          status: "failed",
          durationMs: 0,
          generatedData: {},
          errorMessage: "Skipped due to previous step failure",
          screenshot: null,
          selectorUsed: null,
          actionTaken: null,
        });
        continue;
      }

      const stepStart = Date.now();
      const result = await executeStep(page, step, timeoutMs);
      const durationMs = Date.now() - stepStart;

      results.push({
        stepOrder: step.order,
        stepName: step.name,
        durationMs,
        ...result,
      });

      if (result.status === "failed") {
        previousStepFailed = true;
        logger.warn({ stepName: step.name, error: result.errorMessage }, "Simulation step failed");
      }
    }

    await context.close();
    context = null;
    await browser.close();
    browser = null;

    let videoPath: string | null = null;
    if (videoDir) {
      try {
        const files = readdirSync(videoDir).filter((f) => f.endsWith(".webm"));
        if (files.length > 0) {
          videoPath = `${videoDir}/${files[0]}`;
        }
      } catch { /* video dir may not exist if no pages were recorded */ }
    }

    return { stepResults: results, videoPath };
  } catch (err) {
    logger.error({ err, targetUrl }, "Playwright engine error");
    return {
      stepResults: steps.map((step) => ({
        stepOrder: step.order,
        stepName: step.name,
        status: "failed" as const,
        durationMs: 0,
        generatedData: {},
        errorMessage: `Engine error: ${err instanceof Error ? err.message : String(err)}`,
        screenshot: null,
        selectorUsed: null,
        actionTaken: null,
      })),
      videoPath: null,
    };
  } finally {
    try { await context?.close(); } catch { /* ignore */ }
    try { await browser?.close(); } catch { /* ignore */ }
  }
}
