import fs from "fs";
import { Readable } from "stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { Router, type IRouter } from "express";
import { eq, desc, avg, count, sql } from "drizzle-orm";
import { db, simulationsTable, simulationRunsTable } from "@workspace/db";
import { chromium } from "playwright";
import {
  ScanUrlBody,
  CreateSimulationBody,
  UpdateSimulationBody,
  GetSimulationParams,
  UpdateSimulationParams,
  DeleteSimulationParams,
  CreateRunBody,
  TestAlertBody,
} from "@workspace/api-zod";
import { CronExpressionParser } from "cron-parser";
import { runSimulation, NIX_LIB_PATHS } from "../lib/engine";
import { registerSchedule, unregisterSchedule } from "../lib/scheduling";
import { checkAndSendAlert, sendTestAlert } from "../lib/alerting";
import { ObjectStorageService } from "../lib/objectStorage";
import { scanQuantumSecurity } from "../lib/quantum-scanner";
import { logger } from "../lib/logger";
import { randomUUID } from "crypto";

const objectStorageService = new ObjectStorageService();

/**
 * Upload a local video file to object storage (best effort).
 * Returns the GCS object path (/objects/sim-videos/uuid.webm) or the original local path on failure.
 */
async function uploadVideoToStorage(localPath: string): Promise<string> {
  try {
    return await objectStorageService.uploadVideoFile(localPath);
  } catch (err) {
    logger.warn({ err, localPath }, "Failed to upload video to object storage; keeping local path");
    return localPath;
  }
}

function computeNextRunAt(schedule: string | null): string | null {
  if (!schedule) return null;
  try {
    return CronExpressionParser.parse(schedule).next().toDate().toISOString();
  } catch {
    return null;
  }
}

const router: IRouter = Router();

const PLAYWRIGHT_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-blink-features=AutomationControlled",
];

const PLAYWRIGHT_ENV = {
  ...process.env,
  LD_LIBRARY_PATH: [process.env.LD_LIBRARY_PATH, NIX_LIB_PATHS].filter(Boolean).join(":"),
};

type ConfidenceLevel = "high" | "medium" | "low";

interface ExtractedElement {
  tag: string;
  type?: string;
  name?: string;
  id?: string;
  placeholder?: string;
  text?: string;
  href?: string;
  role?: string;
  ariaLabel?: string;
  cssSelector: string;
}

interface DetectedStepInternal {
  order: number;
  name: string;
  description: string;
  fields: string[];
  stepType: string;
  confidence: ConfidenceLevel;
  selector: string;
  candidateSelectors: string[];
  actionType: string;
}

const PRIVATE_HOST_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|0\.0\.0\.0|::1|fd[0-9a-f]{2}:)$/i;

function validateScanUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "Invalid URL format";
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return "Only http and https URLs are allowed";
  }
  if (PRIVATE_HOST_RE.test(parsed.hostname)) {
    return "Internal network addresses are not allowed";
  }
  return null;
}

function scoreConfidence(matchCount: number, total: number): ConfidenceLevel {
  const ratio = total > 0 ? matchCount / total : 0;
  if (ratio >= 0.6) return "high";
  if (ratio >= 0.3) return "medium";
  return "low";
}

function buildSelector(el: ExtractedElement): string {
  if (el.id) return `#${el.id}`;
  if (el.name) return `${el.tag}[name="${el.name}"]`;
  if (el.placeholder) return `${el.tag}[placeholder="${el.placeholder}"]`;
  if (el.type && el.tag === "input") return `input[type="${el.type}"]`;
  if (el.text && (el.tag === "button" || el.tag === "a")) return `${el.tag}:has-text("${el.text}")`;
  return el.cssSelector;
}

function serializeSimulation(s: typeof simulationsTable.$inferSelect, recentPassRate: number | null = null) {
  return {
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
    lastAlertedAt: s.lastAlertedAt ? s.lastAlertedAt.toISOString() : null,
    lastTestAlertAt: s.lastTestAlertAt ? s.lastTestAlertAt.toISOString() : null,
    nextRunAt: computeNextRunAt(s.schedule),
    recentPassRate,
  };
}

function serializeSimulationSummary(s: typeof simulationsTable.$inferSelect, recentPassRate: number | null = null) {
  const { webhookToken: _omit, ...rest } = serializeSimulation(s, recentPassRate);
  return rest;
}

async function computeRecentPassRates(simIds: number[]): Promise<Map<number, number | null>> {
  if (simIds.length === 0) return new Map();
  const rows = await db.execute(sql<{ simulation_id: number; pass_rate: number | null }>`
    SELECT simulation_id, SUM(passed_steps)::float / NULLIF(SUM(total_steps), 0) AS pass_rate
    FROM (
      SELECT simulation_id, passed_steps, total_steps,
        ROW_NUMBER() OVER (PARTITION BY simulation_id ORDER BY started_at DESC) AS rn
      FROM simulation_runs
      WHERE simulation_id = ANY(ARRAY[${sql.raw(simIds.join(","))}])
        AND status IN ('passed', 'failed', 'partial')
    ) ranked
    WHERE rn <= 5
    GROUP BY simulation_id
  `);
  const map = new Map<number, number | null>();
  for (const row of rows.rows as Array<{ simulation_id: number; pass_rate: string | null }>) {
    map.set(Number(row.simulation_id), row.pass_rate !== null ? parseFloat(row.pass_rate) : null);
  }
  return map;
}

async function detectStepsFromUrl(url: string, appName: string) {
  let browser = null;
  let context = null;

  try {
    browser = await chromium.launch({ headless: true, args: PLAYWRIGHT_ARGS, env: PLAYWRIGHT_ENV });
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

    const pageText = await page.evaluate(
      () => ((document as unknown as { body: { innerText: string } }).body.innerText ?? "").toLowerCase(),
    );

    type AxNode = { role?: string; name?: string; children?: AxNode[] };
    type AxPage = typeof page & { accessibility: { snapshot(): Promise<AxNode | null> } };
    const axPage = page as AxPage;

    const axNodes: Array<{ role: string; name: string }> = [];
    const snapshot = await axPage.accessibility.snapshot().catch(() => null);
    if (snapshot) {
      const walkSnapshot = (node: AxNode): void => {
        if (!node) return;
        if (node.role && node.role !== "generic" && node.role !== "none") {
          axNodes.push({ role: node.role, name: (node.name ?? "").toLowerCase() });
        }
        if (Array.isArray(node.children)) node.children.forEach(walkSnapshot);
      };
      walkSnapshot(snapshot);
    }

    const [axEmailCount, axPasswordCount, axSignupBtnCount, axPhoneCount,
           axOtpCount, axCheckboxCount, axRadioCount, axPlanBtnCount] = await Promise.all([
      page.getByRole("textbox", { name: /email|e-mail/i }).count(),
      page.locator('input[type="password"]').count(),
      page.getByRole("button", { name: /sign.?up|register|create.?account|get.?started/i }).count(),
      page.getByRole("textbox", { name: /phone|mobile/i }).count(),
      page.getByRole("textbox", { name: /code|otp|verif/i }).count(),
      page.getByRole("checkbox").count(),
      page.getByRole("radio").count(),
      page.getByRole("button", { name: /\bplan\b|\bpro\b|\bfree\b|\bbasic\b/i }).count(),
    ]);

    const axHasEmail = axEmailCount > 0 ||
      axNodes.some((n) => n.role === "textbox" && (n.name.includes("email") || n.name.includes("e-mail")));
    const axHasPassword = axPasswordCount > 0 ||
      axNodes.some((n) => n.name.includes("password"));
    const axHasSignupBtn = axSignupBtnCount > 0 ||
      axNodes.some((n) => n.role === "button" &&
        (n.name.includes("sign up") || n.name.includes("register") ||
         n.name.includes("create account") || n.name.includes("get started")));
    const axHasPhone = axPhoneCount > 0 ||
      axNodes.some((n) => n.role === "textbox" && (n.name.includes("phone") || n.name.includes("mobile")));
    const axHasOtp = axOtpCount > 0 ||
      axNodes.some((n) => n.role === "textbox" && (n.name.includes("code") || n.name.includes("otp") || n.name.includes("verif")));
    const axHasCheckbox = axCheckboxCount > 0 ||
      axNodes.some((n) => n.role === "checkbox");
    const axHasPlanBtn = axRadioCount > 0 || axPlanBtnCount > 0 ||
      axNodes.some((n) => n.role === "radio" ||
        (n.role === "button" && (n.name.includes("plan") || n.name.includes("pro") || n.name.includes("free"))));

    const elements: ExtractedElement[] = await page.evaluate((): ExtractedElement[] => {
      const results: ExtractedElement[] = [];
      const seen = new Set<string>();

      const getCssSelector = (el: Element): string => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.id) return `#${htmlEl.id}`;
        const tag = el.tagName.toLowerCase();
        const parent = el.parentElement;
        if (!parent) return tag;
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === el.tagName,
        );
        const idx = siblings.indexOf(el);
        return `${tag}${idx > 0 ? `:nth-of-type(${idx + 1})` : ""}`;
      };

      const addEl = (el: Element) => {
        const htmlEl = el as HTMLElement & { type?: string; name?: string; placeholder?: string; href?: string };
        const cssSelector = getCssSelector(el);
        const key = `${el.tagName}:${cssSelector}`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push({
          tag: el.tagName.toLowerCase(),
          type: htmlEl.type || undefined,
          name: htmlEl.name || undefined,
          id: htmlEl.id || undefined,
          placeholder: htmlEl.placeholder || undefined,
          text: htmlEl.innerText?.trim().slice(0, 80) || undefined,
          href: htmlEl.href || undefined,
          role: el.getAttribute("role") || undefined,
          ariaLabel: el.getAttribute("aria-label") || undefined,
          cssSelector,
        });
      };

      document.querySelectorAll("input").forEach(addEl);
      document.querySelectorAll("button").forEach(addEl);
      document.querySelectorAll("select").forEach(addEl);
      document.querySelectorAll("textarea").forEach(addEl);
      document.querySelectorAll("a[href]").forEach(addEl);
      document.querySelectorAll("[role='button']").forEach(addEl);
      document.querySelectorAll("[role='checkbox']").forEach(addEl);

      return results;
    });

    const inputs = elements.filter((e) => e.tag === "input" && e.type !== "hidden");
    const buttons = elements.filter((e) => e.tag === "button" || e.role === "button");
    const selects = elements.filter((e) => e.tag === "select");
    const checkboxes = elements.filter((e) => e.type === "checkbox");
    const passwordInputs = inputs.filter((e) => e.type === "password");
    const emailInputs = inputs.filter(
      (e) =>
        e.type === "email" ||
        e.name?.toLowerCase().includes("email") ||
        e.id?.toLowerCase().includes("email") ||
        e.placeholder?.toLowerCase().includes("email"),
    );
    const textInputs = inputs.filter((e) => !e.type || e.type === "text");

    const detected: DetectedStepInternal[] = [];
    let order = 1;

    const hasSignupKeywords = ["sign up", "register", "create account", "get started", "join"].some(
      (kw) => pageText.includes(kw),
    );
    const hasLoginKeywords = ["log in", "sign in", "login", "signin"].some((kw) =>
      pageText.includes(kw),
    );

    if (emailInputs.length > 0 || passwordInputs.length > 0 || axHasEmail || axHasPassword) {
      const fields: string[] = [];
      const candidateSelectors: string[] = [];
      if (emailInputs.length > 0) {
        fields.push("Email");
        candidateSelectors.push(buildSelector(emailInputs[0]));
      } else if (axHasEmail) {
        fields.push("Email");
        candidateSelectors.push(`input[type="email"]`);
      }
      if (passwordInputs.length > 0) {
        fields.push("Password");
        candidateSelectors.push(buildSelector(passwordInputs[0]));
        if (passwordInputs.length > 1) {
          fields.push("Confirm Password");
          candidateSelectors.push(buildSelector(passwordInputs[1]));
        }
      } else if (axHasPassword) {
        fields.push("Password");
        candidateSelectors.push(`input[type="password"]`);
      }

      const isSignup = hasSignupKeywords && !hasLoginKeywords;
      const primarySelector =
        emailInputs.length > 0
          ? buildSelector(emailInputs[0])
          : passwordInputs.length > 0
            ? buildSelector(passwordInputs[0])
            : `input[type="email"]`;

      const axBonus = (axHasEmail ? 1 : 0) + (axHasPassword ? 1 : 0) + (axHasSignupBtn ? 1 : 0);
      detected.push({
        order: order++,
        name: isSignup ? "Account Creation" : "Sign In",
        description: isSignup
          ? "User provides credentials to create a new account"
          : "User signs in with their credentials",
        fields,
        stepType: "form",
        confidence: scoreConfidence(
          (emailInputs.length > 0 ? 2 : 0) + (passwordInputs.length > 0 ? 2 : 0) + axBonus,
          7,
        ),
        selector: primarySelector,
        candidateSelectors,
        actionType: "fill",
      });
    }

    const hasPhoneKeywords = ["phone", "mobile", "sms", "text message"].some((kw) =>
      pageText.includes(kw),
    );
    const phoneInputs = inputs.filter(
      (e) =>
        e.type === "tel" ||
        e.name?.toLowerCase().includes("phone") ||
        e.name?.toLowerCase().includes("mobile") ||
        e.placeholder?.toLowerCase().includes("phone"),
    );
    if (phoneInputs.length > 0 || hasPhoneKeywords || axHasPhone) {
      const candidateSelectors = phoneInputs.map((e) => buildSelector(e));
      const axBonus = axHasPhone ? 1 : 0;
      detected.push({
        order: order++,
        name: "Phone Verification",
        description: "User provides and verifies their phone number",
        fields: ["Phone Number", "SMS Code"],
        stepType: "verification",
        confidence: scoreConfidence(
          (phoneInputs.length > 0 ? 2 : 0) + (hasPhoneKeywords ? 1 : 0) + axBonus,
          4,
        ),
        selector: candidateSelectors[0] ?? `input[type="tel"]`,
        candidateSelectors:
          candidateSelectors.length > 0
            ? candidateSelectors
            : [`input[type="tel"]`, `input[name="phone"]`],
        actionType: "fill",
      });
    }

    const hasVerifyKeywords = ["verify email", "confirm email", "verification code", "otp"].some(
      (kw) => pageText.includes(kw),
    );
    const otpInputs = inputs.filter(
      (e) =>
        e.name?.toLowerCase().includes("otp") ||
        e.name?.toLowerCase().includes("code") ||
        e.name?.toLowerCase().includes("verif") ||
        e.placeholder?.toLowerCase().includes("code") ||
        e.placeholder?.toLowerCase().includes("verif") ||
        (e.type === "number" && (e.placeholder?.length ?? 0) <= 10),
    );
    if (hasVerifyKeywords || otpInputs.length > 0 || axHasOtp) {
      const candidateSelectors = otpInputs.map((e) => buildSelector(e));
      const axBonus = axHasOtp ? 1 : 0;
      detected.push({
        order: order++,
        name: "Email Verification",
        description: "User confirms their email address via a verification code",
        fields: ["Verification Code"],
        stepType: "verification",
        confidence: scoreConfidence(
          (hasVerifyKeywords ? 2 : 0) + (otpInputs.length > 0 ? 2 : 0) + axBonus,
          5,
        ),
        selector: candidateSelectors[0] ?? `input[name="code"]`,
        candidateSelectors:
          candidateSelectors.length > 0
            ? candidateSelectors
            : [`input[name="code"]`, `input[placeholder*="code" i]`],
        actionType: "fill",
      });
    }

    const hasProfileKeywords = [
      "profile",
      "about you",
      "personal info",
      "first name",
      "last name",
      "full name",
    ].some((kw) => pageText.includes(kw));
    const nameInputs = inputs.filter(
      (e) =>
        e.name?.toLowerCase().includes("name") ||
        e.id?.toLowerCase().includes("name") ||
        e.placeholder?.toLowerCase().includes("name"),
    );
    if (hasProfileKeywords || (nameInputs.length > 0 && detected.length > 0)) {
      const candidateSelectors = nameInputs.map((e) => buildSelector(e));
      const fields: string[] = [];
      if (nameInputs.some((e) => e.name?.toLowerCase().includes("first"))) {
        fields.push("First Name");
      }
      if (nameInputs.some((e) => e.name?.toLowerCase().includes("last"))) {
        fields.push("Last Name");
      }
      if (fields.length === 0) fields.push("Full Name");

      detected.push({
        order: order++,
        name: "Profile Setup",
        description: "User fills in their profile details",
        fields,
        stepType: "form",
        confidence: scoreConfidence(
          (hasProfileKeywords ? 2 : 0) + (nameInputs.length > 0 ? 2 : 0),
          4,
        ),
        selector: candidateSelectors[0] ?? `input[name="firstName"]`,
        candidateSelectors:
          candidateSelectors.length > 0
            ? candidateSelectors
            : [`input[name="firstName"]`, `input[name="lastName"]`, `input[name="fullName"]`],
        actionType: "fill",
      });
    }

    const hasPlanKeywords = ["plan", "pricing", "subscription", "choose", "select a plan"].some(
      (kw) => pageText.includes(kw),
    );
    if (hasPlanKeywords && (selects.length > 0 || buttons.length > 2 || axHasPlanBtn)) {
      const planSelectors = selects.map((e) => buildSelector(e));
      if (planSelectors.length === 0) {
        const planBtns = buttons.filter(
          (e) =>
            e.text?.toLowerCase().includes("plan") ||
            e.text?.toLowerCase().includes("free") ||
            e.text?.toLowerCase().includes("pro") ||
            e.text?.toLowerCase().includes("basic"),
        );
        planSelectors.push(...planBtns.map((e) => buildSelector(e)));
      }
      const axBonus = axHasPlanBtn ? 1 : 0;
      detected.push({
        order: order++,
        name: "Plan Selection",
        description: "User selects a subscription plan",
        fields: ["Selected Plan"],
        stepType: "selection",
        confidence: scoreConfidence(
          (hasPlanKeywords ? 2 : 0) + (selects.length > 0 ? 1 : 0) + axBonus,
          4,
        ),
        selector: planSelectors[0] ?? `button:has-text("Free")`,
        candidateSelectors:
          planSelectors.length > 0
            ? planSelectors
            : [`button:has-text("Free")`, `button:has-text("Pro")`, `select`],
        actionType: selects.length > 0 ? "selectOption" : "click",
      });
    }

    const hasPaymentKeywords = ["payment", "billing", "credit card", "card number"].some((kw) =>
      pageText.includes(kw),
    );
    const cardInputs = inputs.filter(
      (e) =>
        e.name?.toLowerCase().includes("card") ||
        e.id?.toLowerCase().includes("card") ||
        e.placeholder?.toLowerCase().includes("card"),
    );
    if (hasPaymentKeywords || cardInputs.length > 0) {
      const candidateSelectors = cardInputs.map((e) => buildSelector(e));
      detected.push({
        order: order++,
        name: "Payment Details",
        description: "User enters payment and billing information",
        fields: ["Card Number", "Expiry", "CVV"],
        stepType: "form",
        confidence: scoreConfidence(
          (hasPaymentKeywords ? 2 : 0) + (cardInputs.length > 0 ? 2 : 0),
          4,
        ),
        selector: candidateSelectors[0] ?? `input[name="cardNumber"]`,
        candidateSelectors:
          candidateSelectors.length > 0
            ? candidateSelectors
            : [`input[name="cardNumber"]`, `input[placeholder*="card" i]`],
        actionType: "fill",
      });
    }

    const hasConsentKeywords = ["terms", "privacy policy", "agree", "consent"].some((kw) =>
      pageText.includes(kw),
    );
    if (hasConsentKeywords && (checkboxes.length > 0 || axHasCheckbox)) {
      const candidateSelectors = checkboxes.map((e) => buildSelector(e));
      const axBonus = axHasCheckbox ? 1 : 0;
      detected.push({
        order: order++,
        name: "Permissions & Consent",
        description: "User agrees to terms of service and privacy policy",
        fields: ["Terms Accepted"],
        stepType: "consent",
        confidence: scoreConfidence(
          (hasConsentKeywords ? 2 : 0) + (checkboxes.length > 0 ? 2 : 0) + axBonus,
          5,
        ),
        selector: candidateSelectors[0] ?? `input[type="checkbox"]`,
        candidateSelectors:
          candidateSelectors.length > 0
            ? candidateSelectors
            : [`input[type="checkbox"]`, `[role="checkbox"]`],
        actionType: "consent",
      });
    }

    const hasWorkspaceKeywords = ["workspace", "organization", "company", "configure", "set up"].some(
      (kw) => pageText.includes(kw),
    );
    if (hasWorkspaceKeywords) {
      const workspaceInputs = textInputs.filter(
        (e) =>
          e.name?.toLowerCase().includes("org") ||
          e.name?.toLowerCase().includes("company") ||
          e.name?.toLowerCase().includes("workspace") ||
          e.placeholder?.toLowerCase().includes("company") ||
          e.placeholder?.toLowerCase().includes("workspace"),
      );
      const candidateSelectors = workspaceInputs.map((e) => buildSelector(e));
      detected.push({
        order: order++,
        name: "App Configuration",
        description: "User configures their workspace or organization settings",
        fields: ["Company Name", "Industry"],
        stepType: "form",
        confidence: scoreConfidence((hasWorkspaceKeywords ? 1 : 0) + (workspaceInputs.length > 0 ? 2 : 0), 3),
        selector: candidateSelectors[0] ?? `input[name="company"]`,
        candidateSelectors:
          candidateSelectors.length > 0
            ? candidateSelectors
            : [`input[name="company"]`, `input[placeholder*="company" i]`],
        actionType: "fill",
      });
    }

    const hasWelcomeKeywords = [
      "welcome",
      "all set",
      "you're ready",
      "dashboard",
      "get started",
    ].some((kw) => pageText.includes(kw));
    detected.push({
      order: order++,
      name: "Completion",
      description: "Onboarding complete — user lands on the main app",
      fields: [],
      stepType: "confirmation",
      confidence: hasWelcomeKeywords ? "high" : "medium",
      selector: `h1, h2, .dashboard, main`,
      candidateSelectors: [`h1`, `h2`, `.dashboard`, `main`, `[role="main"]`],
      actionType: "confirmation",
    });

    if (detected.length <= 1) {
      detected.length = 0;
      detected.push(
        {
          order: 1,
          name: "Account Creation",
          description: "User provides credentials to create an account",
          fields: ["Email", "Password"],
          stepType: "form",
          confidence: "medium" as ConfidenceLevel,
          selector: `input[type="email"]`,
          candidateSelectors: [`input[type="email"]`, `input[name="email"]`, `input[placeholder*="email" i]`],
          actionType: "fill",
        },
        {
          order: 2,
          name: "Profile Setup",
          description: "User fills in their profile details",
          fields: ["First Name", "Last Name"],
          stepType: "form",
          confidence: "medium" as ConfidenceLevel,
          selector: `input[name="firstName"]`,
          candidateSelectors: [`input[name="firstName"]`, `input[name="lastName"]`, `input[name="name"]`],
          actionType: "fill",
        },
        {
          order: 3,
          name: "Completion",
          description: "Onboarding complete — user lands on the main app",
          fields: [],
          stepType: "confirmation",
          confidence: "low" as ConfidenceLevel,
          selector: `h1, main`,
          candidateSelectors: [`h1`, `h2`, `main`, `.dashboard`],
          actionType: "confirmation",
        },
      );
    }

    const highCount = detected.filter((s) => s.confidence === "high").length;
    const overallConfidence =
      highCount / detected.length >= 0.5 ? "high" : highCount > 0 ? "medium" : "low";

    logger.info(
      { url, stepsDetected: detected.length, overallConfidence },
      "Playwright scan complete",
    );

    return { appName, url, detectedSteps: detected, confidence: overallConfidence };
  } catch (err) {
    logger.error({ err, url }, "Scanner error, falling back to defaults");
    return {
      appName,
      url,
      detectedSteps: [
        {
          order: 1,
          name: "Account Creation",
          description: "User provides credentials to create an account",
          fields: ["Email", "Password"],
          stepType: "form",
          confidence: "low" as ConfidenceLevel,
          selector: `input[type="email"]`,
          candidateSelectors: [`input[type="email"]`, `input[name="email"]`],
          actionType: "fill",
        },
        {
          order: 2,
          name: "Profile Setup",
          description: "User fills in their profile details",
          fields: ["First Name", "Last Name"],
          stepType: "form",
          confidence: "low" as ConfidenceLevel,
          selector: `input[name="firstName"]`,
          candidateSelectors: [`input[name="firstName"]`, `input[name="lastName"]`],
          actionType: "fill",
        },
        {
          order: 3,
          name: "Completion",
          description: "Onboarding complete — user lands on the main app",
          fields: [],
          stepType: "confirmation",
          confidence: "low" as ConfidenceLevel,
          selector: "h1",
          candidateSelectors: ["h1", "h2", "main"],
          actionType: "confirmation",
        },
      ],
      confidence: "low",
    };
  } finally {
    try { await context?.close(); } catch { /* ignore */ }
    try { await browser?.close(); } catch { /* ignore */ }
  }
}

router.post("/simulations/scan", async (req, res): Promise<void> => {
  const parsed = ScanUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const urlError = validateScanUrl(parsed.data.url);
  if (urlError) {
    res.status(400).json({ error: urlError });
    return;
  }

  const result = await detectStepsFromUrl(parsed.data.url, parsed.data.appName);
  res.json(result);
});

router.get("/simulations/stats", async (req, res): Promise<void> => {
  const totalSims = await db.select({ count: count() }).from(simulationsTable);
  const totalRunsResult = await db.select({ count: count() }).from(simulationRunsTable);
  const passedRunsResult = await db
    .select({ count: count() })
    .from(simulationRunsTable)
    .where(eq(simulationRunsTable.status, "passed"));
  const avgDurationResult = await db
    .select({ avg: avg(simulationRunsTable.durationMs) })
    .from(simulationRunsTable)
    .where(eq(simulationRunsTable.status, "passed"));
  const recentRuns = await db
    .select()
    .from(simulationRunsTable)
    .orderBy(desc(simulationRunsTable.startedAt))
    .limit(5);

  const totalRunsCount = totalRunsResult[0]?.count ?? 0;
  const passedCount = passedRunsResult[0]?.count ?? 0;
  const passRate = Number(totalRunsCount) > 0 ? Number(passedCount) / Number(totalRunsCount) : 0;

  res.json({
    totalSimulations: Number(totalSims[0]?.count ?? 0),
    totalRuns: Number(totalRunsCount),
    passRate,
    avgDurationMs: avgDurationResult[0]?.avg ? Number(avgDurationResult[0].avg) : null,
    recentRuns: recentRuns.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    })),
  });
});

router.post("/simulations/webhook/:token", async (req, res): Promise<void> => {
  const token = req.params.token;

  const [simulation] = await db
    .select()
    .from(simulationsTable)
    .where(eq(simulationsTable.webhookToken, token));

  if (!simulation) {
    res.status(404).json({ error: "Webhook token not found" });
    return;
  }

  if (!simulation.webhookEnabled) {
    res.status(403).json({ error: "Webhook is disabled for this simulation" });
    return;
  }

  const steps = simulation.steps as Array<{
    order: number;
    name: string;
    description: string;
    fields: string[];
    stepType: string;
    selector?: string;
    actionType?: string;
    confidence?: string;
  }>;

  const [run] = await db
    .insert(simulationRunsTable)
    .values({
      simulationId: simulation.id,
      status: "running",
      totalSteps: steps.length,
      passedSteps: 0,
      failedSteps: 0,
      headedMode: false,
    })
    .returning();

  logger.info({ simulationId: simulation.id, runId: run.id }, "Webhook-triggered run queued");

  res.status(202).json({
    runId: run.id,
    simulationId: simulation.id,
    status: "running",
  });

  setImmediate(async () => {
    const runStart = Date.now();
    let stepResults: Array<{
      stepOrder: number;
      stepName: string;
      status: string;
      durationMs: number;
      generatedData: Record<string, unknown>;
      errorMessage: string | null;
      screenshot: string | null;
      selectorUsed: string | null;
      actionTaken: string | null;
    }>;
    let videoPath: string | null = null;

    try {
      const runResult = await runSimulation(simulation.appUrl, steps, {
        headedMode: false,
        timeoutMs: 15000,
      });
      stepResults = runResult.stepResults;
      if (runResult.videoPath) {
        videoPath = await uploadVideoToStorage(runResult.videoPath);
      }
    } catch (err) {
      stepResults = steps.map((step) => ({
        stepOrder: step.order,
        stepName: step.name,
        status: "failed",
        durationMs: 0,
        generatedData: {},
        errorMessage: `Engine error: ${err instanceof Error ? err.message : String(err)}`,
        screenshot: null,
        selectorUsed: null,
        actionTaken: null,
      }));
    }

    const passedSteps = stepResults.filter((s) => s.status === "passed").length;
    const failedSteps = stepResults.filter((s) => s.status === "failed").length;
    const totalDuration = Date.now() - runStart;
    const overallStatus = failedSteps === 0 ? "passed" : passedSteps === 0 ? "failed" : "partial";

    await db
      .update(simulationRunsTable)
      .set({
        status: overallStatus,
        passedSteps,
        failedSteps,
        durationMs: totalDuration,
        videoPath,
        stepResults,
        completedAt: new Date(),
      })
      .where(eq(simulationRunsTable.id, run.id));

    await db
      .update(simulationsTable)
      .set({
        totalRuns: sql`${simulationsTable.totalRuns} + 1`,
        lastRunStatus: overallStatus,
        lastRunAt: new Date(),
      })
      .where(eq(simulationsTable.id, simulation.id));

    const passRate = steps.length > 0 ? passedSteps / steps.length : 0;
    await checkAndSendAlert(simulation.id, simulation.name, passRate);

    logger.info({ simulationId: simulation.id, runId: run.id, overallStatus }, "Webhook-triggered run complete");
  });
});

router.get("/simulations", async (req, res): Promise<void> => {
  const simulations = await db
    .select()
    .from(simulationsTable)
    .orderBy(desc(simulationsTable.createdAt));

  const passRates = await computeRecentPassRates(simulations.map((s) => s.id));
  res.json(simulations.map((s) => serializeSimulationSummary(s, passRates.get(s.id) ?? null)));
});

router.post("/simulations", async (req, res): Promise<void> => {
  const parsed = CreateSimulationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const urlError = validateScanUrl(parsed.data.appUrl);
  if (urlError) {
    res.status(400).json({ error: urlError });
    return;
  }

  const [simulation] = await db
    .insert(simulationsTable)
    .values({
      name: parsed.data.name,
      appName: parsed.data.appName,
      appUrl: parsed.data.appUrl,
      appType: parsed.data.appType,
      steps: parsed.data.steps,
      webhookToken: randomUUID(),
    })
    .returning();

  res.status(201).json(serializeSimulationSummary(simulation));
});

router.get("/simulations/:id", async (req, res): Promise<void> => {
  const params = GetSimulationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let [simulation] = await db
    .select()
    .from(simulationsTable)
    .where(eq(simulationsTable.id, params.data.id));

  if (!simulation) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }

  if (!simulation.webhookToken) {
    const [updated] = await db
      .update(simulationsTable)
      .set({ webhookToken: randomUUID() })
      .where(eq(simulationsTable.id, params.data.id))
      .returning();
    simulation = updated;
  }

  const passRates = await computeRecentPassRates([simulation.id]);
  res.json(serializeSimulation(simulation, passRates.get(simulation.id) ?? null));
});

router.patch("/simulations/:id", async (req, res): Promise<void> => {
  const params = UpdateSimulationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSimulationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.appUrl !== undefined) {
    const urlError = validateScanUrl(parsed.data.appUrl);
    if (urlError) {
      res.status(400).json({ error: urlError });
      return;
    }
  }

  if (parsed.data.alertThreshold !== null && parsed.data.alertThreshold !== undefined) {
    if (parsed.data.alertThreshold < 0 || parsed.data.alertThreshold > 100) {
      res.status(400).json({ error: "alertThreshold must be between 0 and 100" });
      return;
    }
  }

  if (parsed.data.schedule !== null && parsed.data.schedule !== undefined) {
    try {
      CronExpressionParser.parse(parsed.data.schedule);
    } catch {
      res.status(400).json({ error: "Invalid cron expression for schedule" });
      return;
    }
  }

  const updateData: Partial<typeof simulationsTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.appName !== undefined) updateData.appName = parsed.data.appName;
  if (parsed.data.appUrl !== undefined) updateData.appUrl = parsed.data.appUrl;
  if (parsed.data.appType !== undefined) updateData.appType = parsed.data.appType;
  if (parsed.data.steps !== undefined) updateData.steps = parsed.data.steps;

  if (parsed.data.schedule !== undefined) updateData.schedule = parsed.data.schedule;
  if (parsed.data.alertThreshold !== undefined) updateData.alertThreshold = parsed.data.alertThreshold;
  if (parsed.data.alertDestination !== undefined) updateData.alertDestination = parsed.data.alertDestination;
  if (parsed.data.webhookEnabled !== undefined) updateData.webhookEnabled = parsed.data.webhookEnabled;
  if (parsed.data.alertMessage !== undefined) updateData.alertMessage = parsed.data.alertMessage;

  const [existing] = await db
    .select({ webhookToken: simulationsTable.webhookToken })
    .from(simulationsTable)
    .where(eq(simulationsTable.id, params.data.id));
  if (existing && !existing.webhookToken) {
    updateData.webhookToken = randomUUID();
  }

  const [simulation] = await db
    .update(simulationsTable)
    .set(updateData)
    .where(eq(simulationsTable.id, params.data.id))
    .returning();

  if (!simulation) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }

  if (parsed.data.schedule !== undefined) {
    if (simulation.schedule) {
      registerSchedule(simulation.id, simulation.schedule);
    } else {
      unregisterSchedule(simulation.id);
    }
  }

  const patchPassRates = await computeRecentPassRates([simulation.id]);
  res.json(serializeSimulationSummary(simulation, patchPassRates.get(simulation.id) ?? null));
});

router.delete("/simulations/:id", async (req, res): Promise<void> => {
  const params = DeleteSimulationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  unregisterSchedule(params.data.id);

  const [simulation] = await db
    .delete(simulationsTable)
    .where(eq(simulationsTable.id, params.data.id))
    .returning();

  if (!simulation) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/simulations/:id/test-alert", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid simulation ID" });
    return;
  }

  const [simulation] = await db
    .select({ id: simulationsTable.id, name: simulationsTable.name, alertDestination: simulationsTable.alertDestination, alertMessage: simulationsTable.alertMessage })
    .from(simulationsTable)
    .where(eq(simulationsTable.id, id));

  if (!simulation) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }

  const bodyParsed = TestAlertBody.safeParse(req.body ?? {});
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const overrideDestination = bodyParsed.data.destination ?? null;
  const destination = overrideDestination || simulation.alertDestination;

  if (!destination) {
    res.status(400).json({ error: "No alert destination configured. Set a Slack webhook URL or email address in Settings first." });
    return;
  }

  let destinationType: string;
  try {
    ({ destinationType } = await sendTestAlert(destination, simulation.name, simulation.alertMessage));
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    req.log.error({ err, simulationId: id }, "Failed to send test alert");
    const userMessage = errMessage.startsWith("Email could not be sent") || errMessage.startsWith("Slack webhook")
      ? errMessage
      : "Failed to send test alert. Please verify your destination is correct and try again.";
    res.status(500).json({ error: userMessage });
    return;
  }

  try {
    await db
      .update(simulationsTable)
      .set({ lastTestAlertAt: new Date() })
      .where(eq(simulationsTable.id, id));
  } catch (err) {
    req.log.error({ err, simulationId: id }, "Failed to persist lastTestAlertAt after test alert");
  }

  req.log.info({ simulationId: id, destinationType }, "Test alert sent");
  res.json({
    success: true,
    message: `Test alert sent successfully via ${destinationType}`,
    destination,
    destinationType,
  });
});

router.get("/simulations/:id/runs", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid simulation ID" });
    return;
  }

  const runs = await db
    .select()
    .from(simulationRunsTable)
    .where(eq(simulationRunsTable.simulationId, id))
    .orderBy(desc(simulationRunsTable.startedAt));

  res.json(
    runs.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    })),
  );
});

router.post("/simulations/:id/runs", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid simulation ID" });
    return;
  }

  const bodyParsed = CreateRunBody.safeParse(req.body ?? {});
  const headedMode = bodyParsed.success ? (bodyParsed.data.headedMode ?? false) : false;

  const [simulation] = await db
    .select()
    .from(simulationsTable)
    .where(eq(simulationsTable.id, id));

  if (!simulation) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }

  const steps = simulation.steps as Array<{
    order: number;
    name: string;
    description: string;
    fields: string[];
    stepType: string;
    selector?: string;
    actionType?: string;
    confidence?: string;
  }>;

  const runStart = Date.now();

  const runUrlError = validateScanUrl(simulation.appUrl);
  if (runUrlError) {
    res.status(400).json({ error: `Cannot run simulation: ${runUrlError}` });
    return;
  }

  logger.info({ simulationId: id, steps: steps.length, headedMode }, "Starting Playwright run");

  let stepResults: Array<{
    stepOrder: number;
    stepName: string;
    status: string;
    durationMs: number;
    generatedData: Record<string, unknown>;
    errorMessage: string | null;
    screenshot: string | null;
    selectorUsed: string | null;
    actionTaken: string | null;
  }>;
  let videoPath: string | null = null;

  try {
    const runResult = await runSimulation(simulation.appUrl, steps, {
      headedMode,
      timeoutMs: 15000,
    });
    stepResults = runResult.stepResults;
    if (runResult.videoPath) {
      videoPath = await uploadVideoToStorage(runResult.videoPath);
    }
  } catch (err) {
    logger.error({ err, simulationId: id }, "Engine run failed");
    stepResults = steps.map((step) => ({
      stepOrder: step.order,
      stepName: step.name,
      status: "failed",
      durationMs: 0,
      generatedData: {},
      errorMessage: `Engine error: ${err instanceof Error ? err.message : String(err)}`,
      screenshot: null,
      selectorUsed: null,
      actionTaken: null,
    }));
  }

  let quantumScanResult = null;
  try {
    quantumScanResult = await scanQuantumSecurity(simulation.appUrl);
    logger.info(
      { simulationId: id, quantumSafe: quantumScanResult.quantumSafe, findings: quantumScanResult.findings.length },
      "Quantum scan complete",
    );
  } catch (err) {
    logger.warn({ err, simulationId: id }, "Quantum scan failed — run result unaffected");
  }

  const passedSteps = stepResults.filter((s) => s.status === "passed").length;
  const failedSteps = stepResults.filter((s) => s.status === "failed").length;
  const totalDuration = Date.now() - runStart;
  const overallStatus = failedSteps === 0 ? "passed" : passedSteps === 0 ? "failed" : "partial";

  const [run] = await db
    .insert(simulationRunsTable)
    .values({
      simulationId: id,
      status: overallStatus,
      totalSteps: steps.length,
      passedSteps,
      failedSteps,
      durationMs: totalDuration,
      headedMode,
      videoPath,
      stepResults,
      quantumScanResult,
      completedAt: new Date(),
    })
    .returning();

  await db
    .update(simulationsTable)
    .set({
      totalRuns: sql`${simulationsTable.totalRuns} + 1`,
      lastRunStatus: overallStatus,
      lastRunAt: new Date(),
    })
    .where(eq(simulationsTable.id, id));

  const passRate = steps.length > 0 ? passedSteps / steps.length : 0;
  await checkAndSendAlert(id, simulation.name, passRate);

  logger.info(
    { simulationId: id, runId: run.id, overallStatus, passedSteps, failedSteps },
    "Run complete",
  );

  res.status(201).json({
    ...run,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
  });
});

router.get("/simulations/:id/runs/:runId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawRunId = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;
  const id = parseInt(rawId, 10);
  const runId = parseInt(rawRunId, 10);

  if (isNaN(id) || isNaN(runId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [run] = await db
    .select()
    .from(simulationRunsTable)
    .where(eq(simulationRunsTable.id, runId));

  if (!run || run.simulationId !== id) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  const videoUrl = run.videoPath
    ? `/api/simulations/${id}/runs/${runId}/video`
    : null;

  res.json({
    ...run,
    stepResults: run.stepResults ?? [],
    quantumScanResult: run.quantumScanResult ?? null,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    videoUrl,
  });
});

router.get("/simulations/:id/runs/:runId/video", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawRunId = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;
  const id = parseInt(rawId, 10);
  const runId = parseInt(rawRunId, 10);

  if (isNaN(id) || isNaN(runId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [run] = await db
    .select({ id: simulationRunsTable.id, simulationId: simulationRunsTable.simulationId, videoPath: simulationRunsTable.videoPath })
    .from(simulationRunsTable)
    .where(eq(simulationRunsTable.id, runId));

  if (!run || run.simulationId !== id) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  if (!run.videoPath) {
    res.status(404).json({ error: "No video recorded for this run" });
    return;
  }

  const isDownload = req.query.download === "1";
  const dispositionFilename = `run-${runId}-recording.webm`;

  // GCS-backed path: serve from object storage
  if (run.videoPath.startsWith("/objects/")) {
    try {
      const file = await objectStorageService.getObjectEntityFile(run.videoPath);
      const response = await objectStorageService.downloadObject(file, 3600);
      res.setHeader("Content-Type", response.headers.get("Content-Type") ?? "video/webm");
      const cl = response.headers.get("Content-Length");
      if (cl) res.setHeader("Content-Length", cl);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "private, max-age=3600");
      if (isDownload) {
        res.setHeader("Content-Disposition", `attachment; filename="${dispositionFilename}"`);
      }
      Readable.fromWeb(response.body as unknown as NodeWebStream<Uint8Array>).pipe(res);
    } catch {
      res.status(410).json({ error: "Video no longer available in storage" });
    }
    return;
  }

  // Legacy local file path (fallback for pre-GCS runs) — supports HTTP range requests
  // so the browser video player can seek without downloading the entire file first.
  if (!fs.existsSync(run.videoPath)) {
    res.status(410).json({ error: "Video file no longer available" });
    return;
  }

  const stat = fs.statSync(run.videoPath);
  const fileSize = stat.size;
  const rangeHeader = req.headers.range;

  res.setHeader("Content-Type", "video/webm");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, max-age=3600");
  if (isDownload) {
    res.setHeader("Content-Disposition", `attachment; filename="${dispositionFilename}"`);
  }

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1;

    if (isNaN(start) || start >= fileSize || start > end) {
      res.setHeader("Content-Range", `bytes */${fileSize}`);
      res.status(416).json({ error: "Range Not Satisfiable" });
      return;
    }

    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    res.setHeader("Content-Length", chunkSize);
    fs.createReadStream(run.videoPath, { start, end }).pipe(res);
  } else {
    res.setHeader("Content-Length", fileSize);
    fs.createReadStream(run.videoPath).pipe(res);
  }
});

export default router;
