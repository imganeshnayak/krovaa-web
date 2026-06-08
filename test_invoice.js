import { buildEscrowInvoicePdf, uploadPdfToCloudinary } from './backend/services/invoiceService.js';
import fs from 'fs';

(async () => {
    try {
        const deal = { id: 1, title: 'Test Deal', totalAmount: 1000, createdAt: new Date() };
        const client = { username: 'client', displayName: 'Client User' };
        const vendor = { username: 'vendor', displayName: 'Vendor User' };
        
        console.log("Building PDF...");
        const pdfBuffer = await buildEscrowInvoicePdf(deal, client, vendor, 100);
        console.log("PDF Built! Buffer length:", pdfBuffer.length);
        
        console.log("Uploading to Cloudinary...");
        const uploadRes = await uploadPdfToCloudinary(pdfBuffer, `test_invoice_${Date.now()}`);
        console.log("Upload Success! URL:", uploadRes.secure_url);
    } catch (e) {
        console.error("TEST ERROR:", e);
    }
})();
