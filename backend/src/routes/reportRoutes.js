const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/dashboard-summary', reportController.getDashboardSummary);
router.get('/financial-reports', reportController.getFinancialReports);
router.get('/export-csv', reportController.exportReportCsv);

module.exports = router;
