/* ==========================================================================
   日本株 増配＆10年非減配トラッカー - Core JavaScript Application Logic
   ========================================================================== */

let stocksData = [];
let watchlist = JSON.parse(localStorage.getItem('dividend_watchlist') || '[]');
let currentTab = 'safety'; // 初期表示：10年減配なし安心度優先

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    renderApp();
});

// JSONデータの読み込み
async function loadData() {
    try {
        const response = await fetch('./data/disclosures.json');
        if (response.ok) {
            const data = await response.json();
            stocksData = data.stocks || [];
            updateLastUpdatedTime(data.last_updated);
            updateSummaryStats(data);
        } else {
            console.warn('disclosures.json の読み込みに失敗したためサンプルデータを使用します');
            stocksData = getFallbackData();
        }
    } catch (e) {
        console.warn('ネットワークまたはデータ取得エラー。フォールバックデータを使用:', e);
        stocksData = getFallbackData();
    }
}

function updateLastUpdatedTime(lastUpdatedStr) {
    const el = document.getElementById('last-updated-time');
    if (el && lastUpdatedStr) {
        el.textContent = lastUpdatedStr;
    }
}

function updateSummaryStats(data) {
    const totalEl = document.getElementById('stat-total');
    const champEl = document.getElementById('stat-champions');
    const avgYieldEl = document.getElementById('stat-avg-yield');

    if (totalEl) totalEl.textContent = stocksData.length;
    
    const champCount = stocksData.filter(s => s.is_10yr_non_decreasing).length;
    if (champEl) champEl.textContent = champCount;

    if (stocksData.length > 0) {
        const avgYield = (stocksData.reduce((acc, s) => acc + s.dividend_yield, 0) / stocksData.length).toFixed(2);
        if (avgYieldEl) avgYieldEl.textContent = `${avgYield}%`;
    }
}

// イベントリスナーの設定
function setupEventListeners() {
    // タブ切り替え
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            const clickedBtn = e.currentTarget;
            clickedBtn.classList.add('active');
            currentTab = clickedBtn.dataset.tab;
            
            // シミュレーター画面のトグル
            const simPanel = document.getElementById('simulator-panel');
            const stocksSection = document.getElementById('stocks-section');
            if (currentTab === 'simulator') {
                if (simPanel) simPanel.style.display = 'block';
                if (stocksSection) stocksSection.style.display = 'none';
                calculateDividendSimulation();
            } else {
                if (simPanel) simPanel.style.display = 'none';
                if (stocksSection) stocksSection.style.display = 'block';
                renderStocksGrid();
            }
        });
    });

    // 検索・フィルターのリアルタイム入力
    ['search-input', 'sector-filter', 'ex-month-filter', 'payout-filter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => renderStocksGrid());
            el.addEventListener('change', () => renderStocksGrid());
        }
    });

    // シミュレーター入力
    const simAmount = document.getElementById('sim-amount-input');
    if (simAmount) {
        simAmount.addEventListener('input', calculateDividendSimulation);
    }

    // モーダル閉じる
    const closeBtn = document.getElementById('modal-close-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }
}

// 銘柄グリッドのフィルタリング＆ソートレンダリング
function renderStocksGrid() {
    const grid = document.getElementById('stocks-grid');
    const titleEl = document.getElementById('view-title');
    const countEl = document.getElementById('result-count');
    if (!grid) return;

    let filtered = [...stocksData];

    // タブごとの基本フィルタリング＆ソート
    if (currentTab === 'safety') {
        // 10年以上減配なしを最優先 ＋ 安心度スコア順
        if (titleEl) titleEl.innerHTML = '🛡️ 10年以上 減配なし優良銘柄 <span class="badge-free">安心度順</span>';
        filtered = filtered.filter(s => s.is_10yr_non_decreasing);
        filtered.sort((a, b) => b.safety_score - a.safety_score);
    } else if (currentTab === 'all') {
        if (titleEl) titleEl.textContent = '📢 本日の全・増配発表銘柄 (新着順)';
        filtered.sort((a, b) => new Date(b.announced_date) - new Date(a.announced_date));
    } else if (currentTab === 'yield') {
        if (titleEl) titleEl.textContent = '💎 高配当銘柄ランキング (配当利回り順)';
        filtered.sort((a, b) => b.dividend_yield - a.dividend_yield);
    } else if (currentTab === 'growth') {
        if (titleEl) titleEl.textContent = '🚀 大幅増配サプライズ (増配率順)';
        filtered.sort((a, b) => b.dividend_growth_rate - a.dividend_growth_rate);
    } else if (currentTab === 'watchlist') {
        if (titleEl) titleEl.textContent = '⭐ お気に入り（ウォッチリスト）';
        filtered = filtered.filter(s => watchlist.includes(s.code));
    }

    // 検索キーワードフィルター
    const searchVal = document.getElementById('search-input')?.value.trim().toLowerCase() || '';
    if (searchVal) {
        filtered = filtered.filter(s => 
            s.code.toLowerCase().includes(searchVal) || 
            s.name.toLowerCase().includes(searchVal)
        );
    }

    // 業種フィルター
    const sectorVal = document.getElementById('sector-filter')?.value || '';
    if (sectorVal) {
        filtered = filtered.filter(s => s.sector === sectorVal);
    }

    // 権利確定月フィルター
    const monthVal = document.getElementById('ex-month-filter')?.value || '';
    if (monthVal) {
        filtered = filtered.filter(s => s.ex_dividend_month === monthVal);
    }

    // 配当性向フィルター
    const payoutVal = document.getElementById('payout-filter')?.value || '';
    if (payoutVal === 'safe') {
        filtered = filtered.filter(s => s.payout_ratio <= 50.0);
    }

    if (countEl) countEl.textContent = `${filtered.length}件を表示中`;

    // カード一覧 HTML生成
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted);">
                <i data-lucide="search-x" style="width:48px; height:48px; stroke-width:1.5; margin-bottom:12px;"></i>
                <p>条件に一致する銘柄が見つかりませんでした。</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    grid.innerHTML = filtered.map(stock => createStockCardHTML(stock)).join('');
    lucide.createIcons();
}

// 個別銘柄カードのHTML生成
function createStockCardHTML(s) {
    const isFav = watchlist.includes(s.code);
    const isChamp = s.is_10yr_non_decreasing;
    
    // 配当性向の安全度カラークラス
    let payoutClass = 'safe';
    let payoutText = '安全 (<50%)';
    if (s.payout_ratio > 80.0) {
        payoutClass = 'danger';
        payoutText = '注意 (>80%)';
    } else if (s.payout_ratio > 50.0) {
        payoutClass = 'moderate';
        payoutText = '普通 (50-80%)';
    }

    return `
        <div class="stock-card ${isChamp ? 'champion-card' : ''} fade-in" onclick="openModal('${s.code}')">
            ${isChamp ? `
                <div class="champion-badge">
                    <i data-lucide="shield-check"></i> ${s.non_decreasing_years}年連続 減配なし実績 (累進配当)
                </div>
            ` : ''}
            
            <div class="card-top">
                <div class="company-meta">
                    <span class="code-badge">${s.code}</span>
                    <div>
                        <div class="company-name">${escapeHTML(s.name)}</div>
                        <div class="sector-tag">${escapeHTML(s.sector)} • ${s.market}</div>
                    </div>
                </div>
                <button class="favorite-btn ${isFav ? 'active' : ''}" 
                        onclick="event.stopPropagation(); toggleWatchlist('${s.code}')" 
                        title="ウォッチリストに追加">
                    ★
                </button>
            </div>

            <div class="safety-gauge">
                <span class="safety-label"><i data-lucide="award"></i> 投資安心度スコア</span>
                <span class="safety-score">${s.safety_score} <small style="font-size:0.7rem;">/100</small></span>
            </div>

            <div class="card-metrics">
                <div class="metric-item">
                    <span class="metric-label">予想配当利回り</span>
                    <span class="metric-value" style="color: #fbbf24;">${s.dividend_yield.toFixed(2)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">増配修正</span>
                    <div class="dividend-change">
                        ${s.prev_dividend}円 ➔ ${s.new_dividend}円
                        <span class="growth-pill">+${s.dividend_growth_rate.toFixed(1)}%</span>
                    </div>
                </div>
                <div class="metric-item">
                    <span class="metric-label">配当性向</span>
                    <span class="metric-value">${s.payout_ratio.toFixed(1)}% <span class="payout-pill ${payoutClass}">${payoutText}</span></span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">株価 / 次回権利確定</span>
                    <span class="metric-value" style="font-size:0.9rem;">¥${s.stock_price.toLocaleString()} (${s.ex_dividend_month})</span>
                </div>
            </div>

            <div class="card-summary">
                ${escapeHTML(s.ai_summary)}
            </div>

            <div class="card-footer">
                <span>発表日: ${s.announced_date}</span>
                ${s.buyback_announced ? '<span class="buyback-tag">💰 自社株買い同時発表</span>' : ''}
            </div>
        </div>
    `;
}

// ウォッチリスト切り替え
function toggleWatchlist(code) {
    if (watchlist.includes(code)) {
        watchlist = watchlist.filter(c => c !== code);
    } else {
        watchlist.push(code);
    }
    localStorage.setItem('dividend_watchlist', JSON.stringify(watchlist));
    renderStocksGrid();
}

// モーダルダイアログ表示
function openModal(code) {
    const stock = stocksData.find(s => s.code === code);
    if (!stock) return;

    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body-content');
    if (!overlay || !body) return;

    body.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <span class="code-badge" style="font-size:1rem; padding:4px 10px;">${stock.code}</span>
                <h2 style="font-size:1.4rem; font-weight:800;">${escapeHTML(stock.name)}</h2>
            </div>
            <p style="color:var(--text-muted); font-size:0.875rem;">${stock.sector} | ${stock.market}市場 | 次回権利確定日: ${stock.next_ex_date}</p>
        </div>

        <div style="background:var(--bg-primary); padding:16px; border-radius:var(--radius-md); margin-bottom:20px; border:1px solid var(--border-color);">
            <h4 style="font-size:0.9rem; color:var(--accent-gold); margin-bottom:6px;">📄 適時開示発表の概要</h4>
            <p style="font-weight:700; margin-bottom:8px;">${escapeHTML(stock.announcement_title)}</p>
            <p style="font-size:0.875rem; color:var(--text-secondary); line-height:1.6;">${escapeHTML(stock.ai_summary)}</p>
        </div>

        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; margin-bottom:20px;">
            <div style="background:var(--bg-card); padding:12px; border-radius:var(--radius-sm);">
                <div style="font-size:0.75rem; color:var(--text-muted);">連続減配なし年数</div>
                <div style="font-size:1.2rem; font-weight:800; color:var(--accent-emerald);">${stock.non_decreasing_years}年連続 (累進配当)</div>
            </div>
            <div style="background:var(--bg-card); padding:12px; border-radius:var(--radius-sm);">
                <div style="font-size:0.75rem; color:var(--text-muted);">連続増配年数</div>
                <div style="font-size:1.2rem; font-weight:800; color:#fbbf24;">${stock.consecutive_increase_years}期連続</div>
            </div>
            <div style="background:var(--bg-card); padding:12px; border-radius:var(--radius-sm);">
                <div style="font-size:0.75rem; color:var(--text-muted);">年間配当額 (新予想)</div>
                <div style="font-size:1.2rem; font-weight:800;">1株あたり ${stock.new_dividend}円</div>
            </div>
            <div style="background:var(--bg-card); padding:12px; border-radius:var(--radius-sm);">
                <div style="font-size:0.75rem; color:var(--text-muted);">配当性向</div>
                <div style="font-size:1.2rem; font-weight:800;">${stock.payout_ratio}%</div>
            </div>
        </div>

        <div style="text-align:right;">
            <a href="${stock.announcement_url}" target="_blank" rel="noopener" 
               style="display:inline-flex; align-items:center; gap:6px; background:var(--accent-blue); color:#fff; text-decoration:none; padding:10px 18px; border-radius:var(--radius-sm); font-weight:700; font-size:0.875rem;">
               <i data-lucide="external-link"></i> TDnet 適時開示原文を開く
            </a>
        </div>
    `;

    overlay.classList.add('active');
    lucide.createIcons();
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('active');
}

// 配当金シミュレーター計算
function calculateDividendSimulation() {
    const amountInput = document.getElementById('sim-amount-input');
    const resultBox = document.getElementById('sim-annual-payout');
    const yieldBox = document.getElementById('sim-avg-yield');
    if (!amountInput || !resultBox) return;

    const principal = parseFloat(amountInput.value) || 0;

    // 10年以上非減配の優良銘柄に分散投資したと仮定した平均利回り
    const champions = stocksData.filter(s => s.is_10yr_non_decreasing);
    const avgYield = champions.length > 0 
        ? (champions.reduce((sum, s) => sum + s.dividend_yield, 0) / champions.length)
        : 3.35;

    const annualPayout = Math.floor(principal * (avgYield / 100));

    resultBox.textContent = `¥${annualPayout.toLocaleString()} / 年`;
    if (yieldBox) yieldBox.textContent = `(推定平均利回り: ${avgYield.toFixed(2)}%)`;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, match => {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return escapeMap[match];
    });
}

// フォールバックデータ
function getFallbackData() {
    return [
        {
            "code": "8593",
            "name": "三菱HCキャピタル",
            "sector": "その他金融業",
            "market": "プライム",
            "announced_date": "2026-09-22",
            "prev_dividend": 37.0,
            "new_dividend": 40.0,
            "dividend_growth_rate": 8.11,
            "stock_price": 1050,
            "dividend_yield": 3.81,
            "payout_ratio": 41.2,
            "non_decreasing_years": 25,
            "consecutive_increase_years": 25,
            "is_10yr_non_decreasing": true,
            "ex_dividend_month": "9月",
            "next_ex_date": "2026-09-29",
            "announcement_title": "業績好調に伴う通期配当予想の上方修正",
            "announcement_url": "https://www.release.tdnet.info/",
            "announcement_type": "株主還元方針改定",
            "buyback_announced": true,
            "safety_score": 98,
            "ai_summary": "年間配当を37円から40円に増配。25期連続増配を維持し、配当性向も41%台と極めて安全水準。"
        }
    ];
}
