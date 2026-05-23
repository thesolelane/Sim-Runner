import { chromium } from 'playwright';
import { execSync } from 'child_process';
const NIX_LIB_PATHS = execSync("nix-build --no-out-link '<nixpkgs>' -A mesa -A libgbm -A nss -A nspr -A atk -A at-spi2-atk -A at-spi2-core -A cups -A dbus -A libdrm -A libxkbcommon -A alsa-lib -A pango -A cairo -A expat -A xorg.libX11 -A xorg.libXcomposite -A xorg.libXdamage -A xorg.libXext -A xorg.libXfixes -A xorg.libXrandr -A xorg.libxcb -A xorg.libxshmfence 2>/dev/null", { encoding:'utf8'}).trim().split('\n').map(p=>p+'/lib').join(':');
process.env.LD_LIBRARY_PATH = [process.env.LD_LIBRARY_PATH, NIX_LIB_PATHS].filter(Boolean).join(':');
const seed = Date.now();
const email = `trumpoly2025+net${seed}@gmail.com`;
console.log('EMAIL:', email);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const ALL = [];
page.on('request', r => ALL.push(`REQ ${r.method()} ${r.url().slice(0,180)}`));
page.on('response', r => ALL.push(`RES ${r.status()} ${r.request().method()} ${r.url().slice(0,180)}`));

await page.goto('https://dev.traydbook.com/signup',{waitUntil:'domcontentloaded'});
await page.click('button:has-text("Contractor")'); await page.click('button:text-is("Continue")');
await page.waitForURL('**/trade-select',{timeout:8000}).catch(()=>{});
await page.click('button:has-text("Electrician")'); await page.click('button:has-text("Continue as")');
await page.waitForURL('**/contractor',{timeout:8000}).catch(()=>{});
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').nth(0).fill(`Trayd-${seed}-Aa1!`);
await page.locator('input[type="password"]').nth(1).fill(`Trayd-${seed}-Aa1!`);

console.log('\n>>>>>> SUBMIT step 1 of /signup/contractor <<<<<<');
ALL.length = 0;
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
await page.waitForTimeout(2500);
console.log('URL now:', page.url());
console.log('--- net traffic post step-1 submit (filtered to api/auth/users) ---');
ALL.filter(l => /api\/|auth\/|\/users|wallet|onboarding|contractor_profile/i.test(l)).forEach(l=>console.log(' ', l));

// dump page state to see if we're on /onboarding fresh OR still on /signup/contractor step-2
console.log('\n--- BODY at current URL ---');
console.log((await page.locator('body').innerText()).slice(0, 1200));
console.log('\n--- visible form inputs ---');
const inputs = await page.evaluate(() => [...document.querySelectorAll('input,textarea,select')].filter(el=>el.offsetParent).map(el=>({
  tag:el.tagName,type:el.type||'',name:el.name||'',placeholder:el.placeholder||'',
  label:(document.querySelector(`label[for="${el.id}"]`)?.textContent||'').trim().slice(0,40)
})));
console.log(JSON.stringify(inputs,null,2));
await browser.close();
