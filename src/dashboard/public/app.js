const API_URL = window.location.origin;
let token = localStorage.getItem('lyrablox_token');

// Global Elements
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const toastEl = document.getElementById('toast');
const tabTitle = document.getElementById('tab-title');
const btnLogout = document.getElementById('btn-logout');
const btnSync = document.getElementById('btn-sync');
const btnRefresh = document.getElementById('btn-refresh');

// Modal Elements
const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const btnCancelProduct = document.getElementById('btn-cancel-product');
const btnAddProduct = document.getElementById('btn-add-product');

let currentProductsList = [];

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        showDashboard();
    } else {
        showLogin();
    }
});

// Authentication Handling
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
            token = data.token;
            localStorage.setItem('lyrablox_token', token);
            showDashboard();
            showToast('Welcome back! Successfully authenticated.', 'success');
        } else {
            loginError.textContent = data.message || 'Authentication failed.';
            loginError.classList.remove('hidden');
        }
    } catch (err) {
        loginError.textContent = 'Server connection error.';
        loginError.classList.remove('hidden');
    }
});

btnLogout.addEventListener('click', () => {
    localStorage.removeItem('lyrablox_token');
    token = null;
    showLogin();
    showToast('Logged out successfully.', 'success');
});

function showLogin() {
    loginContainer.classList.remove('hidden');
    dashboardContainer.classList.add('hidden');
}

function showDashboard() {
    loginContainer.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
    switchTab('stats');
}

// Global Sync Panels Button
btnSync.addEventListener('click', async () => {
    try {
        const res = await fetch(`${API_URL}/api/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
        } else {
            showToast(data.message || 'Failed to sync panels.', 'error');
        }
    } catch (err) {
        showToast('Connection error during sync.', 'error');
    }
});

// Global Refresh Server Button
if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
        try {
            const originalText = btnRefresh.textContent;
            btnRefresh.textContent = '🔄 Refreshing...';
            btnRefresh.disabled = true;

            const res = await fetch(`${API_URL}/api/refresh`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            btnRefresh.textContent = originalText;
            btnRefresh.disabled = false;

            if (data.success) {
                showToast(data.message, 'success');
            } else {
                showToast(data.message || 'Failed to refresh server.', 'error');
            }
        } catch (err) {
            btnRefresh.textContent = '🔄 Refresh Server';
            btnRefresh.disabled = false;
            showToast('Connection error during refresh.', 'error');
        }
    });
}

// Toast System
function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast toast-${type}`;
    toastEl.classList.remove('hidden');

    setTimeout(() => {
        toastEl.classList.add('hidden');
    }, 4000);
}

// Tab Switching Routing
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.getAttribute('data-tab');
        switchTab(tab);
    });
});

function switchTab(tabId) {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.menu-item[data-tab="${tabId}"]`).classList.add('active');

    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');

    // Title capitalization
    const titleText = tabId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    tabTitle.textContent = titleText;

    // Load data specific to each tab
    if (tabId === 'stats') loadStats();
    if (tabId === 'products') loadProducts();
    if (tabId === 'pricing') loadPricing();
    if (tabId === 'ticket-settings') loadSettingsForm('ticket-settings-form');
    if (tabId === 'channels') loadSettingsForm('channels-form');
    if (tabId === 'roles') loadSettingsForm('roles-form');
    if (tabId === 'embeds') loadEmbeds();
    if (tabId === 'orders') loadOrders();
    if (tabId === 'settings') {
        loadSettingsForm('general-settings-form');
        loadSettingsForm('control-center-settings-form');
    }
}

// --- Tab 1: Stats Loader ---
async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/api/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const { stats, recentOrders } = data;
            document.getElementById('stat-revenue').textContent = `Rp ${stats.revenue.toLocaleString('id-ID')}`;
            document.getElementById('stat-completed-orders').textContent = stats.completedOrders;
            document.getElementById('stat-pending-orders').textContent = stats.pendingOrders;
            document.getElementById('stat-total-tickets').textContent = stats.totalTickets;

            // Render Recent Orders Table
            const tbody = document.getElementById('recent-orders-table');
            tbody.innerHTML = '';

            if (recentOrders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No orders recorded yet.</td></tr>';
            } else {
                recentOrders.forEach(o => {
                    const date = new Date(o.createdAt).toLocaleString('id-ID');
                    const badgeClass = o.status === 'completed' ? 'badge-success' : (o.status === 'pending' ? 'badge-warning' : 'badge-danger');
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>${o.orderId}</strong></td>
                            <td><span style="font-family: monospace;">${o.userId}</span></td>
                            <td>${o.productName}</td>
                            <td>Rp ${o.price.toLocaleString('id-ID')}</td>
                            <td><span class="badge ${badgeClass}">${o.status.toUpperCase()}</span></td>
                            <td>${date}</td>
                        </tr>
                    `;
                });
            }
        }
    } catch (err) {
        showToast('Error loading statistics.', 'error');
    }
}

// --- Tab 2: Products CRUD ---
async function loadProducts() {
    try {
        const res = await fetch(`${API_URL}/api/products`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            currentProductsList = data.products;
            const container = document.getElementById('products-list');
            container.innerHTML = '';

            if (currentProductsList.length === 0) {
                container.innerHTML = '<div class="card" style="grid-column: 1/-1; text-align: center;">No products available. Add a new product to get started.</div>';
                return;
            }

            currentProductsList.forEach(p => {
                const statusBadge = p.active ? '<span class="badge badge-success">ACTIVE</span>' : '<span class="badge badge-danger">DISABLED</span>';
                const pricingDesc = p.pricingType === 'PER_ROBUX' ? `Rp ${p.price.toLocaleString('id-ID')} / Robux` : `Rp ${p.price.toLocaleString('id-ID')} (Fixed)`;
                
                container.innerHTML += `
                    <div class="product-card">
                        <div class="product-info">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <h3>${p.name}</h3>
                                ${statusBadge}
                            </div>
                            <p>${p.description}</p>
                        </div>
                        <div class="product-meta">
                            <div class="product-meta-item"><span>Price:</span> <strong>${pricingDesc}</strong></div>
                            <div class="product-meta-item"><span>Channel:</span> <strong>${p.channelId ? `<#${p.channelId}>` : 'Not Set'}</strong></div>
                            <div class="product-meta-item"><span>Fields Count:</span> <strong>${p.fields ? p.fields.length : 0}</strong></div>
                        </div>
                        <div class="product-actions">
                            <button class="btn btn-secondary btn-sm" onclick="editProduct('${p._id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p._id}')">Delete</button>
                        </div>
                    </div>
                `;
            });
        }
    } catch (err) {
        showToast('Error loading products list.', 'error');
    }
}

// Add/Edit Product Modal triggers
btnAddProduct.addEventListener('click', () => {
    document.getElementById('product-form').reset();
    document.getElementById('product_id').value = '';
    document.getElementById('product-modal-title').textContent = 'Add Product';
    productModal.classList.remove('hidden');
});

btnCancelProduct.addEventListener('click', () => {
    productModal.classList.add('hidden');
});

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('product_id').value;

    const body = {
        name: document.getElementById('product_name').value,
        description: document.getElementById('product_desc').value,
        channelId: document.getElementById('product_channel').value || null,
        categoryId: document.getElementById('product_category').value || null,
        staffRoleId: document.getElementById('product_staff_role').value || null,
        pricingType: document.getElementById('product_pricing_type').value,
        price: parseFloat(document.getElementById('product_price').value) || 0,
        active: document.getElementById('product_active').value === 'true'
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/api/products/${id}` : `${API_URL}/api/products`;

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            productModal.classList.add('hidden');
            loadProducts();
            showToast(id ? 'Product updated successfully.' : 'Product created successfully.', 'success');
        } else {
            showToast(data.error || 'Failed to save product.', 'error');
        }
    } catch (err) {
        showToast('Connection error saving product.', 'error');
    }
});

window.editProduct = (productId) => {
    const p = currentProductsList.find(x => x._id === productId);
    if (!p) return;

    document.getElementById('product_id').value = p._id;
    document.getElementById('product_name').value = p.name;
    document.getElementById('product_desc').value = p.description;
    document.getElementById('product_channel').value = p.channelId || '';
    document.getElementById('product_category').value = p.categoryId || '';
    document.getElementById('product_staff_role').value = p.staffRoleId || '';
    document.getElementById('product_pricing_type').value = p.pricingType;
    document.getElementById('product_price').value = p.price;
    document.getElementById('product_active').value = String(p.active);

    document.getElementById('product-modal-title').textContent = 'Edit Product';
    productModal.classList.remove('hidden');
};

window.deleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        const res = await fetch(`${API_URL}/api/products/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            loadProducts();
            showToast('Product deleted.', 'success');
        } else {
            showToast('Failed to delete product.', 'error');
        }
    } catch (err) {
        showToast('Connection error deleting product.', 'error');
    }
};

// --- Tab 3: Pricing Form ---
let currentVilogPackagesList = [];

async function loadPricing() {
    try {
        // 1. Load Payout rates
        const resGroup = await fetch(`${API_URL}/api/pricing`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataGroup = await resGroup.json();
        if (dataGroup.success) {
            const container = document.getElementById('pricing-rates-container');
            container.innerHTML = '';

            if (dataGroup.products.length === 0) {
                container.innerHTML = '<p>No Robux/PER_ROBUX pricing products available. Configure products first.</p>';
            } else {
                dataGroup.products.forEach(p => {
                    container.innerHTML += `
                        <div class="form-group" style="border-bottom: 1px solid var(--border-color); padding-bottom: 15px;">
                            <label style="font-size: 1.1em; color: #ffffff; font-weight: 600;">${p.name} Rate</label>
                            <p style="color: var(--text-secondary); font-size: 0.85em; margin-bottom: 8px;">${p.description}</p>
                            <div style="display: flex; align-items: center; max-width: 250px;">
                                <span style="margin-right: 8px; font-weight: 600;">Rp</span>
                                <input type="number" data-id="${p._id}" value="${p.price}" class="form-control pricing-input" required min="0">
                                <span style="margin-left: 8px;">/ Robux</span>
                            </div>
                        </div>
                    `;
                });
            }
        }

        // 2. Load Robux packages
        const resVilog = await fetch(`${API_URL}/api/robux-packages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataVilog = await resVilog.json();
        if (dataVilog.success) {
            currentVilogPackagesList = dataVilog.packages;
            const tbody = document.getElementById('vilog-packages-table-body');
            tbody.innerHTML = '';

            if (currentVilogPackagesList.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No Vilog packages available.</td></tr>';
            } else {
                currentVilogPackagesList.forEach(pkg => {
                    const statusBadge = pkg.enabled ? '<span class="badge badge-success">ACTIVE</span>' : '<span class="badge badge-danger">DISABLED</span>';
                    tbody.innerHTML += `
                        <tr>
                            <td><span class="badge badge-${pkg.type === 'vilog' ? 'primary' : 'warning'}">${pkg.type === 'vilog' ? 'Via Login' : 'Via Send'}</span></td>
                            <td><strong>${pkg.amount.toLocaleString('id-ID')} Robux</strong></td>
                            <td>Rp ${pkg.price.toLocaleString('id-ID')}</td>
                            <td>${pkg.sortOrder}</td>
                            <td>${statusBadge}</td>
                            <td>
                                <div style="display: flex; gap: 6px;">
                                    <button class="btn btn-secondary btn-sm" onclick="editVilogPackage('${pkg._id}')">Edit</button>
                                    <button class="btn btn-danger btn-sm" onclick="deleteVilogPackage('${pkg._id}')">Delete</button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
        }
    } catch (err) {
        showToast('Error loading pricing configuration.', 'error');
    }
}

document.getElementById('pricing-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updates = [];
    document.querySelectorAll('.pricing-input').forEach(input => {
        updates.push({
            id: input.getAttribute('data-id'),
            price: parseFloat(input.value) || 0
        });
    });

    try {
        const res = await fetch(`${API_URL}/api/pricing`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });
        const data = await res.json();
        if (data.success) {
            showToast('Pricing rates updated successfully.', 'success');
        } else {
            showToast('Failed to update rates.', 'error');
        }
    } catch (err) {
        showToast('Connection error updating rates.', 'error');
    }
});

// --- Settings loading/saving helpers for forms ---
const formKeysMap = {
    'ticket-settings-form': ['global_ticket_category_id', 'vilog_category_id', 'visend_category_id'],
    'channels-form': ['log_channel_id', 'payout_log_channel_id', 'vilog_channel_id', 'visend_channel_id', 'admin_panel_channel_id'],
    'roles-form': ['staff_role_id', 'admin_role_id', 'owner_role_id', 'eligible_role_id'],
    'general-settings-form': ['branding_name', 'guild_id'],
    'control-center-settings-form': ['products.robux_login.enabled', 'products.robux_send.enabled', 'products.gift_in_game.enabled']
};

async function loadSettingsForm(formId) {
    try {
        const res = await fetch(`${API_URL}/api/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const settings = data.settings;
            const keys = formKeysMap[formId];
            keys.forEach(k => {
                const el = document.getElementById(k);
                if (el) el.value = settings[k] || '';
            });
        }
    } catch (err) {
        showToast('Error loading configurations.', 'error');
    }
}

// Attach settings form listeners
Object.keys(formKeysMap).forEach(formId => {
    const form = document.getElementById(formId);
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {};
            const keys = formKeysMap[formId];
            keys.forEach(k => {
                const el = document.getElementById(k);
                if (el) body[k] = el.value.trim();
            });

            try {
                const res = await fetch(`${API_URL}/api/settings`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Settings saved successfully.', 'success');
                } else {
                    showToast('Failed to save settings.', 'error');
                }
            } catch (err) {
                showToast('Connection error saving settings.', 'error');
            }
        });
    }
});

// --- Tab 7: Embed & Modal Fields Editor ---
const selectEmbedProduct = document.getElementById('embed-select-product');
const embedEditorContainer = document.getElementById('embed-editor-container');
const fieldsListContainer = document.getElementById('modal-fields-list');

async function loadEmbeds() {
    try {
        const res = await fetch(`${API_URL}/api/products`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            currentProductsList = data.products;
            selectEmbedProduct.innerHTML = '<option value="">-- Choose Product --</option>';
            currentProductsList.forEach(p => {
                selectEmbedProduct.innerHTML += `<option value="${p._id}">${p.name}</option>`;
            });
            embedEditorContainer.classList.add('hidden');
        }
    } catch (err) {
        showToast('Error loading products for embed editor.', 'error');
    }
}

selectEmbedProduct.addEventListener('change', () => {
    const id = selectEmbedProduct.value;
    if (!id) {
        embedEditorContainer.classList.add('hidden');
        return;
    }

    const p = currentProductsList.find(x => x._id === id);
    if (!p) return;

    // Load embeds values
    document.getElementById('embed_title').value = p.embed?.title || '';
    document.getElementById('embed_description').value = p.embed?.description || '';
    document.getElementById('embed_color').value = p.embed?.color || '#0099ff';
    document.getElementById('embed_thumbnail').value = p.embed?.thumbnail || '';
    document.getElementById('embed_banner').value = p.embed?.banner || '';
    document.getElementById('embed_footer').value = p.embed?.footer || '';

    // Load button values
    document.getElementById('button_label').value = p.button?.label || '';
    document.getElementById('button_emoji').value = p.button?.emoji || '';

    // Load fields values
    renderEditorFields(p.fields || []);
    embedEditorContainer.classList.remove('hidden');
});

function renderEditorFields(fields) {
    fieldsListContainer.innerHTML = '';
    fields.forEach((field, index) => {
        appendFieldRow(field, index);
    });
}

function appendFieldRow(field = { customId: '', label: '', placeholder: '', required: true, style: 'SHORT' }, index = null) {
    const i = index !== null ? index : fieldsListContainer.children.length;
    
    // Prevent exceeding 5 fields due to Discord restrictions
    if (fieldsListContainer.children.length >= 5 && index === null) {
        showToast('Discord modals support a maximum of 5 fields.', 'error');
        return;
    }

    const html = `
        <div class="field-row" id="field-row-${i}">
            <button type="button" class="btn-remove-field" onclick="removeFieldRow(${i})">✕</button>
            <div class="grid-2" style="gap: 10px;">
                <div class="form-group" style="margin-bottom: 10px;">
                    <label>Field Unique ID (customId)</label>
                    <input type="text" class="form-control field-custom-id" value="${field.customId}" required placeholder="robux_amount">
                </div>
                <div class="form-group" style="margin-bottom: 10px;">
                    <label>Field Label</label>
                    <input type="text" class="form-control field-label" value="${field.label}" required placeholder="Jumlah Robux">
                </div>
            </div>
            <div class="grid-2" style="gap: 10px;">
                <div class="form-group" style="margin-bottom: 10px;">
                    <label>Placeholder Text</label>
                    <input type="text" class="form-control field-placeholder" value="${field.placeholder}" placeholder="Masukkan nominal...">
                </div>
                <div class="form-group" style="margin-bottom: 10px;">
                    <label>Input Mode</label>
                    <select class="form-control field-style">
                        <option value="SHORT" ${field.style === 'SHORT' ? 'selected' : ''}>Short Text Box</option>
                        <option value="PARAGRAPH" ${field.style === 'PARAGRAPH' ? 'selected' : ''}>Paragraph Text Box</option>
                    </select>
                </div>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="display: inline-flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" class="field-required" ${field.required ? 'checked' : ''} style="width: auto; margin-right: 8px;">
                    Required Field
                </label>
            </div>
        </div>
    `;

    fieldsListContainer.insertAdjacentHTML('beforeend', html);
}

document.getElementById('btn-add-modal-field').addEventListener('click', () => {
    appendFieldRow();
});

window.removeFieldRow = (index) => {
    const row = document.getElementById(`field-row-${index}`);
    if (row) row.remove();
};

document.getElementById('embed-editor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = selectEmbedProduct.value;
    if (!id) return;

    // Gather Form fields
    const fields = [];
    const rows = fieldsListContainer.querySelectorAll('.field-row');
    rows.forEach(row => {
        fields.push({
            customId: row.querySelector('.field-custom-id').value.trim(),
            label: row.querySelector('.field-label').value.trim(),
            placeholder: row.querySelector('.field-placeholder').value.trim(),
            required: row.querySelector('.field-required').checked,
            style: row.querySelector('.field-style').value
        });
    });

    const body = {
        embed: {
            title: document.getElementById('embed_title').value.trim(),
            description: document.getElementById('embed_description').value.trim(),
            color: document.getElementById('embed_color').value,
            thumbnail: document.getElementById('embed_thumbnail').value.trim() || null,
            banner: document.getElementById('embed_banner').value.trim() || null,
            footer: document.getElementById('embed_footer').value.trim() || null
        },
        button: {
            label: document.getElementById('button_label').value.trim(),
            emoji: document.getElementById('button_emoji').value.trim()
        },
        fields
    };

    try {
        const res = await fetch(`${API_URL}/api/products/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            showToast('Embed layout & modals configuration saved.', 'success');
            loadEmbeds(); // Reload product list data
        } else {
            showToast('Failed to save layout configuration.', 'error');
        }
    } catch (err) {
        showToast('Connection error updating layout configurations.', 'error');
    }
});

// --- Tab 8: Orders Log Management ---
async function loadOrders() {
    try {
        const res = await fetch(`${API_URL}/api/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const tbody = document.getElementById('orders-table-body');
            tbody.innerHTML = '';

            if (data.orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No orders recorded.</td></tr>';
                return;
            }

            data.orders.forEach(o => {
                const badgeClass = o.status === 'success' ? 'badge-success' : (o.status === 'paid' ? 'badge-info' : (o.status === 'pending' ? 'badge-warning' : 'badge-danger'));
                
                // Formulate form responses display details
                let detailString = '';
                if (o.details) {
                    for (const [lbl, val] of Object.entries(o.details)) {
                        detailString += `<div><strong>${lbl}:</strong> ${val}</div>`;
                    }
                }

                // Render Action buttons (only show if pending or paid)
                const actionButtons = (o.status === 'pending' || o.status === 'paid') ? `
                    <button class="btn btn-primary btn-sm" onclick="processOrder('${o.orderId}', 'completed')">Deliver</button>
                    <button class="btn btn-secondary btn-sm" onclick="processOrder('${o.orderId}', 'cancelled')">Cancel</button>
                ` : `<span style="color: var(--text-secondary); font-style: italic;">${o.status.toUpperCase()}</span>`;

                tbody.innerHTML += `
                    <tr>
                        <td><strong>${o.orderId}</strong></td>
                        <td><span style="font-family: monospace;">${o.userId}</span></td>
                        <td>${o.productName}</td>
                        <td>
                            <div>Total: <strong>Rp ${o.price.toLocaleString('id-ID')}</strong></div>
                            ${o.subtotal ? `<div style="font-size: 0.8em; color: var(--text-secondary);">Sub: Rp ${o.subtotal.toLocaleString('id-ID')}</div>` : ''}
                            ${o.rounding ? `<div style="font-size: 0.8em; color: var(--success-color);">Round: +Rp ${o.rounding.toLocaleString('id-ID')}</div>` : ''}
                        </td>
                        <td style="font-size: 0.85em; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${detailString || '-'}
                        </td>
                        <td><span class="badge ${badgeClass}">${o.status.toUpperCase()}</span></td>
                        <td>
                            <div style="display: flex; gap: 6px;">
                                ${actionButtons}
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
    } catch (err) {
        showToast('Error loading orders history.', 'error');
    }
}

window.processOrder = async (orderId, newStatus) => {
    const act = newStatus === 'completed' ? 'deliver' : 'cancel';
    if (!confirm(`Are you sure you want to ${act} order ${orderId}?`)) return;

    try {
        const res = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Order marked as ${newStatus}.`, 'success');
            loadOrders();
        } else {
            showToast(data.message || 'Failed to process order.', 'error');
        }
    } catch (err) {
        showToast('Connection error processing order.', 'error');
    }
};

// Vilog packages CRUD triggers
const vilogModal = document.getElementById('vilog-modal');
const vilogForm = document.getElementById('vilog-form');
const btnCancelVilog = document.getElementById('btn-cancel-vilog');
const btnAddVilog = document.getElementById('btn-add-vilog');
const btnSyncVilog = document.getElementById('btn-sync-vilog');

if (btnAddVilog) {
    btnAddVilog.addEventListener('click', () => {
        vilogForm.reset();
        document.getElementById('vilog_pkg_id').value = '';
        document.getElementById('vilog-modal-title').textContent = 'Add Vilog Package';
        vilogModal.classList.remove('hidden');
    });
}

if (btnCancelVilog) {
    btnCancelVilog.addEventListener('click', () => {
        vilogModal.classList.add('hidden');
    });
}

if (btnSyncVilog) {
    btnSyncVilog.addEventListener('click', async () => {
        try {
            const res = await fetch(`${API_URL}/api/sync-vilog`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                showToast(data.message, 'success');
            } else {
                showToast(data.message || 'Failed to sync Vilog panel.', 'error');
            }
        } catch (err) {
            showToast('Connection error during sync.', 'error');
        }
    });
}

if (vilogForm) {
    vilogForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('vilog_pkg_id').value;

        const body = {
            type: document.getElementById('vilog_type').value || 'vilog',
            amount: parseInt(document.getElementById('vilog_amount').value) || 0,
            price: parseFloat(document.getElementById('vilog_price').value) || 0,
            sortOrder: parseInt(document.getElementById('vilog_sort_order').value) || 0,
            enabled: document.getElementById('vilog_enabled').value === 'true'
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/api/robux-packages/${id}` : `${API_URL}/api/robux-packages`;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                vilogModal.classList.add('hidden');
                loadPricing();
                showToast(id ? 'Package updated successfully.' : 'Package created successfully.', 'success');
            } else {
                showToast(data.error || 'Failed to save Vilog package.', 'error');
            }
        } catch (err) {
            showToast('Connection error saving Vilog package.', 'error');
        }
    });
}

window.editVilogPackage = (pkgId) => {
    const pkg = currentVilogPackagesList.find(x => x._id === pkgId);
    if (!pkg) return;

    document.getElementById('vilog_pkg_id').value = pkg._id;
    document.getElementById('vilog_type').value = pkg.type || 'vilog';
    document.getElementById('vilog_amount').value = pkg.amount;
    document.getElementById('vilog_price').value = pkg.price;
    document.getElementById('vilog_sort_order').value = pkg.sortOrder;
    document.getElementById('vilog_enabled').value = String(pkg.enabled);

    document.getElementById('vilog-modal-title').textContent = 'Edit Vilog Package';
    vilogModal.classList.remove('hidden');
};

window.deleteVilogPackage = async (pkgId) => {
    if (!confirm('Are you sure you want to delete this Vilog package?')) return;

    try {
        const res = await fetch(`${API_URL}/api/robux-packages/${pkgId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            loadPricing();
            showToast('Vilog package deleted.', 'success');
        } else {
            showToast('Failed to delete Vilog package.', 'error');
        }
    } catch (err) {
        showToast('Connection error deleting Vilog package.', 'error');
    }
};
