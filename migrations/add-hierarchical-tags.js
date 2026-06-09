const { query } = require('../db/mysql-connection');
require('dotenv').config();

async function addHierarchicalTags() {
  try {
    console.log('Adding parent_id column to tags table...');
    
    // Check if columns exist
    const columns = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tags'
    `);
    const columnNames = columns.map(c => c.COLUMN_NAME);
    
    // Add parent_id column if it doesn't exist
    if (!columnNames.includes('parent_id')) {
      await query('ALTER TABLE tags ADD COLUMN parent_id VARCHAR(255) NULL');
      console.log('✓ Added parent_id column');
    }
    
    // Add is_main column if it doesn't exist
    if (!columnNames.includes('is_main')) {
      await query('ALTER TABLE tags ADD COLUMN is_main INT DEFAULT 0');
      console.log('✓ Added is_main column');
    }
    
    // Clear existing tags
    await query('DELETE FROM tags');
    console.log('✓ Cleared existing tags');
    
    // Define new hierarchical tags structure
    const tagData = [
      // Main categories (is_main = 1)
      { id: 'an_uong', label: 'Ăn uống', color: '#f59e0b', parent_id: null, is_main: 1, sort_order: 1 },
      { id: 'di_chuyen', label: 'Di chuyển', color: '#3b82f6', parent_id: null, is_main: 1, sort_order: 2 },
      { id: 'dien_nuoc', label: 'Điện nước', color: '#06b6d4', parent_id: null, is_main: 1, sort_order: 3 },
      { id: 'tap_hoa', label: 'Tạp hóa', color: '#8b5cf6', parent_id: null, is_main: 1, sort_order: 4 },
      { id: 'song_xanh', label: 'Sống xanh', color: '#22c55e', parent_id: null, is_main: 1, sort_order: 5, green: 1 },
      { id: 'cong_nghe', label: 'Công nghệ', color: '#6366f1', parent_id: null, is_main: 1, sort_order: 6 },
      { id: 'giai_tri', label: 'Giải trí', color: '#ec4899', parent_id: null, is_main: 1, sort_order: 7 },
      { id: 'mua_sam', label: 'Mua sắm', color: '#f97316', parent_id: null, is_main: 1, sort_order: 8 },
      { id: 'suc_khoe', label: 'Sức khỏe', color: '#14b8a6', parent_id: null, is_main: 1, sort_order: 9 },
      { id: 'hoc_tap', label: 'Học tập', color: '#a855f7', parent_id: null, is_main: 1, sort_order: 10 },
      
      // Sub-categories for Ăn uống
      { id: 'an_tiec', label: 'Ăn tiệc', color: '#f59e0b', parent_id: 'an_uong', is_main: 0, sort_order: 11 },
      { id: 'di_cho', label: 'Đi chợ', color: '#f59e0b', parent_id: 'an_uong', is_main: 0, sort_order: 12 },
      { id: 'ca_phe', label: 'Cà phê', color: '#f59e0b', parent_id: 'an_uong', is_main: 0, sort_order: 13 },
      
      // Sub-categories for Di chuyển
      { id: 'xang_xe', label: 'Xăng xe', color: '#3b82f6', parent_id: 'di_chuyen', is_main: 0, sort_order: 14 },
      { id: 'dat_xe', label: 'Đặt xe', color: '#3b82f6', parent_id: 'di_chuyen', is_main: 0, sort_order: 15 },
      
      // Sub-categories for Điện nước
      { id: 'tien_nha', label: 'Tiền nhà', color: '#06b6d4', parent_id: 'dien_nuoc', is_main: 0, sort_order: 16 },
      { id: 'tiet_kiem_dien', label: 'Tiết kiệm điện', color: '#06b6d4', parent_id: 'dien_nuoc', is_main: 0, sort_order: 17, green: 1 },
      
      // Sub-categories for Tạp hóa
      { id: 'nhu_yeu_pham', label: 'Nhu yếu phẩm', color: '#8b5cf6', parent_id: 'tap_hoa', is_main: 0, sort_order: 18 },
      { id: 'do_dung_nha_bep', label: 'Đồ dùng nhà bếp', color: '#8b5cf6', parent_id: 'tap_hoa', is_main: 0, sort_order: 19 },
      
      // Sub-categories for Sống xanh
      { id: 'tai_su_dung', label: 'Tái sử dụng', color: '#22c55e', parent_id: 'song_xanh', is_main: 0, sort_order: 20, green: 1 },
      { id: 'mua_do_cu', label: 'Mua đồ cũ', color: '#22c55e', parent_id: 'song_xanh', is_main: 0, sort_order: 21, green: 1 },
      
      // Sub-categories for Công nghệ
      { id: 'dien_thoai', label: 'Điện thoại', color: '#6366f1', parent_id: 'cong_nghe', is_main: 0, sort_order: 22 },
      { id: 'dang_ky_app', label: 'Đăng ký app', color: '#6366f1', parent_id: 'cong_nghe', is_main: 0, sort_order: 23 },
      
      // Sub-categories for Giải trí
      { id: 'xem_phim', label: 'Xem phim', color: '#ec4899', parent_id: 'giai_tri', is_main: 0, sort_order: 24 },
      { id: 'dam_dinh', label: 'Đám đình', color: '#ec4899', parent_id: 'giai_tri', is_main: 0, sort_order: 25 },
      { id: 'du_lich', label: 'Du lịch', color: '#ec4899', parent_id: 'giai_tri', is_main: 0, sort_order: 26 },
      
      // Khác tag for custom expenses
      { id: 'khac', label: 'Khác', color: '#6b7280', parent_id: null, is_main: 1, sort_order: 99 }
    ];
    
    // Insert new tags
    for (const tag of tagData) {
      await query(`
        INSERT INTO tags (id, sort_order, label, color, green, parent_id, is_main)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [tag.id, tag.sort_order, tag.label, tag.color, tag.green || 0, tag.parent_id, tag.is_main]);
    }
    
    console.log(`✓ Inserted ${tagData.length} tags`);
    
    // Verify insertion
    const tags = await query('SELECT id, label, parent_id, is_main FROM tags ORDER BY sort_order');
    console.log('\nNew tags structure:');
    tags.forEach(t => {
      const indent = t.parent_id ? '  └─ ' : '';
      const main = t.is_main ? '[MAIN] ' : '';
      console.log(`${indent}${main}${t.id}: ${t.label}${t.parent_id ? ` (parent: ${t.parent_id})` : ''}`);
    });
    
    console.log('\n✅ Hierarchical tags migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

addHierarchicalTags();
