const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- EXECUTING COMPLETE PURGE OF ALL TEST ORDERS & DEPENDENCIES ---');

  // Candidate Points & Routes
  const delCandidates = await prisma.navigationCandidatePoint.deleteMany({});
  console.log(`Deleted Candidate Points: ${delCandidates.count}`);

  const delRoutes = await prisma.surveyRoute.deleteMany({});
  console.log(`Deleted Survey Routes: ${delRoutes.count}`);

  // Navigation Points & Billing Periods
  const delNavPoints = await prisma.navigationPoint.deleteMany({});
  console.log(`Deleted Navigation Points: ${delNavPoints.count}`);

  const delBilling = await prisma.navigationBillingPeriod.deleteMany({});
  console.log(`Deleted Navigation Billing Periods: ${delBilling.count}`);

  const delNavContracts = await prisma.navigationContract.deleteMany({});
  console.log(`Deleted Navigation Contracts: ${delNavContracts.count}`);

  // Work Expenses & Work Entries
  const delWorkExpenses = await prisma.workExpense.deleteMany({});
  console.log(`Deleted Work Expenses: ${delWorkExpenses.count}`);

  const delWorkEntries = await prisma.workEntry.deleteMany({});
  console.log(`Deleted Work Entries: ${delWorkEntries.count}`);

  const delWorkTasks = await prisma.workTask.deleteMany({});
  console.log(`Deleted Work Tasks: ${delWorkTasks.count}`);

  const delWorkRates = await prisma.workOrderRate.deleteMany({});
  console.log(`Deleted Work Order Rates: ${delWorkRates.count}`);

  const delWorkOrders = await prisma.workOrder.deleteMany({});
  console.log(`Deleted Work Orders: ${delWorkOrders.count}`);

  // Navigation Orders
  const delNavOrders = await prisma.navigationOrder.deleteMany({});
  console.log(`Deleted Navigation Orders: ${delNavOrders.count}`);

  // CRM Realizations & CRM Tasks & Audit Logs
  const delCrmRealizations = await prisma.crmRealization.deleteMany({});
  console.log(`Deleted CRM Realizations: ${delCrmRealizations.count}`);

  const delCrmTasks = await prisma.crmTask.deleteMany({});
  console.log(`Deleted CRM Tasks: ${delCrmTasks.count}`);

  const delCrmAuditLogs = await prisma.crmAuditLog.deleteMany({});
  console.log(`Deleted CRM Audit Logs: ${delCrmAuditLogs.count}`);

  const delCrmCommunications = await prisma.clientCommunication.deleteMany({});
  console.log(`Deleted CRM Communications: ${delCrmCommunications.count}`);

  // CRM Orders
  const delCrmOrders = await prisma.crmOrder.deleteMany({});
  console.log(`Deleted CRM Orders: ${delCrmOrders.count}`);

  console.log('\n--- PURGE RESULT SUMMARY ---');
  console.log(`Remaining Navigation Orders: ${await prisma.navigationOrder.count()}`);
  console.log(`Remaining CRM Orders: ${await prisma.crmOrder.count()}`);
  console.log(`Remaining Work Orders: ${await prisma.workOrder.count()}`);
}

main()
  .catch((e) => console.error('Error during purge:', e))
  .finally(() => prisma.$disconnect());
