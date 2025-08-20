const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect, sendTokenResponse } = require('../middleware/auth');
const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email and password'
            });
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        const userData = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
            role: role && ['customer', 'admin'].includes(role) ? role : 'customer'
        };

        const user = await User.create(userData);
        console.log(`✅ New user registered: ${user.email} (${user.role})`);
        sendTokenResponse(user, 201, res);
    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: messages
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        const user = await User.findByEmail(email).select('+password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Please contact support.'
            });
        }

        const isPasswordCorrect = await user.comparePassword(password);
        
        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });

        console.log(`✅ User logged in: ${user.email} (${user.role})`);
        sendTokenResponse(user, 200, res);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

router.get('/me', protect, async (req, res) => {
    try {
        const user = req.user;
        
        res.status(200).json({
            success: true,
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user profile'
        });
    }
});

router.put('/profile', protect, async (req, res) => {
    try {
        const { name, email, avatar } = req.body;
        const user = req.user;

        if (email && email !== user.email) {
            const existingUser = await User.findByEmail(email);
            if (existingUser && existingUser._id.toString() !== user._id.toString()) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is already taken by another user'
                });
            }
        }

        if (name) user.name = name.trim();
        if (email) user.email = email.toLowerCase().trim();
        if (avatar) user.avatar = avatar;

        const updatedUser = await user.save();
        console.log(`✅ User profile updated: ${updatedUser.email}`);

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser.getPublicProfile()
        });
    } catch (error) {
        console.error('Update profile error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: messages
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error updating profile'
        });
    }
});

router.put('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current password and new password'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        const user = await User.findById(req.user._id).select('+password');
        const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        user.password = newPassword;
        await user.save();

        console.log(`✅ Password changed for user: ${user.email}`);

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error changing password'
        });
    }
});

router.post('/logout', protect, (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });

    console.log(`✅ User logged out: ${req.user.email}`);

    res.status(200).json({
        success: true,
        message: 'User logged out successfully'
    });
});

module.exports = router;
