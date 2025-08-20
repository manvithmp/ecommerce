const express = require('express');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect, isAdmin } = require('../middleware/auth');
const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;

        let orders;

        if (req.user.role === 'admin') {
            const skip = (page - 1) * limit;
            let query = {};
            
            if (status) {
                query.orderStatus = status;
            }

            orders = await Order.find(query)
                .populate('user', 'name email')
                .populate('items.product', 'name image')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Order.countDocuments(query);

            res.status(200).json({
                success: true,
                count: orders.length,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                data: orders
            });
        } else {
            orders = await Order.findByUser(req.user._id, { 
                status, 
                limit 
            });

            res.status(200).json({
                success: true,
                count: orders.length,
                data: orders
            });
        }
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching orders'
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        let query = { _id: req.params.id };

        if (req.user.role !== 'admin') {
            query.user = req.user._id;
        }

        const order = await Order.findOne(query)
            .populate('user', 'name email')
            .populate('items.product', 'name image');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error('Get order error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error fetching order'
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const { shippingAddress, paymentMethod, notes } = req.body;

        if (!shippingAddress) {
            return res.status(400).json({
                success: false,
                message: 'Shipping address is required'
            });
        }

        const { street, city, state, postalCode, country } = shippingAddress;
        if (!street || !city || !state || !postalCode) {
            return res.status(400).json({
                success: false,
                message: 'Complete shipping address is required'
            });
        }

        const cart = await Cart.findByUser(req.user._id);

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        const orderItems = [];
        let totalAmount = 0;

        for (const cartItem of cart.items) {
            const product = cartItem.product;

            if (!product.isActive) {
                return res.status(400).json({
                    success: false,
                    message: `Product ${product.name} is no longer available`
                });
            }

            if (product.stock < cartItem.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Only ${product.stock} items available for ${product.name}`
                });
            }

            orderItems.push({
                product: product._id,
                name: product.name,
                price: product.price,
                quantity: cartItem.quantity,
                image: product.image
            });

            totalAmount += product.price * cartItem.quantity;
        }

        const shippingCost = totalAmount > 1000 ? 0 : 50;
        const taxRate = 0.18;
        const tax = Math.round(totalAmount * taxRate * 100) / 100;
        const finalTotal = totalAmount + shippingCost + tax;

        const orderData = {
            user: req.user._id,
            items: orderItems,
            shippingAddress: {
                street: street.trim(),
                city: city.trim(),
                state: state.trim(),
                postalCode: postalCode.trim(),
                country: country ? country.trim() : 'India'
            },
            paymentMethod: paymentMethod || 'cash_on_delivery',
            totalItems: cart.totalItems,
            subtotal: totalAmount,
            shippingCost: shippingCost,
            tax: tax,
            totalAmount: finalTotal,
            notes: notes ? notes.trim() : undefined
        };

        const order = await Order.create(orderData);

        for (const cartItem of cart.items) {
            await Product.findByIdAndUpdate(
                cartItem.product._id,
                { $inc: { stock: -cartItem.quantity } }
            );
        }

        await cart.clearCart();

        await order.populate('user', 'name email');
        await order.populate('items.product', 'name image');

        console.log(`✅ Order created: ${order.orderNumber} by ${req.user.email} - ₹${finalTotal}`);

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: order
        });
    } catch (error) {
        console.error('Create order error:', error);
        
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
            message: 'Server error creating order'
        });
    }
});

router.put('/:id/status', isAdmin, async (req, res) => {
    try {
        const { status, trackingNumber } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const validStatuses = ['placed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        await order.updateStatus(status, trackingNumber);

        console.log(`✅ Order status updated: ${order.orderNumber} -> ${status} by ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            data: order
        });
    } catch (error) {
        console.error('Update order status error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error updating order status'
        });
    }
});

router.put('/:id/cancel', async (req, res) => {
    try {
        const { reason } = req.body;

        let query = { _id: req.params.id };

        if (req.user.role !== 'admin') {
            query.user = req.user._id;
        }

        const order = await Order.findOne(query);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (['delivered', 'cancelled'].includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel order with status: ${order.orderStatus}`
            });
        }

        await order.cancelOrder(reason || 'Cancelled by user');

        for (const item of order.items) {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { stock: item.quantity } }
            );
        }

        console.log(`✅ Order cancelled: ${order.orderNumber} by ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: 'Order cancelled successfully',
            data: order
        });
    } catch (error) {
        console.error('Cancel order error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Server error cancelling order'
        });
    }
});

router.get('/stats/summary', isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const stats = await Order.getOrderStats(startDate, endDate);
        const totalOrders = stats.reduce((sum, stat) => sum + stat.count, 0);
        const totalRevenue = stats.reduce((sum, stat) => sum + stat.totalAmount, 0);

        res.status(200).json({
            success: true,
            data: {
                totalOrders,
                totalRevenue,
                statusBreakdown: stats,
                period: {
                    startDate: startDate || 'All time',
                    endDate: endDate || 'All time'
                }
            }
        });
    } catch (error) {
        console.error('Get order stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching order statistics'
        });
    }
});

module.exports = router;
