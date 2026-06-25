import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/payload';

let cachedToken = null;
let tokenExpiry = null;

/**
 * Authenticate with Shiprocket and retrieve JWT token
 */
export const authenticate = async () => {
    // If token is valid for at least 5 more minutes, use it
    if (cachedToken && tokenExpiry && new Date().getTime() + 300000 < tokenExpiry) {
        return cachedToken;
    }

    try {
        const email = process.env.SHIPROCKET_EMAIL || 'test@example.com';
        const password = process.env.SHIPROCKET_PASSWORD || 'testpassword';

        // Note: For actual Shiprocket API, the endpoint is /auth/login
        const response = await axios.post(`${SHIPROCKET_BASE_URL}/user/login`, {
            email,
            password
        });

        cachedToken = response.data.token;
        // Shiprocket tokens usually expire in 240 hours, but we set a safe expiry
        tokenExpiry = new Date().getTime() + (24 * 60 * 60 * 1000); // 24 hours

        return cachedToken;
    } catch (error) {
        console.error('Shiprocket authentication failed:', error.response?.data || error.message);
        // For development/testing without real credentials, return a dummy token
        if (!process.env.SHIPROCKET_EMAIL) {
            console.log('Using dummy Shiprocket token for development.');
            return 'dummy_token';
        }
        throw new Error('Failed to authenticate with Shiprocket');
    }
};

/**
 * Check serviceability and get estimated shipping cost
 */
export const checkServiceability = async ({ pickup_postcode, delivery_postcode, weight, cod = 0 }) => {
    try {
        const token = await authenticate();
        if (token === 'dummy_token') {
            // Return dummy rate for dev
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
        console.error('Shiprocket checkServiceability failed:', error.response?.data || error.message);
        throw new Error('Failed to calculate shipping cost');
    }
};

/**
 * Create a custom order in Shiprocket
 */
export const createCustomOrder = async (orderData) => {
    try {
        const token = await authenticate();
        if (token === 'dummy_token') {
            return {
                order_id: 'SR_DUMMY_' + Date.now(),
                shipment_id: 'SHP_DUMMY_' + Date.now(),
                status: 'NEW'
            };
        }

        const response = await axios.post(`${SHIPROCKET_BASE_URL}/orders/create/adhoc`, orderData, {
            headers: { Authorization: `Bearer ${token}` }
        });

        return response.data;
    } catch (error) {
        console.error('Shiprocket createCustomOrder failed:', error.response?.data || error.message);
        throw new Error('Failed to create order in Shiprocket');
    }
};

/**
 * Automatically create a Shiprocket order from an EscrowDeal
 */
export const createOrderFromDeal = async (dealId) => {
    try {
        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId },
            include: {
                client: true,
                vendor: true,
                dealListing: true
            }
        });

        if (!deal || !deal.dealListing || deal.dealListing.deliveryType !== 'shipping') {
            return null; // Not a shipped item or missing listing
        }

        const buyer = deal.client;
        const seller = deal.vendor;
        const listing = deal.dealListing;

        if (!buyer.pincode || !buyer.city || !buyer.phoneNumber) {
            console.error('Buyer missing address details for Shiprocket order', dealId);
            return null;
        }

        const orderData = {
            order_id: `KROVAA_${deal.id}_${Date.now()}`,
            order_date: new Date().toISOString().slice(0, 10),
            pickup_location: "Primary", // Assuming seller configured this in Shiprocket
            channel_id: "",
            comment: deal.title,
            billing_customer_name: buyer.displayName || buyer.username,
            billing_last_name: "",
            billing_address: buyer.city,
            billing_address_2: buyer.location || "",
            billing_city: buyer.city,
            billing_pincode: buyer.pincode,
            billing_state: buyer.city, // simplified, ideally we'd have state
            billing_country: "India",
            billing_email: buyer.email,
            billing_phone: buyer.phoneNumber,
            shipping_is_billing: true,
            order_items: [
                {
                    name: deal.title,
                    sku: `SKU_${listing.id}`,
                    units: 1,
                    selling_price: deal.totalAmount,
                    discount: "",
                    tax: "",
                    hsn: ""
                }
            ],
            payment_method: "Prepaid",
            sub_total: deal.totalAmount,
            length: listing.shippingDimensions ? parseFloat(listing.shippingDimensions.split('x')[0]) || 10 : 10,
            breadth: listing.shippingDimensions ? parseFloat(listing.shippingDimensions.split('x')[1]) || 10 : 10,
            height: listing.shippingDimensions ? parseFloat(listing.shippingDimensions.split('x')[2]) || 10 : 10,
            weight: listing.shippingWeight || 1.0
        };

        const result = await createCustomOrder(orderData);
        
        if (result && result.order_id) {
            // Update EscrowDeal with Shiprocket order and shipment IDs
            await prisma.escrowDeal.update({
                where: { id: dealId },
                data: {
                    shiprocketOrderId: result.order_id.toString(),
                    shiprocketShipmentId: result.shipment_id.toString(),
                }
            });
            return result;
        }
        return null;
    } catch (error) {
        console.error('Failed to createOrderFromDeal:', error);
        return null;
    }
};

/**
 * Generate AWB for a shipment
 */
export const generateAWB = async (shipmentId) => {
    try {
        const token = await authenticate();
        if (token === 'dummy_token') {
            return {
                response: {
                    data: {
                        awb_code: 'AWB_DUMMY_' + Date.now(),
                        courier_name: 'Dummy Express'
                    }
                }
            };
        }

        const response = await axios.post(`${SHIPROCKET_BASE_URL}/courier/assign/awb`, {
            shipment_id: shipmentId
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        return response.data;
    } catch (error) {
        console.error('Shiprocket generateAWB failed:', error.response?.data || error.message);
        throw new Error('Failed to generate AWB');
    }
};

/**
 * Request pickup for a shipment
 */
export const requestPickup = async (shipmentId) => {
    try {
        const token = await authenticate();
        if (token === 'dummy_token') {
            return { pickup_status: 1 };
        }

        const response = await axios.post(`${SHIPROCKET_BASE_URL}/courier/generate/pickup`, {
            shipment_id: [shipmentId]
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        return response.data;
    } catch (error) {
        console.error('Shiprocket requestPickup failed:', error.response?.data || error.message);
        throw new Error('Failed to request pickup');
    }
};

/**
 * Generate Shipping Label
 */
export const generateLabel = async (shipmentId) => {
    try {
        const token = await authenticate();
        if (token === 'dummy_token') {
            return { label_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' };
        }

        const response = await axios.post(`${SHIPROCKET_BASE_URL}/courier/generate/label`, {
            shipment_id: [shipmentId]
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        return response.data;
    } catch (error) {
        console.error('Shiprocket generateLabel failed:', error.response?.data || error.message);
        throw new Error('Failed to generate shipping label');
    }
};
