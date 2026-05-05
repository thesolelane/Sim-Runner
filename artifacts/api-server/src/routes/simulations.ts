import { Router, type IRouter } from "express";
import { eq, desc, avg, count, sql } from "drizzle-orm";
import { db, simulationsTable, simulationRunsTable } from "@workspace/db";
import {
  ScanUrlBody,
  CreateSimulationBody,
  UpdateSimulationBody,
  GetSimulationParams,
  UpdateSimulationParams,
  DeleteSimulationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function generateFakeData(fields: string[]): Record<string, unknown> {
  const fakeValues: Record<string, unknown> = {};
  for (const field of fields) {
    const f = field.toLowerCase();
    if (f.includes("email")) fakeValues[field] = `testuser_${Date.now()}@example.com`;
    else if (f.includes("password")) fakeValues[field] = "Sim@12345!";
    else if (f.includes("name") && f.includes("first")) fakeValues[field] = "Alex";
    else if (f.includes("name") && f.includes("last")) fakeValues[field] = "Simrunner";
    else if (f.includes("name")) fakeValues[field] = "Alex Simrunner";
    else if (f.includes("phone")) fakeValues[field] = "+1-555-000-1234";
    else if (f.includes("dob") || f.includes("birth")) fakeValues[field] = "1990-06-15";
    else if (f.includes("username")) fakeValues[field] = `user_${Date.now()}`;
    else if (f.includes("zip") || f.includes("postal")) fakeValues[field] = "10001";
    else if (f.includes("city")) fakeValues[field] = "New York";
    else if (f.includes("country")) fakeValues[field] = "United States";
    else if (f.includes("address")) fakeValues[field] = "123 Test Street";
    else fakeValues[field] = `test_${field}_value`;
  }
  return fakeValues;
}

async function detectStepsFromUrl(url: string, appName: string) {
  const detected: Array<{
    order: number;
    name: string;
    description: string;
    fields: string[];
    stepType: string;
  }> = [];

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Cooperanth-Sim-Runner/1.0 (flow-scanner)" },
      signal: AbortSignal.timeout(8000),
    });

    const html = await response.text();
    const lower = html.toLowerCase();

    const patterns = [
      { name: "Account Creation", keywords: ["create account", "sign up", "register", "get started"], fields: ["Email", "Password", "Confirm Password"], stepType: "form" },
      { name: "Email Verification", keywords: ["verify email", "confirm email", "check your email", "verification code"], fields: ["Verification Code"], stepType: "verification" },
      { name: "Profile Setup", keywords: ["profile", "about you", "personal info", "first name", "last name"], fields: ["First Name", "Last Name", "Username"], stepType: "form" },
      { name: "Phone Verification", keywords: ["phone", "mobile", "sms", "text message"], fields: ["Phone Number", "SMS Code"], stepType: "verification" },
      { name: "Plan Selection", keywords: ["plan", "pricing", "subscription", "choose your", "select a plan"], fields: ["Selected Plan"], stepType: "selection" },
      { name: "Payment Details", keywords: ["payment", "billing", "credit card", "card number"], fields: ["Card Number", "Expiry", "CVV", "Billing Address"], stepType: "form" },
      { name: "Permissions & Consent", keywords: ["terms", "privacy", "agree", "consent", "cookie"], fields: ["Terms Accepted"], stepType: "consent" },
      { name: "App Configuration", keywords: ["configure", "customize", "set up", "preferences", "workspace"], fields: ["App Name", "Industry", "Team Size"], stepType: "form" },
      { name: "Invite Team", keywords: ["invite", "team member", "collaborator", "add member"], fields: ["Invitee Email"], stepType: "form" },
      { name: "Completion", keywords: ["welcome", "all set", "you're ready", "get started", "dashboard"], fields: [], stepType: "confirmation" },
    ];

    let order = 1;
    for (const pattern of patterns) {
      if (pattern.keywords.some((kw) => lower.includes(kw))) {
        detected.push({ order: order++, ...pattern });
      }
    }

    if (detected.length === 0) {
      detected.push(
        { order: 1, name: "Account Creation", description: "User provides credentials to create an account", fields: ["Email", "Password"], stepType: "form" },
        { order: 2, name: "Profile Setup", description: "User fills in their profile details", fields: ["First Name", "Last Name"], stepType: "form" },
        { order: 3, name: "Completion", description: "Onboarding complete — user lands on the main app", fields: [], stepType: "confirmation" },
      );
    }
  } catch {
    detected.push(
      { order: 1, name: "Account Creation", description: "User provides credentials to create an account", fields: ["Email", "Password"], stepType: "form" },
      { order: 2, name: "Profile Setup", description: "User fills in their profile details", fields: ["First Name", "Last Name"], stepType: "form" },
      { order: 3, name: "Completion", description: "Onboarding complete — user lands on the main app", fields: [], stepType: "confirmation" },
    );
  }

  return { appName, url, detectedSteps: detected, confidence: detected.length > 3 ? "high" : "medium" };
}

router.post("/simulations/scan", async (req, res): Promise<void> => {
  const parsed = ScanUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await detectStepsFromUrl(parsed.data.url, parsed.data.appName);
  res.json(result);
});

router.get("/simulations/stats", async (req, res): Promise<void> => {
  const totalSims = await db.select({ count: count() }).from(simulationsTable);
  const totalRunsResult = await db.select({ count: count() }).from(simulationRunsTable);
  const passedRunsResult = await db
    .select({ count: count() })
    .from(simulationRunsTable)
    .where(eq(simulationRunsTable.status, "passed"));
  const avgDurationResult = await db
    .select({ avg: avg(simulationRunsTable.durationMs) })
    .from(simulationRunsTable)
    .where(eq(simulationRunsTable.status, "passed"));
  const recentRuns = await db
    .select()
    .from(simulationRunsTable)
    .orderBy(desc(simulationRunsTable.startedAt))
    .limit(5);

  const totalRunsCount = totalRunsResult[0]?.count ?? 0;
  const passedCount = passedRunsResult[0]?.count ?? 0;
  const passRate = Number(totalRunsCount) > 0 ? Number(passedCount) / Number(totalRunsCount) : 0;

  res.json({
    totalSimulations: Number(totalSims[0]?.count ?? 0),
    totalRuns: Number(totalRunsCount),
    passRate,
    avgDurationMs: avgDurationResult[0]?.avg ? Number(avgDurationResult[0].avg) : null,
    recentRuns: recentRuns.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    })),
  });
});

router.get("/simulations", async (req, res): Promise<void> => {
  const simulations = await db
    .select()
    .from(simulationsTable)
    .orderBy(desc(simulationsTable.createdAt));

  res.json(
    simulations.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
    })),
  );
});

router.post("/simulations", async (req, res): Promise<void> => {
  const parsed = CreateSimulationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [simulation] = await db
    .insert(simulationsTable)
    .values({
      name: parsed.data.name,
      appName: parsed.data.appName,
      appUrl: parsed.data.appUrl,
      appType: parsed.data.appType,
      steps: parsed.data.steps,
    })
    .returning();

  res.status(201).json({
    ...simulation,
    createdAt: simulation.createdAt.toISOString(),
    updatedAt: simulation.updatedAt.toISOString(),
    lastRunAt: simulation.lastRunAt ? simulation.lastRunAt.toISOString() : null,
  });
});

router.get("/simulations/:id", async (req, res): Promise<void> => {
  const params = GetSimulationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [simulation] = await db
    .select()
    .from(simulationsTable)
    .where(eq(simulationsTable.id, params.data.id));

  if (!simulation) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }

  res.json({
    ...simulation,
    createdAt: simulation.createdAt.toISOString(),
    updatedAt: simulation.updatedAt.toISOString(),
    lastRunAt: simulation.lastRunAt ? simulation.lastRunAt.toISOString() : null,
  });
});

router.patch("/simulations/:id", async (req, res): Promise<void> => {
  const params = UpdateSimulationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSimulationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof simulationsTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.appName !== undefined) updateData.appName = parsed.data.appName;
  if (parsed.data.appUrl !== undefined) updateData.appUrl = parsed.data.appUrl;
  if (parsed.data.appType !== undefined) updateData.appType = parsed.data.appType;
  if (parsed.data.steps !== undefined) updateData.steps = parsed.data.steps;

  const [simulation] = await db
    .update(simulationsTable)
    .set(updateData)
    .where(eq(simulationsTable.id, params.data.id))
    .returning();

  if (!simulation) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }

  res.json({
    ...simulation,
    createdAt: simulation.createdAt.toISOString(),
    updatedAt: simulation.updatedAt.toISOString(),
    lastRunAt: simulation.lastRunAt ? simulation.lastRunAt.toISOString() : null,
  });
});

router.delete("/simulations/:id", async (req, res): Promise<void> => {
  const params = DeleteSimulationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [simulation] = await db
    .delete(simulationsTable)
    .where(eq(simulationsTable.id, params.data.id))
    .returning();

  if (!simulation) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/simulations/:id/runs", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid simulation ID" });
    return;
  }

  const runs = await db
    .select()
    .from(simulationRunsTable)
    .where(eq(simulationRunsTable.simulationId, id))
    .orderBy(desc(simulationRunsTable.startedAt));

  res.json(
    runs.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    })),
  );
});

router.post("/simulations/:id/runs", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid simulation ID" });
    return;
  }

  const [simulation] = await db
    .select()
    .from(simulationsTable)
    .where(eq(simulationsTable.id, id));

  if (!simulation) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }

  const steps = simulation.steps as Array<{
    order: number;
    name: string;
    description: string;
    fields: string[];
    stepType: string;
  }>;

  const runStart = Date.now();
  const stepResults = [];
  let passedSteps = 0;
  let failedSteps = 0;

  for (const step of steps) {
    const stepStart = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 600));
    const stepDuration = Date.now() - stepStart;
    const passed = step.stepType === "confirmation" || Math.random() > 0.15;

    if (passed) passedSteps++;
    else failedSteps++;

    stepResults.push({
      stepOrder: step.order,
      stepName: step.name,
      status: passed ? "passed" : "failed",
      durationMs: stepDuration,
      generatedData: generateFakeData(step.fields),
      errorMessage: passed ? null : `Simulated failure: form validation error on ${step.name}`,
    });
  }

  const totalDuration = Date.now() - runStart;
  const overallStatus = failedSteps === 0 ? "passed" : passedSteps === 0 ? "failed" : "partial";

  const [run] = await db
    .insert(simulationRunsTable)
    .values({
      simulationId: id,
      status: overallStatus,
      totalSteps: steps.length,
      passedSteps,
      failedSteps,
      durationMs: totalDuration,
      stepResults,
      completedAt: new Date(),
    })
    .returning();

  await db
    .update(simulationsTable)
    .set({
      totalRuns: sql`${simulationsTable.totalRuns} + 1`,
      lastRunStatus: overallStatus,
      lastRunAt: new Date(),
    })
    .where(eq(simulationsTable.id, id));

  res.status(201).json({
    ...run,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
  });
});

router.get("/simulations/:id/runs/:runId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawRunId = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;
  const id = parseInt(rawId, 10);
  const runId = parseInt(rawRunId, 10);

  if (isNaN(id) || isNaN(runId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [run] = await db
    .select()
    .from(simulationRunsTable)
    .where(eq(simulationRunsTable.id, runId));

  if (!run || run.simulationId !== id) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  res.json({
    ...run,
    stepResults: run.stepResults ?? [],
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
  });
});

export default router;
