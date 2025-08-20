const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: [0, 'Price cannot be negative']
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
    image: {
        type: String,
        default: 'https://via.placeholder.com/100x100/4CAF50/white?text=Product'
    }
}, {
    _id: false
});

orderItemSchema.virtual('total').get(function() {
    return this.quantity * this.price;
});

const shippingAddressSchema = new mongoose.Schema({
    street: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    postalCode: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        required: true,
        trim: true,
        default: 'India'
    }
}, {
    _id: false
});

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [orderItemSchema],
    shippingAddress: {
        type: shippingAddressSchema,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['credit_card', 'debit_card', 'paypal', 'cash_on_delivery', 'upi'],
        default: 'cash_on_delivery'
    },
    paymentStatus: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    orderStatus: {
        type: String,
        required: true,
        enum: ['placed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        default: 'placed'
    },
    totalItems: {
        type: Number,
        required: true,
        min: [1, 'Order must have at least 1 item']
    },
    subtotal: {
        type: Number,
        required: true,
        min: [0, 'Subtotal cannot be negative']
    },
    shippingCost: {
        type: Number,
        default: 0,
        min: [0, 'Shipping cost cannot be negative']
    },
    tax: {
        type: Number,
        default: 0,
        min: [0, 'Tax cannot be negative']
    },
    totalAmount: {
        type: Number,
        required: true,
        min: [0, 'Total amount cannot be negative']
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    trackingNumber: {
        type: String,
        trim: true
    },
    estimatedDelivery: {
        type: Date
    },
    deliveredAt: {
        type: Date
    },
    cancelledAt: {
        type: Date
    },
    cancellationReason: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });

orderSchema.pre('save', function(next) {
    if (this.isNew && !this.orderNumber) {
        const timestamp = Date.now().toString();
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.orderNumber = `ORD-${timestamp}-${randomStr}`;
    }
    next();
});

orderSchema.pre('save', function(next) {
    if (this.items && this.items.length > 0) {
        this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
        this.subtotal = this.items.reduce((total, item) => total + (item.quantity * item.price), 0);
        this.totalAmount = this.subtotal + this.shippingCost + this.tax;
    }
    next();
});

orderSchema.methods.updateStatus = async function(newStatus, trackingNumber = null) {
    this.orderStatus = newStatus;
    
    if (trackingNumber) {
        this.trackingNumber = trackingNumber;
    }
    
    if (newStatus === 'delivered') {
        this.deliveredAt = new Date();
        this.paymentStatus = 'completed';
    } else if (newStatus === 'cancelled') {
        this.cancelledAt = new Date();
    }
    
    return await this.save();
};

orderSchema.methods.cancelOrder = async function(reason) {
    if (this.orderStatus === 'delivered') {
        throw new Error('Cannot cancel delivered order');
    }
    
    this.orderStatus = 'cancelled';
    this.cancelledAt = new Date();
    this.cancellationReason = reason;
    
    return await this.save();
};

orderSchema.statics.findByUser = function(userId, options = {}) {
    const query = this.find({ user: userId });
    
    if (options.status) {
        query.where({ orderStatus: options.status });
    }
    
    return query.populate('items.product', 'name image')
                .sort({ createdAt: -1 })
                .limit(options.limit || 50);
};

orderSchema.statics.getOrderStats = async function(startDate, endDate) {
    const matchStage = {};
    
    if (startDate && endDate) {
        matchStage.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }
    
    return await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$orderStatus',
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalAmount' }
            }
        }
    ]);
};

module.exports = mongoose.model('Order', orderSchema);
