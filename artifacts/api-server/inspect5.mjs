import { chromium } from 'playwright';
import { execSync } from 'child_process';
const NIX_LIB_PATHS = execSync("nix-build --no-out-link '<nixpkgs>' -A mesa -A libgbm -A nss -A nspr -A atk -A at-spi2-atk -A at-spi2-core -A cups -A dbus -A libdrm -A libxkbcommon -A alsa-lib -A pango -A cairo -A expat -A xorg.libX11 -A xorg.libXcomposite -A xorg.libXdamage -A xorg.libXext -A xorg.libXfixes -A xorg.libXrandr -A xorg.libxcb -A xorg.libxshmfence 2>/dev/null", { encoding:'utf8'}).trim().split('\n').map(p=>p+'/lib').join(':');
process.env.LD_LIBRARY_PATH = [process.env.LD_LIBRARY_PATH, NIX_LIB_PATHS].filter(Boolean).join(':');
const seed = Date.now();
const email = `trumpoly2025+verify${seed}@gmail.com`;
console.log('PROBE EMAIL:', email);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const httpLog = [];
page.on('response', r => {
  const u = r.url();
  if (u.includes('supabase') || u.includes('traydbook')) {
    httpLog.push(`${r.status()} ${r.request().method()} ${u.slice(0,150)}`);
  }
});
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0,200)));

await page.goto('https://dev.traydbook.com/signup',{waitUntil:'domcontentloaded'});
await page.click('button:has-text("Contractor")'); await page.click('button:text-is("Continue")');
await page.waitForURL('**/trade-select',{timeout:8000}).catch(()=>{});
await page.click('button:has-text("Electrician")'); await page.click('button:has-text("Continue as")');
await page.waitForURL('**/contractor',{timeout:8000}).catch(()=>{});
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').nth(0).fill(`Trayd-${seed}-Aa1!`);
await page.locator('input[type="password"]').nth(1).fill(`Trayd-${seed}-Aa1!`);
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});
await page.waitForTimeout(2000);
console.log('after signup:', page.url());
await page.click('button:has-text("Contractor")');
await page.waitForTimeout(500);
await page.click('button:text-is("Continue")');
await page.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});
await page.waitForTimeout(2000);
console.log('after onboard role+continue:', page.url());

await page.selectOption('select >> nth=1', 'CA');
await page.locator('input[placeholder*="Full name" i]').fill(`Test User ${seed}`);
console.log('\n--- BEFORE FINISH SETUP ---');
const beforeState = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input, select')].filter(el=>el.offsetParent);
  return inputs.map(i => ({
    placeholder: i.placeholder||'', value: i.value||'', tag: i.tagName, type: i.type,
    required: i.required, validity: i.checkValidity?.() ?? null
  }));
});
console.log(JSON.stringify(beforeState, null, 2));

httpLog.length = 0;
console.log('\n>>> clicking Finish Setup');
await page.click('button:has-text("Finish Setup")');
await page.waitForTimeout(6000);
console.log('after finish setup URL:', page.url());

console.log('\n--- HTTP CALLS DURING FINISH ---');
httpLog.forEach(l => console.log(' ', l));

console.log('\n--- visible alerts/errors ---');
const errs = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('[role="alert"], [class*="error" i], [class*="toast" i], [aria-live]').forEach(el => {
    const t = (el.textContent||'').trim();
    if (t) out.push(t.slice(0,200));
  });
  return out;
});
console.log(errs);
console.log('\n--- body (first 1500) ---');
console.log((await page.locator('body').innerText()).slice(0,1500));

await browser.close();
