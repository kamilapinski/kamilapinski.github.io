document.addEventListener('DOMContentLoaded', async () => {
    const getApiUrl = () => {
        const host = window.location.hostname || '127.0.0.1';
        if (host === 'localhost' || host === '127.0.0.1') {
            return `http://${host}:8000/api`;
        }
        return 'https://wedding-production-d4a1.up.railway.app/api';
    };
    const API_URL = getApiUrl();

    // ── ADMIN PANEL LOGIC VARIABLES ────────────────────────────────────────────
    let allGuestsData = [];
    let weddingConfigRaw = null;

    // ── AUTH CHECK ─────────────────────────────────────────────────────────────
    const token = localStorage.getItem('access_token');
    const userRaw = localStorage.getItem('user');
    let currentUser = null;
    try { currentUser = JSON.parse(userRaw); } catch(e){}

    const loadingOverlay = document.getElementById('loading-overlay');
    const authError = document.getElementById('auth-error');
    const mainUI = document.getElementById('main-ui');

    function showUI() {
        loadingOverlay.style.display = 'none';
        mainUI.style.display = 'block';
    }

    function showAuthError(details = '') {
        loadingOverlay.style.display = 'none';
        authError.style.display = 'flex';
        const debugEl = document.getElementById('debug-auth-info');
        if (debugEl) {
            debugEl.textContent = `Debug info: ${details}`;
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
                }
            });
        });

        // Seating Plan Creator redirect
        const openCreatorBtn = document.getElementById('admin-open-creator-btn');
        if (openCreatorBtn) {
            openCreatorBtn.addEventListener('click', () => {
                window.location.href = 'seating.html';
            });
        }

        // Load initial data
        loadAdminGuests();
        loadAdminConfigForm();

        // Attach other event listeners
        initGuestFormListeners();
        initTimelineFormListeners();
        initInfoFormListeners();
        initCoupleSettingsListeners();
        initHeaderSettingsListeners();
        initWitnessPermissionsListeners();
        initPushNotificationsListeners();

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
            const roleName = g.role === 'para_mloda' ? 'Para Młoda' : (g.role === 'swiadek' ? 'Świadek' : 'Gość');
            const roleColor = g.role === 'para_mloda' ? '#fbbf24' : (g.role === 'swiadek' ? '#a5b4fc' : '#8a8074');
            const roleBg = g.role === 'para_mloda' ? 'rgba(251, 191, 36, 0.15)' : (g.role === 'swiadek' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)');

            const tableText = g.table_number !== null ? (g.table_number === 0 ? 'Stół Pary Młodej' : `Stolik ${g.table_number}`) : 'Brak stolika';
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
    async function loadAdminConfigForm() {
        try {
            const res = await fetch(`${API_URL}/wedding-config/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                weddingConfigRaw = await res.json();
                
                // 1. Timeline Tab
                renderAdminTimelineForm(weddingConfigRaw.schedule_events || []);

                // 2. Info Tab
                renderAdminInfoForm(weddingConfigRaw.info_places || []);

                // 3. Couple Page Tab
                const previewImg = document.getElementById('admin-couple-image-preview');
                const placeholder = document.getElementById('admin-upload-placeholder');
                if (weddingConfigRaw.couple_image) {
                    previewImg.src = weddingConfigRaw.couple_image;
                    previewImg.style.display = 'block';
                    if (placeholder) placeholder.style.display = 'none';
                } else {
                    previewImg.style.display = 'none';
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

                // 4. Header config
                const hs = weddingConfigRaw.header_mode_settings || {};
                document.getElementById('admin-header-enabled').checked = hs.header_enabled !== false;
                document.getElementById('admin-countdown-end').value = hs.countdown_end ? hs.countdown_end.slice(0, 16) : '';
                document.getElementById('admin-schedule-start').value = hs.schedule_start ? hs.schedule_start.slice(0, 16) : '';
                document.getElementById('admin-thank-you-start').value = hs.thank_you_start ? hs.thank_you_start.slice(0, 16) : '';

                // 5. Witness tab
                const wp = weddingConfigRaw.witness_permissions || {};
                document.getElementById('admin-perm-delete-photos').checked = wp.can_delete_photos === true;
                document.getElementById('admin-perm-delete-videos').checked = wp.can_delete_videos === true;
                document.getElementById('admin-perm-see-wishes').checked = wp.can_see_wishes !== false;
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
                    patchWeddingConfig(formData, false);
                } else {
                    patchWeddingConfig({ 
                        status_texts: list,
                        wishes_enabled: wishesEnabled,
                        wishes_locked: wishesLocked
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
                        const placeholder = document.getElementById('admin-upload-placeholder');
                        if (preview) {
                            preview.src = event.target.result;
                            preview.style.display = 'block';
                            if (placeholder) placeholder.style.display = 'none';
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
});
