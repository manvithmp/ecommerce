const API_BASE = '/api';

let currentUser = null;
let currentTab = 'products';
let products = [];
let cart = null;
let orders = [];

const authButtons = document.getElementById('authButtons');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const userRole = document.getElementById('userRole');
const cartTab = document.getElementById('cartTab');
const ordersTab = document.getElementById('ordersTab');
const adminTab = document.getElementById('adminTab');
const cartCount = document.getElementById('cartCount');

const showLoading = () => {
    document.getElementById('loading').classList.remove('hidden');
};

const hideLoading = () => {
    document.getElementById('loading').classList.add('hidden');
};

const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
};

const getAuthToken = () => {
    return localStorage.getItem('token');
};

const setAuthToken = (token) => {
    localStorage.setItem('token', token);
};

const removeAuthToken = () => {
    localStorage.removeItem('token');
};

const apiCall = async (endpoint, options = {}) => {
    const token = getAuthToken();
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        ...options
    };

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

const login = async (email, password) => {
    try {
        showLoading();
        const data = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        setAuthToken(data.token);
        currentUser = data.user;
        updateUI();
        closeModal('loginModal');
        showToast('Login successful!', 'success');
        
        await loadCart();
        if (currentUser.role === 'admin') {
            await loadAllOrders();
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
};

const register = async (name, email, password, role) => {
    try {
        showLoading();
        const data = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, role })
        });
        
        setAuthToken(data.token);
        currentUser = data.user;
        updateUI();
        closeModal('registerModal');
        showToast('Registration successful!', 'success');
        
        await loadCart();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
};

const logout = async () => {
    try {
        await apiCall('/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    removeAuthToken();
    currentUser = null;
    cart = null;
    orders = [];
    updateUI();
    switchTab('products');
    showToast('Logged out successfully', 'info');
};

const loadProducts = async (page = 1, search = '', category = '') => {
    try {
        showLoading();
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '12',
            ...(search && { search }),
            ...(category && { category })
        });
        
        const data = await apiCall(`/products?${params}`);
        products = data.data;
        renderProducts(data.data);
        renderPagination(data.pagination);
    } catch (error) {
        showToast('Error loading products: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
};

const renderProducts = (productList) => {
    const grid = document.getElementById('productsGrid');
    
    if (!productList.length) {
        grid.innerHTML = '<div class="no-data">No products found</div>';
        return;
    }
    
    grid.innerHTML = productList.map(product => `
        <div class="product-card" data-id="${product._id}">
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description.substring(0, 100)}...</p>
                <div class="product-meta">
                    <span class="product-category">${product.category}</span>
                    <span class="product-stock">Stock: ${product.stock}</span>
                </div>
                <div class="product-actions">
                    <span class="product-price">₹${product.price.toFixed(2)}</span>
                    ${currentUser ? `
                        <button class="btn btn--primary btn--sm" 
                                onclick="addToCart('${product._id}')"
                                ${product.stock === 0 ? 'disabled' : ''}>
                            ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                        </button>
                    ` : '<span class="login-required">Login to purchase</span>'}
                </div>
            </div>
        </div>
    `).join('');
};

const renderPagination = (pagination) => {
    const container = document.getElementById('productsPagination');
    
    if (pagination.pages <= 1) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    container.innerHTML = `
        <button class="btn btn--outline btn--sm" 
                onclick="loadProducts(${pagination.page - 1})"
                ${!pagination.hasPrevPage ? 'disabled' : ''}>
            Previous
        </button>
        <span class="pagination-info">Page ${pagination.page} of ${pagination.pages}</span>
        <button class="btn btn--outline btn--sm"
                onclick="loadProducts(${pagination.page + 1})"
                ${!pagination.hasNextPage ? 'disabled' : ''}>
            Next
        </button>
    `;
};

const loadCart = async () => {
    if (!currentUser) return;
    
    try {
        const data = await apiCall('/cart');
        cart = data.data;
        updateCartUI();
    } catch (error) {
        console.error('Error loading cart:', error);
    }
};

const addToCart = async (productId) => {
    if (!currentUser) {
        showToast('Please login to add items to cart', 'warning');
        return;
    }
    
    try {
        const data = await apiCall('/cart', {
            method: 'POST',
            body: JSON.stringify({ productId, quantity: 1 })
        });
        
        cart = data.data;
        updateCartUI();
        showToast('Item added to cart!', 'success');
    } catch (error) {
        showToast('Error adding to cart: ' + error.message, 'error');
    }
};

const updateCartItem = async (itemId, quantity) => {
    try {
        if (quantity <= 0) {
            await removeFromCart(itemId);
            return;
        }
        
        const data = await apiCall(`/cart/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity })
        });
        
        cart = data.data;
        updateCartUI();
        renderCartItems();
    } catch (error) {
        showToast('Error updating cart: ' + error.message, 'error');
    }
};

const removeFromCart = async (itemId) => {
    try {
        const data = await apiCall(`/cart/${itemId}`, {
            method: 'DELETE'
        });
        
        cart = data.data;
        updateCartUI();
        renderCartItems();
        showToast('Item removed from cart', 'info');
    } catch (error) {
        showToast('Error removing from cart: ' + error.message, 'error');
    }
};

const clearCart = async () => {
    if (!confirm('Are you sure you want to clear your cart?')) return;
    
    try {
        const data = await apiCall('/cart', { method: 'DELETE' });
        cart = data.data;
        updateCartUI();
        renderCartItems();
        showToast('Cart cleared', 'info');
    } catch (error) {
        showToast('Error clearing cart: ' + error.message, 'error');
    }
};

const renderCartItems = () => {
    const container = document.getElementById('cartItems');
    
    if (!cart || !cart.items.length) {
        container.innerHTML = '<div class="no-data">Your cart is empty</div>';
        document.getElementById('cartSummary').innerHTML = '';
        return;
    }
    
    container.innerHTML = cart.items.map(item => `
        <div class="cart-item" data-id="${item._id}">
            <img src="${item.product.image}" alt="${item.product.name}" class="cart-item-image">
            <div class="cart-item-info">
                <h4>${item.product.name}</h4>
                <p>₹${item.price.toFixed(2)} each</p>
            </div>
            <div class="cart-item-controls">
                <button class="btn btn--sm btn--outline" onclick="updateCartItem('${item._id}', ${item.quantity - 1})">-</button>
                <span class="quantity">${item.quantity}</span>
                <button class="btn btn--sm btn--outline" onclick="updateCartItem('${item._id}', ${item.quantity + 1})">+</button>
            </div>
            <div class="cart-item-total">₹${(item.price * item.quantity).toFixed(2)}</div>
            <button class="btn btn--sm btn--danger" onclick="removeFromCart('${item._id}')">Remove</button>
        </div>
    `).join('');
    
    const subtotal = cart.totalAmount;
    const shipping = subtotal > 1000 ? 0 : 50;
    const tax = Math.round(subtotal * 0.18 * 100) / 100;
    const total = subtotal + shipping + tax;
    
    document.getElementById('cartSummary').innerHTML = `
        <div class="cart-summary-details">
            <div class="summary-line">
                <span>Subtotal (${cart.totalItems} items):</span>
                <span>₹${subtotal.toFixed(2)}</span>
            </div>
            <div class="summary-line">
                <span>Shipping:</span>
                <span>${shipping === 0 ? 'Free' : '₹' + shipping.toFixed(2)}</span>
            </div>
            <div class="summary-line">
                <span>Tax (18%):</span>
                <span>₹${tax.toFixed(2)}</span>
            </div>
            <div class="summary-line total">
                <span><strong>Total:</strong></span>
                <span><strong>₹${total.toFixed(2)}</strong></span>
            </div>
            <div class="cart-actions">
                <button class="btn btn--primary btn--large" onclick="openCheckout()">Proceed to Checkout</button>
            </div>
        </div>
    `;
};

const createOrder = async (orderData) => {
    try {
        showLoading();
        const data = await apiCall('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        
        closeModal('checkoutModal');
        switchTab('orders');
        await loadOrders();
        showToast('Order placed successfully!', 'success');
        
        cart = { items: [], totalItems: 0, totalAmount: 0 };
        updateCartUI();
    } catch (error) {
        showToast('Error placing order: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
};

const loadOrders = async () => {
    if (!currentUser) return;
    
    try {
        const data = await apiCall('/orders');
        orders = data.data;
        renderOrders(orders);
    } catch (error) {
        showToast('Error loading orders: ' + error.message, 'error');
    }
};

const renderOrders = (orderList) => {
    const container = document.getElementById('ordersList');
    
    if (!orderList.length) {
        container.innerHTML = '<div class="no-data">No orders found</div>';
        return;
    }
    
    container.innerHTML = orderList.map(order => `
        <div class="order-card" data-id="${order._id}">
            <div class="order-header">
                <div class="order-number">Order #${order.orderNumber}</div>
                <div class="order-status status--${order.orderStatus}">${order.orderStatus}</div>
            </div>
            <div class="order-details">
                <div class="order-info">
                    <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                    <p><strong>Items:</strong> ${order.totalItems}</p>
                    <p><strong>Total:</strong> ₹${order.totalAmount.toFixed(2)}</p>
                </div>
                <div class="order-items">
                    ${order.items.slice(0, 3).map(item => `
                        <div class="order-item">
                            <img src="${item.image}" alt="${item.name}">
                            <span>${item.name} × ${item.quantity}</span>
                        </div>
                    `).join('')}
                    ${order.items.length > 3 ? `<div class="more-items">+${order.items.length - 3} more</div>` : ''}
                </div>
            </div>
            ${order.orderStatus === 'placed' || order.orderStatus === 'processing' ? `
                <div class="order-actions">
                    <button class="btn btn--outline btn--sm" onclick="cancelOrder('${order._id}')">Cancel Order</button>
                </div>
            ` : ''}
        </div>
    `).join('');
};

const cancelOrder = async (orderId) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    try {
        await apiCall(`/orders/${orderId}/cancel`, {
            method: 'PUT',
            body: JSON.stringify({ reason: 'Cancelled by user' })
        });
        
        await loadOrders();
        showToast('Order cancelled successfully', 'success');
    } catch (error) {
        showToast('Error cancelling order: ' + error.message, 'error');
    }
};

const loadAllOrders = async () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    try {
        const data = await apiCall('/orders');
        renderAdminOrders(data.data);
    } catch (error) {
        showToast('Error loading orders: ' + error.message, 'error');
    }
};

const addProduct = async (productData) => {
    try {
        showLoading();
        await apiCall('/products', {
            method: 'POST',
            body: JSON.stringify(productData)
        });
        
        document.getElementById('addProductForm').reset();
        await loadProducts();
        await loadAdminProducts();
        showToast('Product added successfully!', 'success');
    } catch (error) {
        showToast('Error adding product: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
};

const loadAdminProducts = async () => {
    try {
        const data = await apiCall('/products?limit=100');
        renderAdminProducts(data.data);
    } catch (error) {
        console.error('Error loading admin products:', error);
    }
};

const renderAdminProducts = (productList) => {
    const container = document.getElementById('adminProducts');
    
    container.innerHTML = productList.map(product => `
        <div class="admin-product-card">
            <img src="${product.image}" alt="${product.name}">
            <div class="product-info">
                <h4>${product.name}</h4>
                <p>₹${product.price} | Stock: ${product.stock}</p>
                <p class="category">${product.category}</p>
            </div>
            <div class="product-actions">
                <button class="btn btn--sm btn--outline" onclick="editProduct('${product._id}')">Edit</button>
                <button class="btn btn--sm btn--danger" onclick="deleteProduct('${product._id}')">Delete</button>
            </div>
        </div>
    `).join('');
};

const deleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
        await apiCall(`/products/${productId}`, { method: 'DELETE' });
        await loadProducts();
        await loadAdminProducts();
        showToast('Product deleted successfully', 'success');
    } catch (error) {
        showToast('Error deleting product: ' + error.message, 'error');
    }
};

const renderAdminOrders = (orderList) => {
    const container = document.getElementById('adminOrders');
    
    if (!orderList.length) {
        container.innerHTML = '<div class="no-data">No orders found</div>';
        return;
    }
    
    container.innerHTML = orderList.map(order => `
        <div class="admin-order-card">
            <div class="order-header">
                <div class="order-number">Order #${order.orderNumber}</div>
                <div class="order-status status--${order.orderStatus}">${order.orderStatus}</div>
            </div>
            <div class="order-details">
                <p><strong>Customer:</strong> ${order.user.name} (${order.user.email})</p>
                <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                <p><strong>Total:</strong> ₹${order.totalAmount.toFixed(2)}</p>
                <div class="order-actions">
                    <select onchange="updateOrderStatus('${order._id}', this.value)" ${order.orderStatus === 'delivered' || order.orderStatus === 'cancelled' ? 'disabled' : ''}>
                        <option value="">Update Status</option>
                        <option value="processing" ${order.orderStatus === 'processing' ? 'selected' : ''}>Processing</option>
                        <option value="shipped" ${order.orderStatus === 'shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="delivered" ${order.orderStatus === 'delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="cancelled" ${order.orderStatus === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
            </div>
        </div>
    `).join('');
};

const updateOrderStatus = async (orderId, status) => {
    if (!status) return;
    
    try {
        await apiCall(`/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        
        await loadAllOrders();
        showToast('Order status updated successfully', 'success');
    } catch (error) {
        showToast('Error updating order status: ' + error.message, 'error');
    }
};

const updateUI = () => {
    if (currentUser) {
        authButtons.classList.add('hidden');
        userInfo.classList.remove('hidden');
        userName.textContent = currentUser.name;
        userRole.textContent = `(${currentUser.role})`;
        userRole.className = `user-role role--${currentUser.role}`;
        
        cartTab.classList.remove('hidden');
        ordersTab.classList.remove('hidden');
        
        if (currentUser.role === 'admin') {
            adminTab.classList.remove('hidden');
        }
    } else {
        authButtons.classList.remove('hidden');
        userInfo.classList.add('hidden');
        cartTab.classList.add('hidden');
        ordersTab.classList.add('hidden');
        adminTab.classList.add('hidden');
    }
    
    updateCartUI();
};

const updateCartUI = () => {
    const count = cart ? cart.totalItems : 0;
    cartCount.textContent = count;
    
    if (currentTab === 'cart') {
        renderCartItems();
    }
};

const switchTab = (tabName) => {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.add('hidden');
    });
    
    const targetPane = document.getElementById(`${tabName}Tab`) || document.getElementById(`${tabName}TabContent`);
    if (targetPane) {
        targetPane.classList.remove('hidden');
    }
    
    currentTab = tabName;
    
    switch (tabName) {
        case 'products':
            loadProducts();
            break;
        case 'cart':
            renderCartItems();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'admin':
            if (currentUser && currentUser.role === 'admin') {
                loadAdminProducts();
                loadAllOrders();
            }
            break;
    }
};

const openModal = (modalId) => {
    document.getElementById(modalId).classList.remove('hidden');
};

const closeModal = (modalId) => {
    document.getElementById(modalId).classList.add('hidden');
};

const openCheckout = () => {
    if (!cart || !cart.items.length) {
        showToast('Your cart is empty', 'warning');
        return;
    }
    
    const subtotal = cart.totalAmount;
    const shipping = subtotal > 1000 ? 0 : 50;
    const tax = Math.round(subtotal * 0.18 * 100) / 100;
    const total = subtotal + shipping + tax;
    
    document.getElementById('checkoutSummary').innerHTML = `
        <h3>Order Summary</h3>
        <div class="summary-line">
            <span>Subtotal (${cart.totalItems} items):</span>
            <span>₹${subtotal.toFixed(2)}</span>
        </div>
        <div class="summary-line">
            <span>Shipping:</span>
            <span>${shipping === 0 ? 'Free' : '₹' + shipping.toFixed(2)}</span>
        </div>
        <div class="summary-line">
            <span>Tax (18%):</span>
            <span>₹${tax.toFixed(2)}</span>
        </div>
        <div class="summary-line total">
            <span><strong>Total:</strong></span>
            <span><strong>₹${total.toFixed(2)}</strong></span>
        </div>
    `;
    
    openModal('checkoutModal');
};

const editProduct = (productId) => {
    showToast('Edit functionality not implemented in this demo', 'info');
};

document.addEventListener('DOMContentLoaded', async () => {
    const token = getAuthToken();
    if (token) {
        try {
            const data = await apiCall('/auth/me');
            currentUser = data.user;
            await loadCart();
        } catch (error) {
            removeAuthToken();
        }
    }
    
    updateUI();
    loadProducts();
    
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });
    
    document.getElementById('loginBtn').addEventListener('click', () => openModal('loginModal'));
    document.getElementById('registerBtn').addEventListener('click', () => openModal('registerModal'));
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            modal.classList.add('hidden');
        });
    });
    
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        await login(email, password);
    });
    
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const role = document.getElementById('registerRole').value;
        await register(name, email, password, role);
    });
    
    document.getElementById('addProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            name: document.getElementById('productName').value,
            description: document.getElementById('productDescription').value,
            price: parseFloat(document.getElementById('productPrice').value),
            category: document.getElementById('productCategory').value,
            stock: parseInt(document.getElementById('productStock').value),
            image: document.getElementById('productImage').value
        };
        await addProduct(formData);
    });
    
    document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const orderData = {
            shippingAddress: {
                street: document.getElementById('shippingStreet').value,
                city: document.getElementById('shippingCity').value,
                state: document.getElementById('shippingState').value,
                postalCode: document.getElementById('shippingPostalCode').value,
                country: document.getElementById('shippingCountry').value
            },
            paymentMethod: document.getElementById('paymentMethod').value,
            notes: document.getElementById('orderNotes').value
        };
        await createOrder(orderData);
    });
    
    document.getElementById('searchBtn').addEventListener('click', () => {
        const search = document.getElementById('searchInput').value;
        const category = document.getElementById('categoryFilter').value;
        loadProducts(1, search, category);
    });
    
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const search = e.target.value;
            const category = document.getElementById('categoryFilter').value;
            loadProducts(1, search, category);
        }
    });
    
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
        const search = document.getElementById('searchInput').value;
        const category = e.target.value;
        loadProducts(1, search, category);
    });
    
    document.getElementById('clearCartBtn').addEventListener('click', clearCart);
});
