ALTER TABLE "Organization"
  ADD COLUMN "invoiceDueDays" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN "defaultVatRate" DECIMAL(5,2) NOT NULL DEFAULT 21,
  ADD COLUMN "invoiceNumberPrefix" TEXT NOT NULL DEFAULT 'NAV',
  ADD COLUMN "invoiceSequence" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_invoiceDueDays_check" CHECK ("invoiceDueDays" BETWEEN 1 AND 365),
  ADD CONSTRAINT "Organization_defaultVatRate_check" CHECK ("defaultVatRate" BETWEEN 0 AND 100),
  ADD CONSTRAINT "Organization_invoiceNumberPrefix_check" CHECK ("invoiceNumberPrefix" ~ '^[A-Z0-9-]{1,12}$'),
  ADD CONSTRAINT "Organization_invoiceSequence_check" CHECK ("invoiceSequence" >= 0);

ALTER TABLE "ClientInvoice"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'CZK',
  ADD COLUMN "recipientEmail" TEXT,
  ADD COLUMN "supplierSnapshot" JSONB,
  ADD COLUMN "customerSnapshot" JSONB;

ALTER TABLE "ClientInvoice"
  ADD CONSTRAINT "ClientInvoice_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
