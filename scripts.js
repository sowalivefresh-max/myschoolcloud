/* ============================================================
   ABECEDARIAN ACADEMY - Shared Frontend JavaScript
   Decoupled version: uses fetch() via api.js instead of google.script.run
   ============================================================ */

// --- Session Management --------------------------------------

var AA = {
  token: null,
  user:  null,
  settings: {},

  escapeHTML: function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  init: function() {
    // Read token from URL ?token=...
    var params = new URLSearchParams(window.location.search);
    this.token = params.get('token');

    if (!this.token) {
      // No token → go to login
      window.location.href = 'Login.html';
      return;
    }
    this.loadCurrentUser();
    this.loadSettings();
  },

  loadCurrentUser: function() {
    var self = this;
    runBackendAction('getCurrentUser', [self.token])
      .then(function(res) {
        if (!res.success) { self.logout(); return; }
        self.user = res.user;
        if (res.user.isLocked && res.user.role !== 'developer') {
          return self.showPortalLockScreen(res.user.lockMessage);
        }
        self.renderUserInfo(res.user);
      })
      .catch(function(err) { 
        if (err && err.message === 'PORTAL_LOCKED') {
          return self.showPortalLockScreen();
        }
        self.logout(); 
      });
  },

  loadSettings: function() {
    var self = this;
    runBackendAction('getPublicBranding', [])
      .then(function(s) {
        self.settings = s || {};
        var nameEl = document.getElementById('sb-school-name');
        if (nameEl && s.school_name) nameEl.textContent = s.school_name;
        if (s.school_logo_url && (s.school_logo_url.indexOf('data:image') === 0 || s.school_logo_url.indexOf('http') === 0)) {
          var brandIcon = document.querySelector('.aa-brand-icon');
          if (brandIcon) {
            brandIcon.innerHTML = '<img src="' + s.school_logo_url + '" style="width:100%;height:100%;object-fit:contain;border-radius:50%;">';
          }
        }
      })
      .catch(function(e) { console.error('loadSettings error', e); });
  },

  renderUserInfo: function(user) {
    var initials = (user.fullName || 'U').split(' ').map(function(n){return n[0];}).join('').slice(0,2).toUpperCase();
    document.querySelectorAll('.aa-user-avatar').forEach(function(el) {
      if (user.profilePicture && (user.profilePicture.indexOf('data:image') === 0 || user.profilePicture.indexOf('http') === 0)) {
        el.innerHTML = '<img src="' + user.profilePicture + '" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      } else {
        el.textContent = initials;
      }
    });
    document.querySelectorAll('.aa-user-name').forEach(function(el) { el.textContent = user.fullName || ''; });
    document.querySelectorAll('.aa-user-role').forEach(function(el) { el.textContent = AA.formatRole(user.role || ''); });
  },

  updateProfile: function() {
    var fullName = document.getElementById('profName').value;
    var email = document.getElementById('profEmail').value;
    var phone = document.getElementById('profPhone').value;
    var photo = document.getElementById('profPhotoBase64').value;

    if (!fullName) return showToast('Name is required', 'error');
    if (!email) return showToast('Email is required', 'error');

    var data = { fullName: fullName, email: email, phone: phone };
    if (photo) data.profilePicture = photo;

    callServer('userUpdateProfile', [this.token, data], function(res) {
      showToast(res.message, res.success ? 'success' : 'error');
      if (res.success) {
        AA.loadCurrentUser();
        closeModal('profileModal');
      }
    }, null, true);
  },

  populateProfileModal: function() {
    var u = AA.user;
    if (!u) return openModal('profileModal');
    document.getElementById('profName').value = u.fullName || '';
    if (document.getElementById('profEmail')) document.getElementById('profEmail').value = u.email || '';
    document.getElementById('profPhone').value = u.phone || '';
    document.getElementById('profPhotoBase64').value = '';

    var avatarEl = document.querySelector('#profileModal .aa-user-avatar');
    if (avatarEl) {
      if (u.profilePicture && (u.profilePicture.indexOf('data:image') === 0 || u.profilePicture.indexOf('http') === 0)) {
        avatarEl.innerHTML = '<img src="' + u.profilePicture + '" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      } else {
        var names = (u.fullName || 'User').trim().split(' ');
        var initials = names.length > 1 ? (names[0][0] + names[names.length-1][0]) : names[0].substring(0, 2);
        avatarEl.textContent = initials.toUpperCase();
      }
    }
    openModal('profileModal');
  },

  changePwd: function() {
    var o = document.getElementById('oldPwd').value;
    var n = document.getElementById('newPwd').value;
    if (!o || !n) return showToast('Enter both passwords', 'error');
    callServer('userChangePassword', [AA.token, o, n], function(r) {
      showToast(r.message, r.success ? 'success' : 'error');
      if (r.success) {
        document.getElementById('oldPwd').value = '';
        document.getElementById('newPwd').value = '';
        closeModal('profileModal');
      }
    }, null, true);
  },

  logout: function() {
    if (this.token) {
      runBackendAction('logoutUser', [this.token]).catch(function(){});
    }
    window.location.href = 'Login.html';
  },

  showPortalLockScreen: function(customMessage) {
    var msg = customMessage || 'Your school portal has been temporarily locked due to outstanding subscription payments. Please contact the developer.';
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#f8d7da;color:#721c24;flex-direction:column;text-align:center;padding:40px;font-family:sans-serif;">' +
      '<i class="fa fa-lock" style="font-size:64px;margin-bottom:20px;"></i>' +
      '<h1 style="margin:0 0 15px 0;font-size:32px;">Portal Locked</h1>' +
      '<p style="font-size:18px;max-width:600px;line-height:1.5;">' + AA.escapeHTML(msg) + '</p>' +
      '<a href="Login.html" style="margin-top:30px;padding:10px 20px;background:#721c24;color:#fff;text-decoration:none;border-radius:4px;">Back to Login</a>' +
      '</div>';
  },

  formatRole: function(role) {
    var map = { admin:'Administrator', admin_assistant:'Admin Assistant', developer:'Portal Developer', principal:'Principal', vp:'Vice Principal',
      headteacher:'Head Teacher', teacher:'Subject Teacher', primary_teacher:'Class Teacher (Primary)',
      accounts:'Accounts Officer', parent:'Parent/Guardian' };
    return map[role] || role;
  }
};

// --- Server Call Wrapper -------------------------------------

/**
 * Wrapper for API calls with loading state management.
 * @param {string} fn - backend function name
 * @param {Array} args - arguments array
 * @param {Function} onSuccess - success callback
 * @param {Function} [onError] - optional error callback
 * @param {boolean} [showLoader] - show full-screen loader
 */
function callServer(fn, args, onSuccess, onError, showLoader) {
  if (showLoader) showLoading();
  runBackendAction(fn, args)
    .then(function(result) {
      if (showLoader) hideLoading();
      if (onSuccess) onSuccess(result);
    })
    .catch(function(err) {
      if (showLoader) hideLoading();
      var msg = err && err.message ? err.message : 'An error occurred. Please try again.';
      if (msg === 'PORTAL_LOCKED' && AA && AA.user && AA.user.role !== 'developer') {
        return AA.showPortalLockScreen(AA.user.lockMessage);
      }
      showToast(msg, 'error');
      if (onError) onError(err);
    });
}

// --- Loading Overlay -----------------------------------------

function showLoading(text) {
  var el = document.getElementById('aa-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aa-loading';
    el.className = 'aa-loading-overlay';
    el.innerHTML = '<div class="aa-spinner"></div><div class="aa-spinner-text">' + (text || 'Please wait...') + '</div>';
    document.body.appendChild(el);
  } else {
    el.querySelector('.aa-spinner-text').textContent = text || 'Please wait...';
    el.style.display = 'flex';
  }
}

function hideLoading() {
  var el = document.getElementById('aa-loading');
  if (el) el.style.display = 'none';
}

// --- Toast Notifications -------------------------------------

function showToast(message, type, duration) {
  var container = document.getElementById('aa-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'aa-toast-container';
    document.body.appendChild(container);
  }
  var icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  var t = type || 'info';
  var toast = document.createElement('div');
  toast.className = 'aa-toast ' + t;
  toast.innerHTML = '<span class="aa-toast-icon">' + (icons[t] || 'ℹ️') + '</span>' +
    '<span class="aa-toast-msg">' + message + '</span>' +
    '<button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;padding:0 0 0 8px;color:#888;font-size:16px;">×</button>';
  container.appendChild(toast);
  setTimeout(function() { if (toast.parentNode) toast.remove(); }, duration || 4000);
}

// --- Tab System -----------------------------------------------

function initTabs(tabGroupId) {
  var group = document.getElementById(tabGroupId);
  if (!group) return;
  group.querySelectorAll('.aa-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var target = tab.dataset.tab;
      group.querySelectorAll('.aa-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      document.querySelectorAll('.aa-tab-content[data-group="' + tabGroupId + '"]').forEach(function(c) {
        c.classList.toggle('active', c.dataset.id === target);
      });
      if (tab.dataset.onload) { window[tab.dataset.onload] && window[tab.dataset.onload](); }
    });
  });
}

function switchTab(tabGroupId, tabId) {
  var tab = document.querySelector('#' + tabGroupId + ' .aa-tab[data-tab="' + tabId + '"]');
  if (tab) tab.click();
}

// --- Modal System ---------------------------------------------

function openModal(id) {
  var m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  var m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('aa-modal-backdrop')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// --- Sidebar --------------------------------------------------

function initSidebar() {
  var toggle = document.getElementById('aa-menu-toggle');
  var sidebar = document.getElementById('aa-sidebar');
  var overlay = document.getElementById('aa-sidebar-overlay');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', function() {
    sidebar.classList.toggle('open');
    overlay && overlay.classList.toggle('open');
  });
  overlay && overlay.addEventListener('click', function() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

// --- Nav Item Activation --------------------------------------

function setActiveNav(id) {
  document.querySelectorAll('.aa-nav-item').forEach(function(el) { el.classList.remove('active'); });
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// --- Form Utilities -------------------------------------------

function getFormData(formId) {
  var form = document.getElementById(formId);
  if (!form) return {};
  var data = {};
  form.querySelectorAll('[name]').forEach(function(el) {
    var k = el.name; var v = el.value;
    if (el.type === 'checkbox') v = el.checked;
    if (el.type === 'number') v = parseFloat(v) || 0;
    if (el.multiple) {
      var arr = [];
      for (var i = 0; i < el.selectedOptions.length; i++) arr.push(el.selectedOptions[i].value);
      v = arr.join(',');
    }
    data[k] = v;
  });
  return data;
}

function resetForm(formId) {
  var form = document.getElementById(formId);
  if (form) form.reset();
}

function setFormData(formId, data) {
  var form = document.getElementById(formId);
  if (!form) return;
  Object.keys(data).forEach(function(k) {
    var el = form.querySelector('[name="' + k + '"]');
    if (el) {
      if (el.multiple && typeof data[k] === 'string') {
        var vals = data[k].split(',');
        for(var i = 0; i < el.options.length; i++) {
          el.options[i].selected = vals.indexOf(el.options[i].value) !== -1;
        }
      } else {
        el.value = data[k] !== null && data[k] !== undefined ? data[k] : '';
      }
    }
  });
}

// --- Table Utilities ------------------------------------------

function buildTable(tableId, columns, rows, actionFn) {
  var tbody = document.querySelector('#' + tableId + ' tbody');
  if (!tbody) return;
  
  if (rows && rows.success === false) {
    tbody.innerHTML = '<tr><td colspan="' + (columns.length + (actionFn ? 1 : 0)) + '" class="text-center text-danger" style="padding:32px;">' + (rows.message ? AA.escapeHTML(rows.message) : 'Error loading data.') + '</td></tr>';
    return;
  }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + (columns.length + (actionFn ? 1 : 0)) + '" class="text-center text-muted" style="padding:32px;">No records found.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(row, i) {
    var cells = columns.map(function(col) {
      var val = col.render ? col.render(row) : (row[col.key] !== undefined ? AA.escapeHTML(row[col.key]) : '');
      return '<td>' + (val !== null && val !== undefined ? val : '') + '</td>';
    }).join('');
    var actionCell = actionFn ? '<td>' + actionFn(row, i) + '</td>' : '';
    return '<tr>' + cells + actionCell + '</tr>';
  }).join('');
}

function filterTable(inputId, tableId) {
  var val = document.getElementById(inputId).value.toLowerCase();
  var rows = document.querySelectorAll('#' + tableId + ' tbody tr');
  rows.forEach(function(row) {
    row.style.display = row.textContent.toLowerCase().indexOf(val) !== -1 ? '' : 'none';
  });
}

// --- Formatting Utilities ------------------------------------

function safeFloat(val, def) {
  var f = parseFloat(val);
  return isNaN(f) ? (def || 0) : f;
}

function formatNaira(amount) {
  var n = parseFloat(amount) || 0;
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

function formatGrade(grade) {
  var cls = { 'A1':'grade-a1','B2':'grade-b2','B3':'grade-b3',
    'C4':'grade-c4','C5':'grade-c5','C6':'grade-c6','D7':'grade-d7','E8':'grade-e8','F9':'grade-f9' };
  return '<span class="' + (cls[grade] || '') + '">' + (grade || '') + '</span>';
}

function formatStatus(status) {
  if (!status) return '';
  var s = String(status).toLowerCase();
  var map = {
    'paid':        '<span class="aa-badge aa-badge-success">Paid</span>',
    'partial':     '<span class="aa-badge aa-badge-warning">Partial</span>',
    'outstanding': '<span class="aa-badge aa-badge-danger">Outstanding</span>',
    'active':      '<span class="aa-badge aa-badge-success">Active</span>',
    'suspended':   '<span class="aa-badge aa-badge-danger">Suspended</span>',
    'approved':    '<span class="aa-badge aa-badge-success">Approved</span>',
    'submitted':   '<span class="aa-badge aa-badge-info">Submitted</span>',
    'draft':       '<span class="aa-badge aa-badge-navy">Draft</span>',
    'rejected':    '<span class="aa-badge aa-badge-danger">Rejected</span>',
    'present':     '<span class="aa-badge aa-badge-success">Present</span>',
    'absent':      '<span class="aa-badge aa-badge-danger">Absent</span>',
    'late':        '<span class="aa-badge aa-badge-warning">Late</span>',
    'pending':     '<span class="aa-badge aa-badge-warning"><i class="fa fa-clock mr-1"></i> Pending</span>'
  };
  return map[s] || '<span class="aa-badge aa-badge-navy">' + status + '</span>';
}

function formatAttPct(pct) {
  var n = parseFloat(pct) || 0;
  var color = n >= 90 ? '#16a34a' : n >= 75 ? '#d97706' : '#dc2626';
  return '<span style="font-weight:600;color:' + color + '">' + n + '%</span>';
}

// --- Pagination -----------------------------------------------

var paginationState = {};

function paginate(data, pageSize, page) {
  var start = (page - 1) * pageSize;
  return data.slice(start, start + pageSize);
}

function renderPagination(containerId, total, pageSize, currentPage, onPage) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  var html = '<div class="d-flex align-items-center gap-2" style="font-size:12px;">';
  html += '<span class="text-muted">Page ' + currentPage + ' of ' + totalPages + '</span>';
  html += '<button class="aa-btn aa-btn-outline aa-btn-xs" ' + (currentPage <= 1 ? 'disabled' : '') + ' onclick="(' + onPage + ')(' + (currentPage - 1) + ')">‹ Prev</button>';
  html += '<button class="aa-btn aa-btn-outline aa-btn-xs" ' + (currentPage >= totalPages ? 'disabled' : '') + ' onclick="(' + onPage + ')(' + (currentPage + 1) + ')">Next ›</button>';
  html += '</div>';
  el.innerHTML = html;
}

// --- Confirm Dialog -------------------------------------------

function aaConfirm(message, onConfirm) {
  var existing = document.getElementById('aa-confirm-modal');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'aa-confirm-modal';
  modal.className = 'aa-modal-backdrop open';
  modal.innerHTML = '<div class="aa-modal" style="max-width:380px;">' +
    '<div class="aa-modal-header"><h5 class="aa-modal-title">Confirm Action</h5></div>' +
    '<div class="aa-modal-body"><p style="margin:0;">' + message + '</p></div>' +
    '<div class="aa-modal-footer">' +
    '<button class="aa-btn aa-btn-outline" onclick="document.getElementById(\'aa-confirm-modal\').remove()">Cancel</button>' +
    '<button id="aa-confirm-ok" class="aa-btn aa-btn-danger">Confirm</button>' +
    '</div></div>';
  document.body.appendChild(modal);
  document.getElementById('aa-confirm-ok').onclick = function() {
    modal.remove();
    onConfirm();
  };
}

// --- PDF Viewer -----------------------------------------------

function openPDFViewer(previewUrl, downloadUrl, title) {
  var existing = document.getElementById('aa-pdf-modal');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'aa-pdf-modal';
  modal.className = 'aa-modal-backdrop open';
  modal.innerHTML = '<div class="aa-modal aa-modal-lg">' +
    '<div class="aa-modal-header">' +
    '<h5 class="aa-modal-title">📄 ' + (title || 'Document Viewer') + '</h5>' +
    '<button class="aa-modal-close" onclick="document.getElementById(\'aa-pdf-modal\').remove()">×</button></div>' +
    '<div class="aa-modal-body" style="padding:0;">' +
    '<iframe src="' + previewUrl + '" style="width:100%;height:70vh;border:none;"></iframe></div>' +
    '<div class="aa-modal-footer">' +
    '<button class="aa-btn aa-btn-outline" onclick="document.getElementById(\'aa-pdf-modal\').remove()">Close</button>' +
    '<a href="' + downloadUrl + '" target="_blank" class="aa-btn aa-btn-gold">⬇ Download</a>' +
    '</div></div>';
  document.body.appendChild(modal);
}

// --- Export Table to CSV --------------------------------------

function exportTableCSV(tableId, filename) {
  var table = document.getElementById(tableId);
  if (!table) return;
  var rows = Array.from(table.querySelectorAll('tr'));
  var csv = rows.map(function(row) {
    return Array.from(row.querySelectorAll('th,td')).map(function(cell) {
      return '"' + cell.innerText.replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\n');
  var link = document.createElement('a');
  link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  link.download = (filename || 'export') + '.csv';
  link.click();
}

// --- Score Colour Helper -------------------------------------

function scoreColor(score) {
  var n = parseFloat(score) || 0;
  if (n >= 75) return '#15803d';
  if (n >= 60) return '#1d4ed8';
  if (n >= 50) return '#b45309';
  if (n >= 40) return '#9333ea';
  return '#dc2626';
}

// --- Image Utilities -----------------------------------------

function resizeAndCompressImage(file, maxDim, quality, callback) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var width = img.width; var height = img.height;
      if (width > height) {
        if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
      } else {
        if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
      }
      canvas.width = width; canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      try { callback(canvas.toDataURL('image/jpeg', quality)); }
      catch (err) { callback(e.target.result); }
    };
    img.onerror = function() { callback(e.target.result); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function previewProfilePhoto(input) {
  if (input.files && input.files[0]) {
    resizeAndCompressImage(input.files[0], 200, 0.75, function(base64) {
      document.getElementById('profPhotoBase64').value = base64;
      var preview = document.querySelector('#profileModal .aa-user-avatar');
      if (preview) {
        preview.innerHTML = '<img src="' + base64 + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      }
    });
  }
}

function adminResetPassword(uid) {
  aaConfirm('Reset password for this user? The new password will be "password123".', function() {
    callServer('adminResetUserPassword', [AA.token, uid], function(res) {
      showToast(res.message, res.success ? 'success' : 'error');
    }, null, true);
  });
}

// --- CSV Utilities --------------------------------------------

function parseCSV(str) {
  var arr = [];
  var quote = false;
  for (var row = 0, col = 0, c = 0; c < str.length; c++) {
    var cc = str[c], nc = str[c+1];
    arr[row] = arr[row] || [];
    arr[row][col] = arr[row][col] || '';
    if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
    if (cc == '"') { quote = !quote; continue; }
    if (cc == ',' && !quote) { ++col; continue; }
    if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
    if (cc == '\n' && !quote) { ++row; col = 0; continue; }
    if (cc == '\r' && !quote) { ++row; col = 0; continue; }
    arr[row][col] += cc;
  }
  if (arr.length < 2) return [];
  var headers = arr[0].map(function(h) { return h.trim(); });
  var data = [];
  for (var i = 1; i < arr.length; i++) {
    var obj = {}; var hasData = false;
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = arr[i][j] ? arr[i][j].trim() : '';
      if (obj[headers[j]]) hasData = true;
    }
    if (hasData) data.push(obj);
  }
  return data;
}

function downloadCSVTemplate(headers, filename) {
  var csv = headers.join(',') + '\n';
  var blob = new Blob([csv], {type: 'text/csv'});
  var url = window.URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// --- DOM Ready ------------------------------------------------

document.addEventListener('DOMContentLoaded', function() {
  initSidebar();
  if (!document.getElementById('aa-toast-container')) {
    var tc = document.createElement('div');
    tc.id = 'aa-toast-container';
    document.body.appendChild(tc);
  }
});
