import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { simulationsTable } from "./simulations";

export const simulationRunsTable = pgTable("simulation_runs", {
  id: serial("id").primaryKey(),
  simulationId: integer("simulation_id").notNull().references(() => simulationsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  totalSteps: integer("total_steps").notNull().default(0),
  passedSteps: integer("passed_steps").notNull().default(0),
  failedSteps: integer("failed_steps").notNull().default(0),
  durationMs: integer("duration_ms"),
  stepResults: jsonb("step_results").$type<Array<{
    stepOrder: number;
    stepName: string;
    status: string;
    durationMs: number;
    generatedData: Record<string, unknown>;
    errorMessage: string | null;
  }>>(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertSimulationRunSchema = createInsertSchema(simulationRunsTable).omit({
  id: true,
  startedAt: true,
});
export type InsertSimulationRun = z.infer<typeof insertSimulationRunSchema>;
export type SimulationRun = typeof simulationRunsTable.$inferSelect;
