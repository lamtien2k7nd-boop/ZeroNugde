require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes/api');
const ocrRoutes = require('./routes/ocr');
const aiRoutes = require('./routes/ai');
const { getDb, findUserByUsername, createUser } = require('./db/database-mysql');

// Simple logging utility with timestamps
const logger = {
  info: (message) => console.log(`[${new Date().toISOString()}] INFO: ${message}`),
  error: (message) => console.error(`[${new Date().toISOString()}] ERROR: ${message}`),
  warn: (message) => console.warn(`[${new Date().toISOString()}] WARN: ${message}`)
};

// Environment variable validation
const requiredEnvVars = ['SESSION_SECRET', 'MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
if (missingEnvVars.length > 0) {
  logger.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  logger.error('Please set these in your .env file');
  process.exit(1);
}

// Warn if using default session secret in production
if (process.env.NODE_ENV === 'production' && process.env.SESSION_SECRET === 'zeronudge-secret-key') {
  logger.warn('⚠️  WARNING: Using default SESSION_SECRET in production. Please set a strong random secret!');
}

const PORT = Number(process.env.PORT) || 3000;
const app = express();
app.set('trust proxy', 1);

// Global request logger to assist debugging middleware order
app.use((req, res, next) => {
  logger.info(`Incoming request: method=${req.method}, originalUrl=${req.originalUrl}, path=${req.path}`);
  next();
});

getDb();

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'zeronudge-secret-key',
  resave: true,
  saveUninitialized: true,
  // KHÔNG dùng store
  cookie: {
    maxAge: 86400000,
    httpOnly: false,
    secure: false,
    path: '/'
  },
  name: 'sid'
}));

// Session error handling middleware
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid session token' });
  }
  if (err && err.name === 'SessionError') {
    return res.status(401).json({ error: 'Session error' });
  }
  next(err);
});

// Mount OCR router early so unauthenticated OCR uploads are reachable
app.use('/api/ocr', ocrRoutes);

// Apply rate limiting to API routes (trừ budget slider)
app.use('/api/', (req, res, next) => {
  // Bỏ qua rate limit cho budget update
  if (req.path.startsWith('/budget/') && req.method === 'PUT') {
    return next();
  }
  limiter(req, res, next);
});

// Auth Middleware
const requireAuth = (req, res, next) => {
  logger.info(`requireAuth check for path: ${req.path}, originalUrl: ${req.originalUrl}, session exists: ${!!req.session}, userId: ${req.session?.userId}, session ID: ${req.sessionID}`);
  // NOTE: OCR auth bypass removed — OCR endpoints should be mounted before auth if public access is required
  logger.info(`Cookies: ${JSON.stringify(req.cookies)}`);
  if (req.session && req.session.userId) {
    next();
  } else {
    if (req.path.startsWith('/api')) {
      res.status(401).json({ error: 'Unauthorized' });
    } else {
      logger.warn(`Redirecting to /auth for path: ${req.path}`);
      res.redirect('/auth');
    }
  }
};

// Auth Routes
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, password, fullName } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const userId = await createUser(username, password, fullName);
    res.status(201).json({ message: 'User registered successfully', userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => { // Re-enabled authLimiter
  try {
    const { username, password } = req.body;
    logger.info(`Login attempt for username: ${username}`);
    const user = await findUserByUsername(username);

    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.accountType = user.account_type;
      logger.info(`Login successful for user: ${username}, session ID: ${req.sessionID}`);
      logger.info(`Session userId set to: ${user.id}`);
      res.json({ message: 'Login successful', user: { id: user.id, username: user.username, account_type: user.account_type } });
    } else {
      logger.warn(`Login failed for username: ${username}`);
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session.userId) {
    res.json({ id: req.session.userId, username: req.session.username });
  } else {
    res.status(401).json({ error: 'Not logged in' });
  }
});

// OCR route is mounted earlier to ensure uploads are reachable
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api', requireAuth, apiRoutes);
app.use('/public', express.static(path.join(__dirname, 'public'), {
  maxAge: '0',
  etag: true
}));

// Thêm sau phần static files
app.get('/service-worker.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'service-worker.js'), {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/'
    }
  });
});

// PWA manifest
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'landing.html'));
});

app.get('/auth', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(__dirname, 'views', 'auth.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const { query } = require('./db/mysql-connection');
    // Check database connection
    await query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    logger.error('Health check failed:', err);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Global error handler:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // Graceful shutdown
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Graceful shutdown
  process.exit(1);
});

app.listen(PORT, () => {
  logger.info(`Server at http://localhost:${PORT}`);
  logger.info(`API bundle: http://localhost:${PORT}/api/app`);
});
