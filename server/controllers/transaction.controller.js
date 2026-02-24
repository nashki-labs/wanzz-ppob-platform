import db, {
    getUserBalance, deductBalance, createTransaction,
    getSetting, createDepositRecord, runInTransaction,
    addBalance, updateTransactionStatus
} from '../database.js';
import * as PaymentService from '../services/payment.service.js';
import { sendTelegram } from '../utils/telegram.js';

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const PAKASIR_SLUG = process.env.PAKASIR_SLUG;
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY;

export const createTx = async (req, res) => {
    const { product_code, product_name, target } = req.body;
    const user = req.user;

    if (!product_code || !target) {
        return res.status(400).json({ status: 'error', message: 'Data transaksi tidak lengkap.' });
    }

    const reffId = `order-${Date.now()}`;
    const txId = `tx-${Date.now()}`;
    let price;

    try {
        const profitPercent = getSetting('profit_percent') || '0';
        const products = await PaymentService.fetchCiaaProducts(profitPercent);
        const serverProduct = products.find(p => p.code === product_code);

        if (!serverProduct) {
            return res.status(400).json({ status: 'error', message: 'Produk tidak ditemukan atau tidak aktif di vendor.' });
        }

        price = serverProduct.price;

        if (price <= 0) {
            return res.status(400).json({ status: 'error', message: 'Harga produk tidak valid.' });
        }

        const currentBalance = getUserBalance(user.id);
        if (currentBalance < price) {
            return res.status(400).json({ status: 'error', message: `Saldo tidak cukup.` });
        }

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

        const gatewayData = await PaymentService.createCiaaTransaction(product_code, target, reffId);

        if (gatewayData.status === 'success') {
            const vendorId = gatewayData.data?.id || null;
            const vendorStatus = gatewayData.data?.status || 'success';

            updateTransactionStatus(txId, vendorStatus, JSON.stringify(gatewayData));
            db.prepare('UPDATE transactions SET vendor_id = ? WHERE id = ?').run(vendorId, txId);

            sendTelegram(ADMIN_CHAT_ID, `👑 <b>Transaksi Baru</b>\n👤 ${user.name}\n🛒 ${product_name}\n🎯 ${target}\n💵 Rp ${price.toLocaleString('id-ID')}\n📉 Status: ${vendorStatus.toUpperCase()}`);

            res.json({ status: 'success', reff_id: reffId, new_balance: getUserBalance(user.id), data: gatewayData.data || gatewayData });
        } else {
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
        try {
            if (price) {
                runInTransaction(() => {
                    addBalance(user.id, price);
                    updateTransactionStatus(txId, 'error', JSON.stringify({ error: error.message }));
                });
            }
        } catch (refundErr) {
            console.error('CRITICAL: Gagal refund!', refundErr);
        }
        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem.' });
    }
};

export const createDepo = async (req, res) => {
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
        let gatewayData;
        if (activeGateway === 'pakasir') {
            gatewayData = await PaymentService.createPakasirDeposit(finalNominal, method, reffId, FRONTEND_URL);
        } else {
            gatewayData = await PaymentService.createCiaaDeposit(finalNominal, method, reffId);
        }

        if (gatewayData.status === 'success') {
            const rawDepositData = gatewayData.data;
            const vendorId = activeGateway === 'pakasir' ? null : rawDepositData.id;

            const recordPayload = {
                id: depoId, userId: user.id, userName: user.name, reffId,
                nominal: Number(finalNominal),
                fee: Number(rawDepositData.fee || 0),
                method,
                status: 'pending',
                qrImageUrl: rawDepositData.qr_image_url,
                paymentNumber: rawDepositData.payment_number,
                vendorId: vendorId,
                gatewayResponse: JSON.stringify(gatewayData),
                expiredAt: rawDepositData.expired_at ? new Date(rawDepositData.expired_at).toISOString() : null,
                totalPayment: Number(rawDepositData.total_payment || (Number(finalNominal) + Number(rawDepositData.fee || 0)))
            };

            if (isUpdate) {
                db.prepare(`
                    UPDATE deposits SET 
                        method = ?, fee = ?, qr_image_url = ?, 
                        payment_number = ?, gateway_response = ?, 
                        expired_at = ?, total_payment = ?
                    WHERE id = ?
                `).run(method, recordPayload.fee, recordPayload.qrImageUrl, recordPayload.paymentNumber, recordPayload.gatewayResponse, recordPayload.expiredAt, recordPayload.totalPayment, depoId);
            } else {
                createDepositRecord(recordPayload);
            }

            sendTelegram(ADMIN_CHAT_ID, `💰 <b>Deposit ${isUpdate ? 'Ganti Metode' : 'Baru'} (${activeGateway.toUpperCase()})</b>\n👤 ${user.name}\n💵 Rp ${finalNominal.toLocaleString('id-ID')}\n💳 ${method}\n📈 Ref: ${reffId}\n📉 Status: PENDING`);
            res.json({ status: 'success', data: recordPayload });
        } else {
            res.status(400).json({ status: 'error', message: gatewayData.message || 'Gateway menolak deposit.' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Gagal menghubungi gateway.' });
    }
};

export const cancelDepo = async (req, res) => {
    const { deposit_id } = req.body;
    const user = req.user;

    try {
        const deposit = db.prepare('SELECT * FROM deposits WHERE id = ? AND user_id = ?').get(deposit_id, user.id);
        if (!deposit || deposit.status !== 'pending') {
            return res.status(400).json({ status: 'error', message: 'Deposit tidak valid.' });
        }

        const activeGateway = getSetting('active_deposit_method') || 'ciaatopup';
        if (activeGateway === 'pakasir') {
            await fetch('https://app.pakasir.com/api/transactioncancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project: PAKASIR_SLUG, order_id: deposit.reff_id, amount: deposit.nominal, api_key: PAKASIR_API_KEY })
            });
        }

        db.prepare('UPDATE deposits SET status = ? WHERE id = ?').run('canceled', deposit.id);
        res.json({ status: 'success', message: 'Deposit berhasil dibatalkan.' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Gagal membatalkan deposit.' });
    }
};

export const getProducts = async (req, res) => {
    try {
        const profitPercent = getSetting('profit_percent') || '0';
        const products = await PaymentService.fetchCiaaProducts(profitPercent);
        res.json({ status: 'success', data: products });
    } catch (error) {
        res.status(500).json({ status: 'error', data: [] });
    }
};

export const getDepoMethods = async (req, res) => {
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
        const data = await PaymentService.fetchCiaaDepositMethods();
        res.json({ status: 'success', data: data.data || data || [] });
    } catch (error) {
        res.status(500).json({ status: 'error', data: [] });
    }
};

export const syncTxStatus = async (req, res) => {
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    if (!tx || (req.user.role !== 'admin' && tx.user_id !== req.user.id)) {
        return res.status(404).json({ status: 'error', message: 'Transaksi tidak ditemukan.' });
    }

    const targetId = tx.vendor_id || tx.reff_id;
    if (!targetId) return res.json({ status: 'error', message: 'ID Vendor tidak ada.' });

    try {
        const data = await PaymentService.syncCiaaTransaction(targetId);
        if (data.status === 'success' && data.data) {
            const newStatus = data.data.status;
            if (newStatus !== tx.status) {
                updateTransactionStatus(tx.id, newStatus, JSON.stringify(data));
                if (newStatus === 'failed') addBalance(tx.user_id, tx.price);
            }
            return res.json({ status: 'success', data: data.data });
        }
        res.json({ status: 'error', message: data.message || 'Gagal sinkron status.' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

export const syncDepoStatus = async (req, res) => {
    const depo = db.prepare('SELECT * FROM deposits WHERE id = ?').get(req.params.id);
    if (!depo || (req.user.role !== 'admin' && depo.user_id !== req.user.id)) {
        return res.status(404).json({ status: 'error', message: 'Deposit tidak ditemukan.' });
    }

    try {
        let newStatus = depo.status;
        if (depo.method.includes('Pakasir') || !depo.vendor_id) {
            const url = `https://app.pakasir.com/api/transactiondetail?project=${PAKASIR_SLUG}&amount=${depo.nominal}&order_id=${depo.reff_id}&api_key=${PAKASIR_API_KEY}`;
            const resDet = await fetch(url);
            const gatewayData = await resDet.json();
            if (gatewayData.transaction?.status === 'completed') newStatus = 'success';
        } else {
            const gatewayData = await (await fetch('https://ciaatopup.my.id/api/h2h/deposit/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: depo.vendor_id, api_key: process.env.CIAA_API_KEY })
            })).json();
            if (gatewayData.status === 'success' && gatewayData.data) newStatus = gatewayData.data.status;
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
};
