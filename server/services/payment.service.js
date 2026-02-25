import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const CIAA_API_KEY = process.env.CIAA_API_KEY;
const PAKASIR_SLUG = process.env.PAKASIR_SLUG;
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY;

async function safeFetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');

    if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error(`❌ [API_ERR] Non-JSON response from ${url}:`, text.substring(0, 100));
        throw new Error('Vendor API sedang mengalami gangguan (Respon non-JSON).');
    }

    return await response.json();
}

/**
 * Fetch products from CiaaTopUp with profit margin calculation
 */
export async function fetchCiaaProducts(profitPercent = '0') {
    const data = await safeFetchJson('https://ciaatopup.my.id/api/h2h/price-list/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            api_key: CIAA_API_KEY,
            filter_status: 'true',
            profit_percent: profitPercent
        })
    });

    let rawProducts = [];
    if (Array.isArray(data.data)) {
        rawProducts = data.data;
    } else if (Array.isArray(data)) {
        rawProducts = data;
    } else if (data.data && typeof data.data === 'object') {
        rawProducts = Object.values(data.data).flat();
    }

    return rawProducts
        .filter(p => p && typeof p === 'object')
        .map(p => ({
            ...p,
            price: typeof p.price === 'string' ? parseFloat(p.price) : (p.price || 0),
            available: p.status === 'active' || p.available === true
        }))
        .filter(p => p.price > 0);
}

/**
 * Create a transaction on CiaaTopUp
 */
export async function createCiaaTransaction(product_code, target, reff_id) {
    const payload = { product_code, target, reff_id, api_key: CIAA_API_KEY };
    return await safeFetchJson('https://ciaatopup.my.id/api/h2h/transaction/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

/**
 * Sync transaction status from CiaaTopUp
 */
export async function syncCiaaTransaction(vendor_id) {
    return await safeFetchJson('https://ciaatopup.my.id/api/h2h/transaction/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vendor_id, api_key: CIAA_API_KEY })
    });
}

/**
 * Create deposit on CiaaTopUp
 */
export async function createCiaaDeposit(nominal, method, reff_id) {
    return await safeFetchJson('https://ciaatopup.my.id/api/h2h/deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nominal, method, reff_id, api_key: CIAA_API_KEY })
    });
}

/**
 * Fetch deposit methods from CiaaTopUp
 */
export async function fetchCiaaDepositMethods() {
    return await safeFetchJson('https://ciaatopup.my.id/api/h2h/deposit/methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: CIAA_API_KEY })
    });
}

/**
 * Create deposit on Pakasir
 */
export async function createPakasirDeposit(nominal, method, reff_id, frontendUrl) {
    const redirectUrl = `${frontendUrl}/profile`;
    const payload = {
        project: PAKASIR_SLUG,
        order_id: reff_id,
        amount: nominal,
        api_key: PAKASIR_API_KEY,
        redirect: redirectUrl
    };
    const rawData = await safeFetchJson(`https://app.pakasir.com/api/transactioncreate/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (rawData.payment) {
        return {
            status: 'success',
            data: {
                fee: rawData.payment.fee,
                qr_image_url: rawData.payment.payment_method === 'qris'
                    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(rawData.payment.payment_number)}`
                    : null,
                payment_number: rawData.payment.payment_number,
                expired_at: rawData.payment.expired_at,
                total_payment: rawData.payment.total_payment
            }
        };
    }
    return { status: 'error', message: rawData.message || 'Pakasir error' };
}
