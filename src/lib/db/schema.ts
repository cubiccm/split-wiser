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
  createdExpenses: many(expenses),
  paidExpenses: many(expensePayers),
  expenseSplits: many(expenseSplits),
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

// ── Expenses ──────────────────────────────────────────────────────────

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  originalAmount: real("original_amount"),
  cashbackRate: real("cashback_rate").notNull().default(0),
  type: text("type", { enum: ["expense", "settlement", "auto_settlement"] })
    .notNull()
    .default("expense"),
  createdById: integer("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  voidedAt: integer("voided_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [expenses.createdById],
    references: [users.id],
  }),
  payers: many(expensePayers),
  splits: many(expenseSplits),
  debts: many(expenseDebts),
}));

export const expensePayers = sqliteTable("expense_payers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id")
    .notNull()
    .references(() => expenses.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
});

export const expensePayersRelations = relations(expensePayers, ({ one }) => ({
  expense: one(expenses, {
    fields: [expensePayers.expenseId],
    references: [expenses.id],
  }),
  user: one(users, {
    fields: [expensePayers.userId],
    references: [users.id],
  }),
}));

export const expenseSplits = sqliteTable("expense_splits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id")
    .notNull()
    .references(() => expenses.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
});

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.id],
  }),
  user: one(users, {
    fields: [expenseSplits.userId],
    references: [users.id],
  }),
}));

// ── Expense Debts (resolved "who owes whom" per expense) ─────────────

export const expenseDebts = sqliteTable("expense_debts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id")
    .notNull()
    .references(() => expenses.id, { onDelete: "cascade" }),
  fromUserId: integer("from_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  toUserId: integer("to_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
});

export const expenseDebtsRelations = relations(expenseDebts, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseDebts.expenseId],
    references: [expenses.id],
  }),
  fromUser: one(users, {
    fields: [expenseDebts.fromUserId],
    references: [users.id],
    relationName: "debtsOwed",
  }),
  toUser: one(users, {
    fields: [expenseDebts.toUserId],
    references: [users.id],
    relationName: "debtsOwedTo",
  }),
}));
