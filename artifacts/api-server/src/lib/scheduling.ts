import cron, { type ScheduledTask } from "node-cron";
import { db, simulationsTable, simulationRunsTable } from "@workspace/db";
import { eq, isNotNull, sql } from "drizzle-orm";
import { runSimulation } from "./engine";
import { checkAndSendAlert } from "./alerting";
import { logger } from "./logger";

const scheduledTasks = new Map<number, ScheduledTask>();

async function executeScheduledRun(simulationId: number): Promise<void> {
  const [simulation] = await db
    .select()
    .from(simulationsTable)
    .where(eq(simulationsTable.id, simulationId));

  if (!simulation) {
    logger.warn({ simulationId }, "Scheduled simulation not found, skipping");
    return;
  }

  logger.info({ simulationId, name: simulation.name }, "Executing scheduled run");

  const steps = simulation.steps as Array<{
    order: number;
    name: string;
    description: string;
    fields: string[];
    stepType: string;
    selector?: string;
    actionType?: string;
    confidence?: string;
  }>;

  const runStart = Date.now();
  let stepResults: Array<{
    stepOrder: number;
    stepName: string;
    status: string;
    durationMs: number;
    generatedData: Record<string, unknown>;
    errorMessage: string | null;
    screenshot: string | null;
    selectorUsed: string | null;
    actionTaken: string | null;
  }>;
  let videoPath: string | null = null;

  try {
    const runResult = await runSimulation(simulation.appUrl, steps, {
      headedMode: false,
      timeoutMs: 15000,
    });
    stepResults = runResult.stepResults;
    videoPath = runResult.videoPath;
  } catch (err) {
    logger.error({ err, simulationId }, "Scheduled engine run failed");
    stepResults = steps.map((step) => ({
      stepOrder: step.order,
      stepName: step.name,
      status: "failed",
      durationMs: 0,
      generatedData: {},
      errorMessage: `Engine error: ${err instanceof Error ? err.message : String(err)}`,
      screenshot: null,
      selectorUsed: null,
      actionTaken: null,
    }));
  }

  const passedSteps = stepResults.filter((s) => s.status === "passed").length;
  const failedSteps = stepResults.filter((s) => s.status === "failed").length;
  const totalDuration = Date.now() - runStart;
  const overallStatus = failedSteps === 0 ? "passed" : passedSteps === 0 ? "failed" : "partial";

  await db
    .insert(simulationRunsTable)
    .values({
      simulationId,
      status: overallStatus,
      totalSteps: steps.length,
      passedSteps,
      failedSteps,
      durationMs: totalDuration,
      headedMode: false,
      videoPath,
      stepResults,
      completedAt: new Date(),
    });

  await db
    .update(simulationsTable)
    .set({
      totalRuns: sql`${simulationsTable.totalRuns} + 1`,
      lastRunStatus: overallStatus,
      lastRunAt: new Date(),
    })
    .where(eq(simulationsTable.id, simulationId));

  const passRate = steps.length > 0 ? passedSteps / steps.length : 0;
  await checkAndSendAlert(simulationId, simulation.name, passRate);

  logger.info({ simulationId, overallStatus, passedSteps, failedSteps }, "Scheduled run complete");
}

export function registerSchedule(simulationId: number, cronExpr: string): void {
  unregisterSchedule(simulationId);

  if (!cron.validate(cronExpr)) {
    logger.warn({ simulationId, cronExpr }, "Invalid cron expression, not scheduling");
    return;
  }

  const task = cron.schedule(cronExpr, () => {
    executeScheduledRun(simulationId).catch((err) => {
      logger.error({ err, simulationId }, "Unhandled error in scheduled run");
    });
  });

  scheduledTasks.set(simulationId, task);
  logger.info({ simulationId, cronExpr }, "Schedule registered");
}

export function unregisterSchedule(simulationId: number): void {
  const existing = scheduledTasks.get(simulationId);
  if (existing) {
    existing.stop();
    scheduledTasks.delete(simulationId);
    logger.info({ simulationId }, "Schedule unregistered");
  }
}

export async function initializeSchedules(): Promise<void> {
  const simulations = await db
    .select({ id: simulationsTable.id, schedule: simulationsTable.schedule })
    .from(simulationsTable)
    .where(isNotNull(simulationsTable.schedule));

  for (const sim of simulations) {
    if (sim.schedule) {
      registerSchedule(sim.id, sim.schedule);
    }
  }

  logger.info({ count: simulations.length }, "Schedules initialized");
}
