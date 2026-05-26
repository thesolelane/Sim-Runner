import { RealUserFlow } from "./real-user-flow";
import { proxyRotator } from "./proxy-rotator";
import { db, campaignsTable, simAccountsTable, simulationRunsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export class CampaignOrchestrator {
  async executeCampaign(campaignId: number): Promise<void> {
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
    if (!campaign) throw new Error("Campaign not found");
    
    if (campaign.status === "running") {
      logger.warn({ campaignId }, "Campaign already running");
      return;
    }
    
    await db.update(campaignsTable).set({ status: "running" }).where(eq(campaignsTable.id, campaignId));
    
    try {
      const accounts = await db.select().from(simAccountsTable).where(eq(simAccountsTable.campaignId, campaignId)).orderBy(simAccountsTable.id);
      logger.info({ campaignId, accountCount: accounts.length }, "Starting campaign");
      
      for (const batch of this.chunk(accounts, campaign.concurrency)) {
        await Promise.all(batch.map(account => this.ensureAccountReady(account, campaign)));
      }
      
      if (!campaign.schedule) {
        const activeAccounts = accounts.filter(a => a.status === "active" || a.status === "verified");
        for (const account of activeAccounts) {
          await this.randomDelay(campaign.actionIntervalMinMs, campaign.actionIntervalMaxMs);
          await this.performAccountActions(account, campaign);
        }
      }
      
      await db.update(campaignsTable).set({ status: "completed" }).where(eq(campaignsTable.id, campaignId));
      logger.info({ campaignId }, "Campaign completed");
    } catch (err: any) {
      await db.update(campaignsTable).set({ status: "failed" }).where(eq(campaignsTable.id, campaignId));
      logger.error({ campaignId, error: err.message }, "Campaign failed");
      throw err;
    }
  }
  
  private async ensureAccountReady(account: any, campaign: any): Promise<void> {
    if (account.status === "active" || account.status === "verified") return;
    
    const flow = new RealUserFlow();
    try {
      const proxy = proxyRotator.getProxy(account.id, "signup");
      await flow.initialize({ proxy, headedMode: false });
      await db.update(simAccountsTable).set({ status: "signup_started" }).where(eq(simAccountsTable.id, account.id));
      
      const signupResult = await flow.signup(campaign.targetUrl, {
        email: account.email,
        password: account.password,
        username: account.username || undefined,
        displayName: account.displayName || undefined,
      });
      
      if (!signupResult.success) {
        await db.update(simAccountsTable).set({ status: "failed", updatedAt: new Date() }).where(eq(simAccountsTable.id, account.id));
        return;
      }
      
      await db.update(simAccountsTable).set({
        status: "signup_completed",
        platformUserId: signupResult.platformUserId || null,
        updatedAt: new Date(),
      }).where(eq(simAccountsTable.id, account.id));
    } finally {
      await flow.dispose();
    }
  }
  
  private async performAccountActions(account: any, campaign: any): Promise<void> {
    const flow = new RealUserFlow();
    try {
      const proxy = proxyRotator.getProxy(account.id, "social");
      await flow.initialize({ proxy, headedMode: false });
      
      const loginResult = await flow.login(campaign.targetUrl, {
        email: account.email,
        password: account.password,
      });
      
      if (!loginResult.success) {
        logger.warn({ accountId: account.id }, "Login failed");
        return;
      }
      
      const actions = this.generateActionPlan(campaign.platformType, campaign.dailyActionLimit);
      for (const action of actions) {
        await this.randomDelay(campaign.actionIntervalMinMs, campaign.actionIntervalMaxMs);
        const result = await flow.performSocialAction(action);
        
        await db.insert(simulationRunsTable).values({
          simulationId: account.campaignId,
          status: result.success ? "passed" : "failed",
          totalSteps: 1,
          passedSteps: result.success ? 1 : 0,
          failedSteps: result.success ? 0 : 1,
          durationMs: 0,
          stepResults: [{
            stepOrder: 1,
            stepName: action.type,
            status: result.success ? "passed" : "failed",
            durationMs: 0,
            generatedData: { action, accountId: account.id },
            errorMessage: result.error || null,
            screenshot: null,
            selectorUsed: null,
            actionTaken: action.type,
          }],
          completedAt: new Date(),
        });
      }
      
      await db.update(simAccountsTable).set({ lastActionAt: new Date(), updatedAt: new Date() }).where(eq(simAccountsTable.id, account.id));
    } finally {
      await flow.dispose();
    }
  }
  
  private generateActionPlan(platformType: string, limit: number): any[] {
    const actions: any[] = [];
    const possibleActions = this.getPlatformActions(platformType);
    for (let i = 0; i < limit; i++) {
      const action = possibleActions[Math.floor(Math.random() * possibleActions.length)];
      actions.push({ ...action, content: this.generateContent(platformType, action.type) });
    }
    return actions;
  }
  
  private getPlatformActions(platformType: string): any[] {
    const base = [{ type: "post" as const }, { type: "like" as const }, { type: "follow" as const }, { type: "comment" as const }, { type: "message" as const }];
    switch (platformType) {
      case "facebook": return [...base, { type: "share" as const }, { type: "post" as const }];
      case "linkedin": return [...base, { type: "share" as const }, { type: "post" as const }];
      case "instagram": return [...base, { type: "post" as const }, { type: "post" as const }];
      case "tiktok": return [...base, { type: "post" as const }, { type: "share" as const }];
      case "lemon8": return [...base, { type: "post" as const }, { type: "post" as const }];
      case "traydbook": return [{ type: "post" as const }, { type: "message" as const }, { type: "follow" as const }];
      default: return base;
    }
  }
  
  private generateContent(platformType: string, actionType: string): string {
    const contents: Record<string, string[]> = {
      post: ["Just getting started here! Excited to connect with everyone.", "Great day for new opportunities! 🚀", "Testing out the platform. Looks promising!", "Hello world! First post here.", "Looking forward to engaging with this community."],
      comment: ["Great post! Thanks for sharing.", "Interesting perspective. Well said!", "Love this! Keep it up.", "Thanks for the insights.", "This is really helpful."],
      message: ["Hello! Nice to connect with you.", "Hi there! Saw your profile and wanted to reach out.", "Hey! Let's collaborate sometime."],
    };
    const list = contents[actionType] || ["Test content"];
    return list[Math.floor(Math.random() * list.length)];
  }
  
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
    return chunks;
  }
  
  private randomDelay(minMs: number, maxMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs));
  }
}

export const campaignOrchestrator = new CampaignOrchestrator();
