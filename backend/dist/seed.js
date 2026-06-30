import { getDb } from './database.js';
import crypto from 'crypto';
async function seed() {
    try {
        const db = getDb();
        await db.from('transactions').delete().neq('id', '');
        const dummyData = [
            { amount: 45000, type: 'income', category: 'เงินเดือน', date: '2026-06-01', note: 'เงินเดือนประจำเดือนมิถุนายน' },
            { amount: 1500, type: 'income', category: 'การลงทุน', date: '2026-06-15', note: 'เงินปันผลกองทุนรวม' },
            { amount: 3200, type: 'income', category: 'ธุรกิจ/ขายของ', date: '2026-06-28', note: 'ขายเสื้อผ้ามือสองออนไลน์' },
            { amount: 1200, type: 'expense', category: 'เดินทาง/ค่ารถ', date: '2026-06-24', note: 'เติมน้ำมันรถยนต์ประจำสัปดาห์' },
            { amount: 350, type: 'expense', category: 'อาหาร/เครื่องดื่ม', date: '2026-06-25', note: 'ทานข้าวมื้อกลางวันกับทีมงาน' },
            { amount: 2500, type: 'expense', category: 'ช้อปปิ้ง', date: '2026-06-26', note: 'ซื้อรองเท้าวิ่งใหม่' },
            { amount: 3400, type: 'expense', category: 'ค่าน้ำ/ไฟ/บ้าน', date: '2026-06-27', note: 'ค่าไฟและค่าบริการอินเทอร์เน็ต' },
            { amount: 1800, type: 'expense', category: 'อาหาร/เครื่องดื่ม', date: '2026-06-28', note: 'ดินเนอร์ฉลองวันเกิด' },
            { amount: 450, type: 'expense', category: 'บันเทิง/ท่องเที่ยว', date: '2026-06-29', note: 'ตั๋วภาพยนตร์และเครื่องดื่ม' },
            { amount: 120, type: 'expense', category: 'อาหาร/เครื่องดื่ม', date: '2026-06-29', note: 'กาแฟเช้าชงพิเศษ' },
            { amount: 800, type: 'expense', category: 'สุขภาพ/การแพทย์', date: '2026-06-29', note: 'ซื้อวิตามินบำรุงสุขภาพ' }
        ];
        const rows = dummyData.map(item => ({ id: crypto.randomUUID(), ...item }));
        await db.from('transactions').insert(rows);
        console.log('Seeded database successfully with dummy transactions!');
        process.exit(0);
    }
    catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}
seed();
