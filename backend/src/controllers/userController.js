const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { logAudit } = require('../services/auditService');

// List All Users
async function getUsers(req, res, next) {
    try {
        const result = await query(
            `SELECT id, email, full_name, role, can_create_project, can_edit_records, can_delete_records, status, created_at,
                    (SELECT COUNT(*) FROM project_members WHERE user_id = users.id) as assigned_projects_count
             FROM users
             ORDER BY id ASC`
        );
        res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        next(err);
    }
}

// Create New User (Admin only, role restricted to 'Admin' or 'User')
async function createUser(req, res, next) {
    try {
        const { email, password, full_name, role, can_create_project, can_edit_records, can_delete_records } = req.body;

        if (!email || !password || !full_name || !role) {
            return res.status(400).json({ success: false, message: 'Email, password, full name, and role are required.' });
        }

        if (role !== 'Admin' && role !== 'User') {
            return res.status(400).json({ success: false, message: 'Invalid role. Must be either "Admin" or "User".' });
        }

        const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'A user with this email already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const insertRes = await query(
            `INSERT INTO users (email, password_hash, full_name, role, can_create_project, can_edit_records, can_delete_records, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING id, email, full_name, role, can_create_project, can_edit_records, can_delete_records, status, created_at`,
            [
                email.trim(),
                passwordHash,
                full_name.trim(),
                role,
                Boolean(can_create_project),
                Boolean(can_edit_records),
                Boolean(can_delete_records),
            ]
        );

        const newUser = insertRes.rows[0];

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'CREATE_USER',
            entityType: 'user',
            entityId: newUser.id,
            details: `Created new user ${newUser.email} with role ${newUser.role}`,
            req,
        });

        res.status(201).json({ success: true, message: 'User account created successfully.', data: newUser });
    } catch (err) {
        next(err);
    }
}

// Update User Permissions & Status
async function updateUser(req, res, next) {
    try {
        const { id } = req.params;
        const { full_name, role, can_create_project, can_edit_records, can_delete_records, status, password } = req.body;

        if (role && role !== 'Admin' && role !== 'User') {
            return res.status(400).json({ success: false, message: 'Invalid role. Role must be "Admin" or "User".' });
        }

        let passwordHash = null;
        if (password && password.trim().length >= 6) {
            passwordHash = await bcrypt.hash(password.trim(), 10);
        }

        const updateRes = await query(
            `UPDATE users SET
                full_name = COALESCE($1, full_name),
                role = COALESCE($2, role),
                can_create_project = COALESCE($3, can_create_project),
                can_edit_records = COALESCE($4, can_edit_records),
                can_delete_records = COALESCE($5, can_delete_records),
                status = COALESCE($6, status),
                password_hash = COALESCE($7, password_hash),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $8
             RETURNING id, email, full_name, role, can_create_project, can_edit_records, can_delete_records, status, updated_at`,
            [
                full_name,
                role,
                can_create_project !== undefined ? Boolean(can_create_project) : null,
                can_edit_records !== undefined ? Boolean(can_edit_records) : null,
                can_delete_records !== undefined ? Boolean(can_delete_records) : null,
                status,
                passwordHash,
                id,
            ]
        );

        if (updateRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'UPDATE_USER',
            entityType: 'user',
            entityId: id,
            details: `Updated user profile/permissions for ID ${id}`,
            req,
        });

        res.json({ success: true, message: 'User updated successfully.', data: updateRes.rows[0] });
    } catch (err) {
        next(err);
    }
}

// Delete / Deactivate User
async function deleteUser(req, res, next) {
    try {
        const { id } = req.params;

        if (parseInt(id, 10) === req.user.id) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own admin account.' });
        }

        await query('UPDATE users SET status = \'inactive\', updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'DEACTIVATE_USER',
            entityType: 'user',
            entityId: id,
            details: `Deactivated user ID ${id}`,
            req,
        });

        res.json({ success: true, message: 'User deactivated successfully.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getUsers,
    createUser,
    updateUser,
    deleteUser,
};
