import express from 'express';
import db, {
    getAllUsers, getAllTransactions, getAllDeposits,
    getSetting, setSetting, getUserMessages
} from '../database.js';
import { authenticateToken, requireAdmin, sanitizeUser } from '../utils/auth.js';

const router = express.Router();

// Middleware: Admin Only
router.use(authenticateToken, requireAdmin);

// Dashboard Stats & Lists
router.get('/users', (req, res) => {
    const users = getAllUsers();
    res.json({ status: 'success', data: users.map(u => sanitizeUser(u)) });
});

router.get('/transactions', (req, res) => {
    const transactions = getAllTransactions();
    res.json({ status: 'success', data: transactions });
});

router.get('/deposits', (req, res) => {
    const deposits = getAllDeposits();
    res.json({ status: 'success', data: deposits });
});

// Settings Management
router.get('/settings', (req, res) => {
    const maintenance = getSetting('maintenance_mode') === 'true';
    const activeDepositMethod = getSetting('active_deposit_method') || 'ciaatopup';
    const profitPercent = getSetting('profit_percent') || '0';
    res.json({ status: 'success', data: { maintenance, activeDepositMethod, profitPercent } });
});

router.post('/maintenance', (req, res) => {
    const { enabled } = req.body;
    setSetting('maintenance_mode', String(!!enabled));
    console.log(`🔧 [ADMIN] Maintenance mode: ${enabled ? 'ON' : 'OFF'}`);
    res.json({ status: 'success', maintenance: !!enabled });
});

router.post('/settings/deposit-method', (req, res) => {
    const { method } = req.body;
    if (!['ciaatopup', 'pakasir'].includes(method)) {
        return res.status(400).json({ status: 'error', message: 'Metode tidak valid.' });
    }
    setSetting('active_deposit_method', method);
    console.log(`🔧 [ADMIN] Active deposit gateway changed to: ${method}`);
    res.json({ status: 'success', method });
});
router.post('/settings/profit-margin', (req, res) => {
    const { percent } = req.body;
    const nPercent = Number(percent);

    if (isNaN(nPercent) || nPercent < 0 || nPercent > 100 || !Number.isInteger(nPercent)) {
        return res.status(400).json({ status: 'error', message: 'Persentase tidak valid. Masukkan angka bulat antara 0 - 100.' });
    }

    const oldPercent = getSetting('profit_percent') || '0';
    setSetting('profit_percent', String(nPercent));

    // Audit Log
    try {
        const adminId = req.user.id;
        db.prepare(`
            INSERT INTO audit_logs (id, admin_id, action, old_value, new_value)
            VALUES (?, ?, ?, ?, ?)
        `).run(`audit-${Date.now()}`, adminId, 'change_profit_margin', oldPercent, String(nPercent));
    } catch (auditErr) {
        console.error('❌ [AUDIT_ERR]', auditErr.message);
    }

    console.log(`🔧 [ADMIN] Global profit margin changed to: ${nPercent}%`);
    res.json({ status: 'success', percent: nPercent });
});

// Pterodactyl Advanced Settings
router.get('/ptero-settings', (req, res) => {
    const packages = getSetting('ptero_packages') ? JSON.parse(getSetting('ptero_packages')) : null;
    const domain = getSetting('ptero_domain') || process.env.PTERO_DOMAIN || '';
    const apiKey = getSetting('ptero_api_key') || process.env.PTERO_PLTA_API_KEY || '';

    res.json({
        status: 'success',
        data: {
            packages,
            domain,
            apiKey
        }
    });
});

router.post('/ptero-settings', (req, res) => {
    const { packages, domain, apiKey } = req.body;

    if (packages) {
        setSetting('ptero_packages', JSON.stringify(packages));
    }
    if (domain) {
        setSetting('ptero_domain', domain);
    }
    if (apiKey) {
        setSetting('ptero_api_key', apiKey);
    }

    console.log(`🔧 [ADMIN] Pterodactyl settings updated by ${req.user.name}`);
    res.json({ status: 'success', message: 'Pengaturan Pterodactyl berhasil diperbarui.' });
});

// Chat Management
router.get('/messages/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const messages = getUserMessages(userId);
        res.json({ status: 'success', data: messages });
    } catch (error) {
        console.error('❌ [ADMIN_CHAT_ERR]', error.message);
        res.status(500).json({ status: 'error', message: 'Gagal mengambil pesan user.' });
    }
});

export default router;
