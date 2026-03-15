const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const moment = require('moment-timezone');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'kiroboost_secret_key_2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// MongoDB Connection
const uri = process.env.MONGODB_URI || "mongodb+srv://biarzxc:XaneKath1@biarzxc.o56uqfx.mongodb.net/?appName=biarzxc";

const clientOptions = {
    serverApi: { version: '1', strict: false, deprecationErrors: true },
    maxPoolSize: 50,
    minPoolSize: 10,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000,
    family: 4
};

// ============ UTILITY FUNCTIONS ============

function getPHTime() {
    return moment().tz('Asia/Manila').toDate();
}

function formatPHDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    return moment(date).tz('Asia/Manila').format(format);
}

function normalizeFacebookUrl(url) {
    if (!url) return url;
    url = url.trim();
    url = url.replace(/^https?:\/\//i, '');
    url = url.replace(/^(www\.|m\.)/i, '');
    if (!url.startsWith('facebook.com') && !url.startsWith('fb.com')) {
        if (!url.includes('/')) {
            url = `facebook.com/${url}`;
        }
    }
    url = url.replace(/^fb\.com/i, 'facebook.com');
    return url;
}

function isValidFacebookUrl(url) {
    if (!url) return false;
    const normalized = normalizeFacebookUrl(url);
    const regex = /^facebook\.com\/[\w\.\-]+/i;
    return regex.test(normalized);
}

// ============ COOKIE VALIDATION ============

const graph = "https://graph.facebook.com";

async function getToken(cookie) {
    let retries = 2;
    while (retries > 0) {
        try {
            const { data } = await axios.get('https://business.facebook.com/business_locations', {
                headers: {
                    cookie,
                    'user-agent': 'Mozilla/5.0 (Linux; Android 8.1.0; MI 8 Build/OPM1.171019.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.86 Mobile Safari/537.36',
                    'referer': 'https://www.facebook.com/',
                    'host': 'business.facebook.com',
                    'origin': 'https://business.facebook.com'
                },
                timeout: 10000
            });
            const token = data.match(/EAAG\w+/);
            if (token) return token[0];
        } catch (error) {
            console.error(`Token extraction attempt ${3 - retries} failed:`, error.message);
        }
        retries--;
    }
    return false;
}

async function getSelf(token, cookie) {
    let retries = 2;
    while (retries > 0) {
        try {
            const info = await axios.get(graph + '/me', {
                params: { fields: 'id,name', access_token: token },
                headers: { cookie },
                timeout: 8000
            });
            if (info.data.name && info.data.id) {
                return { uid: info.data.id, name: info.data.name };
            }
        } catch (error) {
            console.error(`Get self attempt ${3 - retries} failed:`, error.message);
        }
        retries--;
    }
    return false;
}

async function validateCookieAndGetInfo(cookie) {
    try {
        const token = await getToken(cookie);
        if (!token) return { valid: false, error: 'Could not extract EAAG token from cookie' };
        const accountInfo = await getSelf(token, cookie);
        if (!accountInfo) return { valid: false, error: 'Could not retrieve account information' };
        return { valid: true, uid: accountInfo.uid, name: accountInfo.name, eaagToken: token, status: 'active' };
    } catch (error) {
        console.error('Cookie validation error:', error.message);
        return { valid: false, error: 'Unable to validate cookie - may be expired or invalid' };
    }
}

// ============ SCHEMAS ============

const cookieSchema = new mongoose.Schema({
    cookie: { type: String, required: true },
    uid: { type: String, required: true },
    name: { type: String, required: true },
    addedAt: { type: Date, default: getPHTime },
    lastUsed: { type: Date, default: null },
    status: { type: String, enum: ['active', 'expired', 'blocked', 'restricted'], default: 'active' }
});

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, index: true },
    password: { type: String, required: true, minlength: 6 },
    facebook: {
        type: String,
        required: true,
        validate: {
            validator: function(v) { return isValidFacebookUrl(v); },
            message: 'Please provide a valid Facebook link (e.g., facebook.com/username)'
        }
    },
    // Profile fields
    profileImage:    { type: String, default: null },
    profileImageUrl: { type: String, default: null },
    bio:             { type: String, default: '', maxlength: 300 },
    status:          { type: String, default: 'online', maxlength: 100 },
    avatarBorder:    { type: String, default: 'none' },
    sticker:         { type: String, default: null },
    bannerColor:     { type: String, default: '#111111' },
    bannerImage:     { type: String, default: null },
    accentColor:     { type: String, default: '#ffffff' },
    badges:          [{ type: String }],
    // Core fields
    isAdmin:       { type: Boolean, default: false },
    isActive:      { type: Boolean, default: true },
    createdAt:     { type: Date, default: getPHTime },
    lastLogin:     { type: Date, default: null },
    lastShareTime: { type: Date, default: null },
    totalShares:   { type: Number, default: 0 },
    cookies:       [cookieSchema],
    shareHistory:  [{ date: { type: Date, default: getPHTime }, count: { type: Number, default: 0 } }]
});

userSchema.index({ username: 1, isActive: 1 });

const boosterOrderSchema = new mongoose.Schema({
    orderId:       { type: String, required: true, unique: true, index: true },
    customerName:  { type: String, required: true },
    postLink:      { type: String, default: '' },          // FIX: not required — boost sessions may not have it
    quantity:      { type: Number, required: true },
    amount:        { type: Number, required: true, default: 0 },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'cancelled', 'refunded', 'partial'],
        default: 'pending',
        index: true
    },
    startCount:     { type: Number, default: 0 },
    currentCount:   { type: Number, default: 0 },
    remainingCount: { type: Number, default: 0 },
    createdAt:      { type: Date, default: getPHTime, index: true },
    completedAt:    { type: Date, default: null },
    createdBy:      { type: String, required: true, index: true },
    referenceNote:  { type: String, default: '' },
    notes:          { type: String, default: '' },
    speed:          { type: String, enum: ['slow', 'medium', 'fast', 'instant'], default: 'instant' },
    priority:       { type: Number, default: 0 },
    refundAmount:   { type: Number, default: 0 }
});

boosterOrderSchema.index({ createdBy: 1, status: 1, createdAt: -1 });

const User = mongoose.model('User', userSchema);
const BoosterOrder = mongoose.model('BoosterOrder', boosterOrderSchema);

const inboxMessageSchema = new mongoose.Schema({
    messageId:         { type: String, required: true, unique: true, index: true },
    title:             { type: String, required: true },
    content:           { type: String, required: true },
    imageUrl:          { type: String, default: null },
    type:              { type: String, enum: ['announcement', 'welcome', 'promo', 'system'], default: 'announcement' },
    isRead:            { type: Boolean, default: false },
    recipientUsername: { type: String, required: true, index: true },
    sentBy:            { type: String, default: 'system' },
    createdAt:         { type: Date, default: getPHTime, index: true }
});

inboxMessageSchema.index({ recipientUsername: 1, isRead: 1, createdAt: -1 });

const InboxMessage = mongoose.model('InboxMessage', inboxMessageSchema);

// ============ MIDDLEWARE ============

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ success: false, message: 'No authentication token provided' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).lean();
        if (!user) return res.status(401).json({ success: false, message: 'User not found' });
        req.user = user;
        req.userId = user._id;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid authentication token' });
    }
};

const adminMiddleware = async (req, res, next) => {
    if (!req.user.isAdmin) return res.status(403).json({ success: false, message: 'Admin access required' });
    next();
};

// ============ BASE ROUTES ============

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'KiroBoost API Server v2.0 - Professional SMM Panel',
        database: 'kiroboost-api',
        features: [
            'Authentication', 'User Management', 'Share Tracking',
            'Cookie Database', 'Profile Images (GIF/URL/Base64)',
            'Discord-Style Profiles', 'Stats & Analytics', 'SMM Panel Boost',
            'Multiple Cookies Support', 'Zero Delay Sharing', 'Inbox System', 'Auto-Activation'
        ],
        time: formatPHDate(getPHTime()),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

app.get('/health', (req, res) => {
    const status = mongoose.connection.readyState === 1 ? 200 : 503;
    res.status(status).json({
        uptime: process.uptime(),
        timestamp: formatPHDate(getPHTime()),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ============ AUTH ROUTES ============

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, facebook } = req.body;

        if (!username || !password || !facebook)
            return res.status(400).json({ success: false, message: 'Username, password, and Facebook link are required' });

        if (await User.findOne({ username }).lean())
            return res.status(400).json({ success: false, message: 'Username already exists' });

        const normalizedFacebook = normalizeFacebookUrl(facebook);
        if (!isValidFacebookUrl(normalizedFacebook))
            return res.status(400).json({ success: false, message: 'Please provide a valid Facebook link' });

        const user = await User.create({
            username,
            password: await bcrypt.hash(password, 10),
            facebook: normalizedFacebook,
            isActive: true,
            cookies: [],
            shareHistory: []
        });

        await InboxMessage.create({
            messageId: `WEL${Date.now()}${Math.floor(Math.random() * 1000)}`,
            title: 'Welcome to KiroBoost!',
            content: `Hi ${username}! Welcome to KiroBoost - Your Professional SMM Panel. Your account is now active and ready to use. Start by adding your cookies and placing boost orders. Enjoy all features of the platform!`,
            imageUrl: null,
            type: 'welcome',
            isRead: false,
            recipientUsername: username,
            sentBy: 'system',
            createdAt: getPHTime()
        });

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            success: true,
            message: 'Registration successful! Your account is now active.',
            token,
            user: {
                username: user.username,
                facebook: user.facebook,
                isActive: true,
                cookieCount: 0,
                profileImage: null,
                bio: '',
                status: 'online',
                avatarBorder: 'none'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password)
            return res.status(400).json({ success: false, message: 'Username and password are required' });

        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password)))
            return res.status(401).json({ success: false, message: 'Invalid username or password' });

        user.lastLogin = getPHTime();
        await user.save();

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                username: user.username,
                facebook: user.facebook,
                isAdmin: user.isAdmin,
                isActive: user.isActive,
                totalShares: user.totalShares,
                cookieCount: user.cookies.length,
                profileImage: user.profileImage,
                profileImageUrl: user.profileImageUrl,
                bio: user.bio || '',
                status: user.status || 'online',
                avatarBorder: user.avatarBorder || 'none',
                sticker: user.sticker || null,
                bannerColor: user.bannerColor || '#111111',
                bannerImage: user.bannerImage || null,
                accentColor: user.accentColor || '#ffffff',
                badges: user.badges || []
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Login failed', error: error.message });
    }
});

// ============ SHARE TRACKING ROUTES ============

// POST /api/share/start
// FIX: Creates a BoosterOrder (status: processing) so the session is tracked in Transactions.
// Returns orderId so boost.html can link the session to this order.
// body: { postLink?, quantity?, accountCount?, speed?, referenceNote? }
app.post('/api/share/start', authMiddleware, async (req, res) => {
    try {
        const {
            postLink      = '',
            quantity      = 1,
            accountCount  = 1,
            speed         = 'instant',
            referenceNote = ''
        } = req.body;

        await User.findByIdAndUpdate(req.userId, { lastShareTime: getPHTime() });

        const orderId     = `ORD${Date.now()}${Math.floor(Math.random() * 10000)}`;
        const resolvedQty = Math.max(1, parseInt(quantity) || parseInt(accountCount) || 1);
        const resolvedSpd = ['slow', 'medium', 'fast', 'instant'].includes(speed) ? speed : 'instant';

        const order = await BoosterOrder.create({
            orderId,
            customerName:   req.user.username,
            postLink:       postLink || '',
            quantity:       resolvedQty,
            amount:         0,
            status:         'processing',
            startCount:     0,
            currentCount:   0,
            remainingCount: resolvedQty,
            createdBy:      req.user.username,
            referenceNote:  referenceNote || `Boost – ${formatPHDate(getPHTime(), 'MMM DD YYYY h:mm A')}`,
            speed:          resolvedSpd,
            priority:       0,
            createdAt:      getPHTime()
        });

        res.json({
            success: true,
            message: 'Share started successfully',
            orderId: order.orderId
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to start share', error: error.message });
    }
});

// POST /api/share/complete
// FIX 1: Uses index-based mutation + markModified('shareHistory') to fix the Mongoose nested
//         array bug that silently discarded share history updates.
// FIX 2: Updates the linked BoosterOrder with the correct final status:
//         completed / partial (stopped with shares) / cancelled (stopped with zero).
// body: { totalShares, orderId, stopped?, failCount? }
app.post('/api/share/complete', authMiddleware, async (req, res) => {
    try {
        const {
            totalShares = 0,
            orderId     = null,
            stopped     = false,
            failCount   = 0
        } = req.body;

        const shareCount = Math.max(0, parseInt(totalShares) || 0);
        const today      = moment().tz('Asia/Manila').startOf('day').toDate();

        // ── Update user share stats ──────────────────────────────────────────────
        const user = await User.findById(req.userId);

        if (shareCount > 0) {
            user.totalShares += shareCount;

            const idx = user.shareHistory.findIndex(h =>
                moment(h.date).tz('Asia/Manila').isSame(today, 'day')
            );

            if (idx > -1) {
                // Index-based mutation — Mongoose detects this correctly
                user.shareHistory[idx].count += shareCount;
            } else {
                user.shareHistory.push({ date: today, count: shareCount });
            }

            if (user.shareHistory.length > 30) {
                user.shareHistory = user.shareHistory.slice(-30);
            }

            // CRITICAL: without markModified, Mongoose ignores nested subdoc changes
            user.markModified('shareHistory');
            await user.save();
        }

        // ── Finalize linked BoosterOrder ─────────────────────────────────────────
        let order = null;
        if (orderId) {
            order = await BoosterOrder.findOne({ orderId, createdBy: req.user.username });

            if (order) {
                order.currentCount   = shareCount;
                order.remainingCount = Math.max(0, order.quantity - shareCount);
                order.completedAt    = getPHTime();

                if (stopped) {
                    // Manually stopped — partial if any shares, cancelled if none
                    order.status = shareCount > 0 ? 'partial' : 'cancelled';
                } else if (order.quantity > 0 && shareCount >= order.quantity) {
                    // Hit or exceeded target
                    order.status = 'completed';
                } else if (shareCount > 0) {
                    // Unlimited target or natural end with shares done
                    order.status = 'completed';
                } else {
                    // No shares at all
                    order.status = 'cancelled';
                }

                await order.save();
            }
        }

        res.json({
            success:     true,
            message:     'Share completed',
            totalShares: shareCount,
            orderStatus: order?.status || null,
            orderId:     order?.orderId || null
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to complete share', error: error.message });
    }
});

// ============ USER STATS ============

app.get('/api/user/stats', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).lean();

        // FIX: Sort by date ascending so chart renders correctly oldest → newest
        const last30Days = user.shareHistory
            .slice(-30)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(h => ({
                date:  formatPHDate(h.date, 'YYYY-MM-DD'),
                count: h.count
            }));

        res.json({
            success: true,
            stats: {
                username:        user.username,
                isActive:        user.isActive,
                totalShares:     user.totalShares,
                cookieCount:     user.cookies.length,
                profileImage:    user.profileImage,
                profileImageUrl: user.profileImageUrl,
                bio:             user.bio || '',
                status:          user.status || 'online',
                avatarBorder:    user.avatarBorder || 'none',
                sticker:         user.sticker || null,
                bannerColor:     user.bannerColor || '#111111',
                bannerImage:     user.bannerImage || null,
                accentColor:     user.accentColor || '#ffffff',
                badges:          user.badges || [],
                shareHistory:    last30Days
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get stats', error: error.message });
    }
});

// ============ PROFILE ROUTES ============

app.post('/api/user/profile/image', authMiddleware, async (req, res) => {
    try {
        const { imageData, imageUrl } = req.body;
        if (!imageData && !imageUrl)
            return res.status(400).json({ success: false, message: 'Image data or URL is required' });

        const updateData = {};
        if (imageData) {
            if (!imageData.startsWith('data:image/'))
                return res.status(400).json({ success: false, message: 'Invalid image format' });
            updateData.profileImage    = imageData;
            updateData.profileImageUrl = null;
        }
        if (imageUrl) {
            updateData.profileImageUrl = imageUrl;
            updateData.profileImage    = null;
        }

        await User.findByIdAndUpdate(req.userId, updateData);
        res.json({
            success:         true,
            message:         'Profile image updated successfully',
            profileImage:    updateData.profileImage    || null,
            profileImageUrl: updateData.profileImageUrl || null
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update profile image', error: error.message });
    }
});

app.delete('/api/user/profile/image', authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { profileImage: null, profileImageUrl: null });
        res.json({ success: true, message: 'Profile image removed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove profile image', error: error.message });
    }
});

app.post('/api/user/profile/banner', authMiddleware, async (req, res) => {
    try {
        const { imageData } = req.body;
        if (!imageData) return res.status(400).json({ success: false, message: 'Image data is required' });
        if (!imageData.startsWith('data:image/'))
            return res.status(400).json({ success: false, message: 'Invalid image format. Must be base64 image data (supports GIF, PNG, JPG, WEBP)' });

        await User.findByIdAndUpdate(req.userId, { bannerImage: imageData });
        res.json({ success: true, message: 'Banner image updated successfully', bannerImage: imageData });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update banner image', error: error.message });
    }
});

app.delete('/api/user/profile/banner', authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { bannerImage: null });
        res.json({ success: true, message: 'Banner image removed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove banner image', error: error.message });
    }
});

app.put('/api/user/profile', authMiddleware, async (req, res) => {
    try {
        const { bio, status, avatarBorder, sticker, bannerColor, accentColor } = req.body;
        const updateData = {};
        if (bio         !== undefined) updateData.bio         = bio.substring(0, 300);
        if (status      !== undefined) updateData.status      = status.substring(0, 100);
        if (avatarBorder !== undefined) updateData.avatarBorder = avatarBorder;
        if (sticker     !== undefined) updateData.sticker     = sticker;
        if (bannerColor !== undefined) updateData.bannerColor = bannerColor;
        if (accentColor !== undefined) updateData.accentColor = accentColor;

        const user = await User.findByIdAndUpdate(req.userId, updateData, { new: true }).lean();
        res.json({
            success: true,
            message: 'Profile updated successfully',
            profile: {
                username:    user.username,
                bio:         user.bio || '',
                status:      user.status || 'online',
                avatarBorder:user.avatarBorder || 'none',
                sticker:     user.sticker || null,
                bannerColor: user.bannerColor || '#111111',
                bannerImage: user.bannerImage || null,
                accentColor: user.accentColor || '#ffffff',
                badges:      user.badges || []
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
    }
});

app.get('/api/user/profile/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('-password -cookies -shareHistory')
            .lean();

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        res.json({
            success: true,
            profile: {
                username:        user.username,
                facebook:        user.facebook,
                profileImage:    user.profileImage,
                profileImageUrl: user.profileImageUrl,
                bio:             user.bio || '',
                status:          user.status || 'online',
                avatarBorder:    user.avatarBorder || 'none',
                sticker:         user.sticker || null,
                bannerColor:     user.bannerColor || '#111111',
                bannerImage:     user.bannerImage || null,
                accentColor:     user.accentColor || '#ffffff',
                badges:          user.badges || [],
                totalShares:     user.totalShares,
                createdAt:       formatPHDate(user.createdAt)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get profile', error: error.message });
    }
});

// ============ COOKIE DATABASE ROUTES ============

app.post('/api/user/cookies', authMiddleware, async (req, res) => {
    try {
        const { cookie } = req.body;
        if (!cookie) return res.status(400).json({ success: false, message: 'Cookie is required' });

        const user = await User.findById(req.userId);
        const validation = await validateCookieAndGetInfo(cookie.trim());

        if (!validation.valid)
            return res.status(400).json({ success: false, message: validation.error || 'Invalid cookie or unable to extract EAAG token' });

        const existingCookie = user.cookies.find(c => c.uid === validation.uid);
        if (existingCookie)
            return res.status(400).json({ success: false, message: 'This account cookie is already added' });

        user.cookies.push({
            cookie:  cookie.trim(),
            uid:     validation.uid,
            name:    validation.name,
            addedAt: getPHTime(),
            lastUsed: null,
            status:  'active'
        });

        await user.save();
        res.json({
            success:      true,
            message:      'Cookie added successfully',
            name:         validation.name,
            uid:          validation.uid,
            status:       'active',
            totalCookies: user.cookies.length
        });
    } catch (error) {
        console.error('Add cookie error:', error);
        res.status(500).json({ success: false, message: 'Failed to add cookie', error: error.message });
    }
});

app.get('/api/user/cookies', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).lean();
        res.json({
            success: true,
            count:   user.cookies.length,
            cookies: user.cookies.map(c => ({
                id:       c._id,
                cookie:   c.cookie,
                uid:      c.uid,
                name:     c.name,
                status:   c.status,
                addedAt:  formatPHDate(c.addedAt),
                lastUsed: c.lastUsed ? formatPHDate(c.lastUsed) : null
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get cookies', error: error.message });
    }
});

app.delete('/api/user/cookies/:cookieId', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const initialLength = user.cookies.length;
        user.cookies = user.cookies.filter(c => c._id.toString() !== req.params.cookieId);

        if (user.cookies.length === initialLength)
            return res.status(404).json({ success: false, message: 'Cookie not found' });

        await user.save();
        res.json({ success: true, message: 'Cookie deleted successfully', totalCookies: user.cookies.length });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete cookie', error: error.message });
    }
});

app.post('/api/user/cookies/delete-multiple', authMiddleware, async (req, res) => {
    try {
        const { cookieIds } = req.body;
        if (!cookieIds || !Array.isArray(cookieIds) || cookieIds.length === 0)
            return res.status(400).json({ success: false, message: 'Cookie IDs array is required' });

        const user = await User.findById(req.userId);
        const initialLength = user.cookies.length;
        user.cookies = user.cookies.filter(c => !cookieIds.includes(c._id.toString()));
        const deletedCount = initialLength - user.cookies.length;

        await user.save();
        res.json({
            success:      true,
            message:      `Successfully deleted ${deletedCount} cookie(s)`,
            deletedCount,
            totalCookies: user.cookies.length
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete cookies', error: error.message });
    }
});

// ============ BOOSTER ORDERS (SMM PANEL) ============

app.post('/api/admin/orders', authMiddleware, async (req, res) => {
    try {
        const { customOrderId, customerName, postLink, quantity, amount, notes, referenceNote, speed, priority } = req.body;

        if (!customerName || !postLink || !quantity)
            return res.status(400).json({ success: false, message: 'Customer name, post link, and quantity are required' });

        const orderId = customOrderId || `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const order = await BoosterOrder.create({
            orderId,
            customerName,
            postLink,
            quantity:       parseInt(quantity),
            amount:         parseFloat(amount) || 0,
            status:         'pending',
            startCount:     0,
            currentCount:   0,
            remainingCount: parseInt(quantity),
            createdBy:      req.user.username,
            referenceNote:  referenceNote || '',
            notes:          notes || '',
            speed:          speed || 'instant',
            priority:       priority || 0,
            createdAt:      getPHTime()
        });

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: {
                orderId:       order.orderId,
                customerName:  order.customerName,
                postLink:      order.postLink,
                quantity:      order.quantity,
                amount:        order.amount,
                status:        order.status,
                referenceNote: order.referenceNote,
                notes:         order.notes,
                speed:         order.speed,
                createdAt:     formatPHDate(order.createdAt)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create order', error: error.message });
    }
});

app.get('/api/admin/orders', authMiddleware, async (req, res) => {
    try {
        const { status, limit = 50, customerName, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        let query = {};
        if (!req.user.isAdmin) query.createdBy = req.user.username;

        if (status && ['pending', 'processing', 'completed', 'cancelled', 'refunded', 'partial'].includes(status))
            query.status = status;
        if (customerName) query.customerName = { $regex: customerName, $options: 'i' };

        const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const orders = await BoosterOrder.find(query).sort(sortOptions).limit(parseInt(limit)).lean();

        const baseQuery = req.user.isAdmin ? {} : { createdBy: req.user.username };
        const [totalOrders, pendingOrders, processingOrders, completedOrders] = await Promise.all([
            BoosterOrder.countDocuments(baseQuery),
            BoosterOrder.countDocuments({ ...baseQuery, status: 'pending' }),
            BoosterOrder.countDocuments({ ...baseQuery, status: 'processing' }),
            BoosterOrder.countDocuments({ ...baseQuery, status: 'completed' })
        ]);

        res.json({
            success: true,
            count: orders.length,
            summary: { total: totalOrders, pending: pendingOrders, processing: processingOrders, completed: completedOrders },
            orders: orders.map(o => ({
                orderId:       o.orderId,
                customerName:  o.customerName,
                postLink:      o.postLink,
                quantity:      o.quantity,
                amount:        o.amount,
                status:        o.status,
                currentCount:  o.currentCount,
                remainingCount:o.remainingCount,
                referenceNote: o.referenceNote,
                notes:         o.notes,
                speed:         o.speed,
                createdBy:     o.createdBy,
                createdAt:     formatPHDate(o.createdAt),
                completedAt:   o.completedAt ? formatPHDate(o.completedAt) : null
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get orders', error: error.message });
    }
});

// FIX: These two routes MUST be declared before /:orderId to avoid Express param conflict
app.get('/api/admin/orders/stats/summary', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const [
            totalOrders, pendingOrders, processingOrders, completedOrders, cancelledOrders,
            totalRevenue, todayOrders, todayRevenue
        ] = await Promise.all([
            BoosterOrder.countDocuments(),
            BoosterOrder.countDocuments({ status: 'pending' }),
            BoosterOrder.countDocuments({ status: 'processing' }),
            BoosterOrder.countDocuments({ status: 'completed' }),
            BoosterOrder.countDocuments({ status: 'cancelled' }),
            BoosterOrder.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            BoosterOrder.countDocuments({ createdAt: { $gte: moment().tz('Asia/Manila').startOf('day').toDate() } }),
            BoosterOrder.aggregate([
                { $match: { status: 'completed', createdAt: { $gte: moment().tz('Asia/Manila').startOf('day').toDate() } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        res.json({
            success: true,
            stats: {
                totalOrders, pendingOrders, processingOrders, completedOrders, cancelledOrders,
                totalRevenue: totalRevenue[0]?.total || 0,
                todayOrders,
                todayRevenue: todayRevenue[0]?.total || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get order stats', error: error.message });
    }
});

// FIX: Must be before /:orderId
app.put('/api/admin/orders/bulk/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { orderIds, status } = req.body;
        if (!orderIds || !Array.isArray(orderIds) || !status)
            return res.status(400).json({ success: false, message: 'Order IDs array and status are required' });

        const updateData = { status };
        if (status === 'completed') updateData.completedAt = getPHTime();

        const result = await BoosterOrder.updateMany({ orderId: { $in: orderIds } }, { $set: updateData });
        res.json({ success: true, message: `Updated ${result.modifiedCount} order(s)`, modifiedCount: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to bulk update orders', error: error.message });
    }
});

app.get('/api/admin/orders/:orderId', authMiddleware, async (req, res) => {
    try {
        let query = { orderId: req.params.orderId };
        if (!req.user.isAdmin) query.createdBy = req.user.username;

        const order = await BoosterOrder.findOne(query).lean();
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        res.json({
            success: true,
            order: {
                orderId:        order.orderId,
                customerName:   order.customerName,
                postLink:       order.postLink,
                quantity:       order.quantity,
                amount:         order.amount,
                status:         order.status,
                startCount:     order.startCount,
                currentCount:   order.currentCount,
                remainingCount: order.remainingCount,
                referenceNote:  order.referenceNote,
                notes:          order.notes,
                speed:          order.speed,
                priority:       order.priority,
                createdBy:      order.createdBy,
                createdAt:      formatPHDate(order.createdAt),
                completedAt:    order.completedAt ? formatPHDate(order.completedAt) : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get order', error: error.message });
    }
});

app.put('/api/admin/orders/:orderId', authMiddleware, async (req, res) => {
    try {
        const { status, currentCount, notes, referenceNote, startCount } = req.body;

        let query = { orderId: req.params.orderId };
        if (!req.user.isAdmin) query.createdBy = req.user.username;

        const order = await BoosterOrder.findOne(query);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        if (status) {
            order.status = status;
            if (status === 'completed') { order.completedAt = getPHTime(); order.currentCount = order.quantity; order.remainingCount = 0; }
            if (status === 'cancelled' || status === 'refunded') order.completedAt = getPHTime();
        }
        if (currentCount !== undefined) {
            order.currentCount   = parseInt(currentCount);
            order.remainingCount = Math.max(0, order.quantity - order.currentCount);
            if (order.currentCount >= order.quantity && order.status !== 'completed') {
                order.status = 'completed'; order.completedAt = getPHTime(); order.remainingCount = 0;
            }
            if (order.currentCount > 0 && order.status === 'pending') order.status = 'processing';
        }
        if (startCount     !== undefined) order.startCount     = parseInt(startCount);
        if (notes          !== undefined) order.notes          = notes;
        if (referenceNote  !== undefined) order.referenceNote  = referenceNote;

        await order.save();
        res.json({
            success: true,
            message: 'Order updated successfully',
            order: {
                orderId:        order.orderId,
                customerName:   order.customerName,
                postLink:       order.postLink,
                quantity:       order.quantity,
                amount:         order.amount,
                status:         order.status,
                currentCount:   order.currentCount,
                remainingCount: order.remainingCount,
                referenceNote:  order.referenceNote,
                notes:          order.notes,
                createdBy:      order.createdBy,
                createdAt:      formatPHDate(order.createdAt),
                completedAt:    order.completedAt ? formatPHDate(order.completedAt) : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update order', error: error.message });
    }
});

app.delete('/api/admin/orders/:orderId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const order = await BoosterOrder.findOneAndDelete({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete order', error: error.message });
    }
});

// ============ USER ORDER HISTORY ============

// FIX: Added 'partial' to allowed statuses, added 'processing' count to summary,
//      added postLink / currentCount / remainingCount / completedAt to response fields.
app.get('/api/user/orders/history', authMiddleware, async (req, res) => {
    try {
        const { limit = 50, status } = req.query;

        let query = { createdBy: req.user.username };
        const allowed = ['pending', 'processing', 'completed', 'cancelled', 'refunded', 'partial'];
        if (status && allowed.includes(status)) query.status = status;

        const orders = await BoosterOrder.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        const base = { createdBy: req.user.username };
        const [totalOrders, completedOrders, pendingOrders, processingOrders] = await Promise.all([
            BoosterOrder.countDocuments(base),
            BoosterOrder.countDocuments({ ...base, status: 'completed' }),
            BoosterOrder.countDocuments({ ...base, status: 'pending' }),
            BoosterOrder.countDocuments({ ...base, status: 'processing' })
        ]);

        res.json({
            success: true,
            count:   orders.length,
            summary: {
                total:      totalOrders,
                completed:  completedOrders,
                pending:    pendingOrders,
                processing: processingOrders
            },
            orders: orders.map(o => ({
                orderId:        o.orderId,
                customerName:   o.customerName,
                postLink:       o.postLink,
                quantity:       o.quantity,
                amount:         o.amount,
                status:         o.status,
                currentCount:   o.currentCount,
                remainingCount: o.remainingCount,
                referenceNote:  o.referenceNote,
                date:           formatPHDate(o.createdAt, 'MMM DD, YYYY'),
                time:           formatPHDate(o.createdAt, 'h:mm A'),
                createdAt:      formatPHDate(o.createdAt),
                completedAt:    o.completedAt ? formatPHDate(o.completedAt) : null
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get order history', error: error.message });
    }
});

// FIX: Also searches by orderId, returns full fields including postLink / currentCount / completedAt
app.get('/api/user/orders/search', authMiddleware, async (req, res) => {
    try {
        const { reference } = req.query;
        if (!reference) return res.status(400).json({ success: false, message: 'Reference note is required' });

        const orders = await BoosterOrder.find({
            createdBy: req.user.username,
            $or: [
                { referenceNote: { $regex: reference, $options: 'i' } },
                { orderId:       { $regex: reference, $options: 'i' } }
            ]
        }).sort({ createdAt: -1 }).limit(20).lean();

        if (orders.length === 0)
            return res.status(404).json({ success: false, message: 'No orders found with that reference' });

        res.json({
            success: true,
            count:   orders.length,
            orders: orders.map(o => ({
                orderId:        o.orderId,
                customerName:   o.customerName,
                postLink:       o.postLink,
                quantity:       o.quantity,
                amount:         o.amount,
                status:         o.status,
                currentCount:   o.currentCount,
                remainingCount: o.remainingCount,
                referenceNote:  o.referenceNote,
                date:           formatPHDate(o.createdAt, 'MMM DD, YYYY'),
                time:           formatPHDate(o.createdAt, 'h:mm A'),
                createdAt:      formatPHDate(o.createdAt),
                completedAt:    o.completedAt ? formatPHDate(o.completedAt) : null
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to search orders', error: error.message });
    }
});

// ============ INBOX ROUTES ============

app.get('/api/user/inbox', authMiddleware, async (req, res) => {
    try {
        const { filter = 'all', limit = 50 } = req.query;
        let query = { recipientUsername: req.user.username };
        if (filter === 'unread')        query.isRead = false;
        else if (filter === 'announcements') query.type = 'announcement';
        else if (filter === 'promos')   query.type = 'promo';

        const messages = await InboxMessage.find(query).sort({ createdAt: -1 }).limit(parseInt(limit)).lean();

        const [totalMessages, unreadCount] = await Promise.all([
            InboxMessage.countDocuments({ recipientUsername: req.user.username }),
            InboxMessage.countDocuments({ recipientUsername: req.user.username, isRead: false })
        ]);

        res.json({
            success: true,
            count: messages.length,
            unreadCount,
            totalMessages,
            messages: messages.map(m => ({
                messageId: m.messageId,
                title:     m.title,
                content:   m.content.substring(0, 120) + (m.content.length > 120 ? '...' : ''),
                imageUrl:  m.imageUrl,
                type:      m.type,
                isRead:    m.isRead,
                sentBy:    m.sentBy,
                date:      formatPHDate(m.createdAt, 'MMM DD, YYYY'),
                time:      formatPHDate(m.createdAt, 'h:mm A'),
                createdAt: formatPHDate(m.createdAt)
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get inbox', error: error.message });
    }
});

app.get('/api/user/inbox/:messageId', authMiddleware, async (req, res) => {
    try {
        const message = await InboxMessage.findOne({ messageId: req.params.messageId, recipientUsername: req.user.username });
        if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

        if (!message.isRead) { message.isRead = true; await message.save(); }

        res.json({
            success: true,
            message: {
                messageId: message.messageId,
                title:     message.title,
                content:   message.content,
                imageUrl:  message.imageUrl,
                type:      message.type,
                isRead:    message.isRead,
                sentBy:    message.sentBy,
                date:      formatPHDate(message.createdAt, 'MMM DD, YYYY'),
                time:      formatPHDate(message.createdAt, 'h:mm A'),
                createdAt: formatPHDate(message.createdAt)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get message', error: error.message });
    }
});

app.put('/api/user/inbox/:messageId/read', authMiddleware, async (req, res) => {
    try {
        const message = await InboxMessage.findOne({ messageId: req.params.messageId, recipientUsername: req.user.username });
        if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
        message.isRead = true;
        await message.save();
        res.json({ success: true, message: 'Message marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to mark message as read', error: error.message });
    }
});

app.put('/api/user/inbox/read-all', authMiddleware, async (req, res) => {
    try {
        await InboxMessage.updateMany({ recipientUsername: req.user.username, isRead: false }, { $set: { isRead: true } });
        res.json({ success: true, message: 'All messages marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to mark all as read', error: error.message });
    }
});

app.delete('/api/user/inbox/:messageId', authMiddleware, async (req, res) => {
    try {
        const message = await InboxMessage.findOneAndDelete({ messageId: req.params.messageId, recipientUsername: req.user.username });
        if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
        res.json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete message', error: error.message });
    }
});

// ============ ADMIN INBOX ROUTES ============

app.post('/api/admin/inbox/broadcast', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { title, content, imageUrl, type, targetUsers } = req.body;
        if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content are required' });

        let recipients = [];
        if      (targetUsers === 'all')      recipients = (await User.find({ isAdmin: false }).select('username').lean()).map(u => u.username);
        else if (targetUsers === 'active')   recipients = (await User.find({ isAdmin: false, isActive: true }).select('username').lean()).map(u => u.username);
        else if (targetUsers === 'inactive') recipients = (await User.find({ isAdmin: false, isActive: false }).select('username').lean()).map(u => u.username);
        else if (Array.isArray(targetUsers)) recipients = targetUsers;
        else return res.status(400).json({ success: false, message: 'Invalid target users' });

        const messages = recipients.map(username => ({
            messageId:         `MSG${Date.now()}${Math.floor(Math.random() * 10000)}`,
            title, content,
            imageUrl:          imageUrl || null,
            type:              type || 'announcement',
            isRead:            false,
            recipientUsername: username,
            sentBy:            req.user.username,
            createdAt:         getPHTime()
        }));

        await InboxMessage.insertMany(messages);
        res.json({ success: true, message: `Message sent to ${recipients.length} user(s)`, recipientCount: recipients.length });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to send broadcast', error: error.message });
    }
});

app.post('/api/admin/inbox/send', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { username, title, content, imageUrl, type } = req.body;
        if (!username || !title || !content)
            return res.status(400).json({ success: false, message: 'Username, title, and content are required' });

        const targetUser = await User.findOne({ username });
        if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

        await InboxMessage.create({
            messageId:         `MSG${Date.now()}${Math.floor(Math.random() * 1000)}`,
            title, content,
            imageUrl:          imageUrl || null,
            type:              type || 'announcement',
            isRead:            false,
            recipientUsername: username,
            sentBy:            req.user.username,
            createdAt:         getPHTime()
        });

        res.json({ success: true, message: `Message sent to ${username}` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
    }
});

app.get('/api/admin/inbox/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const [totalMessages, unreadMessages, announcementCount, promoCount] = await Promise.all([
            InboxMessage.countDocuments(),
            InboxMessage.countDocuments({ isRead: false }),
            InboxMessage.countDocuments({ type: 'announcement' }),
            InboxMessage.countDocuments({ type: 'promo' })
        ]);
        res.json({ success: true, stats: { totalMessages, unreadMessages, announcementCount, promoCount } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get inbox stats', error: error.message });
    }
});

// ============ ADMIN USER MANAGEMENT ============

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await User.find({}).select('-password').sort({ createdAt: -1 }).lean();
        res.json({
            success: true,
            count:   users.length,
            users:   users.map(u => ({
                ...u,
                createdAt:   formatPHDate(u.createdAt),
                lastLogin:   u.lastLogin ? formatPHDate(u.lastLogin) : null,
                cookieCount: u.cookies.length
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get users', error: error.message });
    }
});

app.put('/api/admin/users/:username/activate', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user)        return res.status(404).json({ success: false, message: 'User not found' });
        if (user.isAdmin) return res.status(400).json({ success: false, message: 'Cannot modify admin account status' });
        user.isActive = true;
        await user.save();
        res.json({ success: true, message: 'User activated successfully!', user: { username: user.username, isActive: true } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to activate user', error: error.message });
    }
});

app.put('/api/admin/users/:username/deactivate', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user)        return res.status(404).json({ success: false, message: 'User not found' });
        if (user.isAdmin) return res.status(400).json({ success: false, message: 'Cannot modify admin account status' });
        user.isActive = false;
        await user.save();
        res.json({ success: true, message: 'User deactivated.', user: { username: user.username, isActive: false } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to deactivate user', error: error.message });
    }
});

app.delete('/api/admin/users/:username', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user)        return res.status(404).json({ success: false, message: 'User not found' });
        if (user.isAdmin) return res.status(400).json({ success: false, message: 'Cannot delete admin account' });
        await User.findOneAndDelete({ username: req.params.username });
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
    }
});

app.delete('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const result = await User.deleteMany({ isAdmin: false });
        res.json({ success: true, message: `Successfully deleted ${result.deletedCount} user(s)`, deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete users', error: error.message });
    }
});

app.get('/api/admin/dashboard', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const [
            totalUsers, activeUsers, inactiveUsers, totalSharesAgg, recentUsers,
            pendingOrders, processingOrders, completedOrders, totalRevenue, last30DaysShares
        ] = await Promise.all([
            User.countDocuments({ isAdmin: false }),
            User.countDocuments({ isActive: true, isAdmin: false }),
            User.countDocuments({ isActive: false, isAdmin: false }),
            User.aggregate([{ $group: { _id: null, total: { $sum: '$totalShares' } } }]),
            User.find({ isAdmin: false }).select('-password').sort({ createdAt: -1 }).limit(5).lean(),
            BoosterOrder.countDocuments({ status: 'pending' }),
            BoosterOrder.countDocuments({ status: 'processing' }),
            BoosterOrder.countDocuments({ status: 'completed' }),
            BoosterOrder.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            User.aggregate([
                { $unwind: '$shareHistory' },
                { $match: { 'shareHistory.date': { $gte: moment().tz('Asia/Manila').subtract(30, 'days').startOf('day').toDate() } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$shareHistory.date' } }, total: { $sum: '$shareHistory.count' } } },
                { $sort: { _id: 1 } }
            ])
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers, activeUsers, inactiveUsers,
                totalShares:      totalSharesAgg[0]?.total || 0,
                pendingOrders, processingOrders, completedOrders,
                totalRevenue:     totalRevenue[0]?.total || 0,
                shareGraph:       last30DaysShares,
                recentUsers:      recentUsers.map(u => ({
                    username:    u.username,
                    isActive:    u.isActive,
                    cookieCount: u.cookies.length,
                    totalShares: u.totalShares,
                    profileImage:u.profileImage,
                    createdAt:   formatPHDate(u.createdAt)
                }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get dashboard stats', error: error.message });
    }
});

// ============ INITIALIZE & START ============

async function initializeAdmin() {
    try {
        const adminUser = await User.findOne({ username: 'kendrick' });

        if (!adminUser) {
            await User.create({
                username:  'kendrick',
                password:  await bcrypt.hash('XaneKath1', 10),
                facebook:  'facebook.com/ryoevisu',
                isAdmin:   true,
                isActive:  true,
                cookies:   [],
                shareHistory: []
            });
            console.log('Admin created - Username: kendrick | Password: XaneKath1');
        } else {
            let needsSave = false;
            if (adminUser.facebook !== 'facebook.com/ryoevisu') { adminUser.facebook = 'facebook.com/ryoevisu'; needsSave = true; }
            if (!adminUser.isActive)    { adminUser.isActive    = true; needsSave = true; }
            if (!adminUser.shareHistory){ adminUser.shareHistory = []; needsSave = true; }
            if (needsSave) { await adminUser.save(); console.log('Admin account updated'); }
            else             { console.log('Admin account verified'); }
        }
    } catch (error) {
        console.error('Admin init error:', error.message);
    }
}

mongoose.connect(uri, clientOptions)
    .then(() => {
        console.log('MongoDB connected to kiroboost-api');
        return initializeAdmin();
    })
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`KiroBoost API running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Startup failed:', err.message);
        process.exit(1);
    });

process.on('SIGTERM', () => { mongoose.connection.close().then(() => process.exit(0)); });
process.on('SIGINT',  () => { mongoose.connection.close().then(() => process.exit(0)); });
