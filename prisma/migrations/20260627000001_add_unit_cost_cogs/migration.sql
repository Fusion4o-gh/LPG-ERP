-- Add unitCost to StockLedgerEntry for weighted-average COGS computation
ALTER TABLE "StockLedgerEntry" ADD COLUMN     "unitCost" DECIMAL(12,2);

-- Reclassify "Purchase Discount Received" (4001001502) from EXPENSE/DEBIT to REVENUE/CREDIT
UPDATE "ChartAccount"
SET "accountType" = 'REVENUE', "normalBalance" = 'CREDIT'
WHERE "code" = '4001001502';
