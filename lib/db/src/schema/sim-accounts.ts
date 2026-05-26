import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { campaignsTable } from "./campaigns";

export const simAccountsTable = pgTable("sim_accounts", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  emailPassword: text("email_password").notNull(),
  phone: text("phone"),
  username: text("username"),
  displayName: text("display_name"),
  password: text("password").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  dateOfBirth: text("date_of_birth"),
  location: jsonb("location").$type<{ city: string; state: string; country: string }>(),
  platformType: text("platform_type").notNull(),
  platformUserId: text("platform_user_id"),
  emailVerified: boolean("email_verified").notNull().default(false),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  idVerified: boolean("id_verified").notNull().default(false),
  proxyType: text("proxy_type"),
  proxyIp: text("proxy_ip"),
  status: text("status").notNull().default("created"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastActionAt: timestamp("last_action_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});
