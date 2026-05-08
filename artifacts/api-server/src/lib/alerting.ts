import nodemailer from "nodemailer";
import { db, simulationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

type QuantumStatus = "safe" | "unsafe";

const ALERT_DEBOUNCE_MS = 60 * 60 * 1000;

function isSlackUrl(destination: string): boolean {
  return destination.startsWith("https://hooks.slack.com/");
}

async function sendSlackAlert(webhookUrl: string, simulationName: string, passRate: number, threshold: number, customMessage?: string | null): Promise<boolean> {
  const percentage = Math.round(passRate * 100);
  const mainText = `🚨 *Cooperanth Alert: ${simulationName}*\nPass rate dropped to *${percentage}%* (threshold: ${threshold}%)`;
  const fullText = customMessage ? `${mainText}\n\n${customMessage}` : mainText;

  const fallbackText = customMessage
    ? `*Alert: ${simulationName}* — Pass rate dropped to ${percentage}% (threshold: ${threshold}%)\n\n${customMessage}`
    : `*Alert: ${simulationName}* — Pass rate dropped to ${percentage}% (threshold: ${threshold}%)`;

  const body = JSON.stringify({
    text: fallbackText,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: fullText,
        },
      },
    ],
  });

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status}`);
  }
  return true;
}

async function sendEmailAlert(to: string, simulationName: string, passRate: number, threshold: number, customMessage?: string | null): Promise<boolean> {
  const smtpUrl = process.env["SMTP_URL"];
  if (!smtpUrl) {
    logger.warn("SMTP_URL not set — skipping email alert");
    return false;
  }

  const transporter = nodemailer.createTransport(smtpUrl);
  const percentage = Math.round(passRate * 100);

  const textBody = [
    `Alert: Simulation "${simulationName}" pass rate dropped to ${percentage}% (threshold: ${threshold}%). Check your Cooperanth dashboard for details.`,
    customMessage ? `\n${customMessage}` : null,
  ].filter(Boolean).join("\n");

  const htmlBody = [
    `<p><strong>Alert: Simulation "${simulationName}"</strong></p><p>Pass rate dropped to <strong>${percentage}%</strong> (threshold: ${threshold}%).</p><p>Check your Cooperanth dashboard for details.</p>`,
    customMessage ? `<p>${customMessage}</p>` : null,
  ].filter(Boolean).join("");

  await transporter.sendMail({
    from: process.env["ALERT_FROM_EMAIL"] ?? "alerts@cooperanth.io",
    to,
    subject: `[Cooperanth] Alert: ${simulationName} pass rate at ${percentage}%`,
    text: textBody,
    html: htmlBody,
  });
  return true;
}

export async function sendTestAlert(
  destination: string,
  simulationName: string,
  customMessage?: string | null,
): Promise<{ destinationType: "slack" | "email" }> {
  if (isSlackUrl(destination)) {
    await sendSlackAlert(destination, simulationName, 0.75, 80, customMessage);
    return { destinationType: "slack" };
  } else {
    const dispatched = await sendEmailAlert(destination, simulationName, 0.75, 80, customMessage);
    if (!dispatched) {
      throw new Error("Email could not be sent: SMTP_URL is not configured on this server");
    }
    return { destinationType: "email" };
  }
}

async function sendSlackQuantumAlert(
  webhookUrl: string,
  simulationName: string,
  keyExchange: string | null,
  tlsVersion: string | null,
  runUrl: string,
): Promise<boolean> {
  const keText = keyExchange ?? "unknown";
  const tlsText = tlsVersion ?? "unknown";
  const mainText = `🔐 *Cooperanth Quantum Security Alert: ${simulationName}*\nQuantum security posture has regressed to *Unsafe*.\n• Key Exchange: *${keText}*\n• TLS Version: *${tlsText}*\n<${runUrl}|View run report>`;

  const body = JSON.stringify({
    text: `Quantum security alert: ${simulationName} — posture regressed to Unsafe (key exchange: ${keText}, TLS: ${tlsText}). ${runUrl}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: mainText,
        },
      },
    ],
  });

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status}`);
  }
  return true;
}

async function sendEmailQuantumAlert(
  to: string,
  simulationName: string,
  keyExchange: string | null,
  tlsVersion: string | null,
  runUrl: string,
): Promise<boolean> {
  const smtpUrl = process.env["SMTP_URL"];
  if (!smtpUrl) {
    logger.warn("SMTP_URL not set — skipping quantum email alert");
    return false;
  }

  const transporter = nodemailer.createTransport(smtpUrl);
  const keText = keyExchange ?? "unknown";
  const tlsText = tlsVersion ?? "unknown";

  const textBody = `Quantum Security Alert: Simulation "${simulationName}" posture has regressed to Unsafe.\n\nKey Exchange: ${keText}\nTLS Version: ${tlsText}\n\nView run report: ${runUrl}`;
  const htmlBody = `<p><strong>Quantum Security Alert: Simulation "${simulationName}"</strong></p><p>The quantum security posture has regressed to <strong>Unsafe</strong>.</p><ul><li>Key Exchange: <strong>${keText}</strong></li><li>TLS Version: <strong>${tlsText}</strong></li></ul><p><a href="${runUrl}">View run report</a></p>`;

  await transporter.sendMail({
    from: process.env["ALERT_FROM_EMAIL"] ?? "alerts@cooperanth.io",
    to,
    subject: `[Cooperanth] Quantum Security Alert: ${simulationName}`,
    text: textBody,
    html: htmlBody,
  });
  return true;
}

export async function checkAndSendQuantumAlert(
  simulationId: number,
  simulationName: string,
  currentScan: { quantumSafe: boolean; keyExchange: string | null; tlsVersion: string | null } | null,
  previousQuantumStatus: string | null,
  runId: number,
  appDomain: string,
): Promise<void> {
  if (!currentScan) return;

  const [sim] = await db
    .select({
      quantumAlertEnabled: simulationsTable.quantumAlertEnabled,
      alertDestination: simulationsTable.alertDestination,
    })
    .from(simulationsTable)
    .where(eq(simulationsTable.id, simulationId));

  if (!sim || !sim.quantumAlertEnabled || !sim.alertDestination) {
    return;
  }

  const currentStatus: QuantumStatus = currentScan.quantumSafe ? "safe" : "unsafe";
  const previousStatus = previousQuantumStatus as QuantumStatus | null;

  if (previousStatus !== "safe" || currentStatus !== "unsafe") {
    return;
  }

  const runUrl = `${appDomain}/simulations/${simulationId}/runs/${runId}`;
  const destination = sim.alertDestination;

  try {
    const dispatched = isSlackUrl(destination)
      ? await sendSlackQuantumAlert(destination, simulationName, currentScan.keyExchange, currentScan.tlsVersion, runUrl)
      : await sendEmailQuantumAlert(destination, simulationName, currentScan.keyExchange, currentScan.tlsVersion, runUrl);

    if (dispatched) {
      logger.info({ simulationId, runId, destination }, "Quantum security alert sent");
    }
  } catch (err) {
    logger.error({ err, simulationId }, "Failed to send quantum security alert");
  }
}

export async function checkAndSendAlert(
  simulationId: number,
  simulationName: string,
  passRate: number,
): Promise<void> {
  const [sim] = await db
    .select({
      alertThreshold: simulationsTable.alertThreshold,
      alertDestination: simulationsTable.alertDestination,
      alertMessage: simulationsTable.alertMessage,
      lastAlertedAt: simulationsTable.lastAlertedAt,
    })
    .from(simulationsTable)
    .where(eq(simulationsTable.id, simulationId));

  if (!sim || sim.alertThreshold === null || sim.alertDestination === null) {
    return;
  }

  const passRatePct = Math.round(passRate * 100);
  if (passRatePct >= sim.alertThreshold) {
    return;
  }

  if (sim.lastAlertedAt) {
    const elapsed = Date.now() - sim.lastAlertedAt.getTime();
    if (elapsed < ALERT_DEBOUNCE_MS) {
      logger.info({ simulationId, elapsed }, "Alert debounced");
      return;
    }
  }

  const destination = sim.alertDestination;
  const threshold = sim.alertThreshold;
  const customMessage = sim.alertMessage ?? null;

  try {
    const dispatched = isSlackUrl(destination)
      ? await sendSlackAlert(destination, simulationName, passRate, threshold, customMessage)
      : await sendEmailAlert(destination, simulationName, passRate, threshold, customMessage);

    if (dispatched) {
      await db
        .update(simulationsTable)
        .set({ lastAlertedAt: new Date() })
        .where(eq(simulationsTable.id, simulationId));

      logger.info({ simulationId, destination, passRatePct }, "Alert sent");
    }
  } catch (err) {
    logger.error({ err, simulationId }, "Failed to send alert");
  }
}
