import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const proxyPoolsTable = pgTable("proxy_pools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  proxyType: text("proxy_type").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  username: text("username"),
  password: text("password"),
  rotationUrl: text("rotation_url"),
  isActive: boolean("is_active").notNull().default(true),
  lastCheckedAt: timestamp("last_checked_at"),
  failureCount: integer("failure_count").notNull().default(0),
  country: text("country"),
  city: text("city"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});
