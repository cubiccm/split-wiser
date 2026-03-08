import { relations } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
  credentials: many(passkeyCredentials),
}));

export const passkeyCredentials = sqliteTable("passkey_credentials", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: text("transports"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const passkeyCredentialsRelations = relations(
  passkeyCredentials,
  ({ one }) => ({
    user: one(users, {
      fields: [passkeyCredentials.userId],
      references: [users.id],
    }),
  }),
);

export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(members),
  expenses: many(expenses),
}));

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
});

export const membersRelations = relations(members, ({ one, many }) => ({
  group: one(groups, {
    fields: [members.groupId],
    references: [groups.id],
  }),
  paidExpenses: many(expenses),
  splits: many(expenseSplits),
}));

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  paidById: integer("paid_by_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  paidBy: one(members, {
    fields: [expenses.paidById],
    references: [members.id],
  }),
  group: one(groups, {
    fields: [expenses.groupId],
    references: [groups.id],
  }),
  splits: many(expenseSplits),
}));

export const expenseSplits = sqliteTable("expense_splits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id")
    .notNull()
    .references(() => expenses.id, { onDelete: "cascade" }),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
});

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.id],
  }),
  member: one(members, {
    fields: [expenseSplits.memberId],
    references: [members.id],
  }),
}));
