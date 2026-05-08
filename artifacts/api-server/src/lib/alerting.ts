import nodemailer from "nodemailer";
import { db, simulationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

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
