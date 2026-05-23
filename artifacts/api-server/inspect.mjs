import { chromium } from 'playwright';
import { execSync } from 'child_process';

const NIX_LIB_PATHS = execSync("nix-build --no-out-link '<nixpkgs>' -A mesa -A libgbm -A nss -A nspr -A atk -A at-spi2-atk -A at-spi2-core -A cups -A dbus -A libdrm -A libxkbcommon -A alsa-lib -A pango -A cairo -A expat -A xorg.libX11 -A xorg.libXcomposite -A xorg.libXdamage -A xorg.libXext -A xorg.libXfixes -A xorg.libXrandr -A xorg.libxcb -A xorg.libxshmfence 2>/dev/null", { encoding:'utf8'}).trim().split('\n').map(p=>p+'/lib').join(':');
process.env.LD_LIBRARY_PATH = [process.env.LD_LIBRARY_PATH, NIX_LIB_PATHS].filter(Boolean).join(':');

const seed = Date.now();
const email = `trumpoly2025+inspect${seed}@gmail.com`;
const pw = `Trayd-${seed}-Aa1!`;
console.log('email:', email);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', m => console.log('[browser]', m.type(), m.text().slice(0,200)));
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0,200)));
page.on('response', r => { if (r.status() >= 400) console.log('[http]', r.status(), r.url().slice(0,150)); });

await page.goto('https://dev.traydbook.com/signup', { waitUntil: 'domcontentloaded' });
console.log('1. on', page.url());
await page.click('button:has-text("Contractor")');
await page.waitForTimeout(500);
await page.click('button:text-is("Continue")');
await page.waitForLoadState('networkidle', {timeout: 10000}).catch(()=>{});
console.log('2. on', page.url());
await page.click('button:has-text("Electrician")');
await page.waitForTimeout(500);
await page.click('button:has-text("Continue as")');
await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
console.log('3. on', page.url());

// dump all form inputs and required attrs
const fields = await page.evaluate(() => {
  return [...document.querySelectorAll('input, textarea, select, button')].map(el => ({
    tag: el.tagName, type: el.type, name: el.name, id: el.id,
    placeholder: el.placeholder, required: el.required,
    text: (el.textContent||'').trim().slice(0,40),
    visible: el.offsetParent !== null,
  }));
});
console.log('FORM FIELDS:'); console.log(JSON.stringify(fields, null, 2));

await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').nth(0).fill(pw);
await page.locator('input[type="password"]').nth(1).fill(pw);
console.log('4. filled. submitting...');
await page.click('button[type="submit"]');
await page.waitForTimeout(5000);
console.log('5. after submit, on', page.url());

// dump any visible error/alert text
const errors = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('[role="alert"], .error, [class*="error" i], [class*="toast" i], [aria-live]').forEach(el => {
    const t = (el.textContent||'').trim();
    if (t && t.length < 300) out.push(t);
  });
  return out;
});
console.log('ALERTS/ERRORS:', errors);
console.log('BODY TEXT SAMPLE:', (await page.locator('body').innerText()).slice(0,800));

await browser.close();
