import express from 'express';
import db, { getAllDeposits, addBalance, runInTransaction } from '../database.js';
import { sendTelegram } from '../utils/telegram.js';

const router = express.Router();
const PAKASIR_SLUG = process.env.PAKASIR_SLUG;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Pakasir Callback
router.post('/pakasir', async (req, res) => {
    const { amount, order_id, status, project } = req.body;

    console.log(`📢 [CALLBACK] Pakasir received: ${order_id} | ${amount} | ${status}`);

    if (project !== PAKASIR_SLUG) {
        return res.status(400).send('Invalid project');
    }

    // Improved status handling
    if (status === 'completed') {
        const deposits = getAllDeposits();
        const deposit = deposits.find(d =>
            d.reff_id === order_id &&
            d.status === 'pending' &&
            Math.abs(d.nominal - parseFloat(amount)) < 1 // check if amount matches
        );

        if (deposit) {
            runInTransaction(() => {
                db.prepare('UPDATE deposits SET status = ? WHERE id = ?').run('success', deposit.id);
                addBalance(deposit.user_id, deposit.nominal);
            });
            console.log(`✅ [CALLBACK] Pakasir Success: Added Rp ${deposit.nominal} to ${deposit.user_id}`);
            sendTelegram(ADMIN_CHAT_ID, `💰 <b>Deposit Berhasil (Pakasir)</b>\n👤 User: ${deposit.user_id}\n💵 Nominal: Rp ${deposit.nominal.toLocaleString('id-ID')}\n✅ Saldo otomatis ditambahkan.`);
        }
    } else if (status === 'failed' || status === 'canceled') {
        const deposits = getAllDeposits();
        const deposit = deposits.find(d => d.reff_id === order_id && d.status === 'pending');
        if (deposit) {
            db.prepare('UPDATE deposits SET status = ? WHERE id = ?').run('failed', deposit.id);
            console.log(`❌ [CALLBACK] Pakasir Failed: ${order_id}`);
        }
    }

    res.send('OK');
});

export default router;
