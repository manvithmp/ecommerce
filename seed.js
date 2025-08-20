const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Product = require('./models/Product');

const users = [
    {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
    },
    {
        name: 'manvith',
        email: 'customer@example.com',
        password: 'customer123',
        role: 'customer'
    },
    {
        name: 'sagar',
        email: 'sagar@example.com',
        password: 'sagar123',
        role: 'customer'
    }
];

const products = [
    {
        name: 'MacBook Pro 14-inch',
        description: 'Apple MacBook Pro with M2 chip, 14-inch Liquid Retina XDR display, 16GB RAM, 512GB SSD',
        price: 199999.99,
        category: 'Electronics',
        stock: 10,
        brand: 'Apple',
        image: 'https://techcrunch.com/wp-content/uploads/2024/11/CMC_8144.jpg',
        tags: ['laptop', 'apple', 'macbook', 'm2'],
        isFeatured: true
    },
    {
        name: 'iPhone 15 Pro',
        description: 'Latest iPhone with A17 Pro chip, 6.1-inch Super Retina XDR display, 128GB storage',
        price: 134900.00,
        category: 'Electronics',
        stock: 25,
        brand: 'Apple',
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQZWm59SJ_1qUNH-5Ntyo18CUHwM8a3KBpsnA&s',
        tags: ['smartphone', 'apple', 'iphone', '5g']
    },
    {
        name: 'Samsung Galaxy S24 Ultra',
        description: 'Premium Android smartphone with S Pen, 6.8-inch Dynamic AMOLED display, 256GB storage',
        price: 129999.00,
        category: 'Electronics',
        stock: 20,
        brand: 'Samsung',
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7-escqYR4YEimPLnlY3ptehddl4ap8w2QnQ&s',
        tags: ['smartphone', 'samsung', 'android', 's-pen']
    },
    {
        name: 'Sony WH-1000XM5',
        description: 'Industry-leading noise canceling wireless headphones with 30-hour battery life',
        price: 29990.00,
        category: 'Electronics',
        stock: 30,
        brand: 'Sony',
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSiUijbJWDY9ibF6fzbIPmdPJXNGagZVqs6dg&s',
        tags: ['headphones', 'wireless', 'noise-canceling', 'sony']
    },
    {
        name: 'Herman Miller Aeron Chair',
        description: 'Ergonomic office chair with advanced PostureFit SL support and breathable mesh',
        price: 145000.00,
        category: 'Furniture',
        stock: 5,
        brand: 'Herman Miller',
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTiXVKhYwectG-YmYB4fjLtCyzO-RWO3ne8xA&s',
        tags: ['chair', 'office', 'ergonomic', 'herman-miller'],
        isFeatured: true
    },
    {
        name: 'Nike Air Max 270',
        description: 'Comfortable running shoes with Max Air unit in the heel for superior cushioning',
        price: 12995.00,
        category: 'Sports',
        stock: 40,
        brand: 'Nike',
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHwcKucFdCHBzYpp_ULzvQfLpVlev4_Q9T2w&s',
        tags: ['shoes', 'running', 'nike', 'air-max']
    },
    {
        name: 'Ceramic Coffee Mug Set',
        description: 'Set of 4 elegant ceramic mugs perfect for coffee, tea, or hot chocolate',
        price: 1999.00,
        category: 'Home',
        stock: 50,
        brand: 'HomeEssentials',
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQaH4yBoStFGo9kXQ2LTGSprCcr2b8ultkriA&s',
        tags: ['mug', 'ceramic', 'coffee', 'kitchen']
    },
    {
        name: 'The Complete Works of Shakespeare',
        description: 'Hardcover collection of all 39 plays and 154 sonnets by William Shakespeare',
        price: 2499.00,
        category: 'Books',
        stock: 25,
        brand: 'Penguin Classics',
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSuN4pxZfv7YVT3JTzNJKto5bKWg4Wb0zlrMQ&s',
        tags: ['book', 'literature', 'shakespeare', 'classic']
    },
    {
        name: 'Organic Cotton T-Shirt',
        description: 'Comfortable and sustainable organic cotton t-shirt available in multiple colors',
        price: 1299.00,
        category: 'Clothing',
        stock: 100,
        brand: 'EcoWear',
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTttzWYo2rKtjNs6L8W7eSg1ujSYR34xfVeFQ&s',
        tags: ['t-shirt', 'organic', 'cotton', 'sustainable']
    },
    {
        name: 'Vitamin C Serum',
        description: 'Anti-aging vitamin C serum with hyaluronic acid for bright, youthful skin',
        price: 2999.00,
        category: 'Beauty',
        stock: 75,
        brand: 'SkinCare Pro',
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcROnRIeOIorD6fBHkRdlUGdrQnSB7bQqiERig&s',
        tags: ['serum', 'vitamin-c', 'skincare', 'anti-aging']
    }
];

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const clearDatabase = async () => {
    try {
        await User.deleteMany({});
        await Product.deleteMany({});
        console.log(' Database cleared');
    } catch (error) {
        console.error('Error clearing database:', error);
        throw error;
    }
};

const seedUsers = async () => {
    try {
        const createdUsers = await User.create(users);
        console.log(`Created ${createdUsers.length} users`);
        return createdUsers;
    } catch (error) {
        console.error('Error seeding users:', error);
        throw error;
    }
};

const seedProducts = async (adminUser) => {
    try {
        const productsWithCreator = products.map(product => ({
            ...product,
            createdBy: adminUser._id
        }));

        const createdProducts = await Product.create(productsWithCreator);
        console.log(`Created ${createdProducts.length} products`);
        return createdProducts;
    } catch (error) {
        console.error('Error seeding products:', error);
        throw error;
    }
};

const seedDatabase = async () => {
    try {
        console.log('Starting database seeding...');
        
        await connectDB();
        await clearDatabase();
        
        const createdUsers = await seedUsers();
        const adminUser = createdUsers.find(user => user.role === 'admin');
        
        await seedProducts(adminUser);
        
        console.log('Database seeding completed successfully!');
        console.log('');
        console.log('Created accounts:');
        console.log('Admin: admin@example.com / admin123');
        console.log('Customer: customer@example.com / customer123');
        console.log('Customer: jane@example.com / password123');
        console.log('');
        
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase, clearDatabase, connectDB };
