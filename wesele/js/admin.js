document.addEventListener('DOMContentLoaded', async () => {
    document.documentElement.setAttribute('data-org-ready', 'true');
    document.documentElement.removeAttribute('data-theme');
    if (document.body) document.body.classList.remove('dark-theme');
    let currentOrgId = (typeof detectOrganizationId === 'function') ? detectOrganizationId() : null;
    if (!currentOrgId) {
        if (typeof showNotFoundPage === 'function') showNotFoundPage();
        return;
    }

    // Synchronize currentOrgId with authenticated user from localStorage if not explicitly requested in URL or path
    const urlParams = new URLSearchParams(window.location.search);
    const isWeselePath = /(?:^|\/)wesele(?:\/|$)/i.test(window.location.pathname);
    const isPartyPath = /(?:^|\/)party(?:\/|$)/i.test(window.location.pathname);
    const pathTargetOrg = isWeselePath ? 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' : (isPartyPath ? '18181818-1818-4818-8818-181818181818' : null);
    const explicitOrg = urlParams.get('org') || urlParams.get('org_id') || pathTargetOrg;
    try {
        const cachedUser = JSON.parse(localStorage.getItem('user'));
        if (!explicitOrg && cachedUser && cachedUser.organization_id) {
            currentOrgId = cachedUser.organization_id;
            localStorage.setItem('current_org_id', cachedUser.organization_id);
        }
    } catch(e) {}

    // Wrap fetch to automatically attach X-Organization-Id for all admin API requests
    const nativeFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        if (typeof url === 'string' && url.includes('/api/')) {
            options = options || {};
            options.headers = options.headers || {};
            const activeOrg = currentOrgId || ((typeof detectOrganizationId === 'function') ? detectOrganizationId() : '18181818-1818-4818-8818-181818181818');
            if (options.headers instanceof Headers) {
                if (!options.headers.has('X-Organization-Id')) {
                    options.headers.set('X-Organization-Id', activeOrg);
                }
            } else {
                if (!options.headers['X-Organization-Id']) {
                    options.headers['X-Organization-Id'] = activeOrg;
                }
            }
        }
        return nativeFetch.call(this, url, options);
    };

    const getApiUrl = () => {
        if (typeof window.getAppApiUrl === 'function') {
            return window.getAppApiUrl();
        }
        if (window.location && window.location.origin && window.location.origin.includes('railway.app')) {
            return `${window.location.origin}/api`;
        }
        const host = window.location.hostname || '127.0.0.1';
        if (host === 'localhost' || host === '127.0.0.1') {
            return `http://${host}:8000/api`;
        }
        return 'https://frameworthyparty.up.railway.app/api';
    };
    const API_URL = getApiUrl();

    // ── ADMIN PANEL LOGIC VARIABLES ────────────────────────────────────────────
    let allGuestsData = [];
    let weddingConfigRaw = null;
    let coupleImageFocusX = 50;
    let coupleImageFocusY = 50;

    function updateFocusMarkerUI() {
        const marker = document.getElementById('admin-couple-image-focus-marker');
        if (marker) {
            marker.style.left = `${coupleImageFocusX}%`;
            marker.style.top = `${coupleImageFocusY}%`;
            marker.style.display = 'block';
        }
    }

    // ── AUTH CHECK ─────────────────────────────────────────────────────────────
    const token = localStorage.getItem('access_token');
    const userRaw = localStorage.getItem('user');
    let currentUser = null;
    try { currentUser = JSON.parse(userRaw); } catch(e){}

    const loadingOverlay = document.getElementById('loading-overlay');
    const authError = document.getElementById('auth-error');
    const mainUI = document.getElementById('main-ui');

    function showUI() {
        document.documentElement.setAttribute('data-org-ready', 'true');
        loadingOverlay.style.display = 'none';
        mainUI.style.display = 'block';
    }

    function showAuthError(details = '') {
        document.documentElement.setAttribute('data-org-ready', 'true');
        loadingOverlay.style.display = 'none';
        authError.style.display = 'flex';
        const debugEl = document.getElementById('debug-auth-info');
        if (debugEl) {
            debugEl.textContent = `Debug info: ${details}`;
        }

        const adminLoginForm = document.getElementById('admin-login-form');
        if (adminLoginForm) {
            adminLoginForm.onsubmit = async (e) => {
                e.preventDefault();
                const email = document.getElementById('admin-login-email').value.trim();
                const password = document.getElementById('admin-login-password').value.trim();
                const errBox = document.getElementById('admin-login-error');
                const submitBtn = document.getElementById('admin-login-submit-btn');
                if (errBox) errBox.style.display = 'none';
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Logowanie...';
                }
                try {
                    const res = await fetch(`${API_URL}/auth/owner/login/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password, organization_id: currentOrgId })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        localStorage.setItem('access_token', data.access);
                        localStorage.setItem('refresh_token', data.refresh);
                        localStorage.setItem('user', JSON.stringify(data.user));
                        const orgId = data.organization ? data.organization.id : data.user.organization_id;
                        if (orgId) {
                            localStorage.setItem('current_org_id', orgId);
                            localStorage.setItem('session_' + orgId, JSON.stringify({
                                token: data.access,
                                user: data.user
                            }));
                        }
                        window.location.reload();
                    } else {
                        if (errBox) {
                            errBox.textContent = data.error || 'Nieprawidłowy e-mail lub hasło.';
                            errBox.style.display = 'block';
                        }
                    }
                } catch(err) {
                    if (errBox) {
                        errBox.textContent = 'Błąd połączenia: ' + err.message;
                        errBox.style.display = 'block';
                    }
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i class="ph ph-sign-in"></i> Zaloguj się';
                    }
                }
            };
        }
    }

    if (!token) {
        showAuthError('Brak access_token w localStorage.');
        return;
    }
    if (!currentUser) {
        showAuthError('Brak obiektu user w localStorage.');
        return;
    }

    // Verify token + role with the backend
    try {
        const res = await fetch(`${API_URL}/me/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Serwer zwrócił kod ${res.status}`);
        
        const me = await res.json();
        if (me.role !== 'para_mloda' && !me.is_staff) {
            showAuthError(`Niepoprawna rola: '${me.role}' (wymagana 'para_mloda')`);
            return;
        }
        
        currentUser = me;
        if (me.organization_id && !explicitOrg) {
            currentOrgId = me.organization_id;
            localStorage.setItem('current_org_id', me.organization_id);
        }
        showUI();
        initAdminPanel();
    } catch(e) {
        console.error("Auth check failed, trying local fallback:", e);
        // Fallback to local storage user check if backend is unreachable or returns temporary error
        if (currentUser && (currentUser.role === 'para_mloda' || currentUser.is_staff)) {
            console.warn("Auth verify endpoint failed but local storage session is valid. Proceeding.");
            showUI();
            initAdminPanel();
        } else {
            showAuthError(`Błąd weryfikacji tokenu: ${e.message}. Rola w sesji: '${currentUser ? currentUser.role : 'brak'}'`);
        }
    }

    // ── ADMIN PANEL LOGIC ──────────────────────────────────────────────────────
    function initAdminPanel() {
        // Tab navigation switcher
        const tabNavButtons = document.querySelectorAll('.admin-tab-nav-btn');
        const adminTabContents = document.querySelectorAll('.admin-tab-content');

        tabNavButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                tabNavButtons.forEach(b => b.classList.remove('active'));
                adminTabContents.forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');

                if (tabId === 'admin-tab-notifications') {
                    loadPushNotifications();
                } else if (tabId === 'admin-tab-organization') {
                    if (weddingConfigRaw) populateOrganizationTab(weddingConfigRaw);
                    loadAdminConfigForm();
                } else if (tabId === 'admin-tab-metrics') {
                    loadAdminMetricsSummary();
                }
            });
        });

        // Seating Plan Creator redirect
        const openCreatorBtn = document.getElementById('admin-open-creator-btn');
        if (openCreatorBtn) {
            openCreatorBtn.addEventListener('click', () => {
                const orgId = currentOrgId || ((typeof detectOrganizationId === 'function') ? detectOrganizationId() : '');
                window.location.href = orgId ? `seating.html?org=${encodeURIComponent(orgId)}` : 'seating.html';
            });
        }

        // Load initial data
        loadAdminGuests();
        loadAdminConfigForm();

        // Attach other event listeners
        initGuestFormListeners();
        initPdfModalListeners();
        initTimelineFormListeners();
        initInfoFormListeners();
        initCoupleSettingsListeners();
        initHeaderSettingsListeners();
        initWitnessPermissionsListeners();
        initPushNotificationsListeners();
        initThemeSettingsListeners();
        initOrganizationSettingsListeners();

        // Attach search and filter event listeners
        const guestSearchInput = document.getElementById('admin-guest-search-input');
        if (guestSearchInput) {
            guestSearchInput.addEventListener('input', applyFilters);
        }

        document.querySelectorAll('.admin-filter-select').forEach(select => {
            select.addEventListener('change', applyFilters);
        });
    }

    // ── GUESTS TAB ─────────────────────────────────────────────────────────────
    async function loadAdminGuests() {
        try {
            const res = await fetch(`${API_URL}/admin/guests/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                allGuestsData = await res.json();
                renderAdminGuestsList(allGuestsData);
                populateParentGuestSelect();
                populateTableFilterSelect();
            } else {
                console.error(`Failed to load guests. Status: ${res.status}`);
                if (res.status === 401 || res.status === 403) {
                    alert("Sesja wygasła lub brak uprawnień do listy gości. Zaloguj się ponownie.");
                    window.location.href = 'index.html';
                } else {
                    alert(`Błąd serwera podczas pobierania gości (status: ${res.status}).`);
                }
            }
        } catch(e) {
            console.error("Failed to load guests:", e);
            alert(`Błąd sieci podczas pobierania gości: ${e.message}`);
        }
    }

    // Force download file instead of opening it (blocks cross-origin browser default)
    async function downloadQRCode(url, filename) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (e) {
            console.error("QR Code download failed, opening in new tab instead", e);
            window.open(url, '_blank');
        }
    }

    function renderAdminGuestsList(guests) {
        const container = document.getElementById('admin-guest-list');
        if (!container) return;
        container.innerHTML = '';

        guests.forEach(g => {
            const row = document.createElement('div');
            row.className = 'admin-guest-row';
            
            // Badges details
            const roleName = (typeof getRoleLabel === 'function') ? getRoleLabel(g.role) : (g.role === 'para_mloda' ? 'Para Młoda' : (g.role === 'swiadek' ? 'Świadek' : 'Gość'));
            const roleColor = (typeof getRoleBadgeColor === 'function') ? getRoleBadgeColor(g.role) : (g.role === 'para_mloda' ? '#fbbf24' : (g.role === 'swiadek' ? '#a5b4fc' : '#8a8074'));
            const roleBg = g.role === 'para_mloda' ? 'rgba(251, 191, 36, 0.15)' : (g.role === 'swiadek' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.08)');

            const mainTableLabel = (weddingConfigRaw && weddingConfigRaw.custom_labels && weddingConfigRaw.custom_labels.main_table_label)
                ? weddingConfigRaw.custom_labels.main_table_label
                : ((typeof getRoleLabel === 'function' && getRoleLabel('para_mloda') === 'Jubilat') ? 'Stół Jubilata' : 'Stół Pary Młodej');
            const tableText = g.table_number !== null ? (g.table_number === 0 ? mainTableLabel : `Stolik ${g.table_number}`) : 'Brak stolika';
            const tableStyle = g.table_number !== null 
                ? 'background: rgba(94, 184, 122, 0.15); color: #5eb87a;' 
                : 'background: rgba(224, 85, 85, 0.12); color: #e05555;';

            const towBadge = g.is_plus_one 
                ? '<span class="admin-guest-meta-badge" style="background: rgba(212, 116, 138, 0.15); color: #d4748a;"><i class="ph-fill ph-users"></i> Towarzysząca (TOW)</span>'
                : '<span class="admin-guest-meta-badge" style="background: rgba(255, 255, 255, 0.08); color: #ccc;"><i class="ph-fill ph-user"></i> Główny gość</span>';

            const relBadge = g.relationship && g.relationship.trim() !== ''
                ? `<span class="admin-guest-meta-badge" style="background: rgba(255, 255, 255, 0.05); color: #e8ece4;"><i class="ph ph-heart" style="color:#d4748a;"></i> Relacja: ${g.relationship}</span>`
                : '<span class="admin-guest-meta-badge" style="background: rgba(224, 85, 85, 0.06); color: rgba(224, 85, 85, 0.7); border: 1px dashed rgba(224, 85, 85, 0.3);"><i class="ph ph-warning-circle"></i> Brak relacji</span>';

            const metBadge = g.how_we_met && g.how_we_met.trim() !== ''
                ? '<span class="admin-guest-meta-badge" style="background: rgba(94, 184, 122, 0.12); color: #5eb87a;"><i class="ph ph-chat-centered-text"></i> Opis: Tak</span>'
                : '<span class="admin-guest-meta-badge" style="background: rgba(224, 85, 85, 0.06); color: rgba(224, 85, 85, 0.7); border: 1px dashed rgba(224, 85, 85, 0.3);"><i class="ph ph-warning-circle"></i> Brak opisu</span>';

            const prefixText = g.prefix ? `<span style="opacity: 0.6; font-size: 0.8rem; font-style: italic;">(${g.prefix})</span> ` : '';

            row.innerHTML = `
                <div class="admin-guest-info-block">
                    <span class="admin-guest-row-name">${prefixText}${g.first_name || ''} ${g.last_name || ''}</span>
                    <div class="admin-guest-row-meta" style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px;">
                        <span class="admin-guest-meta-badge" style="background: ${roleBg}; color: ${roleColor}; font-weight: 600;">${roleName}</span>
                        <span class="admin-guest-meta-badge filter-by-code-btn" data-code="${g.login_code}" style="background: rgba(255,255,255,0.06); color: #ccc; cursor: pointer;" title="Kliknij, aby filtrować po tym kodzie">Kod: ${g.login_code}</span>
                        <span class="admin-guest-meta-badge ${g.table_number !== null ? 'filter-by-table-btn' : ''}" data-table="${g.table_number !== null ? g.table_number : ''}" style="${tableStyle} ${g.table_number !== null ? 'cursor: pointer;' : ''}" title="${g.table_number !== null ? 'Kliknij, aby filtrować po tym stoliku' : ''}">${tableText}</span>
                        ${towBadge}
                        ${relBadge}
                        ${metBadge}
                    </div>
                </div>
                <div class="admin-guest-row-buttons" style="display: flex; align-items: center; gap: 8px;">
                    <button class="download-qr-btn" data-url="${g.qr_png_url}" data-code="${g.login_code}" title="Pobierz QR PNG" style="background: none; border: none; cursor: pointer; color: #c9a84c; font-size: 1.25rem; display: flex; align-items: center;"><i class="ph ph-download-simple"></i></button>
                    <button class="edit-guest-btn" data-id="${g.id}"><i class="ph ph-pencil-simple"></i></button>
                    <button class="delete-btn delete-guest-btn" data-id="${g.id}"><i class="ph ph-trash"></i></button>
                </div>
            `;
            container.appendChild(row);
        });

        // Add event listeners for edit and delete
        container.querySelectorAll('.edit-guest-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                openGuestModal(id);
            });
        });

        container.querySelectorAll('.delete-guest-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                deleteGuest(id);
            });
        });

        // Click to filter by code badge
        container.querySelectorAll('.filter-by-code-btn').forEach(badge => {
            badge.addEventListener('click', () => {
                const code = badge.getAttribute('data-code');
                const searchInput = document.getElementById('admin-guest-search-input');
                if (searchInput) {
                    searchInput.value = code;
                    applyFilters();
                }
            });
        });

        // Click to filter by table badge
        container.querySelectorAll('.filter-by-table-btn').forEach(badge => {
            badge.addEventListener('click', () => {
                const tableNum = badge.getAttribute('data-table');
                const searchInput = document.getElementById('admin-guest-search-input');
                if (searchInput && tableNum) {
                    searchInput.value = `stolik ${tableNum}`;
                    applyFilters();
                }
            });
        });

        // Add QR Download action listener
        container.querySelectorAll('.download-qr-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const url = btn.getAttribute('data-url');
                const code = btn.getAttribute('data-code');
                btn.style.opacity = '0.5';
                btn.disabled = true;
                await downloadQRCode(url, `${code}_qr.png`);
                btn.style.opacity = '1';
                btn.disabled = false;
            });
        });
    }

    // Live search and filter implementation
    function applyFilters() {
        console.log("applyFilters called");
        const query = (document.getElementById('admin-guest-search-input')?.value || '').toLowerCase().trim();
        const role = document.getElementById('filter-role')?.value || '';
        const table = document.getElementById('filter-table')?.value || '';
        const tow = document.getElementById('filter-tow')?.value || '';
        const missing = document.getElementById('filter-missing')?.value || '';

        console.log("Filter values:", { query, role, table, tow, missing });

        let filtered = allGuestsData;

        // Search text
        if (query) {
            filtered = filtered.filter(g => {
                const tableSearch = g.table_number !== null ? `stolik ${g.table_number}` : 'brak stolika';
                const fullName = `${g.prefix || ''} ${g.first_name || ''} ${g.last_name || ''} ${g.login_code} ${g.relationship || ''} ${tableSearch}`.toLowerCase();
                return fullName.includes(query);
            });
        }

        // Role filter
        if (role) {
            filtered = filtered.filter(g => g.role === role);
        }

        // Table filter
        if (table === 'assigned') {
            filtered = filtered.filter(g => g.table_number !== null);
        } else if (table === 'unassigned') {
            filtered = filtered.filter(g => g.table_number === null);
        } else if (table) {
            filtered = filtered.filter(g => g.table_number !== null && g.table_number.toString() === table);
        }

        // TOW filter
        if (tow === 'primary') {
            filtered = filtered.filter(g => !g.is_plus_one);
        } else if (tow === 'plus_one') {
            filtered = filtered.filter(g => g.is_plus_one);
        }

        // Missing data filter
        if (missing === 'missing_relationship') {
            filtered = filtered.filter(g => !g.relationship || g.relationship.trim() === '');
        } else if (missing === 'missing_how_met') {
            filtered = filtered.filter(g => !g.how_we_met || g.how_we_met.trim() === '');
        } else if (missing === 'incomplete') {
            filtered = filtered.filter(g => !g.relationship || g.relationship.trim() === '' || !g.how_we_met || g.how_we_met.trim() === '' || g.table_number === null);
        } else if (missing === 'complete') {
            filtered = filtered.filter(g => g.relationship && g.relationship.trim() !== '' && g.how_we_met && g.how_we_met.trim() !== '' && g.table_number !== null);
        }

        renderAdminGuestsList(filtered);
    }



    // Populate Parent Guest selector for grouping guests under one code
    function populateParentGuestSelect() {
        const select = document.getElementById('admin-guest-parent');
        if (!select) return;
        select.innerHTML = '<option value="">-- Nowa grupa (nowy kod) --</option>';

        // Get unique primary guests (non plus ones, ordered)
        const candidates = allGuestsData.filter(g => !g.is_plus_one);
        candidates.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = `${c.first_name || ''} ${c.last_name || ''} (Kod: ${c.login_code})`;
            select.appendChild(option);
        });
    }

    // Dynamiczne wypełnianie filtra stolików unikalnymi numerami stolików z danych
    function populateTableFilterSelect() {
        const select = document.getElementById('filter-table');
        if (!select) return;

        // Zapamiętaj aktualnie wybraną wartość, by jej nie resetować przy przeładowaniu
        const currentValue = select.value;

        // Domyślne opcje
        select.innerHTML = `
            <option value="">Stolik: Wszystkie</option>
            <option value="assigned">Przypisany</option>
            <option value="unassigned">Brak stolika</option>
        `;

        // Pobierz unikalne numery stolików
        const tables = [...new Set(allGuestsData
            .map(g => g.table_number)
            .filter(t => t !== null && t !== undefined && t !== '')
        )];

        // Posortuj numerycznie
        tables.sort((a, b) => Number(a) - Number(b));

        // Dodaj opcję dla każdego stolika
        tables.forEach(t => {
            const option = document.createElement('option');
            option.value = t.toString();
            option.textContent = `Stolik ${t}`;
            select.appendChild(option);
        });

        // Przywróć poprzednio wybraną wartość, jeśli nadal istnieje na liście
        if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
            select.value = currentValue;
        }
    }

    function initGuestFormListeners() {
        const guestModal = document.getElementById('admin-guest-modal');
        const guestModalClose = document.getElementById('admin-guest-modal-close');
        const addGuestBtn = document.getElementById('admin-add-guest-btn');

        if (addGuestBtn) {
            addGuestBtn.addEventListener('click', () => openGuestModal());
        }
        if (guestModalClose) {
            guestModalClose.addEventListener('click', () => { guestModal.style.display = 'none'; });
        }

        const saveGuestBtn = document.getElementById('admin-guest-save-btn');
        if (saveGuestBtn) {
            saveGuestBtn.addEventListener('click', async () => {
                const id = document.getElementById('admin-guest-id').value;
                const phoneVal = document.getElementById('admin-guest-phone').value.trim();

                function isValidPhone(p) {
                    const clean = p.replace(/[\s\-\(\)]/g, '');
                    return /^\+?[0-9]{9,15}$/.test(clean);
                }

                if (phoneVal && !isValidPhone(phoneVal)) {
                    alert('Nieprawidłowy format numeru telefonu. Wprowadź min. 9 cyfr, np. +48 500 600 700.');
                    return;
                }

                const payload = {
                    prefix: document.getElementById('admin-guest-prefix').value,
                    first_name: document.getElementById('admin-guest-first-name').value,
                    last_name: document.getElementById('admin-guest-last-name').value,
                    is_plus_one: document.getElementById('admin-guest-is-plus-one').checked,
                    role: document.getElementById('admin-guest-role').value,
                    parent_guest_id: document.getElementById('admin-guest-parent').value || null,
                    table_number: document.getElementById('admin-guest-table').value || null,
                    seat_number: document.getElementById('admin-guest-seat').value || null,
                    relationship: document.getElementById('admin-guest-relationship').value,
                    phone: phoneVal,
                    how_we_met: document.getElementById('admin-guest-how-met').value
                };

                const url = id ? `${API_URL}/admin/guests/${id}/` : `${API_URL}/admin/guests/`;
                const method = id ? 'PATCH' : 'POST';

                try {
                    const res = await fetch(url, {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        guestModal.style.display = 'none';
                        loadAdminGuests();
                    } else {
                        const err = await res.json();
                        alert(err.error || "Wystąpił błąd zapisu.");
                    }
                } catch(e) {
                    console.error("Save guest error:", e);
                }
            });
        }

        // CSV file import handler
        const csvFileInput = document.getElementById('admin-csv-file');
        if (csvFileInput) {
            csvFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const formData = new FormData();
                formData.append('file', file);

                try {
                    const res = await fetch(`${API_URL}/admin/guests/import-csv/`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });
                    if (res.ok) {
                        alert("Import ukończony pomyślnie!");
                        loadAdminGuests();
                    } else {
                        const err = await res.json();
                        alert(err.error || "Błąd importu pliku CSV.");
                    }
                } catch(e) {
                    console.error("CSV import error:", e);
                }
                csvFileInput.value = ''; // Reset input
            });
        }

        const exportPdfBtn = document.getElementById('admin-export-pdf-btn');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => exportGuestsToPdf());
        }
    }

    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function openPrintWindow(htmlContent, title) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Zezwól na wyskakujące okna (popups), aby wydrukować lub pobrać PDF.");
            return;
        }
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="pl">
            <head>
                <meta charset="UTF-8">
                <title>${escapeHtml(title)} - Kody logowania</title>
                <style>
                    @page { size: A4 portrait; margin: 10mm; }
                    body { margin: 0; background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
                    tr { page-break-inside: avoid; }
                    @media print {
                        .no-print { display: none !important; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="padding: 12px 20px; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 14px; font-weight: 600; color: #0f172a;">Podgląd listy kodów gości</span>
                    <button onclick="window.print()" style="padding: 8px 18px; background: #0f172a; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px;">Drukuj / Zapisz jako PDF</button>
                </div>
                ${htmlContent}
                <script>
                    window.onload = function() {
                        setTimeout(() => { window.print(); }, 250);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    function initPdfModalListeners() {
        const modal = document.getElementById('admin-pdf-modal');
        const closeBtn = document.getElementById('admin-pdf-modal-close');
        const downloadBtn = document.getElementById('admin-pdf-download-btn');
        const printBtn = document.getElementById('admin-pdf-print-btn');

        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                triggerPdfDownload();
            });
        }

        if (printBtn) {
            printBtn.addEventListener('click', () => {
                const sheet = document.getElementById('admin-pdf-sheet-wrapper');
                const eventName = (weddingConfigRaw && (weddingConfigRaw.wedding_name || weddingConfigRaw.organization_name)) || 'Wydarzenie';
                if (sheet) {
                    openPrintWindow(sheet.innerHTML, eventName);
                }
            });
        }

        // Column selection checkbox toggles
        document.querySelectorAll('.pdf-col-toggle').forEach(cb => {
            cb.addEventListener('change', () => {
                const cols = readPdfColumnCheckboxes();
                savePdfSelectedColumns(cols);
                renderPdfSheet(cols);
            });
        });
    }

    function getPdfSelectedColumns() {
        const defaults = {
            lp: true,
            name: true,
            role: true,
            table: true,
            code: true,
            phone: true,
            relationship: false
        };
        try {
            const saved = localStorage.getItem('pdf_selected_columns');
            if (saved) {
                return { ...defaults, ...JSON.parse(saved) };
            }
        } catch (e) {}
        return defaults;
    }

    function savePdfSelectedColumns(cols) {
        try {
            localStorage.setItem('pdf_selected_columns', JSON.stringify(cols));
        } catch (e) {}
    }

    function syncPdfColumnCheckboxes(cols) {
        ['lp', 'name', 'role', 'table', 'code', 'phone', 'relationship'].forEach(key => {
            const cb = document.getElementById(`pdf-col-${key}`);
            if (cb && key !== 'name') {
                cb.checked = Boolean(cols[key]);
            }
        });
    }

    function readPdfColumnCheckboxes() {
        return {
            lp: document.getElementById('pdf-col-lp')?.checked ?? true,
            name: true,
            role: document.getElementById('pdf-col-role')?.checked ?? true,
            table: document.getElementById('pdf-col-table')?.checked ?? true,
            code: document.getElementById('pdf-col-code')?.checked ?? true,
            phone: document.getElementById('pdf-col-phone')?.checked ?? true,
            relationship: document.getElementById('pdf-col-relationship')?.checked ?? false
        };
    }

    function renderPdfSheet(cols = null) {
        if (!cols) cols = getPdfSelectedColumns();
        const sheetWrapper = document.getElementById('admin-pdf-sheet-wrapper');
        if (!sheetWrapper || !allGuestsData) return;

        // Sort guests alphabetically by Polish last_name, then first_name
        const sortedGuests = [...allGuestsData].sort((a, b) => {
            const lastNameA = (a.last_name || '').trim();
            const lastNameB = (b.last_name || '').trim();
            const comp = lastNameA.localeCompare(lastNameB, 'pl', { sensitivity: 'base' });
            if (comp !== 0) return comp;
            const firstNameA = (a.first_name || '').trim();
            const firstNameB = (b.first_name || '').trim();
            return firstNameA.localeCompare(firstNameB, 'pl', { sensitivity: 'base' });
        });

        const eventName = (weddingConfigRaw && (weddingConfigRaw.wedding_name || weddingConfigRaw.organization_name)) || 'Wydarzenie';
        const dateStr = new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

        const mainTableLabel = (weddingConfigRaw && weddingConfigRaw.custom_labels && weddingConfigRaw.custom_labels.main_table_label)
            ? weddingConfigRaw.custom_labels.main_table_label
            : ((typeof getRoleLabel === 'function' && getRoleLabel('para_mloda') === 'Jubilat') ? 'Stół Jubilata' : 'Stół Pary Młodej');

        // Build columns specification based on user selection
        const thCols = [];
        if (cols.lp) thCols.push({ id: 'lp', label: 'Lp.', align: 'center', width: '32px' });
        if (cols.name) thCols.push({ id: 'name', label: 'Imię i Nazwisko', align: 'left', width: 'auto' });
        if (cols.role) thCols.push({ id: 'role', label: 'Rola', align: 'left', width: '85px' });
        if (cols.table) thCols.push({ id: 'table', label: 'Stolik', align: 'left', width: '95px' });
        if (cols.code) thCols.push({ id: 'code', label: 'Kod logowania', align: 'center', width: '120px' });
        if (cols.phone) thCols.push({ id: 'phone', label: 'Telefon', align: 'left', width: '95px' });
        if (cols.relationship) thCols.push({ id: 'relationship', label: 'Relacja', align: 'left', width: '95px' });

        let theadHtml = '<tr style="background: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 9.5px; font-weight: 700; letter-spacing: 0.5px;">';
        thCols.forEach((col, idx) => {
            let radius = '';
            if (idx === 0) radius = 'border-radius: 4px 0 0 0;';
            if (idx === thCols.length - 1) radius = 'border-radius: 0 4px 0 0;';
            const w = col.width !== 'auto' ? `width: ${col.width};` : '';
            theadHtml += `<th style="padding: 8px 8px; text-align: ${col.align}; ${w} ${radius}">${col.label}</th>`;
        });
        theadHtml += '</tr>';

        let rowsHtml = '';
        sortedGuests.forEach((g, idx) => {
            const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            rowsHtml += `<tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0; page-break-inside: avoid;">`;

            thCols.forEach(col => {
                if (col.id === 'lp') {
                    rowsHtml += `<td style="padding: 7px 6px; text-align: center; color: #64748b; font-weight: 600; font-size: 10px;">${idx + 1}</td>`;
                } else if (col.id === 'name') {
                    const prefixText = g.prefix ? `<span style="color: #64748b; font-weight: normal;">${escapeHtml(g.prefix)} </span>` : '';
                    const fullName = `${prefixText}${escapeHtml(g.first_name || '')} ${escapeHtml(g.last_name || '')}`.trim() || '—';
                    const plusOneBadge = g.is_plus_one
                        ? ' <span style="display: inline-block; font-size: 8.5px; font-weight: 700; color: #be185d; background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 3px; padding: 1px 4px; vertical-align: middle;">TOW</span>'
                        : '';
                    rowsHtml += `<td style="padding: 7px 10px; font-weight: 600; color: #0f172a; font-size: 11px;">${fullName}${plusOneBadge}</td>`;
                } else if (col.id === 'role') {
                    const roleName = (typeof getRoleLabel === 'function')
                        ? getRoleLabel(g.role)
                        : (g.role === 'para_mloda' ? 'Para Młoda' : (g.role === 'swiadek' ? 'Świadek' : 'Gość'));

                    let roleBg = '#f1f5f9';
                    let roleColor = '#475569';
                    if (g.role === 'para_mloda') {
                        roleBg = '#fef3c7';
                        roleColor = '#b45309';
                    } else if (g.role === 'swiadek') {
                        roleBg = '#e0e7ff';
                        roleColor = '#4338ca';
                    }
                    rowsHtml += `
                        <td style="padding: 7px 8px; font-size: 10.5px;">
                            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 600; background: ${roleBg}; color: ${roleColor};">
                                ${escapeHtml(roleName)}
                            </span>
                        </td>
                    `;
                } else if (col.id === 'table') {
                    const tableText = g.table_number !== null
                        ? (g.table_number === 0 ? mainTableLabel : `Stolik ${g.table_number}`)
                        : 'Brak';
                    rowsHtml += `<td style="padding: 7px 8px; color: #334155; font-size: 10.5px;">${escapeHtml(tableText)}</td>`;
                } else if (col.id === 'code') {
                    const code = escapeHtml(g.login_code || '—');
                    rowsHtml += `
                        <td style="padding: 7px 10px; text-align: center;">
                            <span style="display: inline-block; font-family: 'Courier New', Courier, monospace; font-size: 12.5px; font-weight: 800; letter-spacing: 1.5px; background: #ffffff; color: #0f172a; padding: 3px 8px; border-radius: 4px; border: 1.5px solid #0f172a;">
                                ${code}
                            </span>
                        </td>
                    `;
                } else if (col.id === 'phone') {
                    const phone = escapeHtml(g.phone || '—');
                    rowsHtml += `<td style="padding: 7px 8px; color: #475569; font-size: 10px;">${phone}</td>`;
                } else if (col.id === 'relationship') {
                    const rel = escapeHtml(g.relationship || '—');
                    rowsHtml += `<td style="padding: 7px 8px; color: #475569; font-size: 10px;">${rel}</td>`;
                }
            });
            rowsHtml += '</tr>';
        });

        const templateHtml = `
            <div id="pdf-printable-document" style="padding: 24px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff;">
                <!-- HEADER -->
                <div style="border-bottom: 2.5px solid #d4af37; padding-bottom: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                        <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 1.5px; color: #b45309; margin-bottom: 3px;">Kody Logowania Gości</div>
                        <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(eventName)}</h1>
                    </div>
                    <div style="text-align: right; font-size: 10px; color: #64748b; line-height: 1.45;">
                        <div>Liczba gości: <strong style="color: #0f172a;">${sortedGuests.length}</strong></div>
                        <div>Wygenerowano: ${dateStr} ${timeStr}</div>
                    </div>
                </div>

                <!-- INSTRUCTION BOX -->
                <div style="background: #fdfaf3; border: 1px solid #fde68a; border-radius: 6px; padding: 9px 14px; margin-bottom: 16px; font-size: 10.5px; color: #92400e; line-height: 1.4;">
                    <strong>Instrukcja dla gości:</strong> Aby się zalogować, wejdź na stronę aplikacji i wpisz swój kod z poniższej listy lub wejdź z dedykowanego linku QR.
                </div>

                <!-- TABLE -->
                <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
                    <thead style="display: table-header-group;">
                        ${theadHtml}
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <!-- FOOTER -->
                <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9.5px; color: #94a3b8;">
                    <span>${escapeHtml(eventName)} &bull; Panel Organizatora</span>
                    <span>Dokument poufny &bull; Zawiera kody dostępu</span>
                </div>
            </div>
        `;

        sheetWrapper.innerHTML = templateHtml;
    }

    async function triggerPdfDownload() {
        const sheet = document.getElementById('admin-pdf-sheet-wrapper');
        const downloadBtn = document.getElementById('admin-pdf-download-btn');
        if (!sheet) return;

        const eventName = (weddingConfigRaw && (weddingConfigRaw.wedding_name || weddingConfigRaw.organization_name)) || 'Wydarzenie';
        const fileSlug = eventName.toLowerCase().replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
        const pdfFilename = `kody_logowania_${fileSlug}.pdf`;

        const origHtml = downloadBtn ? downloadBtn.innerHTML : '';
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Zapisywanie PDF...';
        }

        try {
            if (typeof html2pdf !== 'undefined') {
                const opt = {
                    margin: [10, 10, 12, 10],
                    filename: pdfFilename,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 1.5, useCORS: true, logging: false },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
                };
                await html2pdf().set(opt).from(sheet).save();
                if (downloadBtn) {
                    downloadBtn.innerHTML = '<i class="ph ph-check"></i> Pobrano PDF!';
                    setTimeout(() => {
                        downloadBtn.disabled = false;
                        downloadBtn.innerHTML = origHtml;
                    }, 3000);
                }
            } else {
                openPrintWindow(sheet.innerHTML, eventName);
                if (downloadBtn) {
                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = origHtml;
                }
            }
        } catch (err) {
            console.error("Błąd zapisu PDF:", err);
            openPrintWindow(sheet.innerHTML, eventName);
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = origHtml;
            }
        }
    }

    async function exportGuestsToPdf() {
        if (!allGuestsData || allGuestsData.length === 0) {
            alert("Brak gości do wygenerowania listy PDF.");
            return;
        }

        const modal = document.getElementById('admin-pdf-modal');
        const subtitleEl = document.getElementById('admin-pdf-modal-subtitle');
        if (!modal) {
            alert("Nie znaleziono okna podglądu PDF.");
            return;
        }

        const cols = getPdfSelectedColumns();
        syncPdfColumnCheckboxes(cols);
        renderPdfSheet(cols);

        const eventName = (weddingConfigRaw && (weddingConfigRaw.wedding_name || weddingConfigRaw.organization_name)) || 'Wydarzenie';
        if (subtitleEl) {
            subtitleEl.textContent = `${eventName} • Liczba gości: ${allGuestsData.length}`;
        }

        modal.style.display = 'flex';
    }

    function openGuestModal(id = null) {
        const guestModal = document.getElementById('admin-guest-modal');
        const titleEl = document.getElementById('admin-guest-modal-title');
        const idField = document.getElementById('admin-guest-id');
        const prefixField = document.getElementById('admin-guest-prefix');
        const firstNameField = document.getElementById('admin-guest-first-name');
        const lastNameField = document.getElementById('admin-guest-last-name');
        const isPlusOneField = document.getElementById('admin-guest-is-plus-one');
        const roleField = document.getElementById('admin-guest-role');
        const parentField = document.getElementById('admin-guest-parent');
        const tableField = document.getElementById('admin-guest-table');
        const seatField = document.getElementById('admin-guest-seat');
        const relationshipField = document.getElementById('admin-guest-relationship');
        const phoneField = document.getElementById('admin-guest-phone');
        const howMetField = document.getElementById('admin-guest-how-met');

        // Reset form
        idField.value = '';
        prefixField.value = '';
        firstNameField.value = '';
        lastNameField.value = '';
        isPlusOneField.checked = false;
        roleField.value = 'gosc';
        parentField.value = '';
        tableField.value = '';
        seatField.value = '';
        relationshipField.value = '';
        phoneField.value = '';
        howMetField.value = '';

        if (id) {
            titleEl.textContent = 'Edytuj Gościa';
            const guest = allGuestsData.find(g => g.id == id);
            if (guest) {
                idField.value = guest.id;
                prefixField.value = guest.prefix || '';
                firstNameField.value = guest.first_name || '';
                lastNameField.value = guest.last_name || '';
                isPlusOneField.checked = guest.is_plus_one;
                roleField.value = guest.role;
                tableField.value = (guest.table_number !== null && guest.table_number !== undefined) ? guest.table_number : '';
                seatField.value = (guest.seat_number !== null && guest.seat_number !== undefined) ? guest.seat_number : '';
                relationshipField.value = guest.relationship || '';
                phoneField.value = guest.phone || '';
                howMetField.value = guest.how_we_met || '';

                // Set parent selection if they share code with someone else who was created before them
                const parent = allGuestsData.find(o => o.login_code === guest.login_code && o.id !== guest.id);
                if (parent) parentField.value = parent.id;
            }
        } else {
            titleEl.textContent = 'Dodaj Gościa';
        }

        guestModal.style.display = 'flex';
    }

    async function deleteGuest(id) {
        if (!confirm("Czy na pewno chcesz usunąć tego gościa?")) return;

        try {
            const res = await fetch(`${API_URL}/admin/guests/${id}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                loadAdminGuests();
            }
        } catch(e) {
            console.error("Delete guest error:", e);
        }
    }

    // ── CONFIG FORMS ───────────────────────────────────────────────────────────
    function populateOrganizationTab(cfg) {
        if (!cfg) return;

        // 1. Direct Wedding Link Box
        const directUrlInput = document.getElementById('admin-org-direct-url');
        if (directUrlInput) {
            const cleanPath = window.location.pathname.replace('admin.html', '').replace(/\/+$/, '') || '';
            const orgId = cfg.organization_id || currentOrgId;
            const guestUrl = `${window.location.origin}${cleanPath}/?org=${orgId}`;
            directUrlInput.value = guestUrl;
        }

        // 2. Organization Info Form
        const orgEventType = document.getElementById('admin-org-event-type');
        const customLabels = cfg.custom_labels || {};
        const eventTypeVal = customLabels.event_type || cfg.event_type || 'wedding';
        if (orgEventType) {
            orgEventType.value = eventTypeVal;
        }

        const orgWeddingName = document.getElementById('admin-org-wedding-name');
        if (orgWeddingName) orgWeddingName.value = cfg.wedding_name || cfg.organization_name || '';

        const orgPartner1 = document.getElementById('admin-org-partner1');
        if (orgPartner1) orgPartner1.value = cfg.partner1_name || '';

        const orgPartner2 = document.getElementById('admin-org-partner2');
        if (orgPartner2) orgPartner2.value = cfg.partner2_name || '';

        const orgMonogram = document.getElementById('admin-org-monogram');
        if (orgMonogram) orgMonogram.value = cfg.monogram_text || '';

        const orgDateText = document.getElementById('admin-org-date-text');
        if (orgDateText) orgDateText.value = cfg.date_display_text || '';

        const orgWeddingDate = document.getElementById('admin-org-wedding-date');
        if (orgWeddingDate) orgWeddingDate.value = cfg.wedding_date ? cfg.wedding_date.slice(0, 16) : '';

        const orgWeddingEndDate = document.getElementById('admin-org-wedding-end-date');
        if (orgWeddingEndDate) orgWeddingEndDate.value = cfg.wedding_end_date ? cfg.wedding_end_date.slice(0, 16) : '';

        // 3. Custom Labels per Organization
        const orgAdminPanelTitle = document.getElementById('admin-org-admin-panel-title');
        if (orgAdminPanelTitle) orgAdminPanelTitle.value = cfg.admin_panel_title || '';

        const orgContactLabel = document.getElementById('admin-org-contact-label');
        if (orgContactLabel) orgContactLabel.value = cfg.contact_label || '';

        const orgDefaultStatusText = document.getElementById('admin-org-default-status-text');
        if (orgDefaultStatusText) orgDefaultStatusText.value = cfg.default_status_text || '';

        // 4. Enabled Modules
        const orgWishesCheckbox = document.getElementById('admin-org-wishes-enabled-checkbox');
        if (orgWishesCheckbox) orgWishesCheckbox.checked = cfg.wishes_enabled !== false;

        const orgWishesAudioCheckbox = document.getElementById('admin-org-wishes-audio-checkbox');
        if (orgWishesAudioCheckbox) orgWishesAudioCheckbox.checked = cfg.wishes_audio_enabled !== false;

        const orgWishesVideoCheckbox = document.getElementById('admin-org-wishes-video-checkbox');
        if (orgWishesVideoCheckbox) orgWishesVideoCheckbox.checked = cfg.wishes_video_enabled !== false;

        const orgSeatingCheckbox = document.getElementById('admin-org-seating-enabled-checkbox');
        if (orgSeatingCheckbox) orgSeatingCheckbox.checked = cfg.seating_enabled !== false;

        const orgSimpleCodesCheckbox = document.getElementById('admin-org-simple-codes-checkbox');
        if (orgSimpleCodesCheckbox) orgSimpleCodesCheckbox.checked = Boolean(cfg.simple_codes_enabled);

        // 5. Roles configuration & dynamic builder
        const roles = cfg.roles_config || {};
        const isSingle = !cfg.partner2_name || !cfg.partner2_name.trim();

        renderRolesBuilder(roles, isSingle);
        updateRoleDropdowns(roles, isSingle);

        const adminHeaderTitle = document.getElementById('admin-header-title');
        if (adminHeaderTitle && cfg.admin_panel_title) {
            adminHeaderTitle.textContent = cfg.admin_panel_title;
        }

        const logoPreview = document.getElementById('admin-org-logo-preview');
        if (logoPreview) {
            if (cfg.logo_image) {
                logoPreview.style.display = 'block';
                logoPreview.querySelector('img').src = cfg.logo_image;
            } else {
                logoPreview.style.display = 'none';
            }
        }
    }

    async function loadAdminConfigForm() {
        try {
            const res = await fetch(`${API_URL}/wedding-config/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                weddingConfigRaw = await res.json();

                if (weddingConfigRaw.organization_id && !explicitOrg) {
                    currentOrgId = weddingConfigRaw.organization_id;
                    localStorage.setItem('current_org_id', weddingConfigRaw.organization_id);
                }
                
                window.__WEDDING_CONFIG = weddingConfigRaw;

                // 1. Timeline Tab
                try {
                    renderAdminTimelineForm(weddingConfigRaw.schedule_events || []);
                } catch(err) {
                    console.error("Timeline render error:", err);
                }

                // 2. Info Tab
                try {
                    renderAdminInfoForm(weddingConfigRaw.info_places || []);
                } catch(err) {
                    console.error("Info render error:", err);
                }

                // 3. Couple Page Tab
                try {
                    const previewImg = document.getElementById('admin-couple-image-preview');
                    const imageContainer = document.getElementById('admin-couple-image-container');
                    const imageHelp = document.getElementById('admin-couple-image-help');
                    const placeholder = document.getElementById('admin-upload-placeholder');
                    
                    coupleImageFocusX = (weddingConfigRaw.couple_image_position_x !== undefined && weddingConfigRaw.couple_image_position_x !== null) ? weddingConfigRaw.couple_image_position_x : 50;
                    coupleImageFocusY = (weddingConfigRaw.couple_image_position_y !== undefined && weddingConfigRaw.couple_image_position_y !== null) ? weddingConfigRaw.couple_image_position_y : 50;
                    
                    if (weddingConfigRaw.couple_image) {
                        if (previewImg) previewImg.src = weddingConfigRaw.couple_image;
                        if (imageContainer) imageContainer.style.display = 'block';
                        if (imageHelp) imageHelp.style.display = 'block';
                        if (placeholder) placeholder.style.display = 'none';
                        updateFocusMarkerUI();
                    } else {
                        if (imageContainer) imageContainer.style.display = 'none';
                        if (imageHelp) imageHelp.style.display = 'none';
                        if (placeholder) placeholder.style.display = 'flex';
                    }
                    renderAdminStatusTextsForm(weddingConfigRaw.status_texts || []);
                    
                    const phoneGroomInput = document.getElementById('admin-phone-groom-input');
                    if (phoneGroomInput) phoneGroomInput.value = weddingConfigRaw.phone_groom || '';
                    const phoneBrideInput = document.getElementById('admin-phone-bride-input');
                    if (phoneBrideInput) phoneBrideInput.value = weddingConfigRaw.phone_bride || '';

                    const wishesEnabledCheckbox = document.getElementById('admin-wishes-enabled-checkbox');
                    const wishesLockedCheckbox = document.getElementById('admin-wishes-locked-checkbox');
                    if (wishesEnabledCheckbox) wishesEnabledCheckbox.checked = weddingConfigRaw.wishes_enabled !== false;
                    if (wishesLockedCheckbox) wishesLockedCheckbox.checked = weddingConfigRaw.wishes_locked === true;
                } catch(err) {
                    console.error("Couple settings error:", err);
                }

                // 4. Header config
                try {
                    const hs = weddingConfigRaw.header_mode_settings || {};
                    const adminHeaderEnabled = document.getElementById('admin-header-enabled');
                    if (adminHeaderEnabled) adminHeaderEnabled.checked = hs.header_enabled !== false;
                    const adminCountdownEnd = document.getElementById('admin-countdown-end');
                    if (adminCountdownEnd) adminCountdownEnd.value = hs.countdown_end ? hs.countdown_end.slice(0, 16) : '';
                    const adminScheduleStart = document.getElementById('admin-schedule-start');
                    if (adminScheduleStart) adminScheduleStart.value = hs.schedule_start ? hs.schedule_start.slice(0, 16) : '';
                    const adminThankYouStart = document.getElementById('admin-thank-you-start');
                    if (adminThankYouStart) adminThankYouStart.value = hs.thank_you_start ? hs.thank_you_start.slice(0, 16) : '';
                } catch(err) {
                    console.error("Header settings error:", err);
                }

                // 5. Witness tab
                try {
                    const wp = weddingConfigRaw.witness_permissions || {};
                    const adminPermDelPhotos = document.getElementById('admin-perm-delete-photos');
                    if (adminPermDelPhotos) adminPermDelPhotos.checked = wp.can_delete_photos === true;
                    const adminPermDelVideos = document.getElementById('admin-perm-delete-videos');
                    if (adminPermDelVideos) adminPermDelVideos.checked = wp.can_delete_videos === true;
                    const adminPermSeeWishes = document.getElementById('admin-perm-see-wishes');
                    if (adminPermSeeWishes) adminPermSeeWishes.checked = wp.can_see_wishes !== false;
                } catch(err) {
                    console.error("Witness settings error:", err);
                }

                // 6. Theme Tab
                try {
                    const theme = weddingConfigRaw.theme_settings || {};
                    const presetSelect = document.getElementById('admin-theme-preset-select');
                    if (presetSelect) presetSelect.value = theme.preset_name || 'classic_gold';

                    setThemeField('admin-theme-color-bg', theme.color_bg || '#f7f3ee');
                    setThemeField('admin-theme-color-text', theme.color_text || '#111111');
                    setThemeField('admin-theme-color-primary', theme.color_primary || '#2E2E2E');
                    setThemeField('admin-theme-color-accent', theme.color_accent || '#c9a84c');
                    setThemeField('admin-theme-color-surface', theme.color_surface || '#FAF6F0');
                    setThemeField('admin-theme-color-qr', theme.qr_code_color || '#000000');

                    const fontHeadingSelect = document.getElementById('admin-theme-font-heading');
                    if (fontHeadingSelect && theme.font_heading) fontHeadingSelect.value = theme.font_heading;

                    const fontBodySelect = document.getElementById('admin-theme-font-body');
                    if (fontBodySelect && theme.font_body) fontBodySelect.value = theme.font_body;

                    updateLiveThemePreview();
                } catch(err) {
                    console.error("Theme settings error:", err);
                }

                // 7. Organization Tab
                try {
                    populateOrganizationTab(weddingConfigRaw);
                } catch(err) {
                    console.error("Organization tab populate error:", err);
                }

                loadOrganizationsList();
            } else {
                console.error(`Failed to load wedding config form. Status: ${res.status}`);
            }
        } catch(e) {
            console.error("Failed to load wedding config form:", e);
        }
    }

    async function patchWeddingConfig(formDataOrJson, isJson = true) {
        const headers = { 'Authorization': `Bearer ${token}` };
        if (isJson) headers['Content-Type'] = 'application/json';

        try {
            const res = await fetch(`${API_URL}/wedding-config/`, {
                method: 'PATCH',
                headers: headers,
                body: isJson ? JSON.stringify(formDataOrJson) : formDataOrJson
            });
            if (res.ok) {
                alert("Zmiany zostały pomyślnie zapisane!");
                loadAdminConfigForm();
            } else {
                alert("Wystąpił błąd podczas zapisu konfiguracji.");
            }
        } catch(e) {
            console.error("Failed to patch wedding config:", e);
        }
    }

    // ── GLOBAL ICON PICKER ─────────────────────────────────────────────────────
    const CURATED_ICONS = [
        'ph-fill ph-church', 'ph-fill ph-martini', 'ph-fill ph-champagne', 'ph-fill ph-cake', 
        'ph-fill ph-music-notes', 'ph-fill ph-microphone-stage', 'ph-fill ph-heart', 'ph-fill ph-confetti', 
        'ph-fill ph-balloon', 'ph-fill ph-sparkles', 'ph-fill ph-gift', 'ph-fill ph-crown',
        'ph-fill ph-fork-knife', 'ph-fill ph-coffee', 'ph-fill ph-beer-bottle', 'ph-fill ph-wine', 
        'ph-fill ph-cooking-pot', 'ph-fill ph-bed', 'ph-fill ph-car', 'ph-fill ph-bus', 
        'ph-fill ph-airplane', 'ph-fill ph-map-pin', 'ph-fill ph-clock', 'ph-fill ph-calendar', 
        'ph-fill ph-camera', 'ph-fill ph-star', 'ph-fill ph-phone', 'ph-fill ph-phone-call', 
        'ph-fill ph-device-mobile'
    ];

    let activePickerInput = null;
    let activePickerPreview = null;
    let iconPickerPopover = null;

    function initGlobalIconPicker() {
        if (iconPickerPopover) return;

        iconPickerPopover = document.createElement('div');
        iconPickerPopover.id = 'global-icon-picker-popover';
        iconPickerPopover.style.cssText = `
            display: none;
            position: absolute;
            z-index: 100000;
            background: #1a1612;
            border: 1.5px solid rgba(255,255,255,0.08);
            border-radius: 14px;
            padding: 12px;
            width: 280px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6);
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            max-height: 250px;
            overflow-y: auto;
        `;

        CURATED_ICONS.forEach(iconClass => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.cssText = `
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 8px;
                color: #f0ece4;
                padding: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s;
            `;
            btn.innerHTML = `<i class="${iconClass}" style="font-size: 1.25rem;"></i>`;
            btn.title = iconClass;
            
            btn.addEventListener('mouseover', () => { btn.style.background = 'rgba(255,255,255,0.12)'; });
            btn.addEventListener('mouseout', () => { btn.style.background = 'rgba(255,255,255,0.04)'; });
            
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (activePickerInput) activePickerInput.value = iconClass;
                if (activePickerPreview) {
                    activePickerPreview.className = iconClass;
                }
                hideIconPicker();
            });
            iconPickerPopover.appendChild(btn);
        });

        document.body.appendChild(iconPickerPopover);

        // Close on clicking outside
        document.addEventListener('click', (e) => {
            if (iconPickerPopover.style.display === 'grid' && !iconPickerPopover.contains(e.target)) {
                hideIconPicker();
            }
        });
    }

    function showIconPicker(buttonEl, inputEl, previewEl) {
        initGlobalIconPicker();
        activePickerInput = inputEl;
        activePickerPreview = previewEl;

        const rect = buttonEl.getBoundingClientRect();
        iconPickerPopover.style.position = 'absolute';

        // Oblicz poprawną pozycję pionową (wyświetl nad przyciskiem, jeśli brak miejsca pod spodem w oknie)
        const popoverHeight = 250; // szacowana wysokość okienka ikon
        let top = rect.bottom + window.scrollY + 6;
        if (rect.bottom + popoverHeight > window.innerHeight && rect.top > popoverHeight) {
            top = rect.top + window.scrollY - popoverHeight - 6;
        }

        // Oblicz poprawną pozycję poziomą (wyśrodkuj względem przycisku i zabezpiecz krawędzie ekranu)
        const popoverWidth = 280;
        let left = rect.left + window.scrollX + (rect.width / 2) - (popoverWidth / 2);
        
        // Zabezpieczenie przed wyjściem poza lewy i prawy margines viewportu
        const minLeft = 10 + window.scrollX;
        const maxLeft = window.innerWidth + window.scrollX - popoverWidth - 10;
        left = Math.max(minLeft, Math.min(left, maxLeft));

        iconPickerPopover.style.top = `${top}px`;
        iconPickerPopover.style.left = `${left}px`;
        iconPickerPopover.style.display = 'grid';
    }

    function hideIconPicker() {
        if (iconPickerPopover) iconPickerPopover.style.display = 'none';
        activePickerInput = null;
        activePickerPreview = null;
    }

    function bindIconPickers(container) {
        container.querySelectorAll('.icon-picker-btn').forEach(btn => {
            const wrapper = btn.closest('.admin-form-group');
            const input = wrapper.querySelector('input');
            const preview = btn.querySelector('i');
            
            // Sync preview if user types manually
            input.addEventListener('input', () => {
                preview.className = input.value || 'ph-fill ph-star';
            });

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (iconPickerPopover && iconPickerPopover.style.display === 'grid' && activePickerInput === input) {
                    hideIconPicker();
                } else {
                    showIconPicker(btn, input, preview);
                }
            });
        });
    }

    // ── GLOBAL EMOJI PICKER ────────────────────────────────────────────────────
    const EMOJI_LIST = [
        // Ślubne / Love
        { emoji: '❤️', keywords: 'serce miłość love heart red czerwone', cat: 'wedding' },
        { emoji: '💖', keywords: 'serce miłość love sparkles sparkling heart błyszczące', cat: 'wedding' },
        { emoji: '💕', keywords: 'serce miłość love hearts dwa', cat: 'wedding' },
        { emoji: '💍', keywords: 'pierścionek obrączka ring wedding marriage ślub', cat: 'wedding' },
        { emoji: '👰', keywords: 'panna młoda bride woman wedding kobieta ślub', cat: 'wedding' },
        { emoji: '🤵', keywords: 'pan młody groom man tux wedding facet ślub', cat: 'wedding' },
        { emoji: '💒', keywords: 'kościół ślub kaplica church wedding chapel', cat: 'wedding' },
        { emoji: '💑', keywords: 'para miłość couple love zakochani', cat: 'wedding' },
        { emoji: '💐', keywords: 'bukiet kwiaty bouquet flowers wedding', cat: 'wedding' },
        { emoji: '💋', keywords: 'usta pocałunek kiss lips buziak', cat: 'wedding' },
        { emoji: '💌', keywords: 'list miłosny zaproszenie love letter invitation koperta', cat: 'wedding' },
        
        // Buźki
        { emoji: '😊', keywords: 'uśmiech radość smile happy face zadowolony', cat: 'smileys' },
        { emoji: '😍', keywords: 'miłość zakochany love eyes heart happy serca oczy', cat: 'smileys' },
        { emoji: '😘', keywords: 'pocałunek buziak kiss blow face', cat: 'smileys' },
        { emoji: '🥳', keywords: 'impreza świętowanie party celebrate horn czapeczka', cat: 'smileys' },
        { emoji: '🤪', keywords: 'szalony głupi crazy silly zany zez', cat: 'smileys' },
        { emoji: '😎', keywords: 'okulary luz cool sunglasses okularki', cat: 'smileys' },
        { emoji: '😉', keywords: 'oczko wink face puszcza', cat: 'smileys' },
        { emoji: '😆', keywords: 'uśmiech śmiech laugh grin happy', cat: 'smileys' },
        { emoji: '🤩', keywords: 'gwiazdy zafascynowany star eyes excited gwiazdki', cat: 'smileys' },

        // Impreza / Jedzenie
        { emoji: '🥂', keywords: 'szampan toast kieliszki cheers champagne glasses alkohol drink prosto', cat: 'party' },
        { emoji: '🍷', keywords: 'wino kieliszek wine glass alcohol', cat: 'party' },
        { emoji: '🍻', keywords: 'piwo toast beers cheers alcohol kufle', cat: 'party' },
        { emoji: '🍹', keywords: 'drinki koktajl cocktail drink', cat: 'party' },
        { emoji: '💃', keywords: 'taniec kobieta dance woman dancer', cat: 'party' },
        { emoji: '🕺', keywords: 'taniec mężczyzna dance man dancer', cat: 'party' },
        { emoji: '🎸', keywords: 'gitara muzyka instrument guitar music rock', cat: 'party' },
        { emoji: '🎶', keywords: 'nuty muzyka śpiew notes music', cat: 'party' },
        { emoji: '🍰', keywords: 'tort ciasto deser cake slice sweet słodkie', cat: 'party' },
        { emoji: '🎂', keywords: 'tort urodziny ciasto birthday cake świeczki', cat: 'party' },

        // Różne
        { emoji: '✨', keywords: 'błysk gwiazdki sparkles shine gold iskierki', cat: 'misc' },
        { emoji: '🎉', keywords: 'konfetti impreza party popper celebration tuba', cat: 'misc' },
        { emoji: '🎈', keywords: 'balon impreza balloon party decoration balony', cat: 'misc' },
        { emoji: '📸', keywords: 'aparat zdjęcia camera photo photography aparat fotograficzny', cat: 'misc' },
        { emoji: '🌸', keywords: 'kwiat roślina flower cherry blossom różowy', cat: 'misc' },
        { emoji: '🌹', keywords: 'róża kwiat rose flower red czerwona', cat: 'misc' },
        { emoji: '🌟', keywords: 'gwiazda star gold', cat: 'misc' },
        { emoji: '👑', keywords: 'korona król królowa crown king queen', cat: 'misc' },
        { emoji: '🚗', keywords: 'auto samochód ślubny car wedding auto bryka', cat: 'misc' }
    ];

    let emojiPickerPopover = null;
    let activeEmojiInput = null;
    let activeEmojiPreview = null;

    function initGlobalEmojiPicker() {
        if (emojiPickerPopover) return;

        emojiPickerPopover = document.createElement('div');
        emojiPickerPopover.id = 'global-emoji-picker-popover';
        emojiPickerPopover.style.cssText = `
            position: absolute;
            display: none;
            flex-direction: column;
            width: 280px;
            padding: 12px;
            background: #231c19;
            border: 1.5px solid #dcd1c4;
            border-radius: 16px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.4);
            z-index: 99999;
        `;

        // Search Input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '🔍 Szukaj emotki...';
        searchInput.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            margin-bottom: 10px;
            border-radius: 8px;
            border: 1.5px solid #4a3e3d;
            background: #2d2421;
            color: #f7f5f2;
            outline: none;
            font-size: 0.85rem;
            font-family: inherit;
        `;

        // Grid Area for Emojis
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 6px;
            max-height: 180px;
            overflow-y: auto;
            padding-right: 4px;
        `;

        // Style the scrollbar for grid
        const styleSheet = document.createElement("style");
        styleSheet.innerText = `
            #global-emoji-picker-popover div::-webkit-scrollbar {
                width: 6px;
            }
            #global-emoji-picker-popover div::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.05);
                border-radius: 3px;
            }
            #global-emoji-picker-popover div::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2);
                border-radius: 3px;
            }
            #global-emoji-picker-popover div::-webkit-scrollbar-thumb:hover {
                background: rgba(255,255,255,0.4);
            }
        `;
        document.head.appendChild(styleSheet);

        // Brak emotki button (outside grid)
        const noEmojiBtn = document.createElement('button');
        noEmojiBtn.type = 'button';
        noEmojiBtn.id = 'no-emoji-select-btn';
        noEmojiBtn.style.cssText = `
            width: 100%;
            padding: 6px;
            background: rgba(255,255,255,0.06);
            border: 1px dashed rgba(255,255,255,0.2);
            border-radius: 8px;
            color: #fda4af;
            font-size: 0.82rem;
            cursor: pointer;
            margin-bottom: 6px;
            text-align: center;
            display: block;
        `;
        noEmojiBtn.textContent = '🚫 Brak emotki';
        noEmojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (activeEmojiInput) {
                activeEmojiInput.value = '';
                activeEmojiInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (activeEmojiPreview) {
                activeEmojiPreview.textContent = '🚫';
            }
            hideEmojiPicker();
        });

        // Helper to render filtered emojis
        function renderEmojis(filterText = '') {
            grid.innerHTML = '';
            const query = filterText.toLowerCase().trim();

            if (query) {
                noEmojiBtn.style.display = 'none';
            } else {
                noEmojiBtn.style.display = 'block';
            }

            const filtered = EMOJI_LIST.filter(item => {
                return !query || item.keywords.includes(query) || item.emoji.includes(query);
            });

            if (filtered.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'Brak emotek';
                empty.style.cssText = `
                    grid-column: span 6;
                    text-align: center;
                    color: #8a8074;
                    font-size: 0.8rem;
                    padding: 15px 0;
                `;
                grid.appendChild(empty);
                return;
            }

            filtered.forEach(item => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'emoji-picker-item-btn';
                btn.style.cssText = `
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    background: none;
                    font-size: 1.4rem;
                    cursor: pointer;
                    border-radius: 8px;
                    transition: background 0.15s, transform 0.1s;
                `;
                btn.addEventListener('mouseenter', () => {
                    btn.style.background = 'rgba(255, 255, 255, 0.1)';
                    btn.style.transform = 'scale(1.1)';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = 'none';
                    btn.style.transform = 'scale(1)';
                });

                btn.textContent = item.emoji;

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (activeEmojiInput) {
                        activeEmojiInput.value = item.emoji;
                        activeEmojiInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    if (activeEmojiPreview) {
                        activeEmojiPreview.textContent = item.emoji;
                    }
                    hideEmojiPicker();
                });
                grid.appendChild(btn);
            });
        }

        searchInput.addEventListener('input', (e) => {
            renderEmojis(e.target.value);
        });

        emojiPickerPopover.appendChild(searchInput);
        emojiPickerPopover.appendChild(noEmojiBtn);
        emojiPickerPopover.appendChild(grid);
        document.body.appendChild(emojiPickerPopover);

        // Keep render function reference on popover element
        emojiPickerPopover._renderEmojis = renderEmojis;
        emojiPickerPopover._searchInput = searchInput;

        document.addEventListener('click', (e) => {
            if (emojiPickerPopover.style.display === 'flex' && !emojiPickerPopover.contains(e.target)) {
                hideEmojiPicker();
            }
        });
    }

    function showEmojiPicker(buttonEl, inputEl, previewEl) {
        initGlobalEmojiPicker();
        activeEmojiInput = inputEl;
        activeEmojiPreview = previewEl;

        // Reset search field
        emojiPickerPopover._searchInput.value = '';
        emojiPickerPopover._renderEmojis();

        const rect = buttonEl.getBoundingClientRect();
        
        // Oblicz poprawną pozycję pionową (wyświetl nad przyciskiem, jeśli brak miejsca pod spodem w oknie)
        const popoverHeight = 310; // szacowana wysokość okienka z przyciskiem "Brak emotki"
        let top = rect.bottom + window.scrollY + 6;
        if (rect.bottom + popoverHeight > window.innerHeight && rect.top > popoverHeight) {
            top = rect.top + window.scrollY - popoverHeight - 6;
        }

        // Oblicz poprawną pozycję poziomą (zabezpiecz przed wyjściem za lewą i prawą krawędź ekranu)
        const popoverWidth = 280;
        let left = rect.left + window.scrollX + (rect.width / 2) - (popoverWidth / 2);
        
        // Zabezpieczenie przed wyjściem poza lewy i prawy margines viewportu (uwzględniając przewijanie)
        const minLeft = 10 + window.scrollX;
        const maxLeft = window.innerWidth + window.scrollX - popoverWidth - 10;
        left = Math.max(minLeft, Math.min(left, maxLeft));

        emojiPickerPopover.style.top = `${top}px`;
        emojiPickerPopover.style.left = `${left}px`;
        emojiPickerPopover.style.display = 'flex';
    }

    function hideEmojiPicker() {
        if (emojiPickerPopover) emojiPickerPopover.style.display = 'none';
        activeEmojiInput = null;
        activeEmojiPreview = null;
    }

    function bindEmojiPickers(container) {
        container.querySelectorAll('.emoji-picker-btn').forEach(btn => {
            const wrapper = btn.parentElement;
            const input = wrapper.querySelector('.status-emoji-input');
            const preview = btn;
            if (!input) return;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (emojiPickerPopover && emojiPickerPopover.style.display === 'flex' && activeEmojiInput === input) {
                    hideEmojiPicker();
                } else {
                    showEmojiPicker(btn, input, preview);
                }
            });
        });
    }

    // ── TIMELINE TAB ───────────────────────────────────────────────────────────
    const SCHEDULE_PRESETS = {
        wedding: [
            { time: '16:00', label: '16:00 Ślub', title: 'Ceremonia Zaślubin', desc: 'Uroczysta ceremonia złożenia przysięgi małżeńskiej.', location: 'Kościół / Urząd Stanu Cywilnego', icon: 'ph-fill ph-church' },
            { time: '17:30', label: '17:30 Życzenia i Toast', title: 'Powitanie i Toast Powitalny', desc: 'Przybycie na salę, powitanie chlebem i solą, uroczysty toast i składanie życzeń.', location: 'Sala Główna', icon: 'ph-fill ph-champagne' },
            { time: '18:30', label: '18:30 Obiad', title: 'Uroczysty Obiad Weselny', desc: 'Ciepły posiłek i deser na rozpoczęcie biesiady.', location: 'Sala Bankietowa', icon: 'ph-fill ph-fork-knife' },
            { time: '20:00', label: '20:00 Pierwszy Taniec', title: 'Pierwszy Taniec & Otwarcie Parkietu', desc: 'Rozpoczęcie tanecznej zabawy przez Parę Młodą.', location: 'Parkiet', icon: 'ph-fill ph-music-notes' },
            { time: '22:00', label: '22:00 Tort', title: 'Tort Weselny', desc: 'Krojenie tortu weselnego oraz słodki poczęstunek.', location: 'Sala Główna', icon: 'ph-fill ph-cake' },
            { time: '00:00', label: '00:00 Oczepiny', title: 'Tradycyjne Oczepiny i Zabawy', desc: 'Gry, rzucanie bukietem i muszką oraz zabawa do białego rana.', location: 'Parkiet', icon: 'ph-fill ph-confetti' }
        ],
        birthday: [
            { time: '19:00', label: '19:00 Start & Welcome', title: 'Welcome Drink & Zbiórka Gości', desc: 'Powitalne drinki, rejestracja gości i pamiątkowe zdjęcia na ściance.', location: 'Strefa Wejściowa / Lounge', icon: 'ph-fill ph-martini' },
            { time: '20:30', label: '20:30 Toast', title: 'Uroczysty Toast za Jubilata', desc: 'Przemówienie, życzenia i wzniesienie toastu za solenizanta.', location: 'Sala Główna', icon: 'ph-fill ph-champagne' },
            { time: '21:30', label: '21:30 Tort Urodzinowy', title: 'Tort Urodzinowy & Sto Lat', desc: 'Dmuchanie świeczek, gromkie Sto Lat i słodki poczęstunek.', location: 'Strefa Słodka', icon: 'ph-fill ph-cake' },
            { time: '22:30', label: '22:30 DJ Set & Parkiet', title: 'DJ Set & Otwarcie Parkietu', desc: 'Start ostrej imprezy, najlepsze klubowe hity i pokazy świateł.', location: 'Parkiet / Main Stage', icon: 'ph-fill ph-music-notes' },
            { time: '01:00', label: '01:00 Nocny Posiłek', title: 'Ciepły Nocny Poczęstunek', desc: 'Nocna pizza, street food i doładowanie energii przed dalszą zabawą.', location: 'Strefa Gastro', icon: 'ph-fill ph-cooking-pot' }
        ],
        corporate: [
            { time: '17:00', label: '17:00 Rejestracja', title: 'Rejestracja & Welcome Coffee', desc: 'Powitanie uczestników, networking przy kawie i przekąskach.', location: 'Foyer / Strefa VIP', icon: 'ph-fill ph-coffee' },
            { time: '18:00', label: '18:00 Otwarcie i Gala', title: 'Oficjalne Otwarcie & Prezentacja', desc: 'Podsumowanie roku, przemówienie zarządu i wręczenie nagród firmowych.', location: 'Audytorium / Sala Konferencyjna', icon: 'ph-fill ph-microphone-stage' },
            { time: '19:30', label: '19:30 Kolacja', title: 'Uroczysta Kolacja Bankietowa', desc: 'Ciepły bufet, wykwintne dania i luźne rozmowy biznesowe.', location: 'Sala Bankietowa', icon: 'ph-fill ph-fork-knife' },
            { time: '21:00', label: '21:00 Atrakcja Wieczoru', title: 'Występ Artystyczny / Live Music', desc: 'Koncert na żywo lub pokaz artystyczny.', location: 'Scena Główna', icon: 'ph-fill ph-sparkles' },
            { time: '22:30', label: '22:30 Afterparty', title: 'Networking Afterparty & DJ Set', desc: 'Luźna integracja, open bar i parkiet do nocy.', location: 'Bar & Parkiet', icon: 'ph-fill ph-beer-bottle' }
        ],
        party: [
            { time: '20:00', label: '20:00 Start Party', title: 'Otwarcie Drzwi & Chillout', desc: 'Rozgrzewka muzyczna, pierwsze drinki i zbiórka ekipy.', location: 'Lounge Area', icon: 'ph-fill ph-martini' },
            { time: '22:00', label: '22:00 Peak Time', title: 'Gorący Parkiet & Konfetti', desc: 'Maksymalny ogień na parkiecie!', location: 'Parkiet', icon: 'ph-fill ph-confetti' },
            { time: '00:00', label: '00:00 Północny Toast', title: 'Północny Toast & Niespodzianka', desc: 'Wspólny toast z ekipą i pamiątkowe wideo.', location: 'Bar', icon: 'ph-fill ph-champagne' },
            { time: '02:00', label: '02:00 Late Night Snacks', title: 'Nocne Przekąski', desc: 'Czas na coś pożywnego.', location: 'Kuchnia / Bar', icon: 'ph-fill ph-cooking-pot' }
        ]
    };

    function renderAdminTimelineForm(events) {
        const container = document.getElementById('admin-timeline-list');
        if (!container) return;
        container.innerHTML = '';

        events.forEach((evt, idx) => {
            const div = document.createElement('div');
            div.className = 'admin-list-item';
            div.innerHTML = `
                <div class="admin-list-item-header">
                    <strong>Wydarzenie #${idx + 1}</strong>
                    <button class="admin-list-item-remove remove-timeline-btn">&times;</button>
                </div>
                <div class="admin-form-group">
                    <label>Godzina (np. 18:00)</label>
                    <input type="text" class="timeline-time-input" value="${evt.time || ''}">
                </div>
                <div class="admin-form-group">
                    <label>Krótka etykieta (np. 18:00 Obiad)</label>
                    <input type="text" class="timeline-label-input" value="${evt.label || ''}">
                </div>
                <div class="admin-form-group">
                    <label>Tytuł wydarzenia</label>
                    <input type="text" class="timeline-title-input" value="${evt.title || ''}">
                </div>
                <div class="admin-form-group">
                    <label>Opis</label>
                    <textarea class="timeline-desc-input" rows="2">${evt.desc || ''}</textarea>
                </div>
                <div class="admin-form-group">
                    <label>Lokalizacja</label>
                    <input type="text" class="timeline-loc-input" value="${evt.location || ''}">
                </div>
                <div class="admin-form-group">
                    <label>Ikonka</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="hidden" class="timeline-icon-input" value="${evt.icon || 'ph-fill ph-star'}">
                        <button type="button" class="icon-picker-btn admin-btn-secondary" style="padding: 0; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 10px; cursor: pointer; border: 1.5px solid var(--color-border); background: var(--color-surface2);" title="Wybierz ikonkę">
                            <i class="${evt.icon || 'ph-fill ph-star'}" style="font-size: 1.25rem;"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

        // Add remove handlers
        container.querySelectorAll('.remove-timeline-btn').forEach((btn, idx) => {
            btn.addEventListener('click', () => {
                events.splice(idx, 1);
                renderAdminTimelineForm(events);
            });
        });

        // Bind icon pickers
        bindIconPickers(container);
    }

    function initTimelineFormListeners() {
        const presetSelect = document.getElementById('admin-timeline-preset-select');
        const applyPresetBtn = document.getElementById('admin-apply-preset-btn');
        if (applyPresetBtn && presetSelect) {
            applyPresetBtn.addEventListener('click', () => {
                const presetKey = presetSelect.value;
                if (!presetKey || !SCHEDULE_PRESETS[presetKey]) {
                    showToast('Wybierz szablon z listy rozwijanej.', 'error');
                    return;
                }
                const currentCount = document.querySelectorAll('#admin-timeline-list .admin-list-item').length;
                if (currentCount > 0) {
                    if (!confirm('Załadowanie szablonu zastąpi aktualną listę punktów harmonogramu w formularzu. Czy chcesz kontynuować?')) {
                        return;
                    }
                }
                // Deep copy the preset
                const template = JSON.parse(JSON.stringify(SCHEDULE_PRESETS[presetKey]));
                renderAdminTimelineForm(template);
                showToast(`Załadowano szablon harmonogramu (${presetSelect.options[presetSelect.selectedIndex].text.split(' ')[1] || 'preset'}). Pamiętaj, aby zapisać zmiany!`, 'success');
            });
        }

        const addEventBtn = document.getElementById('admin-add-event-btn');
        if (addEventBtn) {
            addEventBtn.addEventListener('click', () => {
                const list = [];
                document.querySelectorAll('#admin-timeline-list .admin-list-item').forEach(item => {
                    list.push({
                        time: item.querySelector('.timeline-time-input').value,
                        label: item.querySelector('.timeline-label-input').value,
                        title: item.querySelector('.timeline-title-input').value,
                        desc: item.querySelector('.timeline-desc-input').value,
                        location: item.querySelector('.timeline-loc-input').value,
                        icon: item.querySelector('.timeline-icon-input').value,
                    });
                });
                list.push({ time: '', label: '', title: '', desc: '', location: '', icon: 'ph-fill ph-star' });
                renderAdminTimelineForm(list);
            });
        }

        const saveTimelineBtn = document.getElementById('admin-save-timeline-btn');
        if (saveTimelineBtn) {
            saveTimelineBtn.addEventListener('click', () => {
                const list = [];
                document.querySelectorAll('#admin-timeline-list .admin-list-item').forEach(item => {
                    list.push({
                        time: item.querySelector('.timeline-time-input').value,
                        label: item.querySelector('.timeline-label-input').value,
                        title: item.querySelector('.timeline-title-input').value,
                        desc: item.querySelector('.timeline-desc-input').value,
                        location: item.querySelector('.timeline-loc-input').value,
                        icon: item.querySelector('.timeline-icon-input').value,
                    });
                });
                patchWeddingConfig({ schedule_events: list });
            });
        }
    }

    // ── INFO TAB ───────────────────────────────────────────────────────────────
    function getPlacesFromDOM() {
        const list = [];
        document.querySelectorAll('#admin-places-list .admin-list-item').forEach(item => {
            const rows = [];
            item.querySelectorAll('.place-row-item').forEach(rowEl => {
                rows.push({
                    icon: rowEl.querySelector('.row-icon-input').value,
                    text: rowEl.querySelector('.row-text-input').value,
                });
            });
            list.push({
                title: item.querySelector('.place-title-input').value,
                nav_url: item.querySelector('.place-url-input').value,
                nav_text: item.querySelector('.place-url-text-input').value,
                icon: item.querySelector('.place-icon-input').value,
                width: item.querySelector('.place-width-input').value,
                rows: rows
            });
        });
        return list;
    }

    function renderAdminInfoForm(places) {
        const container = document.getElementById('admin-places-list');
        if (!container) return;
        container.innerHTML = '';

        places.forEach((place, idx) => {
            const rows = place.rows || [];
            if (rows.length === 0 && (place.time || place.address)) {
                if (place.time) rows.push({ icon: 'ph ph-clock', text: place.time });
                if (place.address) rows.push({ icon: 'ph ph-map-pin', text: place.address });
            }

            let rowsHtml = '';
            rows.forEach((row, rowIdx) => {
                rowsHtml += `
                    <div class="place-row-item" style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
                        <div class="admin-form-group" style="margin: 0; flex: 0 0 auto;">
                            <input type="hidden" class="row-icon-input" value="${row.icon || 'ph ph-info'}">
                            <button type="button" class="icon-picker-btn admin-btn-secondary" style="padding: 0; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer; border: 1.5px solid var(--color-border); background: var(--color-surface2);" title="Wybierz ikonkę">
                                <i class="${row.icon || 'ph ph-info'}" style="font-size: 1rem;"></i>
                            </button>
                        </div>
                        <input type="text" class="row-text-input" value="${row.text || ''}" placeholder="Wpisz treść..." style="flex: 1; padding: 8px; border: 1.5px solid var(--color-border); border-radius: 8px; font-size: 0.85rem; background: var(--color-surface); color: var(--color-text);">
                        <button type="button" class="admin-list-item-remove remove-row-btn" style="width: 28px; height: 28px; font-size: 1.1rem; line-height: 1; display: flex; align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); cursor: pointer;">&times;</button>
                    </div>
                `;
            });

            const div = document.createElement('div');
            div.className = 'admin-list-item';
            div.innerHTML = `
                <div class="admin-list-item-header">
                    <strong>Informacja #${idx + 1}</strong>
                    <button class="admin-list-item-remove remove-place-btn">&times;</button>
                </div>
                <div class="admin-form-group">
                    <label>Tytuł (np. Ślub)</label>
                    <input type="text" class="place-title-input" value="${place.title || ''}">
                </div>
                <div class="admin-form-group">
                    <label>Link do nawigacji (np. Google Maps)</label>
                    <input type="text" class="place-url-input" value="${place.nav_url || ''}">
                </div>
                <div class="admin-form-group">
                    <label>Napis na przycisku nawigacji</label>
                    <input type="text" class="place-url-text-input" value="${place.nav_text || ''}" placeholder="Domyślnie: Nawiguj do Miejsca">
                </div>
                <div class="admin-form-group">
                    <label>Szerokość karty</label>
                    <select class="place-width-input" style="padding: 10px; border: 1.5px solid var(--color-border); border-radius: 10px; background: var(--color-surface); color: var(--color-text); font-family: inherit; width: 100%;">
                        <option value="100" ${place.width === '100' ? 'selected' : ''}>Pełna szerokość (100%)</option>
                        <option value="50" ${place.width === '50' ? 'selected' : ''}>Pół szerokości (50%)</option>
                        <option value="33" ${place.width === '33' ? 'selected' : ''}>Jedna trzecia (33%)</option>
                        <option value="25" ${place.width === '25' ? 'selected' : ''}>Jedna czwarta (25%)</option>
                    </select>
                </div>
                <div class="admin-form-group">
                    <label>Ikonka główna</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="hidden" class="place-icon-input" value="${place.icon || 'ph-fill ph-star'}">
                        <button type="button" class="icon-picker-btn admin-btn-secondary" style="padding: 0; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 10px; cursor: pointer; border: 1.5px solid var(--color-border); background: var(--color-surface2);" title="Wybierz ikonkę">
                            <i class="${place.icon || 'ph-fill ph-star'}" style="font-size: 1.25rem;"></i>
                        </button>
                    </div>
                </div>
                <div class="admin-form-group-rows" style="margin-top: 15px; border-top: 1px dashed var(--color-border); padding-top: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-weight: 600; font-size: 0.85rem;">Wiersze informacji:</span>
                        <button type="button" class="admin-btn-secondary add-row-btn" style="padding: 4px 8px; font-size: 0.75rem;"><i class="ph ph-plus"></i> Dodaj wiersz</button>
                    </div>
                    <div class="place-rows-container">
                        ${rowsHtml}
                    </div>
                </div>
            `;
            container.appendChild(div);

            div.querySelector('.add-row-btn').addEventListener('click', () => {
                const list = getPlacesFromDOM();
                list[idx].rows.push({ icon: 'ph ph-info', text: '' });
                renderAdminInfoForm(list);
            });

            div.querySelectorAll('.remove-row-btn').forEach((btn, rIdx) => {
                btn.addEventListener('click', () => {
                    const list = getPlacesFromDOM();
                    list[idx].rows.splice(rIdx, 1);
                    renderAdminInfoForm(list);
                });
            });
        });

        container.querySelectorAll('.remove-place-btn').forEach((btn, idx) => {
            btn.addEventListener('click', () => {
                const list = getPlacesFromDOM();
                list.splice(idx, 1);
                renderAdminInfoForm(list);
            });
        });

        bindIconPickers(container);
    }

    function initInfoFormListeners() {
        const addPlaceBtn = document.getElementById('admin-add-place-btn');
        if (addPlaceBtn) {
            addPlaceBtn.addEventListener('click', () => {
                const list = getPlacesFromDOM();
                list.push({ title: '', nav_url: '', nav_text: '', icon: 'ph-info', width: '100', rows: [{ icon: 'ph ph-info', text: '' }] });
                renderAdminInfoForm(list);
            });
        }

        const saveInfoBtn = document.getElementById('admin-save-info-btn');
        if (saveInfoBtn) {
            saveInfoBtn.addEventListener('click', () => {
                const list = getPlacesFromDOM();
                const phoneGroom = document.getElementById('admin-phone-groom-input').value;
                const phoneBride = document.getElementById('admin-phone-bride-input').value;
                patchWeddingConfig({ 
                    info_places: list,
                    phone_groom: phoneGroom,
                    phone_bride: phoneBride
                });
            });
        }
    }

    // ── COUPLE SETTINGS TAB ────────────────────────────────────────────────────
    function renderAdminStatusTextsForm(texts) {
        const container = document.getElementById('admin-status-texts-list');
        if (!container) return;
        container.innerHTML = '';

        texts.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'admin-list-item';
            div.innerHTML = `
                <div class="admin-list-item-header">
                    <strong>Napis #${idx + 1}</strong>
                    <button class="admin-list-item-remove remove-status-btn">&times;</button>
                </div>
                <div class="admin-form-group">
                    <label>Treść napisu</label>
                    <input type="text" class="status-text-input" value="${item.text || ''}" style="width: 100%;">
                </div>
                <div class="admin-form-group">
                    <label>Emotka statusu</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="hidden" class="status-emoji-input" value="${item.emoji || ''}">
                        <button type="button" class="emoji-picker-btn admin-btn-secondary" style="padding: 0; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 10px; cursor: pointer; border: 1.5px solid var(--color-border); background: var(--color-surface2); font-size: 1.25rem;" title="Wybierz emotkę">
                            ${item.emoji || '🚫'}
                        </button>
                    </div>
                </div>
                <div class="admin-form-group">
                    <label>Aktywuj po dacie/godzinie (opcjonalnie)</label>
                    <input type="datetime-local" class="status-switch-input" value="${item.switch_at ? item.switch_at.slice(0, 16) : ''}">
                </div>
            `;
            container.appendChild(div);
        });

        // Add remove handlers
        container.querySelectorAll('.remove-status-btn').forEach((btn, idx) => {
            btn.addEventListener('click', () => {
                const list = [];
                document.querySelectorAll('#admin-status-texts-list .admin-list-item').forEach(item => {
                    list.push({
                        text: item.querySelector('.status-text-input').value,
                        emoji: item.querySelector('.status-emoji-input').value,
                        switch_at: item.querySelector('.status-switch-input').value || null,
                    });
                });
                list.splice(idx, 1);
                renderAdminStatusTextsForm(list);
            });
        });

        // Bind emoji pickers
        bindEmojiPickers(container);
    }

    function initCoupleSettingsListeners() {
        const addStatusBtn = document.getElementById('admin-add-status-btn');
        if (addStatusBtn) {
            addStatusBtn.addEventListener('click', () => {
                const list = [];
                document.querySelectorAll('#admin-status-texts-list .admin-list-item').forEach(item => {
                    list.push({
                        text: item.querySelector('.status-text-input').value,
                        emoji: item.querySelector('.status-emoji-input').value,
                        switch_at: item.querySelector('.status-switch-input').value || null,
                    });
                });
                list.push({ text: '', emoji: '', switch_at: null });
                renderAdminStatusTextsForm(list);
            });
        }

        const imageContainer = document.getElementById('admin-couple-image-container');
        if (imageContainer) {
            imageContainer.addEventListener('click', (e) => {
                const rect = imageContainer.getBoundingClientRect();
                const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                
                // Boundaries check
                coupleImageFocusX = Math.max(0, Math.min(100, x));
                coupleImageFocusY = Math.max(0, Math.min(100, y));
                
                updateFocusMarkerUI();
            });
        }

        const saveCoupleBtn = document.getElementById('admin-save-couple-btn');
        if (saveCoupleBtn) {
            saveCoupleBtn.addEventListener('click', () => {
                const list = [];
                document.querySelectorAll('#admin-status-texts-list .admin-list-item').forEach(item => {
                    list.push({
                        text: item.querySelector('.status-text-input').value,
                        emoji: item.querySelector('.status-emoji-input').value,
                        switch_at: item.querySelector('.status-switch-input').value || null,
                    });
                });
                
                const wishesEnabledCheckbox = document.getElementById('admin-wishes-enabled-checkbox');
                const wishesLockedCheckbox = document.getElementById('admin-wishes-locked-checkbox');
                const wishesEnabled = wishesEnabledCheckbox ? wishesEnabledCheckbox.checked : true;
                const wishesLocked = wishesLockedCheckbox ? wishesLockedCheckbox.checked : false;

                // Read image upload separately if files are modified
                const fileInput = document.getElementById('admin-couple-image-input');
                if (fileInput && fileInput.files.length > 0) {
                    const formData = new FormData();
                    formData.append('couple_image', fileInput.files[0]);
                    formData.append('status_texts', JSON.stringify(list));
                    formData.append('wishes_enabled', wishesEnabled);
                    formData.append('wishes_locked', wishesLocked);
                    formData.append('couple_image_position_x', coupleImageFocusX);
                    formData.append('couple_image_position_y', coupleImageFocusY);
                    patchWeddingConfig(formData, false);
                } else {
                    patchWeddingConfig({ 
                        status_texts: list,
                        wishes_enabled: wishesEnabled,
                        wishes_locked: wishesLocked,
                        couple_image_position_x: coupleImageFocusX,
                        couple_image_position_y: coupleImageFocusY
                    });
                }
            });
        }

        // Local preview of main picture
        const coupleImgInput = document.getElementById('admin-couple-image-input');
        if (coupleImgInput) {
            coupleImgInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const preview = document.getElementById('admin-couple-image-preview');
                        const imageContainer = document.getElementById('admin-couple-image-container');
                        const imageHelp = document.getElementById('admin-couple-image-help');
                        const placeholder = document.getElementById('admin-upload-placeholder');
                        if (preview) {
                            preview.src = event.target.result;
                            if (imageContainer) imageContainer.style.display = 'block';
                            if (imageHelp) imageHelp.style.display = 'block';
                            if (placeholder) placeholder.style.display = 'none';
                            
                            // Reset focus point for new image to center
                            coupleImageFocusX = 50;
                            coupleImageFocusY = 50;
                            updateFocusMarkerUI();
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    // ── HEADER SETTINGS TAB ────────────────────────────────────────────────────
    function initHeaderSettingsListeners() {
        const saveHeaderBtn = document.getElementById('admin-save-header-btn');
        if (saveHeaderBtn) {
            saveHeaderBtn.addEventListener('click', () => {
                const payload = {
                    header_mode_settings: {
                        header_enabled: document.getElementById('admin-header-enabled').checked,
                        countdown_end: document.getElementById('admin-countdown-end').value || null,
                        schedule_start: document.getElementById('admin-schedule-start').value || null,
                        thank_you_start: document.getElementById('admin-thank-you-start').value || null,
                    }
                };
                patchWeddingConfig(payload);
            });
        }
    }

    // ── WITNESS PERMISSIONS TAB ────────────────────────────────────────────────
    function initWitnessPermissionsListeners() {
        const saveWitnessBtn = document.getElementById('admin-save-witness-btn');
        if (saveWitnessBtn) {
            saveWitnessBtn.addEventListener('click', () => {
                const payload = {
                    witness_permissions: {
                        can_delete_photos: document.getElementById('admin-perm-delete-photos').checked,
                        can_delete_videos: document.getElementById('admin-perm-delete-videos').checked,
                        can_see_wishes: document.getElementById('admin-perm-see-wishes').checked,
                    }
                };
                patchWeddingConfig(payload);
            });
        }
    }

    // --- Send Push Notifications ---
    function initPushNotificationsListeners() {
        const sendPushBtn = document.getElementById('admin-send-push-btn');
        if (sendPushBtn) {
            sendPushBtn.addEventListener('click', async () => {
                const msgInput = document.getElementById('admin-push-message-input');
                const scheduleInput = document.getElementById('admin-push-schedule-input');
                const message = msgInput ? msgInput.value.trim() : '';
                if (!message) {
                    alert('Wpisz treść powiadomienia przed wysłaniem.');
                    return;
                }

                let scheduledTime = null;
                if (scheduleInput && scheduleInput.value) {
                    scheduledTime = new Date(scheduleInput.value).toISOString();
                }

                sendPushBtn.disabled = true;
                sendPushBtn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Zapisywanie...';

                try {
                    const payload = { message };
                    if (scheduledTime) {
                        payload.scheduled_time = scheduledTime;
                    }

                    const res = await fetch(`${API_URL}/notifications/send/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(data.message || 'Operacja zakończona sukcesem!');
                        if (msgInput) msgInput.value = '';
                        if (scheduleInput) scheduleInput.value = '';
                        loadPushNotifications();
                    } else {
                        alert(data.error || 'Wystąpił błąd.');
                    }
                } catch (e) {
                    console.error('Push send error:', e);
                    alert('Wystąpił błąd sieci podczas wysyłania.');
                } finally {
                    sendPushBtn.disabled = false;
                    sendPushBtn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Wyślij / Zaplanuj Powiadomienie';
                }
            });
        }
    }

    async function loadPushNotifications() {
        const pushListContainer = document.getElementById('admin-push-list');
        if (!pushListContainer) return;
        pushListContainer.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="ph ph-spinner-gap ph-spin" style="font-size: 1.5rem;"></i> Ładowanie...</div>';

        try {
            const res = await fetch(`${API_URL}/notifications/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const list = await res.json();
                if (list.length === 0) {
                    pushListContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Brak powiadomień w historii.</div>';
                    return;
                }
                pushListContainer.innerHTML = '';
                list.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'admin-list-item';
                    div.style.display = 'flex';
                    div.style.justifyContent = 'space-between';
                    div.style.alignItems = 'center';
                    div.style.padding = '12px 15px';
                    div.style.border = '1.5px solid #e8e2dc';
                    div.style.borderRadius = '10px';
                    div.style.marginBottom = '10px';
                    div.style.background = 'var(--color-surface)';

                    const contentDiv = document.createElement('div');
                    contentDiv.style.flex = '1';
                    
                    const msg = document.createElement('div');
                    msg.style.fontWeight = '600';
                    msg.style.fontSize = '0.92rem';
                    msg.textContent = item.message;

                    const meta = document.createElement('div');
                    meta.style.fontSize = '0.75rem';
                    meta.style.marginTop = '4px';
                    meta.style.opacity = '0.7';

                    let statusText = '';
                    let statusColor = '';
                    if (item.is_sent) {
                        const dateStr = item.sent_at ? new Date(item.sent_at).toLocaleString('pl-PL') : new Date(item.created_at).toLocaleString('pl-PL');
                        statusText = `Wysłano: ${dateStr}`;
                        statusColor = 'green';
                    } else {
                        const dateStr = new Date(item.scheduled_time).toLocaleString('pl-PL');
                        statusText = `Zaplanowane na: ${dateStr}`;
                        statusColor = '#c9a84c';
                    }
                    meta.innerHTML = `<span style="color: ${statusColor}; font-weight: 700;">●</span> ${statusText}`;

                    contentDiv.appendChild(msg);
                    contentDiv.appendChild(meta);
                    div.appendChild(contentDiv);

                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'admin-btn-secondary';
                    cancelBtn.style.padding = '6px 12px';
                    cancelBtn.style.fontSize = '0.82rem';
                    if (!item.is_sent) {
                        cancelBtn.style.background = '#fee2e2';
                        cancelBtn.style.color = '#ef4444';
                        cancelBtn.style.border = '1px solid #fecaca';
                        cancelBtn.innerHTML = '<i class="ph ph-trash"></i> Anuluj';
                    } else {
                        cancelBtn.innerHTML = '<i class="ph ph-trash"></i> Usuń';
                    }
                    
                    cancelBtn.addEventListener('click', async () => {
                        const confirmMsg = item.is_sent 
                            ? 'Czy chcesz usunąć to powiadomienie z historii? (Nie cofnie to wysłanego już powiadomienia)'
                            : 'Czy na pewno chcesz anulować i usunąć to zaplanowane powiadomienie?';
                        if (confirm(confirmMsg)) {
                            try {
                                const delRes = await fetch(`${API_URL}/notifications/${item.id}/`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (delRes.ok) {
                                    loadPushNotifications();
                                } else {
                                    alert('Nie udało się wykonać operacji.');
                                }
                            } catch (e) {
                                console.error(e);
                                alert('Błąd połączenia.');
                            }
                        }
                    });
                    div.appendChild(cancelBtn);

                    pushListContainer.appendChild(div);
                });
            } else {
                pushListContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">Nie udało się załadować listy.</div>';
            }
        } catch (e) {
            console.error(e);
            pushListContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">Błąd sieci.</div>';
        }
    }

    // ── THEME & LIVE PREVIEW HELPERS ──────────────────────────────────────────
    function setThemeField(id, val) {
        const picker = document.getElementById(id);
        const text = document.getElementById(id + '-text');
        if (picker && val) picker.value = val;
        if (text && val) text.value = val;
    }

    function getThemeField(id) {
        const text = document.getElementById(id + '-text');
        const picker = document.getElementById(id);
        return (text && text.value) ? text.value : (picker ? picker.value : '');
    }

    function updateLiveThemePreview() {
        const bg = getThemeField('admin-theme-color-bg') || '#f7f3ee';
        const text = getThemeField('admin-theme-color-text') || '#111111';
        const primary = getThemeField('admin-theme-color-primary') || '#2E2E2E';
        const accent = getThemeField('admin-theme-color-accent') || '#c9a84c';
        const surface = getThemeField('admin-theme-color-surface') || '#FAF6F0';

        const fontHeading = document.getElementById('admin-theme-font-heading')?.value || "'Playfair Display', serif";
        const fontBody = document.getElementById('admin-theme-font-body')?.value || "'Inter', sans-serif";

        const previewBox = document.getElementById('theme-live-preview-box');
        if (previewBox) {
            previewBox.style.backgroundColor = bg;
        }

        const heading = document.getElementById('preview-heading');
        if (heading) {
            heading.style.fontFamily = fontHeading;
            heading.style.color = text;
            const p1 = document.getElementById('admin-org-partner1')?.value?.trim() || 'Gospodarz';
            const p2 = document.getElementById('admin-org-partner2')?.value?.trim();
            heading.textContent = p2 ? `${p1} & ${p2}` : p1;
        }

        const badge = document.getElementById('preview-badge');
        if (badge) {
            badge.style.backgroundColor = accent;
        }

        const body = document.getElementById('preview-body');
        if (body) {
            body.style.fontFamily = fontBody;
            body.style.color = text;
        }

        const btn = document.getElementById('preview-btn');
        if (btn) {
            btn.style.backgroundColor = primary;
        }
    }

    function initThemeSettingsListeners() {
        const presetSelect = document.getElementById('admin-theme-preset-select');
        if (presetSelect) {
            presetSelect.addEventListener('change', (e) => {
                const presetKey = e.target.value;
                if (typeof THEME_PRESETS !== 'undefined' && THEME_PRESETS[presetKey]) {
                    const p = THEME_PRESETS[presetKey];
                    setThemeField('admin-theme-color-bg', p.color_bg);
                    setThemeField('admin-theme-color-text', p.color_text);
                    setThemeField('admin-theme-color-primary', p.color_primary);
                    setThemeField('admin-theme-color-accent', p.color_accent);
                    setThemeField('admin-theme-color-surface', p.color_surface);
                    setThemeField('admin-theme-color-qr', p.qr_code_color);
                    if (p.font_heading && document.getElementById('admin-theme-font-heading')) {
                        document.getElementById('admin-theme-font-heading').value = p.font_heading;
                    }
                    if (p.font_body && document.getElementById('admin-theme-font-body')) {
                        document.getElementById('admin-theme-font-body').value = p.font_body;
                    }
                    updateLiveThemePreview();
                }
            });
        }

        const colorFields = ['bg', 'text', 'primary', 'accent', 'surface', 'qr'];
        colorFields.forEach(cf => {
            const picker = document.getElementById(`admin-theme-color-${cf}`);
            const text = document.getElementById(`admin-theme-color-${cf}-text`);
            if (picker && text) {
                picker.addEventListener('input', (e) => {
                    text.value = e.target.value;
                    if (presetSelect) presetSelect.value = 'custom';
                    updateLiveThemePreview();
                });
                text.addEventListener('input', (e) => {
                    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                        picker.value = e.target.value;
                    }
                    if (presetSelect) presetSelect.value = 'custom';
                    updateLiveThemePreview();
                });
            }
        });

        const fontHeadingSelect = document.getElementById('admin-theme-font-heading');
        if (fontHeadingSelect) {
            fontHeadingSelect.addEventListener('change', updateLiveThemePreview);
        }

        const fontBodySelect = document.getElementById('admin-theme-font-body');
        if (fontBodySelect) {
            fontBodySelect.addEventListener('change', updateLiveThemePreview);
        }

        const saveThemeBtn = document.getElementById('admin-save-theme-btn');
        if (saveThemeBtn) {
            saveThemeBtn.addEventListener('click', async () => {
                saveThemeBtn.disabled = true;
                saveThemeBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Zapisywanie...';
                try {
                    const themePayload = {
                        preset_name: document.getElementById('admin-theme-preset-select')?.value || 'custom',
                        color_bg: getThemeField('admin-theme-color-bg'),
                        color_text: getThemeField('admin-theme-color-text'),
                        color_primary: getThemeField('admin-theme-color-primary'),
                        color_accent: getThemeField('admin-theme-color-accent'),
                        color_surface: getThemeField('admin-theme-color-surface'),
                        qr_code_color: getThemeField('admin-theme-color-qr'),
                        font_heading: document.getElementById('admin-theme-font-heading')?.value,
                        font_body: document.getElementById('admin-theme-font-body')?.value,
                    };

                    await patchWeddingConfig({ theme_settings: themePayload });
                    alert('Motyw i wygląd zostały zaktualizowane!');
                } catch (e) {
                    alert('Błąd zapisu motywu: ' + e);
                } finally {
                    saveThemeBtn.disabled = false;
                    saveThemeBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Zapisz Wygląd & Motyw';
                }
            });
        }
    }

    // ── DYNAMIC ROLES & PERMISSIONS BUILDER ──────────────────────────────────────
    function renderRolesBuilder(rolesConfig, isSingle = false) {
        const container = document.getElementById('admin-roles-builder-container');
        if (!container) return;
        container.innerHTML = '';

        rolesConfig = rolesConfig || {};

        // Merge defaults if not present
        const mergedRoles = {
            para_mloda: {
                label: rolesConfig.para_mloda?.label || (isSingle ? 'Jubilat' : 'Para Młoda'),
                badge_color: rolesConfig.para_mloda?.badge_color || '#b8860b',
                enabled: true,
                require_phone: rolesConfig.para_mloda?.require_phone !== false,
                permissions: {
                    can_delete_photos: true,
                    can_delete_videos: true,
                    can_see_wishes: true,
                    can_moderate_wishes: true,
                    can_send_push: true,
                    can_edit_schedule: true
                }
            },
            swiadek: {
                label: rolesConfig.swiadek?.label || (isSingle ? 'Moderator' : 'Świadek/Świadkowa'),
                badge_color: rolesConfig.swiadek?.badge_color || '#2563eb',
                enabled: rolesConfig.swiadek?.enabled !== false,
                require_phone: rolesConfig.swiadek?.require_phone !== false,
                permissions: {
                    can_delete_photos: rolesConfig.swiadek?.permissions?.can_delete_photos ?? false,
                    can_delete_videos: rolesConfig.swiadek?.permissions?.can_delete_videos ?? false,
                    can_see_wishes: rolesConfig.swiadek?.permissions?.can_see_wishes ?? true,
                    can_moderate_wishes: rolesConfig.swiadek?.permissions?.can_moderate_wishes ?? true,
                    can_send_push: rolesConfig.swiadek?.permissions?.can_send_push ?? false,
                    can_edit_schedule: rolesConfig.swiadek?.permissions?.can_edit_schedule ?? false
                }
            },
            gosc: {
                label: rolesConfig.gosc?.label || 'Gość',
                badge_color: rolesConfig.gosc?.badge_color || '#6b7280',
                enabled: rolesConfig.gosc?.enabled !== false,
                require_phone: rolesConfig.gosc?.require_phone !== false,
                permissions: {
                    can_delete_photos: false,
                    can_delete_videos: false,
                    can_see_wishes: false,
                    can_moderate_wishes: false,
                    can_send_push: false,
                    can_edit_schedule: false
                }
            }
        };

        // Add any custom defined roles
        Object.keys(rolesConfig).forEach(key => {
            if (!['para_mloda', 'swiadek', 'gosc'].includes(key)) {
                const r = rolesConfig[key];
                mergedRoles[key] = {
                    label: r.label || key,
                    badge_color: r.badge_color || '#8b5cf6',
                    enabled: r.enabled !== false,
                    require_phone: Boolean(r.require_phone),
                    permissions: {
                        can_delete_photos: Boolean(r.permissions?.can_delete_photos),
                        can_delete_videos: Boolean(r.permissions?.can_delete_videos),
                        can_see_wishes: Boolean(r.permissions?.can_see_wishes),
                        can_moderate_wishes: Boolean(r.permissions?.can_moderate_wishes),
                        can_send_push: Boolean(r.permissions?.can_send_push),
                        can_edit_schedule: Boolean(r.permissions?.can_edit_schedule)
                    }
                };
            }
        });

        Object.keys(mergedRoles).forEach(roleKey => {
            const role = mergedRoles[roleKey];
            const isSystem = ['para_mloda', 'swiadek', 'gosc'].includes(roleKey);
            const isMaster = roleKey === 'para_mloda';

            const card = document.createElement('div');
            card.className = 'admin-role-card';
            card.dataset.roleKey = roleKey;
            card.style.cssText = `
                border: 1px solid var(--color-border);
                border-radius: 12px;
                padding: 12px 14px;
                background: var(--color-surface2, rgba(0,0,0,0.02));
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="color" class="role-badge-color-input" value="${role.badge_color || '#8b5cf6'}" style="width: 28px; height: 28px; border: none; border-radius: 6px; cursor: pointer; padding: 0; background: none;" title="Wybierz kolor odznaki">
                        <span style="font-weight: 700; font-size: 0.95rem; color: var(--color-text);">${role.label}</span>
                        <span style="font-size: 0.75rem; font-family: monospace; opacity: 0.6; padding: 2px 6px; background: rgba(255,255,255,0.06); border-radius: 4px;">key: ${roleKey}</span>
                        <span class="role-preview-badge" style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; color: #fff; background: ${role.badge_color || '#8b5cf6'};">Odznaka</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
                            <input type="checkbox" class="role-enabled-check" ${role.enabled ? 'checked' : ''} ${isMaster ? 'disabled checked' : ''} style="width: 16px; height: 16px;">
                            ${isMaster ? 'Zawsze aktywna' : 'Włączona'}
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
                            <input type="checkbox" class="role-req-phone-check" ${role.require_phone ? 'checked' : ''} style="width: 16px; height: 16px;">
                            Wymagaj telefonu
                        </label>
                        ${!isSystem ? `
                            <button type="button" class="admin-remove-role-btn" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.1rem; padding: 2px 6px;" title="Usuń rolę">&times;</button>
                        ` : ''}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center;">
                    <div class="admin-form-group" style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: #888;">Nazwa wyświetlana roli</label>
                        <input type="text" class="role-label-input" value="${role.label}" placeholder="np. DJ, Fotograf, Ochrona..." style="padding: 7px 10px; border: 1.5px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); font-size: 0.85rem;">
                    </div>
                </div>

                <div style="border-top: 1px dashed var(--color-border); padding-top: 8px;">
                    <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: var(--color-primary); display: block; margin-bottom: 6px;">Uprawnienia roli:</span>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 6px 12px;">
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; cursor: pointer;">
                            <input type="checkbox" class="perm-check perm-del-photos" ${role.permissions.can_delete_photos ? 'checked' : ''} ${isMaster ? 'disabled checked' : ''}>
                            Usuwanie zdjęć z galerii
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; cursor: pointer;">
                            <input type="checkbox" class="perm-check perm-del-videos" ${role.permissions.can_delete_videos ? 'checked' : ''} ${isMaster ? 'disabled checked' : ''}>
                            Usuwanie filmów wideo
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; cursor: pointer;">
                            <input type="checkbox" class="perm-check perm-see-wishes" ${role.permissions.can_see_wishes ? 'checked' : ''} ${isMaster ? 'disabled checked' : ''}>
                            Podgląd skrzynki życzeń
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; cursor: pointer;">
                            <input type="checkbox" class="perm-check perm-mod-wishes" ${role.permissions.can_moderate_wishes ? 'checked' : ''} ${isMaster ? 'disabled checked' : ''}>
                            Przypinanie życzeń (mod)
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; cursor: pointer;">
                            <input type="checkbox" class="perm-check perm-send-push" ${role.permissions.can_send_push ? 'checked' : ''} ${isMaster ? 'disabled checked' : ''}>
                            Wysyłanie powiadomień push
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; cursor: pointer;">
                            <input type="checkbox" class="perm-check perm-edit-sched" ${role.permissions.can_edit_schedule ? 'checked' : ''} ${isMaster ? 'disabled checked' : ''}>
                            Edycja harmonogramu imprezy
                        </label>
                    </div>
                </div>
            `;

            // Live badge color sync
            const colorInput = card.querySelector('.role-badge-color-input');
            const previewBadge = card.querySelector('.role-preview-badge');
            colorInput.addEventListener('input', () => {
                previewBadge.style.backgroundColor = colorInput.value;
            });

            // Live label sync
            const labelInput = card.querySelector('.role-label-input');
            labelInput.addEventListener('input', () => {
                const titleSpan = card.querySelector('span[style*="font-weight: 700"]');
                if (titleSpan) titleSpan.textContent = labelInput.value || roleKey;
            });

            const removeBtn = card.querySelector('.admin-remove-role-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    if (confirm(`Czy na pewno chcesz usunąć rolę '${role.label}'?`)) {
                        card.remove();
                    }
                });
            }

            container.appendChild(card);
        });
    }

    function collectRolesConfigFromBuilder() {
        const payload = {};
        document.querySelectorAll('#admin-roles-builder-container .admin-role-card').forEach(card => {
            const roleKey = card.dataset.roleKey;
            const label = card.querySelector('.role-label-input')?.value.trim() || roleKey;
            const badge_color = card.querySelector('.role-badge-color-input')?.value || '#6b7280';
            const enabled = card.querySelector('.role-enabled-check')?.checked !== false;
            const require_phone = Boolean(card.querySelector('.role-req-phone-check')?.checked);

            const isMaster = roleKey === 'para_mloda';
            const permissions = {
                can_delete_photos: isMaster || Boolean(card.querySelector('.perm-del-photos')?.checked),
                can_delete_videos: isMaster || Boolean(card.querySelector('.perm-del-videos')?.checked),
                can_see_wishes: isMaster || Boolean(card.querySelector('.perm-see-wishes')?.checked),
                can_moderate_wishes: isMaster || Boolean(card.querySelector('.perm-mod-wishes')?.checked),
                can_send_push: isMaster || Boolean(card.querySelector('.perm-send-push')?.checked),
                can_edit_schedule: isMaster || Boolean(card.querySelector('.perm-edit-sched')?.checked),
            };

            payload[roleKey] = {
                label,
                badge_color,
                enabled,
                require_phone,
                permissions
            };
        });
        return payload;
    }

    // ── ROLE DROPDOWNS & BADGES HELPER ──────────────────────────────────────────
    function updateRoleDropdowns(rolesConfig, isSingle = false) {
        rolesConfig = rolesConfig || {};
        const filterRole = document.getElementById('filter-role');
        const guestRole = document.getElementById('admin-guest-role');

        const currentFilterVal = filterRole ? filterRole.value : '';
        const currentGuestRoleVal = guestRole ? guestRole.value : 'gosc';

        // Build list of all roles
        const rolesList = [];
        const systemKeys = ['para_mloda', 'swiadek', 'gosc'];
        
        systemKeys.forEach(k => {
            const r = rolesConfig[k] || {};
            const defLabel = (k === 'para_mloda') ? (isSingle ? 'Jubilat' : 'Para Młoda') : ((k === 'swiadek') ? (isSingle ? 'Moderator' : 'Świadek') : 'Gość');
            rolesList.push({
                key: k,
                label: r.label || defLabel,
                enabled: r.enabled !== false,
                badge_color: r.badge_color || (k === 'para_mloda' ? '#fbbf24' : (k === 'swiadek' ? '#a5b4fc' : '#8a8074'))
            });
        });

        // Add custom roles
        Object.keys(rolesConfig).forEach(k => {
            if (!systemKeys.includes(k)) {
                const r = rolesConfig[k];
                rolesList.push({
                    key: k,
                    label: r.label || k,
                    enabled: r.enabled !== false,
                    badge_color: r.badge_color || '#8b5cf6'
                });
            }
        });

        if (filterRole) {
            let filterHtml = '<option value="">Rola: Wszystkie</option>';
            rolesList.forEach(r => {
                if (r.enabled) {
                    filterHtml += `<option value="${r.key}">${r.label}</option>`;
                }
            });
            filterRole.innerHTML = filterHtml;
            filterRole.value = currentFilterVal;
        }

        if (guestRole) {
            let guestHtml = '';
            rolesList.forEach(r => {
                if (r.enabled) {
                    guestHtml += `<option value="${r.key}">${r.label}</option>`;
                }
            });
            guestRole.innerHTML = guestHtml;
            if (guestRole.querySelector(`option[value="${currentGuestRoleVal}"]`)) {
                guestRole.value = currentGuestRoleVal;
            }
        }

        // Witness / Moderator tab
        const swiadekRole = rolesList.find(r => r.key === 'swiadek');
        const swiadekLabel = swiadekRole ? swiadekRole.label : (isSingle ? 'Moderator' : 'Świadek');
        const swiadekEnabled = swiadekRole ? swiadekRole.enabled : true;

        const witnessTabNavBtn = document.querySelector('.admin-tab-nav-btn[data-target="admin-tab-witness"]');
        const witnessTabHeader = document.querySelector('#admin-tab-witness .admin-section-header h3');
        const witnessTabSaveBtn = document.getElementById('admin-save-witness-btn');
        if (witnessTabNavBtn) {
            if (!swiadekEnabled) {
                witnessTabNavBtn.style.display = 'none';
            } else {
                witnessTabNavBtn.style.display = 'flex';
                witnessTabNavBtn.title = `Uprawnienia: ${swiadekLabel}`;
            }
        }
        if (witnessTabHeader) {
            witnessTabHeader.textContent = `Uprawnienia: ${swiadekLabel}`;
        }
        if (witnessTabSaveBtn) {
            witnessTabSaveBtn.textContent = `Zapisz Uprawnienia: ${swiadekLabel}`;
        }
    }

    // ── ORGANIZATION SETTINGS TAB ──────────────────────────────────────────────
    function initOrganizationSettingsListeners() {
        const addCustomRoleBtn = document.getElementById('admin-add-custom-role-btn');
        if (addCustomRoleBtn) {
            addCustomRoleBtn.addEventListener('click', () => {
                const roleName = prompt('Podaj nazwę nowej roli (np. DJ, Fotograf, Ochrona, VIP, Rodzic):');
                if (!roleName || !roleName.trim()) return;
                const cleanName = roleName.trim();
                const key = cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
                if (!key) {
                    alert('Nieprawidłowa nazwa roli.');
                    return;
                }
                const existing = document.querySelector(`#admin-roles-builder-container .admin-role-card[data-role-key="${key}"]`);
                if (existing) {
                    alert(`Rola o identyfikatorze '${key}' już istnieje.`);
                    return;
                }
                const currentRoles = collectRolesConfigFromBuilder();
                currentRoles[key] = {
                    label: cleanName,
                    badge_color: '#8b5cf6',
                    enabled: true,
                    require_phone: false,
                    permissions: {
                        can_delete_photos: false,
                        can_delete_videos: false,
                        can_see_wishes: false,
                        can_moderate_wishes: false,
                        can_send_push: false,
                        can_edit_schedule: false
                    }
                };
                const isSingle = !weddingConfigRaw.partner2_name || !weddingConfigRaw.partner2_name.trim();
                renderRolesBuilder(currentRoles, isSingle);
                showToast(`Dodano rolę '${cleanName}'. Pamiętaj, aby zapisać ustawienia organizacji!`, 'success');
            });
        }

        const copyBtn = document.getElementById('admin-copy-direct-url-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const input = document.getElementById('admin-org-direct-url');
                if (input && input.value) {
                    navigator.clipboard.writeText(input.value).then(() => {
                        alert('Skopiowano link do schowka: ' + input.value);
                    }).catch(() => {
                        input.select();
                        document.execCommand('copy');
                        alert('Skopiowano link do schowka!');
                    });
                }
            });
        }

        const saveOrgBtn = document.getElementById('admin-save-org-settings-btn');
        if (saveOrgBtn) {
            saveOrgBtn.addEventListener('click', async () => {
                saveOrgBtn.disabled = true;
                saveOrgBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Zapisywanie...';
                try {
                    const formData = new FormData();
                    formData.append('wedding_name', document.getElementById('admin-org-wedding-name').value.trim());
                    formData.append('partner1_name', document.getElementById('admin-org-partner1').value.trim());
                    formData.append('partner2_name', document.getElementById('admin-org-partner2').value.trim());
                    formData.append('monogram_text', document.getElementById('admin-org-monogram').value.trim());
                    formData.append('date_display_text', document.getElementById('admin-org-date-text').value.trim());

                    const eventTypeSelect = document.getElementById('admin-org-event-type');
                    if (eventTypeSelect) {
                        formData.append('event_type', eventTypeSelect.value);
                    }

                    // Custom Labels per Organization
                    formData.append('admin_panel_title', document.getElementById('admin-org-admin-panel-title')?.value.trim() || '');
                    formData.append('contact_label', document.getElementById('admin-org-contact-label')?.value.trim() || '');
                    formData.append('default_status_text', document.getElementById('admin-org-default-status-text')?.value.trim() || '');

                    // Enabled Features / Modules per Organization
                    const orgWishesCheckbox = document.getElementById('admin-org-wishes-enabled-checkbox');
                    if (orgWishesCheckbox) {
                        formData.append('wishes_enabled', orgWishesCheckbox.checked);
                    }
                    const orgWishesAudioCheckbox = document.getElementById('admin-org-wishes-audio-checkbox');
                    if (orgWishesAudioCheckbox) {
                        formData.append('wishes_audio_enabled', orgWishesAudioCheckbox.checked);
                    }
                    const orgWishesVideoCheckbox = document.getElementById('admin-org-wishes-video-checkbox');
                    if (orgWishesVideoCheckbox) {
                        formData.append('wishes_video_enabled', orgWishesVideoCheckbox.checked);
                    }
                    const orgSeatingCheckbox = document.getElementById('admin-org-seating-enabled-checkbox');
                    if (orgSeatingCheckbox) {
                        formData.append('seating_enabled', orgSeatingCheckbox.checked);
                    }
                    const orgSimpleCodesCheckbox = document.getElementById('admin-org-simple-codes-checkbox');
                    if (orgSimpleCodesCheckbox) {
                        formData.append('simple_codes_enabled', orgSimpleCodesCheckbox.checked);
                    }

                    // Dynamic Roles configuration per Organization
                    const rolesConfigPayload = collectRolesConfigFromBuilder();
                    formData.append('roles_config', JSON.stringify(rolesConfigPayload));

                    const wDate = document.getElementById('admin-org-wedding-date').value;
                    if (wDate) formData.append('wedding_date', wDate);

                    const wEndDate = document.getElementById('admin-org-wedding-end-date').value;
                    if (wEndDate) formData.append('wedding_end_date', wEndDate);

                    const logoInput = document.getElementById('admin-org-logo-file');
                    if (logoInput && logoInput.files && logoInput.files[0]) {
                        formData.append('logo_image', logoInput.files[0]);
                    }

                    await patchWeddingConfig(formData, false);
                } catch(e) {
                    alert('Błąd zapisu danych wesela: ' + e);
                } finally {
                    saveOrgBtn.disabled = false;
                    saveOrgBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Zapisz Dane Wesela';
                }
            });
        }

        const showNewOrgBtn = document.getElementById('admin-show-create-org-btn');
        const newOrgContainer = document.getElementById('admin-create-org-form-container');
        if (showNewOrgBtn && newOrgContainer) {
            showNewOrgBtn.addEventListener('click', () => {
                newOrgContainer.style.display = (newOrgContainer.style.display === 'none' || !newOrgContainer.style.display) ? 'block' : 'none';
            });
        }

        // Quick-Setup Wizard Type Cards Toggle
        const wizardCards = document.querySelectorAll('#wizard-event-type-cards .wizard-type-card');
        wizardCards.forEach(card => {
            card.addEventListener('click', () => {
                wizardCards.forEach(c => {
                    c.classList.remove('active');
                    c.style.borderColor = 'var(--color-border)';
                    c.style.background = 'var(--color-surface)';
                });
                card.classList.add('active');
                card.style.borderColor = 'var(--color-primary)';
                card.style.background = 'rgba(0,0,0,0.03)';
                const radio = card.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                    // Auto-adjust placeholder hints
                    const nameInput = document.getElementById('new-org-name');
                    const p1Input = document.getElementById('new-org-p1');
                    const p2Input = document.getElementById('new-org-p2');
                    if (radio.value === 'birthday') {
                        if (nameInput) nameInput.placeholder = 'np. 18-stka Kamila lub Urodziny Oli';
                        if (p1Input) p1Input.placeholder = 'Imię Jubilata (np. Kamil)';
                        if (p2Input) p2Input.placeholder = 'Opcjonalnie drugi solenizant';
                    } else if (radio.value === 'corporate') {
                        if (nameInput) nameInput.placeholder = 'np. Gala Firmowa TechCorp 2027';
                        if (p1Input) p1Input.placeholder = 'Nazwa Firmy / Koordynator';
                        if (p2Input) p2Input.placeholder = 'Dział / Miasto (opcjonalnie)';
                    } else {
                        if (nameInput) nameInput.placeholder = 'np. Wesele Ani i Piotra';
                        if (p1Input) p1Input.placeholder = 'Imię Partnera 1';
                        if (p2Input) p2Input.placeholder = 'Imię Partnera 2';
                    }
                }
            });
        });

        const submitNewOrgBtn = document.getElementById('new-org-submit-btn');
        if (submitNewOrgBtn) {
            submitNewOrgBtn.addEventListener('click', async () => {
                const eventType = document.querySelector('input[name="wizard-event-type"]:checked')?.value || 'wedding';
                const name = document.getElementById('new-org-name').value.trim();
                const p1 = document.getElementById('new-org-p1').value.trim();
                const p2 = document.getElementById('new-org-p2').value.trim();
                const date = document.getElementById('new-org-date').value;
                const code = document.getElementById('new-org-login-code').value.trim();
                const pass = document.getElementById('new-org-password').value.trim();

                if (!p1) {
                    alert('Wprowadź imię gospodarza, jubilata lub nazwę firmy.');
                    return;
                }

                submitNewOrgBtn.disabled = true;
                submitNewOrgBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Konfigurowanie i tworzenie...';

                try {
                    const res = await fetch(`${API_URL}/admin/organizations/`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            event_type: eventType,
                            name: name,
                            partner1_name: p1,
                            partner2_name: p2,
                            wedding_date: date || null,
                            login_code: code,
                            password: pass
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        alert(`Nowe wydarzenie zostało pomyślnie utworzone i skonfigurowane z presetami!\nKod dostępu organizatora: ${data.organization.admin_login_code}`);
                        localStorage.setItem('current_org_id', data.organization.id);
                        window.location.search = `?org=${data.organization.id}`;
                    } else {
                        const err = await res.json();
                        alert(err.error || 'Wystąpił błąd podczas tworzenia wydarzenia.');
                    }
                } catch(e) {
                    alert('Błąd połączenia.');
                } finally {
                    submitNewOrgBtn.disabled = false;
                    submitNewOrgBtn.innerHTML = '<i class="ph ph-magic-wand"></i> Utwórz Wydarzenie i Zastosuj Presety';
                }
            });
        }

        const orgSwitcher = document.getElementById('admin-org-select-switcher');
        if (orgSwitcher) {
            orgSwitcher.addEventListener('change', (e) => {
                const chosenId = e.target.value;
                if (chosenId && chosenId !== currentOrgId) {
                    localStorage.setItem('current_org_id', chosenId);
                    window.location.search = `?org=${chosenId}`;
                }
            });
        }
    }

    async function loadOrganizationsList() {
        const switcher = document.getElementById('admin-org-select-switcher');
        if (!switcher) return;

        try {
            const res = await fetch(`${API_URL}/admin/organizations/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const orgs = await res.json();
                switcher.innerHTML = '';
                orgs.forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.id;
                    opt.textContent = `${o.name} (${o.guests_count} gości)${(o.is_current || o.id === currentOrgId) ? ' [Aktywne]' : ''}`;
                    if (o.is_current || o.id === currentOrgId) opt.selected = true;
                    switcher.appendChild(opt);
                });
            }
        } catch(e) {
            console.warn('Could not load organizations list:', e);
        }
    }

    async function loadAdminMetricsSummary() {
        const loadsContainer = document.getElementById('metrics-part-loads-container');
        const viewsContainer = document.getElementById('metrics-part-views-container');
        const uploadsContainer = document.getElementById('metrics-uploads-container');
        const postsContainer = document.getElementById('metrics-posts-container');
        const devicesContainer = document.getElementById('metrics-devices-container');
        const timelineContainer = document.getElementById('metrics-timeline-container');

        if (!loadsContainer) return;

        loadsContainer.innerHTML = '<p style="font-size:0.85rem; color:#888;">Pobieranie...</p>';
        viewsContainer.innerHTML = '<p style="font-size:0.85rem; color:#888;">Pobieranie...</p>';
        uploadsContainer.innerHTML = '<p style="font-size:0.85rem; color:#888;">Pobieranie...</p>';
        postsContainer.innerHTML = '<p style="font-size:0.85rem; color:#888;">Pobieranie...</p>';
        if (devicesContainer) devicesContainer.innerHTML = '<p style="font-size:0.85rem; color:#888;">Pobieranie...</p>';
        if (timelineContainer) timelineContainer.innerHTML = '<p style="font-size:0.85rem; color:#888;">Pobieranie...</p>';

        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`${API_URL}/metrics/summary/`, {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            if (!res.ok) throw new Error('Błąd ładowania metryk');
            const data = await res.json();
            const summary = data.summary || {};

            const metricLabels = {
                'initial_page': 'Strona Główna (Guest App)',
                'admin_page': 'Panel Administratora',
                'seating_creator_page': 'Kreator Planu Sali',
                'landing_page': 'Strona Główna (Landing)',
                'gallery': 'Galeria Zdjęć',
                'stories': 'Relacje (Stories)',
                'wishes': 'Księga Gości / Życzenia',
                'seating': 'Plan Stołów',
                'party': 'Sekcja Impreza',
                'feed': 'Sekcja Życzenia',
                'info': 'Sekcja Informacje',
                'you': 'Profil Gościa',
                'tab-party': 'Sekcja Impreza',
                'tab-feed': 'Sekcja Życzenia',
                'tab-info': 'Sekcja Informacje',
                'tab-you': 'Profil Gościa',
                'photo': 'Zdjęcie',
                'video': 'Wideo'
            };
            const formatMetricName = (name) => metricLabels[name] || name;

            // 1. Part loads
            const partLoads = summary.part_loads || [];
            if (partLoads.length === 0) {
                loadsContainer.innerHTML = '<p style="font-size:0.85rem; color:#888;">Brak zarejestrowanych pomiarów ładowania.</p>';
            } else {
                loadsContainer.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${partLoads.map(item => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 0.88rem;">
                                <span style="font-weight: 500;">${formatMetricName(item.part)}</span>
                                <div style="text-align: right;">
                                    <span style="font-weight: 700; color: #2563eb;">${item.avg_duration_ms} ms</span>
                                    <span style="font-size: 0.75rem; color: #888; margin-left: 6px;">(${item.count} próbek)</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // 2. Part views
            const partViews = summary.part_views || [];
            if (partViews.length === 0) {
                viewsContainer.innerHTML = '<p style="font-size:0.85rem; color:#888;">Brak zarejestrowanych wyświetleń.</p>';
            } else {
                viewsContainer.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${partViews.map(item => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 0.88rem;">
                                <span style="font-weight: 500;">${formatMetricName(item.part)}</span>
                                <span style="font-weight: 700; color: #10b981;">${item.count} wyśw.</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // 3. Media uploads
            const mediaUploads = summary.media_uploads || [];
            const uploadsByConn = summary.uploads_by_connection || [];
            if (mediaUploads.length === 0) {
                uploadsContainer.innerHTML = '<p style="font-size:0.85rem; color:#888;">Brak zarejestrowanych uploadów.</p>';
            } else {
                uploadsContainer.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${mediaUploads.map(item => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 0.88rem;">
                                <span style="font-weight: 500; text-transform: capitalize;">${item.type}</span>
                                <div style="text-align: right;">
                                    <span style="font-weight: 700; color: #f59e0b;">${item.count} plików</span>
                                    <span style="font-size: 0.75rem; color: #888; margin-left: 6px;">(śr. ${item.avg_duration_ms} ms)</span>
                                </div>
                            </div>
                        `).join('')}
                        ${uploadsByConn.length > 0 ? `
                            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(0,0,0,0.1);">
                                <span style="font-size: 0.78rem; text-transform: uppercase; color: #888; font-weight: 600;">Podział wg sieci:</span>
                                ${uploadsByConn.map(c => `
                                    <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-top: 4px;">
                                        <span style="color: #555;">${c.connection}</span>
                                        <span style="font-weight: 600;">${c.count} szt. (śr. ${c.avg_duration_ms} ms)</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;
            }

            // 4. Posts / wishes
            const posts = summary.posts || [];
            if (posts.length === 0) {
                postsContainer.innerHTML = '<p style="font-size:0.85rem; color:#888;">Brak nowych wpisów.</p>';
            } else {
                postsContainer.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${posts.map(item => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 0.88rem;">
                                <span style="font-weight: 500; text-transform: capitalize;">${item.type}</span>
                                <div style="text-align: right;">
                                    <span style="font-weight: 700; color: #8b5cf6;">${item.count} wpisów</span>
                                    <span style="font-size: 0.75rem; color: #888; margin-left: 6px;">(śr. ${item.avg_duration_ms} ms)</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // 5. Devices
            if (devicesContainer) {
                const devs = summary.devices || {};
                const totalDevs = (devs.mobile || 0) + (devs.desktop || 0) + (devs.tablet || 0);
                if (totalDevs === 0) {
                    devicesContainer.innerHTML = '<p style="font-size:0.85rem; color:#888;">Brak danych o urządzeniach.</p>';
                } else {
                    const mobPct = Math.round(((devs.mobile || 0) / totalDevs) * 100);
                    const dskPct = Math.round(((devs.desktop || 0) / totalDevs) * 100);
                    const tabPct = Math.round(((devs.tablet || 0) / totalDevs) * 100);
                    devicesContainer.innerHTML = `
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.88rem;">
                                <span><i class="ph ph-device-mobile"></i> Smartfony</span>
                                <span style="font-weight: 700; color: #06b6d4;">${devs.mobile || 0} (${mobPct}%)</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.88rem;">
                                <span><i class="ph ph-desktop"></i> Komputery</span>
                                <span style="font-weight: 700; color: #2563eb;">${devs.desktop || 0} (${dskPct}%)</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.88rem;">
                                <span><i class="ph ph-device-tablet"></i> Tablety</span>
                                <span style="font-weight: 700; color: #8b5cf6;">${devs.tablet || 0} (${tabPct}%)</span>
                            </div>
                        </div>
                    `;
                }
            }

            // 6. Activity Timeline
            if (timelineContainer) {
                const timeline = summary.activity_timeline || [];
                if (timeline.length === 0) {
                    timelineContainer.innerHTML = '<p style="font-size:0.85rem; color:#888;">Brak aktywności na osi czasu.</p>';
                } else {
                    const maxVal = Math.max(...timeline.map(t => t.count), 1);
                    timelineContainer.innerHTML = `
                        <div style="display: flex; align-items: flex-end; gap: 6px; height: 90px; padding-top: 10px;">
                            ${timeline.map(t => {
                                const hPct = Math.max(15, Math.round((t.count / maxVal) * 70));
                                return `
                                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                                        <span style="font-size: 0.7rem; font-weight: 700; color: #ec4899;">${t.count}</span>
                                        <div style="width: 100%; height: ${hPct}px; background: linear-gradient(to top, #ec4899, #f472b6); border-radius: 4px;"></div>
                                        <span style="font-size: 0.65rem; color: #777;">${t.hour}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }
            }

        } catch (err) {
            console.error('Błąd pobierania metryk:', err);
            loadsContainer.innerHTML = `<p style="font-size:0.85rem; color:red;">Nie udało się pobrać metryk: ${err.message}</p>`;
        }
    }

    const refreshMetricsBtn = document.getElementById('admin-refresh-metrics-btn');
    if (refreshMetricsBtn) {
        refreshMetricsBtn.addEventListener('click', () => {
            loadAdminMetricsSummary();
        });
    }
});
