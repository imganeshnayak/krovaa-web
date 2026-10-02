import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ✅ Correct base URL per ShipRocket API docs
const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

let cachedToken = null;
let tokenExpiry = null;

// ─── VALID INDIAN STATE CODES (per deliverydata.md) ───────────────────────────
const VALID_STATE_CODES = [
    'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'CT',
    'DD', 'DL', 'DN', 'GA', 'GJ', 'HR', 'HP', 'JK',
    'JH', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN',
    'ME', 'MZ', 'NL', 'OD', 'PB', 'PY', 'RJ', 'SK',
    'TN', 'TR', 'TS', 'UP', 'UK', 'WB'
];

/**
 * Retry wrapper with exponential backoff (per deliverydata.md / checklist)
 */
async function withRetry(fn, maxRetries = 3, label = 'ShipRocket call') {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const status = error.response?.status || error.code;

            if (status === 401) {
                // Auth failure — invalidate cached token and retry once
                cachedToken = null;
                tokenExpiry = null;
                if (attempt < maxRetries) continue;
                throw new Error('ShipRocket credentials invalid. Please check SHIPROCKET_EMAIL/PASSWORD in .env');
            }

            if (status === 400) {
                // Validation failure — don't retry, surface the error
                const msg = error.response?.data?.message || error.message;
                throw new Error(`ShipRocket validation error: ${msg}`);
            }

            if (status === 409) {
                // Duplicate shipment — don't retry
                throw new Error('Shipment already exists for this order in ShipRocket');
            }

            if (status === 429) {
                // Rate limited — wait longer
                const waitMs = Math.pow(2, attempt) * 2000;
                console.log(`[ShipRocket] Rate limited on ${label}. Retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})`);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
            }

            // Generic error — retry with linear backoff
            if (attempt < maxRetries) {
                const waitMs = attempt * 2000;
                console.log(`[ShipRocket] ${label} failed (attempt ${attempt}/${maxRetries}): ${error.message}. Response data:`, error.response?.data || 'N/A', `. Retrying in ${waitMs}ms`);
                await new Promise(r => setTimeout(r, waitMs));
            }
        }
    }
    const finalDataMsg = lastError?.response?.data ? JSON.stringify(lastError.response.data) : lastError?.message;
    throw new Error(`${label} failed after ${maxRetries} attempts: ${finalDataMsg}`);
}

/**
 * Authenticate with ShipRocket and cache the JWT token (valid ~24hrs)
 * Uses centralized platform account from env vars (Option A per checklist)
 */
export const authenticate = async () => {
    // Reuse token if valid for at least 5 more minutes
    if (cachedToken && tokenExpiry && new Date().getTime() + 300000 < tokenExpiry) {
        return cachedToken;
    }

    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;

    // Use dummy mode if credentials are missing OR if they are the default placeholders I added
    const isPlaceholder = email === 'your_shiprocket_email@example.com' || email?.includes('example.com');
    if (!email || !password || isPlaceholder) {
        console.warn('[ShipRocket] No real credentials found — using dummy mode for development.');
        return 'dummy_token';
    }

    try {
        // ✅ Correct auth endpoint
        const response = await axios.post(`${SHIPROCKET_BASE_URL}/auth/login`, {
            email,
            password
        });

        cachedToken = response.data.token;
        // Tokens expire in 24 hours; cache for 23.5 hours to be safe
        tokenExpiry = new Date().getTime() + (23.5 * 60 * 60 * 1000);
        console.log('[ShipRocket] Authenticated successfully.');
        return cachedToken;
    } catch (error) {
        console.error('[ShipRocket] Authentication failed:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with ShipRocket. Check credentials in .env');
    }
};

/**
 * Check pincode serviceability before creating shipment (per deliverydata.md)
 */
export const checkServiceability = async ({ pickup_postcode, delivery_postcode, weight, cod = 0 }) => {
    try {
        const token = await authenticate();

        if (token === 'dummy_token') {
            return {
                status: 200,
                data: {
                    available_courier_companies: [
                        { rate: 150, courier_name: 'Dummy Express', etd: '3-4 Days' }
                    ]
                }
            };
        }

        const response = await axios.get(`${SHIPROCKET_BASE_URL}/courier/serviceability/`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { pickup_postcode, delivery_postcode, weight, cod }
        });

        return response.data;
    } catch (error) {
        console.error('[ShipRocket] checkServiceability failed:', error.response?.data || error.message);
        throw new Error('Failed to check shipping serviceability');
    }
};

/**
 * Validate an OrderAddress against ShipRocket + business rules (per deliverydata.md)
 */
export const validateAddress = (address) => {
    const errors = [];

    if (!address.addressLine1 || address.addressLine1.length < 10) {
        errors.push('Street address must be at least 10 characters');
    }

    if (!/^[6-9]\d{9}$/.test(address.phoneNumber)) {
        errors.push('Invalid Indian phone number (must start with 6-9)');
    }

    if (!/^\d{6}$/.test(address.pincode)) {
        errors.push('Pincode must be exactly 6 digits');
    }

    if (!VALID_STATE_CODES.includes(address.state)) {
        errors.push(`Invalid state code: ${address.state}. Use 2-letter state code (e.g. MH, DL)`);
    }

    const blocked = ['PO BOX', 'P.O BOX', 'P O BOX', 'POST BOX'];
    if (blocked.some(kw => address.addressLine1.toUpperCase().includes(kw))) {
        errors.push('PO Box addresses are not accepted by couriers');
    }

    return errors;
};

/**
 * Add a new pickup location to ShipRocket
 */
export const addPickupLocation = async (user, contactInfo = {}) => {
    return withRetry(async () => {
        const token = await authenticate();

        if (token === 'dummy_token') {
            return {
                success: true,
                pickup_id: `DUMMY_LOC_${Date.now()}`,
                address: {
                    pickup_code: `vendor_${user.id}_${Date.now()}`
                }
            };
        }

        let sanitizedName = (contactInfo.name || user.businessName || user.displayName || user.username || 'vendor')
            .trim()
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 15);
        const pickupName = `${sanitizedName}_${user.id}_${Date.now().toString().slice(-6)}`;
        
        const payload = {
            pickup_location: pickupName,
            name: contactInfo.name || user.businessName || user.username || user.displayName,
            email: contactInfo.email || user.email,
            phone: contactInfo.phone || user.phoneNumber,
            address: user.businessAddress,
            address_2: user.businessLandmark || '',
            city: user.businessCity,
            state: user.businessState,
            country: 'India',
            pin_code: user.businessPincode
        };

        const response = await axios.post(
            `${SHIPROCKET_BASE_URL}/settings/company/addpickup`,
            payload,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    }, 2, 'addPickupLocation');
};

/**
 * Build the complete ShipRocket forward-shipment payload from our DB data
 * Maps all fields per deliverydata.md ShipRocket API Payload Mapping section
 */
export const buildShipRocketPayload = ({ deal, orderItems, address, warehouse }) => {
    const orderDate = new Date(deal.createdAt).toISOString().split('T')[0];

    return {
        // Order identifiers
        order_id: `KROVAA_${deal.id}_${Date.now()}`,
        order_date: orderDate,

        // Pickup config — uses seller's dynamic pickup location or master fallback
        pickup_location: deal.vendor?.shiprocketPickupName || process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
        channel_id: process.env.SHIPROCKET_CHANNEL_ID || '',

        // Billing info (buyer) — mapped per deliverydata.md
        billing_customer_name: address.fullName,
        billing_last_name: '',
        billing_email: address.email || '',
        billing_phone: address.phoneNumber,
        billing_address: address.addressLine1,
        billing_address_2: address.addressLine2 || address.landmark || '',
        billing_city: address.city,
        billing_state: address.state,  // ✅ 2-letter state code, not city
        billing_country: 'IN',
        billing_pincode: address.pincode,

        // Shipping address (same as billing by default)
        shipping_is_billing: address.isBillingSame !== false,
        shipping_customer_name: address.fullName,
        shipping_last_name: '',
        shipping_email: address.email || '',
        shipping_phone: address.phoneNumber,
        shipping_address: address.addressLine1,
        shipping_address_2: address.addressLine2 || address.landmark || '',
        shipping_city: address.city,
        shipping_state: address.state,
        shipping_country: 'IN',
        shipping_pincode: address.pincode,

        // Order items
        order_items: orderItems.map(item => ({
            name: item.name || deal.title,
            sku: item.sku || `SKU_${deal.id}`,
            units: item.units || 1,
            selling_price: String(item.sellingPrice || deal.totalAmount),
            discount: '',
            tax: '',
            hsn: item.hsnCode || ''
        })),

        // Package dimensions — from seller input at ship time
        weight: deal.shippingWeight || 0.5,
        length: deal.shippingDimensions ? parseFloat(deal.shippingDimensions.split('x')[0]) || 15 : 15,
        breadth: deal.shippingDimensions ? parseFloat(deal.shippingDimensions.split('x')[1]) || 15 : 15,
        height: deal.shippingDimensions ? parseFloat(deal.shippingDimensions.split('x')[2]) || 10 : 10,

        // Payment & amounts
        payment_method: 'Prepaid',
        sub_total: deal.totalAmount,
        shipping_charges: 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: 0,
        cod_amount: 0,

        // Additional info
        comment: deal.description || '',
        is_return: false,
    };
};

/**
 * Create a ShipRocket order from an EscrowDeal
 * Called when seller clicks "Generate Label & Ship"
 */
export const createOrderFromDeal = async (dealId) => {
    return withRetry(async () => {
        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId },
            include: {
                client: true,
                vendor: true,
                dealListing: true,
                shippingAddress: true  // ✅ Now uses OrderAddress relation
            }
        });

        if (!deal || !deal.dealListing || deal.dealListing.deliveryType !== 'shipping') {
            return null; // Not a physical shipment
        }

        // ✅ Use proper OrderAddress if available, else fall back to user profile
        const address = deal.shippingAddress || {
            fullName: deal.client.displayName || deal.client.username,
            phoneNumber: deal.client.phoneNumber,
            addressLine1: deal.client.businessAddress || deal.client.city || '',
            addressLine2: '',
            city: deal.client.city || '',
            state: deal.client.businessState || '',
            pincode: deal.client.pincode || '',
            email: deal.client.email,
            isBillingSame: true
        };

        // Validate address before calling ShipRocket
        const validationErrors = validateAddress(address);
        if (validationErrors.length > 0) {
            console.error('[ShipRocket] Address validation failed:', validationErrors);
            throw new Error(`Invalid buyer address: ${validationErrors.join(', ')}`);
        }

        const orderItems = [{
            name: deal.title,
            sku: `SKU_${deal.dealListing.id || deal.id}`,
            units: 1,
            sellingPrice: deal.totalAmount,
            hsnCode: ''
        }];

        const payload = buildShipRocketPayload({ deal, orderItems, address });

        const token = await authenticate();

        if (token === 'dummy_token') {
            const dummyResult = {
                order_id: `SR_DUMMY_${Date.now()}`,
                shipment_id: `SHP_DUMMY_${Date.now()}`,
                status: 'NEW',
                awb_code: null
            };
            await prisma.escrowDeal.update({
                where: { id: dealId },
                data: {
                    shiprocketOrderId: dummyResult.order_id.toString(),
                    shiprocketShipmentId: dummyResult.shipment_id.toString()
                }
            });
            return dummyResult;
        }

        // ? Correct endpoint per ShipRocket API docs
        const response = await axios.post(
            `${SHIPROCKET_BASE_URL}/orders/create/adhoc`,
            payload,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const result = response.data;

        if (result && (result.order_id || result.payload?.order_id)) {
            const srOrderId = (result.order_id || result.payload?.order_id).toString();
            const srShipmentId = (result.shipment_id || result.payload?.shipment_id)?.toString();

            await prisma.escrowDeal.update({
                where: { id: dealId },
                data: {
                    shiprocketOrderId: srOrderId,
                    shiprocketShipmentId: srShipmentId || null
                }
            });
        }

        return result;
    }, 3, 'createOrderFromDeal');
};

/**
 * Generate AWB code for a shipment (assigns courier)
 */
export const generateAWB = async (shipmentId) => {
    return withRetry(async () => {
        const token = await authenticate();

        if (token === 'dummy_token') {
            return {
                response: {
                    data: {
                        awb_code: 'AWB_DUMMY_' + Date.now(),
                        courier_name: 'Dummy Express',
                        courier_id: 1
                    }
                }
            };
        }

        const response = await axios.post(
            `${SHIPROCKET_BASE_URL}/courier/assign/awb`,
            { shipment_id: shipmentId.toString() },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    }, 3, 'generateAWB');
};

/**
 * Request pickup for a shipment
 */
export const requestPickup = async (shipmentId) => {
    return withRetry(async () => {
        const token = await authenticate();

        if (token === 'dummy_token') {
            return { pickup_status: 1 };
        }

        const response = await axios.post(
            `${SHIPROCKET_BASE_URL}/courier/generate/pickup`,
            { shipment_id: [shipmentId.toString()] },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    }, 3, 'requestPickup');
};

/**
 * Generate shipping label PDF
 */
export const generateLabel = async (shipmentId) => {
    return withRetry(async () => {
        const token = await authenticate();

        if (token === 'dummy_token') {
            return { label_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' };
        }

        // ? Correct endpoint per ShipRocket API docs
        const response = await axios.post(
            `${SHIPROCKET_BASE_URL}/courier/generate/label`,
            { shipment_id: [parseInt(shipmentId)] },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    }, 3, 'generateLabel');
};

/**
 * Track a shipment by AWB code (for polling fallback)
 */
export const trackShipment = async (awbCode) => {
    return withRetry(async () => {
        const token = await authenticate();

        if (token === 'dummy_token') {
            return {
                tracking_data: {
                    current_status: 'In Transit',
                    shipment_track_activities: []
                }
            };
        }

        const response = await axios.get(
            `${SHIPROCKET_BASE_URL}/courier/track/awb/${awbCode}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    }, 2, 'trackShipment');
};

/**
 * Cancel a Shiprocket order
 * @param {Array<number|string>} orderIds - Array of Shiprocket order IDs to cancel
 */
export const cancelShiprocketOrder = async (orderIds) => {
    return withRetry(async () => {
        const token = await authenticate();

        if (token === 'dummy_token') {
            return {
                status_code: 200,
                message: "Order Cancelled Successfully."
            };
        }

        const response = await axios.post(
            `${SHIPROCKET_BASE_URL}/orders/cancel`,
            { ids: orderIds.map(id => parseInt(id, 10)) },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    }, 2, 'cancelShiprocketOrder');
};

/**
 * Generate manifest PDF (acknowledgement document)
 */
export const generateManifest = async (shipmentId) => {
    return withRetry(async () => {
        const token = await authenticate();

        if (token === 'dummy_token') {
            return { manifest_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' };
        }

        const response = await axios.post(
            `${SHIPROCKET_BASE_URL}/manifests/generate`,
            { shipment_id: [parseInt(shipmentId)] },
            { headers: { Authorization: `Bearer ${token}` } }
        );
 
        return response.data;
    }, 3, 'generateManifest');
};
 
/**
 * Create a ShipRocket return order from an EscrowDeal
 * Called when buyer requests return/refund
 */
export const createReturnOrder = async (dealId) => {
    return withRetry(async () => {
        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId },
            include: {
                client: true,
                vendor: true,
                dealListing: true,
                shippingAddress: true
            }
        });
 
        if (!deal) {
            throw new Error('Deal not found.');
        }
 
        // Reverse: Pickup is the Buyer (client), Shipping is the Seller (vendor)
        const pickupAddress = deal.shippingAddress || {
            fullName: deal.client.displayName || deal.client.username,
            phoneNumber: deal.client.phoneNumber || '9999999999',
            addressLine1: deal.client.businessAddress || deal.client.city || 'Address line 1',
            addressLine2: '',
            city: deal.client.city || 'City',
            state: deal.client.businessState || 'State',
            pincode: deal.client.pincode || '110001',
            email: deal.client.email || 'buyer@krovaa.com'
        };
 
        const shippingAddress = {
            fullName: deal.vendor.displayName || deal.vendor.username,
            phoneNumber: deal.vendor.phoneNumber || '9999999999',
            addressLine1: deal.vendor.businessAddress || deal.vendor.city || 'Address line 1',
            addressLine2: '',
            city: deal.vendor.city || 'City',
            state: deal.vendor.businessState || 'State',
            pincode: deal.vendor.pincode || '110001',
            email: deal.vendor.email || 'seller@krovaa.com'
        };
 
        const payload = {
            order_id: `KROVAA_RETURN_${deal.id}_${Date.now()}`,
            order_date: new Date().toISOString().split('T')[0],
            channel_id: process.env.SHIPROCKET_CHANNEL_ID || '',
            pickup_customer_name: pickupAddress.fullName,
            pickup_last_name: '',
            pickup_address: pickupAddress.addressLine1,
            pickup_address_2: pickupAddress.addressLine2 || '',
            pickup_city: pickupAddress.city,
            pickup_state: pickupAddress.state,
            pickup_country: 'IN',
            pickup_pincode: pickupAddress.pincode,
            pickup_phone: pickupAddress.phoneNumber,
            pickup_email: pickupAddress.email || '',
 
            shipping_customer_name: shippingAddress.fullName,
            shipping_last_name: '',
            shipping_address: shippingAddress.addressLine1,
            shipping_address_2: shippingAddress.addressLine2 || '',
            shipping_city: shippingAddress.city,
            shipping_state: shippingAddress.state,
            shipping_country: 'IN',
            shipping_pincode: shippingAddress.pincode,
            shipping_phone: shippingAddress.phoneNumber,
            shipping_email: shippingAddress.email || '',
 
            order_items: [{
                name: deal.title,
                sku: `SKU_${deal.dealListingId || deal.id}`,
                units: 1,
                selling_price: String(deal.totalAmount)
            }],
            payment_method: 'Prepaid',
            sub_total: deal.totalAmount,
            weight: deal.shippingWeight || 0.5,
            length: 15,
            breadth: 15,
            height: 10
        };
 
        const token = await authenticate();
 
        if (token === 'dummy_token') {
            const dummyResult = {
                order_id: `SR_RET_DUMMY_${Date.now()}`,
                shipment_id: `SHP_RET_DUMMY_${Date.now()}`,
                status: 'NEW',
                awb_code: 'AWB_RET_DUMMY_' + Date.now()
            };
            return dummyResult;
        }
 
        const response = await axios.post(
            `${SHIPROCKET_BASE_URL}/orders/create/return`,
            payload,
            { headers: { Authorization: `Bearer ${token}` } }
        );
 
        return response.data;
    }, 3, 'createReturnOrder');
};
