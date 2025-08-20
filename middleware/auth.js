const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Token is valid but user not found'
                });
            }

            if (!user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'User account is deactivated'
                });
            }

            req.user = user;
            next();
        } catch (tokenError) {
            console.error('Token verification error:', tokenError.message);
            
            if (tokenError.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token'
                });
            } else if (tokenError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token expired'
                });
            } else {
                return res.status(401).json({
                    success: false,
                    message: 'Token verification failed'
                });
            }
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during authentication'
        });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
            });
        }

        next();
    };
};

const isAdmin = authorize('admin');
const isCustomerOrAdmin = authorize('customer', 'admin');

const optionalAuth = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select('-password');
                
                if (user && user.isActive) {
                    req.user = user;
                }
            } catch (tokenError) {
                console.log('Optional auth - invalid token:', tokenError.message);
            }
        }

        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        next();
    }
};

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

const sendTokenResponse = (user, statusCode, res) => {
    const token = generateToken(user._id);

    const options = {
        expires: new Date(Date.now() + (parseInt(process.env.JWT_COOKIE_EXPIRE) || 7) * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    };

    res.status(statusCode)
       .cookie('token', token, options)
       .json({
           success: true,
           token,
           user: user.getPublicProfile()
       });
};

module.exports = {
    protect,
    authorize,
    isAdmin,
    isCustomerOrAdmin,
    optionalAuth,
    generateToken,
    sendTokenResponse
};
