import os

def replace_between(content, start_marker, end_marker, replacement):
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker, start_idx)
    if start_idx == -1 or end_idx == -1:
        print(f"Error finding markers: {start_marker[:20]} or {end_marker[:20]}")
        return content
    return content[:start_idx] + replacement + content[end_idx:]

new_get_finance_html = """function getFinanceHTML(prefix, title) {
      var displayTitle = title ? '<h3 style="margin-bottom:1rem; border-bottom:2px solid var(--aa-primary); padding-bottom:5px; color:var(--aa-primary);">'+title+'</h3>' : '';
      return `
        ${displayTitle}
        <div class="aa-grid-3 mb-4">
          <div class="aa-stat-card">
            <div class="aa-stat-icon bg-info"><i class="fa fa-file-invoice-dollar"></i></div>
            <div class="aa-stat-value" id="${prefix}-fin-billed">...0.00</div>
            <div class="aa-stat-label">Total Expected (Billed)</div>
          </div>
          <div class="aa-stat-card">
            <div class="aa-stat-icon bg-success"><i class="fa fa-wallet"></i></div>
            <div class="aa-stat-value" id="${prefix}-fin-collected">...0.00</div>
            <div class="aa-stat-label">Actual Revenue (Collected)</div>
          </div>
          <div class="aa-stat-card">
            <div class="aa-stat-icon bg-danger"><i class="fa fa-hand-holding-usd"></i></div>
            <div class="aa-stat-value" id="${prefix}-fin-outstanding">...0.00</div>
            <div class="aa-stat-label">Outstanding Debt</div>
          </div>
          <div class="aa-stat-card">
            <div class="aa-stat-icon bg-warning"><i class="fa fa-receipt"></i></div>
            <div class="aa-stat-value" id="${prefix}-fin-expense">...0.00</div>
            <div class="aa-stat-label">Total Expenses</div>
          </div>
          <div class="aa-stat-card">
            <div class="aa-stat-icon bg-navy"><i class="fa fa-balance-scale"></i></div>
            <div class="aa-stat-value" id="${prefix}-fin-net">...0.00</div>
            <div class="aa-stat-label">Net Cash Flow</div>
          </div>
          <div class="aa-stat-card">
            <div class="aa-stat-icon bg-primary"><i class="fa fa-chart-pie"></i></div>
            <div class="aa-stat-value" id="${prefix}-fin-rate">0%</div>
            <div class="aa-stat-label">Collection Rate</div>
          </div>
        </div>

        <div class="aa-grid-2 mb-4">
          <div class="aa-card">
            <div class="aa-card-header"><h3 class="aa-card-title"><i class="fa fa-chart-pie"></i> Revenue Breakdown</h3></div>
            <div class="aa-card-body">
              <canvas id="${prefix}-chartRevenue" style="max-height: 250px; width:100%;"></canvas>
            </div>
          </div>
          <div class="aa-card">
            <div class="aa-card-header"><h3 class="aa-card-title"><i class="fa fa-chart-bar"></i> Cash Flow Overview</h3></div>
            <div class="aa-card-body">
              <canvas id="${prefix}-chartCashFlow" style="max-height: 250px; width:100%;"></canvas>
            </div>
          </div>
        </div>

        <div class="aa-card mb-4">
          <div class="aa-card-header">
            <h3 class="aa-card-title">Top Debtors</h3>
            <button class="aa-btn aa-btn-primary aa-btn-sm" onclick="downloadDebtorsReport('${prefix}')"><i class="fa fa-download"></i> Export CSV</button>
          </div>
          <div class="aa-card-body" style="padding:0;">
            <table class="aa-table" id="${prefix}-finDebtorsTable">
              <thead><tr><th>Student</th><th>Class</th><th>Amount Owed</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      `;
    }

    """

new_fetch_and_render_finance = """function fetchAndRenderFinance(prefix) {
      var section = prefix === 'primary' ? 'primary' : 'high';
      // Fetch matched stats from backend for current term/session
      callServer('adminGetFinancialStats', [AA.token, currentTerm, currentSession, section], function(statsRes) {
        if(document.getElementById(prefix + '-fin-billed')) {
          var billed = statsRes.totalBilled || 0;
          var collected = statsRes.totalCollected || 0;
          var outstanding = statsRes.totalOutstanding || 0;
          var expense = statsRes.totalExpenses || 0;
          var net = statsRes.netBalance || (collected - expense);
          var rate = billed > 0 ? ((collected / billed) * 100).toFixed(1) : 0;

          document.getElementById(prefix + '-fin-billed').textContent = formatNaira(billed);
          document.getElementById(prefix + '-fin-collected').textContent = formatNaira(collected);
          document.getElementById(prefix + '-fin-outstanding').textContent = formatNaira(outstanding);
          document.getElementById(prefix + '-fin-expense').textContent = formatNaira(expense);
          
          var netEl = document.getElementById(prefix + '-fin-net');
          netEl.textContent = formatNaira(net);
          netEl.style.color = net >= 0 ? 'var(--aa-success)' : 'var(--aa-danger)';
          
          var rateEl = document.getElementById(prefix + '-fin-rate');
          rateEl.textContent = rate + '%';
          rateEl.style.color = rate >= 80 ? 'var(--aa-success)' : (rate >= 50 ? 'var(--aa-warning)' : 'var(--aa-danger)');

          // Render Charts
          if (typeof Chart !== 'undefined' && typeof chartInstances !== 'undefined') {
            // Revenue Doughnut
            if (chartInstances[prefix + '-revDoughnut']) chartInstances[prefix + '-revDoughnut'].destroy();
            var revCtx = document.getElementById(prefix + '-chartRevenue');
            if (revCtx) {
              chartInstances[prefix + '-revDoughnut'] = new Chart(revCtx, {
                type: 'doughnut',
                data: {
                  labels: ['Collected Revenue', 'Outstanding Debt'],
                  datasets: [{
                    data: [collected, outstanding],
                    backgroundColor: ['#4ade80', '#ef4444'],
                    borderWidth: 0
                  }]
                },
                options: { responsive: true, maintainAspectRatio: false }
              });
            }

            // Cash Flow Bar
            if (chartInstances[prefix + '-cashFlowBar']) chartInstances[prefix + '-cashFlowBar'].destroy();
            var cashCtx = document.getElementById(prefix + '-chartCashFlow');
            if (cashCtx) {
              chartInstances[prefix + '-cashFlowBar'] = new Chart(cashCtx, {
                type: 'bar',
                data: {
                  labels: ['Billed', 'Collected', 'Expenses', 'Net Flow'],
                  datasets: [{
                    label: 'Amount (₦)',
                    data: [billed, collected, expense, net],
                    backgroundColor: ['#3b82f6', '#4ade80', '#f59e0b', net >= 0 ? '#10b981' : '#ef4444'],
                    borderRadius: 4
                  }]
                },
                options: { 
                  responsive: true, 
                  maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true } },
                  plugins: { legend: { display: false } }
                }
              });
            }
          }
        }
      });

      // Fetch top debtors
      callServer('adminGetDebtors', [AA.token, currentTerm, currentSession, section], function(debtorsData) {
        if(document.getElementById(prefix + '-finDebtorsTable')) {
          var top = debtorsData.slice(0, 10);
          buildTable(prefix + '-finDebtorsTable', [
            {key:'studentName'},
            {key:'class'},
            {key:'amountOwed', render:function(r){ return '<span class="text-danger">'+formatNaira(r.amountOwed)+'</span>'; }}
          ], top);
        }
      });
    }

    """

def patch_admin():
    with open('AdminDashboard.html', 'r', encoding='utf-8') as f:
        c = f.read()
    c = replace_between(c, "function getFinanceHTML(prefix, title) {", "function downloadDebtorsReport(prefix) {", new_get_finance_html)
    c = replace_between(c, "function fetchAndRenderFinance(prefix) {", "function loadReports() {", new_fetch_and_render_finance)
    with open('AdminDashboard.html', 'w', encoding='utf-8', newline='\n') as f:
        f.write(c)

def patch_developer():
    with open('DeveloperDashboard.html', 'r', encoding='utf-8') as f:
        c = f.read()
    c = replace_between(c, "function getFinanceHTML(prefix, title) {", "function fetchAndRenderFinance(prefix) {", new_get_finance_html)
    c = replace_between(c, "function fetchAndRenderFinance(prefix) {", "function loadFinance() {", new_fetch_and_render_finance)
    with open('DeveloperDashboard.html', 'w', encoding='utf-8', newline='\n') as f:
        f.write(c)

os.chdir("c:\\\\Users\\\\OASISFAITH\\\\Desktop\\\\Portal Projects\\\\Myschool Portal Cloud Version")
patch_admin()
patch_developer()
print("Fixed files.")
