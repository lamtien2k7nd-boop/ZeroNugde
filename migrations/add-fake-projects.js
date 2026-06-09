const { query } = require('../db/mysql-connection');
require('dotenv').config();

async function addFakeProjects() {
  try {
    console.log('Adding 15 fake projects to capital market...');
    
    // Check current number of projects
    const currentProjects = await query('SELECT COUNT(*) as count FROM projects');
    console.log(`Current projects: ${currentProjects[0].count}`);
    
    // Define 15 fake projects
    const fakeProjects = [
      { name: 'EcoHousing Đà Nẵng', desc: 'Khu nhà ở xanh với hệ thống năng lượng mặt trời và thu gom nước mưa.', icon: '🏠', risk: 35, riskLabel: 'Thấp', riskClass: 'risk-low', rate: '10.5', period: '24 tháng', target: 150, raised: 87, esg: 'A' },
      { name: 'GreenTech Hub TP.HCM', desc: 'Hub công nghệ xanh hỗ trợ startup ESG phát triển sản phẩm bền vững.', icon: '🚀', risk: 50, riskLabel: 'Trung bình', riskClass: 'risk-mid', rate: '13.0', period: '18 tháng', target: 100, raised: 62, esg: 'A' },
      { name: 'OceanClean Vietnam', desc: 'Dự án làm sạch biển bằng robot thu gom rác thải nhựa tự động.', icon: '🤖', risk: 65, riskLabel: 'Trung bình', riskClass: 'risk-mid', rate: '14.5', period: '30 tháng', target: 180, raised: 45, esg: 'B' },
      { name: 'SolarRoof Cần Thơ', desc: 'Lắp đặt hệ thống điện mặt trời mái nhà cho khu dân cư đô thị.', icon: '⚡', risk: 28, riskLabel: 'Thấp', riskClass: 'risk-low', rate: '9.5', period: '15 tháng', target: 75, raised: 58, esg: 'A' },
      { name: 'BioFuel An Giang', desc: 'Sản xuất nhiên liệu sinh học từ bã mía và phế phẩm nông nghiệp.', icon: '🌾', risk: 55, riskLabel: 'Trung bình', riskClass: 'risk-mid', rate: '12.8', period: '20 tháng', target: 120, raised: 71, esg: 'A' },
      { name: 'ForestRestore Quảng Nam', desc: 'Tái trồng rừng nguyên sinh và bảo tồn đa dạng sinh học.', icon: '🌲', risk: 40, riskLabel: 'Thấp', riskClass: 'risk-low', rate: '11.0', period: '36 tháng', target: 200, raised: 112, esg: 'A' },
      { name: 'SmartGrid Hà Nội', desc: 'Lưới điện thông minh tối ưu hóa phân phối năng lượng tái tạo.', icon: '🔌', risk: 45, riskLabel: 'Trung bình', riskClass: 'risk-mid', rate: '12.5', period: '24 tháng', target: 250, raised: 138, esg: 'A' },
      { name: 'WaterCycle Hải Phòng', desc: 'Hệ thống xử lý và tái sử dụng nước thải công nghiệp.', icon: '💧', risk: 38, riskLabel: 'Thấp', riskClass: 'risk-low', rate: '10.2', period: '18 tháng', target: 90, raised: 67, esg: 'A' },
      { name: 'CarbonCapture Thái Bình', desc: 'Công nghệ thu giữ CO2 từ nhà máy nhiệt điện.', icon: '🏭', risk: 70, riskLabel: 'Cao', riskClass: 'risk-high', rate: '16.0', period: '48 tháng', target: 300, raised: 89, esg: 'B' },
      { name: 'UrbanFarm Sài Gòn', desc: 'Nông trại đô thị mái nhà với hệ thống thủy canh tự động.', icon: '🥬', risk: 32, riskLabel: 'Thấp', riskClass: 'risk-low', rate: '9.8', period: '12 tháng', target: 60, raised: 48, esg: 'A' },
      { name: 'EcoMobility Huế', desc: 'Hệ thống xe đạp công cộng và trạm sạc điện cho xe điện.', icon: '🚲', risk: 42, riskLabel: 'Thấp', riskClass: 'risk-low', rate: '11.5', period: '20 tháng', target: 85, raised: 54, esg: 'A' },
      { name: 'RecycleHub Bình Dương', desc: 'Trung tâm tái chế rác thải điện tử và kim loại.', icon: '♻️', risk: 48, riskLabel: 'Trung bình', riskClass: 'risk-mid', rate: '13.2', period: '24 tháng', target: 110, raised: 73, esg: 'A' },
      { name: 'GreenBuilding Đà Nẵng', desc: 'Tòa nhà văn phòng đạt chuẩn LEED Platinum với hệ thống HVAC xanh.', icon: '🏢', risk: 36, riskLabel: 'Thấp', riskClass: 'risk-low', rate: '10.8', period: '30 tháng', target: 180, raised: 95, esg: 'A' },
      { name: 'BioPharma Cần Thơ', desc: 'Sản xuất dược phẩm từ nguồn gốc thực vật bền vững.', icon: '💊', risk: 58, riskLabel: 'Trung bình', riskClass: 'risk-mid', rate: '14.0', period: '36 tháng', target: 140, raised: 52, esg: 'B' },
      { name: 'WindPower Quảng Ninh', desc: 'Điện gió ngoài khơi với công suất 500MW cho khu vực miền Bắc.', icon: '🌬️', risk: 62, riskLabel: 'Trung bình', riskClass: 'risk-mid', rate: '15.0', period: '42 tháng', target: 400, raised: 165, esg: 'A' },
    ];
    
    // Insert fake projects
    let sortOrder = 6; // Start after existing projects
    for (const project of fakeProjects) {
      try {
        await query(`
          INSERT INTO projects (sort_order, name, \`desc\`, icon, risk, risk_label, risk_class, rate, period, target, raised, esg)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [sortOrder, project.name, project.desc, project.icon, project.risk, project.riskLabel, project.riskClass, project.rate, project.period, project.target, project.raised, project.esg]);
        console.log(`✓ Added project: ${project.name}`);
        sortOrder++;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️ Project already exists: ${project.name}`);
        } else {
          console.error(`✗ Error adding project ${project.name}:`, err.message);
        }
      }
    }
    
    // Verify insertion
    const newCount = await query('SELECT COUNT(*) as count FROM projects');
    console.log(`\n✅ Total projects after insertion: ${newCount[0].count}`);
    
    // List all projects
    const allProjects = await query('SELECT name, rate, target, raised FROM projects ORDER BY sort_order');
    console.log('\nAll projects in database:');
    allProjects.forEach(p => {
      console.log(`- ${p.name}: ${p.rate}%/năm, mục tiêu ${p.target} triệu₫, đã gọi ${p.raised} triệu₫`);
    });
    
    console.log('\n✅ Fake projects migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

addFakeProjects();
