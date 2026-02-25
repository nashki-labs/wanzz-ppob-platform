import db, { addBalance, runInTransaction } from '../database.js';
import { sendTelegram } from '../utils/telegram.js';

const PAKASIR_SLUG = process.env.PAKASIR_SLUG;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

export const handlePakasir = async (req, res) => {
    const { amount, order_id, status, project } = req.body;

    // Validate required fields
    if (!amount || !order_id || !status || !project) {
        console.warn(`⚠️ [CALLBACK] Missing fields: ${JSON.stringify(req.body)}`);
        return res.status(400).send('Missing required fields');
    }

    if (project !== PAKASIR_SLUG) {
        console.warn(`⚠️ [CALLBACK] Invalid project slug: ${project}`);
        return res.status(400).send('Invalid project');
    }

    if (status === 'completed') {
        // Query deposit by order_id + status (indexed, not full scan)
        const deposit = db.prepare(
            'SELECT * FROM deposits WHERE reff_id = ? AND status = ?'
        ).get(order_id, 'pending');

        // Validate amount matches deposit record
        if (!deposit || Math.abs(deposit.nominal - parseFloat(amount)) >= 1) {
            console.warn(`⚠️ [CALLBACK] Amount mismatch or deposit not found: order=${order_id}, got_amount=${amount}, expected=${deposit?.nominal}`);
            return res.status(400).send('Invalid deposit');
        }

        runInTransaction(() => {
            db.prepare('UPDATE deposits SET status = ? WHERE id = ?').run('success', deposit.id);
            addBalance(deposit.user_id, deposit.nominal);
        });
        sendTelegram(ADMIN_CHAT_ID, `💰 <b>Deposit Berhasil (Pakasir)</b>\n👤 User: ${deposit.user_id}\n💵 Nominal: Rp ${deposit.nominal.toLocaleString('id-ID')}\n✅ Saldo otomatis ditambahkan.`);
    } else if (status === 'failed' || status === 'canceled') {
        const deposit = db.prepare(
            'SELECT * FROM deposits WHERE reff_id = ? AND status = ?'
        ).get(order_id, 'pending');
        if (deposit) {
            db.prepare('UPDATE deposits SET status = ? WHERE id = ?').run('failed', deposit.id);
        }
    }

    res.send('OK');
};
