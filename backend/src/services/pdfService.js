const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function formatInr(val) {
    const num = parseFloat(val || 0);
    return 'Rs. ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateInvoicePdf(invoiceData, outputStream) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 40,
                info: {
                    Title: `Invoice ${invoiceData.invoice_number}`,
                    Author: 'Duolink Finance',
                },
            });

            doc.pipe(outputStream);

            // Purple & White Theme Palette
            const primaryPurple = '#4C1D95'; // Royal Purple
            const vibrantPurple = '#6D28D9'; // Vibrant Purple
            const lightPurple = '#EDE9FE';   // Lavender
            const softPurpleBg = '#F5F3FF';  // Soft Tint
            const darkText = '#1E1B4B';
            const grayText = '#6B7280';
            const borderGray = '#E9E5F5';

            // Top Header Accent Bar
            doc.rect(0, 0, 595.28, 12).fill(primaryPurple);

            // Duolink Brand Logo / Header
            const logoPath = path.resolve(__dirname, '../../assets/logo.png');
            let textStartX = 40;
            if (fs.existsSync(logoPath)) {
                try {
                    doc.image(logoPath, 40, 26, { width: 48, height: 48 });
                    textStartX = 98;
                } catch (e) {
                    console.warn('Could not render logo in PDF:', e.message);
                }
            }

            doc.fillColor(primaryPurple)
               .fontSize(22)
               .font('Helvetica-Bold')
               .text('DUOLINK', textStartX, 32, { continued: true })
               .fillColor(vibrantPurple)
               .text(' FINANCE');

            doc.fontSize(8.5)
               .font('Helvetica')
               .fillColor(grayText)
               .text('Corporate Financial Management & Project Accounting (India)', textStartX, 56)
               .text('GSTIN: 33AAACD1234F1Z5 | finance@duolink.in | www.duolinkfinance.com', textStartX, 68);

            // Invoice Title & Status Badge
            const statusText = (invoiceData.status || 'ISSUED').toUpperCase();
            let badgeBg = '#EDE9FE';
            let badgeColor = '#5B21B6';
            if (statusText === 'PAID') {
                badgeBg = '#D1FAE5';
                badgeColor = '#065F46';
            } else if (statusText === 'PARTIALLY PAID') {
                badgeBg = '#FEF3C7';
                badgeColor = '#92400E';
            }

            doc.roundedRect(420, 35, 135, 24, 4).fill(badgeBg);
            doc.fillColor(badgeColor)
               .font('Helvetica-Bold')
               .fontSize(10)
               .text(statusText, 420, 42, { width: 135, align: 'center' });

            // Invoice Meta Box
            doc.fontSize(10).font('Helvetica-Bold').fillColor(darkText);
            doc.text(`INVOICE NO:`, 370, 72, { width: 90 });
            doc.font('Helvetica').text(invoiceData.invoice_number, 465, 72);

            doc.font('Helvetica-Bold').text(`DATE:`, 370, 88, { width: 90 });
            doc.font('Helvetica').text(new Date(invoiceData.invoice_date).toLocaleDateString('en-IN'), 465, 88);

            if (invoiceData.due_date) {
                doc.font('Helvetica-Bold').text(`DUE DATE:`, 370, 104, { width: 90 });
                doc.font('Helvetica').text(new Date(invoiceData.due_date).toLocaleDateString('en-IN'), 465, 104);
            }

            // Divider
            doc.moveTo(40, 125).lineTo(555, 125).strokeColor(borderGray).lineWidth(1).stroke();

            // Bill To & Project Section
            doc.rect(40, 135, 250, 85).fill(softPurpleBg);
            doc.fillColor(primaryPurple)
               .font('Helvetica-Bold')
               .fontSize(10)
               .text('BILL TO CLIENT', 50, 143);

            doc.fillColor(darkText)
               .font('Helvetica-Bold')
               .fontSize(11)
               .text(invoiceData.client_name || 'Client', 50, 158);

            doc.font('Helvetica')
               .fontSize(9)
               .fillColor(grayText)
               .text(invoiceData.client_contact || invoiceData.client_email || 'Contact details provided', 50, 172, { width: 230 });

            // Project Box
            doc.rect(305, 135, 250, 85).fill('#FAF9FE');
            doc.fillColor(primaryPurple)
               .font('Helvetica-Bold')
               .fontSize(10)
               .text('PROJECT DETAILS', 315, 143);

            doc.fillColor(darkText)
               .font('Helvetica-Bold')
               .fontSize(11)
               .text(invoiceData.project_name || 'Associated Project', 315, 158);

            doc.font('Helvetica')
               .fontSize(9)
               .fillColor(grayText)
               .text(`Project Code: ${invoiceData.project_code || 'N/A'}`, 315, 172)
               .text(`Contract Value: ${formatInr(invoiceData.contract_amount || 0)}`, 315, 186);

            // Items Table Header
            const tableTop = 235;
            doc.rect(40, tableTop, 515, 24).fill(primaryPurple);
            doc.fillColor('#FFFFFF')
               .font('Helvetica-Bold')
               .fontSize(9)
               .text('#', 50, tableTop + 7, { width: 20 })
               .text('ITEM / SERVICE DESCRIPTION', 75, tableTop + 7, { width: 250 })
               .text('QTY', 335, tableTop + 7, { width: 45, align: 'right' })
               .text('RATE (INR)', 385, tableTop + 7, { width: 75, align: 'right' })
               .text('AMOUNT (INR)', 465, tableTop + 7, { width: 80, align: 'right' });

            // Line Items
            let currentY = tableTop + 24;
            const items = invoiceData.items && invoiceData.items.length > 0
                ? invoiceData.items
                : [{ description: invoiceData.notes || 'Professional Financial / Software Services', quantity: 1, unit_price: invoiceData.total_amount, amount: invoiceData.total_amount }];

            items.forEach((item, index) => {
                const isEven = index % 2 === 0;
                doc.rect(40, currentY, 515, 24).fill(isEven ? '#FFFFFF' : '#FAF9FE');

                doc.fillColor(darkText)
                   .font('Helvetica')
                   .fontSize(9)
                   .text(String(index + 1), 50, currentY + 7, { width: 20 })
                   .text(item.description, 75, currentY + 7, { width: 250, lineBreak: false })
                   .text(String(parseFloat(item.quantity || 1).toFixed(2)), 335, currentY + 7, { width: 45, align: 'right' })
                   .text(parseFloat(item.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 385, currentY + 7, { width: 75, align: 'right' })
                   .text(parseFloat(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 465, currentY + 7, { width: 80, align: 'right' });

                currentY += 24;
            });

            // Table Bottom Line
            doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor(borderGray).lineWidth(1).stroke();
            currentY += 15;

            // Financial Summary Block
            const summaryX = 310;
            const labelWidth = 130;
            const valWidth = 105;

            const totalAmount = parseFloat(invoiceData.total_amount || 0);
            const advanceDeduction = parseFloat(invoiceData.advance_deduction || 0);
            const previousPayments = parseFloat(invoiceData.previous_payments || 0);
            const currentPayment = parseFloat(invoiceData.current_payment || 0);
            const remainingBalance = Math.max(0, totalAmount - advanceDeduction - previousPayments - currentPayment);

            function drawSummaryRow(label, value, isBold = false, isHighlight = false) {
                if (isHighlight) {
                    doc.rect(summaryX - 10, currentY - 3, 245, 22).fill(lightPurple);
                }
                doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
                   .fontSize(isHighlight ? 10.5 : 9)
                   .fillColor(isHighlight ? primaryPurple : darkText)
                   .text(label, summaryX, currentY, { width: labelWidth, align: 'left' })
                   .text(formatInr(value), summaryX + labelWidth, currentY, { width: valWidth, align: 'right' });
                currentY += isHighlight ? 24 : 18;
            }

            drawSummaryRow('Total Invoice Amount:', totalAmount);
            if (advanceDeduction > 0) {
                drawSummaryRow('Advance Deduction:', -advanceDeduction);
            }
            if (previousPayments > 0) {
                drawSummaryRow('Previous Payments:', -previousPayments);
            }
            if (currentPayment > 0) {
                drawSummaryRow('Current Payment:', -currentPayment);
            }
            drawSummaryRow('REMAINING BALANCE DUE:', remainingBalance, true, true);

            // Payment Terms & Notes
            const notesY = Math.max(tableTop + (items.length * 24) + 40, currentY - 100);
            doc.fillColor(primaryPurple)
               .font('Helvetica-Bold')
               .fontSize(10)
               .text('PAYMENT TERMS & BANK DETAILS', 40, notesY);

            doc.font('Helvetica')
               .fontSize(8.5)
               .fillColor(grayText)
               .text(invoiceData.payment_terms || 'Payment is due within 15 days of invoice date. NEFT/RTGS/UPI preferred.', 40, notesY + 16, { width: 250 })
               .text('Bank: HDFC Bank | A/C Name: Duolink Finance Pvt Ltd | IFSC: HDFC0001234 | A/C: 502000889921', 40, notesY + 45, { width: 250 });

            // Signature & Stamp Block
            const sigY = 660;
            doc.moveTo(40, sigY).lineTo(555, sigY).strokeColor(borderGray).lineWidth(1).stroke();

            doc.fillColor(darkText)
               .fontSize(9)
               .font('Helvetica-Bold')
               .text('Authorized Signatory', 380, sigY + 50)
               .font('Helvetica')
               .fontSize(8)
               .fillColor(grayText)
               .text('Duolink Finance & Accounts Controller', 380, sigY + 62);

            // Purple Digital Stamp
            doc.circle(440, sigY + 25, 22).strokeColor(vibrantPurple).lineWidth(1.5).stroke();
            doc.fontSize(6).font('Helvetica-Bold').fillColor(vibrantPurple).text('VERIFIED', 425, sigY + 22);

            // Document Footer
            doc.fontSize(8)
               .font('Helvetica')
               .fillColor(grayText)
               .text('Duolink Finance Portal — Official Electronic Tax Invoice', 40, 780, { align: 'center', width: 515 });

            doc.end();

            outputStream.on('finish', () => resolve());
            outputStream.on('error', (err) => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generateInvoicePdf };
