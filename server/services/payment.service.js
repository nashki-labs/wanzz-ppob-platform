import dotenv from 'dotenv';
dotenv.config();

const CIAA_API_KEY = process.env.CIAA_API_KEY;
const PAKASIR_SLUG = process.env.PAKASIR_SLUG;
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY;

/**
 * Fetch products from CiaaTopUp with profit margin calculation
 */
export async function fetchCiaaProducts(profitPercent = '0') {
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
    const response = await fetch('https://ciaatopup.my.id/api/h2h/transaction/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return await response.json();
}

/**
 * Sync transaction status from CiaaTopUp
 */
export async function syncCiaaTransaction(vendor_id) {
    const response = await fetch('https://ciaatopup.my.id/api/h2h/transaction/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vendor_id, api_key: CIAA_API_KEY })
    });
    return await response.json();
}

/**
 * Create deposit on CiaaTopUp
 */
export async function createCiaaDeposit(nominal, method, reff_id) {
    const response = await fetch('https://ciaatopup.my.id/api/h2h/deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nominal, method, reff_id, api_key: CIAA_API_KEY })
    });
    return await response.json();
}

/**
 * Fetch deposit methods from CiaaTopUp
 */
export async function fetchCiaaDepositMethods() {
    const response = await fetch('https://ciaatopup.my.id/api/h2h/deposit/methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: CIAA_API_KEY })
    });
    return await response.json();
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
    const response = await fetch(`https://app.pakasir.com/api/transactioncreate/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const rawData = await response.json();

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
