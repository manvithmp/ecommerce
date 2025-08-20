const express = require('express');
const Product = require('../models/Product');
const { protect, isAdmin, optionalAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        const sort = req.query.sort || '-createdAt';
        const search = req.query.search;
        const category = req.query.category;
        const minPrice = parseFloat(req.query.minPrice) || 0;
        const maxPrice = parseFloat(req.query.maxPrice) || Number.MAX_VALUE;

        let query = { isActive: true };

        if (search) {
            query.$text = { $search: search };
        }

        if (category && category !== 'all') {
            query.category = category;
        }

        if (minPrice > 0 || maxPrice < Number.MAX_VALUE) {
            query.price = { $gte: minPrice, $lte: maxPrice };
        }

        const products = await Product.find(query)
            .populate('createdBy', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .select(search ? { score: { $meta: 'textScore' } } : {});

        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            success: true,
            count: products.length,
            pagination: {
                page,
                limit,
                total,
                pages: totalPages,
                hasNextPage,
                hasPrevPage,
                nextPage: hasNextPage ? page + 1 : null,
                prevPage: hasPrevPage ? page - 1 : null
            },
            data: products
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching products'
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            isActive: true
        }).populate('createdBy', 'name email');

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Get product error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error fetching product'
        });
    }
});

router.post('/', protect, isAdmin, async (req, res) => {
    try {
        const { name, description, price, category, stock, image, images, brand, sku, weight, dimensions, tags } = req.body;

        if (!name || !description || !price || !category || stock === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, description, price, category, and stock'
            });
        }

        if (price < 0) {
            return res.status(400).json({
                success: false,
                message: 'Price cannot be negative'
            });
        }

        if (stock < 0 || !Number.isInteger(stock)) {
            return res.status(400).json({
                success: false,
                message: 'Stock must be a non-negative integer'
            });
        }

        const productData = {
            name: name.trim(),
            description: description.trim(),
            price: parseFloat(price),
            category,
            stock: parseInt(stock),
            createdBy: req.user._id
        };

        if (image) productData.image = image;
        if (images && Array.isArray(images)) productData.images = images;
        if (brand) productData.brand = brand.trim();
        if (sku) productData.sku = sku.trim().toUpperCase();
        if (weight && weight > 0) productData.weight = parseFloat(weight);
        if (dimensions) productData.dimensions = dimensions;
        if (tags && Array.isArray(tags)) {
            productData.tags = tags.map(tag => tag.toString().trim().toLowerCase());
        }

        const product = await Product.create(productData);
        await product.populate('createdBy', 'name email');

        console.log(`✅ New product created: ${product.name} by ${req.user.email}`);

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: product
        });
    } catch (error) {
        console.error('Create product error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: messages
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Product SKU already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error creating product'
        });
    }
});

router.put('/:id', protect, isAdmin, async (req, res) => {
    try {
        let product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const { name, description, price, category, stock, image, images, brand, sku, weight, dimensions, tags, isActive, isFeatured } = req.body;

        if (price !== undefined && price < 0) {
            return res.status(400).json({
                success: false,
                message: 'Price cannot be negative'
            });
        }

        if (stock !== undefined && (stock < 0 || !Number.isInteger(stock))) {
            return res.status(400).json({
                success: false,
                message: 'Stock must be a non-negative integer'
            });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (price !== undefined) updateData.price = parseFloat(price);
        if (category !== undefined) updateData.category = category;
        if (stock !== undefined) updateData.stock = parseInt(stock);
        if (image !== undefined) updateData.image = image;
        if (images !== undefined && Array.isArray(images)) updateData.images = images;
        if (brand !== undefined) updateData.brand = brand.trim();
        if (sku !== undefined) updateData.sku = sku.trim().toUpperCase();
        if (weight !== undefined && weight > 0) updateData.weight = parseFloat(weight);
        if (dimensions !== undefined) updateData.dimensions = dimensions;
        if (tags !== undefined && Array.isArray(tags)) {
            updateData.tags = tags.map(tag => tag.toString().trim().toLowerCase());
        }
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);
        if (isFeatured !== undefined) updateData.isFeatured = Boolean(isFeatured);

        product = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        console.log(`✅ Product updated: ${product.name} by ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            data: product
        });
    } catch (error) {
        console.error('Update product error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: messages
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Product SKU already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error updating product'
        });
    }
});

router.delete('/:id', protect, isAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        await Product.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        console.log(`✅ Product deleted: ${product.name} by ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Delete product error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error deleting product'
        });
    }
});

router.get('/categories/list', async (req, res) => {
    try {
        const categories = await Product.distinct('category', { isActive: true });
        
        res.status(200).json({
            success: true,
            data: categories.sort()
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching categories'
        });
    }
});

router.get('/search/:query', async (req, res) => {
    try {
        const query = req.params.query.trim();
        const limit = parseInt(req.query.limit) || 20;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const products = await Product.searchProducts(query, { limit });

        res.status(200).json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('Search products error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error searching products'
        });
    }
});

module.exports = router;
