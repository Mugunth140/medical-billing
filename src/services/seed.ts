// =====================================================
// MedBill - Database Seeding & Reset Script
// Comprehensive seed data for all screens
// =====================================================

import { execute, initDatabase, query } from './database';

/**
 * Safely delete from a table if it exists
 */
async function safeDelete(tableName: string): Promise<void> {
    try {
        await execute(`DELETE FROM ${tableName}`, []);
    } catch (error) {
        // Table might not exist, that's okay
        console.log(`Skipped clearing ${tableName} (may not exist)`);
    }
}

/**
 * Clear all user data from the database (keep schema and default settings)
 */
export async function clearDatabase(): Promise<void> {
    console.log('Clearing database...');

    await initDatabase();

    // Clear in order respecting foreign keys
    // Use safeDelete for tables that may not exist in runtime schema
    await safeDelete('running_bills');
    await safeDelete('credits');
    await safeDelete('scheduled_medicine_records');
    await safeDelete('sales_return_items');
    await safeDelete('sales_returns');
    await safeDelete('purchase_return_items');
    await safeDelete('purchase_returns');
    await safeDelete('bill_items');
    await safeDelete('bills');
    await safeDelete('purchase_items');
    await safeDelete('purchases');
    await safeDelete('batches');
    await safeDelete('medicines');
    await safeDelete('customers');
    await safeDelete('suppliers');
    await safeDelete('audit_log');

    // Reset bill sequence
    try {
        await execute('UPDATE bill_sequence SET current_number = 0', []);
    } catch (error) {
        console.log('Bill sequence reset skipped');
    }

    // Reset SQLite auto-increment counters so IDs start from 1
    try {
        await execute('DELETE FROM sqlite_sequence', []);
        console.log('Auto-increment counters reset');
    } catch (error) {
        console.log('Sequence reset skipped (table may not exist)');
    }

    // Mark that we've already done the tablet migration (since we're seeding fresh data in tablets)
    try {
        await execute(
            `INSERT OR REPLACE INTO settings (key, value, category, description) VALUES ('tablets_migration_done', 'true', 'system', 'Quantity stored in tablets')`,
            []
        );
    } catch (error) {
        console.log('Settings update skipped');
    }

    console.log('Database cleared successfully!');
}

/**
 * Seed the database with comprehensive sample data
 */
export async function seedDatabase(): Promise<void> {
    console.log('Starting comprehensive database seeding...');

    try {
        await initDatabase();

        // Check if already seeded
        const existingMedicines = await query<{ count: number }>(
            'SELECT COUNT(*) as count FROM medicines',
            []
        );

        if (existingMedicines[0]?.count > 0) {
            console.log('Database already has data. Clear first if you want to reseed.');
            return;
        }

        // Date helpers
        const today = new Date();
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        const addDays = (days: number) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
        const subDays = (days: number) => new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

        // Execute inserts without transaction wrapper to avoid database lock
        // Each section commits independently
        {
            // =========================================
            // SUPPLIERS (40+)
            // =========================================
            console.log('Seeding suppliers...');
            await execute(`
                INSERT INTO suppliers (name, contact_person, phone, email, gstin, address, city, state, payment_terms) VALUES
                ('ABC Pharma Distributors', 'Rajesh Kumar', '9876543210', 'rajesh@abcpharma.com', '33AABCU9603R1ZM', '123 Pharma Street, Vadapalani', 'Chennai', 'Tamil Nadu', 30),
                ('MediCare Wholesale', 'Priya Sharma', '9876543211', 'priya@medicare.in', '33AABCU9603R2ZN', '456 Medical Lane, Guindy', 'Chennai', 'Tamil Nadu', 45),
                ('HealthFirst Supplies', 'Arun Kumar', '9876543212', 'arun@healthfirst.com', '33AABCU9603R3ZO', '789 Health Road', 'Coimbatore', 'Tamil Nadu', 30),
                ('Pharma Traders', 'Suresh B', '9876543213', 'suresh@pharmatraders.com', '33AABCU9603R4ZP', '321 Trade Complex', 'Madurai', 'Tamil Nadu', 60),
                ('Medical Hub', 'Kavitha R', '9876543214', 'kavitha@medhub.in', '33AABCU9603R5ZQ', '654 Hub Plaza', 'Chennai', 'Tamil Nadu', 30),
                ('Apollo Medicals', 'Ramesh S', '9876543215', 'ramesh@apollo.com', '33AABCU9603R6ZR', '100 Apollo Street', 'Chennai', 'Tamil Nadu', 30),
                ('Star Pharmaceuticals', 'Divya M', '9876543216', 'divya@starpharma.com', '33AABCU9603R7ZS', '200 Star Complex', 'Trichy', 'Tamil Nadu', 45),
                ('Global MediLink', 'Vijay K', '9876543217', 'vijay@globalmedi.com', '33AABCU9603R8ZT', '300 Global Tower', 'Salem', 'Tamil Nadu', 30),
                ('City Pharma Supplies', 'Anitha P', '9876543218', 'anitha@citypharma.com', '33AABCU9603R9ZU', '400 City Center', 'Chennai', 'Tamil Nadu', 60),
                ('Prime Medical Traders', 'Kumar R', '9876543219', 'kumar@primetraders.com', '33AABCU9603RAZV', '500 Prime Plaza', 'Chennai', 'Tamil Nadu', 30),
                ('Elite Healthcare Supplies', 'Lakshmi V', '9876543220', 'lakshmi@elitehc.com', '33AABCU9603RBZW', '600 Elite Road', 'Coimbatore', 'Tamil Nadu', 45),
                ('MedPlus Distributors', 'Ganesh B', '9876543221', 'ganesh@medplus.com', '33AABCU9603RCZX', '700 MedPlus Complex', 'Madurai', 'Tamil Nadu', 30),
                ('LifeCare Pharma', 'Meena S', '9876543222', 'meena@lifecare.com', '33AABCU9603RDZY', '800 LifeCare Street', 'Chennai', 'Tamil Nadu', 30),
                ('Wellness Medical Hub', 'Prakash T', '9876543223', 'prakash@wellness.com', '33AABCU9603REZZ', '900 Wellness Plaza', 'Trichy', 'Tamil Nadu', 60),
                ('HealthBridge Suppliers', 'Saranya K', '9876543224', 'saranya@healthbridge.com', '33AABCU9603RFAA', '1000 Bridge Road', 'Salem', 'Tamil Nadu', 30),
                ('Medico Pharmaceuticals', 'Ravi M', '9876543225', 'ravi@medico.com', '33AABCU9603RGAB', '1100 Medico Tower', 'Chennai', 'Tamil Nadu', 45),
                ('Care Plus Distributors', 'Deepa R', '9876543226', 'deepa@careplus.com', '33AABCU9603RHAC', '1200 Care Street', 'Chennai', 'Tamil Nadu', 30),
                ('Supreme Pharma Link', 'Mohan L', '9876543227', 'mohan@supremepharma.com', '33AABCU9603RIAD', '1300 Supreme Complex', 'Coimbatore', 'Tamil Nadu', 30),
                ('Unity Medical Supplies', 'Radha N', '9876543228', 'radha@unitymed.com', '33AABCU9603RJAE', '1400 Unity Plaza', 'Madurai', 'Tamil Nadu', 60),
                ('Mediworld Traders', 'Selvam P', '9876543229', 'selvam@mediworld.com', '33AABCU9603RKAF', '1500 Mediworld Road', 'Chennai', 'Tamil Nadu', 30),
                ('Vertex Healthcare', 'Nisha K', '9876543230', 'nisha@vertex.com', '33AABCU9603RLAG', '1600 Vertex Street', 'Trichy', 'Tamil Nadu', 45),
                ('Medlink Distributors', 'Senthil R', '9876543231', 'senthil@medlink.com', '33AABCU9603RMAH', '1700 Medlink Complex', 'Salem', 'Tamil Nadu', 30),
                ('ProHealth Suppliers', 'Vani S', '9876543232', 'vani@prohealth.com', '33AABCU9603RNAI', '1800 ProHealth Plaza', 'Chennai', 'Tamil Nadu', 30),
                ('Apex Pharma Hub', 'Babu T', '9876543233', 'babu@apexpharma.com', '33AABCU9603ROAJ', '1900 Apex Tower', 'Chennai', 'Tamil Nadu', 60),
                ('Premier Medical Link', 'Geetha M', '9876543234', 'geetha@premiermed.com', '33AABCU9603RPAK', '2000 Premier Road', 'Coimbatore', 'Tamil Nadu', 30),
                ('NextGen Pharma', 'Karthik V', '9876543235', 'karthik@nextgen.com', '33AABCU9603RQAL', '2100 NextGen Street', 'Madurai', 'Tamil Nadu', 45),
                ('MaxCare Supplies', 'Priya L', '9876543236', 'priya2@maxcare.com', '33AABCU9603RRAM', '2200 MaxCare Complex', 'Chennai', 'Tamil Nadu', 30),
                ('Sunrise Medical Traders', 'Arjun K', '9876543237', 'arjun@sunrise.com', '33AABCU9603RSAN', '2300 Sunrise Plaza', 'Trichy', 'Tamil Nadu', 30),
                ('Quantum Healthcare', 'Swathi R', '9876543238', 'swathi@quantum.com', '33AABCU9603RTAO', '2400 Quantum Road', 'Salem', 'Tamil Nadu', 60),
                ('MegaMed Distributors', 'Naveen M', '9876543239', 'naveen@megamed.com', '33AABCU9603RUAP', '2500 MegaMed Street', 'Chennai', 'Tamil Nadu', 30),
                ('Alpha Pharma Traders', 'Rekha S', '9876543240', 'rekha@alphapharma.com', '33AABCU9603RVAQ', '2600 Alpha Complex', 'Chennai', 'Tamil Nadu', 45),
                ('Beta Medical Hub', 'Arun P', '9876543241', 'arun2@betamed.com', '33AABCU9603RWAR', '2700 Beta Plaza', 'Coimbatore', 'Tamil Nadu', 30),
                ('Gamma Healthcare Link', 'Mythili K', '9876543242', 'mythili@gamma.com', '33AABCU9603RXAS', '2800 Gamma Tower', 'Madurai', 'Tamil Nadu', 30),
                ('Delta Pharma Supplies', 'Venkat R', '9876543243', 'venkat@delta.com', '33AABCU9603RYAT', '2900 Delta Road', 'Chennai', 'Tamil Nadu', 60),
                ('Omega Medical Traders', 'Janaki M', '9876543244', 'janaki@omega.com', '33AABCU9603RZAU', '3000 Omega Street', 'Trichy', 'Tamil Nadu', 30),
                ('Zeta Healthcare Hub', 'Rajan S', '9876543245', 'rajan@zeta.com', '33AABCU9603SAAV', '3100 Zeta Complex', 'Salem', 'Tamil Nadu', 45),
                ('Sigma Pharma Link', 'Padma V', '9876543246', 'padma@sigma.com', '33AABCU9603SBAW', '3200 Sigma Plaza', 'Chennai', 'Tamil Nadu', 30),
                ('Theta Medical Supplies', 'Siva K', '9876543247', 'siva@theta.com', '33AABCU9603SCAX', '3300 Theta Road', 'Chennai', 'Tamil Nadu', 30),
                ('Kappa Healthcare', 'Uma R', '9876543248', 'uma@kappa.com', '33AABCU9603SDAY', '3400 Kappa Street', 'Coimbatore', 'Tamil Nadu', 60),
                ('Lambda Pharma Hub', 'Krishna M', '9876543249', 'krishna@lambda.com', '33AABCU9603SEAZ', '3500 Lambda Complex', 'Madurai', 'Tamil Nadu', 30),
                ('Nova Medical Traders', 'Vijaya S', '9876543250', 'vijaya@nova.com', '33AABCU9603SFBA', '3600 Nova Plaza', 'Chennai', 'Tamil Nadu', 45),
                ('Zenith Healthcare Link', 'Bala K', '9876543251', 'bala@zenith.com', '33AABCU9603SGBB', '3700 Zenith Tower', 'Trichy', 'Tamil Nadu', 30),
                ('Pulse Pharma Supplies', 'Mala R', '9876543252', 'mala@pulse.com', '33AABCU9603SHBC', '3800 Pulse Road', 'Salem', 'Tamil Nadu', 30),
                ('Vital Medical Hub', 'Gopal V', '9876543253', 'gopal@vital.com', '33AABCU9603SIBD', '3900 Vital Street', 'Chennai', 'Tamil Nadu', 60),
                ('Core Healthcare Traders', 'Indira M', '9876543254', 'indira@core.com', '33AABCU9603SJBE', '4000 Core Complex', 'Chennai', 'Tamil Nadu', 30)
            `, []);

            // =========================================
            // MEDICINES (60+)
            // =========================================
            console.log('Seeding medicines...');
            await execute(`
                INSERT INTO medicines (name, generic_name, manufacturer, hsn_code, gst_rate, category, unit, reorder_level) VALUES
                ('Dolo 650', 'Paracetamol 650mg', 'Micro Labs', '3004', 12, 'Analgesic', 'STRIP', 50),
                ('Azithral 500', 'Azithromycin 500mg', 'Alembic Pharma', '3004', 12, 'Antibiotic', 'STRIP', 30),
                ('Pan 40', 'Pantoprazole 40mg', 'Alkem Labs', '3004', 12, 'Antacid', 'STRIP', 40),
                ('Crocin Advance', 'Paracetamol 500mg', 'GSK', '3004', 12, 'Analgesic', 'STRIP', 60),
                ('Amoxyclav 625', 'Amoxicillin + Clavulanic Acid', 'Cipla', '3004', 12, 'Antibiotic', 'STRIP', 25),
                ('Cetrizine 10mg', 'Cetirizine 10mg', 'Sun Pharma', '3004', 12, 'Antiallergic', 'STRIP', 40),
                ('Montair LC', 'Montelukast + Levocetirizine', 'Cipla', '3004', 12, 'Antiallergic', 'STRIP', 30),
                ('Shelcal 500', 'Calcium + Vitamin D3', 'Torrent Pharma', '3004', 12, 'Supplement', 'BOTTLE', 20),
                ('B-Complex Forte', 'Vitamin B Complex', 'Abbott', '3004', 0, 'Supplement', 'BOTTLE', 25),
                ('ORS Powder', 'Oral Rehydration Salts', 'FDC', '3004', 5, 'Rehydration', 'PCS', 100),
                ('Calpol 250', 'Paracetamol 250mg Syrup', 'GSK', '3004', 12, 'Pediatric', 'BOTTLE', 30),
                ('Allegra 120', 'Fexofenadine 120mg', 'Sanofi', '3004', 12, 'Antiallergic', 'STRIP', 25),
                ('Omez 20', 'Omeprazole 20mg', 'Dr Reddys', '3004', 12, 'Antacid', 'STRIP', 50),
                ('Augmentin 625', 'Amoxicillin + Clavulanic Acid', 'GSK', '3004', 12, 'Antibiotic', 'STRIP', 20),
                ('Combiflam', 'Ibuprofen + Paracetamol', 'Sanofi', '3004', 12, 'Analgesic', 'STRIP', 40),
                ('Zincovit', 'Multivitamin + Zinc', 'Apex Labs', '3004', 0, 'Supplement', 'BOTTLE', 30),
                ('Digene Gel', 'Antacid Gel', 'Abbott', '3004', 12, 'Antacid', 'BOTTLE', 25),
                ('Vicks Vaporub', 'Camphor + Menthol', 'P&G', '3004', 18, 'Cold & Cough', 'PCS', 50),
                ('Benadryl DR', 'Diphenhydramine Syrup', 'Johnson & Johnson', '3004', 12, 'Cold & Cough', 'BOTTLE', 20),
                ('Livogen', 'Iron + Folic Acid', 'Merck', '3004', 0, 'Supplement', 'STRIP', 35),
                ('Rantac 150', 'Ranitidine 150mg', 'J B Chemicals', '3004', 12, 'Antacid', 'STRIP', 45),
                ('Ciprofloxacin 500', 'Ciprofloxacin 500mg', 'Cipla', '3004', 12, 'Antibiotic', 'STRIP', 30),
                ('Metrogyl 400', 'Metronidazole 400mg', 'J B Chemicals', '3004', 12, 'Antibiotic', 'STRIP', 35),
                ('Avil 25', 'Pheniramine 25mg', 'Sanofi', '3004', 12, 'Antiallergic', 'STRIP', 40),
                ('Brufen 400', 'Ibuprofen 400mg', 'Abbott', '3004', 12, 'Analgesic', 'STRIP', 50),
                ('Calpol 500', 'Paracetamol 500mg', 'GSK', '3004', 12, 'Analgesic', 'STRIP', 60),
                ('Disprin', 'Aspirin 350mg', 'Reckitt Benckiser', '3004', 12, 'Analgesic', 'STRIP', 55),
                ('Sinarest', 'Paracetamol + Phenylephrine', 'Centaur Pharma', '3004', 12, 'Cold & Cough', 'STRIP', 45),
                ('Mucinac 600', 'Acetylcysteine 600mg', 'Cipla', '3004', 12, 'Expectorant', 'STRIP', 30),
                ('Cheston Cold', 'Paracetamol + CPM', 'Cipla', '3004', 12, 'Cold & Cough', 'STRIP', 40),
                ('Ascoril LS', 'Ambroxol + Levosalbutamol Syrup', 'Glenmark', '3004', 12, 'Cough Syrup', 'BOTTLE', 25),
                ('Alex Syrup', 'Chlorpheniramine Syrup', 'Glenmark', '3004', 12, 'Cough Syrup', 'BOTTLE', 30),
                ('Norflox 400', 'Norfloxacin 400mg', 'Cipla', '3004', 12, 'Antibiotic', 'STRIP', 25),
                ('Levoflox 500', 'Levofloxacin 500mg', 'Cipla', '3004', 12, 'Antibiotic', 'STRIP', 20),
                ('Doxycycline 100', 'Doxycycline 100mg', 'Sun Pharma', '3004', 12, 'Antibiotic', 'STRIP', 30),
                ('Clavam 625', 'Amoxicillin + Clavulanic Acid', 'Alkem Labs', '3004', 12, 'Antibiotic', 'STRIP', 25),
                ('Aciloc 150', 'Ranitidine 150mg', 'Cadila', '3004', 12, 'Antacid', 'STRIP', 40),
                ('Gelusil MPS', 'Antacid Suspension', 'Pfizer', '3004', 12, 'Antacid', 'BOTTLE', 20),
                ('Eno Powder', 'Antacid Powder', 'GSK', '3004', 18, 'Antacid', 'PCS', 80),
                ('Voveran 50', 'Diclofenac 50mg', 'Novartis', '3004', 12, 'Analgesic', 'STRIP', 35),
                ('Volini Gel', 'Diclofenac Gel', 'Ranbaxy', '3004', 18, 'Pain Relief', 'PCS', 40),
                ('Moov Cream', 'Pain Relief Cream', 'Reckitt Benckiser', '3004', 18, 'Pain Relief', 'PCS', 45),
                ('Dettol Antiseptic', 'Chloroxylenol Solution', 'Reckitt Benckiser', '3004', 18, 'Antiseptic', 'BOTTLE', 30),
                ('Betadine Solution', 'Povidone Iodine', 'Win Medicare', '3004', 12, 'Antiseptic', 'BOTTLE', 25),
                ('Band Aid', 'Adhesive Bandages', 'Johnson & Johnson', '3004', 12, 'First Aid', 'PCS', 100),
                ('Cotton Roll', 'Absorbent Cotton', 'Multiple', '3004', 5, 'First Aid', 'PCS', 50),
                ('Gauge Bandage', 'Medical Bandage', 'Multiple', '3004', 5, 'First Aid', 'PCS', 60),
                ('Thermometer Digital', 'Digital Thermometer', 'Omron', '9018', 18, 'Medical Device', 'PCS', 10),
                ('BP Monitor', 'Blood Pressure Monitor', 'Omron', '9018', 18, 'Medical Device', 'PCS', 5),
                ('Glucometer', 'Blood Glucose Monitor', 'Accu-Chek', '9018', 12, 'Medical Device', 'PCS', 8),
                ('Neurobion Forte', 'Vitamin B Complex', 'Merck', '3004', 0, 'Supplement', 'STRIP', 35),
                ('Becosules', 'Vitamin B Complex', 'Pfizer', '3004', 0, 'Supplement', 'STRIP', 40),
                ('Evion 400', 'Vitamin E', 'Merck', '3004', 0, 'Supplement', 'STRIP', 30),
                ('Vitamin C 500', 'Ascorbic Acid 500mg', 'Multiple', '3004', 0, 'Supplement', 'STRIP', 45),
                ('Calcium Sandoz', 'Calcium Supplement', 'Novartis', '3004', 0, 'Supplement', 'STRIP', 25),
                ('Ferrous Sulfate', 'Iron Supplement', 'Multiple', '3004', 0, 'Supplement', 'STRIP', 30),
                ('Folic Acid 5mg', 'Folic Acid', 'Multiple', '3004', 0, 'Supplement', 'STRIP', 35),
                ('D-Rise 60K', 'Vitamin D3 60000 IU', 'Alkem Labs', '3004', 0, 'Supplement', 'PCS', 20),
                ('Omega 3', 'Fish Oil Capsules', 'Multiple', '3004', 0, 'Supplement', 'BOTTLE', 15),
                ('Glucon D', 'Glucose Powder', 'Heinz', '3004', 5, 'Energy', 'PCS', 70),
                ('Electral Powder', 'ORS', 'FDC', '3004', 5, 'Rehydration', 'PCS', 90)
            `, []);

            // =========================================
            // BATCHES (60+ batches for all medicines)
            // =========================================
            console.log('Seeding batches...');
            // Different expiry scenarios for testing
            const expiry6Months = formatDate(addDays(180));
            const expiry1Year = formatDate(addDays(365));
            const expiry20Days = formatDate(addDays(20)); // Expiring soon
            const expiry3Months = formatDate(addDays(90));
            const expiry2Years = formatDate(addDays(730));

            // Create batches for all 61 medicines
            const batchData = [];
            for (let i = 1; i <= 61; i++) {
                const expiry = i % 5 === 0 ? expiry20Days : (i % 3 === 0 ? expiry3Months : (i % 2 === 0 ? expiry6Months : expiry1Year));
                const rack = `${String.fromCharCode(65 + Math.floor((i - 1) / 12))}${((i - 1) % 12) + 1}`;
                const box = String(Math.floor((i - 1) / 5) + 1);
                const purchasePrice = (15 + i * 5).toFixed(2);
                const mrp = (25 + i * 6).toFixed(2);
                const sellingPrice = (parseFloat(mrp) - 2).toFixed(2);
                const quantity = Math.floor(100 + (i * 30)) * 10; // In tablets
                const tps = [1, 6, 10, 15][(i - 1) % 4];

                batchData.push(`(${i}, 'BT2024${String(i).padStart(3, '0')}', '${expiry}', ${purchasePrice}, ${mrp}, ${sellingPrice}, 'INCLUSIVE', ${quantity}, ${tps}, '${rack}', '${box}')`);
            }
            await execute(`INSERT INTO batches (medicine_id, batch_number, expiry_date, purchase_price, mrp, selling_price, price_type, quantity, tablets_per_strip, rack, box) VALUES ${batchData.join(', ')}`, []);

            // =========================================
            // CUSTOMERS (50+)
            // =========================================
            console.log('Seeding customers...');
            const customerNames = [
                ['Ramesh Kumar', '9876543220', 'ramesh@email.com', '12 Gandhi Street, Chennai', 5000, 1500],
                ['Lakshmi Devi', '9876543221', 'lakshmi@email.com', '34 Nehru Road, Chennai', 3000, 0],
                ['Suresh Babu', '9876543222', 'suresh@email.com', '56 Anna Nagar, Chennai', 10000, 4500],
                ['Kavitha Rajan', '9876543223', 'kavitha@email.com', '78 T Nagar, Chennai', 2000, 800],
                ['Mohan Raj', '9876543224', 'mohan@email.com', '90 Adyar, Chennai', 8000, 2200],
                ['Priya S', '9876543225', 'priya@email.com', '11 Velachery, Chennai', 4000, 0],
                ['Ganesh V', '9876543226', 'ganesh@email.com', '22 Tambaram, Chennai', 6000, 3100],
                ['Anitha K', '9876543227', 'anitha@email.com', '33 Chrompet, Chennai', 3500, 500],
                ['Venkat R', '9876543228', 'venkat@email.com', '44 Porur, Chennai', 7000, 2000],
                ['Meena M', '9876543229', 'meena@email.com', '55 Pallavaram, Chennai', 4500, 0],
                ['Ravi Kumar', '9876543230', 'ravi@email.com', '66 Medavakkam, Chennai', 5500, 1800],
                ['Saranya P', '9876543231', 'saranya@email.com', '77 Perungudi, Chennai', 3000, 0],
                ['Karthik M', '9876543232', 'karthik@email.com', '88 Sholinganallur, Chennai', 6500, 2500],
                ['Divya R', '9876543233', 'divya@email.com', '99 OMR, Chennai', 4000, 0],
                ['Prakash S', '9876543234', 'prakash@email.com', '101 ECR, Chennai', 8500, 3000],
                ['Deepa K', '9876543235', 'deepa@email.com', '102 Mogappair, Chennai', 5000, 1200],
                ['Arun V', '9876543236', 'arun@email.com', '103 Ambattur, Chennai', 7500, 0],
                ['Rekha L', '9876543237', 'rekha@email.com', '104 Avadi, Chennai', 4500, 900],
                ['Senthil M', '9876543238', 'senthil@email.com', '105 Poonamallee, Chennai', 6000, 1500],
                ['Uma S', '9876543239', 'uma@email.com', '106 Koyambedu, Chennai', 5500, 0],
                ['Bala K', '9876543240', 'bala@email.com', '107 Virugambakkam, Chennai', 4000, 600],
                ['Janaki R', '9876543241', 'janaki@email.com', '108 Vadapalani, Chennai', 7000, 2100],
                ['Krishna V', '9876543242', 'krishna@email.com', '109 Ashok Nagar, Chennai', 5000, 0],
                ['Radha M', '9876543243', 'radha@email.com', '110 K K Nagar, Chennai', 6500, 1700],
                ['Gopal S', '9876543244', 'gopal@email.com', '111 Saidapet, Chennai', 4500, 0],
                ['Padma K', '9876543245', 'padma@email.com', '112 Guindy, Chennai', 8000, 2800],
                ['Selvam R', '9876543246', 'selvam@email.com', '113 Kodambakkam, Chennai', 5500, 1100],
                ['Nisha V', '9876543247', 'nisha@email.com', '114 Nungambakkam, Chennai', 7500, 0],
                ['Babu M', '9876543248', 'babu@email.com', '115 Egmore, Chennai', 4000, 700],
                ['Geetha S', '9876543249', 'geetha@email.com', '116 Kilpauk, Chennai', 6000, 1600],
                ['Vijay K', '9876543250', 'vijay@email.com', '117 Perambur, Chennai', 5000, 0],
                ['Swathi R', '9876543251', 'swathi@email.com', '118 Vyasarpadi, Chennai', 7000, 2300],
                ['Naveen M', '9876543252', 'naveen@email.com', '119 Royapuram, Chennai', 4500, 0],
                ['Mythili K', '9876543253', 'mythili@email.com', '120 Tondiarpet, Chennai', 6500, 1900],
                ['Arjun V', '9876543254', 'arjun@email.com', '121 Washermanpet, Chennai', 5500, 0],
                ['Indira S', '9876543255', 'indira@email.com', '122 Sowcarpet, Chennai', 8000, 2900],
                ['Rajesh M', '9876543256', 'rajesh@email.com', '123 Parrys Corner, Chennai', 4000, 0],
                ['Vani K', '9876543257', 'vani@email.com', '124 George Town, Chennai', 7500, 2400],
                ['Siva R', '9876543258', 'siva@email.com', '125 Mannady, Chennai', 5000, 1000],
                ['Mala V', '9876543259', 'mala@email.com', '126 Mylapore, Chennai', 6000, 0],
                ['Rajan M', '9876543260', 'rajan@email.com', '127 Alwarpet, Chennai', 4500, 800],
                ['Vijaya S', '9876543261', 'vijaya@email.com', '128 Mandaveli, Chennai', 7000, 1800],
                ['Naveen K', '9876543262', 'naveen2@email.com', '129 Besant Nagar, Chennai', 5500, 0],
                ['Sudha R', '9876543263', 'sudha@email.com', '130 Thiruvanmiyur, Chennai', 8500, 3200],
                ['Mahesh V', '9876543264', 'mahesh@email.com', '131 Palavakkam, Chennai', 4000, 0],
                ['Pooja M', '9876543265', 'pooja@email.com', '132 Neelankarai, Chennai', 6500, 1700],
                ['Dinesh S', '9876543266', 'dinesh@email.com', '133 Injambakkam, Chennai', 5000, 0],
                ['Sneha K', '9876543267', 'sneha@email.com', '134 Taramani, Chennai', 7500, 2600],
                ['Harish R', '9876543268', 'harish@email.com', '135 Tidel Park, Chennai', 4500, 900],
                ['Lakshmi V', '9876543269', 'lakshmi2@email.com', '136 Thoraipakkam, Chennai', 6000, 0]
            ];

            const customerInserts = customerNames.map(c =>
                `('${c[0]}', '${c[1]}', '${c[2]}', '${c[3]}', ${c[4]}, ${c[5]})`
            ).join(', ');

            await execute(`INSERT INTO customers (name, phone, email, address, credit_limit, current_balance) VALUES ${customerInserts}`, []);

            // =========================================
            // PURCHASES (50+)
            // =========================================
            console.log('Seeding purchases...');
            const chunkSize = 20; // For batching INSERT statements
            const purchaseDate1 = formatDate(subDays(90));
            const purchaseDate2 = formatDate(subDays(75));
            const purchaseDate3 = formatDate(subDays(60));
            const purchaseDate4 = formatDate(subDays(45));
            const purchaseDate5 = formatDate(subDays(30));
            const purchaseDate6 = formatDate(subDays(15));
            const purchaseDate7 = formatDate(subDays(7));

            const purchaseInserts = [];
            for (let i = 1; i <= 50; i++) {
                const supplierId = ((i - 1) % 45) + 1;
                const date = formatDate(subDays(Math.floor(Math.random() * 90) + 1));
                const subtotal = (5000 + i * 300).toFixed(2);
                const taxableAmount = subtotal;
                const cgstAmount = (parseFloat(subtotal) * 0.06).toFixed(2);
                const sgstAmount = cgstAmount;
                const totalGst = (parseFloat(cgstAmount) * 2).toFixed(2);
                const grandTotal = (parseFloat(subtotal) + parseFloat(totalGst)).toFixed(2);
                const paymentStatus = i % 3 === 0 ? 'PAID' : (i % 5 === 0 ? 'PARTIAL' : 'PENDING');
                const paidAmount = paymentStatus === 'PAID' ? grandTotal : (paymentStatus === 'PARTIAL' ? (parseFloat(grandTotal) * 0.6).toFixed(2) : '0.00');

                purchaseInserts.push(`('P2024/${String(i).padStart(4, '0')}', '${date}', ${supplierId}, 1, ${subtotal}, ${taxableAmount}, ${cgstAmount}, ${sgstAmount}, ${totalGst}, ${grandTotal}, '${paymentStatus}', ${paidAmount})`);
            }
            await execute(`INSERT INTO purchases (invoice_number, invoice_date, supplier_id, user_id, subtotal, taxable_amount, cgst_amount, sgst_amount, total_gst, grand_total, payment_status, paid_amount) VALUES ${purchaseInserts.join(', ')}`, []);

            // =========================================
            // PURCHASE ITEMS (2-4 items per purchase)
            // =========================================
            console.log('Seeding purchase items...');
            const purchaseItemInserts = [];
            for (let i = 1; i <= 50; i++) {
                // Each purchase has 2-4 items
                const itemCount = 2 + (i % 3);
                for (let j = 0; j < itemCount; j++) {
                    const medicineId = ((i * 3 + j - 1) % 61) + 1;
                    const batchId = medicineId; // Using same ID for simplicity
                    const medicineName = `Medicine${medicineId}`;
                    const batchNumber = `BT2024${String(medicineId).padStart(3, '0')}`;
                    const expiryDate = formatDate(addDays(365 + (i % 5) * 60)); // 1-2 years from now
                    const quantity = 50 + (j * 25) + (i % 20) * 10; // 50-300 strips
                    const freeQuantity = Math.floor(quantity * 0.02); // 2% free goods
                    const packSize = [1, 6, 10, 15][(medicineId - 1) % 4];
                    const purchasePrice = (15 + medicineId * 3).toFixed(2);
                    const mrp = (25 + medicineId * 5).toFixed(2);
                    const gstRate = [0, 5, 12, 18][(medicineId - 1) % 4];
                    const itemTotal = (parseFloat(purchasePrice) * quantity).toFixed(2);
                    const cgstAmount = (parseFloat(itemTotal) * gstRate / 200).toFixed(2);
                    const sgstAmount = cgstAmount;
                    const totalWithGst = (parseFloat(itemTotal) + parseFloat(cgstAmount) * 2).toFixed(2);

                    purchaseItemInserts.push(`(${i}, ${batchId}, ${medicineId}, '${medicineName}', '${batchNumber}', '${expiryDate}', ${quantity}, ${freeQuantity}, ${packSize}, ${purchasePrice}, ${mrp}, 0, ${gstRate}, ${cgstAmount}, ${sgstAmount}, ${totalWithGst})`);
                }
            }
            // Insert purchase items in chunks
            for (let i = 0; i < purchaseItemInserts.length; i += chunkSize) {
                const chunk = purchaseItemInserts.slice(i, i + chunkSize);
                await execute(`INSERT INTO purchase_items (purchase_id, batch_id, medicine_id, medicine_name, batch_number, expiry_date, quantity, free_quantity, pack_size, purchase_price, mrp, discount_percent, gst_rate, cgst_amount, sgst_amount, total_amount) VALUES ${chunk.join(', ')}`, []);
            }

            // =========================================
            // BILLS (60+ Sales)
            // =========================================
            console.log('Seeding bills...');
            const billDate1 = formatDate(subDays(30));
            const billDate2 = formatDate(subDays(20));
            const billDate3 = formatDate(subDays(10));
            const billDate4 = formatDate(subDays(5));
            const billDate5 = formatDate(subDays(3));
            const billDate6 = formatDate(subDays(1));
            const billDateToday = formatDate(today);

            // Update bill sequence
            await execute('UPDATE bill_sequence SET current_number = 70', []);

            const billInserts = [];
            const billItemInserts = [];
            let billItemId = 1;

            for (let i = 1; i <= 65; i++) {
                const billNumber = `INV-2425${String(i).padStart(5, '0')}`;
                const daysAgo = Math.floor(Math.random() * 30);
                const billDate = formatDate(subDays(daysAgo));
                const customerId = i % 10 === 0 ? 'NULL' : ((i - 1) % 50) + 1;
                const customerName = i % 10 === 0 ? 'Walk-in' : `Customer${i}`;
                const subtotal = (200 + i * 15).toFixed(2);
                const taxableAmount = (parseFloat(subtotal) / 1.12).toFixed(2);
                const cgstAmount = (parseFloat(taxableAmount) * 0.06).toFixed(2);
                const sgstAmount = cgstAmount;
                const totalGst = (parseFloat(cgstAmount) * 2).toFixed(2);
                const grandTotal = subtotal;
                const paymentMode = ['CASH', 'ONLINE', 'CREDIT', 'SPLIT'][i % 4];
                const isCancelled = 0;
                const cashAmount = paymentMode === 'CASH' ? grandTotal : (paymentMode === 'SPLIT' ? (parseFloat(grandTotal) * 0.6).toFixed(2) : '0.00');
                const onlineAmount = paymentMode === 'ONLINE' ? grandTotal : (paymentMode === 'SPLIT' ? (parseFloat(grandTotal) * 0.4).toFixed(2) : '0.00');
                const creditAmount = paymentMode === 'CREDIT' ? grandTotal : '0.00';

                billInserts.push(`('${billNumber}', '${billDate}', ${customerId}, '${customerName}', 1, ${subtotal}, ${taxableAmount}, ${cgstAmount}, ${sgstAmount}, ${totalGst}, ${grandTotal}, '${paymentMode}', ${cashAmount}, ${onlineAmount}, ${creditAmount}, ${isCancelled})`);

                // Add 1-3 items per bill
                const itemCount = (i % 3) + 1;
                for (let j = 0; j < itemCount; j++) {
                    const batchId = ((i + j - 1) % 61) + 1;
                    const medicineId = batchId;
                    const qty = 10 + (j * 5);
                    const unitPrice = (25 + medicineId * 6).toFixed(2);
                    const mrp = unitPrice; // Same as unit price for this seed data
                    const itemSubtotal = (parseFloat(unitPrice) * qty).toFixed(2);
                    const itemTaxable = (parseFloat(itemSubtotal) / 1.12).toFixed(2);
                    const itemCgst = (parseFloat(itemTaxable) * 0.06).toFixed(2);
                    const itemSgst = itemCgst;

                    // bill_id, batch_id, medicine_id, medicine_name, hsn_code, batch_number, quantity, selling_price, taxable_amount, gst_rate, cgst_amount, sgst_amount, total_amount, mrp, unit
                    billItemInserts.push(`(${i}, ${batchId}, ${medicineId}, 'Medicine${medicineId}', '3004', 'BT2024${String(batchId).padStart(3, '0')}', ${qty}, ${unitPrice}, ${itemTaxable}, 12, ${itemCgst}, ${itemSgst}, ${itemSubtotal}, ${mrp}, 'PCS')`);
                }
            }

            // Insert in batches to avoid SQL length limits
            for (let i = 0; i < billInserts.length; i += chunkSize) {
                const chunk = billInserts.slice(i, i + chunkSize);
                await execute(`INSERT INTO bills (bill_number, bill_date, customer_id, customer_name, user_id, subtotal, taxable_amount, cgst_amount, sgst_amount, total_gst, grand_total, payment_mode, cash_amount, online_amount, credit_amount, is_cancelled) VALUES ${chunk.join(', ')}`, []);
            }

            // =========================================
            // BILL ITEMS
            // =========================================
            console.log('Seeding bill items...');
            for (let i = 0; i < billItemInserts.length; i += chunkSize) {
                const chunk = billItemInserts.slice(i, i + chunkSize);
                await execute(`INSERT INTO bill_items (bill_id, batch_id, medicine_id, medicine_name, hsn_code, batch_number, quantity, selling_price, taxable_amount, gst_rate, cgst_amount, sgst_amount, total_amount, mrp, unit) VALUES ${chunk.join(', ')}`, []);
            }

            // =========================================
            // CREDITS (for customers with balance)
            // =========================================
            console.log('Seeding credit transactions...');
            const creditInserts = [];
            // Create 45 credit transactions for various customers
            for (let i = 1; i <= 45; i++) {
                const customerId = ((i - 1) % 50) + 1;
                const billId = ((i - 1) % 65) + 1;
                const amount = (100 + i * 50).toFixed(2);
                const transactionType = i % 4 === 0 ? 'PAYMENT' : 'SALE';
                const balanceAfter = transactionType === 'PAYMENT' ?
                    Math.max(0, 5000 - i * 100).toFixed(2) :
                    (1000 + i * 100).toFixed(2);
                const paymentMode = transactionType === 'PAYMENT' ? "'CASH'" : 'NULL';
                const notes = transactionType === 'PAYMENT' ? 'Payment received' : 'Credit sale';
                creditInserts.push(`(${customerId}, ${billId}, '${transactionType}', ${amount}, ${balanceAfter}, ${paymentMode}, '${notes}', 1)`);
            }
            await execute(`INSERT INTO credits (customer_id, bill_id, transaction_type, amount, balance_after, payment_mode, notes, user_id) VALUES ${creditInserts.join(', ')}`, []);

            // =========================================
            // SCHEDULED MEDICINE RECORDS (40+)
            // For Schedule H/H1 medicines requiring patient details
            // =========================================
            console.log('Seeding scheduled medicine records...');
            const patientNames = [
                'Arun Kumar', 'Bhavani Devi', 'Chandran M', 'Deepa S', 'Ezhil V',
                'Fathima B', 'Ganesh R', 'Hari Prasad', 'Indira K', 'Jayashree M',
                'Karthik S', 'Lakshmi R', 'Murugan V', 'Nandini K', 'Ojas P',
                'Priya M', 'Qasim A', 'Ramya S', 'Suresh K', 'Tamilselvi V',
                'Uma D', 'Vijay R', 'Wafa K', 'Xavier J', 'Yamini S',
                'Zahir M', 'Aarthi K', 'Balaji S', 'Chitra R', 'Dinesh M',
                'Esther J', 'Faizal K', 'Geetha M', 'Harini S', 'Ilayaraja V',
                'Janani K', 'Kalaivani S', 'Logesh R', 'Meena V', 'Nithya K'
            ];
            const doctorNames = [
                'Dr. Ramesh Kumar', 'Dr. Lakshmi Devi', 'Dr. Suresh Babu', 'Dr. Kavitha Rajan',
                'Dr. Mohan Raj', 'Dr. Priya S', 'Dr. Ganesh V', 'Dr. Anitha K',
                'Dr. Venkat R', 'Dr. Meena M', 'Dr. Ravi Kumar', 'Dr. Saranya P'
            ];
            const clinics = [
                'Apollo Clinic', 'Kauvery Hospital', 'MIOT Hospital', 'Fortis Malar',
                'Vijaya Hospital', 'Sri Ramachandra', 'Billroth Hospital', 'Global Hospitals',
                'Chennai Medical Center', 'Sundaram Medical Foundation', 'Prashanth Hospital', 'Chettinad Hospital'
            ];

            const scheduledInserts = [];
            for (let i = 1; i <= 45; i++) {
                const billId = ((i - 1) % 65) + 1;
                const billItemId = ((i - 1) % 130) + 1;
                const medicineId = ((i - 1) % 61) + 1;
                const batchId = medicineId;
                const patientName = patientNames[(i - 1) % patientNames.length];
                const patientAge = 20 + (i % 60);
                const patientGender = i % 3 === 0 ? 'M' : (i % 3 === 1 ? 'F' : 'O');
                const patientPhone = `987654${String(3000 + i).padStart(4, '0')}`;
                const patientAddress = `${i} Main Street, Chennai`;
                const doctorName = doctorNames[(i - 1) % doctorNames.length];
                const doctorRegNo = `TN${String(10000 + i).padStart(6, '0')}`;
                const clinic = clinics[(i - 1) % clinics.length];
                const prescriptionNo = `RX${String(2024).padStart(4, '0')}${String(i).padStart(5, '0')}`;
                const qty = 5 + (i % 20);

                scheduledInserts.push(`(${billId}, ${billItemId}, ${medicineId}, ${batchId}, '${patientName}', ${patientAge}, '${patientGender}', '${patientPhone}', '${patientAddress}', '${doctorName}', '${doctorRegNo}', '${clinic}', '${prescriptionNo}', '${formatDate(subDays(i % 30))}', ${qty})`);
            }
            await execute(`INSERT INTO scheduled_medicine_records (bill_id, bill_item_id, medicine_id, batch_id, patient_name, patient_age, patient_gender, patient_phone, patient_address, doctor_name, doctor_registration_number, clinic_hospital_name, prescription_number, prescription_date, quantity) VALUES ${scheduledInserts.join(', ')}`, []);

            // =========================================
            // RUNNING BILLS (40+)
            // Bills for medicines sold without stock - pending reconciliation
            // =========================================
            console.log('Seeding running bills...');
            const runningBillMedicines = [
                'Crocin Advance', 'Dolo 650', 'Paracetamol IP', 'Azithromycin 500', 'Pantoprazole 40',
                'Omeprazole 20', 'Metformin 500', 'Atorvastatin 10', 'Amlodipine 5', 'Cetirizine 10',
                'Montelukast 10', 'Vitamin D3 60K', 'B-Complex', 'Iron Folic', 'Calcium 500',
                'Rabeprazole 20', 'Domperidone 10', 'Ondansetron 4', 'Tramadol 50', 'Diclofenac 50',
                'Aceclofenac 100', 'Ibuprofen 400', 'Aspirin 150', 'Clopidogrel 75', 'Losartan 50',
                'Telmisartan 40', 'Enalapril 5', 'Ramipril 5', 'Metoprolol 50', 'Atenolol 50',
                'Propranolol 40', 'Glimepiride 2', 'Sitagliptin 100', 'Vildagliptin 50', 'Pioglitazone 15',
                'Gabapentin 300', 'Pregabalin 75', 'Duloxetine 30', 'Escitalopram 10', 'Sertraline 50',
                'Fluoxetine 20', 'Alprazolam 0.5', 'Clonazepam 0.5', 'Lorazepam 2', 'Zolpidem 10'
            ];

            const runningBillInserts = [];
            for (let i = 1; i <= 45; i++) {
                const billId = ((i - 1) % 65) + 1;
                const medicineName = runningBillMedicines[(i - 1) % runningBillMedicines.length];
                const quantity = 5 + (i % 25);
                const unitPrice = (15 + (i * 3)).toFixed(2);
                const totalAmount = (parseFloat(unitPrice) * quantity).toFixed(2);
                const gstRate = [0, 5, 12, 18][(i - 1) % 4];
                const hsnCode = '3004';
                const notes = i % 3 === 0 ? `Urgent requirement for patient ${i}` : '';
                const status = i <= 35 ? 'PENDING' : (i <= 40 ? 'STOCKED' : 'CANCELLED');
                const linkedBatchId = status === 'STOCKED' ? ((i - 1) % 61) + 1 : 'NULL';
                const linkedMedicineId = status === 'STOCKED' ? ((i - 1) % 61) + 1 : 'NULL';
                const stockedAt = status === 'STOCKED' ? `'${formatDate(subDays(i % 10))}'` : 'NULL';
                const stockedBy = status === 'STOCKED' ? 1 : 'NULL';

                runningBillInserts.push(`(${billId}, '${medicineName}', ${quantity}, ${unitPrice}, ${totalAmount}, ${gstRate}, '${hsnCode}', '${notes}', 1, '${status}', ${linkedBatchId}, ${linkedMedicineId}, ${stockedAt}, ${stockedBy})`);
            }
            await execute(`INSERT INTO running_bills (bill_id, medicine_name, quantity, unit_price, total_amount, gst_rate, hsn_code, notes, user_id, status, linked_batch_id, linked_medicine_id, stocked_at, stocked_by) VALUES ${runningBillInserts.join(', ')}`, []);

            // =========================================
            // AUDIT LOG (40+)
            // =========================================
            console.log('Seeding audit log...');
            const auditActions = ['LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'PRINT', 'EXPORT'];
            const auditEntities = ['BILL', 'PURCHASE', 'MEDICINE', 'CUSTOMER', 'SUPPLIER', 'SETTINGS', 'USER', 'BATCH'];
            const auditInserts = [];
            for (let i = 1; i <= 50; i++) {
                const action = auditActions[(i - 1) % auditActions.length];
                const entity = auditEntities[(i - 1) % auditEntities.length];
                const entityId = ((i - 1) % 20) + 1;
                const description = `${action} ${entity.toLowerCase()} #${entityId}`;
                auditInserts.push(`(1, '${action}', '${entity}', ${entityId}, '${description}')`);
            }
            await execute(`INSERT INTO audit_log (user_id, action, entity_type, entity_id, description) VALUES ${auditInserts.join(', ')}`, []);
        }

        console.log('');
        console.log('========================================');
        console.log('Database seeding completed successfully!');
        console.log('========================================');
        console.log('Seeded data summary:');
        console.log('  - 45 Suppliers');
        console.log('  - 61 Medicines with batches (inventory stock)');
        console.log('  - 50 Customers (some with credit balances)');
        console.log('  - 50 Purchase invoices with ~125 purchase items');
        console.log('  - 65 Sales bills with ~130 bill items');
        console.log('  - 45 Credit transactions');
        console.log('  - 45 Scheduled medicine records');
        console.log('  - 45 Running bills (35 pending, 5 stocked, 5 cancelled)');
        console.log('  - 50 Audit log entries');
        console.log('');
        console.log('Features to test:');
        console.log('  - Dashboard: Shows today\'s sales, alerts');
        console.log('  - Inventory: 61 medicines, some expiring soon');
        console.log('  - Billing: Search medicines, create bills');
        console.log('  - Bill History: 65+ bills with items');
        console.log('  - Running Bills: 35 pending stock reconciliation');
        console.log('  - Scheduled Medicines: 45 records for Schedule H/H1');
        console.log('  - Purchases: View 50+ purchases with line items');
        console.log('  - Customers: 50+ customers, credit balances to collect');
        console.log('  - Reports: Sales, GST, inventory, credit reports');
        console.log('========================================');

    } catch (error) {
        console.error('Failed to seed database:', error);
        throw error;
    }
}

// Export for command-line usage
export { clearDatabase as clear, seedDatabase as seed };
