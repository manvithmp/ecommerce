const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity must be at least 1'],
        validate: {
            validator: Number.isInteger,
            message: 'Quantity must be an integer'
        }
    },
    price: {
        type: Number,
        required: true,
        min: [0, 'Price cannot be negative']
    }
}, {
    _id: true,
    timestamps: true
});

cartItemSchema.virtual('total').get(function() {
    return this.quantity * this.price;
});

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [cartItemSchema],
    totalItems: {
        type: Number,
        default: 0,
        min: [0, 'Total items cannot be negative']
    },
    totalAmount: {
        type: Number,
        default: 0,
        min: [0, 'Total amount cannot be negative']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

cartSchema.index({ user: 1 });

cartSchema.pre('save', function(next) {
    if (this.items && this.items.length > 0) {
        this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
        this.totalAmount = this.items.reduce((total, item) => total + (item.quantity * item.price), 0);
    } else {
        this.totalItems = 0;
        this.totalAmount = 0;
    }
    next();
});

cartSchema.methods.addItem = async function(productId, quantity, price) {
    const existingItemIndex = this.items.findIndex(item => 
        item.product.toString() === productId.toString()
    );
    
    if (existingItemIndex > -1) {
        this.items[existingItemIndex].quantity += quantity;
        this.items[existingItemIndex].price = price;
    } else {
        this.items.push({
            product: productId,
            quantity: quantity,
            price: price
        });
    }
    
    return await this.save();
};

cartSchema.methods.updateItem = async function(itemId, quantity) {
    const item = this.items.id(itemId);
    if (!item) {
        throw new Error('Item not found in cart');
    }
    
    if (quantity <= 0) {
        this.items.pull(itemId);
    } else {
        item.quantity = quantity;
    }
    
    return await this.save();
};

cartSchema.methods.removeItem = async function(itemId) {
    this.items.pull(itemId);
    return await this.save();
};

cartSchema.methods.clearCart = async function() {
    this.items = [];
    return await this.save();
};

cartSchema.statics.findByUser = function(userId) {
    return this.findOne({ user: userId, isActive: true }).populate('items.product');
};

module.exports = mongoose.model('Cart', cartSchema);
