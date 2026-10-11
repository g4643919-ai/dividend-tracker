/* ==========================================================================
   JAPAN GROWTH VALUE AI (JGVA) - Application Logic Controller (SPA)
   100% Client-Side Engine - Zero Latency, 0-Cost & Offline Compatible
   ========================================================================== */

let allStocks = [];
let filteredStocks = [];
let backtestData = null;
let currentSortColumn = 'growth_score';
let sortDirection = -1; // -1: desc, 1: asc

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  if (!window.JGVA_DATA || !window.JGVA_DATA.stocks) {
    console.error("JGVA_DATA missing!");
    return;
  }

  allStocks = window.JGVA_DATA.stocks;
  filteredStocks = [...allStocks];
  backtestData = window.JGVA_DATA.backtest;

  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Set Metadata KPI values
  document.getElementById('kpi-total-stocks').textContent = allStocks.length.toLocaleString();
  document.getElementById('kpi-updated-at').textContent = window.JGVA_DATA.meta.updated_at || "2026-10-05";

  // Calculate Dashboard counts
  const catACount = allStocks.filter(s => s.category_id === 'Category A').length;
  const inflectionCount = allStocks.filter(s => s.inflection_flag).length;
  document.getElementById('kpi-cat-a-count').textContent = catACount.toLocaleString();
  document.getElementById('kpi-inflection-count').textContent = inflectionCount.toLocaleString();

  // Populate Matrix Cells
  renderMatrixCounts();

  // Render Top Picks on Dashboard
  renderDashboardPicks();

  // Populate Screener Table
  applyScreenerFilters();

  // Populate Discoveries Grid
  renderDiscoveries();

  // Populate Backtest Cards
  renderBacktestView();
}

/* ==========================================
   Navigation & Theme Controller
   ========================================== */
function switchView(viewName) {
  const panels = document.querySelectorAll('.view-panel');
  panels.forEach(p => p.classList.remove('active'));

  const activePanel = document.getElementById(`view-${viewName}`);
  if (activePanel) {
    activePanel.classList.add('active');
  }

  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(viewName)) {
      btn.classList.add('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleTheme() {
  const htmlEl = document.documentElement;
  const currentTheme = htmlEl.getAttribute('data-theme');
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  htmlEl.setAttribute('data-theme', nextTheme);

  const iconBtn = document.getElementById('theme-toggle-btn');
  if (iconBtn) {
    iconBtn.innerHTML = nextTheme === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
    if (window.lucide) window.lucide.createIcons();
  }
}

function toggleMobileMenu() {
  const drawer = document.getElementById('mobile-drawer');
  if (drawer) {
    drawer.classList.toggle('active');
  }
}

/* ==========================================
   Matrix Engine
   ========================================== */
function renderMatrixCounts() {
  const counts = {
    'Category A': 0, 'Category B': 0, 'Category C': 0,
    'Category D': 0, 'Category E': 0, 'Category F': 0, 'Category G': 0
  };

  allStocks.forEach(s => {
    if (counts[s.category_id] !== undefined) {
      counts[s.category_id]++;
    }
  });

  document.getElementById('count-cat-a').textContent = counts['Category A'];
  document.getElementById('count-cat-b').textContent = counts['Category B'];
  document.getElementById('count-cat-c').textContent = counts['Category C'];
  document.getElementById('count-cat-d').textContent = counts['Category D'];
  document.getElementById('count-cat-e').textContent = counts['Category E'];
  document.getElementById('count-cat-g').textContent = counts['Category G'];
  document.getElementById('count-cat-f').textContent = counts['Category F'];
}

function filterByMatrix(catId) {
  switchView('matrix');
  const catTitleEl = document.getElementById('matrix-active-cat-title');
  if (catId === 'ALL') {
    catTitleEl.textContent = "選択中: 全カテゴリー";
    renderMatrixTable(allStocks);
  } else {
    catTitleEl.textContent = `選択中: ${catId}`;
    const matched = allStocks.filter(s => s.category_id === catId);
    renderMatrixTable(matched);
  }
}

function renderMatrixTable(stocksToRender) {
  const tbody = document.getElementById('matrix-table-body');
  tbody.innerHTML = stocksToRender.slice(0, 150).map(s => `
    <tr onclick="openStockModal('${s.code}')">
      <td><strong style="color: var(--accent-blue);">${s.code}</strong></td>
      <td><strong>${s.name}</strong></td>
      <td><span class="badge" style="background: rgba(255,255,255,0.1);">${s.market}</span></td>
      <td>${s.sector}</td>
      <td>¥${s.price.toLocaleString()}</td>
      <td>${s.per}倍</td>
      <td><span class="score-pill ${s.growth_score > 70 ? 'score-high' : 'score-mid'}">${s.growth_score}</span></td>
      <td><span class="score-pill ${s.valuation_score > 65 ? 'score-high' : 'score-mid'}">${s.valuation_score}</span></td>
      <td><span class="badge badge-cat-${s.category_id.toLowerCase().replace(' ', '-')}">${s.category_label}</span></td>
      <td>${s.themes.slice(0, 2).map(t => `<span class="badge" style="background: rgba(56,189,248,0.1); margin-right: 4px;">#${t}</span>`).join('')}</td>
    </tr>
  `).join('');
}

/* ==========================================
   Dashboard Renderer
   ========================================== */
function renderDashboardPicks() {
  const catA = [...allStocks].filter(s => s.category_id === 'Category A').sort((a, b) => b.total_score - a.total_score).slice(0, 5);
  const inflection = [...allStocks].filter(s => s.inflection_flag).sort((a, b) => b.growth_score - a.growth_score).slice(0, 5);

  const renderMiniTable = (list) => `
    <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
      <thead>
        <tr style="color: var(--text-secondary); border-bottom: 1px solid var(--border-color); text-align: left;">
          <th style="padding: 0.4rem;">コード/社名</th>
          <th>株価</th>
          <th>成長</th>
          <th>割安</th>
          <th>総合</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(s => `
          <tr style="border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="openStockModal('${s.code}')">
            <td style="padding: 0.5rem 0.4rem;">
              <strong style="color: var(--accent-blue);">${s.code}</strong> ${s.name}
            </td>
            <td>¥${s.price.toLocaleString()}</td>
            <td><span class="score-pill score-high">${s.growth_score}</span></td>
            <td><span class="score-pill score-high">${s.valuation_score}</span></td>
            <td><strong>${s.total_score}点</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('dash-top-cat-a').innerHTML = renderMiniTable(catA);
  document.getElementById('dash-top-inflection').innerHTML = renderMiniTable(inflection);
}

/* ==========================================
   Screener Engine
   ========================================== */
function applyScreenerFilters() {
  const query = document.getElementById('screener-search-input').value.trim().toLowerCase();
  const market = document.getElementById('filter-market').value;
  const category = document.getElementById('filter-category').value;
  const theme = document.getElementById('filter-theme').value;
  const inflectionOnly = document.getElementById('filter-inflection').checked;
  const discoveryOnly = document.getElementById('filter-discovery').checked;

  filteredStocks = allStocks.filter(s => {
    if (query && !s.code.includes(query) && !s.name.toLowerCase().includes(query) && !s.sector.toLowerCase().includes(query)) {
      return false;
    }
    if (market !== 'ALL' && s.market !== market) return false;
    if (category !== 'ALL' && s.category_id !== category) return false;
    if (theme !== 'ALL' && !s.themes.includes(theme)) return false;
    if (inflectionOnly && !s.inflection_flag) return false;
    if (discoveryOnly && !s.new_discovery_flag) return false;
    return true;
  });

  // Sort
  filteredStocks.sort((a, b) => {
    let valA = a[currentSortColumn];
    let valB = b[currentSortColumn];
    if (typeof valA === 'string') {
      return sortDirection * valA.localeCompare(valB);
    }
    return sortDirection * (valA - valB);
  });

  document.getElementById('screener-count-badge').textContent = filteredStocks.length.toLocaleString();

  renderScreenerTable();
  renderScreenerMobileCards();
}

function sortTable(colName) {
  if (currentSortColumn === colName) {
    sortDirection *= -1;
  } else {
    currentSortColumn = colName;
    sortDirection = -1;
  }
  applyScreenerFilters();
}

function renderScreenerTable() {
  const tbody = document.getElementById('screener-table-body');
  tbody.innerHTML = filteredStocks.slice(0, 100).map(s => `
    <tr onclick="openStockModal('${s.code}')">
      <td><strong style="color: var(--accent-blue);">${s.code}</strong></td>
      <td><strong>${s.name}</strong></td>
      <td><span class="badge" style="background: rgba(255,255,255,0.1);">${s.market}</span></td>
      <td>${s.sector}</td>
      <td>¥${s.price.toLocaleString()}</td>
      <td>${s.per}倍</td>
      <td>${s.pbr}倍</td>
      <td style="color: ${s.sales_growth_1y > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">+${s.sales_growth_1y}%</td>
      <td style="color: ${s.op_income_growth_1y > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">+${s.op_income_growth_1y}%</td>
      <td><span class="score-pill ${s.growth_score > 70 ? 'score-high' : 'score-mid'}">${s.growth_score}</span></td>
      <td><span class="score-pill ${s.valuation_score > 65 ? 'score-high' : 'score-mid'}">${s.valuation_score}</span></td>
      <td><strong>${s.total_score}点</strong></td>
      <td><span class="badge badge-cat-${s.category_id.toLowerCase().replace(' ', '-')}">${s.category_label}</span></td>
    </tr>
  `).join('');
}

function renderScreenerMobileCards() {
  const container = document.getElementById('screener-mobile-cards');
  container.innerHTML = filteredStocks.slice(0, 30).map(s => `
    <div class="stock-card-mobile" onclick="openStockModal('${s.code}')">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
        <div>
          <strong style="color: var(--accent-blue); font-size: 1rem;">${s.code}</strong>
          <strong style="font-size: 1.05rem; margin-left: 0.3rem;">${s.name}</strong>
        </div>
        <span class="badge badge-cat-${s.category_id.toLowerCase().replace(' ', '-')}">${s.category_label}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.6rem;">
        <span>${s.market} | ${s.sector}</span>
        <strong style="color: var(--text-primary); font-size: 1.1rem;">¥${s.price.toLocaleString()}</strong>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <div style="flex: 1; background: rgba(0,0,0,0.2); padding: 0.4rem; border-radius: 6px; text-align: center;">
          <span style="font-size: 0.7rem; color: var(--text-secondary);">成長スコア</span>
          <div style="font-size: 1rem; font-weight: 800; color: var(--accent-emerald);">${s.growth_score}</div>
        </div>
        <div style="flex: 1; background: rgba(0,0,0,0.2); padding: 0.4rem; border-radius: 6px; text-align: center;">
          <span style="font-size: 0.7rem; color: var(--text-secondary);">割安スコア</span>
          <div style="font-size: 1rem; font-weight: 800; color: var(--accent-blue);">${s.valuation_score}</div>
        </div>
      </div>
    </div>
  `).join('');
}

/* ==========================================
   Discoveries Engine
   ========================================== */
function renderDiscoveries() {
  const list = allStocks.filter(s => s.inflection_flag || s.new_discovery_flag).slice(0, 18);
  const container = document.getElementById('discoveries-grid');

  container.innerHTML = list.map(s => `
    <div class="kpi-card" style="cursor: pointer;" onclick="openStockModal('${s.code}')">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span class="badge badge-cat-${s.category_id.toLowerCase().replace(' ', '-')}">${s.category_label}</span>
        <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b;"><i data-lucide="zap"></i> 成長加速</span>
      </div>
      <h3 style="font-size: 1.15rem; font-weight: 800;"><span style="color: var(--accent-blue);">${s.code}</span> ${s.name}</h3>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem;">${s.sector} | 時価総額: ${s.market_cap.toLocaleString()}億円</p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.6rem; border-radius: 8px; font-size: 0.8rem; margin-bottom: 0.75rem;">
        <div>営業益成長: <strong style="color: var(--accent-emerald);">+${s.op_income_growth_1y}%</strong></div>
        <div>PER評価: <strong>${s.per}倍</strong></div>
        <div>自社過去平均: <strong>${s.hist_per_median}倍</strong></div>
        <div>ROIC: <strong>${s.roic}%</strong></div>
      </div>

      <p style="font-size: 0.75rem; color: var(--text-primary); border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
        <strong>【AI解釈】</strong> ${s.ai_analysis.interpretation}
      </p>
    </div>
  `).join('');

  if (window.lucide) window.lucide.createIcons();
}

/* ==========================================
   Backtest Engine
   ========================================== */
function renderBacktestView() {
  if (!backtestData) return;

  const cardsContainer = document.getElementById('backtest-category-cards');
  cardsContainer.innerHTML = backtestData.categories.map(c => `
    <div class="backtest-card">
      <span class="badge badge-cat-${c.category_id.toLowerCase().replace(' ', '-')}">${c.category_id}: ${c.name}</span>
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin: 0.75rem 0;">
        <div>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">12ヶ月平均リターン</span>
          <div style="font-size: 1.8rem; font-weight: 900; color: ${c.return_12m.startsWith('+') ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">${c.return_12m}</div>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.75rem; color: var(--text-secondary);">TOPIX超過度</span>
          <div style="font-size: 1.1rem; font-weight: 800; color: var(--accent-blue);">+${(parseFloat(c.return_12m) - parseFloat(c.benchmark_return_12m)).toFixed(1)}%</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.4rem; font-size: 0.75rem; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 6px;">
        <div>勝率: <strong>${c.win_rate}</strong></div>
        <div>最大DD: <strong style="color: var(--accent-rose);">${c.max_drawdown}</strong></div>
        <div>シャープレシオ: <strong>${c.sharpe_ratio}</strong></div>
      </div>
    </div>
  `).join('');

  // Bar Chart
  const chartContainer = document.getElementById('backtest-bar-chart');
  chartContainer.innerHTML = backtestData.monthly_chart.map(m => `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 0.4rem; flex: 1;">
      <div style="display: flex; align-items: flex-end; gap: 4px; height: 220px;">
        <div style="width: 14px; background: var(--category-d); height: ${(m.cat_d - 100) * 1.5}px; border-radius: 3px;" title="Category D: ${m.cat_d}"></div>
        <div style="width: 14px; background: var(--category-a); height: ${(m.cat_a - 100) * 1.5}px; border-radius: 3px;" title="Category A: ${m.cat_a}"></div>
        <div style="width: 14px; background: var(--text-muted); height: ${(m.topix - 100) * 1.5}px; border-radius: 3px;" title="TOPIX: ${m.topix}"></div>
      </div>
      <span style="font-size: 0.7rem; color: var(--text-secondary);">${m.month}</span>
    </div>
  `).join('');
}

/* ==========================================
   Stock Detail Modal Controller
   ========================================== */
function openStockModal(code) {
  const s = allStocks.find(item => item.code === code);
  if (!s) return;

  document.getElementById('modal-code-name').textContent = `${s.code} ${s.name}`;
  document.getElementById('modal-market').textContent = s.market;
  document.getElementById('modal-sector').textContent = s.sector;
  document.getElementById('modal-mcap').textContent = s.market_cap.toLocaleString();
  document.getElementById('modal-price').textContent = `¥${s.price.toLocaleString()}`;

  const catBadge = document.getElementById('modal-cat-badge');
  catBadge.textContent = `${s.category_id}: ${s.category_label}`;
  catBadge.className = `badge badge-cat-${s.category_id.toLowerCase().replace(' ', '-')}`;

  document.getElementById('modal-score-growth').textContent = `${s.growth_score} / 100`;
  document.getElementById('modal-bar-growth').style.width = `${s.growth_score}%`;

  document.getElementById('modal-score-val').textContent = `${s.valuation_score} / 100`;
  document.getElementById('modal-bar-val').style.width = `${s.valuation_score}%`;

  document.getElementById('modal-per').textContent = s.per;
  document.getElementById('modal-hist-per').textContent = s.hist_per_median;
  document.getElementById('modal-pbr').textContent = s.pbr;
  document.getElementById('modal-peg').textContent = s.peg;
  document.getElementById('modal-ev-ebitda').textContent = s.ev_ebitda;
  document.getElementById('modal-div').textContent = s.dividend_yield;

  // AI Breakdown
  const ai = s.ai_analysis;
  document.getElementById('modal-ai-fact').textContent = ai.fact;
  document.getElementById('modal-ai-interpretation').textContent = ai.interpretation;
  document.getElementById('modal-ai-uncertainty').textContent = ai.uncertainty;

  document.getElementById('modal-catalysts-list').innerHTML = ai.catalysts.map(c => `<li>${c}</li>`).join('');
  document.getElementById('modal-risks-list').innerHTML = ai.risks.map(r => `<li>${r}</li>`).join('');

  // Financial History
  const tbody = document.getElementById('modal-financial-history-body');
  tbody.innerHTML = s.financial_history.map(h => `
    <tr style="border-bottom: 1px solid var(--border-color);">
      <td style="text-align: left; padding: 0.4rem;"><strong>${h.year}</strong></td>
      <td>¥${h.sales.toLocaleString()}</td>
      <td style="color: var(--accent-emerald);">¥${h.op_income.toLocaleString()}</td>
      <td>¥${h.eps}</td>
      <td>${h.per}倍</td>
    </tr>
  `).join('');

  document.getElementById('stock-detail-modal').classList.add('active');
}

function closeStockModal() {
  document.getElementById('stock-detail-modal').classList.remove('active');
}

/* ==========================================
   Update Info Modal Controller
   ========================================== */
function openUpdateInfoModal() {
  const modal = document.getElementById('update-info-modal');
  if (modal) modal.classList.add('active');
}

function closeUpdateInfoModal() {
  const modal = document.getElementById('update-info-modal');
  if (modal) modal.classList.remove('active');
}

