import Imap from "imap-simple";
import { simpleParser } from "mailparser";
import { logger } from "./logger";

export interface VerificationEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  verificationCode?: string;
  verificationLink?: string;
  receivedAt: Date;
}

export class EmailService {
  private config = {
    host: process.env.MAIL_IMAP_HOST || "mail.cooperanthsr.com",
    port: parseInt(process.env.MAIL_IMAP_PORT || "993"),
    tls: process.env.MAIL_IMAP_TLS !== "false",
    user: process.env.MAIL_IMAP_USER || "simrunner1@cooperanthsr.com",
    password: process.env.MAIL_IMAP_PASSWORD!,
    mailbox: "INBOX",
  };
  
  async waitForVerificationEmail(toAddress: string, timeoutMs = 120000, pollIntervalMs = 5000): Promise<<VerificationEmail | null> {
    const startTime = Date.now();
    logger.info({ toAddress, timeoutMs }, "Waiting for verification email");
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const emails = await this.checkInboxForRecipient(toAddress);
        if (emails.length > 0) {
          const email = emails[emails.length - 1];
          logger.info({ toAddress, code: email.verificationCode, link: email.verificationLink }, "Verification email found");
          return email;
        }
      } catch (err: any) {
        logger.warn({ err: err.message, toAddress }, "Error checking inbox");
      }
      await this.sleep(pollIntervalMs);
    }
    
    logger.warn({ toAddress, timeoutMs }, "Verification email timeout");
    return null;
  }
  
  private async checkInboxForRecipient(toAddress: string): Promise<<VerificationEmail[]> {
    const connection = await Imap.connect({
      imap: { ...this.config, authTimeout: 10000 },
    });
    
    try {
      await connection.openBox(this.config.mailbox);
      const messages = await connection.search(["UNSEEN"], {
        bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", "TEXT"],
        markSeen: true,
      });
      
      const verificationEmails: VerificationEmail[] = [];
      for (const message of messages) {
        const header = message.parts.find((p: any) => p.which === "HEADER.FIELDS (FROM TO SUBJECT DATE)");
        const body = message.parts.find((p: any) => p.which === "TEXT");
        if (!header || !body) continue;
        
        const parsed = await simpleParser(header.body + "\n\n" + body.body);
        const recipients = [parsed.to?.text, parsed.cc?.text].filter(Boolean);
        if (!recipients.some((r: any) => r?.includes(toAddress))) continue;
        
        const email: VerificationEmail = {
          from: parsed.from?.text || "",
          to: toAddress,
          subject: parsed.subject || "",
          body: parsed.text || parsed.html || "",
          receivedAt: parsed.date || new Date(),
        };
        
        const codeMatch = email.body.match(/\b\d{4,8}\b/);
        if (codeMatch) email.verificationCode = codeMatch[0];
        
        const linkMatch = email.body.match(/https?:\/\/[^\s<>"]+(?:verify|confirm|activate|verification)[^\s<>"]*/i);
        if (linkMatch) email.verificationLink = linkMatch[0];
        
        verificationEmails.push(email);
      }
      return verificationEmails;
    } finally {
      connection.end();
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const emailService = new EmailService();
