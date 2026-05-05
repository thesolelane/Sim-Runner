import { chromium } from 'playwright';

export class OwnerSimulator {
  constructor(appConfig, options = {}) {
    this.config = appConfig;
    this.options = { headless: true, screenshotOnFail: true, ...options };
    this.results = [];
    this.screenshots = [];
  }

  async run(userType) {
    const browser = await chromium.launch({ headless: this.options.headless });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    const user = this.config.users[userType];
    if (!user) throw new Error(`Unknown user type: ${userType}`);

    console.log(`\n🎭 Cooperanth Sim Runner`);
    console.log(`   App: ${this.config.url}`);
    console.log(`   User: ${userType} (${user.role})`);
    console.log(`   Flow: ${user.flow}`);
    console.log(`${'─'.repeat(50)}`);

    const steps = user.flow.split(' → ');
    for (const step of steps) {
      const startTime = Date.now();
      const result = await this[step](page, userType, user);
      result.duration = Date.now() - startTime;
      this.results.push({ step, ...result });

      if (!result.success && this.options.screenshotOnFail) {
        const screenshot = await page.screenshot({ fullPage: true });
        this.screenshots.push({ step, screenshot });
      }
      if (!result.success) break;
    }

    await browser.close();
    return this.report();
  }

  async signup(page, role, user) {
    try {
      await page.goto(this.config.url, { waitUntil: 'networkidle' });
      const joinBtn = page.locator('button, a').filter({ hasText: /join|signup|get started|contractor/i }).first();
      if (await joinBtn.count() === 0) return { success: false, detail: 'No signup button found' };

      await joinBtn.click();
      const email = `sim_${role}_${Date.now()}@traydbook.com`;
      await page.fill('input[type="email"], input[name="email"]', email);
      await page.fill('input[type="password"], input[name="password"]', 'SimPass123!');

      const confirmField = page.locator('input[name="confirmPassword"], input[placeholder*="confirm" i]');
      if (await confirmField.count() > 0) await confirmField.fill('SimPass123!');

      await page.click('button[type="submit"], button:has-text("Sign Up"), button:has-text("Create")');
      await page.waitForURL(/.*dashboard|.*home|.*feed|.*onboarding|.*wallet/, { timeout: 15000 });

      return { success: true, detail: `Account created: ${email}` };
    } catch (e) {
      return { success: false, detail: e.message };
    }
  }

  async profile(page, role, user) {
    try {
      const onboardingForm = page.locator('form, [data-testid="profile-form"]').first();
      if (await onboardingForm.count() === 0 || !await onboardingForm.isVisible()) {
        return { success: true, detail: 'Profile already complete' };
      }

      await page.fill('input[name="display_name"], input[placeholder*="name" i]', user.data.display_name || 'Sim User');
      if (user.data.trade) {
        const tradeSelect = page.locator('select[name="trade"], [data-testid="trade-select"]');
        if (await tradeSelect.count() > 0) await tradeSelect.selectOption(user.data.trade);
      }
      if (user.data.account_type) {
        const typeSelect = page.locator('select[name="account_type"], [data-testid="account-type"]');
        if (await typeSelect.count() > 0) await typeSelect.selectOption(user.data.account_type);
      }
      await page.fill('input[name="zipCode"], input[placeholder*="zip" i]', '90210');
      await page.click('button:has-text("Save"), button:has-text("Continue"), button[type="submit"]');
      await page.waitForSelector('text=/dashboard|feed|explore|wallet/', { timeout: 10000 });

      return { success: true, detail: 'Profile completed' };
    } catch (e) {
      return { success: false, detail: e.message };
    }
  }

  async findJobs(page, role, user) {
    try {
      await page.click('text=/find jobs|explore|projects|feed/i');
      await page.waitForLoadState('networkidle');
      const jobCards = page.locator('.job-card, [data-testid="project-card"], .project-card');
      const count = await jobCards.count();
      return { success: count > 0, detail: count > 0 ? `${count} jobs found` : 'No jobs found' };
    } catch (e) {
      return { success: false, detail: e.message };
    }
  }

  async bid(page, role, user) {
    try {
      const jobCards = page.locator('.job-card, [data-testid="project-card"], .project-card');
      if (await jobCards.count() === 0) return { success: false, detail: 'No jobs to bid on' };

      await jobCards.first().click();
      await page.waitForLoadState('networkidle');

      const bidBtn = page.locator('button:has-text("Bid"), button:has-text("Submit"), a:has-text("Bid")').first();
      if (await bidBtn.count() === 0) return { success: false, detail: 'No bid button found' };

      await bidBtn.click();
      await page.fill('input[name="amount"], input[placeholder*="amount" i]', '15000');
      await page.fill('input[name="timeline"], input[placeholder*="day" i]', '14');
      await page.fill('textarea[name="message"], textarea[placeholder*="message" i]', 'Licensed electrician, 8 years experience. Available next week.');
      await page.click('button:has-text("Submit Bid"), button[type="submit"]');
      await page.waitForSelector('text=/submitted|success|confirmation/i', { timeout: 5000 });

      return { success: true, detail: 'Bid submitted: $15,000' };
    } catch (e) {
      return { success: false, detail: e.message };
    }
  }

  async buyCredits(page, role, user) {
    try {
      await page.click('text=/wallet|credits|account/i');
      await page.waitForLoadState('networkidle');
      const creditBtn = page.locator('button:has-text("Buy"), button:has-text("Purchase"), a:has-text("Credits")').first();
      if (await creditBtn.count() === 0) return { success: true, detail: 'Credits page accessible' };
      await creditBtn.click();
      return { success: true, detail: 'Credit purchase flow started' };
    } catch (e) {
      return { success: false, detail: e.message };
    }
  }

  async postJob(page, role, user) {
    try {
      await page.click('text=/post job|new project|create listing/i');
      await page.waitForLoadState('networkidle');
      await page.fill('input[name="title"], input[placeholder*="title" i]', 'Electrical Rewire - Commercial Building');
      await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', 'Need full electrical rewire for 5,000 sq ft commercial space.');
      await page.fill('input[name="budget"], input[placeholder*="budget" i]', '15000-25000');
      await page.selectOption('select[name="trade"]', 'electrician');
      await page.click('button:has-text("Post"), button[type="submit"]');
      await page.waitForSelector('text=/posted|success|live/i', { timeout: 5000 });
      return { success: true, detail: 'Job posted: Electrical Rewire' };
    } catch (e) {
      return { success: false, detail: e.message };
    }
  }

  async postRFQ(page, role, user) {
    try {
      await page.click('text=/post rfq|request quote|new rfq/i');
      await page.waitForLoadState('networkidle');
      await page.fill('input[name="title"]', 'HVAC Installation Quote Needed');
      await page.fill('textarea[name="description"]', 'Need quote for HVAC install in new construction.');
      await page.fill('input[name="budget"]', '10000-20000');
      await page.click('button:has-text("Post"), button[type="submit"]');
      return { success: true, detail: 'RFQ posted: HVAC Installation' };
    } catch (e) {
      return { success: false, detail: e.message };
    }
  }

  async reviewBids(page, role, user) {
    try {
      await page.click('text=/my bids|review bids|bids received/i');
      await page.waitForLoadState('networkidle');
      const bids = page.locator('.bid-card, [data-testid="bid-card"]');
      const count = await bids.count();
      return { success: true, detail: count > 0 ? `${count} bids to review` : 'No bids yet (expected)' };
    } catch (e) {
      return { success: false, detail: e.message };
    }
  }

  async message(page, role, user) {
    try {
      await page.click('text=/messages|inbox|chat/i');
      await page.waitForLoadState('networkidle');
      const newMsgBtn = page.locator('button:has-text("New"), button:has-text("Compose")').first();
      if (await newMsgBtn.count() > 0) {
        await newMsgBtn.click();
        return { success: true, detail: 'Messaging interface accessible' };
      }
      return { success: true, detail: 'Messages page loaded' };
    } catch (e) {
      return { success: false, detail: e.message };
    }
  }

  report() {
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    const duration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  📊 SIMULATION RESULTS`);
    console.log(`  ${'─'.repeat(50)}`);
    this.results.forEach(r => {
      const icon = r.success ? '✅' : '❌';
      const time = r.duration ? ` (${r.duration}ms)` : '';
      console.log(`  ${icon} ${r.step.padEnd(15)} ${r.detail}${time}`);
    });
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  ✅ Passed: ${passed}/${total}`);
    console.log(`  ❌ Failed: ${failed}/${total}`);
    console.log(`  ⏱️  Total Time: ${duration}ms`);
    if (this.screenshots.length > 0) console.log(`  📸 Screenshots: ${this.screenshots.length} failures captured`);
    console.log(`${'═'.repeat(50)}\n`);

    return { passed, failed, total, duration, screenshots: this.screenshots.length, success: failed === 0 };
  }
}
