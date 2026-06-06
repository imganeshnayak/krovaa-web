import PDFDocument from 'pdfkit';
import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';

const formatCurrency = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency,
  maximumFractionDigits: Number.isInteger(Number(amount || 0)) ? 0 : 2,
}).format(Number(amount || 0));

export function buildEscrowInvoicePdf(deal, client, vendor, feeAmount) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const accent = '#00A4EF';
    const dark = '#111827';
    const muted = '#6B7280';
    const border = '#E5E7EB';
    const light = '#F9FAFB';

    doc.rect(0, 0, doc.page.width, 18).fill(accent);
    doc.moveDown(2);
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(22).text('Krovaa Escrow Invoice', { align: 'center' });
    doc.moveDown(0.6);
    doc.fillColor(muted).font('Helvetica').fontSize(10).text('Tax Invoice for Deal Creation and Payment', { align: 'center' });

    const summaryTop = 140;
    doc.roundedRect(48, summaryTop, doc.page.width - 96, 92, 12).lineWidth(1).strokeColor(border).stroke();
    
    // Client Details
    doc.fillColor(muted).font('Helvetica').fontSize(10).text('Billed To (Client)', 64, summaryTop + 16);
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(12).text(client.displayName || client.username, 64, summaryTop + 32);
    doc.fillColor(muted).font('Helvetica').fontSize(10).text(`@${client.username}`, 64, summaryTop + 50);

    // Vendor Details
    doc.fillColor(muted).font('Helvetica').fontSize(10).text('Vendor', 330, summaryTop + 16);
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(12).text(vendor.displayName || vendor.username, 330, summaryTop + 32);
    doc.fillColor(muted).font('Helvetica').fontSize(10).text(`@${vendor.username}`, 330, summaryTop + 50);

    const rows = [
      ['Deal ID', `DL-${deal.id}`],
      ['Title', deal.title],
      ['Date', new Date(deal.createdAt || Date.now()).toLocaleString()],
      ['Gross Deal Amount', formatCurrency(deal.totalAmount, 'INR')],
      ['Platform Fee', formatCurrency(feeAmount, 'INR')],
      ['Net Vendor Payment', formatCurrency(deal.totalAmount - feeAmount, 'INR')],
      ['Status', 'PAID TO ESCROW'],
    ];

    const rowStart = summaryTop + 122;
    rows.forEach(([label, value], index) => {
      const rowY = rowStart + (index * 30);
      doc.roundedRect(48, rowY, doc.page.width - 96, 24, 8).fillAndStroke(light, border);
      doc.fillColor(muted).font('Helvetica').fontSize(10).text(label, 64, rowY + 8);
      doc.fillColor(dark).font('Helvetica-Bold').fontSize(10).text(String(value), 260, rowY + 8, {
        width: doc.page.width - 324,
        align: 'right'
      });
    });

    const footerTop = rowStart + (rows.length * 30) + 28;
    doc.fillColor(muted).font('Helvetica').fontSize(10).text('This is an automatically generated receipt. Keep it for your records.', 48, footerTop, { width: doc.page.width - 96, align: 'center' });

    doc.end();
  });
}

export function buildWalletInvoicePdf(amount, user, reference) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const accent = '#0FB881';
    const dark = '#111827';
    const muted = '#6B7280';
    const border = '#E5E7EB';
    const light = '#F9FAFB';

    doc.rect(0, 0, doc.page.width, 18).fill(accent);
    doc.moveDown(2);
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(22).text('Krovaa Wallet Receipt', { align: 'center' });
    doc.moveDown(0.6);
    doc.fillColor(muted).font('Helvetica').fontSize(10).text('Receipt for Wallet Credit/Top-up', { align: 'center' });

    const summaryTop = 140;
    doc.roundedRect(48, summaryTop, doc.page.width - 96, 92, 12).lineWidth(1).strokeColor(border).stroke();
    
    // User Details
    doc.fillColor(muted).font('Helvetica').fontSize(10).text('Customer', 64, summaryTop + 16);
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(12).text(user.displayName || user.username, 64, summaryTop + 32);
    doc.fillColor(muted).font('Helvetica').fontSize(10).text(user.email || `@${user.username}`, 64, summaryTop + 50);

    // Ref Details
    doc.fillColor(muted).font('Helvetica').fontSize(10).text('Reference ID', 330, summaryTop + 16);
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(12).text(reference || `TXN-${Date.now()}`, 330, summaryTop + 32);
    doc.fillColor(muted).font('Helvetica').fontSize(10).text(new Date().toLocaleString(), 330, summaryTop + 50);

    const rows = [
      ['Amount Credited', formatCurrency(amount, 'INR')],
      ['Status', 'SUCCESS'],
      ['Date', new Date().toLocaleString()],
      ['Wallet Balance', formatCurrency(user.walletBalance, 'INR')],
    ];

    const rowStart = summaryTop + 122;
    rows.forEach(([label, value], index) => {
      const rowY = rowStart + (index * 30);
      doc.roundedRect(48, rowY, doc.page.width - 96, 24, 8).fillAndStroke(light, border);
      doc.fillColor(muted).font('Helvetica').fontSize(10).text(label, 64, rowY + 8);
      doc.fillColor(dark).font('Helvetica-Bold').fontSize(10).text(String(value), 260, rowY + 8, {
        width: doc.page.width - 324,
        align: 'right'
      });
    });

    const footerTop = rowStart + (rows.length * 30) + 28;
    doc.fillColor(muted).font('Helvetica').fontSize(10).text('This is an automatically generated receipt. Keep it for your records.', 48, footerTop, { width: doc.page.width - 96, align: 'center' });

    doc.end();
  });
}

export function uploadPdfToCloudinary(pdfBuffer, filename) {
  return new Promise((resolve, reject) => {
    if (process.env.CLOUDINARY_API_KEY === 'your_api_key' || !process.env.CLOUDINARY_API_KEY) {
      console.warn("Cloudinary not configured. Falling back to Base64 Data URI for invoice.");
      const base64Str = pdfBuffer.toString('base64');
      return resolve({ secure_url: `data:application/pdf;base64,${base64Str}` });
    }

    const stream = cloudinary.uploader.upload_stream(
      { 
        folder: 'krovaa/invoices', 
        resource_type: 'raw',
        public_id: filename,
        access_mode: 'public' 
      },
      (error, result) => {
        if (error) {
            console.warn("Cloudinary upload failed. Falling back to Base64 Data URI.", error);
            const base64Str = pdfBuffer.toString('base64');
            resolve({ secure_url: `data:application/pdf;base64,${base64Str}` });
        } else {
            resolve(result);
        }
      }
    );
    streamifier.createReadStream(pdfBuffer).pipe(stream);
  });
}
