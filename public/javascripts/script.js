// ──────────────────────────────────────────────────────
// DATA (Initialized from API)
// ──────────────────────────────────────────────────────
let tags = [];
let selectedTag = null;
let pigAmount = 0;
let pigTarget = 0;
let transactions = [];
let budgetItems = [];
let projects = [];
let suppliers = [];
let suggestions = [];
let ledgerSummary = {
  income: 0,
  expense: 0,
  net: 0,
  assets: 0,
  liabilities: 0,
  equity: 0,
};
let exchangeSummary = {
  availableBalance: 0,
  totalInvested: 0,
  cumulativeReturn: 0,
};
let currentUser = null;
let userLogs = [];
let html5QrCode = null;
let transactionsPage = 1;
const TRANSACTIONS_PER_PAGE = 8;
let budgetApprovals = [];
let budgetApprovalsPage = 1;
const BUDGET_APPROVALS_PER_PAGE = 5;
let events = [];
let activeEventId = null;
let selectedSuppliers = [];
let esgFilter = 'all';
let directorySearchQuery = '';
let ledgerSearchQuery = '';
let searchTimeout = null;
let accountType = 'b2c';
let cashbookData = null;
let dashboardStats = null;
let ledgerActiveTab = 'inventory';
let cashbookFilter = { type: '', tag: '', period: '' };
let pendingExpenseAction = null;
let toastTimeout = null;
let chatHistory = [];
let aiAutoClassifyTimer = null;

async function initAIIntegration() {
  attachAIExpenseListeners();
}

function attachAIExpenseListeners() {
  const nameInput = document.getElementById('qi-name');
  const amtInput = document.getElementById('qi-amount');

  if (nameInput) {
    nameInput.addEventListener('blur', () => {
      clearTimeout(aiAutoClassifyTimer);
      aiAutoClassifyTimer = setTimeout(autoClassifyExpense, 500);
    });
  }

  if (amtInput) {
    amtInput.addEventListener('blur', () => {
      clearTimeout(aiAutoClassifyTimer);
      aiAutoClassifyTimer = setTimeout(autoClassifyExpense, 500);
    });
  }
}

function openAIChatbot() {
  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="compare-modal ai-chat-modal" onclick="event.stopPropagation()" style="max-width: 520px; width: 100%; display: flex; flex-direction: column; padding: 24px;">
        <button class="modal-close" onclick="closeModal()">× Đóng</button>
        <div class="card-title" style="margin-bottom: 16px;">🤖 Cố vấn tài chính AI</div>
        <div class="small-note" style="margin-bottom: 12px;">Phản hồi AI chỉ để tham khảo. Hãy tự quản lý dòng tiền để không phải ăn mì tôm mỗi bữa.</div>
        <div id="chat-messages" style="flex: 1; overflow-y: auto; margin-bottom: 16px; padding-right: 8px;"></div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input id="chat-input" type="text" placeholder="Nhập câu hỏi của bạn..." style="flex: 1; padding: 12px 14px; border-radius: 999px; border: 1px solid var(--card-border); background: var(--bg-subtle); color: var(--text);">
          <button class="btn-primary" onclick="sendChatMessage()" style="border-radius: 999px; padding: 12px 18px; min-width: 96px;">Gửi</button>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'block';
  refreshIcons();
  const input = document.getElementById('chat-input');
  input?.focus();
  input?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
  appendChatMessage('bot', 'Chào bạn! Tôi là cố vấn tài chính AI. Hãy hỏi tôi về chi tiêu, tiết kiệm, hoặc đầu tư nhé! 💬');
}

function appendChatMessage(sender, text, options = {}) {
  const messagesDiv = document.getElementById('chat-messages');
  if (!messagesDiv) return;
  const messageClass = sender === 'user' ? 'chat-message user' : 'chat-message bot';
  const escaped = escapeHtml(text);
  const html = `
    <div class="${messageClass}">
      <div class="message-bubble">${escaped}</div>
    </div>
  `;
  messagesDiv.innerHTML += html;
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const question = input.value.trim();
  if (!question) return;

  appendChatMessage('user', question);
  input.value = '';
  appendChatMessage('bot', '🤔 Đang suy nghĩ...');

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    const data = await res.json();
    if (!res.ok) {
      appendChatMessage('bot', data.error || 'Lỗi chat AI. Vui lòng thử lại.');
      return;
    }

    const answer = data.answer || 'Tôi chưa thể trả lời lúc này.';
    appendChatMessage('bot', answer);

    if (Array.isArray(data.warnings) && data.warnings.length > 0) {
      appendChatMessage('bot', `⚠️ ${data.warnings.join(' | ')}`);
    }
    if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      appendChatMessage('bot', `💡 ${data.suggestions.join(' | ')}`);
    }
  } catch (err) {
    console.error('AI chat error:', err);
    appendChatMessage('bot', '❌ Lỗi kết nối, vui lòng thử lại sau.');
  }
}

async function autoClassifyExpense() {
  const nameInput = document.getElementById('qi-name');
  const amtInput = document.getElementById('qi-amount');
  if (!nameInput || !amtInput) return;

  const description = nameInput.value.trim();
  const amount = parseFloat(amtInput.value) || 0;
  if (!description || description.length < 3 || amount <= 0) return;

  try {
    const res = await fetch('/api/ai/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, amount })
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('Auto classify failed', data);
      return;
    }

    if (data.category) {
      const matchedTag = tags.find(t => t.label === data.category);
      if (matchedTag) {
        selectedTag = matchedTag.id;
        renderTags();
        showToast(`🔍 Đã phân loại: ${data.category}`, 'info');
      }
      if (data.suggestion) {
        showToast(`💡 ${data.suggestion}`, 'info');
      }
    }
  } catch (err) {
    console.error('Auto classify error:', err);
  }
}

// Biến lưu cài đặt TPN
let tpnSettings = {
  interventionLevel: 'medium',
  monthlyLimit: 3000000,
  warningTrigger: 70,
  categoryEnabled: {}
};

// Tải cài đặt từ server
async function loadTPNSettings() {
  try {
    const res = await fetch('/api/tpn/settings');
    if (res.ok) {
      const data = await res.json();
      tpnSettings = { ...tpnSettings, ...data };
    }
  } catch (err) {
    console.error('Failed to load TPN settings:', err);
  }
}

function openTPNSettingsModal() {
  const modal = document.getElementById('tpn-settings-modal');
  if (!modal) return;

  // Điền dữ liệu
  const levelRadio = modal.querySelector(`input[name="intervention-level"][value="${tpnSettings.interventionLevel}"]`);
  if (levelRadio) levelRadio.checked = true;

  const limitInput = document.getElementById('tpn-monthly-limit');
  if (limitInput) limitInput.value = tpnSettings.monthlyLimit;

  const triggerSelect = document.getElementById('tpn-warning-trigger');
  if (triggerSelect) triggerSelect.value = tpnSettings.warningTrigger;

  // Render các category toggle
  const container = document.getElementById('tpn-category-toggles');
  if (container) {
    container.innerHTML = tags.map(tag => `
      <div class="category-toggle">
        <label class="switch">
          <input type="checkbox" data-tag-id="${tag.id}" ${tpnSettings.categoryEnabled[tag.id] !== false ? 'checked' : ''}>
          <span class="slider round"></span>
        </label>
        <span class="category-name">${tag.label}</span>
      </div>
    `).join('');
  }

  modal.style.display = 'flex';
  refreshIcons();
}

function closeTPNSettingsModal() {
  const modal = document.getElementById('tpn-settings-modal');
  if (modal) modal.style.display = 'none';
}

// Lưu cài đặt lên server
async function saveTPNSettings() {
  const level = document.querySelector('input[name="intervention-level"]:checked')?.value;
  const monthlyLimit = parseInt(document.getElementById('tpn-monthly-limit').value);
  const warningTrigger = parseInt(document.getElementById('tpn-warning-trigger').value);
  
  // Lấy trạng thái các category toggle
  const categoryEnabled = {};
  document.querySelectorAll('.category-toggle input').forEach(checkbox => {
    const tagId = checkbox.dataset.tagId;
    categoryEnabled[tagId] = checkbox.checked;
  });
  
  const settings = {
    interventionLevel: level || tpnSettings.interventionLevel,
    monthlyLimit: monthlyLimit || tpnSettings.monthlyLimit,
    warningTrigger: warningTrigger || tpnSettings.warningTrigger,
    categoryEnabled
  };
  
  try {
    const res = await fetch('/api/tpn/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    
    if (res.ok) {
      tpnSettings = settings;
      closeTPNSettingsModal();
      showToast('Đã lưu cài đặt The Perfect No', 'success');
    } else {
      throw new Error('Save failed');
    }
  } catch (err) {
    showToast('Lỗi lưu cài đặt', 'error');
  }
}

// Kiểm tra cảnh báo trước khi chi
async function checkTPNWarning(amount, categoryTagId) {
  try {
    const res = await fetch('/api/tpn/check-warning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, categoryTagId })
    });
    const data = await res.json();
    return data.warning;
  } catch (err) {
    console.error('Check warning error:', err);
    return null;
  }
}

// Cập nhật submitExpense để gọi check warning
// Trong submitExpense, thay thế logic kiểm tra waste bằng:
// const warning = await checkTPNWarning(amt, selectedTag);
// if (warning) {
//   showRuleBasedWarning(warning, sayNoAndSave, proceedWithExpense);
// } else {
//   await proceedWithExpense();
// }

// PWA Install Prompt
let deferredPrompt = null;

function isPWAInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function initPWA() {
  const installBtn = document.getElementById('install-pwa-btn');
  if (!installBtn || isPWAInstalled()) return;

  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  
  if (isIos) {
    installBtn.style.display = 'flex';
    window.installPWA = () => {
      showToast('Trên iOS, hãy nhấn nút Chia sẻ (Share) ở dưới cùng màn hình và chọn "Thêm vào màn hình chính" (Add to Home Screen).', 'info');
    };
  } else {
    // Android or Desktop supporting beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installBtn.style.display = 'flex';
    });
    
    window.installPWA = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          installBtn.style.display = 'none';
        }
        deferredPrompt = null;
      } else {
        showToast('Không thể cài đặt lúc này, hoặc ứng dụng đã được cài đặt.', 'info');
      }
    };
  }
}

// Gọi initPWA và AI integration khi nội dung DOM đã load
document.addEventListener('DOMContentLoaded', () => {
  initPWA();
  initAIIntegration();
});
// Trong trường hợp kịch bản được load sau DOMContentLoaded
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initPWA();
  initAIIntegration();
}

// Mobile search expand/collapse
let isSearchExpanded = false;

function initMobileSearch() {
  const searchBar = document.getElementById('search-bar');
  const searchInput = searchBar?.querySelector('input');
  const searchIcon = document.getElementById('search-icon');

  if (!searchBar || !searchIcon) return;

  // Tạo overlay nếu chưa có
  let overlay = document.querySelector('.search-mode-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'search-mode-overlay';
    document.body.appendChild(overlay);
  }

  const toggleSearch = (active) => {
    isSearchExpanded = active;
    if (active) {
      searchBar.classList.add('active');
      overlay.classList.add('active');
      searchInput?.focus();
    } else {
      searchBar.classList.remove('active');
      overlay.classList.remove('active');
      if (searchInput) searchInput.value = '';
      
      // Clear data search if ended
      const searchEvent = new CustomEvent('mobile-search', { detail: { term: '' } });
      window.dispatchEvent(searchEvent);
    }
  };

  // Click icon để mở/đóng trên mobile
  searchIcon.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024) {
      e.stopPropagation();
      toggleSearch(!isSearchExpanded);
    }
  });

  // Click overlay để đóng
  overlay.addEventListener('click', () => toggleSearch(false));

  // Handle search input
  searchInput?.addEventListener('input', (e) => {
    const searchTerm = e.target.value;
    
    // Dispatch search event
    const searchEvent = new CustomEvent('mobile-search', { detail: { term: searchTerm } });
    window.dispatchEvent(searchEvent);

    // Update ledger search if on ledger screen
    if (typeof updateLedgerSearch === 'function') {
      updateLedgerSearch(searchTerm);
    }
  });

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSearchExpanded) {
      toggleSearch(false);
    }
  });
}

let cvReady = false;
let budgetSliderTimeout = null;
function waitForOpenCV() {
  return new Promise((resolve, reject) => {
    if (cv && cv.Mat) {
      cvReady = true;
      resolve();
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (cv && cv.Mat) {
          clearInterval(interval);
          cvReady = true;
          resolve();
        } else if (attempts > 100) { // 10s timeout
          clearInterval(interval);
          reject(new Error("OpenCV load timeout"));
        }
      }, 100);
    }
  });
}
async function preprocessImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let width = img.width;
      let height = img.height;
      const maxWidth = 1200;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let imageData = ctx.getImageData(0, 0, width, height);
      let data = imageData.data;

      // Chuyển grayscale và áp dụng threshold động (dựa trên histogram)
      // Đơn giản: lấy ngưỡng = 180, nhưng trước đó làm mờ nhẹ
      // Tạo một bản grayscale
      const gray = new Uint8ClampedArray(width * height);
      for (let i = 0; i < data.length; i += 4) {
        let brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        gray[i / 4] = brightness;
      }
      // Làm mờ nhẹ (3x3 box blur) để giảm nhiễu
      const blurred = new Uint8ClampedArray(width * height);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let idx = y * width + x;
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              sum += gray[(y + dy) * width + (x + dx)];
            }
          }
          blurred[idx] = sum / 9;
        }
      }
      // Ngưỡng cố định 200 (tăng lên để chỉ giữ chữ đậm)
      const threshold = 200;
      for (let i = 0; i < data.length; i += 4) {
        let idx = i / 4;
        let val = blurred[idx] > threshold ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
    };
    img.src = URL.createObjectURL(file);
  });
}

// ──────────────────────────────────────────────────────
// AUTH & INITIALIZATION
// ──────────────────────────────────────────────────────
async function initApp() {
  try {
    const response = await fetch('/api/app');
    if (response.status === 401) {
      window.location.href = '/auth';
      return;
    }

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || `Server returned status ${response.status}`);
    }

    // Populate global state with safe fallbacks
    tags = data.tags || [];
    pigAmount = data.pigAmount || 0;
    pigTarget = data.pigTarget || 0;
    transactions = data.transactions || [];
    budgetItems = data.budgetItems || [];
    projects = data.projects || [];
    suppliers = data.suppliers || [];
    suggestions = data.suggestions || [];
    ledgerSummary = data.ledgerSummary || ledgerSummary;
    exchangeSummary = data.exchangeSummary || exchangeSummary;
    currentUser = data.user || null;
    userLogs = (data.logs || []).map(l => l.action);

    const rawType = data.user?.account_type || data.dashboardStats?.accountType || 'b2c';
    // [DISABLED B2B] accountType = ['b2b', 'club', 'team'].includes(rawType) ? 'b2b' : 'b2c';
    accountType = 'b2c'; // B2B tạm thời bị vô hiệu hóa

    // [DISABLED B2B] if (accountType === 'b2b') ledgerActiveTab = 'cashbook';

    events = data.events || [];
    cashbookData = data.cashbook || null;
    dashboardStats = data.dashboardStats || null;

    if (data.ledgerSummary) ledgerSummary = data.ledgerSummary;

    console.log('App initialization complete', {
      user: currentUser?.username,
      budgetItemsCount: budgetItems.length,
      eventsCount: events.length
    });

    if (budgetItems.length > 0) {
      console.log('Budget items loaded:', budgetItems.map(i => ({ key: i.key, name: i.name, pct: i.pct })));
    }

    await loadTPNSettings();


    initTheme();
    renderDashboard();
    refreshIcons();
    checkOnboarding();
  } catch (err) {
    console.error('Failed to initialize app:', err);
    showToast('Lỗi tải dữ liệu');
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  } catch (err) {
    showToast('Đăng xuất thất bại');
  }
}

// ──────────────────────────────────────────────────────
// ONBOARDING & TOUR
// ──────────────────────────────────────────────────────
function checkOnboarding() {
  if (!currentUser) return;

  const createdAt = new Date(currentUser.created_at);
  const now = new Date();
  const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);

  // If new user (within 3 days) and hasn't set goals yet
  if (diffDays <= 3 && (!currentUser.goal_title || currentUser.goal_amount === 0)) {
    showOnboardingModal();
  } else {
    // Check if tour should be shown (only once)
    const hasBeenOffered = ['tour_completed', 'tour_skipped', 'tour_presented'].some(act => userLogs.includes(act));
    if (!hasBeenOffered) {
      startTour();
      logAction('tour_presented');
    }
  }

}

function showOnboardingModal() {
  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-content onboarding-modal">
        <div class="modal-header">
          <h2>Chào mừng bạn mới!</h2>
        </div>
        <div class="modal-body">
          <p>Hãy cùng ZeroNudge thiết lập mục tiêu tài chính đầu tiên của bạn trong 3 ngày đầu tiên nhé.</p>
          <div class="input-field">
            <label>Mục tiêu của bạn là gì?</label>
            <input type="text" id="ob-goal-title" placeholder="Ví dụ: Mua laptop mới, Quỹ khẩn cấp...">
          </div>
          <div class="input-field">
            <label>Số tiền mục tiêu (đ)</label>
            <input type="number" id="ob-goal-amount" placeholder="Nhập số tiền mục tiêu...">
          </div>
          <div class="input-field">
            <label>Bạn cho rằng mức chi tiêu nào là "Lãng phí"? (đ)</label>
            <p class="text-muted" style="font-size: 0.8rem; margin-bottom: 8px;">Số tiền này sẽ được dùng để cảnh báo khi bạn nhập chi tiêu.</p>
            <input type="number" id="ob-waste-threshold" placeholder="Ví dụ: 100,000">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary-qi" style="width: 100%;" onclick="saveOnboarding()">Bắt đầu hành trình</button>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'block';
}

async function saveOnboarding() {
  const goalTitle = document.getElementById('ob-goal-title').value;
  const goalAmount = parseInt(document.getElementById('ob-goal-amount').value);
  const wasteThreshold = parseInt(document.getElementById('ob-waste-threshold').value);

  if (!goalTitle || isNaN(goalAmount) || isNaN(wasteThreshold)) {
    showToast('Vui lòng nhập đầy đủ thông tin');
    return;
  }

  try {
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalTitle, goalAmount, wasteThreshold })
    });
    if (res.ok) {
      currentUser.goal_title = goalTitle;
      currentUser.goal_amount = goalAmount;
      currentUser.waste_threshold = wasteThreshold;
      pigTarget = goalAmount;
      document.getElementById('modal-container').style.display = 'none';
      renderDashboard();
      showToast('Thiết lập thành công!');
      startTour();
    }
  } catch (err) {
    showToast('Lỗi lưu thông tin');
  }
}

// TOUR LOGIC
let tourStep = 0;
const tourSteps = [
  { target: '#sidebar', text: 'Đây là thanh điều hướng chính của bạn.', pos: 'right' },
  { target: '#balance-val', text: 'Theo dõi biến động số dư tại đây.', pos: 'bottom' },
  { target: '.input-card', text: 'Nhập nhanh giao dịch hàng ngày để theo dõi chi tiêu.', pos: 'bottom' },
  { target: '.goals-card', text: 'Theo dõi tiến độ tiết kiệm xanh của bạn.', pos: 'left' },
  // [DISABLED] { target: '.nav-item[onclick*="ledger"]', text: 'Xem chi tiết sổ hạch toán và dòng tiền.', pos: 'right' },
];

function startTour() {
  // Small delay to ensure renderDashboard finished and elements are visible
  setTimeout(() => {
    tourStep = 0;
    showTourStep();
  }, 300);
}

function showTourStep() {
  const step = tourSteps[tourStep];
  const targetEl = document.querySelector(step.target);
  if (!targetEl) {
    document.getElementById('tour-overlay').style.display = 'none';
    return;
  }

  const rect = targetEl.getBoundingClientRect();
  const overlay = document.getElementById('tour-overlay');
  overlay.innerHTML = `
    <div class="tour-spotlight" style="top:${rect.top}px; left:${rect.left}px; width:${rect.width}px; height:${rect.height}px;"></div>
    <div class="tour-popover ${step.pos}" style="top:${step.pos === 'bottom' ? rect.bottom + 20 : rect.top}px; left:${step.pos === 'right' ? rect.right + 20 : (step.pos === 'left' ? rect.left - 220 : rect.left)}px;">
      <div class="tour-text">${step.text}</div>
      <div class="tour-footer">
        <button class="btn-text" onclick="skipTour()">Bỏ qua</button>
        <button class="btn-primary-sm" onclick="nextTourStep()">${tourStep === tourSteps.length - 1 ? 'Hoàn tất' : 'Tiếp theo'}</button>
      </div>
    </div>
  `;
  overlay.style.display = 'block';
}

function nextTourStep() {
  tourStep++;
  if (tourStep < tourSteps.length) {
    showTourStep();
  } else {
    completeTour();
  }
}

async function skipTour() {
  document.getElementById('tour-overlay').style.display = 'none';
  await fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'tour_skipped' })
  });
}

async function completeTour() {
  document.getElementById('tour-overlay').style.display = 'none';
  await fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'tour_completed' })
  });
  showToast('Đã hoàn thành hướng dẫn!');
}

async function saveSettings() {
  const fullName = document.getElementById('set-fullname').value;
  const goalTitle = document.getElementById('set-goal-title').value;
  const goalAmount = parseInt(document.getElementById('set-goal-amount').value);
  const wasteThreshold = parseInt(document.getElementById('set-waste-threshold').value);

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, goalTitle, goalAmount, wasteThreshold })
    });
    if (res.ok) {
      currentUser.full_name = fullName;
      currentUser.goal_title = goalTitle;
      currentUser.goal_amount = goalAmount;
      currentUser.waste_threshold = wasteThreshold;
      pigTarget = goalAmount;
      renderDashboard();
      showToast('Cài đặt đã được lưu!');
    }
  } catch (err) {
    showToast('Lỗi lưu cài đặt');
  }
}

// ──────────────────────────────────────────────────────
// THEME & CORE LOGIC
// ──────────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  if (window.mainChart) updateCharts();
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  refreshIcons();
}

function refreshIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ──────────────────────────────────────────────────────
// NAVIGATION & SCREEN RENDERING
// ──────────────────────────────────────────────────────
function switchScreen(id, el) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('screen-' + id);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');

  // Render logic for specific screens
  switch (id) {
    case 'dashboard': renderDashboard(); break;
    // [DISABLED] case 'ledger': void renderLedger(); break;
    // [DISABLED] case 'budget': renderBudget(); break;
    case 'exchange': renderExchange(); break;
    // [DISABLED] case 'directory': renderDirectory(); break;
    case 'settings': openSettingsModal(); break;
  }
}

function toggleProfileMenu(ev) {
  ev.stopPropagation();
  const menu = document.getElementById('profile-menu');
  const notifMenu = document.getElementById('notif-menu');

  // Close notif menu if open
  if (notifMenu) notifMenu.classList.remove('active');

  menu.classList.toggle('active');

  if (menu.classList.contains('active')) {
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.classList.remove('active');
        document.removeEventListener('click', closeMenu);
      }
    };
    document.addEventListener('click', closeMenu);
  }
}

function closeSettingsModal() {
  closeModal();
}

function closeModal() {
  const modal = document.getElementById('modal-container');
  if (modal) modal.style.display = 'none';
  modal.innerHTML = '';
}

async function logAction(action, metadata = {}) {
  try {
    // Log to API
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action })
    });

    // Update local state (keep as string to match initApp mapping)
    userLogs.unshift(action);

    // We can also show a badge on the bell
    const dot = document.querySelector('.notif-dot');
    if (dot) dot.style.display = 'block';

    renderNotifications();
  } catch (err) {
    console.error('Failed to log action:', err);
  }
}

function openSettingsModal() {
  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeSettingsModal()">
      <div class="compare-modal" onclick="event.stopPropagation()" style="max-width: 500px;">
        <button class="modal-close" onclick="closeSettingsModal()">× Đóng</button>
        <div class="card-title" style="font-size: 20px; margin-bottom: 24px;">Cài đặt tài khoản</div>
        <div class="settings-form">
          <div class="input-field">
            <label>Họ và tên</label>
            <input type="text" id="set-fullname" value="${currentUser.full_name || ''}" placeholder="Họ và tên của bạn">
          </div>
          <div class="input-field">
            <label>Mục tiêu tài chính (Tiêu đề)</label>
            <input type="text" id="set-goal-title" value="${currentUser.goal_title || ''}" placeholder="Ví dụ: Tiết kiệm mua xe">
          </div>
          <div class="input-field">
            <label>Số tiền mục tiêu (đ)</label>
            <input type="number" id="set-goal-amount" value="${currentUser.goal_amount || 0}" placeholder="Nhập số tiền mục tiêu">
          </div>
          <div class="input-field">
            <label>Ngưỡng chi tiêu lãng phí (đ)</label>
            <input type="number" id="set-waste-threshold" value="${currentUser.waste_threshold || 0}" placeholder="Nhập số tiền bạn cho là lãng phí">
          </div>
          <div class="input-field">
            <label>Loại tài khoản</label>
            <select id="set-account-type">
              <option value="b2c" ${(currentUser.account_type || 'b2c') === 'b2c' ? 'selected' : ''}>Cá nhân (B2C)</option>
              <option value="b2b" ${['b2b', 'club', 'team'].includes(currentUser.account_type) ? 'selected' : ''}>CLB / Nhóm (B2B)</option>
            </select>
          </div>
          <button class="btn-primary" style="width: 100%; margin-top: 10px;" onclick="saveSettings()">Lưu cài đặt</button>
        </div>
      </div>
    </div>
  `;
  const modalContainer = document.getElementById('modal-container');
  if (modalContainer) modalContainer.style.display = 'block';
  refreshIcons();
}

function toggleNotifMenu(ev) {
  ev.stopPropagation();
  const menu = document.getElementById('notif-menu');
  const profileMenu = document.getElementById('profile-menu');

  // Close profile menu if open
  if (profileMenu) profileMenu.classList.remove('active');

  menu.classList.toggle('active');

  if (menu.classList.contains('active')) {
    renderNotifications();
    // Hide dot when opened
    const dot = document.querySelector('.notif-dot');
    if (dot) dot.style.display = 'none';

    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.classList.remove('active');
        document.removeEventListener('click', closeMenu);
      }
    };
    document.addEventListener('click', closeMenu);
  }
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  if (!userLogs || userLogs.length === 0) {
    list.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">Chưa có thông báo nào</div>`;
    return;
  }

  // userLogs from API is just strings, but our logAction adds objects.
  // We need to handle both for consistency.
  list.innerHTML = userLogs.slice(0, 10).map(log => {
    let action = typeof log === 'string' ? log : log.action;
    let time = typeof log === 'string' ? '' : new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    let icon = 'info';
    let text = action;

    if (action.includes('expense')) { icon = 'arrow-down-circle'; text = 'Vừa ghi nhận chi tiêu mới'; }
    else if (action.includes('income')) { icon = 'arrow-up-circle'; text = 'Vừa ghi nhận thu nhập mới'; }
    else if (action.includes('settings')) { icon = 'settings'; text = 'Đã cập nhật cài đặt tài khoản'; }
    else if (action.includes('invest')) { icon = 'zap'; text = 'Đã thực hiện rót vốn vi mô'; }
    else if (action === 'tour_completed') { icon = 'award'; text = 'Đã hoàn thành hướng dẫn'; }
    else if (action === 'tour_skipped') { icon = 'skip-forward'; text = 'Đã bỏ qua hướng dẫn'; }

    return `
      <div class="notif-item">
        <div class="notif-icon"><i data-lucide="${icon}"></i></div>
        <div class="notif-body">
          <div class="notif-text">${text}</div>
          <div class="notif-time">${time || 'Vừa xong'}</div>
        </div>
      </div>
    `;
  }).join('');

  refreshIcons();
}

async function saveSettings() {
  const fullName = document.getElementById('set-fullname')?.value?.trim() || '';
  const goalTitle = document.getElementById('set-goal-title')?.value?.trim() || '';
  const goalAmount = parseInt(document.getElementById('set-goal-amount')?.value, 10) || 0;
  const wasteThreshold = parseInt(document.getElementById('set-waste-threshold')?.value, 10) || 0;
  const newAccountType = document.getElementById('set-account-type')?.value || 'b2c';

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, goalTitle, goalAmount, wasteThreshold, accountType: newAccountType }),
    });
    if (!res.ok) throw new Error('Lỗi khi lưu cài đặt');

    const data = await res.json();

    // Cập nhật currentUser
    currentUser.full_name = fullName;
    currentUser.goal_title = goalTitle;
    currentUser.goal_amount = goalAmount;
    currentUser.waste_threshold = wasteThreshold;
    currentUser.account_type = newAccountType;

    // Cập nhật accountType global
    // [DISABLED B2B] accountType = ['b2b', 'club', 'team'].includes(newAccountType) ? 'b2b' : 'b2c';
    accountType = 'b2c'; // B2B tạm thời bị vô hiệu hóa

    // [DISABLED B2B] Cập nhật ledgerActiveTab dựa trên account type mới
    // if (accountType === 'b2b') {
    //   ledgerActiveTab = 'cashbook';
    // } else {
    //   ledgerActiveTab = 'inventory';
    // }

    closeModal();
    logAction('settings_updated');
    showToast('Đã lưu cài đặt — đang tải lại dữ liệu...', 'success');

    // IMPORTANT: Tải lại toàn bộ dữ liệu từ server
    await reloadAppData();

    // Render lại các màn hình
    renderDashboard();
    // [DISABLED]
    // if (document.getElementById('screen-ledger')?.classList.contains('active')) {
    //   await renderLedger();
    // }
    // if (document.getElementById('screen-budget')?.classList.contains('active')) {
    //   renderBudget();
    // }

  } catch (err) {
    showToast('Không thể lưu cài đặt: ' + err.message, 'error');
  }
}

// Thêm hàm mới để reload dữ liệu
async function reloadAppData() {
  try {
    const response = await fetch('/api/app');
    if (response.status === 401) {
      window.location.href = '/auth';
      return;
    }
    const data = await response.json();

    // Cập nhật toàn bộ global state
    tags = data.tags;
    pigAmount = data.pigAmount;
    pigTarget = data.pigTarget;
    transactions = data.transactions;
    budgetItems = data.budgetItems;
    projects = data.projects;
    suppliers = data.suppliers;
    suggestions = data.suggestions;
    ledgerSummary = data.ledgerSummary || ledgerSummary;
    exchangeSummary = data.exchangeSummary || exchangeSummary;
    currentUser = data.user;
    userLogs = data.logs || [];
    events = data.events || [];
    cashbookData = data.cashbook || null;
    dashboardStats = data.dashboardStats || null;

    if (data.ledgerSummary) ledgerSummary = data.ledgerSummary;

    // Reset pagination
    ledgerPage = 1;
    transactionsPage = 1;

    return data;
  } catch (err) {
    console.error('Failed to reload app data:', err);
    throw err;
  }
}

// ──────────────────────────────────────────────────────
// RENDER: DASHBOARD
// ──────────────────────────────────────────────────────

let mainChart, catChart, groupSpendChart;

function renderDashboard() {
  // Kiểm tra transactions tồn tại
  if (!transactions) transactions = [];
  if (!budgetItems) budgetItems = [];

  // [DISABLED B2B] const isB2B = accountType === 'b2b';
  const isB2B = false; // B2B tạm thời bị vô hiệu hóa
  const b2cCard = document.getElementById('b2c-cashflow-card');
  const b2bCard = document.getElementById('b2b-spend-card');
  const b2bFundSummary = document.getElementById('b2b-fund-summary');
  const catChartWrap = document.getElementById('cat-chart-wrap');
  if (b2cCard) b2cCard.style.display = isB2B ? 'none' : 'block';
  if (b2bCard) b2bCard.style.display = isB2B ? 'block' : 'none';
  if (b2bFundSummary) b2bFundSummary.style.display = isB2B ? 'block' : 'none';
  if (catChartWrap) catChartWrap.style.display = 'none';

  const streakDays = calculateTransactionStreak();
  const streakEl = document.getElementById('streak-val');
  if (streakEl) streakEl.textContent = streakDays;

  /* [DISABLED B2B]
  if (isB2B) {
    const fundBalance = ledgerSummary?.fundBalance ?? ledgerSummary?.net ?? 0;
    document.getElementById('balance-val').textContent = (fundBalance / 1000000).toFixed(2) + 'tr';
    document.getElementById('balance-val').parentElement.querySelector('.kpi-header span').textContent = 'Quỹ chung CLB';
    document.getElementById('savings-val').textContent = (ledgerSummary?.income / 1000000).toFixed(1) + 'tr';
    document.getElementById('savings-val').parentElement.querySelector('.kpi-header span').textContent = 'Tổng thu kỳ';
    const expensePct = ledgerSummary?.income > 0
      ? ((ledgerSummary.expense / ledgerSummary.income) * 100).toFixed(1)
      : '0';
    document.getElementById('ratio-val').textContent = expensePct + '%';
    document.getElementById('ratio-val').parentElement.querySelector('.kpi-header span').textContent = 'Tỷ lệ chi/thu';
    const b2bFundVal = document.getElementById('b2b-fund-val');
    if (b2bFundVal) b2bFundVal.textContent = fundBalance.toLocaleString() + '₫';
    const goalsTitle = document.getElementById('goals-card-title');
    if (goalsTitle) goalsTitle.textContent = 'Quỹ chung CLB';
    const goalsTitleSum = document.getElementById('goals-card-title-summary');
    if (goalsTitleSum) goalsTitleSum.textContent = 'Quỹ chung CLB';

    document.getElementById('pig-progress-text').textContent = 'Tồn quỹ';
    document.getElementById('pig-progress-bar').style.width = '100%';
    document.getElementById('pig-target-text').textContent = fundBalance.toLocaleString() + '₫';
    
    // Summary IDs
    const pigSumText = document.getElementById('pig-progress-text-summary');
    if (pigSumText) pigSumText.textContent = 'Tồn quỹ';
    const pigSumBar = document.getElementById('pig-progress-bar-summary');
    if (pigSumBar) pigSumBar.style.width = '100%';
    const pigSumTarget = document.getElementById('pig-target-text-summary');
    if (pigSumTarget) pigSumTarget.textContent = fundBalance.toLocaleString() + '₫';

    const co2Hint = document.getElementById('goal-co2-hint');
    const intHint = document.getElementById('goal-interest-hint');
    if (co2Hint) co2Hint.textContent = `Thu: +${(ledgerSummary?.income || 0).toLocaleString()}₫`;
    if (intHint) intHint.textContent = `Chi: -${(ledgerSummary?.expense || 0).toLocaleString()}₫`;
    if (!groupSpendChart) initCharts();
    else updateGroupSpendChart();
  } else {
  */
  {
    const totalIncome = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const balance = totalIncome - totalExpense;
    document.getElementById('balance-val').textContent = (balance / 1000000).toFixed(1) + 'tr';
    document.getElementById('balance-val').parentElement.querySelector('.kpi-header span').textContent = 'Biến động số dư';
    document.getElementById('savings-val').textContent = (pigAmount / 1000000).toFixed(2) + 'tr';
    document.getElementById('savings-val').parentElement.querySelector('.kpi-header span').textContent = 'Green Saving';
    document.getElementById('ratio-val').textContent = totalIncome > 0
      ? ((totalExpense / totalIncome) * 100).toFixed(1) + '%'
      : '0%';
    document.getElementById('ratio-val').parentElement.querySelector('.kpi-header span').textContent = 'Tỉ lệ chi phí/thu nhập';

    const goalTitle = currentUser?.goal_title || 'Tiết kiệm xanh (Green Saving)';
    const goalTitleEl = document.getElementById('goals-card-title');
    if (goalTitleEl) goalTitleEl.textContent = goalTitle;
    const goalTitleSum = document.getElementById('goals-card-title-summary');
    if (goalTitleSum) goalTitleSum.textContent = goalTitle;

    const progress = pigTarget > 0 ? (pigAmount / pigTarget) * 100 : 0;
    const progressClamped = Math.max(0, Math.min(progress, 100));
    const barColor = progressClamped >= 100 ? '#22c55e' : progressClamped >= 70 ? '#eab308' : '#22c55e';
    
    const progText = pigTarget > 0 ? `${progressClamped.toFixed(0)}%` : 'Chưa đặt mục tiêu';
    document.getElementById('pig-progress-text').textContent = progText;
    const bar = document.getElementById('pig-progress-bar');
    bar.style.width = `${progressClamped}%`;
    bar.style.background = barColor;
    const targetText = pigTarget > 0
      ? `${(pigAmount / 1000000).toFixed(1)}tr / ${(pigTarget / 1000000).toFixed(1)}tr`
      : 'Chưa đặt mục tiêu';
    document.getElementById('pig-target-text').textContent = targetText;

    // Summary IDs
    const pigSumText = document.getElementById('pig-progress-text-summary');
    if (pigSumText) pigSumText.textContent = progText;
    const pigSumBar = document.getElementById('pig-progress-bar-summary');
    if (pigSumBar) {
      pigSumBar.style.width = `${progressClamped}%`;
      pigSumBar.style.background = barColor;
    }
    const pigSumTarget = document.getElementById('pig-target-text-summary');
    if (pigSumTarget) pigSumTarget.textContent = targetText;

    const rate = 0.085;
    const co2Hint = document.getElementById('goal-co2-hint');
    const intHint = document.getElementById('goal-interest-hint');
    if (co2Hint) co2Hint.textContent = `≈ ${(pigAmount / 50000).toFixed(1)} kg CO₂ tránh phát thải`;
    if (intHint) intHint.textContent = `Lãi kỳ vọng ~${Math.round(pigAmount * rate).toLocaleString()}₫/năm (8.5%)`;
    if (!mainChart) initCharts();
    else {
      updateCharts();
      updateMiniChart();
    }
  }

  renderTransactions();
  renderTransactions('trans-list-summary', 5);
  renderTags();
}

function updateGroupSpendChart() {
  const canvas = document.getElementById('groupSpendChart');
  if (!canvas) return;
  const pie = dashboardStats?.groupSpendPie || { labels: [], data: [] };
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (!groupSpendChart) {
    groupSpendChart = new Chart(canvas.getContext('2d'), {
      type: 'pie',
      data: {
        labels: pie.labels,
        datasets: [{
          data: pie.data,
          backgroundColor: ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'Sora', size: 10 } },
          },
        },
      },
    });
  } else {
    groupSpendChart.data.labels = pie.labels;
    groupSpendChart.data.datasets[0].data = pie.data;
    groupSpendChart.update();
  }
}

function parseTransactionDate(transaction) {
  const raw = transaction.date || transaction.created_at || transaction.timestamp || transaction.time;
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') return new Date(raw);
  if (typeof raw === 'string') {
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return new Date(raw);
    const dmYMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmYMatch) return new Date(`${dmYMatch[3]}-${dmYMatch[2]}-${dmYMatch[1]}`);
    const parsed = Date.parse(raw);
    return isNaN(parsed) ? null : new Date(parsed);
  }
  return null;
}

function calculateTransactionStreak() {
  // Kiểm tra transactions tồn tại và là array
  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
    return 0;
  }

  const dateSet = new Set();
  transactions.forEach(tx => {
    const d = parseTransactionDate(tx);
    if (!d || isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dateSet.add(key);
  });
  if (dateSet.size === 0) return 0;

  const dates = [...dateSet].sort((a, b) => new Date(b) - new Date(a));
  let streak = 1;
  let current = new Date(dates[0]);
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(current);
    prev.setDate(prev.getDate() - 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
    if (dates[i] === prevKey) {
      streak += 1;
      current = prev;
    } else {
      break;
    }
  }
  return streak;
}

function renderTransactions(containerId = 'trans-list', limit = null) {
  const list = document.getElementById(containerId);
  if (!list) return;

  const totalTransactions = transactions.length;
  let pageTransactions = [];

  if (limit) {
    pageTransactions = transactions.slice(0, limit);
  } else {
    const totalPages = Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE);
    if (transactionsPage < 1) transactionsPage = 1;
    if (transactionsPage > totalPages && totalPages > 0) transactionsPage = totalPages;

    const startIdx = (transactionsPage - 1) * TRANSACTIONS_PER_PAGE;
    const endIdx = startIdx + TRANSACTIONS_PER_PAGE;
    pageTransactions = transactions.slice(startIdx, endIdx);
  }

  const transactionsHtml = pageTransactions.map(t => `
    <div class="trans-item">
      <div class="trans-icon" style="font-size: 20px;">${t.icon}</div>
      <div class="trans-info">
        <div class="trans-name-row" style="display: flex; align-items: center; justify-content: space-between;">
          <div class="trans-name">${escapeHtml(t.name)}</div>
          ${t.isWaste ? `<div class="waste-badge">! Lãng phí</div>` : ''}
        </div>
        <div class="trans-date" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 10px; color: var(--text-muted);">
          ${escapeHtml(t.tag)} 
          ${t.saved && t.savedAmt && !limit ? `<span class="badge badge-green" style="font-size: 10px;">Đã tiết kiệm ${t.savedAmt.toLocaleString()}₫</span>` : ''}
        </div>
      </div>
      <div class="trans-amount ${t.amount > 0 ? 'amount-pos' : 'amount-neg'}" style="font-weight: 700; font-family: var(--mono);">
        ${t.amount > 0 ? '+' : ''}${Math.abs(t.amount).toLocaleString()}₫
      </div>
    </div>
  `).join('');

  let paginationHtml = '';
  if (!limit) {
    const totalPages = Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE);
    if (totalPages > 1) {
      paginationHtml = `
        <div class="transactions-pagination" style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--card-border);">
          <button class="btn-ledger-outline" style="padding: 4px 12px; height: auto;" ${transactionsPage <= 1 ? 'disabled' : ''} onclick="changeTransactionsPage(${transactionsPage - 1})">
            <i data-lucide="chevron-left"></i> Trước
          </button>
          <span style="font-size: 12px; color: var(--text-dim);">Trang ${transactionsPage} / ${totalPages}</span>
          <button class="btn-ledger-outline" style="padding: 4px 12px; height: auto;" ${transactionsPage >= totalPages ? 'disabled' : ''} onclick="changeTransactionsPage(${transactionsPage + 1})">
            Sau <i data-lucide="chevron-right"></i>
          </button>
        </div>
      `;
    }
  }

  list.innerHTML = transactionsHtml + paginationHtml;
  refreshIcons();
}

function changeTransactionsPage(newPage) {
  transactionsPage = newPage;
  renderTransactions();
}

function renderTags() {
  const container = document.getElementById('qi-tags');
  if (!container) return;

  container.innerHTML = tags.map(tag => `
    <div class="tag-chip ${selectedTag === tag.id ? 'active' : ''}" 
         onclick="selectTag('${tag.id}')"
         style="--tag-color: ${tag.color}">
      ${tag.label}
    </div>
  `).join('');
}

function selectTag(id) {
  selectedTag = id;
  renderTags();
}

async function preprocessImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Resize ảnh xuống chiều rộng tối đa 1200px (vừa đủ cho OCR)
      let width = img.width;
      let height = img.height;
      const maxWidth = 1200;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Lấy dữ liệu pixel
      let imageData = ctx.getImageData(0, 0, width, height);
      let data = imageData.data;

      // Grayscale + ngưỡng cố định (tăng độ tương phản)
      const threshold = 160; // điều chỉnh từ 100-200 tùy ảnh
      for (let i = 0; i < data.length; i += 4) {
        let brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        let val = brightness > threshold ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
    };
    img.src = URL.createObjectURL(file);
  });
}

async function scanQRCode() {
  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeQRScanner()">
      <div class="compare-modal" style="max-width: 500px;" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeQRScanner()">× Đóng</button>
        <div class="card-title" style="margin-bottom: 16px;">Quét mã QR</div>
        <div id="qr-reader" style="width: 100%;"></div>
        <div id="qr-result" style="margin-top: 12px; font-size: 13px; color: var(--text-dim);"></div>
      </div>
    </div>
  `;
  refreshIcons();

  if (html5QrCode) {
    try { await html5QrCode.stop(); } catch (e) { }
  }

  html5QrCode = new Html5Qrcode('qr-reader');
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };
  try {
    await html5QrCode.start({ facingMode: 'environment' }, config, (decodedText) => {
      if (html5QrCode) {
        html5QrCode.stop().catch(() => { });
      }
      closeQRScanner();
      processQRData(decodedText);
    });
  } catch (err) {
    console.error('QR scanner error', err);
    showToast('Không thể truy cập camera');
    closeQRScanner();
  }
}

function closeQRScanner() {
  if (html5QrCode) {
    html5QrCode.stop().catch(() => { });
    html5QrCode = null;
  }
  const modal = document.getElementById('modal-container');
  if (modal) modal.innerHTML = '';
}

function processQRData(data) {
  let amount = null;
  let product = '';
  let tagId = null;

  try {
    const obj = JSON.parse(data);
    amount = obj.amount;
    product = obj.product || obj.name || '';
    tagId = obj.tag;
  } catch (e) {
    try {
      const params = new URLSearchParams(data);
      amount = parseInt(params.get('amount'));
      product = params.get('product') || params.get('name') || '';
      tagId = params.get('tag');
    } catch (innerErr) {
      console.error('QR parse error', innerErr);
    }
  }

  if (amount && !isNaN(amount)) {
    document.getElementById('qi-amount').value = amount;
  } else {
    showToast('Không tìm thấy số tiền trong QR');
    return;
  }

  if (product) {
    document.getElementById('qi-name').value = product;
  }

  if (tagId) {
    const matchedTag = tags.find(t => t.id === tagId || t.label === tagId);
    if (matchedTag) {
      selectedTag = matchedTag.id;
      renderTags();
    }
  }

  showToast(product ? `Đã điền từ QR: ${product} - ${amount.toLocaleString()}₫` : `Đã điền số tiền ${amount.toLocaleString()}₫`);
}

async function uploadReceipt() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    // Helper: upload with retries and exponential backoff
    async function uploadWithRetries(form, maxRetries = 2, baseDelay = 1000) {
      let attempt = 0;
      while (attempt <= maxRetries) {
        try {
          if (attempt === 0) showToast("📷 Đang xử lý ảnh với AI...", 'info', 0);
          else showToast(`🔁 Thử lại OCR (lần ${attempt + 1}/${maxRetries + 1})...`, 'info', 0);

          const res = await fetch('/api/ocr/receipt', { method: 'POST', body: form });

          // If client error, don't retry
          if (res.status >= 400 && res.status < 500) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
          }

          // For server errors or success, return response to caller
          return res;
        } catch (err) {
          console.error(`OCR upload attempt ${attempt + 1} failed:`, err);
          attempt++;
          if (attempt > maxRetries) throw err;
          // exponential backoff
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    try {
      const res = await uploadWithRetries(formData, 2, 1000);

      if (!res.ok) {
        const errText = await res.text();
        console.error('OCR request failed after retries:', res.status, errText);
        showToast(`Lỗi OCR: ${res.status}. ${errText.substring(0, 120)}`, 'error');
        return;
      }

      const data = await res.json();
      if (data.amount) {
        document.getElementById('qi-amount').value = data.amount;
        showToast(`💰 Nhận diện: ${data.amount.toLocaleString()}₫`, 'success');
      } else {
        showToast('⚠️ Không tìm thấy số tiền, vui lòng nhập thủ công', 'warning');
      }

      if (data.storeName) document.getElementById('qi-name').value = data.storeName;
      if (data.items && data.items.length > 0) console.log('Sản phẩm:', data.items);
    } catch (err) {
      console.error('OCR final error:', err);
      showToast('❌ Lỗi nhận diện ảnh. Vui lòng thử lại.', 'error');
    }
  };
  input.click();
}

function parseReceiptText(text) {
  let amount = null;
  let storeName = "";
  let tagId = null;

  // Làm sạch văn bản
  let cleanText = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0).map(l => l.trim());

  // 1. Tìm tên cửa hàng (loại bỏ dòng rác)
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i];
    if (line.length < 4) continue;
    if (/TEL|FAX|HOTLINE|WEBSITE|EMAIL|ĐIỆN THOẠI|GIỜ BÁN|NGÀY BÁN|THANH TOÁN|ĐỊA CHỈ|MST|SỐ|TỔNG|CỘNG|TIỀN|KHÁCH|TRẢ|THUẾ|GIÁM ĐỐC|NHÂN VIÊN|NGƯỜI MUA|CHỮ KÝ|CẢM ƠN|XIN CHÂN THÀNH|POWERED BY|JÁN|BỀN|S4|ˆ|¬|œ|®|@|©|Ø|địa chỉ|hotline/i.test(line)) continue;
    if ((line.match(/\d/g) || []).length > 5) continue;

    let cleaned = line.replace(/[^a-zA-Z0-9\sÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length < 4) continue;

    if (/COFFEE|CAFE|MART|MARKET|STORE|SHOP|TRUNG TÂM|SIÊU THỊ|CỬA HÀNG|NHÀ HÀNG|QUÁN/i.test(cleaned)) {
      storeName = cleaned;
      break;
    }
    if ((line.match(/[A-Z]{2,}/) || []).length > 0 && cleaned.length <= 50 && cleaned.split(/\s+/).length >= 2) {
      storeName = cleaned;
      break;
    }
  }
  if (!storeName && lines.length > 0) {
    let firstClean = lines[0].replace(/[^a-zA-Z0-9\sÀ-ỹ]/g, '').trim();
    if (firstClean.length > 2) storeName = firstClean;
  }

  // 2. Tìm tổng tiền (ưu tiên các dòng đặc biệt)
  const totalPatterns = [
    /Thành tiền\s*[:]?\s*([\d.,]+)/i,
    /Tổng tiền\s*[:]?\s*([\d.,]+)/i,
    /Tiền thanh toán\s*[:]?\s*([\d.,]+)/i,
    /HH\.\s*xx\s*(\d+)/i  // thêm pattern cho lỗi OCR "HH. xx 2700000"
  ];
  for (let pattern of totalPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      let numStr = match[1].replace(/\./g, '').replace(/,/g, '');
      amount = parseInt(numStr, 10);
      if (!isNaN(amount)) break;
    }
  }

  if (amount !== null && amount > 1000000) {
    // Nếu amount có thể là do đọc thừa 1 số 0 (ví dụ 2700000 -> 270000)
    if (amount % 10 === 0 && (amount / 10) < 1000000) {
      amount = amount / 10;
    }
  }

  // 3. Fallback: lấy số lớn nhất (ưu tiên số có ít nhất 5 chữ số)
  if (amount === null) {
    const allNumberStrings = cleanText.match(/\b\d{5,}\b/g); // số từ 5 chữ số trở lên
    if (allNumberStrings) {
      let maxNum = 0;
      for (let numStr of allNumberStrings) {
        let num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxNum && num < 1e9) maxNum = num;
      }
      if (maxNum > 0) amount = maxNum;
    }
  }

  // 4. Gợi ý tag
  const combined = (storeName + " " + cleanText).toLowerCase();
  if (combined.includes('cà phê') || combined.includes('cafe') || combined.includes('trà')) tagId = 'food';
  else if (combined.includes('siêu thị') || combined.includes('mart') || combined.includes('market')) tagId = 'food';
  else if (combined.includes('nhựa')) tagId = 'plastic';
  else if (combined.includes('xe buýt') || combined.includes('taxi') || combined.includes('grab') || combined.includes('xăng')) tagId = 'transport';
  else if (combined.includes('rau') || combined.includes('hữu cơ')) tagId = 'eco';

  return { amount, storeName, tagId };
}

function buildCashflowChartData() {
  const inByDay = {};
  const outByDay = {};
  transactions.forEach((t) => {
    const d = parseTransactionDate(t);
    if (!d) return;
    const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (t.amount > 0) inByDay[key] = (inByDay[key] || 0) + t.amount / 1000;
    else outByDay[key] = (outByDay[key] || 0) + Math.abs(t.amount) / 1000;
  });
  const labels = [...new Set([...Object.keys(inByDay), ...Object.keys(outByDay)])].sort();
  if (labels.length === 0) {
    return {
      labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
      inData: [0, 0, 0, 0],
      outData: [0, 0, 0, 0],
    };
  }
  return {
    labels,
    inData: labels.map((l) => inByDay[l] || 0),
    outData: labels.map((l) => outByDay[l] || 0),
  };
}

let miniChart;

function initCharts() {
  if (accountType === 'b2b') {
    updateGroupSpendChart();
    return;
  }
  const mainCanvas = document.getElementById('mainChart');
  if (!mainCanvas) return;
  const ctx = mainCanvas.getContext('2d');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const flow = buildCashflowChartData();

  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: flow.labels,
      datasets: [
        {
          label: 'Tiền vào',
          data: flow.inData,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 3,
        },
        {
          label: 'Tiền ra',
          data: flow.outData,
          borderColor: '#eab308',
          backgroundColor: 'rgba(234, 179, 8, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
          ticks: { color: isDark ? '#64748b' : '#94a3b8', font: { family: 'Sora' }, callback: (v) => v + 'k' },
        },
        x: {
          grid: { display: false },
          ticks: { color: isDark ? '#64748b' : '#94a3b8', font: { family: 'Sora' } },
        },
      },
    },
  });

  initMiniChart();
}

function initMiniChart() {
  const miniCanvas = document.getElementById('miniChart');
  if (!miniCanvas) return;
  const ctx = miniCanvas.getContext('2d');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const flow = buildCashflowChartData();

  // Chỉ lấy 7 ngày gần nhất cho mini chart
  const limit = 7;
  const miniLabels = flow.labels.slice(-limit);
  const miniInData = flow.inData.slice(-limit);
  const miniOutData = flow.outData.slice(-limit);

  miniChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: miniLabels,
      datasets: [
        {
          label: 'Thu',
          data: miniInData,
          backgroundColor: '#8b5cf6',
          borderRadius: 4,
        },
        {
          label: 'Chi',
          data: miniOutData,
          backgroundColor: '#eab308',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { display: false },
        x: {
          grid: { display: false },
          ticks: { color: isDark ? '#64748b' : '#94a3b8', font: { family: 'Sora', size: 9 } },
        },
      },
    },
  });
}

function updateMiniChart() {
  if (!miniChart) {
    initMiniChart();
    return;
  }
  const flow = buildCashflowChartData();
  const limit = 7;
  miniChart.data.labels = flow.labels.slice(-limit);
  miniChart.data.datasets[0].data = flow.inData.slice(-limit);
  miniChart.data.datasets[1].data = flow.outData.slice(-limit);
  miniChart.update();
}

function updateCharts() {
  // [DISABLED B2B]
  // if (accountType === 'b2b') {
  //   updateGroupSpendChart();
  //   return;
  // }
  if (!mainChart) return;
  const flow = buildCashflowChartData();
  mainChart.data.labels = flow.labels;
  mainChart.data.datasets[0].data = flow.inData;
  mainChart.data.datasets[1].data = flow.outData;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  mainChart.options.scales.y.grid.color = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  mainChart.options.scales.y.ticks.color = isDark ? '#64748b' : '#94a3b8';
  mainChart.options.scales.x.ticks.color = isDark ? '#64748b' : '#94a3b8';
  mainChart.update();
}

// ──────────────────────────────────────────────────────
// LEDGER (Sổ hạch toán & Quản lý hàng hóa)
// Tính năng chính: Quản lý gán lô FIFO, tính COGS, quản lý nợ NCC
// Tính năng B2B: Tích hợp Sổ quỹ (Cashbook) và Báo cáo lưu chuyển tiền tệ
// ──────────────────────────────────────────────────────
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LEDGER_PAGE_SIZE = 5;
let ledgerPage = 1;

/* [DISABLED] ledger bị vô hiệu hóa
function ledgerChangePage(nextPage) {
  ledgerPage = Math.max(1, nextPage);
  void renderLedger();
}
*/

/* [DISABLED] ledger bị vô hiệu hóa
async function submitLedgerAdd(ev) {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const fifo = [];
  const pushFifo = (batchKey, qtyKey, priceKey) => {
    const batch = (fd.get(batchKey) || '').trim();
    const q = fd.get(qtyKey);
    const p = fd.get(priceKey);
    if (batch && q !== '' && q !== null && p !== '' && p !== null) {
      fifo.push({ batch, qty: parseInt(q, 10), price: parseInt(p, 10) });
    }
  };
  pushFifo('fifo_batch_1', 'fifo_qty_1', 'fifo_price_1');
  pushFifo('fifo_batch_2', 'fifo_qty_2', 'fifo_price_2');

  const body = {
    date: (fd.get('date') || '').trim(),
    desc: (fd.get('desc') || '').trim(),
    cat: (fd.get('cat') || '').trim(),
    qty: parseInt(fd.get('qty'), 10),
    price: parseInt(fd.get('price'), 10),
    cogs: parseInt(fd.get('cogs'), 10),
    partner: (fd.get('partner') || '').trim(),
    esg: (fd.get('esg') || 'A').trim(),
    paid: fd.get('paid') === 'on',
    pageSize: LEDGER_PAGE_SIZE,
  };
  if (fifo.length > 0) body.fifo = fifo;

  try {
    const res = await fetch('/api/ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) {
      showToast(j.error || 'Không lưu được');
      return;
    }
    ledgerPage = j.page;
    closeModal();
    showToast('Đã lưu dòng mới');
    await renderLedger();
  } catch (e) {
    showToast('Lỗi mạng hoặc máy chủ');
  }
}
*/

/* [DISABLED] ledger bị vô hiệu hóa
function openLedgerAddModal() {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="compare-modal ledger-add-modal" onclick="event.stopPropagation()">
        <button type="button" class="modal-close" onclick="closeModal()">× Đóng</button>
        <div class="card-title" style="font-size:18px;margin-bottom:20px;">Thêm dòng hạch toán</div>
        <form id="ledger-add-form" onsubmit="submitLedgerAdd(event)">
          <div class="ledger-form-grid">
            <div class="ledger-form-field">
              <label>Ngày</label>
              <input name="date" required placeholder="vd. 20/05" autocomplete="off">
            </div>
            <div class="ledger-form-field">
              <label>Khoản mục</label>
              <input name="cat" required placeholder="vd. Bao bì sinh thái" autocomplete="off">
            </div>
            <div class="ledger-form-field ledger-form-field-full">
              <label>Diễn giải</label>
              <input name="desc" required placeholder="Mô tả giao dịch" autocomplete="off">
            </div>
            <div class="ledger-form-field">
              <label>Số lượng</label>
              <input name="qty" type="number" min="1" step="1" required placeholder="500">
            </div>
            <div class="ledger-form-field">
              <label>Đơn giá (đ)</label>
              <input name="price" type="number" min="0" step="1" required placeholder="3200">
            </div>
            <div class="ledger-form-field">
              <label>COGS / FIFO gộp (đ)</label>
              <input name="cogs" type="number" min="0" step="1" required placeholder="3200">
            </div>
            <div class="ledger-form-field">
              <label>Nhà cung cấp (Danh bạ)</label>
              <select name="partner" required onchange="onSupplierSelectChange(this)">
                <option value="">— Chọn NCC —</option>
                ${suppliers.map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)} · ESG ${s.esg}</option>`).join('')}
              </select>
            </div>
            <div class="ledger-form-field">
              <label>ESG</label>
              <select name="esg">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
            <div class="ledger-form-field ledger-form-field-inline">
              <label class="ledger-checkbox-label">
                <input type="checkbox" name="paid"> Đã thanh toán
              </label>
            </div>
          </div>

          <div class="ledger-fifo-block">
            <div class="summary-title" style="margin:16px 0 12px;font-size:11px;">Chi tiết FIFO (tuỳ chọn — để trống sẽ dùng 1 lô theo SL & COGS)</div>
            <div class="ledger-fifo-row">
              <div class="ledger-form-field"><label>Lô 1 — Tên lô</label><input name="fifo_batch_1" placeholder="Lô T1"></div>
              <div class="ledger-form-field"><label>SL lô 1</label><input name="fifo_qty_1" type="number" min="1" step="1" placeholder=""></div>
              <div class="ledger-form-field"><label>Giá lô 1 (đ)</label><input name="fifo_price_1" type="number" min="0" step="1" placeholder=""></div>
            </div>
            <div class="ledger-fifo-row">
              <div class="ledger-form-field"><label>Lô 2 — Tên lô</label><input name="fifo_batch_2" placeholder="Lô T2"></div>
              <div class="ledger-form-field"><label>SL lô 2</label><input name="fifo_qty_2" type="number" min="1" step="1"></div>
              <div class="ledger-form-field"><label>Giá lô 2 (đ)</label><input name="fifo_price_2" type="number" min="0" step="1"></div>
            </div>
          </div>

          <div class="ledger-form-actions">
            <button type="button" class="btn-ledger-outline" onclick="closeModal()">Huỷ</button>
            <button type="submit" class="btn-ledger-primary">Lưu vào sổ</button>
          </div>
        </form>
      </div>
    </div>`;
  refreshIcons();
}
*/

// ──────────────────────────────────────────────────────
// RENDER: LEDGER (Sổ hạch toán)
// ──────────────────────────────────────────────────────

/* [DISABLED] ledger bị vô hiệu hóa
function switchLedgerTab(tab) {
  ledgerActiveTab = tab;
  void renderLedger();
}
*/

/* [DISABLED] cashbook bị vô hiệu hóa
async function loadCashbookData() {
  const q = new URLSearchParams();
  if (cashbookFilter.type) q.set('type', cashbookFilter.type);
  if (cashbookFilter.tag) q.set('tag', cashbookFilter.tag);
  if (cashbookFilter.period) q.set('period', cashbookFilter.period);
  const res = await fetch(`/api/cashbook?${q.toString()}`);
  if (!res.ok) throw new Error('Không tải sổ quỹ');
  return res.json();
}
*/

/* [DISABLED] Sổ hạch toán bị tạm vô hiệu hóa
async function renderLedger() {
  const container = document.getElementById('screen-ledger');
  if (!container) return;
  container.innerHTML = `
    <div class="ledger-container">
      <div class="ledger-loading">Đang tải sổ hạch toán…</div>
    </div>`;

  let data;
  let cashbook = cashbookData;
  try {
    if (accountType === 'b2b') {
      cashbook = await loadCashbookData();
      cashbookData = cashbook;
      if (cashbook.totals) {
        ledgerSummary = {
          income: cashbook.totals.income,
          expense: cashbook.totals.expense,
          net: cashbook.totals.fundBalance,
          fundBalance: cashbook.totals.fundBalance,
          assets: ledgerSummary?.assets || 0,
          liabilities: ledgerSummary?.liabilities || 0,
          equity: ledgerSummary?.equity || 0,
        };
      }
    }
    const res = await fetch(`/api/ledger?page=${ledgerPage}&limit=${LEDGER_PAGE_SIZE}&search=${encodeURIComponent(ledgerSearchQuery)}`);
    if (!res.ok) throw new Error((await res.text()) || res.statusText);
    data = await res.json();
    ledgerPage = data.page;
    if (data.summary) ledgerSummary = data.summary;
  } catch (e) {
    container.innerHTML = `
      <div class="ledger-container">
        <p class="ledger-error-msg">Không tải được dữ liệu từ máy chủ. Hãy chạy <code>npm start</code> và thử lại.</p>
      </div>`;
    return;
  }

  const rows = data.rows || [];
  const summary = ledgerSummary || data.summary || {
    income: 0,
    expense: 0,
    net: 0,
    assets: 0,
    liabilities: 0,
    equity: 0,
  };
  const page = data.page || 1;
  const totalPages = data.totalPages || 1;
  const total = data.total ?? 0;

  const paginationHtml =
    totalPages > 1
      ? `
    <div class="ledger-pagination">
      <button type="button" class="btn-ledger-outline" ${page <= 1 ? 'disabled' : ''} onclick="ledgerChangePage(${page - 1})">← Trước</button>
      <span class="ledger-page-info">Trang <strong>${page}</strong> / ${totalPages} <span class="ledger-page-muted">(${total} dòng)</span></span>
      <button type="button" class="btn-ledger-outline" ${page >= totalPages ? 'disabled' : ''} onclick="ledgerChangePage(${page + 1})">Sau →</button>
    </div>`
      : total > 0
        ? `<div class="ledger-pagination ledger-pagination-min"><span class="ledger-page-muted">${total} dòng trong sổ</span></div>`
        : '';

  const rowsHtml =
    rows.length === 0
      ? `<tr><td colspan="8" class="ledger-empty-cell">Chưa có dòng nào. Nhấn <strong>Thêm dòng</strong> để nhập.</td></tr>`
      : rows
        .map((l) => {
          const fifoHint =
            l.fifo && l.fifo.length
              ? `${l.fifo.length} lô FIFO`
              : '';
          const fifoTitle = (l.fifo || [])
            .map((f) => `${f.batch}: ${f.qty} × ${Number(f.price).toLocaleString()}đ`)
            .join(' · ');
          return `
            <tr data-ledger-id="${l.id != null ? l.id : ''}" data-ledger-amount="${Number(l.qty) * Number(l.cogs)}" data-ledger-desc="${escapeHtml(l.desc)}" data-ledger-partner="${escapeHtml(l.partner)}">
              <td>${escapeHtml(l.date)}</td>
              <td>
                <div class="td-desc">
                  <span class="desc-main">${escapeHtml(l.desc)}</span>
                  <span class="desc-sub">${escapeHtml(l.cat)}</span>
                </div>
               </td>
              <td><span class="badge-pill">${escapeHtml(l.cat)}</span></td>
              <td class="val-bold">${Number(l.qty).toLocaleString()}</td>
              <td class="val-bold">${Number(l.price).toLocaleString()}đ</td>
              <td>
                <div class="val-gold">${Number(l.cogs).toLocaleString()}đ <i data-lucide="lock" style="width: 10px; height: 10px;"></i></div>
                <div class="fifo-history"${fifoTitle ? ` title="${escapeHtml(fifoTitle)}"` : ''}>▼ ${fifoHint || 'Xem lịch sử FIFO'}</div>
               </td>
              <td>
                <div class="td-desc">
                  <span class="desc-main">${escapeHtml(l.partner)}</span>
                  <span class="badge-pill" style="padding: 2px 8px; font-size: 9px; width: fit-content; background: rgba(234, 179, 8, 0.1); color: var(--ledger-accent);">ESG ${escapeHtml(l.esg)}</span>
                </div>
               </td>
              <td>
                <button type="button" class="btn-pay ${l.paid ? 'success' : 'pending'}" ${l.paid ? 'disabled' : ''} onclick="openLedgerPayModalFromRow(${l.id})">
                  <i data-lucide="${l.paid ? 'check' : 'credit-card'}"></i>
                  ${l.paid ? 'Đã thanh toán' : 'Thanh toán'}
                </button>
               </td>
             </tr>`;
        })
        .join('');

  const cashbookEntries = cashbook?.entries || [];
  const cashbookTotals = cashbook?.totals || { income: 0, expense: 0, fundBalance: 0 };
  const cashbookRowsHtml = cashbookEntries.length === 0
    ? `<tr><td colspan="8" class="ledger-empty-cell">Chưa có giao dịch sổ quỹ.</td></tr>`
    : cashbookEntries.map((e) => `
      <tr>
        <td>${escapeHtml(e.date)}</td>
        <td><span class="badge-pill ${e.type === 'THU' ? 'badge-green' : 'badge-amber'}">${e.type}</span></td>
        <td>${escapeHtml(e.categoryTag)}</td>
        <td class="val-bold">${Number(e.amount).toLocaleString()}₫</td>
        <td>${escapeHtml(e.description)}</td>
        <td>${e.proofDocument ? '<i data-lucide="file-check"></i>' : '—'}</td>
        <td class="val-bold fund-balance-col">${Number(e.balanceAfter).toLocaleString()}₫</td>
       </tr>`).join('');

  const tabBar = accountType === 'b2b' ? `
    <!-- Tabs dành riêng cho B2B: Sổ quỹ Thu/Chi và Quản lý Hàng hóa FIFO -->
    <div class="ledger-tabs">
      <button type="button" class="ledger-tab ${ledgerActiveTab === 'cashbook' ? 'active' : ''}" onclick="switchLedgerTab('cashbook')">Sổ quỹ (Thu-Chi-Tồn)</button>
      <button type="button" class="ledger-tab ${ledgerActiveTab === 'inventory' ? 'active' : ''}" onclick="switchLedgerTab('inventory')">Hàng hóa & FIFO</button>
    </div>` : '';

  const cashbookPanel = accountType === 'b2b' && ledgerActiveTab === 'cashbook' ? `
    <div class="cashbook-summary-cards">
      <div class="cashbook-card cashbook-thu">
        <div class="cashbook-card-label">Tổng Thu</div>
        <div class="cashbook-card-value">+${cashbookTotals.income.toLocaleString()}₫</div>
      </div>
      <div class="cashbook-card cashbook-chi">
        <div class="cashbook-card-label">Tổng Chi</div>
        <div class="cashbook-card-value">-${cashbookTotals.expense.toLocaleString()}₫</div>
      </div>
      <div class="cashbook-card cashbook-ton">
        <div class="cashbook-card-label">Tồn quỹ hiện tại</div>
        <div class="cashbook-card-value">${cashbookTotals.fundBalance.toLocaleString()}₫</div>
      </div>
    </div>
    <div class="cashbook-filters">
      <select id="cb-filter-type" onchange="updateCashbookFilter('type', this.value)">
        <option value="">Tất cả Thu/Chi</option>
        <option value="THU" ${cashbookFilter.type === 'THU' ? 'selected' : ''}>Thu</option>
        <option value="CHI" ${cashbookFilter.type === 'CHI' ? 'selected' : ''}>Chi</option>
      </select>
      <input type="text" placeholder="Lọc tháng (vd. 04)" value="${escapeHtml(cashbookFilter.period)}" onchange="updateCashbookFilter('period', this.value)">
      <button type="button" class="btn-ledger-primary" onclick="openCashbookAddModal()"><i data-lucide="plus"></i> Ghi sổ quỹ</button>
      <button type="button" class="btn-ledger-outline" onclick="exportCashbookReport()"><i data-lucide="download"></i> Xuất Excel/CSV</button>
    </div>
    <div class="ledger-card-table">
      <table class="ledger-table cashbook-table">
        <thead>
          <tr>
            <th>Ngày</th><th>Loại</th><th>Nhãn</th><th>Số tiền</th><th>Nội dung</th><th>Minh chứng</th><th>Tồn quỹ</th>
           </tr>
        </thead>
        <tbody>${cashbookRowsHtml}</tbody>
       </table>
    </div>` : '';

  const inventoryPanel = ledgerActiveTab !== 'cashbook' || accountType !== 'b2b' ? `
      <div class="ledger-card-table">
        <table class="ledger-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Diễn giải</th>
              <th>Khoản mục</th>
              <th>SL</th>
              <th>Đơn giá</th>
              <th>COGS (FIFO) <i data-lucide="lock" style="width: 12px; height: 12px;"></i></th>
              <th>Đối tác</th>
              <th>Thanh toán</th>
             </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        ${paginationHtml}
      </div>` : '';

  container.innerHTML = `
    <div class="ledger-container">
      <div class="ledger-toolbar">
        <div class="ledger-search">
          <i data-lucide="search" style="color: var(--text-muted);"></i>
          <input type="text" id="ledger-search-input" placeholder="Tìm kiếm hàng hóa, đối tác..." value="${ledgerSearchQuery}" oninput="updateLedgerSearch(this.value)">
        </div>
        <button type="button" class="btn-ledger-outline" onclick="exportLedgerReport()">
          <i data-lucide="file-text"></i>
          Trích xuất báo cáo
        </button>
        <button type="button" class="btn-ledger-primary" onclick="openLedgerAddModal()">
          <i data-lucide="plus"></i>
          Thêm dòng
        </button>
      </div>
      ${tabBar}
      ${cashbookPanel}
      ${inventoryPanel}

      <div class="ledger-summary-grid">
        <div class="summary-card">
          <div class="summary-title">BÁO CÁO LƯU CHUYỂN TIỀN TỆ</div>
          <div class="summary-row">
            <span class="summary-label">Dòng tiền thu</span>
            <span class="summary-val pos">+${summary.income.toLocaleString()}đ</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Dòng tiền chi</span>
            <span class="summary-val neg">-${summary.expense.toLocaleString()}đ</span>
          </div>
          <div class="summary-row">
            <span class="summary-label" style="font-weight: 800;">Tồn quỹ hiện tại</span>
            <span class="summary-val pos large">${(summary.fundBalance ?? summary.net).toLocaleString()}đ</span>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-title">BẢNG CÂN ĐỐI KẾ TOÁN</div>
          <div class="summary-row">
            <span class="summary-label">Tổng tài sản</span>
            <span class="summary-val">${summary.assets.toLocaleString()}đ</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Tổng nợ phải trả</span>
            <span class="summary-val">${summary.liabilities.toLocaleString()}đ</span>
          </div>
          <div class="summary-row">
            <span class="summary-label" style="font-weight: 800;">Vốn chủ sở hữu</span>
            <span class="summary-val pos large">${summary.equity.toLocaleString()}đ</span>
          </div>
        </div>
      </div>
    </div>
  `;
  refreshIcons();
}
*/

/* [DISABLED] ledger bị vô hiệu hóa
function updateLedgerSearch(val) {
  ledgerSearchQuery = val;
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    ledgerPage = 1;
    renderLedger();
  }, 400);
}
*/

/* [DISABLED] cashbook bị vô hiệu hóa
function updateCashbookFilter(key, val) {
  cashbookFilter[key] = val;
  void renderLedger();
}
*/

/* [DISABLED] ledger bị vô hiệu hóa
function parseSupplierUnitPrice(priceStr) {
  const m = String(priceStr || '').replace(/[^\d]/g, '');
  return parseInt(m, 10) || 0;
}

function onSupplierSelectChange(selectEl) {
  const name = selectEl.value;
  const s = suppliers.find((x) => x.name === name);
  if (!s) return;
  const form = document.getElementById('ledger-add-form');
  if (!form) return;
  const retail = parseSupplierUnitPrice(s.price1);
  const wholesale = parseSupplierUnitPrice(s.price2);
  const partnerInput = form.querySelector('[name="partner"]');
  const priceInput = form.querySelector('[name="price"]');
  const cogsInput = form.querySelector('[name="cogs"]');
  const esgSelect = form.querySelector('[name="esg"]');
  if (partnerInput) partnerInput.value = s.name;
  if (priceInput) priceInput.value = retail;
  if (cogsInput) cogsInput.value = wholesale || retail;
  if (esgSelect) esgSelect.value = s.esg;
  const qty = parseInt(form.querySelector('[name="qty"]')?.value, 10) || 1;
  const fifoPrice1 = form.querySelector('[name="fifo_price_1"]');
  const fifoQty1 = form.querySelector('[name="fifo_qty_1"]');
  const fifoBatch1 = form.querySelector('[name="fifo_batch_1"]');
  if (fifoPrice1) fifoPrice1.value = wholesale || retail;
  if (fifoQty1) fifoQty1.value = qty;
  if (fifoBatch1) fifoBatch1.value = 'Lô NCC';
}
*/

/* [DISABLED] B2B bị vô hiệu hóa
async function runExpensePrecheck({ amount, eventId, categoryKey, type }) {
  const res = await fetch('/api/expense/precheck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      eventId: eventId || undefined,
      categoryKey: categoryKey || undefined,
      type: type || 'CHI',
    }),
  });
  return res.json();
}
*/

/* [DISABLED] B2B bị vô hiệu hóa
/* [DISABLED] B2B bị vô hiệu hóa
function handleExpensePrecheckFailure(check, pendingAction) {
  pendingExpenseAction = pendingAction;
  if (check.needsBackup && check.eventId) {
    showToast('Cần Quỹ Backup trước khi chi', 'warning');
    openEventBackupModal(check.eventId, check.projectedRemaining);
    return;
  }
  if (check.needsDualApproval) {
    openDualApprovalModal(pendingAction, check);
    return;
  }
  showToast(check.message || 'Chi tiêu bị chặn bởi Smart CFO', 'error');
}
*/

/* [DISABLED] B2B bị vô hiệu hóa
async function retryPendingExpense() {
  if (!pendingExpenseAction) return;
  const action = { ...pendingExpenseAction };
  pendingExpenseAction = null;
  if (action.type === 'cashbook') {
    const fakeEv = { preventDefault: () => { }, target: action.form };
    await submitCashbookAdd(fakeEv, false);
  } else if (action.type === 'ledgerPay') {
    await executeLedgerPay(action.ledgerRowId, {
      ...action.body,
      approvalId: action.approvalId,
    });
  }
}
*/

/* [DISABLED] B2B bị vô hiệu hóa
function openDualApprovalModal(pendingAction, check) {
  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="compare-modal" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeModal()">× Đóng</button>
        <div class="card-title">Xác nhận kép — Smart CFO</div>
        <p class="tpn-message">${escapeHtml(check.message || 'Tồn quỹ không đủ sau khi chi. Cần 2 người duyệt.')}</p>
        <p class="tpn-impact-preview">Số tiền: <strong>${pendingAction.amount.toLocaleString()}₫</strong></p>
        <div id="dual-approval-status" class="tpn-impact-preview">Chưa tạo phiếu duyệt</div>
        <div class="nudge-actions" style="flex-direction:column;gap:10px;margin-top:16px;">
          <button type="button" class="btn-nudge-confirm" id="btn-create-approval">1. Tạo phiếu duyệt</button>
          <button type="button" class="btn-ledger-outline" id="btn-sign-treasurer" disabled>2a. Thủ quỹ xác nhận</button>
          <button type="button" class="btn-ledger-outline" id="btn-sign-lead" disabled>2b. Trưởng ban xác nhận</button>
          <button type="button" class="btn-ledger-primary" id="btn-confirm-after-approval" disabled>3. Xác nhận chi tiền</button>
        </div>
      </div>
    </div>`;
  modal.style.display = 'block';

  let approvalId = null;

  document.getElementById('btn-create-approval').onclick = async () => {
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: pendingAction.amount,
          eventId: pendingAction.eventId,
          description: pendingAction.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      approvalId = data.approval.id;
      document.getElementById('dual-approval-status').textContent = `Phiếu #${approvalId} — chờ 2/2 duyệt`;
      document.getElementById('btn-sign-treasurer').disabled = false;
      document.getElementById('btn-sign-lead').disabled = false;
      showToast('Đã tạo phiếu duyệt', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const sign = async (label) => {
    if (!approvalId) {
      showToast('Tạo phiếu duyệt trước', 'error');
      return;
    }
    const res = await fetch(`/api/approvals/${approvalId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signerLabel: label }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('dual-approval-status').textContent =
      `Phiếu #${approvalId}: ${data.approval.approver1 || '—'} + ${data.approval.approver2 || '—'} (${data.approval.status})`;
    if (data.approval.status === 'approved') {
      document.getElementById('btn-confirm-after-approval').disabled = false;
      pendingAction.approvalId = approvalId;
      showToast('Đủ 2/2 duyệt — có thể chi', 'success');
    }
  };

  document.getElementById('btn-sign-treasurer').onclick = () => sign('Thủ quỹ CLB');
  document.getElementById('btn-sign-lead').onclick = () => sign('Trưởng ban điều hành');
  document.getElementById('btn-confirm-after-approval').onclick = async () => {
    const aid = approvalId;
    closeModal();
    pendingExpenseAction = { ...pendingAction, approvalId: aid };
    await retryPendingExpense();
  };
}
*/

/* [DISABLED] cashbook bị vô hiệu hóa
async function updateCashbookPrecheckHint() {
  const form = document.getElementById('cashbook-add-form');
  const hint = document.getElementById('cb-precheck-hint');
  if (!form || !hint) return;
  const amount = parseInt(form.querySelector('[name="amount"]')?.value, 10);
  const type = form.querySelector('[name="type"]')?.value || 'CHI';
  const eventId = form.querySelector('[name="eventId"]')?.value;
  if (!amount || amount <= 0) {
    hint.textContent = '';
    return;
  }
  if (type === 'THU') {
    hint.textContent = '✓ Thu — không cần duyệt sự kiện';
    hint.style.color = '#22c55e';
    return;
  }
  try {
    const check = await runExpensePrecheck({ amount, eventId, type: 'CHI' });
    if (check.allowed) {
      hint.textContent = `✓ ${check.message}${check.warnings?.length ? ' · ' + check.warnings.join('; ') : ''}`;
      hint.style.color = '#22c55e';
    } else {
      hint.textContent = `⚠ ${check.message}`;
      hint.style.color = '#ef4444';
    }
  } catch (_) {
    hint.textContent = '';
  }
}
*/

/* [DISABLED] cashbook bị vô hiệu hóa
function openCashbookAddModal() {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="compare-modal ledger-add-modal" onclick="event.stopPropagation()">
        <button type="button" class="modal-close" onclick="closeModal()">× Đóng</button>
        <div class="card-title" style="font-size:18px;margin-bottom:20px;">Ghi sổ quỹ (Open Banking)</div>
        <form id="cashbook-add-form" onsubmit="submitCashbookAdd(event)">
          <div class="ledger-form-grid">
            <div class="ledger-form-field"><label>Ngày</label><input name="date" required placeholder="20/05/2026"></div>
            <div class="ledger-form-field"><label>Số tiền (đ)</label><input name="amount" type="number" min="1" required oninput="updateCashbookPrecheckHint()"></div>
            <div class="ledger-form-field ledger-form-field-full">
              <label>Nội dung CK (tự phân loại)</label>
              <input name="description" required placeholder="VD: NOP QUY, CHI QUY..." oninput="previewCashbookClassify(this.value); updateCashbookPrecheckHint()">
            </div>
            <div class="ledger-form-field ledger-form-field-full" id="cb-classify-preview" style="font-size:12px;color:var(--text-muted);"></div>
            <div class="ledger-form-field ledger-form-field-full" id="cb-precheck-hint" class="tpn-impact-preview" style="margin:0;"></div>
            <div class="ledger-form-field"><label>Loại (tuỳ chọn)</label>
              <select name="type" onchange="updateCashbookPrecheckHint()"><option value="">Tự động</option><option value="THU">THU</option><option value="CHI">CHI</option></select>
            </div>
            <div class="ledger-form-field ledger-form-field-full">
              <label>Minh chứng (bắt buộc nếu CHI)</label>
              <input name="proofDocument" placeholder="URL hoặc tên file UNC">
            </div>
          </div>
          <div class="ledger-form-actions">
            <button type="button" class="btn-ledger-outline" onclick="closeModal()">Huỷ</button>
            <button type="submit" class="btn-ledger-primary" id="btn-cashbook-submit">Lưu sổ quỹ</button>
          </div>
        </form>
      </div>
    </div>`;
  refreshIcons();
}
*/

/* [DISABLED] ledger bị vô hiệu hóa
function openLedgerPayModalFromRow(ledgerRowId) {
  const tr = document.querySelector(`tr[data-ledger-id="${ledgerRowId}"]`);
  if (!tr) return;
  const amount = parseInt(tr.dataset.ledgerAmount, 10);
  const desc = tr.dataset.ledgerDesc || '';
  const partner = tr.dataset.ledgerPartner || '';
  openLedgerPayModal(ledgerRowId, amount, desc, partner);
}

function openLedgerPayModal(ledgerRowId, amount, desc, partner) {
  return;
  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="compare-modal ledger-add-modal" onclick="event.stopPropagation()">
        <button type="button" class="modal-close" onclick="closeModal()">× Đóng</button>
        <div class="card-title">Thanh toán hàng hóa</div>
        <p class="tpn-message">${escapeHtml(desc)} · ${escapeHtml(partner)}</p>
        <p class="tpn-impact-preview">Số tiền: <strong>${Number(amount).toLocaleString()}₫</strong></p>
        <div id="pay-precheck-hint" class="tpn-impact-preview"></div>
        <div class="ledger-form-field" style="margin-top:12px;">
          <label>Minh chứng UNC</label>
          <input id="pay-proof" placeholder="Tên file hoặc URL" value="unc-${ledgerRowId}.pdf">
        </div>
        <div class="ledger-form-actions">
          <button type="button" class="btn-ledger-outline" onclick="closeModal()">Huỷ</button>
          <button type="button" class="btn-ledger-primary" id="btn-confirm-ledger-pay">Xác nhận thanh toán</button>
        </div>
      </div>
    </div>`;
  modal.style.display = 'block';
  refreshIcons();

  const refreshHint = async () => {
    const check = await runExpensePrecheck({ amount, type: 'CHI' });
    const hint = document.getElementById('pay-precheck-hint');
    if (!hint) return;
    if (check.allowed) {
      hint.textContent = `✓ ${check.message}`;
      hint.style.color = '#22c55e';
    } else {
      hint.textContent = `⚠ ${check.message}`;
      hint.style.color = '#ef4444';
    }
  };
  refreshHint();

  document.getElementById('btn-confirm-ledger-pay').onclick = () => {
    executeLedgerPay(ledgerRowId, {
      proofDocument: document.getElementById('pay-proof').value,
      description: `CHI QUY thanh toan ${desc} - ${partner}`,
      amount,
    });
  };
}

async function executeLedgerPay(ledgerRowId, body) {
  return;
  try {
    const res = await fetch(`/api/ledger/${ledgerRowId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proofDocument: body.proofDocument,
        description: body.description,
        approvalId: body.approvalId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.precheck) {
        handleExpensePrecheckFailure(data.precheck, {
          type: 'ledgerPay',
          ledgerRowId,
          amount: body.amount,
          description: body.description,
          body,
        });
        return;
      }
      throw new Error(data.error);
    }
    cashbookData = data.cashbook;
    ledgerSummary = data.ledgerSummary;
    closeModal();
    showToast('Đã thanh toán & ghi sổ quỹ', 'success');
    renderLedger();
    renderBudget();
    renderDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
*/

/* [DISABLED] cashbook bị vô hiệu hóa
async function previewCashbookClassify(desc) {
  return;
  const el = document.getElementById('cb-classify-preview');
  if (!el || !desc || desc.length < 4) return;
  try {
    const res = await fetch('/api/cashbook/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc }),
    });
    const data = await res.json();
    el.textContent = `→ ${data.type} · ${data.category}`;
  } catch (_) { // ignore }
}
*/

/* [DISABLED] cashbook bị vô hiệu hóa
async function submitCashbookAdd(ev, forceAfterApproval = false) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const body = {
    date: fd.get('date'),
    amount: parseInt(fd.get('amount'), 10),
    description: fd.get('description'),
    type: fd.get('type') || undefined,
    proofDocument: fd.get('proofDocument') || undefined,
    approvalId: pendingExpenseAction?.approvalId,
  };

  const effectiveType = body.type || 'CHI';
  if (!forceAfterApproval && effectiveType !== 'THU') {
    const check = await runExpensePrecheck({
      amount: body.amount,
      type: 'CHI',
      approvalId: body.approvalId,
    });
    if (!check.allowed) {
      handleExpensePrecheckFailure(check, {
        type: 'cashbook',
        form,
        amount: body.amount,
        description: body.description,
        approvalId: body.approvalId,
      });
      return;
    }
  }

  try {
    const res = await fetch('/api/cashbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.precheck) {
        handleExpensePrecheckFailure(data.precheck, {
          type: 'cashbook',
          form,
          amount: body.amount,
          description: body.description,
        });
        return;
      }
      throw new Error(data.error);
    }
    pendingExpenseAction = null;
    cashbookData = data.cashbook;
    ledgerSummary = data.ledgerSummary;
    closeModal();
    showToast('Đã ghi sổ quỹ', 'success');
    renderLedger();
    renderBudget();
    renderDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
*/

/* [DISABLED] cashbook bị vô hiệu hóa
async function exportCashbookReport() {
  try {
    const data = await loadCashbookData();
    const rows = data.entries || [];
    if (!rows.length) {
      showToast('Không có dữ liệu', 'error');
      return;
    }
    let csv = 'Ngày,Loại,Nhãn,Số tiền,Nội dung,Minh chứng,Tồn quỹ\n';
    rows.forEach((r) => {
      csv += `${r.date},${r.type},${r.categoryTag},${r.amount},"${r.description}",${r.proofDocument || ''},${r.balanceAfter}\n`;
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SoQuy_ZeroNudge_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast('Đã xuất báo cáo sổ quỹ', 'success');
  } catch (err) {
    showToast('Lỗi xuất báo cáo', 'error');
  }
}
*/

/* [DISABLED] B2B bị vô hiệu hóa
function openEventBackupModal(eventId, deficit) {
  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="compare-modal" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeModal()">× Đóng</button>
        <div class="card-title">Quỹ Backup — Smart CFO</div>
        <p class="tpn-message">Ngân sách sự kiện đang âm ${Math.abs(deficit).toLocaleString()}₫. Chọn phương án bù vốn:</p>
        <div class="nudge-actions" style="flex-direction:column;gap:10px;">
          <button class="btn-nudge-confirm" onclick="submitEventBackup(${eventId}, 'A', ${Math.abs(deficit)})">A — Trích quỹ cốt lõi CLB</button>
          <button class="btn-nudge-cancel" onclick="submitEventBackup(${eventId}, 'B', ${Math.abs(deficit)})">B — Bổ sung tài trợ ngoài</button>
        </div>
      </div>
    </div>`;
  modal.style.display = 'block';
}
*/

/* [DISABLED] B2B bị vô hiệu hóa
async function submitEventBackup(eventId, option, amount) {
  try {
    const res = await fetch(`/api/events/${eventId}/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option, amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    ledgerSummary = data.ledgerSummary || ledgerSummary;
    closeModal();
    showToast('Đã phê duyệt quỹ backup — thử chi lại', 'success');
    renderBudget();
    renderLedger();
    if (pendingExpenseAction) {
      setTimeout(() => retryPendingExpense(), 400);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}
*/

/* [DISABLED] ledger bị vô hiệu hóa
async function exportLedgerReport() {
  showToast('Đang chuẩn bị báo cáo...', 'warning');
  try {
    const res = await fetch(`/api/ledger?limit=1000&search=${encodeURIComponent(ledgerSearchQuery)}`);
    const data = await res.json();
    const rows = data.rows || [];

    if (rows.length === 0) {
      showToast('Không có dữ liệu để xuất', 'error');
      return;
    }

    let csv = 'Ngày,Diễn giải,Khoản mục,Số lượng,Đơn giá,COGS,Đối tác,Thanh toán\n';
    rows.forEach(r => {
      csv += `${r.date},"${r.desc}","${r.cat}",${r.qty},${r.price},${r.cogs},"${r.partner}",${r.paid ? 'Đã thanh toán' : 'Chưa'}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `BaoCaoZeroNudge_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Báo cáo đã được tải xuống', 'success');
  } catch (err) {
    showToast('Lỗi xuất báo cáo', 'error');
  }
}
*/

// ──────────────────────────────────────────────────────

// RENDER: BUDGET (Quản lý Ngân sách & Định mức)
// Tính năng chính: Đặt hạn mức chi tiêu, Duyệt chi thông minh
// Tính năng B2B: Chặn chi tiêu vượt định mức CLB/Nhóm qua Smart CFO
// ──────────────────────────────────────────────────────

/* [DISABLED] Ngân sách bị tạm vô hiệu hóa
function renderBudget() {
  const container = document.getElementById('screen-budget');
  if (!container) return;

  // Chỉ hiển thị Bộ định mức chiến lược
  const strategySection = `
    <div class="chart-card budget-limits-card">
      <div class="summary-title">BỘ ĐỊNH MỨC CHIẾN LƯỢC</div>
      <div class="budget-sliders-list" id="budget-sliders-list">
        ${budgetItems.map(item => `
          <div class="budget-slider-item" data-key="${item.key}">
            <div class="slider-header">
              <span class="slider-name">${escapeHtml(item.name)}</span>
              <span class="slider-val" id="pct-${item.key}">${item.pct}%</span>
            </div>
            <input type="range" class="budget-range main-budget-slider" data-key="${item.key}" min="0" max="${item.limit}" step="1" value="${item.pct}" style="width: 100%;">
            <div class="slider-footer">
              <span class="footer-left">0%</span>
              <span class="footer-right">Tối đa: ${item.limit}%</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const checkBudgetSection = `
    <div class="chart-card budget-input-card">
      <div class="summary-title" style="margin-bottom: 24px;">NHẬP CHI PHÍ ĐỂ DUYỆT</div>
      <div class="input-grid">
        <div class="input-field">
          <label>Loại chi phí</label>
          <select id="check-category" class="budget-select">
            ${budgetItems.map(item => `<option value="${item.key}">${escapeHtml(item.name)}</option>`).join('')}
          </select>
        </div>
        <div class="input-field">
          <label>Số tiền đề xuất (đ)</label>
          <input type="number" id="check-amount" class="budget-input" placeholder="Nhập số tiền...">
        </div>
        <button class="btn-budget-approve" id="btn-check-budget">
          <i data-lucide="check"></i> Duyệt ngân sách
        </button>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="budget-layout">
      <div class="budget-top-row">
        ${strategySection}
        <div class="budget-right-col">
          <div class="budget-status-card" id="check-result-card">
            <div class="status-icon-box">
              <i data-lucide="check-square" style="width: 40px; height: 40px; color: #fff;"></i>
            </div>
            <div class="status-text-main" id="check-status">Nhập số tiền để kiểm tra</div>
            <div class="status-text-sub" id="check-detail"></div>
          </div>
          <div class="chart-card budget-suggestions-card">
            <div class="summary-title" style="margin-bottom: 16px;">KHUYẾN NGHỊ CHIẾN LƯỢC</div>
            <div class="suggestions-list">
              ${suggestions.map(s => `
                <div class="suggestion-item">
                  <div class="suggestion-icon"><i data-lucide="zap"></i></div>
                  <div class="suggestion-text">${escapeHtml(s.text)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      ${checkBudgetSection}
      <div class="chart-card budget-approvals-card">
        <div class="summary-title" style="margin-bottom: 16px;">Lịch sử duyệt ngân sách</div>
        <div id="budget-approvals-list"></div>
        <div id="budget-approvals-pagination"></div>
      </div>
    </div>
  `;

  refreshIcons();
  renderBudgetApprovals();

  // Slider events
  document.querySelectorAll('.main-budget-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const key = slider.dataset.key;
      if (!key || key === 'undefined') return;

      const newPct = parseInt(e.target.value, 10);
      const pctSpan = document.getElementById(`pct-${key}`);
      if (pctSpan) pctSpan.textContent = newPct + '%';

      if (budgetSliderTimeout) clearTimeout(budgetSliderTimeout);

      budgetSliderTimeout = setTimeout(async () => {
        try {
          const res = await fetch(`/api/budget/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pct: newPct })
          });
          if (!res.ok) throw new Error('Update failed');

          const itemIndex = budgetItems.findIndex(i => i.key === key);
          if (itemIndex !== -1) budgetItems[itemIndex].pct = newPct;
          showToast(`Đã cập nhật ${key} thành ${newPct}%`, 'success');
        } catch (err) {
          showToast('Lỗi cập nhật: ' + err.message, 'error');
          const oldItem = budgetItems.find(i => i.key === key);
          if (oldItem && pctSpan) {
            pctSpan.textContent = oldItem.pct + '%';
            slider.value = oldItem.pct;
          }
        }
      }, 500);
    });
  });

  // Check budget button
  const checkBtn = document.getElementById('btn-check-budget');
  if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
      const categoryKey = document.getElementById('check-category').value;
      const amount = parseInt(document.getElementById('check-amount').value, 10);
      if (isNaN(amount) || amount <= 0) {
        showToast('Vui lòng nhập số tiền hợp lệ');
        return;
      }
      try {
        const res = await fetch('/api/budget/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryKey, amount })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const statusDiv = document.getElementById('check-status');
        const detailDiv = document.getElementById('check-detail');

        if (data.isOver) {
          statusDiv.innerHTML = `⚠️ VƯỢT ĐỊNH MỨC — TỪ CHỐI`;
          detailDiv.innerHTML = `Không được duyệt. Tối đa ${Math.round(data.allowedAmount).toLocaleString()}₫`;
          statusDiv.style.color = '#ef4444';
          showToast('Vượt định mức — không ghi nhận duyệt', 'error');
        } else {
          statusDiv.innerHTML = `✓ Trong định mức an toàn`;
          detailDiv.innerHTML = data.message;
          statusDiv.style.color = 'var(--primary)';

          budgetApprovals.unshift({
            id: Date.now(),
            categoryKey,
            categoryName: budgetItems.find(i => i.key === categoryKey)?.name || categoryKey,
            amount,
            status: 'Đã duyệt',
            message: data.message,
            createdAt: new Date().toLocaleDateString('vi-VN')
          });
          budgetApprovalsPage = 1;
          renderBudgetApprovals();
        }
      } catch (err) {
        showToast(err.message);
      }
    });
  }
}
*/

/* [DISABLED] Budget bị vô hiệu hóa
function renderBudgetApprovals() {
  const list = document.getElementById('budget-approvals-list');
  const pagination = document.getElementById('budget-approvals-pagination');
  if (!list || !pagination) return;

  const totalItems = budgetApprovals.length;
  const totalPages = Math.ceil(totalItems / BUDGET_APPROVALS_PER_PAGE);
  if (budgetApprovalsPage < 1) budgetApprovalsPage = 1;
  if (budgetApprovalsPage > totalPages && totalPages > 0) budgetApprovalsPage = totalPages;

  const startIdx = (budgetApprovalsPage - 1) * BUDGET_APPROVALS_PER_PAGE;
  const endIdx = startIdx + BUDGET_APPROVALS_PER_PAGE;
  const pageItems = budgetApprovals.slice(startIdx, endIdx);

  list.innerHTML = pageItems.length > 0
    ? pageItems.map(item => `
        <div class="approval-item">
          <div class="approval-meta">
            <strong>${item.categoryName}</strong>
            <span>${item.createdAt}</span>
          </div>
          <div class="approval-detail">
            <span>${item.status}</span>
            <span>${item.amount.toLocaleString()}₫</span>
          </div>
          <div class="approval-message">${escapeHtml(item.message)}</div>
        </div>
      `).join('')
    : '<div class="approval-empty">Chưa có duyệt ngân sách nào.</div>';

  let paginationHtml = '';
  if (totalPages > 1) {
    paginationHtml = `
      <div class="transactions-pagination" style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--card-border);">
        <button class="btn-ledger-outline" style="padding: 4px 12px; height: auto;" ${budgetApprovalsPage <= 1 ? 'disabled' : ''} onclick="changeBudgetApprovalsPage(${budgetApprovalsPage - 1})">
          <i data-lucide="chevron-left"></i> Trước
        </button>
        <span style="font-size: 12px; color: var(--text-dim);">Trang ${budgetApprovalsPage} / ${totalPages}</span>
        <button class="btn-ledger-outline" style="padding: 4px 12px; height: auto;" ${budgetApprovalsPage >= totalPages ? 'disabled' : ''} onclick="changeBudgetApprovalsPage(${budgetApprovalsPage + 1})">
          Sau <i data-lucide="chevron-right"></i>
        </button>
      </div>
    `;
  }

  pagination.innerHTML = paginationHtml;
  refreshIcons();
}
*/

/* [DISABLED] Budget bị vô hiệu hóa
function changeBudgetApprovalsPage(newPage) {
  budgetApprovalsPage = newPage;
  renderBudgetApprovals();
}
*/

// ──────────────────────────────────────────────────────
// RENDER: EXCHANGE (Sàn Vốn - Đầu tư NetZero)
// Tính năng chính: Dùng tiền "Piggy" để đầu tư vào các dự án ESG
// ──────────────────────────────────────────────────────
function renderExchange() {
  const container = document.getElementById('screen-exchange');
  container.innerHTML = `
    <div class="exchange-summary-card">
      <div class="summary-left">
        <div class="summary-label">SỐ DƯ KHẢ DỤNG (GREEN SAVING)</div>
        <div class="main-value">${exchangeSummary.availableBalance.toLocaleString()}₫</div>
        <div class="summary-subtext">Nguồn từ The Perfect No · Lãi kỳ vọng 8.5%/năm</div>
      </div>
      <div class="summary-right">
        <div class="summary-item">
          <div class="summary-label">Tổng đã đầu tư</div>
          <div class="summary-value">${exchangeSummary.totalInvested.toLocaleString()}₫</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Lãi cộng dồn</div>
          <div class="summary-value green-text">+${exchangeSummary.cumulativeReturn.toLocaleString()}₫</div>
        </div>
      </div>
    </div>

    <div class="card-title" style="margin-bottom: 24px;">Thư viện dự án NetZero</div>
    <div class="projects-grid">
      ${projects.map(p => `
        <div class="chart-card project-card">
          <div class="project-card-header">
            <div class="project-title-area">
              <div class="project-title">${p.name}</div>
              <div class="project-desc">${p.desc}</div>
            </div>
            <div class="project-icon-box">${p.icon}</div>
          </div>
          
          <div class="project-tags">
            <span class="badge badge-green">ESG: ${p.esg}</span>
            <span class="badge ${p.riskClass === 'risk-low' ? 'badge-green' : p.riskClass === 'risk-mid' ? 'badge-amber' : 'badge-red'}">${p.riskLabel}</span>
          </div>

          <div class="risk-meter-container">
            <div class="risk-meter-label">Mức độ rủi ro</div>
            <div class="risk-meter-bg">
              <div class="risk-meter-fill ${p.riskClass}" style="width: ${p.risk}%"></div>
            </div>
          </div>

          <div class="project-info-row">
            <div class="info-item">
              <label>Lãi suất</label>
              <div class="val">${p.rate}%/năm</div>
            </div>
            <div class="info-item">
              <label>Kỳ hạn</label>
              <div class="val">${p.period}</div>
            </div>
            <div class="info-item">
              <label>Đã huy động</label>
              <div class="val">${p.raised}/${p.target} tỷ</div>
            </div>
          </div>

          <div class="mobilization-area">
            <div class="mobilization-label">${Math.round((p.raised / p.target) * 100)}% hoàn thành mục tiêu</div>
            <div class="goal-bar-bg">
              <div class="goal-bar-fill" style="width: ${(p.raised / p.target) * 100}%"></div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button class="btn-invest" style="flex: 1;" onclick="openInvestModal('${p.name.replace(/'/g, "\\'")}')">
              <i data-lucide="zap"></i> Rót vốn vi mô
            </button>
            <button class="btn-smart" style="padding: 10px; border-radius: 8px;" onclick="openProjectProfileModal('${p.name.replace(/'/g, "\\'")}')" title="Xem hồ sơ dự án">
              <i data-lucide="info"></i>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  refreshIcons();
}

function openProjectProfileModal(projectName) {
  const p = projects.find(proj => proj.name === projectName);
  if (!p) return;

  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="compare-modal" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeModal()">× Đóng</button>
        <div class="project-profile-content">
          <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 10px;">
            <div class="project-icon-box" style="width: 64px; height: 64px; font-size: 32px;">${p.icon}</div>
            <div>
              <div class="card-title" style="font-size: 24px; margin-bottom: 4px;">${p.name}</div>
              <div class="project-tags">
                <span class="badge badge-green">ESG Phase 1: ${p.esg}</span>
                <span class="badge ${p.riskClass === 'risk-low' ? 'badge-green' : 'badge-amber'}">${p.riskLabel}</span>
              </div>
            </div>
          </div>
          
          <div class="project-mission">
            <strong>Sứ mệnh:</strong> ${p.desc}. Dự án tập trung vào việc giảm thiểu carbon và tạo ra tác động xã hội tích cực thông qua các mô hình kinh doanh bền vững.
          </div>

          <div class="project-stats-grid">
            <div class="stat-box">
              <div class="stat-label">Lợi nhuận mục tiêu</div>
              <div class="stat-value">${p.rate}% / năm</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Thời gian hoàn vốn</div>
              <div class="stat-value">${p.period}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Tổng vốn huy động</div>
              <div class="stat-value">${p.target} Tỷ VNĐ</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Tiến độ thực tế</div>
              <div class="stat-value">${Math.round((p.raised / p.target) * 100)}%</div>
            </div>
          </div>

          <button class="btn-invest" style="width: 100%; margin-top: 10px; justify-content: center; height: 48px;" onclick="closeModal(); openInvestModal('${p.name.replace(/'/g, "\\'")}')">
            <i data-lucide="zap"></i> Rót vốn vào dự án này
          </button>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'block';
  refreshIcons();
}

function closeModal() {
  const modal = document.getElementById('modal-container');
  if (modal) {
    modal.innerHTML = '';
    modal.style.display = 'none';
  }
}

// ──────────────────────────────────────────────────────
// THE PERFECT NO (TPN) 🐷
// ──────────────────────────────────────────────────────

function updateTPNImpactPreview(val) {
  const el = document.getElementById('tpn-impact-preview');
  if (!el) return;
  const amount = parseInt(val, 10);
  if (!amount || amount <= 0) {
    el.textContent = 'Nhập số tiền để xem CO₂ giảm & lãi kỳ vọng';
    return;
  }
  const co2 = (amount / 50000).toFixed(1);
  const interest = Math.round(amount * 0.085);
  el.innerHTML = `≈ <strong>${co2} kg CO₂</strong> tránh phát thải · Lãi kỳ vọng <strong>+${interest.toLocaleString()}₫</strong>/năm`;
}

function openTPNModal() {
  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="compare-modal tpn-modal" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeModal()">× Đóng</button>
        <div class="tpn-icon-box">
          <i data-lucide="piggy-bank" style="width: 48px; height: 48px;"></i>
        </div>
        <div class="card-title" style="font-size: 24px; margin-bottom: 12px;">Quyết định "Vàng"</div>
        <div class="tpn-message">
          Mỗi lần bạn nói "Không" với những khoản chi bốc đồng là một lần bạn tiến gần hơn tới tương lai Net-Zero. Bạn muốn chuyển bao nhiêu vào Green Saving hôm nay?
        </div>
        <div id="tpn-impact-preview" class="tpn-impact-preview">Nhập số tiền để xem CO₂ giảm & lãi kỳ vọng</div>
        <input type="number" id="tpn-amount" class="tpn-amount-input" placeholder="0" min="0" oninput="updateTPNImpactPreview(this.value)">
        
        <div class="slider-confirm-container" id="slider-tpn">
          <div class="slider-progress-bg" id="slider-progress"></div>
          <div class="slider-confirm-text">TRƯỢT ĐỂ XÁC NHẬN PLEDGE</div>
          <div class="slider-confirm-handle" id="slider-handle">
            <i data-lucide="chevron-right"></i>
          </div>
        </div>
        
        <button class="btn-tpn-cancel" onclick="closeModal()">Có lẽ để sau</button>
      </div>
    </div>
  `;
  modal.style.display = 'block';
  refreshIcons();
  initSliderConfirm();
}

function initSliderConfirm(onConfirm = null) {
  const handle = document.getElementById('slider-handle');
  const container = document.getElementById('slider-tpn');
  const progress = document.getElementById('slider-progress');
  if (!handle || !container) return;

  let isDragging = false;
  let startX = 0;
  const maxDelta = container.offsetWidth - handle.offsetWidth - 8;

  const onStart = (e) => {
    isDragging = true;
    startX = (e.type === 'mousedown') ? e.pageX : e.touches[0].pageX;
    handle.style.transition = 'none';
    progress.style.transition = 'none';
  };

  const onMove = (e) => {
    if (!isDragging) return;
    const currentX = (e.type === 'mousemove') ? e.pageX : e.touches[0].pageX;
    let delta = currentX - startX;
    delta = Math.max(0, Math.min(delta, maxDelta));
    handle.style.transform = `translateX(${delta}px)`;
    progress.style.width = `${(delta / maxDelta) * 100}%`;

    if (delta >= maxDelta * 0.95) {
      handle.style.background = '#16a34a';
    } else {
      handle.style.background = 'var(--primary)';
    }
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    const currentDelta = parseInt(handle.style.transform.replace('translateX(', '').replace('px)', '')) || 0;

    if (currentDelta >= maxDelta * 0.9) {
      handle.style.transform = `translateX(${maxDelta}px)`;
      progress.style.width = '100%';
      if (onConfirm) onConfirm();
      else confirmTPNTransfer();
    } else {
      handle.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      progress.style.transition = 'width 0.3s ease';
      handle.style.transform = 'translateX(0px)';
      progress.style.width = '0%';
    }
  };

  handle.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);

  handle.addEventListener('touchstart', onStart);
  window.addEventListener('touchmove', onMove);
  window.addEventListener('touchend', onEnd);
}

async function confirmTPNTransfer() {
  const amtInput = document.getElementById('tpn-amount');
  const amount = parseInt(amtInput.value, 10);

  if (isNaN(amount) || amount <= 0) {
    showToast('Vui lòng nhập số tiền hợp lệ', 'error');
    const handle = document.getElementById('slider-handle');
    handle.style.transform = 'translateX(0px)';
    document.getElementById('slider-progress').style.width = '0%';
    return;
  }

  try {
    const res = await fetch('/api/savings/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    pigAmount = data.pigAmount;
    pigTarget = data.pigTarget;

    const response = await fetch('/api/app');
    const appData = await response.json();
    transactions = appData.transactions;

    if (data.exchangeSummary) exchangeSummary = data.exchangeSummary;
    closeModal();
    const co2Reduced = data.co2ReducedKg || (amount / 50000).toFixed(1);
    const interest = data.projectedInterest || Math.round(amount * 0.085);
    showToast(`✓ Đã nói "Không"! +${amount.toLocaleString()}₫ · ${co2Reduced}kg CO₂ · lãi kỳ vọng +${interest.toLocaleString()}₫/năm`);
    renderDashboard();
    if (document.getElementById('screen-exchange')?.classList.contains('active')) renderExchange();
    logAction('tpn_pledge_made');
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

function openNudgeModal(amount, onSayNo, onContinue) {
  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="compare-modal tpn-modal" onclick="event.stopPropagation()">
        <div class="tpn-icon-box" style="background: rgba(234, 179, 8, 0.1); color: var(--accent);">
          <i data-lucide="alert-triangle" style="width: 48px; height: 48px;"></i>
        </div>
        <div class="card-title" style="font-size: 24px; margin-bottom: 12px;">Dừng lại một chút!</div>
        <div class="tpn-message">
          Bạn chuẩn bị chi <strong class="nudge-amount">${amount.toLocaleString()}₫</strong> cho một khoản có vẻ "bốc đồng". <br>
          Thay vì chi tiêu lãng phí, sao không nói "Không" và chuyển số tiền này vào Green Saving để đầu tư Net-Zero?
        </div>
        <div class="tpn-impact-preview">≈ ${(amount / 50000).toFixed(1)} kg CO₂ · Lãi kỳ vọng +${Math.round(amount * 0.085).toLocaleString()}₫/năm</div>
        
        <div class="nudge-actions">
           <button class="btn-nudge-confirm" id="btn-nudge-no">Xác nhận: Nói "Không"</button>
           <button class="btn-nudge-cancel" id="btn-nudge-yes">Bỏ qua: Vẫn chi tiêu</button>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'block';
  refreshIcons();

  document.getElementById('btn-nudge-no').onclick = () => {
    closeModal();
    onSayNo();
  };
  document.getElementById('btn-nudge-yes').onclick = () => {
    closeModal();
    onContinue();
  };
}

function openInvestModal(projectName) {
  const modal = document.getElementById('modal-container');
  const amounts = [100000, 500000, 1000000, 2000000, 5000000];
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="compare-modal" onclick="event.stopPropagation()" style="max-width: 420px;">
        <button class="modal-close" onclick="closeModal()">× Đóng</button>
        <div class="card-title" style="font-size: 18px; margin-bottom: 8px;">Rót vốn vi mô</div>
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">Dự án: <strong style="color: var(--text);">${projectName}</strong></div>
        <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 16px;">Số dư khả dụng: <strong style="color: var(--primary);">${exchangeSummary.availableBalance.toLocaleString()}₫</strong></div>
        <div class="invest-amounts">
          ${amounts.map(a => `
            <button class="invest-chip" onclick="selectInvestAmount(this, ${a})">
              ${a >= 1000000 ? (a / 1000000) + ' triệu' : (a / 1000) + 'K'}
            </button>
          `).join('')}
        </div>
        <div style="margin-top: 16px;">
          <label style="font-size: 12px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 8px;">Hoặc nhập số tiền khác</label>
          <input type="number" id="invest-custom-amount" placeholder="Nhập số tiền..." style="width: 100%; background: var(--bg-subtle); border: 1px solid var(--card-border); padding: 12px 16px; border-radius: 10px; color: var(--text); font-family: var(--sans); font-size: 14px;">
        </div>
        <button class="btn-invest" style="width: 100%; margin-top: 20px; justify-content: center;" onclick="confirmInvest('${projectName.replace(/'/g, "\\'")}')">
          <i data-lucide="zap"></i> Xác nhận đầu tư
        </button>
      </div>
    </div>
  `;
  modal.style.display = 'block';
  refreshIcons();
}

let selectedInvestAmount = 0;

function selectInvestAmount(el, amount) {
  document.querySelectorAll('.invest-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedInvestAmount = amount;
  document.getElementById('invest-custom-amount').value = amount;
}

async function confirmInvest(projectName) {
  const customInput = document.getElementById('invest-custom-amount');
  const amount = parseInt(customInput.value, 10) || selectedInvestAmount;

  if (!amount || amount <= 0) {
    showToast('Vui lòng chọn hoặc nhập số tiền đầu tư');
    return;
  }

  if (amount > exchangeSummary.availableBalance) {
    showToast('Số dư không đủ để đầu tư');
    return;
  }

  try {
    const res = await fetch('/api/invest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName, amount }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Không thể thực hiện đầu tư');
      return;
    }

    exchangeSummary = data.exchangeSummary;
    const project = projects.find(p => p.name === projectName);
    if (project && data.project) {
      project.raised = data.project.raised;
    }

    closeModal();
    logAction('invest_made');
    renderExchange();
    showToast(`✓ Đã rót ${amount.toLocaleString()}₫ vào ${projectName}`);
  } catch (err) {
    console.error('confirmInvest error', err);
    showToast('Lỗi mạng hoặc máy chủ');
  }
}

function closeInvestModal() {
  document.getElementById('modal-container').innerHTML = '';
  selectedInvestAmount = 0;
}

// ──────────────────────────────────────────────────────
// RENDER: DIRECTORY (Danh bạ & Chuỗi cung ứng ESG)
// Tính năng chính: Tìm kiếm NCC bền vững, so sánh giá và chứng chỉ ESG
// ──────────────────────────────────────────────────────
/* [DISABLED] Danh bạ bị tạm vô hiệu hóa
function renderDirectory() {
  const container = document.getElementById('screen-directory');

  const filtered = suppliers.filter(s => {
    const matchesESG = esgFilter === 'all' || s.esg === esgFilter;
    const matchesSearch = s.name.toLowerCase().includes(directorySearchQuery.toLowerCase()) ||
      s.cat.toLowerCase().includes(directorySearchQuery.toLowerCase());
    return matchesESG && matchesSearch;
  });

  container.innerHTML = `
    <div class="card-title" style="margin-bottom: 24px;">Chuỗi cung ứng bền vững</div>
    
    <div class="directory-toolbar">
      <div class="directory-search">
        <i data-lucide="search" style="color: var(--text-muted);"></i>
        <input type="text" placeholder="Tìm nhà cung cấp, nguyên liệu sinh thái..." 
               value="${directorySearchQuery}" 
               oninput="updateDirectorySearch(this.value)">
      </div>
      <select class="esg-filter-select" onchange="updateEsgFilter(this.value)">
        <option value="all" ${esgFilter === 'all' ? 'selected' : ''}>Tất cả ESG</option>
        <option value="A" ${esgFilter === 'A' ? 'selected' : ''}>ESG: A</option>
        <option value="B" ${esgFilter === 'B' ? 'selected' : ''}>ESG: B</option>
        <option value="C" ${esgFilter === 'C' ? 'selected' : ''}>ESG: C</option>
      </select>
      <button class="btn-compare-main ${selectedSuppliers.length === 2 ? 'highlighted' : ''}" 
              onclick="openCompareModal()">
        So sánh đã chọn
      </button>
    </div>

    <div class="suppliers-grid">
      ${filtered.map(s => {
    const isSelected = selectedSuppliers.includes(s.name);
    return `
          <div class="supplier-card-wide ${isSelected ? 'selected' : ''}">
            <div class="supplier-card-header">
              <div class="trans-icon" style="font-size: 24px;">${s.icon}</div>
              <div class="supplier-header-info">
                <div class="supplier-name">${s.name}</div>
                <div class="supplier-sub">${s.cat} · ${s.cert}</div>
              </div>
              <div class="supplier-actions">
                <span class="badge ${s.esg === 'A' ? 'badge-green' : s.esg === 'B' ? 'badge-amber' : 'badge-red'}" 
                      style="font-size: 14px; padding: 6px 12px;">${s.esg}</span>
                <label class="compare-checkbox-label">
                  <input type="checkbox" class="compare-checkbox" 
                         ${isSelected ? 'checked' : ''} 
                         onchange="toggleSupplierSelection('${s.name}')">
                  So sánh
                </label>
              </div>
            </div>
            <div class="info-grid-mini">
              <div class="info-box-mini">
                <label>Đơn giá</label>
                <div class="val">${s.price1}</div>
              </div>
              <div class="info-box-mini">
                <label>Giá sỉ</label>
                <div class="val">${s.price2}</div>
              </div>
              <div class="info-box-mini">
                <label>Đơn hàng tối thiểu</label>
                <div class="val">${s.minOrder}</div>
              </div>
              <div class="info-box-mini">
                <label>Giao hàng</label>
                <div class="val">${s.lead}</div>
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>

    ${selectedSuppliers.length > 0 ? `
      <div class="floating-compare-bar">
        <div class="floating-text">Đang chọn <span>${selectedSuppliers.length}</span> nhà cung cấp</div>
        <button class="btn-floating-show" onclick="openCompareModal()">
          <i data-lucide="bar-chart-2"></i> Xem so sánh
        </button>
        <button class="btn-floating-clear" onclick="clearSupplierSelection()">Xóa</button>
      </div>
    ` : ''}
  `;
  refreshIcons();
}
*/

/* [DISABLED] Danh bạ bị vô hiệu hóa
function updateDirectorySearch(val) {
  directorySearchQuery = val;
  renderDirectory();
}

function updateEsgFilter(val) {
  esgFilter = val;
  renderDirectory();
}

function toggleSupplierSelection(name) {
  const index = selectedSuppliers.indexOf(name);
  if (index > -1) {
    selectedSuppliers.splice(index, 1);
  } else {
    if (selectedSuppliers.length < 2) {
      selectedSuppliers.push(name);
    } else {
      showToast('Chỉ có thể so sánh tối đa 2 nhà cung cấp');
    }
  }
  renderDirectory();
}

function clearSupplierSelection() {
  selectedSuppliers = [];
  renderDirectory();
}
*/

/* [DISABLED] Danh bạ bị vô hiệu hóa
function openCompareModal() {
  if (selectedSuppliers.length !== 2) {
    showToast('Vui lòng chọn đúng 2 nhà cung cấp để so sánh');
    return;
  }

  const s1 = suppliers.find(s => s.name === selectedSuppliers[0]);
  const s2 = suppliers.find(s => s.name === selectedSuppliers[1]);

  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="compare-modal" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeModal()">× Đóng</button>
        <div class="card-title" style="font-size: 18px;">So sánh nhà cung cấp</div>
        
        <table class="compare-table">
          <thead>
            <tr>
              <th class="crit-label">TIÊU CHÍ</th>
              <th>
                <div class="supplier-header">
                  <span>${s1.icon}</span> <span>${s1.name}</span>
                </div>
              </th>
              <th>
                <div class="supplier-header">
                  <span>${s2.icon}</span> <span>${s2.name}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="crit-label">ESG</td>
              <td><span class="badge ${s1.esg === 'A' ? 'badge-green' : 'badge-amber'}">${s1.esg}</span></td>
              <td><span class="badge ${s2.esg === 'A' ? 'badge-green' : 'badge-amber'}">${s2.esg}</span></td>
            </tr>
            <tr>
              <td class="crit-label">Đơn giá</td>
              <td>${s1.price1}</td>
              <td>${s2.price1}</td>
            </tr>
            <tr>
              <td class="crit-label">Giá sỉ</td>
              <td>${s1.price2}</td>
              <td>${s2.price2}</td>
            </tr>
            <tr>
              <td class="crit-label">ĐH tối thiểu</td>
              <td>${s1.minOrder}</td>
              <td>${s2.minOrder}</td>
            </tr>
            <tr>
              <td class="crit-label">Giao hàng</td>
              <td>${s1.lead}</td>
              <td>${s2.lead}</td>
            </tr>
            <tr>
              <td class="crit-label">Chứng nhận</td>
              <td>${s1.cert}</td>
              <td>${s2.cert}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}
*/

// ──────────────────────────────────────────────────────
// ACTIONS
// ──────────────────────────────────────────────────────
async function submitExpense() {
  const amtInput = document.getElementById('qi-amount');
  const nameInput = document.getElementById('qi-name');
  if (!amtInput) return;

  const amt = parseFloat(amtInput.value);
  if (!amt || amt <= 0 || !selectedTag) {
    showToast('Vui lòng nhập số tiền và chọn tag');
    return;
  }

  const tagObj = tags.find(t => t.id === selectedTag);
  if (!tagObj) {
    showToast('Tag không hợp lệ');
    return;
  }

  let transactionName = nameInput ? nameInput.value.trim() : '';
  if (!transactionName) {
    transactionName = 'Chi tiêu mới';
  }

  const proceedWithExpense = async () => {
    const payload = {
      tag: tagObj.label,
      amount: -amt,
      name: transactionName,
      icon: '💸',
      type: 'expense',
      saved: false
    };

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Không lưu được giao dịch');
        return;
      }

      transactions.unshift(data.transaction);
      logAction('expense_added');
      transactionsPage = 1;
      renderDashboard();
      amtInput.value = '';
      if (nameInput) nameInput.value = '';
      showToast('✓ Đã ghi nhận giao dịch');
    } catch (err) {
      console.error('submitExpense error', err);
      showToast('Lỗi mạng hoặc máy chủ');
    }
  };

  const sayNoAndSave = async () => {
    try {
      const res = await fetch('/api/savings/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      pigAmount = data.pigAmount;
      pigTarget = data.pigTarget;
      if (data.exchangeSummary) exchangeSummary = data.exchangeSummary;

      const response = await fetch('/api/app');
      const appData = await response.json();
      transactions = appData.transactions;

      showToast(`🌟 Tiết kiệm ${amt.toLocaleString()}₫`, 'success');
      renderDashboard();
      amtInput.value = '';
      if (nameInput) nameInput.value = '';
      logAction('tpn_nudge_accepted');
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  // Kiểm tra TPN warning từ server
  const warning = await checkTPNWarning(amt, selectedTag);
  if (warning) {
    // Hiển thị cảnh báo rule-based
    showRuleBasedWarning(warning, sayNoAndSave, proceedWithExpense);
  } else {
    // Không có cảnh báo, kiểm tra waste threshold cũ
    const isWaste = currentUser && currentUser.waste_threshold > 0 && amt >= currentUser.waste_threshold;
    if (isWaste) {
      openNudgeModal(amt, sayNoAndSave, proceedWithExpense);
    } else {
      await proceedWithExpense();
    }
  }
}

function showRuleBasedWarning(warning, onConfirm, onIgnore) {
  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="compare-modal tpn-modal" onclick="event.stopPropagation()">
        <div class="tpn-icon-box" style="background: rgba(234, 179, 8, 0.1); color: var(--accent);">
          <i data-lucide="alert-triangle" style="width: 48px; height: 48px;"></i>
        </div>
        <div class="card-title" style="font-size: 20px; margin-bottom: 8px;">${warning.title}</div>
        <p class="tpn-message" style="font-size: 14px;">${warning.message}</p>
        <p class="tpn-impact-preview" style="background: rgba(234, 179, 8, 0.08);">💡 ${warning.suggestion}</p>
        
        <div class="nudge-actions">
          <button class="btn-nudge-confirm" id="tpn-rule-save">✅ Tiết kiệm</button>
          <button class="btn-nudge-cancel" id="tpn-rule-spend">💰 Vẫn chi tiêu</button>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'block';
  refreshIcons();

  document.getElementById('tpn-rule-save')?.addEventListener('click', () => {
    closeModal();
    if (onConfirm) onConfirm();
  });
  document.getElementById('tpn-rule-spend')?.addEventListener('click', () => {
    closeModal();
    if (onIgnore) onIgnore();
  });
}

async function submitIncome() {
  const nameInput = document.getElementById('income-name');
  const amtInput = document.getElementById('income-amount');
  if (!nameInput || !amtInput) return;

  const amt = parseFloat(amtInput.value);
  const incomeName = nameInput.value.trim() || 'Thu nhập';
  if (!amt || amt <= 0) {
    showToast('Vui lòng nhập số tiền thu nhập hợp lệ');
    return;
  }

  try {
    const payload = {
      tag: 'Thu nhập',
      amount: amt,
      name: incomeName,
      icon: '💰',
      type: 'income',
      saved: false
    };
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Không lưu được thu nhập');
      return;
    }

    transactions.unshift(data.transaction);
    logAction('income_added');
    transactionsPage = 1;
    renderDashboard();
    nameInput.value = '';
    amtInput.value = '';
    showToast('✓ Đã ghi nhận thu nhập');
  } catch (err) {
    console.error('submitIncome error', err);
    showToast('Lỗi mạng hoặc máy chủ');
  }
}

function hideToast() {
  const t = document.getElementById('toast');
  if (!t) return;
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  t.style.display = 'none';
}

function showToast(msg, type = 'success', duration = 3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  t.className = '';
  t.classList.add(type);

  const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info');
  t.innerHTML = `<i data-lucide="${icon}"></i> <span>${msg}</span>`;

  t.style.display = 'flex';
  refreshIcons();

  if (duration > 0) {
    toastTimeout = setTimeout(() => {
      t.style.display = 'none';
      toastTimeout = null;
    }, duration);
  }
}

// Hàm cài đặt PWA
function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted install');
      }
      deferredPrompt = null;
    });
  } else {
    showToast('Trình duyệt không hỗ trợ cài đặt ứng dụng', 'error');
  }
}

// Hiển thị toàn bộ giao dịch
function renderFullTransactions() {
  const container = document.getElementById('trans-list-full');
  if (!container) return;
  if (!transactions || transactions.length === 0) {
    container.innerHTML = '<div class="text-muted" style="text-align:center; padding:20px;">Chưa có giao dịch nào</div>';
    return;
  }
  container.innerHTML = transactions.map(t => `
    <div class="trans-item">
      <div class="trans-icon">${t.icon}</div>
      <div class="trans-info">
        <div class="trans-name">${escapeHtml(t.name)}</div>
        <div class="trans-date">${escapeHtml(t.tag)}</div>
      </div>
      <div class="trans-amount ${t.amount > 0 ? 'amount-pos' : 'amount-neg'}">
        ${t.amount > 0 ? '+' : ''}${Math.abs(t.amount).toLocaleString()}₫
      </div>
    </div>
  `).join('');
}

// Ghi đè switchScreen để hỗ trợ thêm các màn hình mới
const originalSwitchScreen = switchScreen;
switchScreen = function (id, el) {
  // Nếu là các màn hình đặc biệt, xử lý riêng
  if (id === 'transactions') {
    renderFullTransactions();
  } else if (id === 'charts') {
    // [DISABLED B2B] if (accountType === 'b2b') updateGroupSpendChart();
    // else updateCharts();
    updateCharts();
  } else if (id === 'goals') {
    // Cập nhật lại các chỉ số mục tiêu nếu cần
    if (document.getElementById('pig-progress-text')) {
      const progress = pigTarget > 0 ? (pigAmount / pigTarget) * 100 : 0;
      const progressClamped = Math.max(0, Math.min(progress, 100));
      document.getElementById('pig-progress-text').textContent = pigTarget > 0 ? `${progressClamped.toFixed(0)}%` : 'Chưa đặt mục tiêu';
      document.getElementById('pig-progress-bar').style.width = `${progressClamped}%`;
      document.getElementById('pig-target-text').textContent = pigTarget > 0 ? `${(pigAmount / 1000000).toFixed(1)}tr / ${(pigTarget / 1000000).toFixed(1)}tr` : 'Chưa đặt mục tiêu';
    }
  }
  // Gọi hàm gốc để ẩn/hiện screen và cập nhật active nav
  originalSwitchScreen(id, el);
};

// Cập nhật renderExchange để đảm bảo grid 2 cột trên mobile (đã có trong CSS)
// Không cần sửa renderExchange vì nó đã dùng .projects-grid

// Đảm bảo các nút back hoạt động
document.addEventListener('click', function (e) {
  if (e.target.closest('.back-btn')) {
    // Xử lý đã có trong onclick
  }
});

// ──────────────────────────────────────────────────────
// INITIALIZE
// ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    const now = new Date();
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('vi-VN', options);
  }
  initMobileSearch();
});