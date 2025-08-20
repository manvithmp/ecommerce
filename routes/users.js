const express = require('express');
const User = require('../models/User');
const { protect, isAdmin } = require('../middleware/auth');
const router = express.Router();

router.use(protect);

router.get('/', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const search = req.query.search;
        const role = req.query.role;

        let query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        if (role && ['customer', 'admin'].includes(role)) {
            query.role = role;
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            count: users.length,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            data: users
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching users'
        });
    }
});

router.get('/:id', isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get user error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error fetching user'
        });
    }
});

router.put('/:id/role', isAdmin, async (req, res) => {
    try {
        const { role } = req.body;

        if (!role || !['customer', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Role must be either "customer" or "admin"'
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change your own role'
            });
        }

        user.role = role;
        await user.save();

        console.log(`✅ User role updated: ${user.email} -> ${role} by ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: `User role updated to ${role}`,
            data: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Update user role error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error updating user role'
        });
    }
});

router.put('/:id/status', isAdmin, async (req, res) => {
    try {
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isActive must be a boolean value'
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user._id.toString() === req.user._id.toString() && !isActive) {
            return res.status(400).json({
                success: false,
                message: 'Cannot deactivate your own account'
            });
        }

        user.isActive = isActive;
        await user.save();

        const action = isActive ? 'activated' : 'deactivated';
        console.log(`✅ User ${action}: ${user.email} by ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: `User ${action} successfully`,
            data: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Update user status error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error updating user status'
        });
    }
});

router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        user.isActive = false;
        await user.save();

        console.log(`✅ User deleted: ${user.email} by ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error deleting user'
        });
    }
});

router.get('/stats/summary', isAdmin, async (req, res) => {
    try {
        const stats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    activeUsers: {
                        $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                    },
                    inactiveUsers: {
                        $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
                    },
                    customers: {
                        $sum: { $cond: [{ $eq: ['$role', 'customer'] }, 1, 0] }
                    },
                    admins: {
                        $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
                    }
                }
            }
        ]);

        const result = stats[0] || {
            totalUsers: 0,
            activeUsers: 0,
            inactiveUsers: 0,
            customers: 0,
            admins: 0
        };

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentRegistrations = await User.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        res.status(200).json({
            success: true,
            data: {
                ...result,
                recentRegistrations
            }
        });
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user statistics'
        });
    }
});

module.exports = router;
