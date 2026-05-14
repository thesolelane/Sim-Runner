import { chromium } from "playwright";
import { logger } from "./logger";

const PLAYWRIGHT_ARGS = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
const PLAYWRIGHT_ENV: Record<string, string> = process.env.NIX_LD_LIBRARY_PATH
  ? { LD_LIBRARY_PATH: process.env.NIX_LD_LIBRARY_PATH }
  : {};

export interface StoreReadinessCheck {
  id: string;
  name: string;
  description: string;
  status: "pass" | "fail" | "warning" | "not_applicable";
  severity: "critical" | "high" | "medium" | "low" | "info";
  detail: string;
  recommendation: string | null;
}

export interface StoreReadinessCategory {
  name: string;
  score: number;
  platform: "ios" | "android" | null;
  checks: StoreReadinessCheck[];
}

export interface StoreReadinessReport {
  url: string;
  platforms: string[];
  overallScore: number;
  readyForSubmission: boolean;
  scannedAt: string;
  categories: StoreReadinessCategory[];
  criticalIssues: number;
  error: string | null;
}

function scoreCategory(checks: StoreReadinessCheck[]): number {
  const relevant = checks.filter(c => c.status !== "not_applicable");
  if (relevant.length === 0) return 1;
  const passed = relevant.filter(c => c.status === "pass").length;
  const warnings = relevant.filter(c => c.status === "warning").length;
  return (passed + warnings * 0.5) / relevant.length;
}

export async function runStoreReadinessScan(
  url: string,
  platforms: string[],
  appName?: string,
): Promise<StoreReadinessReport> {
  const scannedAt = new Date().toISOString();
  let browser = null;
  let context = null;

  try {
    browser = await chromium.launch({ headless: true, args: PLAYWRIGHT_ARGS, env: PLAYWRIGHT_ENV });
    context = await browser.newContext({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message.slice(0, 200)));

    let pageLoadMs = 0;
    const loadStart = Date.now();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    pageLoadMs = Date.now() - loadStart;

    const resp = await context.request.get(url, { timeout: 10000 }).catch(() => null);
    const headers = resp ? resp.headers() : {};

    const dom = await page.evaluate(() => {
      const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null;
      const privacyLinks = Array.from(document.querySelectorAll('a')).filter(a =>
        /privacy/i.test(a.href + (a.textContent ?? ""))
      ).length;
      const tosLinks = Array.from(document.querySelectorAll('a')).filter(a =>
        /terms|tos/i.test(a.href + (a.textContent ?? ""))
      ).length;
      const manifestLink = document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null;
      const cookieBanner = !!document.querySelector('[id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="gdpr" i], [data-testid*="cookie" i]');
      const ageGate = !!document.querySelector('[id*="age" i], [class*="age-gate" i], [class*="age-verification" i]');
      const imgCount = document.querySelectorAll('img').length;
      const imgAltMissing = document.querySelectorAll('img:not([alt])').length;
      const hasOfflineMsg = !!document.querySelector('[class*="offline" i], [id*="offline" i]');
      const mixedContent = Array.from(document.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"]')).length;
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null;
      const themeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? null;
      const appleTouch = !!document.querySelector('link[rel="apple-touch-icon"]');
      const trackingScripts = Array.from(document.querySelectorAll('script[src]')).filter(s =>
        /google-analytics|gtag|facebook\.net\/en_US\/fbevents|amplitude|mixpanel|segment\.io|hotjar/i.test((s as HTMLScriptElement).src)
      ).map(s => (s as HTMLScriptElement).src).slice(0, 5);
      const title = document.title || null;
      return { viewport, privacyLinks, tosLinks, manifestLink, cookieBanner, ageGate, imgCount, imgAltMissing, hasOfflineMsg, mixedContent, metaDescription, themeColor, appleTouch, trackingScripts, title };
    }).catch(() => null);

    let manifestData: Record<string, unknown> | null = null;
    if (dom?.manifestLink) {
      try {
        const manifestUrl = new URL(dom.manifestLink, url).href;
        const mResp = await context.request.get(manifestUrl, { timeout: 5000 });
        manifestData = await mResp.json().catch(() => null);
      } catch { /* ignore */ }
    }

    const isHttps = url.startsWith("https://");
    const hsts = headers["strict-transport-security"];
    const xcto = headers["x-content-type-options"];
    const csp = headers["content-security-policy"];
    const xfo = headers["x-frame-options"];
    const rp = headers["referrer-policy"];

    type CookieEntry = { name: string; secure?: boolean; httpOnly?: boolean };
    const cookies = ((await context.cookies().catch(() => null)) ?? []) as CookieEntry[];
    const sessionCookies = cookies.filter(c => /session|auth|token|jwt/i.test(c.name));
    const insecureCookies = sessionCookies.filter(c => !c.secure || !c.httpOnly);

    const hasIos = platforms.includes("ios");
    const hasAndroid = platforms.includes("android");

    const securityCategory: StoreReadinessCategory = {
      name: "Security & Privacy",
      score: 0,
      platform: null,
      checks: [
        {
          id: "https",
          name: "HTTPS Enforcement",
          description: "App must be served over HTTPS",
          status: isHttps ? "pass" : "fail",
          severity: "critical",
          detail: isHttps ? "Served over HTTPS" : "App is not HTTPS — required by both App Store (ATS) and Google Play",
          recommendation: isHttps ? null : "Configure TLS and enforce HTTPS with a 301 redirect from HTTP",
        },
        {
          id: "hsts",
          name: "HTTP Strict Transport Security",
          description: "HSTS header prevents SSL stripping attacks",
          status: hsts ? "pass" : "warning",
          severity: "high",
          detail: hsts ? `HSTS present: ${hsts}` : "HSTS header missing",
          recommendation: hsts ? null : "Add Strict-Transport-Security: max-age=31536000; includeSubDomains",
        },
        {
          id: "csp",
          name: "Content Security Policy",
          description: "CSP reduces XSS attack surface",
          status: csp ? "pass" : "warning",
          severity: "medium",
          detail: csp ? "CSP header configured" : "No Content-Security-Policy header",
          recommendation: csp ? null : "Define a CSP header to restrict script and resource loading",
        },
        {
          id: "xcto",
          name: "X-Content-Type-Options",
          description: "Prevents MIME sniffing",
          status: xcto === "nosniff" ? "pass" : "fail",
          severity: "medium",
          detail: xcto ? `Header: ${xcto}` : "X-Content-Type-Options: nosniff missing",
          recommendation: xcto === "nosniff" ? null : "Add X-Content-Type-Options: nosniff",
        },
        {
          id: "clickjacking",
          name: "Clickjacking Protection",
          description: "X-Frame-Options or CSP frame-ancestors prevents UI redressing",
          status: (xfo || (csp && csp.includes("frame-ancestors"))) ? "pass" : "warning",
          severity: "medium",
          detail: xfo ? `X-Frame-Options: ${xfo}` : "No clickjacking protection header",
          recommendation: (xfo || (csp && csp.includes("frame-ancestors"))) ? null : "Add X-Frame-Options: DENY",
        },
        {
          id: "mixed_content",
          name: "Mixed Content",
          description: "No HTTP resources on HTTPS pages",
          status: (dom?.mixedContent ?? 0) === 0 ? "pass" : "fail",
          severity: "high",
          detail: (dom?.mixedContent ?? 0) === 0 ? "No mixed content detected" : `${dom?.mixedContent} mixed content resource(s) found`,
          recommendation: (dom?.mixedContent ?? 0) === 0 ? null : "Update all resource URLs to HTTPS",
        },
        {
          id: "cookies",
          name: "Session Cookie Security Flags",
          description: "Cookies must have Secure, HttpOnly, and SameSite flags",
          status: sessionCookies.length === 0 ? "pass" : insecureCookies.length === 0 ? "pass" : "fail",
          severity: "high",
          detail: sessionCookies.length === 0 ? "No session cookies detected at scan time" : insecureCookies.length === 0 ? `All ${sessionCookies.length} session cookies properly secured` : `${insecureCookies.length} cookie(s) missing security flags`,
          recommendation: insecureCookies.length > 0 ? "Set Secure, HttpOnly, and SameSite=Strict/Lax on all session cookies" : null,
        },
      ],
    };

    const trackingConsent: StoreReadinessCheck = {
      id: "tracking_consent",
      name: "Tracking Transparency",
      description: "Third-party tracking scripts should respect user consent",
      status: dom?.trackingScripts.length === 0 ? "pass" : dom?.cookieBanner ? "warning" : "fail",
      severity: "high",
      detail: dom?.trackingScripts.length === 0
        ? "No third-party tracking scripts detected"
        : dom?.cookieBanner
          ? `${dom.trackingScripts.length} tracking script(s) detected with a consent mechanism present`
          : `${dom?.trackingScripts.length} tracking script(s) loaded without visible consent mechanism`,
      recommendation: dom?.cookieBanner ? null : dom?.trackingScripts.length ? "Gate all tracking scripts behind explicit user consent (required by GDPR and App Tracking Transparency on iOS)" : null,
    };

    const privacyCategory: StoreReadinessCategory = {
      name: "Privacy & Legal",
      score: 0,
      platform: null,
      checks: [
        {
          id: "privacy_policy",
          name: "Privacy Policy Link",
          description: "Privacy policy must be accessible from the app — required by all major stores",
          status: (dom?.privacyLinks ?? 0) > 0 ? "pass" : "fail",
          severity: "critical",
          detail: (dom?.privacyLinks ?? 0) > 0 ? `${dom?.privacyLinks} privacy policy link(s) found` : "No privacy policy link detected on the page",
          recommendation: (dom?.privacyLinks ?? 0) > 0 ? null : "Add a visible link to your privacy policy — required by App Store, Google Play, GDPR, and CCPA",
        },
        {
          id: "tos",
          name: "Terms of Service",
          description: "Terms of service should be accessible",
          status: (dom?.tosLinks ?? 0) > 0 ? "pass" : "warning",
          severity: "medium",
          detail: (dom?.tosLinks ?? 0) > 0 ? `${dom?.tosLinks} terms link(s) found` : "No terms of service link detected",
          recommendation: (dom?.tosLinks ?? 0) > 0 ? null : "Add a link to your terms of service",
        },
        {
          id: "cookie_consent",
          name: "Cookie Consent Mechanism",
          description: "Cookie consent required when using non-essential cookies in GDPR regions",
          status: dom?.cookieBanner ? "pass" : "warning",
          severity: "medium",
          detail: dom?.cookieBanner ? "Cookie consent banner detected" : "No cookie consent banner found",
          recommendation: dom?.cookieBanner ? null : "Implement a cookie consent banner if using analytics or marketing cookies",
        },
        trackingConsent,
      ],
    };

    const technicalCategory: StoreReadinessCategory = {
      name: "Technical Quality",
      score: 0,
      platform: null,
      checks: [
        {
          id: "viewport",
          name: "Mobile Viewport",
          description: "Viewport meta tag required for correct mobile rendering",
          status: dom?.viewport ? "pass" : "fail",
          severity: "critical",
          detail: dom?.viewport ? `Viewport meta: ${dom.viewport}` : "No viewport meta tag",
          recommendation: dom?.viewport ? null : 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
        },
        {
          id: "load_time",
          name: "Page Load Time",
          description: "Fast load times reduce bounce rate and improve store ratings",
          status: pageLoadMs < 3000 ? "pass" : pageLoadMs < 6000 ? "warning" : "fail",
          severity: pageLoadMs < 6000 ? "medium" : "high",
          detail: `Page loaded in ${(pageLoadMs / 1000).toFixed(1)}s`,
          recommendation: pageLoadMs < 3000 ? null : "Optimize assets, enable compression, and consider a CDN to reduce load time below 3s",
        },
        {
          id: "js_errors",
          name: "JavaScript Errors",
          description: "JavaScript errors cause crashes that lead to negative reviews and store removal",
          status: jsErrors.length === 0 ? "pass" : "fail",
          severity: "high",
          detail: jsErrors.length === 0 ? "No JavaScript errors on load" : `${jsErrors.length} JS error(s): ${jsErrors.slice(0, 2).join("; ").slice(0, 150)}`,
          recommendation: jsErrors.length === 0 ? null : "Fix all JavaScript errors before submission",
        },
        {
          id: "meta_description",
          name: "Meta Description",
          description: "App description meta tag improves SEO and store listing quality",
          status: dom?.metaDescription ? "pass" : "warning",
          severity: "low",
          detail: dom?.metaDescription ? `Description: ${dom.metaDescription.slice(0, 80)}...` : "No meta description tag found",
          recommendation: dom?.metaDescription ? null : "Add a meta description summarising the app",
        },
        {
          id: "accessibility_alt",
          name: "Image Alt Text",
          description: "All images need alt text for accessibility",
          status: (dom?.imgCount ?? 0) === 0 || (dom?.imgAltMissing ?? 0) === 0 ? "pass" : (dom?.imgAltMissing ?? 0) <= 2 ? "warning" : "fail",
          severity: "medium",
          detail: (dom?.imgCount ?? 0) === 0 ? "No images found" : `${dom?.imgAltMissing ?? 0} of ${dom?.imgCount ?? 0} image(s) missing alt text`,
          recommendation: (dom?.imgAltMissing ?? 0) === 0 ? null : "Add descriptive alt attributes to all images",
        },
      ],
    };

    const iosCategory: StoreReadinessCategory | null = hasIos ? {
      name: "Apple App Store (iOS)",
      score: 0,
      platform: "ios",
      checks: [
        {
          id: "ios_apple_touch",
          name: "Apple Touch Icon",
          description: "Apple touch icon used for bookmarks and PWA install on iOS",
          status: dom?.appleTouch ? "pass" : "warning",
          severity: "medium",
          detail: dom?.appleTouch ? "Apple touch icon found" : "No apple-touch-icon link element found",
          recommendation: dom?.appleTouch ? null : 'Add <link rel="apple-touch-icon" href="/apple-touch-icon.png"> (180x180px)',
        },
        {
          id: "ios_ats",
          name: "App Transport Security (ATS) Compliance",
          description: "iOS requires all network connections to use HTTPS (ATS policy)",
          status: isHttps ? "pass" : "fail",
          severity: "critical",
          detail: isHttps ? "Serving over HTTPS — compliant with ATS" : "HTTP detected — ATS will block requests in native iOS apps",
          recommendation: isHttps ? null : "All app traffic must use HTTPS to pass ATS. Use NSAllowsArbitraryLoads only if absolutely necessary (requires justification to Apple).",
        },
        {
          id: "ios_tracking",
          name: "App Tracking Transparency (ATT) Readiness",
          description: "Apps using IDFA/tracking must request ATT permission",
          status: dom?.trackingScripts.length === 0 ? "pass" : dom?.cookieBanner ? "warning" : "fail",
          severity: "high",
          detail: dom?.trackingScripts.length === 0 ? "No tracking scripts detected — ATT prompt not required" : `${dom?.trackingScripts.length} tracking script(s) detected. ATT permission required in the native app.`,
          recommendation: dom?.trackingScripts.length ? "Implement NSUserTrackingUsageDescription in Info.plist and call ATTrackingManager.requestTrackingAuthorization in the native app" : null,
        },
        {
          id: "ios_safe_area",
          name: "Safe Area / Notch Handling",
          description: "Viewport must use viewport-fit=cover and CSS env() for notch devices",
          status: dom?.viewport?.includes("viewport-fit=cover") ? "pass" : "warning",
          severity: "medium",
          detail: dom?.viewport?.includes("viewport-fit=cover") ? "viewport-fit=cover detected" : "viewport-fit=cover not set — content may be obscured by notch/Dynamic Island",
          recommendation: dom?.viewport?.includes("viewport-fit=cover") ? null : "Add viewport-fit=cover to meta viewport and use env(safe-area-inset-*) in CSS",
        },
      ],
    } : null;

    const androidCategory: StoreReadinessCategory | null = hasAndroid ? {
      name: "Google Play Store (Android)",
      score: 0,
      platform: "android",
      checks: [
        {
          id: "android_manifest",
          name: "Web App Manifest",
          description: "PWA manifest required for Android installability and Play Store TWA integration",
          status: dom?.manifestLink ? (manifestData ? "pass" : "warning") : "fail",
          severity: "high",
          detail: dom?.manifestLink ? (manifestData ? `Manifest found and valid: ${JSON.stringify(manifestData).slice(0, 80)}` : "Manifest link found but file returned invalid JSON") : "No web app manifest found (link[rel=manifest] missing)",
          recommendation: dom?.manifestLink ? null : "Add a web app manifest with name, icons (192px and 512px), start_url, and display: standalone",
        },
        {
          id: "android_icons",
          name: "Adaptive Icons (192px + 512px)",
          description: "Play Store requires 512px icon; TWA needs 192px and 512px maskable icons",
          status: (() => {
            if (!manifestData) return "not_applicable";
            const icons = (manifestData.icons as Array<{ sizes?: string }>) ?? [];
            const has192 = icons.some(i => i.sizes?.includes("192"));
            const has512 = icons.some(i => i.sizes?.includes("512"));
            return has192 && has512 ? "pass" : "warning";
          })(),
          severity: "medium",
          detail: (() => {
            if (!manifestData) return "No manifest available to check icons";
            const icons = (manifestData.icons as Array<{ sizes?: string }>) ?? [];
            const sizes = icons.map(i => i.sizes).filter(Boolean).join(", ");
            return sizes ? `Icon sizes in manifest: ${sizes}` : "No icons defined in manifest";
          })(),
          recommendation: (() => {
            if (!manifestData) return "Add a web app manifest with icons";
            const icons = (manifestData.icons as Array<{ sizes?: string }>) ?? [];
            const has192 = icons.some(i => i.sizes?.includes("192"));
            const has512 = icons.some(i => i.sizes?.includes("512"));
            if (has192 && has512) return null;
            return `Add ${!has192 ? "192x192 " : ""}${!has512 ? "512x512 " : ""}maskable icon(s) to your manifest`;
          })(),
        },
        {
          id: "android_theme_color",
          name: "Theme Color",
          description: "Theme color used for address bar branding in Chrome and TWA",
          status: dom?.themeColor ? "pass" : "warning",
          severity: "low",
          detail: dom?.themeColor ? `Theme color: ${dom.themeColor}` : "No theme-color meta tag found",
          recommendation: dom?.themeColor ? null : 'Add <meta name="theme-color" content="#your-brand-color">',
        },
        {
          id: "android_data_safety",
          name: "Data Safety Section Readiness",
          description: "All data types collected must be declared in the Google Play Data Safety section",
          status: dom?.trackingScripts.length === 0 ? "pass" : "warning",
          severity: "high",
          detail: dom?.trackingScripts.length === 0 ? "No external tracking libraries detected" : `Tracking scripts detected (${dom?.trackingScripts.map(s => new URL(s).hostname).join(", ")}). These data types must be declared in the Play Console Data Safety form.`,
          recommendation: dom?.trackingScripts.length ? "Complete the Data Safety section in Google Play Console for all data types collected by detected analytics/tracking libraries" : null,
        },
      ],
    } : null;

    const allCategories: StoreReadinessCategory[] = [
      securityCategory,
      privacyCategory,
      technicalCategory,
      ...(iosCategory ? [iosCategory] : []),
      ...(androidCategory ? [androidCategory] : []),
    ];

    allCategories.forEach(cat => { cat.score = scoreCategory(cat.checks); });

    const allChecks = allCategories.flatMap(c => c.checks);
    const criticalIssues = allChecks.filter(c => c.status === "fail" && c.severity === "critical").length;
    const totalScore = allCategories.reduce((sum, cat) => sum + cat.score, 0) / allCategories.length;

    return {
      url,
      platforms,
      overallScore: Math.round(totalScore * 100) / 100,
      readyForSubmission: criticalIssues === 0 && totalScore >= 0.7,
      scannedAt,
      categories: allCategories,
      criticalIssues,
      error: null,
    };
  } catch (err) {
    logger.error({ err, url }, "Store readiness scan failed");
    return {
      url,
      platforms,
      overallScore: 0,
      readyForSubmission: false,
      scannedAt,
      categories: [],
      criticalIssues: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try { await context?.close(); } catch { /* ignore */ }
    try { await browser?.close(); } catch { /* ignore */ }
  }
}
