const { query } = require('../config/db');

async function logAudit({ userId, userEmail, action, entityType, entityId, details, req }) {
    try {
        const ipAddress = req ? req.ip || req.headers['x-forwarded-for'] || '127.0.0.1' : '127.0.0.1';
        const detailsString = typeof details === 'object' ? JSON.stringify(details) : String(details || '');

        await query(
            `INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, details, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId || null, userEmail || 'system', action, entityType, entityId || null, detailsString, ipAddress]
        );
    } catch (err) {
        console.error('Failed to record audit log:', err.message);
    }
}

module.exports = { logAudit };
