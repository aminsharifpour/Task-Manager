ALTER TABLE "HrProfile" ADD COLUMN "salaryCurrency" TEXT;
ALTER TABLE "AccountingTransaction" ADD COLUMN "currency" TEXT;
ALTER TABLE "AccountingBudget" ADD COLUMN "currency" TEXT;
ALTER TABLE "AccountingBudgetHistory" ADD COLUMN "currency" TEXT;
-- Legacy units stay NULL until explicitly mapped; no currency is guessed.
ALTER TABLE "HrProfile" ADD CONSTRAINT "HrProfile_salary_currency" CHECK ("salaryCurrency" IS NULL OR "salaryCurrency" IN ('IRR','IRT','USD','EUR'));
ALTER TABLE "AccountingTransaction" ADD CONSTRAINT "AccountingTransaction_currency" CHECK ("currency" IS NULL OR "currency" IN ('IRR','IRT','USD','EUR'));
ALTER TABLE "AccountingBudget" ADD CONSTRAINT "AccountingBudget_currency" CHECK ("currency" IS NULL OR "currency" IN ('IRR','IRT','USD','EUR'));
ALTER TABLE "AccountingBudgetHistory" ADD CONSTRAINT "AccountingBudgetHistory_currency" CHECK ("currency" IS NULL OR "currency" IN ('IRR','IRT','USD','EUR'));
