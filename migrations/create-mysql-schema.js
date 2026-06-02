const { query, createDatabase } = require('../db/mysql-connection');
require('dotenv').config();

async function createSchema() {
  try {
    // Create database if not exists
    await createDatabase();
    
    console.log('Creating MySQL schema...');
    
    // Users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        goal_title VARCHAR(255),
        goal_amount INT DEFAULT 0,
        waste_threshold INT DEFAULT 0,
        account_type VARCHAR(255) NOT NULL DEFAULT 'b2c'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Users table created');
    
    // User logs table
    await query(`
      CREATE TABLE IF NOT EXISTS user_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        action VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ User logs table created');
    
    // Tags table
    await query(`
      CREATE TABLE IF NOT EXISTS tags (
        id VARCHAR(255) PRIMARY KEY,
        sort_order INT NOT NULL,
        label VARCHAR(255) NOT NULL,
        color VARCHAR(255) NOT NULL,
        green INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Tags table created');
    
    // Savings table
    await query(`
      CREATE TABLE IF NOT EXISTS savings (
        user_id INT PRIMARY KEY,
        pig_amount INT NOT NULL,
        pig_target INT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Savings table created');
    
    // Transactions table
    await query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        sort_order INT NOT NULL,
        icon VARCHAR(255) NOT NULL,
        type VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        tag VARCHAR(255) NOT NULL,
        amount INT NOT NULL,
        saved INT NOT NULL DEFAULT 0,
        saved_amt INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Transactions table created');
    
    // Ledger rows table
    await query(`
      CREATE TABLE IF NOT EXISTS ledger_rows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        sort_order INT NOT NULL,
        date VARCHAR(255) NOT NULL,
        \`desc\` VARCHAR(255) NOT NULL,
        cat VARCHAR(255) NOT NULL,
        qty INT NOT NULL,
        price INT NOT NULL,
        cogs INT NOT NULL,
        partner VARCHAR(255) NOT NULL,
        esg VARCHAR(255) NOT NULL,
        paid INT NOT NULL DEFAULT 0,
        fifo_json TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Ledger rows table created');
    
    // Budget items table
    await query(`
      CREATE TABLE IF NOT EXISTS budget_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sort_order INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        key_name VARCHAR(255) UNIQUE NOT NULL,
        pct INT NOT NULL,
        cap_pct INT NOT NULL,
        color VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Budget items table created');
    
    // Projects table
    await query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sort_order INT NOT NULL,
        name VARCHAR(255) UNIQUE NOT NULL,
        \`desc\` TEXT NOT NULL,
        icon VARCHAR(255) NOT NULL,
        risk INT NOT NULL,
        risk_label VARCHAR(255) NOT NULL,
        risk_class VARCHAR(255) NOT NULL,
        rate VARCHAR(255) NOT NULL,
        period VARCHAR(255) NOT NULL,
        target INT NOT NULL,
        raised INT NOT NULL,
        esg VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Projects table created');
    
    // Suppliers table
    await query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sort_order INT NOT NULL,
        name VARCHAR(255) UNIQUE NOT NULL,
        cat VARCHAR(255) NOT NULL,
        icon VARCHAR(255) NOT NULL,
        esg VARCHAR(255) NOT NULL,
        price1 VARCHAR(255) NOT NULL,
        price2 VARCHAR(255) NOT NULL,
        min_order VARCHAR(255) NOT NULL,
        lead_time VARCHAR(255) NOT NULL,
        cert VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Suppliers table created');
    
    // Suggestions table
    await query(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sort_order INT NOT NULL,
        text TEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Suggestions table created');
    
    // Ledger summary table
    await query(`
      CREATE TABLE IF NOT EXISTS ledger_summary (
        user_id INT PRIMARY KEY,
        income INT NOT NULL,
        expense INT NOT NULL,
        net INT NOT NULL,
        assets INT NOT NULL,
        liabilities INT NOT NULL,
        equity INT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Ledger summary table created');
    
    // Exchange summary table
    await query(`
      CREATE TABLE IF NOT EXISTS exchange_summary (
        user_id INT PRIMARY KEY,
        available_balance INT NOT NULL,
        total_invested INT NOT NULL,
        cumulative_return INT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Exchange summary table created');
    
    // Club events table
    await query(`
      CREATE TABLE IF NOT EXISTS club_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        fund_amount INT NOT NULL,
        allocations TEXT,
        status VARCHAR(255) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Club events table created');
    
    // Meta table
    await query(`
      CREATE TABLE IF NOT EXISTS meta (
        key_name VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Meta table created');
    
    // Cashbook entries table
    await query(`
      CREATE TABLE IF NOT EXISTS cashbook_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        transaction_id VARCHAR(255) NOT NULL,
        entry_date VARCHAR(255) NOT NULL,
        type VARCHAR(255) NOT NULL,
        amount INT NOT NULL,
        category_tag VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        proof_document VARCHAR(255),
        balance_after INT NOT NULL,
        event_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user_id (user_id),
        INDEX idx_entry_date (entry_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Cashbook entries table created');
    
    // Events table
    await query(`
      CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        total_budget INT NOT NULL,
        backup_budget INT NOT NULL DEFAULT 0,
        status VARCHAR(255) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Events table created');
    
    // Event budget items table
    await query(`
      CREATE TABLE IF NOT EXISTS event_budget_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id INT NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        planned_amount INT NOT NULL,
        actual_amount INT NOT NULL DEFAULT 0,
        sort_order INT NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        INDEX idx_event_id (event_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await query(`
    -- Bảng lưu cài đặt The Perfect No theo từng user
    CREATE TABLE IF NOT EXISTS user_tpn_settings (
      user_id INT PRIMARY KEY,
      intervention_level VARCHAR(20) NOT NULL DEFAULT 'medium',
      monthly_limit BIGINT NOT NULL DEFAULT 3000000,
      warning_trigger INT NOT NULL DEFAULT 70,
      category_enabled TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✓ Event budget items table created');
    
    console.log('\n✅ MySQL schema created successfully!');
  } catch (error) {
    console.error('Error creating schema:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createSchema();
