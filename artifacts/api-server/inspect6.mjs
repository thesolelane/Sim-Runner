import { chromium } from 'playwright';
import { execSync } from 'child_process';
const NIX_LIB_PATHS = execSync("nix-build --no-out-link '<nixpkgs>' -A mesa -A libgbm -A nss -A nspr -A atk -A at-spi2-atk -A at-spi2-core -A cups -A dbus -A libdrm -A libxkbcommon -A alsa-lib -A pango -A cairo -A expat -A xorg.libX11 -A xorg.libXcomposite -A xorg.libXdamage -A xorg.libXext -A xorg.libXfixes -A xorg.libXrandr -A xorg.libxcb -A xorg.libxshmfence 2>/dev/null", { encoding:'utf8'}).trim().split('\n').map(p=>p+'/lib').join(':');
process.env.LD_LIBRARY_PATH = [process.env.LD_LIBRARY_PATH, NIX_LIB_PATHS].filter(Boolean).join(':');
const seed = Date.now();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://dev.traydbook.com/signup',{waitUntil:'domcontentloaded'});
await page.click('button:has-text("Contractor")'); await page.click('button:text-is("Continue")');
await page.waitForURL('**/trade-select',{timeout:8000}).catch(()=>{});
await page.click('button:has-text("Electrician")'); await page.click('button:has-text("Continue as")');
await page.waitForURL('**/contractor',{timeout:8000}).catch(()=>{});
await page.locator('input[type="email"]').fill(`trumpoly2025+probe6${seed}@gmail.com`);
await page.locator('input[type="password"]').nth(0).fill(`Trayd-${seed}-Aa1!`);
await page.locator('input[type="password"]').nth(1).fill(`Trayd-${seed}-Aa1!`);
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});
await page.waitForTimeout(1500);
await page.click('button:has-text("Contractor")'); await page.waitForTimeout(400);
await page.click('button:text-is("Continue")');
await page.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});
await page.waitForTimeout(1500);
await page.selectOption('select >> nth=1', 'CA');
await page.locator('input[placeholder*="Full name" i]').fill(`Probe ${seed}`);
await page.click('button:has-text("Finish Setup")');
await page.waitForURL('**/wallet-setup',{timeout:10000}).catch(()=>{});
await page.waitForTimeout(2500);
console.log('ON:', page.url());

// dump every button and checkbox + their disabled state
const els = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('button, input[type="checkbox"], a, [role="button"]').forEach(el => {
    if (!el.offsetParent) return;
    out.push({
      tag: el.tagName, type: el.type || '',
      text: (el.textContent || '').trim().slice(0,80),
      disabled: el.disabled,
      ariaDisabled: el.getAttribute('aria-disabled'),
      className: (el.className || '').toString().slice(0,80),
    });
  });
  return out;
});
console.log('--- BEFORE check ---');
console.log(JSON.stringify(els, null, 2));

// Check the acknowledgment checkbox  
await page.locator('input[type="checkbox"]').check();
await page.waitForTimeout(800);
const els2 = await page.evaluate(() => {
  return [...document.querySelectorAll('button')].filter(el=>el.offsetParent).map(el => ({
    text: (el.textContent || '').trim().slice(0,80),
    disabled: el.disabled,
    ariaDisabled: el.getAttribute('aria-disabled'),
  }));
});
console.log('--- AFTER check ---');
console.log(JSON.stringify(els2, null, 2));

await browser.close();
