import { pgTable, text, serial, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { simulationsTable } from "./simulations";

// Migration SQL (run via psql $DATABASE_URL for non-interactive migrations):
// ALTER TABLE simulation_runs ADD COLUMN IF NOT EXISTS quantum_scan_result jsonb;

export const simulationRunsTable = pgTable("simulation_runs", {
  id: serial("id").primaryKey(),
  simulationId: integer("simulation_id").notNull().references(() => simulationsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  totalSteps: integer("total_steps").notNull().default(0),
  passedSteps: integer("passed_steps").notNull().default(0),
  failedSteps: integer("failed_steps").notNull().default(0),
  durationMs: integer("duration_ms"),
  headedMode: boolean("headed_mode").notNull().default(false),
  videoPath: text("video_path"),
  stepResults: jsonb("step_results").$type<Array<{
    stepOrder: number;
    stepName: string;
    status: string;
    durationMs: number;
    generatedData: Record<string, unknown>;
    errorMessage: string | null;
    screenshot: string | null;
    selectorUsed: string | null;
    actionTaken: string | null;
  }>>(),
  blockchainScanResult: jsonb("blockchain_scan_result").$type<{
    chain: string;
    chainName: string;
    address: string;
    accountType: "contract" | "wallet" | "unknown";
    balance: string | null;
    balanceRaw: string | null;
    isActive: boolean;
    dataSize: number | null;
    executable: boolean | null;
    owner: string | null;
    bytecodeHash: string | null;
    isPda: boolean | null;
    isNativeProgram: boolean | null;
    explorerUrl: string;
    quantumRoadmap: {
      status: string;
      details: string;
      reference: string | null;
    };
    scannedAt: string;
    error: string | null;
  }>(),
  quantumScanResult: jsonb("quantum_scan_result").$type<{
    quantumSafe: boolean;
    tlsVersion: string | null;
    keyExchange: string | null;
    cipherSuite: string | null;
    certSignatureAlgorithm: string | null;
    findings: Array<{
      field: string;
      detectedValue: string;
      severity: "info" | "warning" | "critical";
      explanation: string;
    }>;
    scannedAt: string;
    error: string | null;
  }>(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertSimulationRunSchema = createInsertSchema(simulationRunsTable).omit({
  id: true,
  startedAt: true,
});
export type InsertSimulationRun = z.infer<typeof insertSimulationRunSchema>;
export type SimulationRun = typeof simulationRunsTable.$inferSelect;
