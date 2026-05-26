import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  platformType: text("platform_type").notNull(),
  targetUrl: text("target_url").notNull(),
  accountCount: integer("account_count").notNull().default(100),
  concurrency: integer("concurrency").notNull().default(3),
  actionIntervalMinMs: integer("action_interval_min_ms").notNull().default(5000),
  actionIntervalMaxMs: integer("action_interval_max_ms").notNull().default(30000),
  dailyActionLimit: integer("daily_action_limit").notNull().default(10),
  proxyPoolId: integer("proxy_pool_id"),
  verificationStrategy: text("verification_strategy").notNull().default("email"),
  status: text("status").notNull().default("draft"),
  schedule: text("schedule"),
  alertThreshold: integer("alert_threshold").notNull().default(80),
  alertDestination: text("alert_destination"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});
