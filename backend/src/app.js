const express = require('express');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');

// Route Handlers
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const incomeRoutes = require('./routes/incomeRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');
const attachmentRoutes = require('./routes/attachmentRoutes');
const partnerRoutes = require('./routes/partnerRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving: uploads directory for receipts and payment proofs
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Static serving for the Duolink Finance interactive Web Client
const frontendWebDir = path.resolve(__dirname, '../../frontend_web');
app.use(express.static(frontendWebDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/partners', partnerRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        service: 'Duolink Finance API',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// Serve frontend for root or any unknown non-API route
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendWebDir, 'index.html'));
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
