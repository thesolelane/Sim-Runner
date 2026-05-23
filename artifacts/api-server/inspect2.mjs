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
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0,200)));

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
await page.waitForURL(u => !u.toString().includes('/signup'), {timeout:15000}).catch(()=>{});
await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
console.log('NOW ON:', page.url());

async function dumpPage(label) {
  console.log(`\n===== ${label} :: ${page.url()} =====`);
  const fields = await page.evaluate(() => {
    return [...document.querySelectorAll('input, textarea, select, button, [role="button"]')].map(el => ({
      tag: el.tagName, type: el.type, name: el.name||'', id: el.id||'',
      placeholder: el.placeholder||'', required: !!el.required,
      label: (el.closest('label')?.textContent || document.querySelector(`label[for="${el.id}"]`)?.textContent || '').trim().slice(0,60),
      text: (el.textContent||'').trim().slice(0,60),
      visible: el.offsetParent !== null,
    })).filter(f => f.visible);
  });
  console.log(JSON.stringify(fields, null, 2));
  const body = await page.locator('body').innerText();
  console.log('--- visible body ---');
  console.log(body.slice(0, 1500));
}

await dumpPage('Step A');

// Try to find a Next/Continue/Submit and click it to see what's next
for (let i = 0; i < 6; i++) {
  const before = page.url();
  // Try to fill any required text inputs with sample data
  const inputs = await page.locator('input:visible, textarea:visible').all();
  for (const inp of inputs) {
    const type = (await inp.getAttribute('type')) || 'text';
    if (type === 'checkbox') {
      try { await inp.check({ timeout: 1000 }); } catch {}
      continue;
    }
    const placeholder = (await inp.getAttribute('placeholder')) || '';
    const name = (await inp.getAttribute('name')) || '';
    const hint = (placeholder + ' ' + name).toLowerCase();
    let val = 'TestValue';
    if (hint.includes('phone')) val = '5551234567';
    else if (hint.includes('zip') || hint.includes('postal')) val = '90210';
    else if (hint.includes('city')) val = 'Los Angeles';
    else if (hint.includes('state')) val = 'CA';
    else if (hint.includes('address')) val = '123 Main St';
    else if (hint.includes('company') || hint.includes('business')) val = `TestCo ${seed}`;
    else if (hint.includes('first')) val = 'Test';
    else if (hint.includes('last')) val = 'User';
    else if (hint.includes('name')) val = 'Test User';
    else if (hint.includes('year')) val = '5';
    else if (hint.includes('license')) val = 'LIC12345';
    try { await inp.fill(val, { timeout: 1000 }); } catch {}
  }
  // try selects
  const selects = await page.locator('select:visible').all();
  for (const s of selects) {
    const opts = await s.locator('option').all();
    if (opts.length > 1) {
      const v = await opts[1].getAttribute('value');
      if (v) try { await s.selectOption(v); } catch {}
    }
  }
  // find a forward button
  const btn = page.locator('button:visible').filter({ hasText: /continue|next|submit|finish|complete|skip|get started/i }).first();
  if (!(await btn.count())) { console.log('no fwd button at step', i+1); break; }
  const btnText = (await btn.textContent())?.trim();
  console.log(`\n>>> clicking "${btnText}" at`, page.url());
  await btn.click().catch(e => console.log('click failed:', e.message.slice(0,100)));
  await page.waitForTimeout(2500);
  await dumpPage(`After click ${i+1}`);
  if (page.url() === before && i > 0) { console.log('URL unchanged + late iter, stopping'); break; }
}

console.log('\nFINAL URL:', page.url());
await browser.close();
