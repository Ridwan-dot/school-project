// ===== PMS Application =====
const API = '/api';
let currentUser = null;
let token = localStorage.getItem('pms_token');
let charts = {};
let confirmCallback = null;
let currentProductId = null;

// ===== Helpers =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showLoading(show = true) {
  $('#loadingOverlay').classList.toggle('d-none', !show);
}

function toast(message, type = 'success') {
  const id = 't' + Date.now();
  const colors = { success: 'bg-success', error: 'bg-danger', warning: 'bg-warning text-dark', info: 'bg-info' };
  const html = `
    <div id="${id}" class="toast align-items-center text-white ${colors[type] || colors.info} border-0 show" role="alert">
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`;
  $('#toastContainer').insertAdjacentHTML('beforeend', html);
  setTimeout(() => { const el = document.getElementById(id); if (el) el.remove(); }, 4000);
}

async function api(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + endpoint, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    logout(true);
    throw new Error(data.message || 'Unauthorized');
  }
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(status) {
  const labels = {
    safe: '🟢 Safe', '30days': '🟡 30 Days', '14days': '🟠 14 Days',
    '7days': '🔴 7 Days', '3days': '🟣 3 Days', expired: '⚫ Expired'
  };
  return `<span class="badge-status badge-${status}">${labels[status] || status}</span>`;
}

function showConfirm(message, callback) {
  $('#confirmMessage').textContent = message;
  confirmCallback = callback;
  new bootstrap.Modal($('#confirmModal')).show();
}

// ===== Auth =====
async function login(email, password) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  token = data.token;
  localStorage.setItem('pms_token', token);
  currentUser = data.user;
  if ($('#rememberMe').checked) localStorage.setItem('pms_remember', email);
  showApp();
  toast('Welcome back, ' + currentUser.name + '!');
}

function logout(silent = false) {
  token = null;
  currentUser = null;
  localStorage.removeItem('pms_token');
  $('#app').classList.add('d-none');
  $('#loginPage').classList.remove('d-none');
  if (!silent) toast('Logged out successfully', 'info');
}

async function checkAuth() {
  if (!token) return false;
  try {
    const data = await api('/auth/me');
    currentUser = data.user;
    return true;
  } catch {
    return false;
  }
}

function showApp() {
  $('#loginPage').classList.add('d-none');
  $('#app').classList.remove('d-none');
  $('#userName').textContent = currentUser.name;
  $('#userRole').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Staff';
  $('#userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
  
  // Admin only items
  $$('.admin-only').forEach(el => {
    el.classList.toggle('d-none', currentUser.role !== 'admin');
  });
  
  loadPage('dashboard');
  refreshNotifBadge();
}

// ===== Navigation =====
function loadPage(page) {
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = $(`.nav-item[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  
  // Close mobile sidebar
  $('#sidebar').classList.remove('show');
  const overlay = $('.sidebar-overlay');
  if (overlay) overlay.remove();
  
  const content = $('#pageContent');
  content.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
  
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'products': renderProducts(); break;
    case 'alerts': renderAlerts(); break;
    case 'reports': renderReports(); break;
    case 'staff': renderStaff(); break;
    case 'logs': renderLogs(); break;
    default: renderDashboard();
  }
}

// ===== Dashboard =====
async function renderDashboard() {
  try {
    const data = await api('/products/stats/dashboard');
    const s = data.stats;
    
    const isAdmin = currentUser.role === 'admin';
    
    let html = `
      <div class="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Welcome back, ${currentUser.name}. Here's your inventory overview.</p>
        </div>
        <button class="btn btn-primary" onclick="openProductModal()">
          <i class="bi bi-plus-lg"></i> Add Product
        </button>
      </div>
      
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div class="stat-card">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-label">Total Products</div>
                <div class="stat-value">${s.totalProducts}</div>
              </div>
              <div class="stat-icon blue"><i class="bi bi-box-seam"></i></div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-label">Near Expiry</div>
                <div class="stat-value text-warning">${s.nearExpiry}</div>
              </div>
              <div class="stat-icon amber"><i class="bi bi-exclamation-triangle"></i></div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-label">Expired</div>
                <div class="stat-value text-danger">${s.expired}</div>
              </div>
              <div class="stat-icon red"><i class="bi bi-x-circle"></i></div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="stat-label">${isAdmin ? 'Total Staff' : 'Safe Products'}</div>
                <div class="stat-value text-success">${isAdmin ? s.totalStaff : s.safe}</div>
              </div>
              <div class="stat-icon ${isAdmin ? 'purple' : 'green'}"><i class="bi bi-${isAdmin ? 'people' : 'check-circle'}"></i></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row g-3 mb-4">
        <div class="col-lg-4">
          <div class="card-panel h-100">
            <div class="card-header">Status Distribution</div>
            <div class="card-body">
              <div class="chart-container"><canvas id="statusChart"></canvas></div>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card-panel h-100">
            <div class="card-header">Products by Category</div>
            <div class="card-body">
              <div class="chart-container"><canvas id="categoryChart"></canvas></div>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card-panel h-100">
            <div class="card-header">Monthly Products Added</div>
            <div class="card-body">
              <div class="chart-container"><canvas id="monthlyChart"></canvas></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card-panel">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span>Recent Alerts</span>
          <a href="#" class="btn btn-sm btn-outline-primary" data-page="alerts">View All</a>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-modern mb-0">
              <thead><tr><th>Product</th><th>Alert</th><th>Severity</th><th>Date</th></tr></thead>
              <tbody>
                ${s.recentAlerts.length ? s.recentAlerts.map(a => `
                  <tr>
                    <td class="fw-medium">${a.productName}</td>
                    <td>${a.message}</td>
                    <td><span class="badge bg-${a.severity === 'critical' ? 'danger' : a.severity === 'danger' ? 'warning' : a.severity === 'warning' ? 'warning' : 'info'}">${a.severity}</span></td>
                    <td>${formatDate(a.createdAt)}</td>
                  </tr>
                `).join('') : '<tr><td colspan="4" class="text-center text-muted py-4">No recent alerts</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    $('#pageContent').innerHTML = html;
    
    // Charts
    destroyCharts();
    const sc = s.statusCounts;
    charts.status = new Chart($('#statusChart'), {
      type: 'doughnut',
      data: {
        labels: ['Safe', '30 Days', '14 Days', '7 Days', '3 Days', 'Expired'],
        datasets: [{
          data: [sc.safe, sc['30days'], sc['14days'], sc['7days'], sc['3days'], sc.expired],
          backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#a855f7', '#1e293b'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } } } }
    });
    
    charts.category = new Chart($('#categoryChart'), {
      type: 'bar',
      data: {
        labels: s.categories.map(c => c._id),
        datasets: [{
          label: 'Products',
          data: s.categories.map(c => c.count),
          backgroundColor: '#2563eb',
          borderRadius: 6
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
    
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    charts.monthly = new Chart($('#monthlyChart'), {
      type: 'line',
      data: {
        labels: s.monthlyAdded.map(m => months[m._id.month - 1] + ' ' + m._id.year),
        datasets: [{
          label: 'Products Added',
          data: s.monthlyAdded.map(m => m.count),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
    
  } catch (err) {
    $('#pageContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function destroyCharts() {
  Object.values(charts).forEach(c => { if (c) c.destroy(); });
  charts = {};
}

// ===== Products =====
let productsState = { page: 1, search: '', status: 'all', category: 'all', sort: 'newest' };

async function renderProducts() {
  try {
    const params = new URLSearchParams({
      page: productsState.page,
      limit: 10,
      search: productsState.search,
      status: productsState.status,
      category: productsState.category,
      sort: productsState.sort
    });
    const data = await api('/products?' + params);
    
    let html = `
      <div class="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <div>
          <h1 class="page-title">Products</h1>
          <p class="page-subtitle">Manage inventory and monitor expiry dates</p>
        </div>
        <button class="btn btn-primary" onclick="openProductModal()"><i class="bi bi-plus-lg"></i> Add Product</button>
      </div>
      
      <div class="card-panel mb-3">
        <div class="card-body">
          <div class="row g-2 align-items-end">
            <div class="col-md-3">
              <label class="form-label small">Search</label>
              <input type="text" class="form-control form-control-sm" id="prodSearch" value="${productsState.search}" placeholder="Name or category...">
            </div>
            <div class="col-md-2">
              <label class="form-label small">Status</label>
              <select class="form-select form-select-sm" id="prodStatus">
                <option value="all">All Status</option>
                <option value="safe" ${productsState.status==='safe'?'selected':''}>Safe</option>
                <option value="30days" ${productsState.status==='30days'?'selected':''}>30 Days</option>
                <option value="14days" ${productsState.status==='14days'?'selected':''}>14 Days</option>
                <option value="7days" ${productsState.status==='7days'?'selected':''}>7 Days</option>
                <option value="3days" ${productsState.status==='3days'?'selected':''}>3 Days</option>
                <option value="expired" ${productsState.status==='expired'?'selected':''}>Expired</option>
              </select>
            </div>
            <div class="col-md-2">
              <label class="form-label small">Category</label>
              <select class="form-select form-select-sm" id="prodCategory">
                <option value="all">All Categories</option>
                ${(data.categories || []).map(c => `<option value="${c}" ${productsState.category===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="col-md-2">
              <label class="form-label small">Sort By</label>
              <select class="form-select form-select-sm" id="prodSort">
                <option value="newest">Newest</option>
                <option value="expiry_asc">Expiry (Soonest)</option>
                <option value="expiry_desc">Expiry (Latest)</option>
                <option value="name_asc">Name A-Z</option>
                <option value="quantity_desc">Qty High-Low</option>
              </select>
            </div>
            <div class="col-md-3">
              <button class="btn btn-primary btn-sm me-1" onclick="applyProductFilters()"><i class="bi bi-funnel"></i> Filter</button>
              <button class="btn btn-outline-secondary btn-sm" onclick="resetProductFilters()">Reset</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card-panel">
        <div class="table-responsive">
          <table class="table table-modern mb-0">
            <thead>
              <tr>
                <th>Product</th><th>Category</th><th>Qty</th><th>Mfg Date</th><th>Expiry</th><th>Remaining</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.products.length ? data.products.map(p => `
                <tr>
                  <td class="fw-medium cursor-pointer text-primary" onclick="viewProduct('${p._id}')">${p.name}</td>
                  <td>${p.category}</td>
                  <td>${p.quantity}</td>
                  <td>${formatDate(p.manufacturingDate)}</td>
                  <td>${formatDate(p.expiryDate)}</td>
                  <td>${p.remainingDays < 0 ? p.remainingDays + ' (over)' : p.remainingDays + ' days'}</td>
                  <td>${statusBadge(p.status)}</td>
                  <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="viewProduct('${p._id}')" title="View"><i class="bi bi-eye"></i></button>
                    <button class="btn btn-sm btn-outline-secondary me-1" onclick="editProduct('${p._id}')" title="Edit"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${p._id}', '${p.name.replace(/'/g, "\\'")}')" title="Delete"><i class="bi bi-trash"></i></button>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="8" class="text-center text-muted py-5">No products found</td></tr>'}
            </tbody>
          </table>
        </div>
        ${data.pagination.pages > 1 ? `
          <div class="d-flex justify-content-between align-items-center p-3 border-top">
            <small class="text-muted">Showing page ${data.pagination.page} of ${data.pagination.pages} (${data.pagination.total} total)</small>
            <div>
              <button class="btn btn-sm btn-outline-primary me-1" ${data.pagination.page <= 1 ? 'disabled' : ''} onclick="productsState.page--; renderProducts()">Prev</button>
              <button class="btn btn-sm btn-outline-primary" ${data.pagination.page >= data.pagination.pages ? 'disabled' : ''} onclick="productsState.page++; renderProducts()">Next</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    $('#pageContent').innerHTML = html;
  } catch (err) {
    $('#pageContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function applyProductFilters() {
  productsState.search = $('#prodSearch')?.value || '';
  productsState.status = $('#prodStatus')?.value || 'all';
  productsState.category = $('#prodCategory')?.value || 'all';
  productsState.sort = $('#prodSort')?.value || 'newest';
  productsState.page = 1;
  renderProducts();
}

function resetProductFilters() {
  productsState = { page: 1, search: '', status: 'all', category: 'all', sort: 'newest' };
  renderProducts();
}

function openProductModal(product = null) {
  $('#productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
  $('#productId').value = product ? product._id : '';
  $('#productName').value = product ? product.name : '';
  $('#productCategory').value = product ? product.category : '';
  $('#productQty').value = product ? product.quantity : '';
  $('#productMfg').value = product ? product.manufacturingDate?.substring(0, 10) : '';
  $('#productExpiry').value = product ? product.expiryDate?.substring(0, 10) : '';
  $('#productDesc').value = product ? (product.description || '') : '';
  new bootstrap.Modal($('#productModal')).show();
}

async function editProduct(id) {
  try {
    const data = await api('/products/' + id);
    openProductModal(data.product);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function viewProduct(id) {
  try {
    const data = await api('/products/' + id);
    const p = data.product;
    currentProductId = id;
    
    $('#detailBody').innerHTML = `
      <div class="row g-3">
        <div class="col-md-6">
          <h4 class="fw-bold mb-1">${p.name}</h4>
          <p class="text-muted mb-3">${p.category}</p>
          <table class="table table-sm">
            <tr><td class="text-muted">Quantity</td><td class="fw-medium">${p.quantity}</td></tr>
            <tr><td class="text-muted">Manufacturing</td><td>${formatDate(p.manufacturingDate)}</td></tr>
            <tr><td class="text-muted">Expiry Date</td><td>${formatDate(p.expiryDate)}</td></tr>
            <tr><td class="text-muted">Remaining Days</td><td class="fw-bold">${p.remainingDays < 0 ? Math.abs(p.remainingDays) + ' days overdue' : p.remainingDays + ' days'}</td></tr>
            <tr><td class="text-muted">Status</td><td>${statusBadge(p.status)}</td></tr>
            <tr><td class="text-muted">Added By</td><td>${p.addedBy?.name || '-'}</td></tr>
            <tr><td class="text-muted">Last Updated</td><td>${p.lastUpdatedBy?.name || '-'} on ${formatDate(p.updatedAt)}</td></tr>
          </table>
          ${p.description ? `<p class="mt-2"><strong>Description:</strong> ${p.description}</p>` : ''}
        </div>
        <div class="col-md-6">
          <h6 class="fw-semibold mb-2">Alert History</h6>
          <div style="max-height: 280px; overflow-y: auto;">
            ${data.alerts.length ? data.alerts.map(a => `
              <div class="border rounded p-2 mb-2">
                <div class="d-flex justify-content-between">
                  <span class="badge bg-${a.severity === 'critical' ? 'danger' : 'warning'}">${a.type}</span>
                  <small class="text-muted">${formatDate(a.createdAt)}</small>
                </div>
                <small>${a.message}</small>
              </div>
            `).join('') : '<p class="text-muted small">No alerts for this product</p>'}
          </div>
        </div>
      </div>
    `;
    new bootstrap.Modal($('#detailModal')).show();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function deleteProduct(id, name) {
  showConfirm(`Are you sure you want to delete "${name}"? This cannot be undone.`, async () => {
    try {
      await api('/products/' + id, { method: 'DELETE' });
      toast('Product deleted successfully');
      bootstrap.Modal.getInstance($('#confirmModal'))?.hide();
      bootstrap.Modal.getInstance($('#detailModal'))?.hide();
      if ($('.nav-item.active')?.dataset.page === 'products') renderProducts();
      else loadPage('dashboard');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ===== Alerts =====
async function renderAlerts() {
  try {
    const data = await api('/alerts?limit=50');
    
    let html = `
      <div class="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <div>
          <h1 class="page-title">Expiry Alerts</h1>
          <p class="page-subtitle">${data.unreadCount} unread alerts</p>
        </div>
        <button class="btn btn-outline-primary btn-sm" onclick="markAllAlertsRead()"><i class="bi bi-check2-all"></i> Mark All Read</button>
      </div>
      
      <div class="card-panel">
        <div class="table-responsive">
          <table class="table table-modern mb-0">
            <thead><tr><th>Product</th><th>Message</th><th>Type</th><th>Severity</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${data.alerts.length ? data.alerts.map(a => `
                <tr class="${!a.isRead ? 'table-active' : ''}">
                  <td class="fw-medium">${a.productName}</td>
                  <td>${a.message}</td>
                  <td>${statusBadge(a.type)}</td>
                  <td><span class="badge bg-${a.severity === 'critical' ? 'danger' : a.severity === 'danger' ? 'warning text-dark' : a.severity === 'warning' ? 'warning text-dark' : 'info'}">${a.severity}</span></td>
                  <td>${formatDate(a.createdAt)}</td>
                  <td>${a.isRead ? '<span class="text-muted">Read</span>' : '<span class="badge bg-primary">New</span>'}</td>
                  <td>
                    ${!a.isRead ? `<button class="btn btn-sm btn-outline-primary" onclick="markAlertRead('${a._id}')"><i class="bi bi-check"></i></button>` : ''}
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="7" class="text-center text-muted py-5">No alerts</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    $('#pageContent').innerHTML = html;
    refreshNotifBadge();
  } catch (err) {
    $('#pageContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

async function markAlertRead(id) {
  await api('/alerts/' + id + '/read', { method: 'PATCH' });
  renderAlerts();
}

async function markAllAlertsRead() {
  await api('/alerts/read-all', { method: 'PATCH' });
  toast('All alerts marked as read');
  renderAlerts();
  refreshNotifBadge();
}

async function refreshNotifBadge() {
  try {
    const data = await api('/alerts/unread-count');
    const badge = $('#notifBadge');
    const sideBadge = $('#sidebarAlertBadge');
    if (data.count > 0) {
      badge.textContent = data.count > 99 ? '99+' : data.count;
      badge.classList.remove('d-none');
      if (sideBadge) { sideBadge.textContent = data.count; sideBadge.classList.remove('d-none'); }
    } else {
      badge.classList.add('d-none');
      if (sideBadge) sideBadge.classList.add('d-none');
    }
    
    // Update dropdown
    const alertsData = await api('/alerts?limit=5&unread=true');
    const list = $('#notifList');
    if (alertsData.alerts.length) {
      list.innerHTML = alertsData.alerts.map(a => `
        <div class="notif-item unread" onclick="loadPage('alerts')">
          <div class="fw-medium small">${a.productName}</div>
          <div class="text-muted" style="font-size:0.75rem;">${a.message}</div>
          <div class="text-muted" style="font-size:0.7rem;">${formatDate(a.createdAt)}</div>
        </div>
      `).join('');
    } else {
      list.innerHTML = '<div class="text-center text-muted py-4">No new notifications</div>';
    }
  } catch {}
}

// ===== Reports =====
async function renderReports() {
  try {
    const data = await api('/reports');
    const r = data.report;
    
    let html = `
      <div class="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2 no-print">
        <div>
          <h1 class="page-title">Inventory Reports</h1>
          <p class="page-subtitle">Generated ${formatDate(r.generatedAt)}</p>
        </div>
        <button class="btn btn-primary" onclick="window.print()"><i class="bi bi-printer"></i> Print Report</button>
      </div>
      
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-2"><div class="stat-card text-center"><div class="stat-value">${r.summary.totalProducts}</div><div class="stat-label">Total</div></div></div>
        <div class="col-6 col-md-2"><div class="stat-card text-center"><div class="stat-value text-success">${r.summary.activeProducts}</div><div class="stat-label">Active</div></div></div>
        <div class="col-6 col-md-2"><div class="stat-card text-center"><div class="stat-value text-warning">${r.summary.nearExpiry}</div><div class="stat-label">Near Expiry</div></div></div>
        <div class="col-6 col-md-2"><div class="stat-card text-center"><div class="stat-value text-danger">${r.summary.expired}</div><div class="stat-label">Expired</div></div></div>
        <div class="col-6 col-md-2"><div class="stat-card text-center"><div class="stat-value text-primary">${r.summary.safe}</div><div class="stat-label">Safe</div></div></div>
        <div class="col-6 col-md-2"><div class="stat-card text-center"><div class="stat-value">${r.summary.totalQuantity}</div><div class="stat-label">Total Qty</div></div></div>
      </div>
      
      <div class="row g-3 mb-4">
        <div class="col-lg-6">
          <div class="card-panel">
            <div class="card-header">By Category</div>
            <div class="table-responsive">
              <table class="table table-modern mb-0">
                <thead><tr><th>Category</th><th>Count</th><th>Qty</th><th>Near Exp</th><th>Expired</th></tr></thead>
                <tbody>
                  ${r.byCategory.map(c => `<tr><td>${c._id}</td><td>${c.count}</td><td>${c.totalQty}</td><td>${c.nearExpiry}</td><td>${c.expired}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="card-panel">
            <div class="card-header">Expiring Soon / Expired</div>
            <div class="table-responsive">
              <table class="table table-modern mb-0">
                <thead><tr><th>Product</th><th>Category</th><th>Expiry</th><th>Status</th></tr></thead>
                <tbody>
                  ${r.expiringSoon.map(p => `<tr><td>${p.name}</td><td>${p.category}</td><td>${formatDate(p.expiryDate)}</td><td>${statusBadge(p.status)}</td></tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted">None</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
    $('#pageContent').innerHTML = html;
  } catch (err) {
    $('#pageContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

// ===== Staff =====
async function renderStaff() {
  if (currentUser.role !== 'admin') {
    $('#pageContent').innerHTML = '<div class="alert alert-warning">Access denied</div>';
    return;
  }
  try {
    const data = await api('/users');
    
    let html = `
      <div class="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <div>
          <h1 class="page-title">Staff Management</h1>
          <p class="page-subtitle">Manage employee accounts</p>
        </div>
        <button class="btn btn-primary" onclick="openStaffModal()"><i class="bi bi-person-plus"></i> Add Staff</button>
      </div>
      
      <div class="card-panel">
        <div class="table-responsive">
          <table class="table table-modern mb-0">
            <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Last Login</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              ${data.users.map(u => `
                <tr>
                  <td class="fw-medium">${u.name}</td>
                  <td>${u.email}</td>
                  <td><span class="badge ${u.isActive ? 'bg-success' : 'bg-secondary'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>${u.lastLogin ? formatDate(u.lastLogin) : 'Never'}</td>
                  <td>${formatDate(u.createdAt)}</td>
                  <td>
                    <button class="btn btn-sm btn-outline-secondary me-1" onclick="editStaff('${u._id}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-${u.isActive ? 'warning' : 'success'} me-1" onclick="toggleStaff('${u._id}')" title="${u.isActive ? 'Deactivate' : 'Activate'}">
                      <i class="bi bi-${u.isActive ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteStaff('${u._id}', '${u.name}')"><i class="bi bi-trash"></i></button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="text-center text-muted py-4">No staff members</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    $('#pageContent').innerHTML = html;
  } catch (err) {
    $('#pageContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function openStaffModal(staff = null) {
  $('#staffModalTitle').textContent = staff ? 'Edit Staff' : 'Add Staff';
  $('#staffId').value = staff ? staff._id || staff.id : '';
  $('#staffName').value = staff ? staff.name : '';
  $('#staffEmail').value = staff ? staff.email : '';
  $('#staffPassword').value = '';
  $('#pwdHint').textContent = staff ? '(leave blank to keep current)' : '(min 6 chars)';
  $('#staffPassword').required = !staff;
  $('#staffActive').checked = staff ? staff.isActive !== false : true;
  $('#staffActiveCheck').style.display = staff ? 'block' : 'none';
  new bootstrap.Modal($('#staffModal')).show();
}

async function editStaff(id) {
  try {
    const data = await api('/users');
    const staff = data.users.find(u => u._id === id);
    if (staff) openStaffModal(staff);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function toggleStaff(id) {
  try {
    const data = await api('/users/' + id + '/toggle', { method: 'PATCH' });
    toast(data.message);
    renderStaff();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function deleteStaff(id, name) {
  showConfirm(`Delete staff account "${name}"? This cannot be undone.`, async () => {
    try {
      await api('/users/' + id, { method: 'DELETE' });
      toast('Staff deleted');
      bootstrap.Modal.getInstance($('#confirmModal'))?.hide();
      renderStaff();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ===== Logs =====
async function renderLogs() {
  if (currentUser.role !== 'admin') {
    $('#pageContent').innerHTML = '<div class="alert alert-warning">Access denied</div>';
    return;
  }
  try {
    const data = await api('/logs?limit=50');
    
    let html = `
      <div class="mb-4">
        <h1 class="page-title">Activity Logs</h1>
        <p class="page-subtitle">Track all system activities</p>
      </div>
      <div class="card-panel">
        <div class="table-responsive">
          <table class="table table-modern mb-0">
            <thead><tr><th>User</th><th>Action</th><th>Details</th><th>Time</th></tr></thead>
            <tbody>
              ${data.logs.map(l => `
                <tr>
                  <td class="fw-medium">${l.userName}</td>
                  <td><span class="badge bg-light text-dark border">${l.action}</span></td>
                  <td>${l.details || '-'}</td>
                  <td>${formatDate(l.createdAt)} ${new Date(l.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" class="text-center text-muted py-4">No logs</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    $('#pageContent').innerHTML = html;
  } catch (err) {
    $('#pageContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', async () => {
  // Login form
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginBtn');
    btn.querySelector('.btn-text').classList.add('d-none');
    btn.querySelector('.spinner-border').classList.remove('d-none');
    btn.disabled = true;
    try {
      await login($('#loginEmail').value, $('#loginPassword').value);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.querySelector('.btn-text').classList.remove('d-none');
      btn.querySelector('.spinner-border').classList.add('d-none');
      btn.disabled = false;
    }
  });
  
  $('#togglePassword').addEventListener('click', () => {
    const inp = $('#loginPassword');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
  
  // Nav
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-page]');
    if (nav) {
      e.preventDefault();
      loadPage(nav.dataset.page);
    }
  });
  
  $('#logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
  
  // Sidebar toggle mobile
  $('#sidebarToggle')?.addEventListener('click', () => {
    $('#sidebar').classList.toggle('show');
    if ($('#sidebar').classList.contains('show')) {
      const ov = document.createElement('div');
      ov.className = 'sidebar-overlay';
      ov.onclick = () => { $('#sidebar').classList.remove('show'); ov.remove(); };
      document.body.appendChild(ov);
    }
  });
  
  // Dark mode
  const theme = localStorage.getItem('pms_theme') || 'light';
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  $('#darkModeToggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('pms_theme', isDark ? 'light' : 'dark');
    $('#darkModeToggle').innerHTML = isDark
      ? '<i class="bi bi-moon-stars"></i> <span>Dark Mode</span>'
      : '<i class="bi bi-sun"></i> <span>Light Mode</span>';
  });
  
  // Product form
  $('#productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#productId').value;
    const body = {
      name: $('#productName').value,
      category: $('#productCategory').value,
      quantity: parseInt($('#productQty').value),
      manufacturingDate: $('#productMfg').value,
      expiryDate: $('#productExpiry').value,
      description: $('#productDesc').value
    };
    try {
      if (id) {
        await api('/products/' + id, { method: 'PUT', body: JSON.stringify(body) });
        toast('Product updated successfully');
      } else {
        await api('/products', { method: 'POST', body: JSON.stringify(body) });
        toast('Product added successfully');
      }
      bootstrap.Modal.getInstance($('#productModal')).hide();
      if ($('.nav-item.active')?.dataset.page === 'products') renderProducts();
      else loadPage('dashboard');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  
  // Staff form
  $('#staffForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#staffId').value;
    const body = {
      name: $('#staffName').value,
      email: $('#staffEmail').value
    };
    const pwd = $('#staffPassword').value;
    if (pwd) body.password = pwd;
    if (id) body.isActive = $('#staffActive').checked;
    
    try {
      if (id) {
        await api('/users/' + id, { method: 'PUT', body: JSON.stringify(body) });
        toast('Staff updated');
      } else {
        if (!pwd || pwd.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
        body.password = pwd;
        await api('/users', { method: 'POST', body: JSON.stringify(body) });
        toast('Staff created successfully');
      }
      bootstrap.Modal.getInstance($('#staffModal')).hide();
      renderStaff();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  
  // Confirm
  $('#confirmBtn').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
  });
  
  // Detail modal buttons
  $('#detailEditBtn').addEventListener('click', () => {
    bootstrap.Modal.getInstance($('#detailModal'))?.hide();
    if (currentProductId) editProduct(currentProductId);
  });
  $('#detailDeleteBtn').addEventListener('click', async () => {
    if (!currentProductId) return;
    try {
      const data = await api('/products/' + currentProductId);
      deleteProduct(currentProductId, data.product.name);
    } catch {}
  });
  
  // Mark all read
  $('#markAllRead')?.addEventListener('click', (e) => {
    e.preventDefault();
    markAllAlertsRead();
  });
  
  // Global search
  let searchTimeout;
  $('#globalSearch')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (e.target.value.length >= 2 || e.target.value.length === 0) {
        productsState.search = e.target.value;
        productsState.page = 1;
        loadPage('products');
      }
    }, 400);
  });
  
  // Init
  const remembered = localStorage.getItem('pms_remember');
  if (remembered) $('#loginEmail').value = remembered;
  
  showLoading(true);
  const authed = await checkAuth();
  showLoading(false);
  if (authed) showApp();
  else {
    $('#loginPage').classList.remove('d-none');
    $('#app').classList.add('d-none');
  }
  
  // Refresh notifications every 60s
  setInterval(refreshNotifBadge, 60000);
});
