const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

// Authenticate JWT Token
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'duolink_finance_secret_key');
        
        // Fetch fresh user record from database
        const userRes = await query(
            'SELECT id, email, full_name, role, can_create_project, can_edit_records, can_delete_records, status FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userRes.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'User account not found.' });
        }

        const user = userRes.rows[0];
        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: 'User account is suspended or inactive.' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token.', error: err.message });
    }
}

// Strictly Require Admin Role
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'Admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Administrator privileges required.',
        });
    }
    next();
}

// Check Permission (Admin always has full access; User checked by permission flag)
function requirePermission(permissionFlag) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        if (req.user.role === 'Admin') {
            return next();
        }
        if (req.user[permissionFlag]) {
            return next();
        }
        return res.status(403).json({
            success: false,
            message: `Access denied. You do not have permission: ${permissionFlag}. Contact an Administrator.`,
        });
    };
}

// Check Project Access (Admin has access to all; User only assigned projects)
async function requireProjectAccess(req, res, next) {
    const projectId = req.params.projectId || req.params.id || req.body.project_id;
    if (!projectId) return next();

    if (req.user.role === 'Admin') {
        return next();
    }

    try {
        const memberRes = await query(
            'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
            [projectId, req.user.id]
        );
        if (memberRes.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not assigned to this project.',
            });
        }
        req.projectMember = memberRes.rows[0];
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to verify project access', error: err.message });
    }
}

module.exports = {
    authenticateToken,
    requireAdmin,
    requirePermission,
    requireProjectAccess,
};
