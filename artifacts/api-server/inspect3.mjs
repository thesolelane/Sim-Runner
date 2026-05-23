import { chromium } from 'playwright';
import { execSync } from 'child_process';
const NIX_LIB_PATHS = execSync("nix-build --no-out-link '<nixpkgs>' -A mesa -A libgbm -A nss -A nspr -A atk -A at-spi2-atk -A at-spi2-core -A cups -A dbus -A libdrm -A libxkbcommon -A alsa-lib -A pango -A cairo -A expat -A xorg.libX11 -A xorg.libXcomposite -A xorg.libXdamage -A xorg.libXext -A xorg.libXfixes -A xorg.libXrandr -A xorg.libxcb -A xorg.libxshmfence 2>/dev/null", { encoding:'utf8'}).trim().split('\n').map(p=>p+'/lib').join(':');
process.env.LD_LIBRARY_PATH = [process.env.LD_LIBRARY_PATH, NIX_LIB_PATHS].filter(Boolean).join(':');
const seed = Date.now();
const email = `trumpoly2025+probe${seed}@gmail.com`;
const pw = `Trayd-${seed}-Aa1!`;
console.log('email:', email);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://dev.traydbook.com/signup', { waitUntil: 'domcontentloaded' });
await page.click('button:has-text("Contractor")');
await page.click('button:text-is("Continue")');
await page.waitForURL('**/trade-select', {timeout:10000}).catch(()=>{});
await page.click('button:has-text("Electrician")');
await page.click('button:has-text("Continue as")');
await page.waitForURL('**/contractor', {timeout:10000}).catch(()=>{});
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').nth(0).fill(pw);
await page.locator('input[type="password"]').nth(1).fill(pw);
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
await page.waitForTimeout(2000);
console.log('AFTER SIGNUP URL:', page.url());
const body = (await page.locator('body').innerText()).slice(0, 2000);
console.log('--- body ---'); console.log(body);
const fields = await page.evaluate(() => [...document.querySelectorAll('input, textarea, select, button, a, [role="button"]')].filter(el=>el.offsetParent).map(el => ({
  tag: el.tagName, type: el.type||'', name: el.name||'', id: el.id||'',
  placeholder: el.placeholder||'', text: (el.textContent||'').trim().slice(0,80),
})));
console.log('--- fields ---'); console.log(JSON.stringify(fields, null, 2));
await browser.close();
