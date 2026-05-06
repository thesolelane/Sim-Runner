import { pgTable, text, serial, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const simulationsTable = pgTable("simulations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  appName: text("app_name").notNull(),
  appUrl: text("app_url").notNull(),
  appType: text("app_type").notNull(),
  steps: jsonb("steps").notNull().$type<Array<{
    order: number;
    name: string;
    description: string;
    fields: string[];
    stepType: string;
    selector?: string;
    actionType?: string;
    confidence?: string;
    candidateSelectors?: string[];
  }>>(),
  totalRuns: integer("total_runs").notNull().default(0),
  lastRunStatus: text("last_run_status"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  schedule: text("schedule"),
  alertThreshold: integer("alert_threshold"),
  alertDestination: text("alert_destination"),
  webhookToken: text("webhook_token").unique(),
  webhookEnabled: boolean("webhook_enabled").notNull().default(true),
  lastAlertedAt: timestamp("last_alerted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSimulationSchema = createInsertSchema(simulationsTable).omit({
  id: true,
  totalRuns: true,
  lastRunStatus: true,
  lastRunAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSimulation = z.infer<typeof insertSimulationSchema>;
export type Simulation = typeof simulationsTable.$inferSelect;
