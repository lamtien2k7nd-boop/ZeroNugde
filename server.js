require('dotenv').config();
const path = require('path');
const os = require('os');
const http = require('http');
const util = require('util');
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
const requiredEnvVarsWithAliases = {
  SESSION_SECRET: ['SESSION_SECRET'],
  MYSQL_HOST: ['MYSQL_HOST', 'MYSQLHOST'],
  MYSQL_USER: ['MYSQL_USER', 'MYSQLUSER'],
  MYSQL_PASSWORD: ['MYSQL_PASSWORD', 'MYSQLPASSWORD'],
  MYSQL_DATABASE: ['MYSQL_DATABASE', 'MYSQLDATABASE']
};
const missingEnvVars = Object.entries(requiredEnvVarsWithAliases)
  .filter(([, names]) => !names.some(name => !!process.env[name]))
  .map(([key]) => key);
if (missingEnvVars.length > 0) {
  if (missingEnvVars.length === 1 && missingEnvVars[0] === 'SESSION_SECRET' && process.env.NODE_ENV !== 'production') {
    logger.warn('⚠️ SESSION_SECRET is not set. Using the built-in default secret for development only. Do not use this in production.');
  } else {
    logger.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
    logger.error('Provide them via Railway environment variables or a local .env file.');
    process.exit(1);
  }
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

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=self');
  next();
});

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
  logger.info(`Logout requested, sessionID=${req.sessionID}`);
  if (!req.session) {
    logger.warn('Logout requested but no session found');
    return res.status(200).json({ success: true, message: 'No active session' });
  }

  const userId = req.session.userId;
  req.session.destroy((err) => {
    if (err) {
      logger.error('Session destroy error during logout:', err);
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }

    // Clear the session cookie. Session name set earlier as `name: 'sid'`.
    try {
      res.clearCookie('sid', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });
    } catch (cookieErr) {
      logger.warn('Failed to clear cookie during logout:', cookieErr);
    }

    logger.info(`Session destroyed for userId=${userId}`);
    res.json({ success: true, message: 'Logged out successfully' });
  });
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

// Thêm đoạn này để xử lý riêng cho file favicon khi chạy local
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'icons', 'favicon.ico'));
});

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
  logger.info('/health called');
  try {
    const { query } = require('./db/mysql-connection');
    logger.info('Running DB test query for health check');
    // Check database connection
    const result = await query('SELECT 1');
    logger.info(`/health DB result: ${JSON.stringify(result)}`);
    try {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      });
      logger.info('/health response sent successfully');
    } catch (sendErr) {
      logger.error('Error sending /health response:', sendErr);
      // Attempt a safe fallback to avoid empty responses
      try {
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).end('healthy');
      } catch (endErr) {
        logger.error('Fallback /health send failed:', endErr);
      }
    }
  } catch (err) {
    logger.error('Health check failed:', err && err.stack ? err.stack : err);
    try {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed'
      });
    } catch (sendErr) {
      logger.error('Error sending /health error response:', sendErr);
      try {
        res.setHeader('Content-Type', 'text/plain');
        res.status(503).end('unhealthy');
      } catch (endErr) {
        logger.error('Fallback /health error send failed:', endErr);
      }
    }
  }
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Global error handler:', err && err.stack ? err.stack : err);
  try {
    res.status(500).json({
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err && err.message) || 'Unknown error'
    });
  } catch (sendErr) {
    logger.error('Error sending response from global error handler:', sendErr);
    try {
      res.setHeader('Content-Type', 'text/plain');
      res.status(500).end('Internal server error');
    } catch (endErr) {
      logger.error('Fallback send from global error handler failed:', endErr);
    }
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  try {
    logger.error('Uncaught Exception (stack or inspect):', err && err.stack ? err.stack : util.inspect(err, { depth: 5 }));
    if (err && typeof err === 'object') {
      try {
        logger.error('Uncaught Exception properties: ' + util.inspect(Object.getOwnPropertyNames(err), { depth: 2 }));
      } catch (propErr) {
        logger.error('Failed to inspect error properties:', propErr);
      }
    }
  } catch (logErr) {
    console.error('Failed to log uncaughtException:', logErr);
  }
  // Keep process alive for debugging; do not exit immediately so we can gather logs
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason && (reason.stack || reason));
  // Keep process alive for debugging; do not exit immediately so we can gather logs
});

// Create an HTTP server so we can inspect socket events
const server = http.createServer(app);

server.on('connection', (socket) => {
  const addr = socket.remoteAddress + ':' + socket.remotePort;
  logger.info(`New TCP connection from ${addr}`);
  socket.on('error', (err) => {
    logger.error(`Socket error from ${addr}:`, err && err.stack ? err.stack : err);
  });
  socket.on('close', (hadError) => {
    logger.info(`Socket closed ${addr}, hadError=${hadError}`);
  });
  socket.on('end', () => {
    logger.info(`Socket end ${addr}`);
  });
});

server.on('clientError', (err, socket) => {
  logger.error('HTTP clientError:', err && err.stack ? err.stack : err);
  try {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  } catch (e) {
    logger.error('Failed to send clientError response:', e);
  }
});

server.on('error', (err) => {
  try {
    logger.error('Server error event:', err && err.stack ? err.stack : util.inspect(err, { depth: 5 }));
    logger.error(`Error code=${err.code}, errno=${err.errno}, syscall=${err.syscall}, address=${err.address}, port=${err.port}`);
  } catch (e) {
    console.error('Failed to log server error event:', e);
  }
  // If the port is in use or permission denied, exit to allow orchestration to restart or user to free the port
  if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
    logger.error('Port in use or permission denied — please free the port or run with elevated permissions');
    process.exit(1);
  }
});

server.listen(PORT, '::', () => {
  const addr = server.address();
  logger.info(`PID ${process.pid} listening on ${addr.address}:${addr.port}`);
  logger.info(`Server at http://localhost:${PORT}`);
  logger.info(`API bundle: http://localhost:${PORT}/api/app`);
  try {
    const nets = os.networkInterfaces();
    logger.info(`Network interfaces: ${JSON.stringify(nets)}`);
  } catch (e) {
    logger.error('Failed to read network interfaces:', e);
  }
});
