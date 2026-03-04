remove the cookie plan limits and plan because all are now free and on register user doesnt need now country and remove auto detect country and on profile add now a Profile avatar border effect any can use and the profile can be gif upload or links and on the sticker and bio and user can update their status busy active and etc if busy like this ⛔ but use a icons for that and etc or user can customize that this feature i want like a discord profile like user have a nitro on their profile and add more data that need to make it more user like have a discord nitro on their profile and make sure it doesn't have delay on sharing and reimprove the inbox and on admin remove the user need their activate account to use now thats no need to activate make it that now auto activate even admin not activation on their account the bio is refresenting as a "About Me" and make it just one method the smm panel only and remove now the version it doesnt need now and same on comparison it doesnt need now this is my server.js code and give me the full code on web app documentation.html and can u create me a public index.html and login html signup html profile html and etc files that needed for my webapp KiroBoost  uses all my endpoint using html and tailwind with like a shadcn ui make it responsive and modern design and smoother like a shadcn ui color make sure like  use a inter font  and add a documentation and give me the full code of my html in the documentation so i can copy the new update and full code of html! and make sure it connected properly and working my html note pls give me a full code of my html and the server.js on the documentation.html  this is the server api https://kiroboost-api-newshare.onrender.com give me the full code files of different files index.html login signup and etc files full code!! and make sure it still shadcn ui tailwind html and the input field should be mui design but it uses tailwind with look of shadcn ui html include the admin page the website should like a smm panel and make sure all are responsive design and working the all endpoints and  use a corsproxy.io if needed users allow to pick what their want  and make sure the profile page look a like discord with have unique effect on their avatar borders and etc just like user have a nitro on their profile make sure it doesnt have have header just bottom navigation bar if desktop mode is detect add a warning for the user and use only white and black color of shadcn ui tailwind without gradients make it that modern and responsive design and smoother and  put the full code of new update of server.js and now this is my server.js and add profile banner can be gif upload or image photos no links now and make sure its have serve public folder file for my html on my server.js  and give me the full code of my server.js on documentation.html so i can copy it the full code new update const express = require('express');
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public folder
app.use(express.static('public'));

// MongoDB Connection with optimized settings
const uri = process.env.MONGODB_URI || "mongodb+srv://biarzxc:XaneKath1@biarzxc.o56uqfx.mongodb.net/?appName=biarzxc";

const clientOptions = {
    serverApi: {
        version: '1',
        strict: false,
        deprecationErrors: true
    },
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
                params: {
                    fields: 'id,name',
                    access_token: token
                },
                headers: { cookie },
                timeout: 8000
            });
            if (info.data.name && info.data.id) {
                return {
                    uid: info.data.id,
                    name: info.data.name
                };
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
        if (!token) {
            return { valid: false, error: 'Could not extract EAAG token from cookie' };
        }
        const accountInfo = await getSelf(token, cookie);
        if (!accountInfo) {
            return { valid: false, error: 'Could not retrieve account information' };
        }
        return {
            valid: true,
            uid: accountInfo.uid,
            name: accountInfo.name,
            eaagToken: token,
            status: 'active'
        };
    } catch (error) {
        console.error('Cookie validation error:', error.message);
        return {
            valid: false,
            error: 'Unable to validate cookie - may be expired or invalid'
        };
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
            validator: function(v) {
                return isValidFacebookUrl(v);
            },
            message: 'Please provide a valid Facebook link (e.g., facebook.com/username)'
        }
    },
    // Profile fields
    profileImage: { type: String, default: null },       // base64 or URL (supports GIF)
    profileImageUrl: { type: String, default: null },    // external URL for GIF/image
    bio: { type: String, default: '', maxlength: 300 },  // "About Me"
    status: { type: String, default: 'online', maxlength: 100 }, // user status text
    statusEmoji: { type: String, default: 'ðŸŸ¢' },        // status emoji
    avatarBorder: { type: String, default: 'none' },     // avatar border effect
    sticker: { type: String, default: null },            // profile sticker URL or base64
    bannerColor: { type: String, default: '#111111' },   // profile banner color
    accentColor: { type: String, default: '#ffffff' },   // profile accent color
    badges: [{ type: String }],                          // profile badges
    // Core fields
    plan: { type: String, enum: ['free', 'premium'], default: 'free' },
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },          // auto-activate on register
    createdAt: { type: Date, default: getPHTime },
    lastLogin: { type: Date, default: null },
    lastShareTime: { type: Date, default: null },
    totalShares: { type: Number, default: 0 },
    cookies: [cookieSchema],
    shareHistory: [{
        date: { type: Date, default: getPHTime },
        count: { type: Number, default: 0 }
    }]
});

userSchema.index({ username: 1, isActive: 1 });

const boosterOrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true, index: true },
    customerName: { type: String, required: true },
    postLink: { type: String, required: true },
    quantity: { type: Number, required: true },
    amount: { type: Number, required: true, default: 0 },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'cancelled', 'refunded', 'partial'],
        default: 'pending',
        index: true
    },
    startCount: { type: Number, default: 0 },
    currentCount: { type: Number, default: 0 },
    remainingCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: getPHTime, index: true },
    completedAt: { type: Date, default: null },
    createdBy: { type: String, required: true, index: true },
    referenceNote: { type: String, default: '' },
    notes: { type: String, default: '' },
    speed: { type: String, enum: ['slow', 'medium', 'fast', 'instant'], default: 'instant' },
    priority: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 }
});

boosterOrderSchema.index({ createdBy: 1, status: 1, createdAt: -1 });

const User = mongoose.model('User', userSchema);
const BoosterOrder = mongoose.model('BoosterOrder', boosterOrderSchema);

// Inbox Message Schema
const inboxMessageSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    imageUrl: { type: String, default: null },
    type: { type: String, enum: ['announcement', 'welcome', 'promo', 'system'], default: 'announcement' },
    isRead: { type: Boolean, default: false },
    recipientUsername: { type: String, required: true, index: true },
    sentBy: { type: String, default: 'system' },
    createdAt: { type: Date, default: getPHTime, index: true }
});

inboxMessageSchema.index({ recipientUsername: 1, isRead: 1, createdAt: -1 });

const InboxMessage = mongoose.model('InboxMessage', inboxMessageSchema);

// ============ MIDDLEWARE ============

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ success: false, message: 'No authentication token provided' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).lean();
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        req.user = user;
        req.userId = user._id;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid authentication token' });
    }
};

const adminMiddleware = async (req, res, next) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};

// ============ ROUTES ============

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'KiroBoost API Server v2.0 - Professional SMM Panel',
        database: 'kiroboost-api',
        features: [
            'Authentication',
            'User Management',
            'Share Tracking',
            'Cookie Database',
            'Profile Images (GIF/URL/Base64)',
            'Discord-Style Profiles',
            'Stats & Analytics',
            'SMM Panel Boost',
            'Multiple Cookies Support',
            'Zero Delay Sharing',
            'Inbox System',
            'Auto-Activation'
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

// Register - no country required, auto-activate
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, facebook } = req.body;

        if (!username || !password || !facebook) {
            return res.status(400).json({ success: false, message: 'Username, password, and Facebook link are required' });
        }

        if (await User.findOne({ username }).lean()) {
            return res.status(400).json({ success: false, message: 'Username already exists' });
        }

        const normalizedFacebook = normalizeFacebookUrl(facebook);

        if (!isValidFacebookUrl(normalizedFacebook)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid Facebook link'
            });
        }

        const user = await User.create({
            username,
            password: await bcrypt.hash(password, 10),
            facebook: normalizedFacebook,
            plan: 'free',
            isActive: true,   // auto-activate
            cookies: [],
            shareHistory: []
        });

        // Send welcome message to inbox
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
                plan: user.plan,
                isActive: true,
                cookieCount: 0,
                profileImage: null,
                bio: '',
                status: 'online',
                statusEmoji: 'ðŸŸ¢',
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

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

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
                plan: user.plan,
                isAdmin: user.isAdmin,
                isActive: user.isActive,
                totalShares: user.totalShares,
                cookieCount: user.cookies.length,
                profileImage: user.profileImage,
                profileImageUrl: user.profileImageUrl,
                bio: user.bio || '',
                status: user.status || 'online',
                statusEmoji: user.statusEmoji || 'ðŸŸ¢',
                avatarBorder: user.avatarBorder || 'none',
                sticker: user.sticker || null,
                bannerColor: user.bannerColor || '#111111',
                accentColor: user.accentColor || '#ffffff',
                badges: user.badges || []
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Login failed', error: error.message });
    }
});

// ============ USER ROUTES ============

app.post('/api/share/start', authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { lastShareTime: getPHTime() });
        res.json({
            success: true,
            message: 'Share started successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to start share', error: error.message });
    }
});

app.post('/api/share/complete', authMiddleware, async (req, res) => {
    try {
        const shareCount = req.body.totalShares || 1;
        const today = moment().tz('Asia/Manila').startOf('day').toDate();

        const user = await User.findById(req.userId);

        user.totalShares += shareCount;

        const todayEntry = user.shareHistory.find(h =>
            moment(h.date).tz('Asia/Manila').isSame(today, 'day')
        );

        if (todayEntry) {
            todayEntry.count += shareCount;
        } else {
            user.shareHistory.push({ date: today, count: shareCount });
        }

        if (user.shareHistory.length > 30) {
            user.shareHistory = user.shareHistory.slice(-30);
        }

        await user.save();

        res.json({
            success: true,
            message: 'Share completed',
            totalShares: user.totalShares
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to complete share', error: error.message });
    }
});

app.get('/api/user/stats', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).lean();

        const last30Days = user.shareHistory.slice(-30).map(h => ({
            date: formatPHDate(h.date, 'YYYY-MM-DD'),
            count: h.count
        }));

        res.json({
            success: true,
            stats: {
                username: user.username,
                plan: user.plan,
                isActive: user.isActive,
                totalShares: user.totalShares,
                cookieCount: user.cookies.length,
                profileImage: user.profileImage,
                profileImageUrl: user.profileImageUrl,
                bio: user.bio || '',
                status: user.status || 'online',
                statusEmoji: user.statusEmoji || 'ðŸŸ¢',
                avatarBorder: user.avatarBorder || 'none',
                sticker: user.sticker || null,
                bannerColor: user.bannerColor || '#111111',
                accentColor: user.accentColor || '#ffffff',
                badges: user.badges || [],
                shareHistory: last30Days
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get stats', error: error.message });
    }
});

// Update profile image (base64 or URL, supports GIF)
app.post('/api/user/profile/image', authMiddleware, async (req, res) => {
    try {
        const { imageData, imageUrl } = req.body;

        if (!imageData && !imageUrl) {
            return res.status(400).json({ success: false, message: 'Image data or URL is required' });
        }

        const updateData = {};
        if (imageData) {
            if (!imageData.startsWith('data:image/')) {
                return res.status(400).json({ success: false, message: 'Invalid image format' });
            }
            updateData.profileImage = imageData;
            updateData.profileImageUrl = null;
        }
        if (imageUrl) {
            updateData.profileImageUrl = imageUrl;
            updateData.profileImage = null;
        }

        await User.findByIdAndUpdate(req.userId, updateData);

        res.json({
            success: true,
            message: 'Profile image updated successfully',
            profileImage: updateData.profileImage || null,
            profileImageUrl: updateData.profileImageUrl || null
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update profile image', error: error.message });
    }
});

app.delete('/api/user/profile/image', authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { profileImage: null, profileImageUrl: null });
        res.json({
            success: true,
            message: 'Profile image removed successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove profile image', error: error.message });
    }
});

// Update profile details (bio/About Me, status, avatar border, sticker, colors)
app.put('/api/user/profile', authMiddleware, async (req, res) => {
    try {
        const { bio, status, statusEmoji, avatarBorder, sticker, bannerColor, accentColor } = req.body;

        const updateData = {};
        if (bio !== undefined) updateData.bio = bio.substring(0, 300);
        if (status !== undefined) updateData.status = status.substring(0, 100);
        if (statusEmoji !== undefined) updateData.statusEmoji = statusEmoji;
        if (avatarBorder !== undefined) updateData.avatarBorder = avatarBorder;
        if (sticker !== undefined) updateData.sticker = sticker;
        if (bannerColor !== undefined) updateData.bannerColor = bannerColor;
        if (accentColor !== undefined) updateData.accentColor = accentColor;

        const user = await User.findByIdAndUpdate(req.userId, updateData, { new: true }).lean();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            profile: {
                username: user.username,
                bio: user.bio || '',
                status: user.status || 'online',
                statusEmoji: user.statusEmoji || 'ðŸŸ¢',
                avatarBorder: user.avatarBorder || 'none',
                sticker: user.sticker || null,
                bannerColor: user.bannerColor || '#111111',
                accentColor: user.accentColor || '#ffffff',
                badges: user.badges || []
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
    }
});

// Get public profile by username
app.get('/api/user/profile/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('-password -cookies -shareHistory')
            .lean();

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            profile: {
                username: user.username,
                facebook: user.facebook,
                plan: user.plan,
                profileImage: user.profileImage,
                profileImageUrl: user.profileImageUrl,
                bio: user.bio || '',
                status: user.status || 'online',
                statusEmoji: user.statusEmoji || 'ðŸŸ¢',
                avatarBorder: user.avatarBorder || 'none',
                sticker: user.sticker || null,
                bannerColor: user.bannerColor || '#111111',
                accentColor: user.accentColor || '#ffffff',
                badges: user.badges || [],
                totalShares: user.totalShares,
                createdAt: formatPHDate(user.createdAt)
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

        if (!cookie) {
            return res.status(400).json({ success: false, message: 'Cookie is required' });
        }

        const user = await User.findById(req.userId);

        const validation = await validateCookieAndGetInfo(cookie.trim());

        if (!validation.valid) {
            const errorMsg = validation.error || 'Invalid cookie or unable to extract EAAG token';
            return res.status(400).json({ success: false, message: errorMsg });
        }

        const existingCookie = user.cookies.find(c => c.uid === validation.uid);
        if (existingCookie) {
            return res.status(400).json({ success: false, message: 'This account cookie is already added' });
        }

        user.cookies.push({
            cookie: cookie.trim(),
            uid: validation.uid,
            name: validation.name,
            addedAt: getPHTime(),
            lastUsed: null,
            status: 'active'
        });

        await user.save();

        res.json({
            success: true,
            message: 'Cookie added successfully',
            name: validation.name,
            uid: validation.uid,
            status: 'active',
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
            count: user.cookies.length,
            cookies: user.cookies.map(c => ({
                id: c._id,
                cookie: c.cookie,
                uid: c.uid,
                name: c.name,
                status: c.status,
                addedAt: formatPHDate(c.addedAt),
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
        const cookieId = req.params.cookieId;

        const initialLength = user.cookies.length;
        user.cookies = user.cookies.filter(c => c._id.toString() !== cookieId);

        if (user.cookies.length === initialLength) {
            return res.status(404).json({ success: false, message: 'Cookie not found' });
        }

        await user.save();

        res.json({
            success: true,
            message: 'Cookie deleted successfully',
            totalCookies: user.cookies.length
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete cookie', error: error.message });
    }
});

app.post('/api/user/cookies/delete-multiple', authMiddleware, async (req, res) => {
    try {
        const { cookieIds } = req.body;

        if (!cookieIds || !Array.isArray(cookieIds) || cookieIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Cookie IDs array is required' });
        }

        const user = await User.findById(req.userId);
        const initialLength = user.cookies.length;

        user.cookies = user.cookies.filter(c => !cookieIds.includes(c._id.toString()));

        const deletedCount = initialLength - user.cookies.length;

        await user.save();

        res.json({
            success: true,
            message: `Successfully deleted ${deletedCount} cookie(s)`,
            deletedCount,
            totalCookies: user.cookies.length
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete cookies', error: error.message });
    }
});

// ============ BOOSTER ORDERS (SMM PANEL STYLE) ============

app.post('/api/admin/orders', authMiddleware, async (req, res) => {
    try {
        const { customOrderId, customerName, postLink, quantity, amount, notes, referenceNote, speed, priority } = req.body;

        if (!customerName || !postLink || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Customer name, post link, and quantity are required'
            });
        }

        const orderId = customOrderId || `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const order = await BoosterOrder.create({
            orderId,
            customerName,
            postLink,
            quantity: parseInt(quantity),
            amount: parseFloat(amount) || 0,
            status: 'pending',
            startCount: 0,
            currentCount: 0,
            remainingCount: parseInt(quantity),
            createdBy: req.user.username,
            referenceNote: referenceNote || '',
            notes: notes || '',
            speed: speed || 'instant',
            priority: priority || 0,
            createdAt: getPHTime()
        });

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: {
                orderId: order.orderId,
                customerName: order.customerName,
                postLink: order.postLink,
                quantity: order.quantity,
                amount: order.amount,
                status: order.status,
                referenceNote: order.referenceNote,
                notes: order.notes,
                speed: order.speed,
                createdAt: formatPHDate(order.createdAt)
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

        if (!req.user.isAdmin) {
            query.createdBy = req.user.username;
        }

        if (status && ['pending', 'processing', 'completed', 'cancelled', 'refunded', 'partial'].includes(status)) {
            query.status = status;
        }
        if (customerName) {
            query.customerName = { $regex: customerName, $options: 'i' };
        }

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const orders = await BoosterOrder.find(query)
            .sort(sortOptions)
            .limit(parseInt(limit))
            .lean();

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
            summary: {
                total: totalOrders,
                pending: pendingOrders,
                processing: processingOrders,
                completed: completedOrders
            },
            orders: orders.map(o => ({
                orderId: o.orderId,
                customerName: o.customerName,
                postLink: o.postLink,
                quantity: o.quantity,
                amount: o.amount,
                status: o.status,
                currentCount: o.currentCount,
                remainingCount: o.remainingCount,
                referenceNote: o.referenceNote,
                notes: o.notes,
                speed: o.speed,
                createdBy: o.createdBy,
                createdAt: formatPHDate(o.createdAt),
                completedAt: o.completedAt ? formatPHDate(o.completedAt) : null
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get orders', error: error.message });
    }
});

app.get('/api/admin/orders/:orderId', authMiddleware, async (req, res) => {
    try {
        let query = { orderId: req.params.orderId };

        if (!req.user.isAdmin) {
            query.createdBy = req.user.username;
        }

        const order = await BoosterOrder.findOne(query).lean();

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({
            success: true,
            order: {
                orderId: order.orderId,
                customerName: order.customerName,
                postLink: order.postLink,
                quantity: order.quantity,
                amount: order.amount,
                status: order.status,
                startCount: order.startCount,
                currentCount: order.currentCount,
                remainingCount: order.remainingCount,
                referenceNote: order.referenceNote,
                notes: order.notes,
                speed: order.speed,
                priority: order.priority,
                createdBy: order.createdBy,
                createdAt: formatPHDate(order.createdAt),
                completedAt: order.completedAt ? formatPHDate(order.completedAt) : null
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

        if (!req.user.isAdmin) {
            query.createdBy = req.user.username;
        }

        const order = await BoosterOrder.findOne(query);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (status) {
            order.status = status;
            if (status === 'completed') {
                order.completedAt = getPHTime();
                order.currentCount = order.quantity;
                order.remainingCount = 0;
            }
            if (status === 'cancelled' || status === 'refunded') {
                order.completedAt = getPHTime();
            }
        }

        if (currentCount !== undefined) {
            order.currentCount = parseInt(currentCount);
            order.remainingCount = Math.max(0, order.quantity - order.currentCount);

            if (order.currentCount >= order.quantity && order.status !== 'completed') {
                order.status = 'completed';
                order.completedAt = getPHTime();
                order.remainingCount = 0;
            }

            if (order.currentCount > 0 && order.status === 'pending') {
                order.status = 'processing';
            }
        }

        if (startCount !== undefined) {
            order.startCount = parseInt(startCount);
        }

        if (notes !== undefined) {
            order.notes = notes;
        }

        if (referenceNote !== undefined) {
            order.referenceNote = referenceNote;
        }

        await order.save();

        res.json({
            success: true,
            message: 'Order updated successfully',
            order: {
                orderId: order.orderId,
                customerName: order.customerName,
                postLink: order.postLink,
                quantity: order.quantity,
                amount: order.amount,
                status: order.status,
                currentCount: order.currentCount,
                remainingCount: order.remainingCount,
                referenceNote: order.referenceNote,
                notes: order.notes,
                createdBy: order.createdBy,
                createdAt: formatPHDate(order.createdAt),
                completedAt: order.completedAt ? formatPHDate(order.completedAt) : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update order', error: error.message });
    }
});

app.delete('/api/admin/orders/:orderId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const order = await BoosterOrder.findOneAndDelete({ orderId: req.params.orderId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete order', error: error.message });
    }
});

app.put('/api/admin/orders/bulk/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { orderIds, status } = req.body;

        if (!orderIds || !Array.isArray(orderIds) || !status) {
            return res.status(400).json({ success: false, message: 'Order IDs array and status are required' });
        }

        const updateData = { status };
        if (status === 'completed') {
            updateData.completedAt = getPHTime();
        }

        const result = await BoosterOrder.updateMany(
            { orderId: { $in: orderIds } },
            { $set: updateData }
        );

        res.json({
            success: true,
            message: `Updated ${result.modifiedCount} order(s)`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to bulk update orders', error: error.message });
    }
});

app.get('/api/admin/orders/stats/summary', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const [
            totalOrders,
            pendingOrders,
            processingOrders,
            completedOrders,
            cancelledOrders,
            totalRevenue,
            todayOrders,
            todayRevenue
        ] = await Promise.all([
            BoosterOrder.countDocuments(),
            BoosterOrder.countDocuments({ status: 'pending' }),
            BoosterOrder.countDocuments({ status: 'processing' }),
            BoosterOrder.countDocuments({ status: 'completed' }),
            BoosterOrder.countDocuments({ status: 'cancelled' }),
            BoosterOrder.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            BoosterOrder.countDocuments({
                createdAt: { $gte: moment().tz('Asia/Manila').startOf('day').toDate() }
            }),
            BoosterOrder.aggregate([
                {
                    $match: {
                        status: 'completed',
                        createdAt: { $gte: moment().tz('Asia/Manila').startOf('day').toDate() }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        res.json({
            success: true,
            stats: {
                totalOrders,
                pendingOrders,
                processingOrders,
                completedOrders,
                cancelledOrders,
                totalRevenue: totalRevenue[0]?.total || 0,
                todayOrders,
                todayRevenue: todayRevenue[0]?.total || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get order stats', error: error.message });
    }
});

app.get('/api/user/orders/history', authMiddleware, async (req, res) => {
    try {
        const { limit = 50, status } = req.query;

        let query = { createdBy: req.user.username };

        if (status && ['pending', 'processing', 'completed', 'cancelled', 'refunded'].includes(status)) {
            query.status = status;
        }

        const orders = await BoosterOrder.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        const [totalOrders, completedOrders, pendingOrders] = await Promise.all([
            BoosterOrder.countDocuments({ createdBy: req.user.username }),
            BoosterOrder.countDocuments({ createdBy: req.user.username, status: 'completed' }),
            BoosterOrder.countDocuments({ createdBy: req.user.username, status: 'pending' })
        ]);

        res.json({
            success: true,
            count: orders.length,
            summary: {
                total: totalOrders,
                completed: completedOrders,
                pending: pendingOrders
            },
            orders: orders.map(o => ({
                orderId: o.orderId,
                customerName: o.customerName,
                quantity: o.quantity,
                amount: o.amount,
                status: o.status,
                referenceNote: o.referenceNote,
                date: formatPHDate(o.createdAt, 'MMM DD, YYYY'),
                time: formatPHDate(o.createdAt, 'h:mm A'),
                createdAt: formatPHDate(o.createdAt)
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get order history', error: error.message });
    }
});

app.get('/api/user/orders/search', authMiddleware, async (req, res) => {
    try {
        const { reference } = req.query;

        if (!reference) {
            return res.status(400).json({ success: false, message: 'Reference note is required' });
        }

        const orders = await BoosterOrder.find({
            createdBy: req.user.username,
            referenceNote: { $regex: reference, $options: 'i' }
        })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

        if (orders.length === 0) {
            return res.status(404).json({ success: false, message: 'No orders found with that reference' });
        }

        res.json({
            success: true,
            count: orders.length,
            orders: orders.map(o => ({
                orderId: o.orderId,
                customerName: o.customerName,
                quantity: o.quantity,
                amount: o.amount,
                status: o.status,
                referenceNote: o.referenceNote,
                date: formatPHDate(o.createdAt, 'MMM DD, YYYY'),
                time: formatPHDate(o.createdAt, 'h:mm A'),
                createdAt: formatPHDate(o.createdAt),
                completedAt: o.completedAt ? formatPHDate(o.completedAt) : null
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

        if (filter === 'unread') {
            query.isRead = false;
        } else if (filter === 'announcements') {
            query.type = 'announcement';
        } else if (filter === 'promos') {
            query.type = 'promo';
        }

        const messages = await InboxMessage.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

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
                title: m.title,
                content: m.content.substring(0, 120) + (m.content.length > 120 ? '...' : ''),
                imageUrl: m.imageUrl,
                type: m.type,
                isRead: m.isRead,
                sentBy: m.sentBy,
                date: formatPHDate(m.createdAt, 'MMM DD, YYYY'),
                time: formatPHDate(m.createdAt, 'h:mm A'),
                createdAt: formatPHDate(m.createdAt)
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get inbox', error: error.message });
    }
});

app.get('/api/user/inbox/:messageId', authMiddleware, async (req, res) => {
    try {
        const message = await InboxMessage.findOne({
            messageId: req.params.messageId,
            recipientUsername: req.user.username
        });

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        if (!message.isRead) {
            message.isRead = true;
            await message.save();
        }

        res.json({
            success: true,
            message: {
                messageId: message.messageId,
                title: message.title,
                content: message.content,
                imageUrl: message.imageUrl,
                type: message.type,
                isRead: message.isRead,
                sentBy: message.sentBy,
                date: formatPHDate(message.createdAt, 'MMM DD, YYYY'),
                time: formatPHDate(message.createdAt, 'h:mm A'),
                createdAt: formatPHDate(message.createdAt)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get message', error: error.message });
    }
});

app.put('/api/user/inbox/:messageId/read', authMiddleware, async (req, res) => {
    try {
        const message = await InboxMessage.findOne({
            messageId: req.params.messageId,
            recipientUsername: req.user.username
        });

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        message.isRead = true;
        await message.save();

        res.json({
            success: true,
            message: 'Message marked as read'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to mark message as read', error: error.message });
    }
});

app.put('/api/user/inbox/read-all', authMiddleware, async (req, res) => {
    try {
        await InboxMessage.updateMany(
            { recipientUsername: req.user.username, isRead: false },
            { $set: { isRead: true } }
        );

        res.json({
            success: true,
            message: 'All messages marked as read'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to mark all as read', error: error.message });
    }
});

app.delete('/api/user/inbox/:messageId', authMiddleware, async (req, res) => {
    try {
        const message = await InboxMessage.findOneAndDelete({
            messageId: req.params.messageId,
            recipientUsername: req.user.username
        });

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        res.json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete message', error: error.message });
    }
});

// ============ ADMIN INBOX ROUTES ============

app.post('/api/admin/inbox/broadcast', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { title, content, imageUrl, type, targetUsers } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, message: 'Title and content are required' });
        }

        let recipients = [];

        if (targetUsers === 'all') {
            const users = await User.find({ isAdmin: false }).select('username').lean();
            recipients = users.map(u => u.username);
        } else if (targetUsers === 'active') {
            const users = await User.find({ isAdmin: false, isActive: true }).select('username').lean();
            recipients = users.map(u => u.username);
        } else if (targetUsers === 'inactive') {
            const users = await User.find({ isAdmin: false, isActive: false }).select('username').lean();
            recipients = users.map(u => u.username);
        } else if (Array.isArray(targetUsers)) {
            recipients = targetUsers;
        } else {
            return res.status(400).json({ success: false, message: 'Invalid target users' });
        }

        const messages = recipients.map(username => ({
            messageId: `MSG${Date.now()}${Math.floor(Math.random() * 10000)}`,
            title,
            content,
            imageUrl: imageUrl || null,
            type: type || 'announcement',
            isRead: false,
            recipientUsername: username,
            sentBy: req.user.username,
            createdAt: getPHTime()
        }));

        await InboxMessage.insertMany(messages);

        res.json({
            success: true,
            message: `Message sent to ${recipients.length} user(s)`,
            recipientCount: recipients.length
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to send broadcast', error: error.message });
    }
});

app.post('/api/admin/inbox/send', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { username, title, content, imageUrl, type } = req.body;

        if (!username || !title || !content) {
            return res.status(400).json({ success: false, message: 'Username, title, and content are required' });
        }

        const targetUser = await User.findOne({ username });

        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await InboxMessage.create({
            messageId: `MSG${Date.now()}${Math.floor(Math.random() * 1000)}`,
            title,
            content,
            imageUrl: imageUrl || null,
            type: type || 'announcement',
            isRead: false,
            recipientUsername: username,
            sentBy: req.user.username,
            createdAt: getPHTime()
        });

        res.json({
            success: true,
            message: `Message sent to ${username}`
        });
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

        res.json({
            success: true,
            stats: {
                totalMessages,
                unreadMessages,
                announcementCount,
                promoCount
            }
        });
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
            count: users.length,
            users: users.map(u => ({
                ...u,
                createdAt: formatPHDate(u.createdAt),
                lastLogin: u.lastLogin ? formatPHDate(u.lastLogin) : null,
                cookieCount: u.cookies.length
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get users', error: error.message });
    }
});

// Admin can still toggle user activation status manually
app.put('/api/admin/users/:username/activate', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isAdmin) {
            return res.status(400).json({ success: false, message: 'Cannot modify admin account status' });
        }

        user.isActive = true;
        await user.save();

        res.json({
            success: true,
            message: 'User activated successfully!',
            user: {
                username: user.username,
                isActive: user.isActive
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to activate user', error: error.message });
    }
});

app.put('/api/admin/users/:username/deactivate', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isAdmin) {
            return res.status(400).json({ success: false, message: 'Cannot modify admin account status' });
        }

        user.isActive = false;
        await user.save();

        res.json({
            success: true,
            message: 'User deactivated.',
            user: {
                username: user.username,
                isActive: user.isActive
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to deactivate user', error: error.message });
    }
});

app.put('/api/admin/users/:username/plan', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { plan } = req.body;

        if (!plan || !['free', 'premium'].includes(plan)) {
            return res.status(400).json({ success: false, message: 'Valid plan is required (free or premium)' });
        }

        const user = await User.findOne({ username: req.params.username });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isAdmin) {
            return res.status(400).json({ success: false, message: 'Cannot modify admin account plan' });
        }

        const oldPlan = user.plan;
        user.plan = plan;
        await user.save();

        res.json({
            success: true,
            message: `User plan updated from ${oldPlan} to ${plan}!`,
            user: {
                username: user.username,
                plan: user.plan
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update user plan', error: error.message });
    }
});

app.delete('/api/admin/users/:username', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isAdmin) {
            return res.status(400).json({ success: false, message: 'Cannot delete admin account' });
        }

        await User.findOneAndDelete({ username: req.params.username });

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
    }
});

app.delete('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const result = await User.deleteMany({ isAdmin: false });

        res.json({
            success: true,
            message: `Successfully deleted ${result.deletedCount} user(s)`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete users', error: error.message });
    }
});

app.get('/api/admin/dashboard', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const [
            totalUsers,
            activeUsers,
            inactiveUsers,
            totalSharesAgg,
            recentUsers,
            pendingOrders,
            processingOrders,
            completedOrders,
            totalRevenue,
            last30DaysShares
        ] = await Promise.all([
            User.countDocuments({ isAdmin: false }),
            User.countDocuments({ isActive: true, isAdmin: false }),
            User.countDocuments({ isActive: false, isAdmin: false }),
            User.aggregate([{ $group: { _id: null, total: { $sum: '$totalShares' } } }]),
            User.find({ isAdmin: false }).select('-password').sort({ createdAt: -1 }).limit(5).lean(),
            BoosterOrder.countDocuments({ status: 'pending' }),
            BoosterOrder.countDocuments({ status: 'processing' }),
            BoosterOrder.countDocuments({ status: 'completed' }),
            BoosterOrder.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            User.aggregate([
                { $unwind: '$shareHistory' },
                { $match: {
                    'shareHistory.date': {
                        $gte: moment().tz('Asia/Manila').subtract(30, 'days').startOf('day').toDate()
                    }
                }},
                { $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$shareHistory.date' } },
                    total: { $sum: '$shareHistory.count' }
                }},
                { $sort: { _id: 1 } }
            ])
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeUsers,
                inactiveUsers,
                totalShares: totalSharesAgg[0]?.total || 0,
                pendingOrders,
                processingOrders,
                completedOrders,
                totalRevenue: totalRevenue[0]?.total || 0,
                shareGraph: last30DaysShares,
                recentUsers: recentUsers.map(u => ({
                    username: u.username,
                    plan: u.plan,
                    isActive: u.isActive,
                    cookieCount: u.cookies.length,
                    totalShares: u.totalShares,
                    profileImage: u.profileImage,
                    createdAt: formatPHDate(u.createdAt)
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
                username: 'kendrick',
                password: await bcrypt.hash('XaneKath1', 10),
                facebook: 'facebook.com/ryoevisu',
                plan: 'premium',
                isAdmin: true,
                isActive: true,
                cookies: [],
                shareHistory: []
            });
            console.log('Admin created - Username: kendrick | Password: XaneKath1');
        } else {
            let needsSave = false;

            if (adminUser.facebook !== 'facebook.com/ryoevisu') {
                adminUser.facebook = 'facebook.com/ryoevisu';
                needsSave = true;
            }
            if (!adminUser.isActive) {
                adminUser.isActive = true;
                needsSave = true;
            }
            if (!adminUser.shareHistory) {
                adminUser.shareHistory = [];
                needsSave = true;
            }
            if (!adminUser.plan) {
                adminUser.plan = 'premium';
                needsSave = true;
            }

            if (needsSave) {
                await adminUser.save();
                console.log('Admin account updated');
            } else {
                console.log('Admin account verified');
            }
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

process.on('SIGTERM', () => {
    mongoose.connection.close().then(() => process.exit(0));
});

process.on('SIGINT', () => {
    mongoose.connection.close().then(() => process.exit(0));
});
and update this to the latest this is api.js and make sure it connected to my server.js properly and fully working 
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// API Configuration - Your KiroBoost API
const API_URL = process.env.API_URL || 'https://kiroboost-api-newshare.onrender.com';

// Headers configuration matching the Python script exactly
const FB_HEADERS = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="107", "Chromium";v="107", "Not=A?Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1'
};

const SHARE_HEADERS = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="107", "Chromium";v="107", "Not=A?Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'accept-encoding': 'gzip, deflate',
    'host': 'b-graph.facebook.com'
};

const BUSINESS_HEADERS = {
    'user-agent': 'Mozilla/5.0 (Linux; Android 8.1.0; MI 8 Build/OPM1.171019.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.86 Mobile Safari/537.36',
    'referer': 'https://www.facebook.com/',
    'host': 'business.facebook.com',
    'origin': 'https://business.facebook.com',
    'upgrade-insecure-requests': '1',
    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'cache-control': 'max-age=0',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'content-type': 'text/html; charset=utf-8'
};

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Store active sharing sessions
const activeSessions = new Map();

// ============ UTILITY FUNCTIONS ============

function extractPostId(link) {
    link = link.trim();
    if (/^\d+$/.test(link)) return link;
    
    link = link.replace(/^https?:\/\//i, '');
    link = link.replace(/^(www\.|m\.)/i, '');
    
    const patterns = [
        /facebook\.com\/.*?\/posts\/(\d+)/,
        /facebook\.com\/.*?\/photos\/.*?\/(\d+)/,
        /facebook\.com\/permalink\.php\?story_fbid=(\d+)/,
        /facebook\.com\/story\.php\?story_fbid=(\d+)/,
        /facebook\.com\/photo\.php\?fbid=(\d+)/,
        /\/(\d+)\/?$/
    ];
    
    for (const pattern of patterns) {
        const match = link.match(pattern);
        if (match) return match[1];
    }
    return link;
}

// ============ TOKEN EXTRACTION ============

async function getTokenFromContentManagement(cookie) {
    try {
        const response = await axios.get('https://business.facebook.com/content_management', {
            headers: { ...FB_HEADERS, cookie },
            timeout: 15000,
            maxRedirects: 5
        });
        const match = response.data.match(/EAAG(.*?)"/);
        return match ? 'EAAG' + match[1] : null;
    } catch (error) {
        return null;
    }
}

async function getTokenFromBusinessLocations(cookie) {
    try {
        const response = await axios.get('https://business.facebook.com/business_locations', {
            headers: { ...BUSINESS_HEADERS, cookie },
            timeout: 15000,
            maxRedirects: 5
        });
        const match = response.data.match(/(EAAG\w+)/);
        return match ? match[1] : null;
    } catch (error) {
        return null;
    }
}

// ============ POST ID EXTRACTION ============

async function getPostIdFromApi(link) {
    try {
        const response = await axios.post('https://id.traodoisub.com/api.php', 
            `link=${encodeURIComponent(link)}`,
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 10000
            }
        );
        if (response.data && response.data.id) {
            return response.data.id;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// ============ SHARING FUNCTIONS - NO DELAY ============

async function sharePost(cookie, token, postId) {
    try {
        const url = `https://b-graph.facebook.com/me/feed?link=https://mbasic.facebook.com/${postId}&published=0&access_token=${token}`;
        const response = await axios.post(url, null, {
            headers: { ...SHARE_HEADERS, cookie },
            timeout: 10000
        });
        
        if (response.data && response.data.id) {
            return { success: true, id: response.data.id };
        }
        return { success: false, error: response.data?.error?.message || 'Unknown error' };
    } catch (error) {
        return { success: false, error: error.response?.data?.error?.message || error.message };
    }
}

async function smmShare(cookie, token, postLink) {
    try {
        const url = `https://b-graph.facebook.com/me/feed?link=${postLink}&published=0&access_token=${token}`;
        const response = await axios.post(url, null, {
            headers: { ...SHARE_HEADERS, cookie },
            timeout: 10000
        });
        
        if (response.data && response.data.id) {
            return { success: true, id: response.data.id };
        }
        return { success: false, error: response.data?.error?.message || 'Unknown error' };
    } catch (error) {
        return { success: false, error: error.response?.data?.error?.message || error.message };
    }
}

// ============ API PROXY ROUTES ============

// Proxy all API requests to KiroBoost API
app.use('/api', async (req, res) => {
    try {
        const url = `${API_URL}${req.originalUrl}`;
        const config = {
            method: req.method,
            url,
            headers: {
                'Content-Type': 'application/json',
                ...(req.headers.authorization && { 'Authorization': req.headers.authorization })
            },
            timeout: 30000
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
            config.data = req.body;
        }

        const response = await axios(config);
        res.status(response.status).json(response.data);
    } catch (error) {
        const status = error.response?.status || 500;
        const data = error.response?.data || { success: false, message: error.message };
        res.status(status).json(data);
    }
});

// ============ SHARING ENGINE ROUTES ============

// Extract token from cookie
app.post('/share/extract-token', async (req, res) => {
    const { cookie, method } = req.body;
    
    if (!cookie) {
        return res.status(400).json({ success: false, message: 'Cookie is required' });
    }
    
    let token = null;
    
    if (method === 'smm' || method === 'content_management') {
        token = await getTokenFromContentManagement(cookie);
    }
    
    if (!token) {
        token = await getTokenFromBusinessLocations(cookie);
    }
    
    if (token) {
        res.json({ success: true, token });
    } else {
        res.status(400).json({ success: false, message: 'Failed to extract token' });
    }
});

// Get post ID
app.post('/share/get-post-id', async (req, res) => {
    const { link } = req.body;
    
    if (!link) {
        return res.status(400).json({ success: false, message: 'Link is required' });
    }
    
    let postId = extractPostId(link);
    
    if (/^\d+$/.test(postId)) {
        return res.json({ success: true, postId });
    }
    
    postId = await getPostIdFromApi(link);
    
    if (postId) {
        res.json({ success: true, postId });
    } else {
        res.status(400).json({ success: false, message: 'Failed to extract post ID' });
    }
});

// Single share request - NO DELAY
app.post('/share/execute', async (req, res) => {
    const { cookie, token, postId, method } = req.body;
    
    if (!cookie || !token || !postId) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    let result;
    if (method === 'smm') {
        result = await smmShare(cookie, token, postId);
    } else {
        result = await sharePost(cookie, token, postId);
    }
    
    res.json(result);
});

// Batch share - NO DELAY, PARALLEL EXECUTION
app.post('/share/batch', async (req, res) => {
    const { accounts, postId, method, targetCount } = req.body;
    
    if (!accounts || !accounts.length || !postId) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    const sessionId = Date.now().toString();
    activeSessions.set(sessionId, {
        status: 'running',
        successCount: 0,
        failCount: 0,
        targetCount: targetCount || Infinity,
        logs: [],
        accounts
    });
    
    res.json({ success: true, sessionId });
    
    // Start sharing in background - NO DELAYS
    runBatchShare(sessionId, accounts, postId, method, targetCount);
});

async function runBatchShare(sessionId, accounts, postId, method, targetCount) {
    const session = activeSessions.get(sessionId);
    if (!session) return;
    
    // Run all accounts in parallel - NO DELAY
    const sharePromises = accounts.map(async (account) => {
        while (session.status === 'running' && session.successCount < (targetCount || Infinity)) {
            const result = method === 'smm' 
                ? await smmShare(account.cookie, account.token, postId)
                : await sharePost(account.cookie, account.token, postId);
            
            const logEntry = {
                time: new Date().toISOString(),
                account: account.name || account.uid,
                success: result.success,
                message: result.success ? `Share ID: ${result.id}` : result.error
            };
            
            session.logs.push(logEntry);
            
            if (result.success) {
                session.successCount++;
            } else {
                session.failCount++;
                break; // Stop this account on error
            }
            
            if (session.successCount >= (targetCount || Infinity)) {
                session.status = 'completed';
                break;
            }
            
            // NO DELAY - Continue immediately
        }
    });
    
    await Promise.all(sharePromises);
    
    if (session.status === 'running') {
        session.status = 'completed';
    }
}

// Get session status
app.get('/share/session/:sessionId', (req, res) => {
    const session = activeSessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    res.json({
        success: true,
        status: session.status,
        successCount: session.successCount,
        failCount: session.failCount,
        targetCount: session.targetCount,
        logs: session.logs.slice(-100)
    });
});

// Stop session
app.post('/share/session/:sessionId/stop', (req, res) => {
    const session = activeSessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    session.status = 'stopped';
    res.json({ success: true, message: 'Session stopped' });
});

// Get country from IP - Auto detect
app.get('/detect-country', async (req, res) => {
    try {
        const response = await axios.get('http://ip-api.com/json/', { timeout: 5000 });
        res.json({ 
            success: true, 
            country: response.data.country || 'Philippines',
            countryCode: response.data.countryCode || 'PH',
            city: response.data.city || '',
            region: response.data.regionName || ''
        });
    } catch {
        res.json({ success: true, country: 'Philippines', countryCode: 'PH' });
    }
});

// Serve pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/boost', (req, res) => res.sendFile(path.join(__dirname, 'public', 'boost.html')));
app.get('/cookies', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cookies.html')));
app.get('/inbox', (req, res) => res.sendFile(path.join(__dirname, 'public', 'inbox.html')));
app.get('/transactions', (req, res) => res.sendFile(path.join(__dirname, 'public', 'transactions.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));
app.get('/limits', (req, res) => res.sendFile(path.join(__dirname, 'public', 'limits.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Start server
app.listen(PORT, () => {
    console.log(`✅ Kiroboost Web Server running on port ${PORT}`);
    console.log(`🌐 Open http://localhost:${PORT}`);
});
