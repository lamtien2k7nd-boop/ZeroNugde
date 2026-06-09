const { query } = require('../db/mysql-connection');
require('dotenv').config();

async function addUserInvestmentsTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS user_investments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        project_id INT NOT NULL,
        amount BIGINT NOT NULL,
        status ENUM('active', 'returned') DEFAULT 'active',
        invested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        returned_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
        INDEX idx_user_id (user_id),
        INDEX idx_project_id (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ user_investments table created');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

addUserInvestmentsTable();
