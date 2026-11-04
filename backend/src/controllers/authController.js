const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { logAudit } = require('../services/auditService');

// Login User or Admin
async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        const userRes = await query(
            'SELECT id, email, password_hash, full_name, role, can_create_project, can_edit_records, can_delete_records, status FROM users WHERE LOWER(email) = LOWER($1)',
            [email.trim()]
        );

        if (userRes.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const user = userRes.rows[0];

        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: 'This account has been deactivated. Please contact an Administrator.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                fullName: user.full_name,
            },
            process.env.JWT_SECRET || 'duolink_finance_secret_key',
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        await logAudit({
            userId: user.id,
            userEmail: user.email,
            action: 'LOGIN',
            entityType: 'user',
            entityId: user.id,
            details: `User logged in with role: ${user.role}`,
            req,
        });

        res.json({
            success: true,
            message: 'Login successful.',
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                canCreateProject: user.can_create_project,
                canEditRecords: user.can_edit_records,
                canDeleteRecords: user.can_delete_records,
            },
        });
    } catch (err) {
        next(err);
    }
}

// Get Profile
async function getProfile(req, res, next) {
    try {
        res.json({
            success: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                fullName: req.user.full_name,
                role: req.user.role,
                canCreateProject: req.user.can_create_project,
                canEditRecords: req.user.can_edit_records,
                canDeleteRecords: req.user.can_delete_records,
                status: req.user.status,
            },
        });
    } catch (err) {
        next(err);
    }
}

// Change Password
async function changePassword(req, res, next) {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
        }

        const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        const user = userRes.rows[0];

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, req.user.id]);

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'CHANGE_PASSWORD',
            entityType: 'user',
            entityId: req.user.id,
            details: 'User successfully changed password',
            req,
        });

        res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    login,
    getProfile,
    changePassword,
};
