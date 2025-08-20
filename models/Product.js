const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        minlength: [2, 'Product name must be at least 2 characters long'],
        maxlength: [100, 'Product name cannot exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Product description is required'],
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    price: {
        type: Number,
        required: [true, 'Product price is required'],
        min: [0, 'Price cannot be negative'],
        validate: {
            validator: function(value) {
                return Number.isFinite(value) && value >= 0;
            },
            message: 'Price must be a valid positive number'
        }
    },
    category: {
        type: String,
        required: [true, 'Product category is required'],
        trim: true,
        enum: {
            values: ['Electronics', 'Home', 'Furniture', 'Sports', 'Books', 'Clothing', 'Beauty', 'Automotive', 'Toys', 'Food'],
            message: 'Category must be one of: Electronics, Home, Furniture, Sports, Books, Clothing, Beauty, Automotive, Toys, Food'
        }
    },
    stock: {
        type: Number,
        required: [true, 'Stock quantity is required'],
        min: [0, 'Stock cannot be negative'],
        default: 0,
        validate: {
            validator: Number.isInteger,
            message: 'Stock must be an integer'
        }
    },
    image: {
        type: String,
        default: 'https://via.placeholder.com/300x200/4CAF50/white?text=Product'
    },
    images: [{
        type: String
    }],
    brand: {
        type: String,
        trim: true,
        maxlength: [50, 'Brand name cannot exceed 50 characters']
    },
    sku: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        uppercase: true
    },
    weight: {
        type: Number,
        min: [0, 'Weight cannot be negative']
    },
    dimensions: {
        length: { type: Number, min: 0 },
        width: { type: Number, min: 0 },
        height: { type: Number, min: 0 }
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    ratings: {
        average: {
            type: Number,
            default: 0,
            min: [0, 'Rating cannot be less than 0'],
            max: [5, 'Rating cannot be more than 5']
        },
        count: {
            type: Number,
            default: 0,
            min: [0, 'Rating count cannot be negative']
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

productSchema.index({ name: 'text', description: 'text', category: 'text', brand: 'text', tags: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ isActive: 1 });
productSchema.index({ 'ratings.average': -1 });

productSchema.virtual('inStock').get(function() {
    return this.stock > 0;
});

productSchema.virtual('finalPrice').get(function() {
    return this.price;
});

productSchema.pre('save', function(next) {
    if (!this.sku) {
        const timestamp = Date.now().toString().slice(-6);
        const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
        this.sku = `${this.category.substring(0, 3).toUpperCase()}${randomStr}${timestamp}`;
    }
    next();
});

productSchema.statics.findByCategory = function(category) {
    return this.find({ category: category, isActive: true });
};

productSchema.statics.searchProducts = function(query, options = {}) {
    const searchQuery = {
        $text: { $search: query },
        isActive: true
    };
    
    return this.find(searchQuery, { score: { $meta: 'textScore' } })
               .sort({ score: { $meta: 'textScore' } })
               .limit(options.limit || 20);
};

productSchema.methods.reduceStock = function(quantity) {
    if (this.stock >= quantity) {
        this.stock -= quantity;
        return this.save();
    } else {
        throw new Error('Insufficient stock');
    }
};

productSchema.methods.addStock = function(quantity) {
    this.stock += quantity;
    return this.save();
};

module.exports = mongoose.model('Product', productSchema);
