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

export interface SecurityFinding {
  category: string;
  check: string;
  status: "pass" | "fail" | "warning";
  severity: "info" | "low" | "medium" | "high" | "critical";
  detail: string;
  recommendation: string;
}

export interface RunOptions {
  headedMode?: boolean;
  timeoutMs?: number;
  userSeed?: number;
}

export interface RunResult {
  stepResults: StepExecutionResult[];
  videoPath: string | null;
  securityFindings: SecurityFinding[];
}

const FIRST_NAMES = ["Alex","Jordan","Taylor","Morgan","Casey","Riley","Sam","Quinn","Avery","Jamie","Drew","Cameron","Reese","Skyler","Parker","Hayden","Rowan","Emerson","Finley","Sage","Blake","Charlie","Dakota","Ellis","Frankie","Gray","Harper","Indigo","Jules","Kai","Lane","Marlowe","Nico","Oakley","Phoenix","Quincy","Remy","Sasha","Toby","Val","Wren","Zion","Aspen","Brooke","Corey","Devon","Eden","Faye","Greer"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Wilson","Anderson","Thomas","Moore","Jackson","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts","Gomez","Phillips"];
const CITIES = ["New York","Brooklyn","Boston","Austin","Seattle","Denver","Chicago","Portland","Miami","Atlanta","Dallas","Phoenix","Minneapolis","Nashville","Raleigh"];

function generateTestValue(field: string, userSeed?: number): string {
  const seed = userSeed ?? Date.now();
  const f = field.toLowerCase();
  const first = FIRST_NAMES[seed % FIRST_NAMES.length] ?? "Alex";
  const last = LAST_NAMES[Math.floor(seed / FIRST_NAMES.length) % LAST_NAMES.length] ?? "Simrunner";
  if (f.includes("email")) {
    const base = process.env.SIM_EMAIL_BASE ?? "trumpoly2025@gmail.com";
    const at = base.indexOf("@");
    if (at > 0) {
      const local = base.slice(0, at);
      const domain = base.slice(at + 1);
      const tag = `sim${String(seed).padStart(3, "0").slice(-6)}`;
      return `${local}+${tag}@${domain}`;
    }
    return `${first.toLowerCase()}.${last.toLowerCase()}.${seed}@example.com`;
  }
  if (f.includes("password")) return `Trayd-${seed}-Aa1!`;
  if (f.includes("first") && f.includes("name")) return first;
  if (f.includes("last") && f.includes("name")) return last;
  if (f.includes("name")) return `${first} ${last}`;
  if (f.includes("phone")) {
    const last7 = String(seed).slice(-7).padStart(7, "0");
    return `+1555${last7}`;
  }
  if (f.includes("username")) return `${first.toLowerCase()}_${seed}`;
  if (f.includes("zip") || f.includes("postal")) return "10001";
  if (f.includes("city")) return CITIES[seed % CITIES.length] ?? "New York";
  if (f.includes("address")) return `${(seed % 9000) + 100} Test Street`;
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
  userSeed?: number,
): Promise<Omit<StepExecutionResult, "stepOrder" | "stepName" | "durationMs">> {
  const actionType = step.actionType || deriveActionType(step);
  const selector = step.selector;
  const generatedData: Record<string, unknown> = {};

  for (const field of step.fields) {
    generatedData[field] = generateTestValue(field, userSeed);
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
          const fieldLower = field.toLowerCase();
          const isConfirmPassword = fieldLower.includes("password") && (fieldLower.includes("confirm") || fieldLower.includes("repeat") || fieldLower.includes("verify"));
          const isPassword = fieldLower.includes("password") && !isConfirmPassword;
          const isEmail = fieldLower.includes("email");

          if (isConfirmPassword) {
            try {
              await page.locator('input[type="password"]').nth(1).fill(value, { timeout: stepTimeout });
              continue;
            } catch { /* fall through to attribute-based selectors */ }
          }
          if (isPassword && step.fields.length > 1) {
            try {
              await page.locator('input[type="password"]').nth(0).fill(value, { timeout: stepTimeout });
              continue;
            } catch { /* fall through */ }
          }

          try {
            let fieldSelector = selector;
            if (step.fields.length > 1) {
              if (isConfirmPassword) {
                fieldSelector = `input[name*="confirm" i], input[id*="confirm" i], input[placeholder*="confirm" i], input[placeholder*="repeat" i], input[placeholder*="verify" i]`;
              } else if (isPassword) {
                fieldSelector = `input[type="password"], input[name="password"], input[id="password"]`;
              } else if (isEmail) {
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
          const values = step.fields.map((f) => generateTestValue(f, userSeed));
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

      case "comment": {
        const commentSelectors = [
          selector,
          `textarea[placeholder*="comment" i]`,
          `textarea[placeholder*="write" i]`,
          `textarea[placeholder*="reply" i]`,
          `[contenteditable="true"]`,
          `textarea`,
        ].filter(Boolean) as string[];
        const commentText = `This is a test comment from Cooperanth Sim — ${Date.now()}`;
        let commentFilled = false;
        let usedSel: string | null = null;
        for (const sel of commentSelectors) {
          try {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 3000 })) {
              await el.fill(commentText, { timeout: stepTimeout });
              generatedData["Comment Text"] = commentText;
              usedSel = sel;
              commentFilled = true;
              break;
            }
          } catch { /* try next */ }
        }
        if (!commentFilled) {
          return { status: "failed", generatedData, errorMessage: "Could not find comment input field", screenshot: await captureScreenshot(page), selectorUsed: null, actionTaken: null };
        }
        const submitLabels = [`button:has-text("Post")`, `button:has-text("Comment")`, `button:has-text("Reply")`, `button:has-text("Send")`, `button[type="submit"]`];
        for (const sl of submitLabels) {
          try {
            const btn = page.locator(sl).first();
            if (await btn.isVisible({ timeout: 2000 })) { await btn.click({ timeout: stepTimeout }); break; }
          } catch { /* continue */ }
        }
        return { status: "passed", generatedData, errorMessage: null, screenshot: null, selectorUsed: usedSel, actionTaken: "Posted comment" };
      }

      case "like": {
        const likeSelectors = [
          selector,
          `button[aria-label*="like" i]`,
          `button[aria-label*="heart" i]`,
          `button[aria-label*="react" i]`,
          `[data-testid*="like"]`,
          `button:has-text("Like")`,
          `[role="button"][aria-label*="like" i]`,
        ].filter(Boolean) as string[];
        for (const sel of likeSelectors) {
          try {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 3000 })) {
              await el.click({ timeout: stepTimeout });
              return { status: "passed", generatedData, errorMessage: null, screenshot: null, selectorUsed: sel, actionTaken: `Clicked like/reaction button` };
            }
          } catch { /* try next */ }
        }
        return { status: "failed", generatedData, errorMessage: "Could not find like/reaction button", screenshot: await captureScreenshot(page), selectorUsed: null, actionTaken: null };
      }

      case "follow": {
        const followSelectors = [
          selector,
          `button:has-text("Follow")`,
          `button[aria-label*="follow" i]`,
          `[data-testid*="follow"]`,
          `[role="button"]:has-text("Follow")`,
        ].filter(Boolean) as string[];
        for (const sel of followSelectors) {
          try {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 3000 })) {
              await el.click({ timeout: stepTimeout });
              await page.waitForTimeout(500);
              return { status: "passed", generatedData, errorMessage: null, screenshot: null, selectorUsed: sel, actionTaken: "Clicked follow button" };
            }
          } catch { /* try next */ }
        }
        return { status: "failed", generatedData, errorMessage: "Could not find follow button", screenshot: await captureScreenshot(page), selectorUsed: null, actionTaken: null };
      }

      case "message": {
        const msgSelectors = [
          selector,
          `button:has-text("Message")`,
          `a:has-text("Message")`,
          `button[aria-label*="message" i]`,
          `[data-testid*="message"]`,
          `a[href*="/messages"]`,
          `a[href*="/dm"]`,
        ].filter(Boolean) as string[];
        for (const sel of msgSelectors) {
          try {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 3000 })) {
              await el.click({ timeout: stepTimeout });
              await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
              const msgText = `Hello from Cooperanth test — ${Date.now()}`;
              const msgInput = page.locator(`textarea, input[placeholder*="message" i], [contenteditable="true"]`).first();
              if (await msgInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await msgInput.fill(msgText, { timeout: 3000 });
                generatedData["Message"] = msgText;
              }
              return { status: "passed", generatedData, errorMessage: null, screenshot: null, selectorUsed: sel, actionTaken: "Accessed messaging interface" };
            }
          } catch { /* try next */ }
        }
        return { status: "failed", generatedData, errorMessage: "Could not find messaging interface", screenshot: await captureScreenshot(page), selectorUsed: null, actionTaken: null };
      }

      case "notification": {
        const notifSelectors = [
          selector,
          `[aria-label*="notification" i]`,
          `button[aria-label*="notif" i]`,
          `[data-testid*="notif"]`,
          `[href*="notification"]`,
          `.notification-bell`,
          `[aria-label*="bell" i]`,
        ].filter(Boolean) as string[];
        for (const sel of notifSelectors) {
          try {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 3000 })) {
              await el.click({ timeout: stepTimeout }).catch(() => {});
              await page.waitForTimeout(500);
              return { status: "passed", generatedData, errorMessage: null, screenshot: null, selectorUsed: sel, actionTaken: "Accessed notifications panel" };
            }
          } catch { /* try next */ }
        }
        return { status: "failed", generatedData, errorMessage: "Could not find notifications element", screenshot: await captureScreenshot(page), selectorUsed: null, actionTaken: null };
      }

      case "uploadMedia": {
        const uploadSelectors = [
          selector,
          `input[type="file"]`,
          `button[aria-label*="upload" i]`,
          `button:has-text("Upload")`,
          `button:has-text("Add Photo")`,
          `button:has-text("Add Image")`,
          `label[for*="file" i]`,
        ].filter(Boolean) as string[];
        for (const sel of uploadSelectors) {
          try {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 3000 })) {
              generatedData["Upload Target"] = sel;
              return { status: "passed", generatedData, errorMessage: null, screenshot: null, selectorUsed: sel, actionTaken: "Verified media upload interface is accessible" };
            }
          } catch { /* try next */ }
        }
        return { status: "failed", generatedData, errorMessage: "Could not find media upload interface", screenshot: await captureScreenshot(page), selectorUsed: null, actionTaken: null };
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
  if (st === "comment") return "comment";
  if (st === "like") return "like";
  if (st === "follow") return "follow";
  if (st === "message") return "message";
  if (st === "notification") return "notification";
  if (st === "uploadMedia") return "uploadMedia";
  if (step.fields.length > 0) return "fill";
  return "waitForText";
}

async function runPassiveSecurityChecks(page: Page, targetUrl: string, jsErrors: string[]): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  try {
    // 1. HTTP response headers
    const resp = await page.context().request.get(targetUrl, { timeout: 10000 }).catch(() => null);
    if (resp) {
      const h = resp.headers();
      const isHttps = targetUrl.startsWith("https://");
      findings.push({ category: "Transport Security", check: "HTTPS Enforcement", status: isHttps ? "pass" : "fail", severity: isHttps ? "info" : "critical", detail: isHttps ? "Connection uses HTTPS" : "App is not served over HTTPS — data transmitted in plaintext", recommendation: isHttps ? "N/A — HTTPS is active" : "Obtain a TLS certificate and redirect all HTTP to HTTPS" });
      const hsts = h["strict-transport-security"];
      findings.push({ category: "Security Headers", check: "HTTP Strict Transport Security (HSTS)", status: hsts ? "pass" : "fail", severity: hsts ? "info" : "high", detail: hsts ? `HSTS present: ${hsts}` : "HSTS header missing — browsers may allow insecure HTTP connections", recommendation: hsts ? "N/A" : "Add Strict-Transport-Security: max-age=31536000; includeSubDomains" });
      const xcto = h["x-content-type-options"];
      findings.push({ category: "Security Headers", check: "X-Content-Type-Options", status: xcto === "nosniff" ? "pass" : "fail", severity: xcto === "nosniff" ? "info" : "medium", detail: xcto ? `Header present: ${xcto}` : "Missing — allows MIME type sniffing attacks", recommendation: xcto === "nosniff" ? "N/A" : "Add X-Content-Type-Options: nosniff" });
      const xfo = h["x-frame-options"];
      const csp = h["content-security-policy"];
      const hasFrame = !!(xfo || (csp && csp.includes("frame-ancestors")));
      findings.push({ category: "Security Headers", check: "Clickjacking Protection (X-Frame-Options / CSP frame-ancestors)", status: hasFrame ? "pass" : "warning", severity: hasFrame ? "info" : "medium", detail: hasFrame ? `Frame protection: ${xfo ?? "via CSP frame-ancestors"}` : "No clickjacking protection header found", recommendation: hasFrame ? "N/A" : "Add X-Frame-Options: DENY or CSP frame-ancestors 'none'" });
      findings.push({ category: "Security Headers", check: "Content Security Policy (CSP)", status: csp ? "pass" : "warning", severity: csp ? "info" : "medium", detail: csp ? "CSP header configured" : "No CSP header — increases XSS risk", recommendation: csp ? "N/A" : "Implement a Content-Security-Policy header" });
      const rp = h["referrer-policy"];
      findings.push({ category: "Security Headers", check: "Referrer Policy", status: rp ? "pass" : "warning", severity: rp ? "info" : "low", detail: rp ? `Referrer-Policy: ${rp}` : "No Referrer-Policy header", recommendation: rp ? "N/A" : "Add Referrer-Policy: strict-origin-when-cross-origin" });
    }

    // 2. Cookie security flags
    type CookieEntry = { name: string; secure?: boolean; httpOnly?: boolean };
    const cookies = ((await page.context().cookies().catch(() => null)) ?? []) as CookieEntry[];
    const sessionCookies = cookies.filter(c =>
      /session|auth|token|jwt|__secure|__host/i.test(c.name)
    );
    if (sessionCookies.length > 0) {
      const insecure = sessionCookies.filter(c => !c.secure || !c.httpOnly);
      findings.push({ category: "Session Management", check: "Session Cookie Security Flags (Secure + HttpOnly)", status: insecure.length === 0 ? "pass" : "fail", severity: insecure.length === 0 ? "info" : "high", detail: insecure.length === 0 ? `All ${sessionCookies.length} session cookie(s) have Secure and HttpOnly flags` : `${insecure.length} cookie(s) missing flags: ${insecure.map(c => c.name).join(", ")}`, recommendation: insecure.length === 0 ? "N/A" : "Set Secure and HttpOnly on all session cookies" });
    } else {
      findings.push({ category: "Session Management", check: "Session Cookie Security Flags (Secure + HttpOnly)", status: "pass", severity: "info", detail: "No session cookies detected at this stage (normal for pre-login pages)", recommendation: "Ensure cookies set after login have Secure, HttpOnly, and SameSite=Strict/Lax flags" });
    }

    // 3. DOM checks via Playwright evaluate
    const domChecks = await page.evaluate(() => {
      const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null;
      const privacyLink = !!document.querySelector('a[href*="privacy" i], a[href*="datenschutz" i]');
      const tosLink = !!document.querySelector('a[href*="terms" i], a[href*="tos" i]');
      const mixedContent = Array.from(document.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"]')).map(el => (el as HTMLElement & { src?: string; href?: string }).src ?? (el as HTMLElement & { src?: string; href?: string }).href ?? "").filter(Boolean).slice(0, 3);
      const cookieBanner = !!document.querySelector('[id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="gdpr" i], [class*="banner" i]');
      const imgCount = document.querySelectorAll('img').length;
      const imgAltMissing = document.querySelectorAll('img:not([alt])').length;
      return { viewport, privacyLink, tosLink, mixedContent, cookieBanner, imgCount, imgAltMissing };
    }).catch(() => null);

    if (domChecks) {
      findings.push({ category: "Technical Quality", check: "Mobile Viewport Meta Tag", status: domChecks.viewport ? "pass" : "fail", severity: domChecks.viewport ? "info" : "critical", detail: domChecks.viewport ? `Viewport meta: ${domChecks.viewport}` : "No viewport meta tag — page will not render correctly on mobile", recommendation: domChecks.viewport ? "N/A" : 'Add <meta name="viewport" content="width=device-width, initial-scale=1">' });
      findings.push({ category: "Privacy & Compliance", check: "Privacy Policy Link", status: domChecks.privacyLink ? "pass" : "fail", severity: domChecks.privacyLink ? "info" : "critical", detail: domChecks.privacyLink ? "Privacy policy link visible on page" : "No privacy policy link found — required by App Store, Google Play, GDPR, and CCPA", recommendation: domChecks.privacyLink ? "N/A" : "Add a visible privacy policy link on the main page and in app settings" });
      findings.push({ category: "Privacy & Compliance", check: "Terms of Service Link", status: domChecks.tosLink ? "pass" : "warning", severity: domChecks.tosLink ? "info" : "medium", detail: domChecks.tosLink ? "Terms of service link visible" : "No terms of service link found", recommendation: domChecks.tosLink ? "N/A" : "Add a link to your terms of service — required by most app stores" });
      findings.push({ category: "Privacy & Compliance", check: "Cookie Consent Mechanism", status: domChecks.cookieBanner ? "pass" : "warning", severity: domChecks.cookieBanner ? "info" : "medium", detail: domChecks.cookieBanner ? "Cookie consent mechanism detected" : "No cookie consent banner found — may be required for GDPR regions", recommendation: domChecks.cookieBanner ? "N/A" : "Implement a cookie consent banner if using non-essential cookies or tracking" });
      findings.push({ category: "Transport Security", check: "Mixed Content (HTTP resources on HTTPS page)", status: domChecks.mixedContent.length === 0 ? "pass" : "fail", severity: domChecks.mixedContent.length === 0 ? "info" : "high", detail: domChecks.mixedContent.length === 0 ? "No mixed content detected" : `Mixed content: ${domChecks.mixedContent.join(", ")}`, recommendation: domChecks.mixedContent.length === 0 ? "N/A" : "Update all resource URLs to HTTPS" });
      if (domChecks.imgCount > 0) {
        const altRatio = 1 - (domChecks.imgAltMissing / domChecks.imgCount);
        findings.push({ category: "Accessibility", check: "Image Alt Text", status: domChecks.imgAltMissing === 0 ? "pass" : altRatio >= 0.8 ? "warning" : "fail", severity: domChecks.imgAltMissing === 0 ? "info" : "medium", detail: domChecks.imgAltMissing === 0 ? `All ${domChecks.imgCount} image(s) have alt text` : `${domChecks.imgAltMissing} of ${domChecks.imgCount} images missing alt text`, recommendation: domChecks.imgAltMissing === 0 ? "N/A" : "Add descriptive alt attributes to all images" });
      }
    }

    // 4. JS errors during the run
    findings.push({ category: "Technical Quality", check: "JavaScript Errors on Load", status: jsErrors.length === 0 ? "pass" : "fail", severity: jsErrors.length === 0 ? "info" : "high", detail: jsErrors.length === 0 ? "No JavaScript errors detected" : `${jsErrors.length} JS error(s): ${jsErrors.slice(0, 3).join("; ").slice(0, 200)}`, recommendation: jsErrors.length === 0 ? "N/A" : "Fix JavaScript errors — they can cause crashes and lead to app store rejection" });

  } catch (err) {
    logger.warn({ err }, "Passive security check error");
  }
  return findings;
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
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message.slice(0, 200)));

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
      const result = await executeStep(page, step, timeoutMs, options.userSeed);
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

    const securityFindings = await runPassiveSecurityChecks(page, targetUrl, jsErrors);

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

    return { stepResults: results, videoPath, securityFindings };
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
      securityFindings: [],
    };
  } finally {
    try { await context?.close(); } catch { /* ignore */ }
    try { await browser?.close(); } catch { /* ignore */ }
  }
}
