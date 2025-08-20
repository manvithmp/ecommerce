const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
    try {
        let cart = await Cart.findByUser(req.user._id);

        if (!cart) {
            cart = await Cart.create({
                user: req.user._id,
                items: []
            });
        }

        res.status(200).json({
            success: true,
            data: cart
        });
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching cart'
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        if (!productId || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Product ID and quantity are required'
            });
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive integer'
            });
        }

        const product = await Product.findOne({
            _id: productId,
            isActive: true
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found or not available'
            });
        }

        if (product.stock < quantity) {
            return res.status(400).json({
                success: false,
                message: `Only ${product.stock} items available in stock`
            });
        }

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = new Cart({
                user: req.user._id,
                items: []
            });
        }

        const existingItemIndex = cart.items.findIndex(
            item => item.product.toString() === productId.toString()
        );

        if (existingItemIndex > -1) {
            const newQuantity = cart.items[existingItemIndex].quantity + quantity;
            
            if (newQuantity > product.stock) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot add ${quantity} more items. Only ${product.stock - cart.items[existingItemIndex].quantity} more available.`
                });
            }

            cart.items[existingItemIndex].quantity = newQuantity;
            cart.items[existingItemIndex].price = product.price;
        } else {
            cart.items.push({
                product: productId,
                quantity: quantity,
                price: product.price
            });
        }

        await cart.save();
        await cart.populate('items.product');

        console.log(`✅ Item added to cart: ${product.name} (${quantity}x) for ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: 'Item added to cart successfully',
            data: cart
        });
    } catch (error) {
        console.error('Add to cart error:', error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error adding item to cart'
        });
    }
});

router.put('/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const { quantity } = req.body;

        if (!quantity || !Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive integer'
            });
        }

        const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        const cartItem = cart.items.id(itemId);
        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in cart'
            });
        }

        const product = cartItem.product;
        if (quantity > product.stock) {
            return res.status(400).json({
                success: false,
                message: `Only ${product.stock} items available in stock`
            });
        }

        cartItem.quantity = quantity;
        cartItem.price = product.price;

        await cart.save();

        console.log(`✅ Cart item updated: ${product.name} (${quantity}x) for ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: 'Cart item updated successfully',
            data: cart
        });
    } catch (error) {
        console.error('Update cart item error:', error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid item ID'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error updating cart item'
        });
    }
});

router.delete('/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;

        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        const cartItem = cart.items.id(itemId);
        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in cart'
            });
        }

        cart.items.pull(itemId);
        await cart.save();
        await cart.populate('items.product');

        console.log(`✅ Item removed from cart for ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: 'Item removed from cart successfully',
            data: cart
        });
    } catch (error) {
        console.error('Remove cart item error:', error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid item ID'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error removing cart item'
        });
    }
});

router.delete('/', async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        cart.items = [];
        await cart.save();

        console.log(`✅ Cart cleared for ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: 'Cart cleared successfully',
            data: cart
        });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error clearing cart'
        });
    }
});

router.put('/bulk', async (req, res) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Items array is required and cannot be empty'
            });
        }

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = new Cart({
                user: req.user._id,
                items: []
            });
        }

        const productIds = items.map(item => item.productId);
        const products = await Product.find({
            _id: { $in: productIds },
            isActive: true
        });

        if (products.length !== productIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Some products are not found or not available'
            });
        }

        cart.items = [];

        for (const item of items) {
            const product = products.find(p => p._id.toString() === item.productId.toString());
            
            if (!product) continue;

            const quantity = parseInt(item.quantity);
            
            if (!Number.isInteger(quantity) || quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid quantity for product ${product.name}`
                });
            }

            if (quantity > product.stock) {
                return res.status(400).json({
                    success: false,
                    message: `Only ${product.stock} items available for ${product.name}`
                });
            }

            cart.items.push({
                product: product._id,
                quantity: quantity,
                price: product.price
            });
        }

        await cart.save();
        await cart.populate('items.product');

        console.log(`✅ Cart bulk updated for ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: 'Cart updated successfully',
            data: cart
        });
    } catch (error) {
        console.error('Bulk update cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating cart'
        });
    }
});

module.exports = router;
