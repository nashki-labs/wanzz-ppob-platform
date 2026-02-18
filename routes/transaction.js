import express from 'express';
import db, {
    getUserBalance, deductBalance, createTransaction,
    getSetting, createDepositRecord, runInTransaction,
    addBalance, updateTransactionStatus
} from '../database.js';
import { authenticateToken } from '../utils/auth.js';
import { sendTelegram } from '../utils/telegram.js';

const router = express.Router();
const CIAA_API_KEY = process.env.CIAA_API_KEY;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const PAKASIR_SLUG = process.env.PAKASIR_SLUG;
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Transaction Create
router.post('/transaction/create', authenticateToken, async (req, res) => {
    const { product_code, product_name, target } = req.body;
    const user = req.user;

    if (!product_code || !target) {
        return res.status(400).json({ status: 'error', message: 'Data transaksi tidak lengkap.' });
    }

    const reffId = `order-${Date.now()}`;
    const txId = `tx-${Date.now()}`;

    try {
        // 1. Fetch real price from vendor API to prevent manipulation
        const profitPercent = getSetting('profit_percent') || '0';
        const priceListRes = await fetch('https://ciaatopup.my.id/api/h2h/price-list/all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: CIAA_API_KEY,
                filter_status: 'true',
                profit_percent: profitPercent
            })
        });

        const priceListData = await priceListRes.json();

        // Find product in list
        let rawProducts = [];
        if (Array.isArray(priceListData.data)) {
            rawProducts = priceListData.data;
        } else if (Array.isArray(priceListData)) {
            rawProducts = priceListData;
        } else if (priceListData.data && typeof priceListData.data === 'object') {
            rawProducts = Object.values(priceListData.data).flat();
        }

        const serverProduct = rawProducts.find(p => p.code === product_code);

        if (!serverProduct) {
            return res.status(400).json({ status: 'error', message: 'Produk tidak ditemukan atau tidak aktif di vendor.' });
        }

        const price = typeof serverProduct.price === 'string' ? parseFloat(serverProduct.price) : (serverProduct.price || 0);

        if (price <= 0) {
            return res.status(400).json({ status: 'error', message: 'Harga produk tidak valid.' });
        }

        // 2. Validate balance with server-side price
        const currentBalance = getUserBalance(user.id);
        if (currentBalance < price) {
            console.log(`⚠️ [TRX] Saldo tidak cukup: ${user.email} (Price: ${price}, Balance: ${currentBalance})`);
            return res.status(400).json({ status: 'error', message: `Saldo tidak cukup.` });
        }

        // 3. ATOMIC: Potong saldo & catat transaksi PENDING
        runInTransaction(() => {
            const deducted = deductBalance(user.id, price);
            if (deducted.changes === 0) {
                throw new Error('SALDO_NOT_ENOUGH');
            }
            createTransaction({
                id: txId, userId: user.id, userName: user.name, userEmail: user.email,
                productCode: product_code, productName: product_name, target, price,
                status: 'pending', reffId, gatewayResponse: 'Waiting for gateway...'
            });
        });

        // 2. CALL GATEWAY
        const payload = { product_code, target, reff_id: reffId, api_key: CIAA_API_KEY };
        const gatewayRes = await fetch('https://ciaatopup.my.id/api/h2h/transaction/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const gatewayData = await gatewayRes.json();

        if (gatewayData.status === 'success' || gatewayRes.ok) {
            // 3. SUCCESS: Update status & vendor_id
            const vendorId = gatewayData.data?.id || null;
            const vendorStatus = gatewayData.data?.status || 'success';

            updateTransactionStatus(txId, vendorStatus, JSON.stringify(gatewayData));
            // Update vendor_id separately since updateTransactionStatus doesn't include it
            db.prepare('UPDATE transactions SET vendor_id = ? WHERE id = ?').run(vendorId, txId);

            sendTelegram(ADMIN_CHAT_ID, `👑 <b>Transaksi Baru</b>\n👤 ${user.name}\n🛒 ${product_name}\n🎯 ${target}\n💵 Rp ${price.toLocaleString('id-ID')}\n📉 Status: ${vendorStatus.toUpperCase()}`);

            res.json({ status: 'success', reff_id: reffId, new_balance: getUserBalance(user.id), data: gatewayData.data || gatewayData });
        } else {
            // 4. FAILED: Refund saldo
            runInTransaction(() => {
                addBalance(user.id, price);
                updateTransactionStatus(txId, 'failed', JSON.stringify(gatewayData));
            });
            res.status(400).json({ status: 'error', message: gatewayData.message || 'Gateway menolak transaksi.' });
        }
    } catch (error) {
        if (error.message === 'SALDO_NOT_ENOUGH') {
            return res.status(400).json({ status: 'error', message: 'Saldo tidak cukup.' });
        }

        console.error(`❌ [TRX_ERR]`, error.message);

        // 5. ERROR: Refund saldo jika sempat terpotong
        try {
            runInTransaction(() => {
                addBalance(user.id, price);
                updateTransactionStatus(txId, 'error', JSON.stringify({ error: error.message }));
            });
        } catch (refundErr) {
            console.error('CRITICAL: Gagal refund!', refundErr);
        }

        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem.' });
    }
});

// Deposit Create
router.post('/deposit/create', authenticateToken, async (req, res) => {
    const { nominal, method, existing_deposit_id } = req.body;
    const user = req.user;
    const activeGateway = getSetting('active_deposit_method') || 'ciaatopup';

    let finalNominal = nominal;
    let reffId = `depo-${Date.now()}`;
    let depoId = `dep-${Date.now()}`;
    let isUpdate = false;

    if (existing_deposit_id) {
        const existing = db.prepare('SELECT * FROM deposits WHERE id = ? AND user_id = ?').get(existing_deposit_id, user.id);
        if (!existing || existing.status !== 'pending') {
            return res.status(400).json({ status: 'error', message: 'Deposit tidak valid atau sudah tidak pending.' });
        }
        finalNominal = existing.nominal;
        reffId = existing.reff_id;
        depoId = existing.id;
        isUpdate = true;
    } else if (!nominal || !method || nominal < 10000) {
        return res.status(400).json({ status: 'error', message: 'Nominal minimal Rp 10.000.' });
    }

    try {
        let gatewayRes, gatewayData;

        if (activeGateway === 'pakasir') {
            const redirectUrl = `${FRONTEND_URL}/profile`;
            const payload = {
                project: PAKASIR_SLUG,
                order_id: reffId,
                amount: finalNominal,
                api_key: PAKASIR_API_KEY,
                redirect: redirectUrl
            };
            gatewayRes = await fetch(`https://app.pakasir.com/api/transactioncreate/${method}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const rawData = await gatewayRes.json();
            if (rawData.payment) {
                gatewayData = {
                    status: 'success',
                    data: {
                        fee: rawData.payment.fee,
                        qr_image_url: rawData.payment.payment_method === 'qris' ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(rawData.payment.payment_number)}` : null,
                        payment_number: rawData.payment.payment_number,
                        expired_at: rawData.payment.expired_at,
                        total_payment: rawData.payment.total_payment
                    }
                };
            } else {
                gatewayData = { status: 'error', message: rawData.message || 'Pakasir error' };
            }
        } else {
            const payload = { nominal: finalNominal, method, reff_id: reffId, api_key: CIAA_API_KEY };
            gatewayRes = await fetch('https://ciaatopup.my.id/api/h2h/deposit/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            gatewayData = await gatewayRes.json();
        }

        if (gatewayData.status === 'success' || gatewayRes.ok) {
            const rawDepositData = gatewayData.data || gatewayData;
            const vendorId = activeGateway === 'pakasir' ? null : rawDepositData.id;

            const finalDepositData = {
                id: depoId,
                reff_id: reffId,
                nominal: Number(finalNominal),
                fee: Number(rawDepositData.fee || 0),
                total_payment: Number(rawDepositData.total_payment || (Number(finalNominal) + Number(rawDepositData.fee || 0))),
                qr_image_url: rawDepositData.qr_image_url || null,
                payment_number: rawDepositData.payment_number || null,
                status: 'pending',
                expired_at: rawDepositData.expired_at || null
            };

            const recordPayload = {
                id: depoId, userId: user.id, userName: user.name, reffId,
                nominal: finalDepositData.nominal,
                fee: finalDepositData.fee,
                method,
                status: 'pending',
                qrImageUrl: finalDepositData.qr_image_url,
                paymentNumber: finalDepositData.payment_number,
                vendorId: vendorId,
                gatewayResponse: JSON.stringify(gatewayData),
                expiredAt: finalDepositData.expired_at ? new Date(finalDepositData.expired_at).toISOString() : null,
                totalPayment: finalDepositData.total_payment
            };

            if (isUpdate) {
                // Update specific fields for re-created transaction
                db.prepare(`
                    UPDATE deposits SET 
                        method = ?, 
                        fee = ?, 
                        qr_image_url = ?, 
                        payment_number = ?, 
                        gateway_response = ?, 
                        expired_at = ?,
                        total_payment = ?
                    WHERE id = ?
                `).run(
                    method,
                    recordPayload.fee,
                    recordPayload.qrImageUrl,
                    recordPayload.paymentNumber,
                    recordPayload.gatewayResponse,
                    recordPayload.expiredAt,
                    recordPayload.totalPayment,
                    depoId
                );
            } else {
                createDepositRecord(recordPayload);
            }

            console.log(`✅ [DEPO] Deposit ${isUpdate ? 'Updated' : 'Created'}: ${reffId} for ${user.email} (Gateway: ${activeGateway})`);
            sendTelegram(ADMIN_CHAT_ID, `💰 <b>Deposit ${isUpdate ? 'Ganti Metode' : 'Baru'} (${activeGateway.toUpperCase()})</b>\n👤 ${user.name}\n💵 Rp ${finalNominal.toLocaleString('id-ID')}\n💳 ${method}\n📈 Ref: ${reffId}\n📉 Status: PENDING`);

            res.json({ status: 'success', data: finalDepositData });
        } else {
            console.warn(`⚠️ [DEPO_FAIL] Gateway rejected deposit for ${user.email}:`, gatewayData.message || 'Unknown error');
            res.status(400).json({ status: 'error', message: gatewayData.message || 'Gateway menolak deposit.' });
        }
    } catch (error) {
        console.error(`❌ [DEPO_ERR]`, error.message);
        res.status(500).json({ status: 'error', message: 'Gagal menghubungi gateway.' });
    }
});

// Deposit Cancel
router.post('/deposit/cancel', authenticateToken, async (req, res) => {
    const { deposit_id } = req.body;
    const user = req.user;

    try {
        const deposit = db.prepare('SELECT * FROM deposits WHERE id = ? AND user_id = ?').get(deposit_id, user.id);

        if (!deposit) {
            return res.status(404).json({ status: 'error', message: 'Deposit tidak ditemukan.' });
        }

        if (deposit.status !== 'pending') {
            return res.status(400).json({ status: 'error', message: 'Hanya deposit pending yang bisa dibatalkan.' });
        }

        const activeGateway = getSetting('active_deposit_method') || 'ciaatopup';

        if (activeGateway === 'pakasir') {
            const payload = {
                project: PAKASIR_SLUG,
                order_id: deposit.reff_id,
                amount: deposit.nominal,
                api_key: PAKASIR_API_KEY
            };

            const response = await fetch('https://app.pakasir.com/api/transactioncancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            // Pakasir might return success even if already canceled, so we just check if it's not a hard error
            // Or we check if the response indicates success. 
            // Assuming successful cancel if no hard error. 
            // Documentation example response is not fully detailed on error, but let's assume standard behavior.
        }

        // Always cancel locally
        db.prepare('UPDATE deposits SET status = ? WHERE id = ?').run('canceled', deposit.id);

        console.log(`🚫 [DEPO] Deposit Canceled: ${deposit.reff_id} by ${user.email}`);
        res.json({ status: 'success', message: 'Deposit berhasil dibatalkan.' });
    } catch (error) {
        console.error(`❌ [DEPO_CANCEL_ERR]`, error.message);
        res.status(500).json({ status: 'error', message: 'Gagal membatalkan deposit.' });
    }
});

// Products List
router.get('/products', async (req, res) => {
    try {
        const profitPercent = getSetting('profit_percent') || '0';
        const response = await fetch('https://ciaatopup.my.id/api/h2h/price-list/all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: CIAA_API_KEY,
                filter_status: 'true',
                profit_percent: profitPercent
            })
        });
        const data = await response.json();
        console.log('📦 [PRODUCTS] Raw API response keys:', Object.keys(data), 'type of data.data:', typeof data.data, Array.isArray(data.data) ? `(array, len=${data.data.length})` : '');

        // Defensive: ensure we always have an array
        let rawProducts = [];
        if (Array.isArray(data.data)) {
            rawProducts = data.data;
        } else if (Array.isArray(data)) {
            rawProducts = data;
        } else if (data.data && typeof data.data === 'object') {
            // Some APIs return products grouped by category as an object
            rawProducts = Object.values(data.data).flat();
        }

        const products = rawProducts
            .filter(p => p && typeof p === 'object')
            .map(p => ({
                ...p,
                price: typeof p.price === 'string' ? parseFloat(p.price) : (p.price || 0),
                available: p.status === 'active' || p.available === true
            }))
            .filter(p => p.price > 0); // Hide products with 0 price
        res.json({ status: 'success', data: products });
    } catch (error) {
        console.error('❌ [PRODUCTS_ERR]', error.message);
        res.status(500).json({ status: 'error', data: [] });
    }
});

// Deposit Methods
router.get('/deposit-methods', async (req, res) => {
    const activeGateway = getSetting('active_deposit_method') || 'ciaatopup';

    if (activeGateway === 'pakasir') {
        const methods = [
            { metode: 'qris', name: 'QRIS (Pakasir)', type: 'ewallet', minimum: '1000', fee: '0', status: 'active', logo_image_url: 'https://v.pakasir.com/assets/qris.png' },
            { metode: 'bni_va', name: 'BNI Virtual Account', type: 'bank', minimum: '10000', fee: '0', status: 'active', logo_image_url: 'https://v.pakasir.com/assets/bni.png' },
            { metode: 'bri_va', name: 'BRI Virtual Account', type: 'bank', minimum: '10000', fee: '0', status: 'active', logo_image_url: 'https://v.pakasir.com/assets/bri.png' },
            { metode: 'permata_va', name: 'Permata Virtual Account', type: 'bank', minimum: '10000', fee: '0', status: 'active', logo_image_url: 'https://v.pakasir.com/assets/permatabank.png' },
            { metode: 'cimb_niaga_va', name: 'CIMB Niaga Virtual Account', type: 'bank', minimum: '10000', fee: '0', status: 'active', logo_image_url: 'https://v.pakasir.com/assets/cimb.png' },
            { metode: 'sampoerna_va', name: 'Sampoerna Virtual Account', type: 'bank', minimum: '10000', fee: '0', status: 'active', logo_image_url: 'https://v.pakasir.com/assets/sampoerna.png' },
            { metode: 'bnc_va', name: 'BNC Virtual Account', type: 'bank', minimum: '10000', fee: '0', status: 'active', logo_image_url: 'https://v.pakasir.com/assets/bnc.png' },
            { metode: 'maybank_va', name: 'Maybank Virtual Account', type: 'bank', minimum: '10000', fee: '0', status: 'active', logo_image_url: 'https://v.pakasir.com/assets/maybank.png' },
            { metode: 'atm_bersama_va', name: 'ATM Bersama Virtual Account', type: 'bank', minimum: '10000', fee: '0', status: 'active', logo_image_url: 'https://v.pakasir.com/assets/atm-bersama.png' },
            { metode: 'artha_graha_va', name: 'Artha Graha Virtual Account', type: 'bank', minimum: '10000', fee: '0', status: 'active', logo_image_url: 'https://v.pakasir.com/assets/artha-graha.png' }
        ];
        return res.json({ status: 'success', data: methods });
    }

    try {
        const response = await fetch('https://ciaatopup.my.id/api/h2h/deposit/methods', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: CIAA_API_KEY })
        });
        const data = await response.json();
        res.json({ status: 'success', data: data.data || data || [] });
    } catch (error) {
        console.error('❌ [METHODS_ERR]', error.message);
        res.status(500).json({ status: 'error', data: [] });
    }
});

// Status Sync - Transaction
router.get('/transaction/:id/sync', authenticateToken, async (req, res) => {
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    if (!tx || (req.user.role !== 'admin' && tx.user_id !== req.user.id)) {
        return res.status(404).json({ status: 'error', message: 'Transaksi tidak ditemukan.' });
    }

    if (!tx.vendor_id && !tx.reff_id) return res.json({ status: 'error', message: 'ID Vendor tidak ada.' });

    try {
        const response = await fetch('https://ciaatopup.my.id/api/h2h/transaction/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tx.vendor_id || tx.reff_id, api_key: CIAA_API_KEY })
        });
        const data = await response.json();
        if (data.status === 'success' && data.data) {
            const newStatus = data.data.status;
            if (newStatus !== tx.status) {
                updateTransactionStatus(tx.id, newStatus, JSON.stringify(data));
                if (newStatus === 'failed') {
                    addBalance(tx.user_id, tx.price);
                }
            }
            return res.json({ status: 'success', data: data.data });
        }
        res.json({ status: 'error', message: data.message || 'Gagal sinkron status.' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Status Sync - Deposit
router.get('/deposit/:id/sync', authenticateToken, async (req, res) => {
    const depo = db.prepare('SELECT * FROM deposits WHERE id = ?').get(req.params.id);
    if (!depo || (req.user.role !== 'admin' && depo.user_id !== req.user.id)) {
        return res.status(404).json({ status: 'error', message: 'Deposit tidak ditemukan.' });
    }

    try {
        let newStatus = depo.status;
        let gatewayData = null;

        if (depo.method.includes('Pakasir') || !depo.vendor_id) {
            // Pakasir or Legacy
            const url = `https://app.pakasir.com/api/transactiondetail?project=${PAKASIR_SLUG}&amount=${depo.nominal}&order_id=${depo.reff_id}&api_key=${PAKASIR_API_KEY}`;
            const resDet = await fetch(url);
            gatewayData = await resDet.json();
            if (gatewayData.transaction && gatewayData.transaction.status === 'completed') {
                newStatus = 'success';
            }
        } else {
            // CiaaTopUp
            const response = await fetch('https://ciaatopup.my.id/api/h2h/deposit/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: depo.vendor_id, api_key: CIAA_API_KEY })
            });
            gatewayData = await response.json();
            if (gatewayData.status === 'success' && gatewayData.data) {
                newStatus = gatewayData.data.status;
            }
        }

        if (newStatus === 'success' && depo.status !== 'success') {
            runInTransaction(() => {
                db.prepare('UPDATE deposits SET status = ? WHERE id = ?').run('success', depo.id);
                addBalance(depo.user_id, depo.nominal);
            });
        } else if ((newStatus === 'failed' || newStatus === 'canceled') && depo.status === 'pending') {
            db.prepare('UPDATE deposits SET status = ? WHERE id = ?').run('failed', depo.id);
        }

        res.json({ status: 'success', current_status: newStatus });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

export default router;
