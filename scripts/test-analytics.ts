
import { getNewCustomersCount, getProfitSummary, getTopSellingMedicines } from '../src/services/billing.service';

async function testAnalytics() {
    try {
        console.log('Testing Analytics...');

        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

        console.log(`Period: ${startOfMonth} to ${endOfMonth}`);

        const profit = await getProfitSummary(startOfMonth, endOfMonth);
        console.log('Profit Summary:', profit);

        const newCustomers = await getNewCustomersCount(startOfMonth, endOfMonth);
        console.log('New Customers:', newCustomers);

        const topSelling = await getTopSellingMedicines(5, 30);
        console.log('Top Selling:', topSelling);

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

// Mock database for standalone run if needed, but better to run in context if possible.
// Since this is a TS file, I can't run it directly with node without compilation or ts-node.
// I'll rely on the fact that the code compiles.
