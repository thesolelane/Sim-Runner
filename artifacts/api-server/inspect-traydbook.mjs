import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();
for (const path of ["/", "/signup", "/sign-up", "/register", "/auth/signup", "/login"]) {
  try {
    const url = "https://dev.traydbook.com" + path;
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
    const title = await page.title();
    const finalUrl = page.url();
    const forms = await page.$$eval("form", fs => fs.map(f => ({
      action: f.getAttribute("action"),
      inputs: Array.from(f.querySelectorAll("input,button,select,textarea")).map(i => ({
        tag: i.tagName.toLowerCase(),
        type: i.getAttribute("type"),
        name: i.getAttribute("name"),
        id: i.getAttribute("id"),
        placeholder: i.getAttribute("placeholder"),
        text: i.textContent?.trim().slice(0,50),
      })),
    })));
    const inputsOutsideForm = await page.$$eval("input,button[type='submit']", els => els.slice(0,15).map(i => ({
      tag: i.tagName.toLowerCase(), type: i.getAttribute("type"), name: i.getAttribute("name"),
      id: i.getAttribute("id"), placeholder: i.getAttribute("placeholder"), text: i.textContent?.trim().slice(0,50),
    })));
    console.log("==>", path, "->", finalUrl, "| title:", title, "| forms:", forms.length);
    if (forms.length) console.log("  forms:", JSON.stringify(forms, null, 2));
    else if (inputsOutsideForm.length) console.log("  inputs (no form):", JSON.stringify(inputsOutsideForm, null, 2));
  } catch (e) { console.log("==>", path, "ERR:", e.message); }
}
await browser.close();
