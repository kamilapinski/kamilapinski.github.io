document.addEventListener('DOMContentLoaded', () => {

    const getApiUrl = () => {
        const host = window.location.hostname || '127.0.0.1';
        if (host === 'localhost' || host === '127.0.0.1') {
            return `http://${host}:8000/api`;
        }
        return 'https://wedding-production-d4a1.up.railway.app/api';
    };
    const API_URL = getApiUrl();
    
    function updateRoleBadge(elementId, role, relationshipText) {
        const el = document.getElementById(elementId);
        if (!el) return;
        if (role === 'para_mloda' || role === 'swiadek') {
            el.textContent = relationshipText || ((role === 'para_mloda') ? 'Para Młoda' : 'Świadek');
            el.className = `role-badge ${role}`;
            el.style.display = 'inline-flex';
            el.style.marginTop = '2px';
        } else {
            el.textContent = relationshipText || '';
            el.className = 'user-relationship-text';
            el.style.display = relationshipText ? 'block' : 'none';
            el.style.marginTop = '0';
        }
    }
    
    function getInitials(firstName, lastName) {
        if (!lastName && firstName && firstName.includes(' ')) {
            const parts = firstName.split(' ').filter(p => p.trim() !== '');
            if (parts.length > 1) {
                firstName = parts[0];
                lastName = parts[parts.length - 1];
            }
        }
        let firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
        let lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
        let initials = firstInitial + lastInitial;
        return initials || 'G';
    }
    
    function getTableName(tableNumber) {
        if (tableNumber === 0 || tableNumber === '0') {
            return 'Stół Pary Młodej';
        }
        if (tableNumber !== null && tableNumber !== undefined && tableNumber !== '') {
            return `Stolik ${tableNumber}`;
        }
        return 'Brak stolika';
    }
    
    function customConfirm(onConfirm) {
        const popup = document.getElementById('confirm-popup-overlay');
        const okBtn = document.getElementById('confirm-popup-ok');
        const cancelBtn = document.getElementById('confirm-popup-cancel');
        if (!popup || !okBtn || !cancelBtn) {
            // Fallback
            if (confirm("Czy na pewno chcesz usunąć?")) onConfirm();
            return;
        }
        const cleanup = () => {
            popup.classList.remove('active');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
        };
        
        okBtn.onclick = () => {
            cleanup();
            onConfirm();
        };
        cancelBtn.onclick = () => cleanup();
        popup.classList.add('active');
    }

    function showToast(message, duration = 3500) {
        let toast = document.getElementById('app-toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-toast-notification';
            toast.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background: rgba(30, 25, 25, 0.95);
                color: #ffffff;
                padding: 12px 24px;
                border-radius: 25px;
                font-size: 0.92rem;
                font-weight: 600;
                box-shadow: 0 10px 30px rgba(0,0,0,0.25);
                z-index: 9999;
                opacity: 0;
                transition: opacity 0.3s ease, transform 0.3s ease;
                pointer-events: none;
                text-align: center;
                max-width: 90%;
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255,255,255,0.15);
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';

        if (toast.timeoutId) clearTimeout(toast.timeoutId);
        toast.timeoutId = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
        }, duration);
    }

    // --- Global State & DOM Elements ---
    let backendPhotos = [];
    let currentFilter = { type: null, value: null, label: '' };
    let sortOrder = 'asc'; // 'asc' or 'desc'
    const photoGridUnseen = document.getElementById('photo-grid-unseen');
    const photoGridSeen = document.getElementById('photo-grid-seen');
    const seenPhotosSeparator = document.getElementById('seen-photos-separator');

    // --- Authentication Logic ---
    const loginOverlay = document.getElementById('login-overlay');
    const loginInput = document.getElementById('login-code-input');
    const loginBtn = document.getElementById('login-submit-btn');
    const loginError = document.getElementById('login-error-msg');
    
    const loginCodeForm = document.getElementById('login-code-form');
    const loginGuestSelection = document.getElementById('login-guest-selection');
    const loginGuestList = document.getElementById('login-guest-list');
    const loginBackBtn = document.getElementById('login-back-btn');
    
    const loginPlusOneForm = document.getElementById('login-plus-one-form');
    const loginFirstNameInput = document.getElementById('login-first-name-input');
    const loginLastNameInput = document.getElementById('login-last-name-input');
    const loginPlusOneSubmitBtn = document.getElementById('login-plus-one-submit-btn');
    const loginPlusOneBackBtn = document.getElementById('login-plus-one-back-btn');

    const loginPasswordForm = document.getElementById('login-password-form');
    const loginPasswordInput = document.getElementById('login-password-input');
    const loginPasswordSubmitBtn = document.getElementById('login-password-submit-btn');
    const loginPasswordBackBtn = document.getElementById('login-password-back-btn');

    const loginPhoneForm = document.getElementById('login-phone-form');
    const loginPhoneInput = document.getElementById('login-phone-input');
    const loginPhoneSubmitBtn = document.getElementById('login-phone-submit-btn');
    const loginPhoneBackBtn = document.getElementById('login-phone-back-btn');

    // Check if URL has ?code=ABC123
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    
    let currentLoginCode = '';
    let selectedGuest = null;

    async function authenticate(code, guestId = null, firstName = null, lastName = null, password = null, phone = null) {
        try {
            loginBtn.textContent = 'Ładowanie...';
            loginBtn.disabled = true;
            loginPlusOneSubmitBtn.disabled = true;
            if (loginPasswordSubmitBtn) loginPasswordSubmitBtn.disabled = true;
            if (loginPhoneSubmitBtn) loginPhoneSubmitBtn.disabled = true;
            loginError.textContent = '';

            const payload = { login_code: code };
            if (guestId) payload.guest_id = guestId;
            if (firstName) payload.first_name = firstName;
            if (lastName) payload.last_name = lastName;
            if (password) payload.password = password;
            if (phone) payload.phone = phone;

            const response = await fetch(`${API_URL}/login/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            // Intercept phone_required error code to show phone form
            if (response.status === 400 && data.error === 'phone_required') {
                loginCodeForm.style.display = 'none';
                loginGuestSelection.style.display = 'none';
                loginPlusOneForm.style.display = 'none';
                if (loginPasswordForm) loginPasswordForm.style.display = 'none';
                if (loginPhoneForm) {
                    loginPhoneForm.style.display = 'block';
                    loginPhoneInput.value = '';
                    loginPhoneInput.focus();
                }
                return;
            }

            if (response.ok) {
                if (data.guests) {
                    currentLoginCode = code;
                    
                    if (data.guests.length === 1) {
                        selectGuest(data.guests[0]);
                    } else {
                        loginCodeForm.style.display = 'none';
                        loginPlusOneForm.style.display = 'none';
                        if (loginPasswordForm) loginPasswordForm.style.display = 'none';
                        if (loginPhoneForm) loginPhoneForm.style.display = 'none';
                        loginGuestSelection.style.display = 'block';
                        
                        loginGuestList.innerHTML = '';
                        data.guests.forEach(guest => {
                            const btn = document.createElement('button');
                            btn.className = 'modal-btn';
                            btn.style.background = '#f0f0f0';
                            btn.style.color = '#333';
                            let prefix = guest.prefix ? `${guest.prefix} ` : '';
                            let displayName = `${prefix}${guest.first_name} ${guest.last_name}`.trim();
                            if (!displayName && guest.is_plus_one) displayName = "Osoba Towarzysząca";
                            else if (!displayName) displayName = `Gość #${guest.id}`;
                            
                            btn.textContent = displayName;
                            btn.onclick = () => selectGuest(guest);
                            loginGuestList.appendChild(btn);
                        });
                    }
                } else if (data.access) {
                    localStorage.setItem('access_token', data.access);
                    localStorage.setItem('refresh_token', data.refresh);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    // Hide overlay
                    loginOverlay.classList.remove('active');
                    if (typeof ScrollTrigger !== 'undefined') {
                        setTimeout(() => { ScrollTrigger.refresh(); }, 200);
                    }
                    resetLoginForm();

                    // Load data
                    loadPhotos();
                    loadStories();
                    loadTables();
                    updateProfileUI();
                    loadWeddingConfig();
                    initPushNotifications();

                    // Remove code from URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } else {
                let errText = data.error || 'Nieprawidłowy kod.';
                if (errText === 'Invalid login code') errText = 'Nieprawidłowy kod z zaproszenia.';
                if (errText === 'Login code is required') errText = 'Wpisz kod z zaproszenia.';
                loginError.textContent = errText;
            }
        } catch (error) {
            loginError.textContent = 'Błąd połączenia z serwerem.';
            console.error(error);
        } finally {
            loginBtn.textContent = 'Wejdź';
            loginBtn.disabled = false;
            loginPlusOneSubmitBtn.disabled = false;
            if (loginPasswordSubmitBtn) loginPasswordSubmitBtn.disabled = false;
            if (loginPhoneSubmitBtn) loginPhoneSubmitBtn.disabled = false;
        }
    }
    
    function selectGuest(guest) {
        selectedGuest = guest;
        if (guest.is_plus_one && (!guest.first_name || !guest.last_name)) {
            loginGuestSelection.style.display = 'none';
            loginPlusOneForm.style.display = 'block';
            loginFirstNameInput.value = '';
            loginLastNameInput.value = '';
        } else if (guest.requires_password) {
            loginCodeForm.style.display = 'none';
            loginGuestSelection.style.display = 'none';
            loginPlusOneForm.style.display = 'none';
            if (loginPasswordForm) {
                loginPasswordForm.style.display = 'block';
                loginPasswordInput.value = '';
                loginPasswordInput.focus();
            }
        } else if (!guest.is_plus_one && !guest.has_phone) {
            loginCodeForm.style.display = 'none';
            loginGuestSelection.style.display = 'none';
            loginPlusOneForm.style.display = 'none';
            if (loginPasswordForm) loginPasswordForm.style.display = 'none';
            if (loginPhoneForm) {
                loginPhoneForm.style.display = 'block';
                loginPhoneInput.value = '';
                loginPhoneInput.focus();
            }
        } else {
            authenticate(currentLoginCode, guest.id);
        }
    }
    
    function resetLoginForm() {
        loginCodeForm.style.display = 'block';
        loginGuestSelection.style.display = 'none';
        loginPlusOneForm.style.display = 'none';
        if (loginPasswordForm) loginPasswordForm.style.display = 'none';
        if (loginPhoneForm) loginPhoneForm.style.display = 'none';
        currentLoginCode = '';
        selectedGuest = null;
        loginInput.value = '';
        if (loginPasswordInput) loginPasswordInput.value = '';
        if (loginPhoneInput) loginPhoneInput.value = '';
        loginError.textContent = '';
    }

    if (loginBackBtn) loginBackBtn.addEventListener('click', resetLoginForm);
    
    if (loginPlusOneBackBtn) loginPlusOneBackBtn.addEventListener('click', () => {
        loginPlusOneForm.style.display = 'none';
        loginGuestSelection.style.display = 'block';
    });
    
    if (loginPlusOneSubmitBtn) loginPlusOneSubmitBtn.addEventListener('click', () => {
        const fname = loginFirstNameInput.value.trim();
        const lname = loginLastNameInput.value.trim();
        if (!fname || !lname) {
            loginError.textContent = 'Podaj imię i nazwisko.';
            return;
        }
        authenticate(currentLoginCode, selectedGuest.id, fname, lname);
    });

    if (loginPasswordBackBtn) loginPasswordBackBtn.addEventListener('click', () => {
        if (loginPasswordForm) loginPasswordForm.style.display = 'none';
        if (loginGuestList && loginGuestList.children.length > 1) {
            loginGuestSelection.style.display = 'block';
        } else {
            resetLoginForm();
        }
    });

    if (loginPhoneBackBtn) loginPhoneBackBtn.addEventListener('click', () => {
        if (loginPhoneForm) loginPhoneForm.style.display = 'none';
        if (selectedGuest && selectedGuest.requires_password) {
            if (loginPasswordForm) loginPasswordForm.style.display = 'block';
        } else if (loginGuestList && loginGuestList.children.length > 1) {
            loginGuestSelection.style.display = 'block';
        } else {
            resetLoginForm();
        }
    });

    function isValidPhone(phone) {
        const clean = phone.replace(/[\s\-\(\)]/g, '');
        return /^\+?[0-9]{9,15}$/.test(clean);
    }

    if (loginPhoneSubmitBtn) loginPhoneSubmitBtn.addEventListener('click', () => {
        const phone = loginPhoneInput.value.trim();
        if (!phone) {
            loginError.textContent = 'Numer telefonu jest wymagany.';
            return;
        }
        if (!isValidPhone(phone)) {
            loginError.textContent = 'Nieprawidłowy format numeru telefonu. Wprowadź min. 9 cyfr, np. +48 500 600 700.';
            return;
        }
        const pwd = loginPasswordInput ? loginPasswordInput.value.trim() : null;
        const fname = loginFirstNameInput ? loginFirstNameInput.value.trim() : null;
        const lname = loginLastNameInput ? loginLastNameInput.value.trim() : null;
        authenticate(currentLoginCode, selectedGuest.id, fname, lname, pwd, phone);
    });

    if (loginPasswordSubmitBtn) loginPasswordSubmitBtn.addEventListener('click', () => {
        const password = loginPasswordInput.value;
        if (!password) {
            loginError.textContent = 'Wprowadź hasło.';
            return;
        }
        authenticate(currentLoginCode, selectedGuest.id, null, null, password);
    });

    if (loginPasswordInput) {
        loginPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loginPasswordSubmitBtn.click();
            }
        });
    }

    async function checkAuth() {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                const response = await fetch(`${API_URL}/me/`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const userData = await response.json();
                    localStorage.setItem('user', JSON.stringify(userData));
                    loginOverlay.classList.remove('active');
                    loadPhotos();
                    loadStories();
                    loadTables();
                    updateProfileUI();
                    loadWeddingConfig();
                    initPushNotifications();
                } else {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user');
                    loginOverlay.classList.add('active');
                }
            } catch (error) {
                console.error("Błąd pobierania danych użytkownika:", error);
                if (localStorage.getItem('user')) {
                    loginOverlay.classList.remove('active'); // Offline fallback
                }
            }
        } else if (codeFromUrl) {
            authenticate(codeFromUrl);
        }
    }

    checkAuth();

    const submitLogin = () => {
        const code = loginInput.value.trim().toUpperCase();
        if (code.length >= 1 && code.length <= 15) {
            loginError.textContent = '';
            authenticate(code);
        } else {
            loginError.textContent = 'Kod musi mieć od 1 do 15 znaków.';
        }
    };

    loginBtn.addEventListener('click', submitLogin);

    loginInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitLogin();
        }
    });

    // --- Tab switching logic ---
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active class from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));

            // Add active class to clicked item
            item.classList.add('active');

            // Hide all tab contents
            tabContents.forEach(tab => {
                tab.classList.remove('active');
            });

            // Show target tab content
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'tab-info' && (!tablesData || tablesData.length === 0)) {
                loadTables();
            }
            
            const fab = document.getElementById('fab-add-photo');
            if (fab) {
                if (targetId === 'tab-party') {
                    fab.classList.add('fab-visible');
                } else {
                    fab.classList.remove('fab-visible');
                }
            }

            if (targetId === 'tab-couple') {
                document.body.classList.add('no-scroll');
            } else {
                document.body.classList.remove('no-scroll');
            }

            if (targetId === 'tab-couple' && typeof ScrollTrigger !== 'undefined') {
                setTimeout(() => {
                    ScrollTrigger.refresh();
                }, 150);
            }

            // Scroll to top when switching tabs for better UX
            window.scrollTo(0, 0);
        });
    });

    // Interactive Seating Plan Logic
    const venueMap = document.getElementById('venue-map');
    const tableDetailsOverlay = document.getElementById('table-details-overlay');
    const tableDetailsSheet = document.getElementById('table-details-sheet');
    const sheetCloseBtn = document.getElementById('sheet-close-btn');
    const sheetTableName = document.getElementById('sheet-table-name');
    const sheetGuestList = document.getElementById('sheet-guest-list');

    let tablesData = [];
    let allGuestsFlat = [];
    let searchedGuestId = null;

    async function loadTables() {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        try {
            const response = await fetch(`${API_URL}/tables/`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                tablesData = await response.json();
                renderVenueMap();
                initSearch();
            } else {
                renderVenueMap();
            }
        } catch (error) {
            console.error("Błąd ładowania układu sali:", error);
            renderVenueMap();
        }
    }

    function initSearch() {
        allGuestsFlat = [];
        const freshGuests = window._seatingGuests || [];
        const layout = window._activeLayout;
        
        if (layout && layout.tables) {
            layout.tables.forEach(tbl => {
                const tblNumMatch = tbl.name.match(/\d+/);
                const tblNum = tblNumMatch ? parseInt(tblNumMatch[0]) : 0;
                
                Object.values(tbl.assignments || {}).forEach(guestId => {
                    const g = freshGuests.find(gf => gf.id == guestId);
                    if (g) {
                        allGuestsFlat.push({
                            ...g,
                            table_number: tblNum
                        });
                    }
                });
            });
        } else {
            // fallback old logic
            tablesData.forEach(table => {
                table.guests.forEach(guest => {
                    allGuestsFlat.push({
                        ...guest,
                        table_number: table.table_number
                    });
                });
            });
        }

        // Update logged in user table/seat details from current assignments
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser) {
            const matchedGuest = allGuestsFlat.find(g => Number(g.id) === Number(currentUser.id));
            if (matchedGuest) {
                currentUser.table_number = matchedGuest.table_number;
                // If it is dynamic layout, also resolve the seat number
                if (layout && layout.tables) {
                    layout.tables.forEach(tbl => {
                        Object.entries(tbl.assignments || {}).forEach(([seatIdx, guestId]) => {
                            if (Number(guestId) === Number(currentUser.id)) {
                                currentUser.seat_number = parseInt(seatIdx) + 1;
                            }
                        });
                    });
                }
                localStorage.setItem('user', JSON.stringify(currentUser));
                updateProfileUI();
            }
        }
    }

    const searchInput = document.getElementById('guest-search-input');
    const searchResults = document.getElementById('guest-search-results');
    const searchClear = document.getElementById('guest-search-clear');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            searchResults.innerHTML = '';
            
            if (query.length > 0) {
                searchClear.style.display = 'block';
            } else {
                searchClear.style.display = 'none';
                searchResults.classList.remove('active');
                document.querySelectorAll('.map-table-searched').forEach(el => el.classList.remove('map-table-searched'));
                searchedGuestId = null;
                return;
            }

            const matched = allGuestsFlat.filter(g => g.name.toLowerCase().includes(query));
            
            if (matched.length > 0 && matched.length <= 6) {
                matched.forEach(guest => {
                    const div = document.createElement('div');
                    div.className = 'guest-search-item';
                    
                    const regex = new RegExp(`(${query})`, 'gi');
                    const highlightedName = guest.name.replace(regex, '<strong>$1</strong>');
                    
                    div.innerHTML = `${highlightedName} <span style="color:#aaa; font-size:0.8rem;">(${getTableName(guest.table_number)})</span>`;
                    
                    div.addEventListener('click', () => {
                        searchedGuestId = guest.id;
                        highlightTable(guest.table_number);
                        searchResults.classList.remove('active');
                        searchInput.value = guest.name;
                    });
                    
                    searchResults.appendChild(div);
                });
                searchResults.classList.add('active');
            } else {
                searchResults.classList.remove('active');
            }
        });
        
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            searchResults.classList.remove('active');
            document.querySelectorAll('.map-table-searched').forEach(el => el.classList.remove('map-table-searched'));
            searchedGuestId = null;
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.guest-search-wrapper')) {
                searchResults.classList.remove('active');
            }
        });
    }

    function highlightTable(tableNumber) {
        document.querySelectorAll('.map-table-searched, .vmap-table-searched').forEach(el => {
            el.classList.remove('map-table-searched', 'vmap-table-searched');
        });
        
        const tableEls = document.querySelectorAll('.vmap-table');
        for (let el of tableEls) {
            const nameEl = el.querySelector('.vmap-table-name');
            if (nameEl) {
                const tblNumMatch = nameEl.textContent.match(/\d+/);
                const tblNum = tblNumMatch ? parseInt(tblNumMatch[0]) : 0;
                
                // Match by number or para mloda table
                const isParaMloda = nameEl.textContent.toLowerCase().includes('młod') && (tableNumber === 0 || tableNumber === '0');
                if (tblNum === tableNumber || isParaMloda) {
                    el.classList.add('vmap-table-searched');
                    // Smooth scroll directly to the venue map if mobile
                    document.getElementById('venue-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
                    break;
                }
            }
        }
    }

    async function renderVenueMap() {
        // Try to load the seating layout from the creator
        const token = localStorage.getItem('access_token');
        let seatingLayout = null;
        let guestsList = [];
        try {
            const [resLayout, resGuests] = await Promise.all([
                fetch(`${API_URL}/seating/layout/`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_URL}/seating/guests/`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (resLayout.ok) {
                const data = await resLayout.json();
                if (data.layout && data.layout.tables && data.layout.tables.length > 0) {
                    seatingLayout = data.layout;
                }
            }
            if (resGuests.ok) {
                guestsList = await resGuests.json();
            }
        } catch(e) { /* fallback to old layout */ }

        // Expose layout globally for initSearch
        window._activeLayout = seatingLayout;
        window._seatingGuests = guestsList;

        const wrapper = document.getElementById('seating-plan-section-wrapper');
        if (seatingLayout && seatingLayout.isReady) {
            if (wrapper) wrapper.style.display = 'block';
            renderVenueMapFromLayout(seatingLayout);
        } else {
            if (wrapper) wrapper.style.display = 'none';
            renderVenueMapFallback();
        }
        initSearch();
        updateFilterButtonVisibility();
        updateProfileUI();
    }

    function updateFilterButtonVisibility() {
        const filterBtn = document.getElementById('filter-btn');
        if (!filterBtn) return;

        let user = null;
        try { user = JSON.parse(localStorage.getItem('user')); } catch(e) {}
        
        const isLayoutReady = window._activeLayout && window._activeLayout.isReady;
        const hasTable = user && user.table_number !== null && user.table_number !== undefined && user.table_number !== '';

        if (!isLayoutReady || !hasTable) {
            filterBtn.style.display = 'none';
        } else {
            filterBtn.style.display = 'flex';
        }
    }

    function renderVenueMapFromLayout(layout) {
        venueMap.innerHTML = '';

        const user = JSON.parse(localStorage.getItem('user'));
        const userTableNum = user ? user.table_number : null;
        const userSeatNum  = user ? user.seat_number  : null;

        const layoutTables = layout.tables;

        // Compute bounding box of all tables and zones
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        layoutTables.forEach(t => {
            minX = Math.min(minX, t.x);
            minY = Math.min(minY, t.y);
            maxX = Math.max(maxX, t.x + t.w);
            maxY = Math.max(maxY, t.y + t.h);
        });
        if (layout.zones && Array.isArray(layout.zones)) {
            layout.zones.forEach(z => {
                minX = Math.min(minX, z.x);
                minY = Math.min(minY, z.y);
                maxX = Math.max(maxX, z.x + z.w);
                maxY = Math.max(maxY, z.y + z.h);
            });
        }

        const contentW = maxX - minX;
        const contentH = maxY - minY;

        // Proportions are calculated directly from content boundaries
        const totalW = contentW || 1;
        const totalH = contentH || 1;
        
        // Scale factors for X and Y axes independently
        const scaleX = 100 / totalW;
        const scaleY = 100 / totalH;

        // Build a scaled canvas inside venue-map
        const mapWrapper = document.createElement('div');
        mapWrapper.className = 'venue-map-canvas-wrapper';
        mapWrapper.style.cssText = `
            position: relative;
            width: 100%;
            max-width: 480px;
            margin: 0 auto;
        `;

        const mapCanvas = document.createElement('div');
        mapCanvas.className = 'venue-map-canvas';
        mapCanvas.style.cssText = `
            position: relative;
            width: 100%;
        `;

        const updateHeight = () => {
            const width = mapWrapper.clientWidth;
            if (width > 0) {
                mapCanvas.style.height = `${(totalH / totalW) * width}px`;
            }
        };

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => updateHeight());
            ro.observe(mapWrapper);
        } else {
            window.addEventListener('resize', updateHeight);
            setTimeout(updateHeight, 0);
        }

        // Render zones first (under tables)
        if (layout.zones && Array.isArray(layout.zones)) {
            layout.zones.forEach(z => {
                const zLeft   = ((z.x - minX) * scaleX).toFixed(2);
                const zTop    = ((z.y - minY) * scaleY).toFixed(2);
                const zWidth  = (z.w * scaleX).toFixed(2);
                const zHeight = (z.h * scaleY).toFixed(2);

                const zNode = document.createElement('div');
                zNode.className = 'vmap-zone';
                zNode.style.cssText = `
                    position: absolute;
                    left: ${zLeft}%;
                    top: ${zTop}%;
                    width: ${zWidth}%;
                    height: ${zHeight}%;
                    background: ${z.color};
                    border: 1.5px dashed ${z.border};
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    gap: 2px;
                `;
                const zIcon = document.createElement('span');
                zIcon.style.fontSize = '1.2rem';
                zIcon.textContent = z.icon;
                const zLabel = document.createElement('span');
                zLabel.style.cssText = `
                    font-family: var(--font-heading);
                    font-size: 0.65rem;
                    font-style: italic;
                    font-weight: 600;
                    color: ${z.border.replace(/[\d.]+\)$/, '1)')};
                    text-align: center;
                `;
                zLabel.textContent = z.label;
                zNode.appendChild(zIcon);
                zNode.appendChild(zLabel);
                mapCanvas.appendChild(zNode);
            });
        }

        const user2 = JSON.parse(localStorage.getItem('user'));

        layoutTables.forEach(tbl => {
            // Parse table number from name to find corresponding tablesData
            const tblNumMatch = tbl.name.match(/\d+/);
            const tblNum = tblNumMatch ? parseInt(tblNumMatch[0]) : null;

            // Find matching data from the old endpoint
            let matchedTableData = tablesData.find(td => {
                if (tblNum !== null && td.table_number === tblNum) return true;
                // fallback check: para mloda table
                if (tbl.name.toLowerCase().includes('młod') && (td.table_number === 0 || td.table_number === '0')) return true;
                return false;
            });

            // If still not matched, check if any guest matches
            if (!matchedTableData) {
                const assignedGuestIds = Object.values(tbl.assignments || {}).map(Number);
                matchedTableData = tablesData.find(td =>
                    td.guests.some(g => assignedGuestIds.includes(g.id))
                );
            }

            // Create temporary table data structure if backend endpoint has no matches
            const assignedGuests = [];
            const freshGuests = window._seatingGuests || [];
            Object.entries(tbl.assignments || {}).forEach(([seat, guestId]) => {
                const g = freshGuests.find(gf => gf.id == guestId);
                if (g) {
                    assignedGuests.push({
                        id: g.id,
                        name: g.name,
                        role: g.role,
                        relationship: g.relationship,
                        seat_number: parseInt(seat) + 1,
                        avatar: g.avatar
                    });
                }
            });

            // Prioritize the freshly resolved assignedGuests from our layout assignments
            const currentTableDetails = {
                table_number: tblNum || 0,
                guests: assignedGuests
            };

            const widthVal  = tbl.w * scaleX;
            const heightVal = tbl.h * scaleY;
            
            // Make tables 25% larger on the guest view map
            const scaleFactor = 1.25;
            const width  = (widthVal * scaleFactor).toFixed(2);
            const height = (heightVal * scaleFactor).toFixed(2);
            
            // Adjust position so the table scales from its center
            const left   = (((tbl.x - minX) * scaleX) - (widthVal * (scaleFactor - 1) / 2)).toFixed(2);
            const top    = (((tbl.y - minY) * scaleY) - (heightVal * (scaleFactor - 1) / 2)).toFixed(2);

            // Is this the user's table?
            const isMyTable = userTableNum !== null && currentTableDetails &&
                              currentTableDetails.table_number == userTableNum;

            const node = document.createElement('div');
            node.className = `vmap-table vmap-shape-${tbl.shape}${isMyTable ? ' vmap-my-table' : ''}`;
            node.style.cssText = `
                position: absolute;
                left: ${left}%;
                top:  ${top}%;
                width: ${width}%;
                height: ${height}%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                gap: 2px;
                cursor: pointer;
                transition: filter 0.2s, transform 0.15s;
            `;

            const nameEl = document.createElement('div');
            nameEl.className = 'vmap-table-name';
            nameEl.textContent = tbl.name;

            const guestCount = currentTableDetails.guests.length;
            const capEl = document.createElement('div');
            capEl.className = 'vmap-table-cap';
            capEl.textContent = guestCount > 0 ? `${guestCount} os.` : '';

            node.appendChild(nameEl);
            node.appendChild(capEl);

            // Click → open table details sheet
            node.addEventListener('click', () => {
                document.querySelectorAll('.vmap-table').forEach(n => n.classList.remove('vmap-active'));
                node.classList.add('vmap-active');
                openTableDetails(currentTableDetails);
            });

            mapCanvas.appendChild(node);
        });

        mapWrapper.appendChild(mapCanvas);
        venueMap.appendChild(mapWrapper);

        // Tap anywhere outside table → deselect
        venueMap.addEventListener('click', (e) => {
            if (e.target === venueMap || e.target === mapWrapper || e.target === mapCanvas) {
                document.querySelectorAll('.vmap-table').forEach(n => n.classList.remove('vmap-active'));
            }
        });
    }

    function renderVenueMapFallback() {
        if (!tablesData || tablesData.length === 0) {
            venueMap.innerHTML = '<div class="map-loading">Brak przypisanych stolików.</div>';
            return;
        }

        venueMap.innerHTML = '';

        let mainTable = tablesData.find(t => t.guests.some(g => g.role === 'para_mloda')) || tablesData.find(t => t.table_number === 0);
        let guestTables = tablesData.filter(t => t !== mainTable);
        guestTables.sort((a, b) => a.table_number - b.table_number);

        const user = JSON.parse(localStorage.getItem('user'));
        const userTable = user ? user.table_number : null;

        if (mainTable) {
            const mainContainer = document.createElement('div');
            mainContainer.className = 'map-main-table-container';
            const mainDiv = document.createElement('div');
            mainDiv.className = 'map-main-table';
            if (userTable === mainTable.table_number) mainDiv.classList.add('map-table-my-table');
            mainDiv.textContent = 'Para Młoda';
            mainDiv.addEventListener('click', () => openTableDetails(mainTable));
            mainContainer.appendChild(mainDiv);
            venueMap.appendChild(mainContainer);
        }

        if (guestTables.length > 0) {
            const blocksContainer = document.createElement('div');
            blocksContainer.className = 'map-blocks-container';
            const leftBlock  = document.createElement('div');
            leftBlock.className = 'map-block';
            const rightBlock = document.createElement('div');
            rightBlock.className = 'map-block';

            const leftTables = [], rightTables = [];
            let tIndex = 0;
            const rowDistribution = [{left:2,right:2},{left:1,right:1},{left:2,right:2},{left:1,right:1},{left:2,right:2}];
            rowDistribution.forEach(row => {
                for(let l=0;l<row.left;l++)  if(tIndex<guestTables.length) leftTables.push(guestTables[tIndex++]);
                for(let r=0;r<row.right;r++) if(tIndex<guestTables.length) rightTables.push(guestTables[tIndex++]);
            });
            while(tIndex<guestTables.length) {
                leftTables.push(guestTables[tIndex++]);
                if(tIndex<guestTables.length) rightTables.push(guestTables[tIndex++]);
            }

            const blockPattern = [2,1,2,1,2];
            function buildBlock(blockEl, tablesForBlock) {
                let index = 0;
                blockPattern.forEach(rowSize => {
                    if(index>=tablesForBlock.length) return;
                    const rowDiv = document.createElement('div');
                    rowDiv.className = 'map-block-row';
                    for(let i=0;i<rowSize;i++) {
                        if(index<tablesForBlock.length) rowDiv.appendChild(createTableElement(tablesForBlock[index++]));
                    }
                    blockEl.appendChild(rowDiv);
                });
                while(index<tablesForBlock.length) {
                    const rowDiv = document.createElement('div');
                    rowDiv.className = 'map-block-row';
                    rowDiv.appendChild(createTableElement(tablesForBlock[index++]));
                    if(index<tablesForBlock.length) rowDiv.appendChild(createTableElement(tablesForBlock[index++]));
                    blockEl.appendChild(rowDiv);
                }
            }
            function createTableElement(table) {
                const tableDiv = document.createElement('div');
                tableDiv.className = 'map-table-round';
                if(userTable===table.table_number) tableDiv.classList.add('map-table-my-table');
                tableDiv.textContent = table.table_number;
                tableDiv.addEventListener('click', () => {
                    document.querySelectorAll('.map-table-round, .map-main-table').forEach(el => el.classList.remove('map-table-active'));
                    tableDiv.classList.add('map-table-active');
                    openTableDetails(table);
                });
                return tableDiv;
            }
            buildBlock(leftBlock,  leftTables);
            buildBlock(rightBlock, rightTables);
            blocksContainer.appendChild(leftBlock);
            blocksContainer.appendChild(rightBlock);
            venueMap.appendChild(blocksContainer);
        }
    }

    function openTableDetails(table) {
        sheetTableName.textContent = (table.table_number === 0 || table.table_number === '0' || (table.guests && table.guests.some(g => g.role === 'para_mloda'))) 
            ? 'Stół Pary Młodej' 
            : `Stolik ${table.table_number}`;
        
        sheetGuestList.innerHTML = '';
        const user = JSON.parse(localStorage.getItem('user'));

        table.guests.forEach(guest => {
            const li = document.createElement('li');
            li.className = 'sheet-guest-item';
            if (user && user.id === guest.id) {
                li.classList.add('sheet-guest-item-me');
            }
            if (searchedGuestId === guest.id) {
                li.classList.add('sheet-guest-item-searched');
            }
            
            let roleHtml = '';
            if (guest.role === 'para_mloda') roleHtml = '<span class="sheet-guest-role" style="color:#d4af37;">Para Młoda</span>';
            else if (guest.role === 'swiadek') roleHtml = '<span class="sheet-guest-role">Świadek</span>';
            else if (guest.relationship) roleHtml = `<span class="sheet-guest-role">${guest.relationship}</span>`;

            let avatarUrl = guest.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(guest.name, ''))}&background=EAE0D5&color=000`;

            li.innerHTML = `
                <img src="${avatarUrl}" class="sheet-guest-avatar" alt="${guest.name}">
                <div class="sheet-guest-info">
                    <span class="sheet-guest-name">${guest.name}</span>
                    ${roleHtml}
                </div>
                ${guest.seat_number ? `<div class="sheet-guest-seat ${guest.has_collision ? 'collision' : ''}">M. ${guest.seat_number}</div>` : ''}
            `;
            sheetGuestList.appendChild(li);
        });

        tableDetailsOverlay.classList.add('active');
        tableDetailsSheet.classList.add('active');
    }

    function closeTableDetails() {
        tableDetailsOverlay.classList.remove('active');
        tableDetailsSheet.classList.remove('active');
        document.querySelectorAll('.map-table-round, .map-main-table').forEach(el => el.classList.remove('map-table-active'));
    }

    if (sheetCloseBtn) sheetCloseBtn.addEventListener('click', closeTableDetails);
    if (tableDetailsOverlay) tableDetailsOverlay.addEventListener('click', closeTableDetails);

    // Call loadTables on init
    loadTables();

    // Story Viewer Logic
    const storyViewer = document.getElementById('story-viewer');
    const storyProgressContainer = document.getElementById('story-progress-container');
    const storyAvatar = document.getElementById('story-viewer-avatar');
    const storyName = document.getElementById('story-viewer-name');
    const storyCloseBtn = document.getElementById('story-close-btn');
    const storyPrevArea = document.getElementById('story-prev-area');
    const storyNextArea = document.getElementById('story-next-area');
    const storyImage = document.getElementById('story-viewer-image');
    const storyPlaceholder = document.getElementById('story-viewer-placeholder');
    const storiesContainer = document.getElementById('stories-container');
    const addStoryBtn = document.getElementById('add-story-btn');

    let backendStories = [];
    let currentStoryGroupIndex = 0;
    let currentStorySubIndex = 0;
    
    let storyProgressInterval;
    let currentProgress = 0;
    let storyDuration = 5000; // 5 seconds per story
    const progressUpdateInterval = 50; // update every 50ms
    
    let storyVideoHoldTimeout;
    let isHoldingStoryVideo = false;
    let isStoryFastForward = false;
    let isStoryPaused = false;
    let wasHoldingStory = false;

    async function loadStories() {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        try {
            const response = await fetch(`${API_URL}/gallery/stories/?t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const storiesList = await response.json();
                
                // Group by guest
                const grouped = {};
                storiesList.forEach(st => {
                    if (!grouped[st.guest]) {
                        grouped[st.guest] = {
                            guest_id: st.guest,
                            name: (st.guest_prefix ? st.guest_prefix + ' ' : '') + (st.guest_name || 'Gość'),
                            role: st.guest_role,
                            avatar: st.guest_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(st.guest_name, st.guest_last_name))}&background=EAE0D5&color=000`,
                            stories: []
                        };
                    }
                    // Since backend returns order_by('-uploaded_at'), we want them chronological for viewing
                    grouped[st.guest].stories.unshift(st);
                });

                backendStories = Object.values(grouped);
                renderStoryRings();
            }
        } catch (error) {
            console.error("Błąd ładowania relacji:", error);
        }
    }

    async function markPhotoAsSeen(photoId) {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        try {
            fetch(`${API_URL}/gallery/photos/${photoId}/seen/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const photo = backendPhotos.find(p => p.id === photoId);
            if (photo && !photo.is_seen) {
                photo.is_seen = true;
                const el = document.getElementById(`photo-item-${photoId}`);
                if (el) {
                    el.classList.remove('unseen-photo');
                }
            }
        } catch(e) {
            console.error('Error marking photo as seen', e);
        }
    }

    async function markStoryAsSeen(storyId) {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        try {
            fetch(`${API_URL}/gallery/stories/${storyId}/seen/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            backendStories.forEach(group => {
                const story = group.stories.find(s => s.id === storyId);
                if (story) story.is_seen = true;
            });
            renderStoryRings(); // Update rings UI immediately
        } catch(e) {
            console.error('Error marking story as seen', e);
        }
    }

    async function loadPhotos() {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/gallery/photos/?t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const photos = await res.json();
                backendPhotos = photos; // store in memory
                
                // Sort ascending (oldest to newest)
                backendPhotos.sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at));
                
                applyFiltersAndRender();
            } else if (res.status === 401) {
                handleUnauthorized();
            }
        } catch (e) {
            console.error('Error fetching photos:', e);
        }
    }

    function applyFiltersAndRender() {
        let filteredPhotos = backendPhotos;
        if (currentFilter.type === 'table') {
            filteredPhotos = backendPhotos.filter(p => p.guest_table == currentFilter.value);
        } else if (currentFilter.type === 'user') {
            filteredPhotos = backendPhotos.filter(p => p.guest == currentFilter.value);
        }

        if (sortOrder === 'asc') {
            filteredPhotos.sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at));
        } else {
            filteredPhotos.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
        }

        const unseenPhotos = filteredPhotos.filter(p => !p.is_seen);
        const seenPhotos = filteredPhotos.filter(p => p.is_seen);
        
        const emptyMessage = document.getElementById('empty-gallery-message');
        if (emptyMessage) {
            if (filteredPhotos.length === 0) {
                emptyMessage.style.display = 'flex';
                if (backendPhotos.length === 0) {
                    emptyMessage.innerHTML = `
                        <button id="empty-state-camera-btn" class="fab-btn center-fab">
                            <i class="ph ph-camera"></i>
                        </button>
                        <span style="font-size: 1.1rem; opacity: 0.8; margin-top: 10px;">Dodaj odrobinę wspomnień</span>
                    `;
                    document.getElementById('empty-state-camera-btn').addEventListener('click', () => openCamera('gallery'));
                    const fab = document.getElementById('fab-add-photo');
                    if (fab) fab.style.display = 'none';
                } else {
                    emptyMessage.innerHTML = `<span style="font-size: 1.1rem; opacity: 0.8;">Brak zdjęć dla tego filtra.</span>`;
                    const fab = document.getElementById('fab-add-photo');
                    if (fab) fab.style.display = '';
                }
            } else {
                emptyMessage.style.display = 'none';
                const fab = document.getElementById('fab-add-photo');
                if (fab) fab.style.display = '';
            }
        }

        renderPhotos(unseenPhotos, photoGridUnseen);
        renderPhotos(seenPhotos, photoGridSeen);
        renderCoupleTabPhotos();
        renderPostWeddingStats();
        
        if (seenPhotosSeparator) {
            seenPhotosSeparator.style.display = (unseenPhotos.length > 0 && seenPhotos.length > 0) ? 'flex' : 'none';
        }
    }

    function renderCoupleTabPhotos() {
        const container = document.getElementById('couple-photos-grid');
        if (!container) return;

        const couplePhotos = backendPhotos.filter(p => p.guest_role === 'para_mloda');

        if (couplePhotos.length === 0) {
            container.innerHTML = `
                <div class="couple-photo-card" style="grid-column: 1 / -1; height: 200px;">
                    <img src="img/couple.png" alt="Zuzia & Kamil" class="couple-grid-img">
                    <div class="couple-photo-caption">
                        <span><i class="ph-fill ph-heart"></i> Zuzia & Kamil</span>
                        <span>Poznań 2026</span>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        const latestPhoto = couplePhotos[couplePhotos.length - 1];
        const coverImg = document.querySelector('.couple-cover-img');
        if (coverImg && latestPhoto && latestPhoto.media_type !== 'video') {
            const coverSrc = latestPhoto.image.startsWith('http') ? latestPhoto.image : `http://127.0.0.1:8000${latestPhoto.image}`;
            coverImg.src = coverSrc;
        }

        couplePhotos.forEach(photo => {
            const globalIndex = backendPhotos.findIndex(p => p.id === photo.id);
            const card = document.createElement('div');
            card.className = 'couple-photo-card';

            const src = photo.image.startsWith('http') ? photo.image : `http://127.0.0.1:8000${photo.image}`;
            
            if (photo.media_type === 'video') {
                const vid = document.createElement('video');
                vid.src = src;
                vid.className = 'couple-grid-img';
                vid.muted = true;
                vid.playsInline = true;
                card.appendChild(vid);

                const playBadge = document.createElement('div');
                playBadge.className = 'couple-video-badge';
                playBadge.innerHTML = '<i class="ph-fill ph-play-circle"></i>';
                card.appendChild(playBadge);
            } else {
                const img = document.createElement('img');
                img.src = src;
                img.className = 'couple-grid-img';
                img.alt = 'Zdjęcie Pary Młodej';
                card.appendChild(img);
            }

            const caption = document.createElement('div');
            caption.className = 'couple-photo-caption';
            const date = new Date(photo.uploaded_at).toLocaleDateString('pl-PL');
            caption.innerHTML = `<span><i class="ph-fill ph-heart"></i> ${photo.guest_name || 'Para Młoda'}</span> <span>${date}</span>`;
            card.appendChild(caption);

            card.addEventListener('click', () => {
                openPhotoViewer(globalIndex > -1 ? globalIndex : 0);
            });

            container.appendChild(card);
        });
    }

    function renderPhotos(photosList, container) {
        if (!container) return;
        container.innerHTML = '';
        photosList.forEach((photo, index) => {
            const div = document.createElement('div');
            div.className = photo.is_seen ? 'grid-item' : 'grid-item unseen-photo';
            div.id = `photo-item-${photo.id}`;
            
            const isVideo = photo.media_type === 'video';
            const src = photo.image.startsWith('http') ? photo.image : `http://127.0.0.1:8000${photo.image}`;
            
            if (isVideo) {
                const vid = document.createElement('video');
                vid.src = src;
                vid.style.width = '100%';
                vid.style.height = '100%';
                vid.style.objectFit = 'cover';
                vid.muted = true;
                vid.playsInline = true;
                div.appendChild(vid);
                div.style.backgroundImage = 'none';
            } else {
                div.style.backgroundImage = `url('${src}')`;
            }
            
            const avatarUrl = photo.guest_avatar 
                ? (photo.guest_avatar.startsWith('http') ? photo.guest_avatar : `http://127.0.0.1:8000${photo.guest_avatar}`) 
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(photo.guest_name, photo.guest_last_name))}&background=EAE0D5&color=000`;
            
            const avatarImg = document.createElement('img');
            avatarImg.src = avatarUrl;
            avatarImg.className = 'grid-item-avatar';
            if (photo.guest_role === 'para_mloda') {
                avatarImg.classList.add('gold-highlight-avatar');
                
                const crownIcon = document.createElement('i');
                crownIcon.className = 'ph-fill ph-crown crown-highlight';
                div.appendChild(crownIcon);
            } else if (photo.guest_role === 'swiadek') {
                avatarImg.classList.add('silver-highlight-avatar');
            }
            div.appendChild(avatarImg);
            
            div.addEventListener('click', () => {
                const globalIndex = backendPhotos.findIndex(p => p.id === photo.id);
                openPhotoViewer(globalIndex > -1 ? globalIndex : index);
            });
            container.appendChild(div);
        });
    }

    function renderStoryRings() {
        storiesContainer.innerHTML = '';
        storiesContainer.appendChild(addStoryBtn);
        
        backendStories.forEach((guestGroup, index) => {
            const storyEl = document.createElement('div');
            storyEl.className = 'story';
            storyEl.setAttribute('data-story-index', index);
            
            const hasUnseen = guestGroup.stories.some(s => !s.is_seen);
            let ringClass = hasUnseen ? 'story-ring new' : 'story-ring';
            
            if (guestGroup.role === 'para_mloda') {
                ringClass += ' gold-highlight-story';
            } else if (guestGroup.role === 'swiadek') {
                ringClass += ' silver-highlight-story';
            }
            
            storyEl.innerHTML = `
                <div class="${ringClass}">
                    <img src="${guestGroup.avatar}" alt="User story">
                </div>
                <span class="story-name">${guestGroup.name}</span>
            `;
            
            storyEl.addEventListener('click', () => {
                initProgressBars(guestGroup.stories.length);
                currentStoryGroupIndex = index;
                currentStorySubIndex = 0;
                showStory();
            });
            
            storiesContainer.appendChild(storyEl);
        });
    }

    function initProgressBars(count) {
        storyProgressContainer.innerHTML = '';
        for(let i=0; i<count; i++) {
            const segment = document.createElement('div');
            segment.className = 'story-progress-segment';
            segment.innerHTML = '<div class="story-progress-fill"></div>';
            storyProgressContainer.appendChild(segment);
        }
    }

    function updateProgressBars() {
        const segments = document.querySelectorAll('.story-progress-fill');
        segments.forEach((segment, index) => {
            if (index < currentStorySubIndex) {
                segment.style.width = '100%';
            } else if (index === currentStorySubIndex) {
                segment.style.width = `${currentProgress}%`;
            } else {
                segment.style.width = '0%';
            }
        });
    }

    function startStoryProgress() {
        clearInterval(storyProgressInterval);
        currentProgress = 0;
        updateProgressBars();

        storyProgressInterval = setInterval(() => {
            if (isStoryPaused) {
                // paused, do not increment
            } else if (isStoryFastForward) {
                currentProgress += (progressUpdateInterval / storyDuration) * 100 * 2.0;
            } else {
                currentProgress += (progressUpdateInterval / storyDuration) * 100;
            }
            updateProgressBars();

            if (currentProgress >= 100) {
                clearInterval(storyProgressInterval);
                nextStory();
            }
        }, progressUpdateInterval);
    }

    function showStory() {
        if (currentStoryGroupIndex < 0 || currentStoryGroupIndex >= backendStories.length) {
            closeStory();
            return;
        }

        const group = backendStories[currentStoryGroupIndex];
        
        if (currentStorySubIndex < 0) {
            if (currentStoryGroupIndex > 0) {
                currentStoryGroupIndex--;
                const prevGroup = backendStories[currentStoryGroupIndex];
                currentStorySubIndex = prevGroup.stories.length - 1;
                initProgressBars(prevGroup.stories.length);
                showStory();
                return;
            } else {
                currentStorySubIndex = 0;
            }
        }
        
        if (currentStorySubIndex >= group.stories.length) {
            currentStoryGroupIndex++;
            if (currentStoryGroupIndex < backendStories.length) {
                currentStorySubIndex = 0;
                initProgressBars(backendStories[currentStoryGroupIndex].stories.length);
                showStory();
            } else {
                closeStory();
            }
            return;
        }

        const story = group.stories[currentStorySubIndex];
        if (!story.is_seen) {
            markStoryAsSeen(story.id);
        }

        // Update UI
        storyAvatar.src = group.avatar;
        storyName.textContent = group.name;
        
        const storyViewerRelationship = document.getElementById('story-viewer-relationship');
        if (storyViewerRelationship) {
            updateRoleBadge('story-viewer-relationship', story.guest_role, story.guest_relationship);
        }
        
        const storyViewerTime = document.getElementById('story-viewer-time');
        if (storyViewerTime && story.uploaded_at) {
            const date = new Date(story.uploaded_at);
            const now = new Date();
            const diffMinutes = Math.floor((now - date) / (1000 * 60));
            if (diffMinutes < 60) {
                storyViewerTime.textContent = `${Math.max(1, diffMinutes)} min temu`;
            } else if (diffMinutes < 24 * 60) {
                storyViewerTime.textContent = `${Math.floor(diffMinutes / 60)} godz. temu`;
            } else {
                storyViewerTime.textContent = date.toLocaleDateString();
            }
        }

        const picUrl = story.image.startsWith('http') ? story.image : `http://127.0.0.1:8000${story.image}`;
        
        const storyViewerVideo = document.getElementById('story-viewer-video');
        const storyVideoMuteBtn = document.getElementById('story-video-mute-btn');
        
        if (story.media_type === 'video') {
            storyImage.style.display = 'none';
            storyPlaceholder.style.display = 'none';
            storyViewerVideo.src = picUrl;
            storyViewerVideo.style.display = 'block';
            if (storyVideoMuteBtn) {
                storyVideoMuteBtn.style.display = 'flex';
                storyVideoMuteBtn.innerHTML = storyViewerVideo.muted ? '<i class="ph ph-speaker-slash"></i>' : '<i class="ph ph-speaker-high"></i>';
            }
            
            // Wait for metadata to know duration
            storyViewerVideo.onloadedmetadata = () => {
                storyDuration = storyViewerVideo.duration * 1000 || 5000;
                storyViewerVideo.play().catch(e => console.log("Autoplay blocked:", e));
                startStoryProgress();
            };
        } else {
            storyViewerVideo.style.display = 'none';
            storyViewerVideo.pause();
            if (storyVideoMuteBtn) storyVideoMuteBtn.style.display = 'none';
            storyImage.src = picUrl;
            storyImage.style.display = 'block';
            storyPlaceholder.style.display = 'none';
            storyDuration = 5000;
            startStoryProgress();
        }

        storyViewer.classList.add('active');

        const currentUser = JSON.parse(localStorage.getItem('user'));
        const storyDeleteBtn = document.getElementById('story-delete-btn');
        const isOwner = currentUser && (currentUser.id == story.guest || (story.guest && currentUser.id == story.guest.id));
        const isPrivileged = window.canCurrentUserDeleteVideo();

        if (currentUser && (isOwner || isPrivileged)) {
            if (storyDeleteBtn) storyDeleteBtn.style.display = 'flex';
            if (storyDeleteBtn) storyDeleteBtn.onclick = async (e) => {
                e.stopPropagation();
                e.preventDefault();
                customConfirm(async () => {
                    const token = localStorage.getItem('access_token');
                    try {
                        const response = await fetch(`${API_URL}/gallery/stories/${story.id}/`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        if (response.ok) {
                            closeStory();
                            loadStories();
                        } else {
                            alert('Błąd podczas usuwania.');
                        }
                    } catch (e) {
                        alert('Wystąpił błąd.');
                    }
                });
            };
        } else {
            if (storyDeleteBtn) storyDeleteBtn.style.display = 'none';
        }

        // Remove 'new' ring from the DOM
        const rings = document.querySelectorAll('.story-ring:not(.add-story-ring)');
        if (rings[currentStoryGroupIndex]) rings[currentStoryGroupIndex].classList.remove('new');
    }

    function nextStory() {
        currentStorySubIndex++;
        showStory();
    }

    function prevStory() {
        currentStorySubIndex--;
        showStory();
    }

    function closeStory() {
        storyViewer.classList.remove('active');
        clearInterval(storyProgressInterval);
        const storyViewerVideo = document.getElementById('story-viewer-video');
        if (storyViewerVideo) {
            storyViewerVideo.pause();
            storyViewerVideo.src = "";
        }
    }

    storyCloseBtn.addEventListener('click', closeStory);

    const storyVideoMuteBtn = document.getElementById('story-video-mute-btn');
    if (storyVideoMuteBtn) {
        storyVideoMuteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const storyViewerVideo = document.getElementById('story-viewer-video');
            if (storyViewerVideo) {
                storyViewerVideo.muted = !storyViewerVideo.muted;
                storyVideoMuteBtn.innerHTML = storyViewerVideo.muted ? '<i class="ph ph-speaker-slash"></i>' : '<i class="ph ph-speaker-high"></i>';
            }
        });
    }

    const startStoryHold = (isLeft) => {
        isHoldingStoryVideo = true;
        wasHoldingStory = false;
        
        storyVideoHoldTimeout = setTimeout(() => {
            if (isHoldingStoryVideo) {
                wasHoldingStory = true;
                const storyViewerVideoNode = document.getElementById('story-viewer-video');
                const storySpeedIndicator = document.getElementById('story-video-speed-indicator');
                
                if (isLeft) {
                    isStoryFastForward = true;
                    if (storyViewerVideoNode && storyViewerVideoNode.style.display !== 'none') {
                        storyViewerVideoNode.playbackRate = 2.0;
                    }
                    if (storySpeedIndicator) storySpeedIndicator.style.display = 'flex';
                } else {
                    isStoryPaused = true;
                    if (storyViewerVideoNode && storyViewerVideoNode.style.display !== 'none') {
                        storyViewerVideoNode.pause();
                    }
                }
            }
        }, 150);
    };

    const endStoryHold = () => {
        isHoldingStoryVideo = false;
        isStoryFastForward = false;
        isStoryPaused = false;
        clearTimeout(storyVideoHoldTimeout);
        
        const storyViewerVideoNode = document.getElementById('story-viewer-video');
        const storySpeedIndicator = document.getElementById('story-video-speed-indicator');
        
        if (storyViewerVideoNode && storyViewerVideoNode.playbackRate !== 1.0) {
            storyViewerVideoNode.playbackRate = 1.0;
        }
        if (storySpeedIndicator) storySpeedIndicator.style.display = 'none';
        
        if (storyViewer.classList.contains('active') && storyViewerVideoNode && storyViewerVideoNode.style.display !== 'none' && storyViewerVideoNode.paused) {
            storyViewerVideoNode.play();
        }
        
        setTimeout(() => {
            wasHoldingStory = false;
        }, 50);
    };

    storyPrevArea.addEventListener('pointerdown', () => startStoryHold(true));
    storyNextArea.addEventListener('pointerdown', () => startStoryHold(false));

    storyPrevArea.addEventListener('pointerup', endStoryHold);
    storyNextArea.addEventListener('pointerup', endStoryHold);
    storyPrevArea.addEventListener('pointercancel', endStoryHold);
    storyNextArea.addEventListener('pointercancel', endStoryHold);
    storyPrevArea.addEventListener('pointerleave', endStoryHold);
    storyNextArea.addEventListener('pointerleave', endStoryHold);

    storyPrevArea.addEventListener('click', (e) => {
        if (wasHoldingStory) return;
        prevStory();
    });
    storyNextArea.addEventListener('click', (e) => {
        if (wasHoldingStory) return;
        nextStory();
    });

    // --- Add Story Logic (In-App Camera) ---
    const cameraOverlay = document.getElementById('camera-overlay');
    const cameraVideo = document.getElementById('camera-video');
    const cameraCanvas = document.getElementById('camera-canvas');
    const cameraPreviewImg = document.getElementById('camera-preview-img');
    const cameraCloseBtn = document.getElementById('camera-close-btn');
    const cameraDurationBtn = document.getElementById('camera-duration-btn');
    const cameraSwitchBtn = document.getElementById('camera-switch-btn');
    const cameraShutterBtn = document.getElementById('camera-shutter-btn');
    const cameraCaptureControls = document.getElementById('camera-capture-controls');
    const cameraActionControls = document.getElementById('camera-action-controls');
    const cameraRetakeBtn = document.getElementById('camera-retake-btn');
    const cameraPublishBtn = document.getElementById('camera-publish-btn');
    
    let cameraStream = null;
    let currentFacingMode = 'environment';
    let capturedBlob = null;
    
    const durationOptions = [
        { val: 'null', content: '<i class="ph ph-infinity"></i>' },
        { val: '24', content: '<span style="font-size: 1rem; font-family: var(--font-body); font-weight: 600;">24h</span>' },
        { val: '12', content: '<span style="font-size: 1rem; font-family: var(--font-body); font-weight: 600;">12h</span>' },
        { val: '3', content: '<span style="font-size: 1rem; font-family: var(--font-body); font-weight: 600;">3h</span>' },
        { val: '1', content: '<span style="font-size: 1rem; font-family: var(--font-body); font-weight: 600;">1h</span>' }
    ];
    let currentDurationIndex = 0;
    let currentCameraContext = 'story';

    if (addStoryBtn) {
        addStoryBtn.addEventListener('click', () => openCamera('story'));
    }

    if (cameraCloseBtn) {
        cameraCloseBtn.addEventListener('click', closeCamera);
    }

    if (cameraDurationBtn) {
        cameraDurationBtn.addEventListener('click', () => {
            currentDurationIndex = (currentDurationIndex + 1) % durationOptions.length;
            const opt = durationOptions[currentDurationIndex];
            cameraDurationBtn.setAttribute('data-duration', opt.val);
            cameraDurationBtn.innerHTML = opt.content;
        });
    }

    if (cameraSwitchBtn) {
        cameraSwitchBtn.addEventListener('click', () => {
            currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
            if (cameraStream) {
                startCamera();
            }
        });
    }

    async function startCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }

        let videoConstraints = { facingMode: currentFacingMode };

        try {
            // Request quick temp stream to ensure permissions are granted (needed to read device labels)
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } });
            const devices = await navigator.mediaDevices.enumerateDevices();
            tempStream.getTracks().forEach(track => track.stop());

            if (currentFacingMode === 'environment') {
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                console.log("Dostępne urządzenia wideo:", videoDevices.map(d => `${d.label} (${d.deviceId})`));
                
                let backCameras = videoDevices.filter(d => {
                    const label = d.label.toLowerCase();
                    return label.includes('back') || label.includes('rear') || label.includes('environment') || 
                           label.includes('tył') || label.includes('tyl') || label.includes('camera 1') || 
                           label.includes('camera 0') || label.includes('main') || label.includes('główn');
                });

                if (backCameras.length > 0) {
                    // Filter out ultra-wide, wide-angle, telephoto and zoom lenses (in English and Polish)
                    let mainCam = backCameras.find(d => {
                        const label = d.label.toLowerCase();
                        return !label.includes('ultra') && !label.includes('wide') && !label.includes('tele') && 
                               !label.includes('zoom') && !label.includes('szerok') && !label.includes('zbliż');
                    });
                    
                    if (!mainCam) {
                        mainCam = backCameras[0];
                    }

                    if (mainCam && mainCam.deviceId) {
                        console.log("Wybrany aparat 1x:", mainCam.label || "Aparat domyślny");
                        videoConstraints = { deviceId: mainCam.deviceId };
                    }
                }
            }
        } catch (e) {
            console.warn("Device enumeration or permission query failed, falling back to facingMode:", e);
        }

        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: true
            });
        } catch (err) {
            console.warn("Audio access denied or unavailable, falling back to video only:", err);
            try {
                cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: videoConstraints,
                    audio: false
                });
            } catch (err2) {
                console.error("Camera error:", err2);
                alert("Błąd dostępu do aparatu. Upewnij się, że wyraziłeś zgodę (wymagane szyfrowane połączenie HTTPS).");
                closeCamera();
                return;
            }
        }
        
        cameraVideo.srcObject = cameraStream;
        cameraVideo.style.display = 'block';
        cameraPreviewImg.style.display = 'none';
        cameraCaptureControls.style.display = 'flex';
        cameraActionControls.style.display = 'none';
        capturedBlob = null;
    }

    function showUploadSpinner(msg = "Wgrywanie...") {
        let spinner = document.getElementById('upload-spinner-overlay');
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.id = 'upload-spinner-overlay';
            spinner.style.position = 'fixed';
            spinner.style.top = '0';
            spinner.style.left = '0';
            spinner.style.width = '100vw';
            spinner.style.height = '100vh';
            spinner.style.background = 'rgba(0,0,0,0.85)';
            spinner.style.display = 'flex';
            spinner.style.flexDirection = 'column';
            spinner.style.justifyContent = 'center';
            spinner.style.alignItems = 'center';
            spinner.style.zIndex = '9999';
            spinner.style.color = '#fff';
            spinner.style.fontFamily = 'var(--font-body)';
            
            spinner.innerHTML = `
                <i class="ph ph-spinner ph-spin" style="font-size: 3rem; margin-bottom: 15px;"></i>
                <div id="upload-spinner-text" style="font-size: 1.2rem; font-weight: 500;">Wgrywanie...</div>
            `;
            document.body.appendChild(spinner);
        }
        document.getElementById('upload-spinner-text').textContent = msg;
        spinner.style.display = 'flex';
    }

    function hideUploadSpinner() {
        const spinner = document.getElementById('upload-spinner-overlay');
        if (spinner) spinner.style.display = 'none';
    }

    async function handleNativeCameraCapture(e) {
        const file = e.target.files[0];
        if (!file) return;

        const mediaType = file.type.startsWith('video') ? 'video' : 'image';
        showUploadSpinner("Przetwarzanie pliku...");

        try {
            let finalBlob = file;
            if (mediaType === 'image') {
                showUploadSpinner("Optymalizacja zdjęcia...");
                finalBlob = await compressImageBlob(file, 1920, 0.8);
            }

            if (currentCameraContext === 'wish_video') {
                if (mediaType !== 'video') {
                    alert("Dla życzeń wideo wymagane jest nagranie filmu wideo!");
                    hideUploadSpinner();
                    return;
                }
                selectedVideoFile = finalBlob;
                const videoUrl = URL.createObjectURL(finalBlob);

                const directVideoPreview = document.getElementById('direct-video-preview');
                const videoStatusText = document.getElementById('video-status-text');

                if (directVideoPreview) {
                    directVideoPreview.src = videoUrl;
                    directVideoPreview.style.display = 'block';
                }
                if (videoStatusText) {
                    videoStatusText.textContent = 'Film z aparatu gotowy! Kliknij "Wyślij do Zuzi & Kamila", aby przekazać życzenie.';
                }
                const directMsgModal = document.getElementById('direct-msg-modal');
                if (directMsgModal) {
                    directMsgModal.style.display = 'flex';
                }
                hideUploadSpinner();
                return;
            }

            showUploadSpinner("Wgrywanie...");
            const formData = new FormData();
            const token = localStorage.getItem('access_token');
            const ext = mediaType === 'video' ? 'mp4' : 'jpg';
            formData.append('media_type', mediaType);

            if (currentCameraContext === 'story') {
                formData.append('image', finalBlob, `story_${Date.now()}.${ext}`);
                const duration = durationOptions[0].val;
                if (duration && duration !== 'null') {
                    formData.append('duration_hours', duration);
                }

                const response = await fetch(`${API_URL}/gallery/stories/`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (response.ok) {
                    loadStories();
                } else {
                    alert("Wystąpił błąd podczas wgrywania relacji.");
                }
            } else if (currentCameraContext === 'gallery') {
                formData.append('image', finalBlob, `photo_${Date.now()}.${ext}`);
                const response = await fetch(`${API_URL}/gallery/photos/`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (response.ok) {
                    loadPhotos();
                } else {
                    alert("Wystąpił błąd podczas wgrywania zdjęcia.");
                }
            } else if (currentCameraContext === 'profile') {
                formData.append('profile_picture', finalBlob, `profile_${Date.now()}.jpg`);
                const response = await fetch(`${API_URL}/me/`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    let user = JSON.parse(localStorage.getItem('user')) || {};
                    user.profile_picture = data.profile_picture;
                    localStorage.setItem('user', JSON.stringify(user));
                    updateProfileUI();
                } else {
                    alert("Wystąpił błąd podczas zmiany zdjęcia profilowego.");
                }
            }
        } catch (err) {
            console.error("Camera upload failed:", err);
            alert("Błąd podczas przetwarzania lub wgrywania pliku.");
        } finally {
            hideUploadSpinner();
        }
    }

    function openCamera(context = 'story') {
        currentCameraContext = context;
        
        let nativeInput = document.getElementById('native-camera-input');
        if (!nativeInput) {
            nativeInput = document.createElement('input');
            nativeInput.id = 'native-camera-input';
            nativeInput.type = 'file';
            nativeInput.style.display = 'none';
            document.body.appendChild(nativeInput);
            
            nativeInput.addEventListener('change', handleNativeCameraCapture);
        }

        const directMsgModal = document.getElementById('direct-msg-modal');
        if (directMsgModal) {
            directMsgModal.style.display = 'none';
        }

        if (context === 'wish_video') {
            nativeInput.accept = 'video/*';
            nativeInput.removeAttribute('multiple');
            nativeInput.setAttribute('capture', 'environment');
        } else if (context === 'gallery' || context === 'profile') {
            nativeInput.accept = 'image/*';
            nativeInput.removeAttribute('multiple');
            nativeInput.setAttribute('capture', 'environment');
        } else {
            nativeInput.accept = 'image/*,video/*';
            nativeInput.removeAttribute('multiple');
            nativeInput.setAttribute('capture', 'environment');
        }

        nativeInput.value = '';
        nativeInput.click();
    }

    function closeCamera() {
        cameraOverlay.classList.remove('active');
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        const previewVideo = document.getElementById('camera-preview-video');
        if (previewVideo) {
            previewVideo.pause();
            previewVideo.src = "";
            previewVideo.load();
        }
        const camVideo = document.getElementById('camera-video');
        if (camVideo) {
            camVideo.pause();
            camVideo.srcObject = null;
        }

        if (currentCameraContext === 'wish_video') {
            const directMsgModal = document.getElementById('direct-msg-modal');
            if (directMsgModal) {
                directMsgModal.style.display = 'flex';
            }
        }
    }

    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let recordingTimer = null;
    let maxRecordingTimeout = null;
    const MAX_RECORDING_MS = 15000;
    const cameraPreviewVideo = document.getElementById('camera-preview-video');

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        isRecording = false;
        cameraShutterBtn.classList.remove('recording');
        clearTimeout(maxRecordingTimeout);
    }

    if (cameraShutterBtn) {
        cameraShutterBtn.addEventListener('pointerdown', handleShutterDown);
        cameraShutterBtn.addEventListener('pointerup', handleShutterUp);
        cameraShutterBtn.addEventListener('pointercancel', handleShutterUp);
        cameraShutterBtn.addEventListener('pointerleave', handleShutterUp);
        cameraShutterBtn.addEventListener('contextmenu', e => e.preventDefault());

        let shutterActive = false;
        function handleShutterDown(e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (!cameraStream) return;
            
            shutterActive = true;
            if (currentCameraContext !== 'profile') {
                recordingTimer = setTimeout(() => {
                    startRecording();
                }, 300);
            }
        }

        function handleShutterUp(e) {
            if (!shutterActive) return;
            shutterActive = false;

            clearTimeout(recordingTimer);
            if (isRecording) {
                stopRecording();
            } else {
                takePhoto();
            }
        }
        
        function takePhoto() {
            if (!cameraStream) return;
            const width = cameraVideo.videoWidth;
            const height = cameraVideo.videoHeight;
            cameraCanvas.width = width;
            cameraCanvas.height = height;
            const ctx = cameraCanvas.getContext('2d');
            ctx.drawImage(cameraVideo, 0, 0, width, height);
            
            cameraCanvas.toBlob((blob) => {
                capturedBlob = blob;
                capturedBlob.media_type = 'image';
                cameraPreviewImg.src = URL.createObjectURL(blob);
                cameraPreviewImg.style.display = 'block';
                cameraPreviewVideo.style.display = 'none';
                cameraVideo.style.display = 'none';
                
                cameraCaptureControls.style.display = 'none';
                cameraActionControls.style.display = 'flex';
            }, 'image/jpeg', 0.9);
        }

        function startRecording() {
            isRecording = true;
            recordedChunks = [];
            cameraShutterBtn.classList.add('recording');
            
            try {
                mediaRecorder = new MediaRecorder(cameraStream);
            } catch (err) {
                console.error("MediaRecorder init error:", err);
                return;
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const mimeType = mediaRecorder.mimeType || 'video/mp4';
                capturedBlob = new Blob(recordedChunks, { type: mimeType });
                capturedBlob.media_type = 'video';
                
                cameraPreviewVideo.src = URL.createObjectURL(capturedBlob);
                cameraPreviewVideo.style.display = 'block';
                cameraPreviewVideo.play();
                cameraPreviewImg.style.display = 'none';
                cameraVideo.style.display = 'none';
                
                cameraCaptureControls.style.display = 'none';
                cameraActionControls.style.display = 'flex';
            };

            mediaRecorder.start();
            maxRecordingTimeout = setTimeout(() => {
                stopRecording();
            }, MAX_RECORDING_MS);
        }
    }

    if (cameraRetakeBtn) {
        cameraRetakeBtn.addEventListener('click', () => {
            cameraPreviewImg.style.display = 'none';
            cameraPreviewVideo.style.display = 'none';
            cameraPreviewVideo.pause();
            cameraVideo.style.display = 'block';
            cameraCaptureControls.style.display = 'flex';
            cameraActionControls.style.display = 'none';
            capturedBlob = null;
        });
    }

    const cameraGalleryInput = document.getElementById('camera-gallery-input');
    if (cameraGalleryInput) {
        cameraGalleryInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                capturedBlob = file;
                const fileName = file.name.toLowerCase();
                const isVideo = file.type.startsWith('video/') || fileName.endsWith('.mov') || fileName.endsWith('.mp4');
                capturedBlob.media_type = isVideo ? 'video' : 'image';
                const fileUrl = URL.createObjectURL(file);
                
                if (isVideo) {
                    cameraPreviewVideo.src = fileUrl;
                    cameraPreviewVideo.style.display = 'block';
                    cameraPreviewVideo.play();
                    cameraPreviewImg.style.display = 'none';
                } else {
                    cameraPreviewImg.src = fileUrl;
                    cameraPreviewImg.style.display = 'block';
                    cameraPreviewVideo.style.display = 'none';
                }
                
                cameraVideo.style.display = 'none';
                cameraCaptureControls.style.display = 'none';
                cameraActionControls.style.display = 'flex';
                if (cameraStream) {
                    cameraStream.getTracks().forEach(track => track.stop());
                    cameraStream = null;
                }
            }
        });
    }

    if (cameraPublishBtn) {
        cameraPublishBtn.addEventListener('click', async () => {
            if (!capturedBlob) return;
            
            const originalText = cameraPublishBtn.innerHTML;
            cameraPublishBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Wgrywanie...';
            cameraPublishBtn.disabled = true;

            try {
                let finalBlob = capturedBlob;
                if (capturedBlob.media_type === 'image') {
                    finalBlob = await compressImageBlob(capturedBlob, 1920, 0.8);
                }
                
                const formData = new FormData();
                const token = localStorage.getItem('access_token');
                
                const ext = capturedBlob.media_type === 'video' ? 'mp4' : 'jpg';
                formData.append('media_type', capturedBlob.media_type || 'image');
                
                if (currentCameraContext === 'story') {
                    formData.append('image', finalBlob, `story_${Date.now()}.${ext}`);
                    const duration = durationOptions[currentDurationIndex].val;
                    if (duration && duration !== 'null') {
                        formData.append('duration_hours', duration);
                    }

                    const response = await fetch(`${API_URL}/gallery/stories/`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });

                    if (response.ok) {
                        closeCamera();
                        loadStories();
                    } else {
                        alert("Wystąpił błąd podczas wgrywania relacji.");
                    }
                } else if (currentCameraContext === 'gallery') {
                    formData.append('image', finalBlob, `photo_${Date.now()}.${ext}`);
                    const response = await fetch(`${API_URL}/gallery/photos/`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });

                    if (response.ok) {
                        const newPhoto = await response.json();
                        loadPhotos();
                        closeCamera();
                    } else {
                        alert("Wystąpił błąd podczas wgrywania zdjęcia.");
                    }
                } else if (currentCameraContext === 'profile') {
                    // Dla zdjęcia profilowego wymagamy obrazka (wideo w profilu to zły pomysł)
                    if (capturedBlob.media_type === 'video') {
                        alert("Zdjęcie profilowe nie może być wideo!");
                        return;
                    }
                    formData.append('profile_picture', finalBlob, `profile_${Date.now()}.jpg`);
                    const response = await fetch(`${API_URL}/me/`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });

                    if (response.ok) {
                        const data = await response.json();
                        let user = JSON.parse(localStorage.getItem('user')) || {};
                        user.profile_picture = data.profile_picture;
                        localStorage.setItem('user', JSON.stringify(user));
                        updateProfileUI();
                        closeCamera();
                    } else {
                        alert("Wystąpił błąd podczas zmiany zdjęcia.");
                    }
                } else if (currentCameraContext === 'wish_video') {
                    if (capturedBlob.media_type !== 'video' && capturedBlob.type && !capturedBlob.type.startsWith('video/')) {
                        alert("Dla życzeń wideo wymagane jest nagranie filmu wideo!");
                        return;
                    }
                    selectedVideoFile = finalBlob;
                    const videoUrl = URL.createObjectURL(finalBlob);

                    const directVideoPreview = document.getElementById('direct-video-preview');
                    const videoStatusText = document.getElementById('video-status-text');

                    if (directVideoPreview) {
                        directVideoPreview.src = videoUrl;
                        directVideoPreview.style.display = 'block';
                    }
                    if (videoStatusText) {
                        videoStatusText.textContent = 'Film z aparatu gotowy! Kliknij "Wyślij do Zuzi & Kamila", aby przekazać życzenie.';
                    }

                    closeCamera();
                    return;
                }
            } catch (error) {
                console.error("Błąd przesyłania pliku:", error);
                alert("Nie udało się przesłać pliku.");
            } finally {
                cameraPublishBtn.innerHTML = originalText;
                cameraPublishBtn.disabled = false;
            }
        });
    }

    function compressImageBlob(blob, maxDimension, quality) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.src = url;
            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round((height *= maxDimension / width));
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = Math.round((width *= maxDimension / height));
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(newBlob => {
                    resolve(newBlob);
                }, 'image/jpeg', quality);
            };
            img.onerror = error => reject(error);
        });
    }

    // --- Photo Gallery Logic ---
    const photoUploadInput = document.getElementById('photo-upload-input');
    const addPhotoText = document.getElementById('add-photo-text');

    const photoViewerOverlay = document.getElementById('photo-viewer-overlay');
    const photoViewerImage = document.getElementById('photo-viewer-image');
    const photoViewerClose = document.querySelector('.photo-viewer-close');
    const photoViewerAvatar = document.getElementById('photo-viewer-avatar');
    const photoViewerName = document.getElementById('photo-viewer-name');
    const photoViewerTime = document.getElementById('photo-viewer-time');
    let galleryPhotos = [];
    let currentPhotoIndex = 0;

    // Swipe state
    let touchStartX = 0;
    let touchEndX = 0;

    let isAnimating = false;

    const photoViewerVideo = document.getElementById('photo-viewer-video');
    const customVideoControls = document.getElementById('custom-video-controls');
    const videoProgressContainer = document.getElementById('video-progress-container');
    const videoProgressFill = document.getElementById('video-progress-fill');
    const videoMuteBtn = document.getElementById('video-mute-btn');

    if (photoViewerVideo) {
        photoViewerVideo.addEventListener('timeupdate', () => {
            if (isFinite(photoViewerVideo.duration) && photoViewerVideo.duration > 0 && videoProgressFill) {
                const progress = (photoViewerVideo.currentTime / photoViewerVideo.duration) * 100;
                videoProgressFill.style.width = `${progress}%`;
            }
        });

        if (videoProgressContainer) {
            videoProgressContainer.addEventListener('pointerdown', (e) => {
                const rect = videoProgressContainer.getBoundingClientRect();
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                if (isFinite(photoViewerVideo.duration) && photoViewerVideo.duration > 0) {
                    photoViewerVideo.currentTime = pos * photoViewerVideo.duration;
                    photoViewerVideo.play(); // Ensure it keeps playing after seek
                }
            });
        }

        if (videoMuteBtn) {
            videoMuteBtn.addEventListener('click', () => {
                photoViewerVideo.muted = !photoViewerVideo.muted;
                videoMuteBtn.innerHTML = photoViewerVideo.muted ? '<i class="ph ph-speaker-slash"></i>' : '<i class="ph ph-speaker-high"></i>';
            });
        }
    }

    function openPhotoViewer(index) {
        if (!backendPhotos || index < 0 || index >= backendPhotos.length) return;
        currentPhotoIndex = index;
        updatePhotoViewer();
        photoViewerOverlay.classList.add('active');
    }

    function updatePhotoViewer() {
        if (backendPhotos && backendPhotos.length > 0) {
            const currentPhoto = backendPhotos[currentPhotoIndex];
            
            // Mark as seen on swipe/next/prev
            markPhotoAsSeen(currentPhoto.id);
            
            const fullUrl = currentPhoto.image.startsWith('http') ? currentPhoto.image : `http://127.0.0.1:8000${currentPhoto.image}`;
            
            if (currentPhoto.media_type === 'video') {
                photoViewerVideo.src = fullUrl;
                photoViewerVideo.style.display = 'block';
                photoViewerImage.style.display = 'none';
                if (customVideoControls) customVideoControls.style.display = 'flex';
                if (videoMuteBtn) {
                    videoMuteBtn.style.display = 'block';
                    videoMuteBtn.innerHTML = photoViewerVideo.muted ? '<i class="ph ph-speaker-slash"></i>' : '<i class="ph ph-speaker-high"></i>';
                }
                photoViewerVideo.play();
            } else {
                photoViewerImage.src = fullUrl;
                photoViewerImage.style.display = 'block';
                photoViewerVideo.style.display = 'none';
                if (customVideoControls) customVideoControls.style.display = 'none';
                if (videoMuteBtn) videoMuteBtn.style.display = 'none';
                photoViewerVideo.pause();
            }
            
            let viewerPrefix = currentPhoto.guest_prefix ? `${currentPhoto.guest_prefix} ` : '';
            photoViewerName.textContent = viewerPrefix + (currentPhoto.guest_name || 'Gość');
            const photoViewerRelationship = document.getElementById('photo-viewer-relationship');
            if (photoViewerRelationship) {
                photoViewerRelationship.textContent = currentPhoto.guest_relationship ? currentPhoto.guest_relationship : '';
            }
            
            const date = new Date(currentPhoto.uploaded_at);
            const now = new Date();
            const diffMinutes = Math.floor((now - date) / (1000 * 60));
            if (diffMinutes < 60) {
                photoViewerTime.textContent = `${diffMinutes} min temu`;
            } else if (diffMinutes < 24 * 60) {
                photoViewerTime.textContent = `${Math.floor(diffMinutes / 60)} godz. temu`;
            } else {
                photoViewerTime.textContent = date.toLocaleDateString();
            }

            if (currentPhoto.guest_avatar) {
                const picUrl = currentPhoto.guest_avatar.startsWith('http') ? currentPhoto.guest_avatar : `http://127.0.0.1:8000${currentPhoto.guest_avatar}`;
                photoViewerAvatar.src = picUrl;
            } else {
                photoViewerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(currentPhoto.guest_name, currentPhoto.guest_last_name))}&background=EAE0D5&color=000`;
            }
            
            const currentUser = JSON.parse(localStorage.getItem('user'));
            const photoDeleteBtn = document.getElementById('photo-delete-btn');
            const isOwner = currentUser && (currentUser.id == currentPhoto.guest || (currentPhoto.guest && currentUser.id == currentPhoto.guest.id));
            const isPrivileged = window.canCurrentUserDeletePhoto();

            if (currentUser && (isOwner || isPrivileged)) {
                if (photoDeleteBtn) photoDeleteBtn.style.display = 'flex';
                if (photoDeleteBtn) photoDeleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    customConfirm(async () => {
                        const token = localStorage.getItem('access_token');
                        try {
                            const response = await fetch(`${API_URL}/gallery/photos/${currentPhoto.id}/`, {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            if (response.ok) {
                                closePhotoViewer();
                                loadPhotos();
                            } else {
                                alert('Błąd podczas usuwania.');
                            }
                        } catch (err) {
                            alert('Wystąpił błąd.');
                        }
                    });
                };
            } else {
                if (photoDeleteBtn) photoDeleteBtn.style.display = 'none';
            }
        }
    }

    function showPrevPhoto() {
        if (isAnimating) return;
        isAnimating = true;

        photoViewerImage.classList.add('slide-out-right');
        photoViewerVideo.classList.add('slide-out-right');

        setTimeout(() => {
            if (currentPhotoIndex > 0) {
                currentPhotoIndex--;
            } else {
                currentPhotoIndex = backendPhotos.length - 1;
            }
            updatePhotoViewer();

            photoViewerImage.classList.remove('slide-out-right');
            photoViewerVideo.classList.remove('slide-out-right');
            
            photoViewerImage.classList.add('slide-in-left');
            photoViewerVideo.classList.add('slide-in-left');

            // force reflow
            void photoViewerImage.offsetWidth;
            void photoViewerVideo.offsetWidth;

            photoViewerImage.classList.remove('slide-in-left');
            photoViewerVideo.classList.remove('slide-in-left');

            setTimeout(() => {
                isAnimating = false;
            }, 300);
        }, 300);
    }

    function showNextPhoto() {
        if (isAnimating) return;
        isAnimating = true;

        photoViewerImage.classList.add('slide-out-left');
        photoViewerVideo.classList.add('slide-out-left');

        setTimeout(() => {
            if (currentPhotoIndex < backendPhotos.length - 1) {
                currentPhotoIndex++;
            } else {
                currentPhotoIndex = 0;
            }
            updatePhotoViewer();

            photoViewerImage.classList.remove('slide-out-left');
            photoViewerVideo.classList.remove('slide-out-left');
            
            photoViewerImage.classList.add('slide-in-right');
            photoViewerVideo.classList.add('slide-in-right');

            // force reflow
            void photoViewerImage.offsetWidth;
            void photoViewerVideo.offsetWidth;

            photoViewerImage.classList.remove('slide-in-right');
            photoViewerVideo.classList.remove('slide-in-right');

            setTimeout(() => {
                isAnimating = false;
            }, 100);
        }, 100);
    }

    function closePhotoViewer() {
        photoViewerOverlay.classList.remove('active');
        if (photoViewerVideo) {
            photoViewerVideo.pause();
            photoViewerVideo.src = "";
        }
    }

    if (photoViewerClose) {
        photoViewerClose.addEventListener('click', closePhotoViewer);
        photoViewerOverlay.addEventListener('click', (e) => {
            if (e.target === photoViewerOverlay) {
                closePhotoViewer();
            }
        });

        photoViewerOverlay.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        photoViewerOverlay.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });
        
        // Video hold gestures
        let videoHoldTimeout;
        let isHoldingVideo = false;
        let isLeftHold = false;
        const speedIndicator = document.getElementById('video-speed-indicator');

        photoViewerVideo.addEventListener('pointerdown', (e) => {
            isHoldingVideo = true;
            // 25% of the video width from the left
            const rect = photoViewerVideo.getBoundingClientRect();
            const relativeX = e.clientX - rect.left;
            isLeftHold = (relativeX < rect.width * 0.25);
            
            videoHoldTimeout = setTimeout(() => {
                if (isHoldingVideo) {
                    if (isLeftHold) {
                        photoViewerVideo.playbackRate = 2.0;
                        if (speedIndicator) speedIndicator.style.display = 'flex';
                    } else {
                        photoViewerVideo.pause();
                    }
                }
            }, 100);
        });

        const endVideoHold = () => {
            isHoldingVideo = false;
            clearTimeout(videoHoldTimeout);
            if (photoViewerVideo.playbackRate !== 1.0) {
                photoViewerVideo.playbackRate = 1.0;
                if (speedIndicator) speedIndicator.style.display = 'none';
            }
            if (photoViewerOverlay.classList.contains('active') && photoViewerVideo.style.display !== 'none' && photoViewerVideo.paused) {
                photoViewerVideo.play();
            }
        };

        photoViewerVideo.addEventListener('pointerup', endVideoHold);
        photoViewerVideo.addEventListener('pointercancel', endVideoHold);
        photoViewerVideo.addEventListener('pointerleave', endVideoHold);
    }

    function handleSwipe() {
        const threshold = 50; // min px to consider a swipe
        if (touchEndX < touchStartX - threshold) {
            // Swipe left -> next photo
            showNextPhoto();
        }
        if (touchEndX > touchStartX + threshold) {
            // Swipe right -> prev photo
            showPrevPhoto();
        }
    }

    // Usunięte stare funkcje loadPhotos i renderPhoto

    const addPhotoLabel = document.getElementById('add-photo-label');
    const fabAddPhoto = document.getElementById('fab-add-photo');
    if (addPhotoLabel) {
        addPhotoLabel.addEventListener('click', () => openCamera('gallery'));
    }
    if (fabAddPhoto) {
        fabAddPhoto.addEventListener('click', () => openCamera('gallery'));
    }

    function compressImage(file, maxDimension, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxDimension) {
                            height = Math.round((height *= maxDimension / width));
                            width = maxDimension;
                        }
                    } else {
                        if (height > maxDimension) {
                            width = Math.round((width *= maxDimension / height));
                            height = maxDimension;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(blob => {
                        resolve(blob);
                    }, 'image/jpeg', quality);
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    }

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async function initPushNotifications() {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push notifications are not supported on this device/browser.');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            const res = await fetch(`${API_URL}/notifications/vapid-key/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch VAPID key');
            const data = await res.json();
            const publicVapidKey = data.public_key;

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('Notification permission denied.');
                return;
            }

            let subscription = await registration.pushManager.getSubscription();
            const convertedKey = urlBase64ToUint8Array(publicVapidKey);

            if (subscription) {
                let keyMatches = false;
                if (subscription.options && subscription.options.applicationServerKey) {
                    const existingKey = new Uint8Array(subscription.options.applicationServerKey);
                    if (existingKey.length === convertedKey.length) {
                        keyMatches = existingKey.every((val, index) => val === convertedKey[index]);
                    }
                }
                if (!keyMatches) {
                    await subscription.unsubscribe();
                    subscription = null;
                }
            }

            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedKey
                });
            }

            const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh'))));
            const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))));

            await fetch(`${API_URL}/notifications/subscribe/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                    p256dh: p256dh,
                    auth: auth
                })
            });
            console.log('Push notification subscription successful.');
        } catch (e) {
            console.error('Error registering for push notifications:', e);
        }
    }

    // --- User Profile Logic ("Ty" tab) ---
    const profilePictureInput = document.getElementById('profile-picture-input');
    const userProfilePicture = document.getElementById('user-profile-picture');
    const userProfileName = document.getElementById('user-profile-name');
    const userProfileCode = document.getElementById('user-profile-code');
    const userTableInfo = document.getElementById('user-table-info');
    const logoutBtn = document.getElementById('logout-btn');

    function updateProfileUI() {
        let user = null;
        try {
            user = JSON.parse(localStorage.getItem('user'));
        } catch (e) { }

        if (user) {
            let prefix = user.prefix ? `${user.prefix} ` : '';
            const fullName = `${prefix}${user.first_name || ''} ${user.last_name || ''}`.trim() || `Gość ${user.login_code}`;

            if (userProfileName) {
                userProfileName.textContent = fullName;
            }
            const userProfileRelationship = document.getElementById('user-profile-relationship');
            if (userProfileRelationship) {
                updateRoleBadge('user-profile-relationship', user.role, user.relationship);
            }

            const userProfileCodeValue = document.getElementById('user-profile-code-value');
            if (userProfileCodeValue) {
                userProfileCodeValue.textContent = user.login_code || '------';
            } else if (userProfileCode) {
                userProfileCode.textContent = `Kod: ${user.login_code}`;
            }
            
            if (userTableInfo) {
                const isLayoutReady = window._activeLayout && window._activeLayout.isReady;
                if (!isLayoutReady) {
                    userTableInfo.textContent = 'Plan stołów jest jeszcze niedostępny';
                } else if (user.table_number !== null && user.table_number !== undefined && user.table_number !== '') {
                    const tableLabel = (user.table_number === 0 || user.table_number === '0') 
                        ? 'Stół Pary Młodej' 
                        : `Stolik <strong>${user.table_number}</strong>`;
                    userTableInfo.innerHTML = tableLabel + 
                        (user.seat_number ? ` &bull; Miejsce ${user.seat_number}` : '');
                } else {
                    userTableInfo.textContent = 'Brak przypisanego stolika';
                }
            }

            // Section "Jak się poznaliśmy" (How we met) - only show if non-empty
            const userHowWeMetContainer = document.getElementById('user-how-we-met-container');
            const userHowWeMetText = document.getElementById('user-how-we-met-text');
            if (user.how_we_met && user.how_we_met.trim() !== '') {
                if (userHowWeMetText) userHowWeMetText.textContent = user.how_we_met.trim();
                if (userHowWeMetContainer) userHowWeMetContainer.style.display = 'flex';
            } else {
                if (userHowWeMetContainer) userHowWeMetContainer.style.display = 'none';
            }

            // Section "Skrzynka Życzeń" (wishes panel card for para_mloda / swiadek / staff)
            const wishesPanelCard = document.getElementById('wishes-panel-card');
            if (wishesPanelCard) {
                if (weddingConfig.wishes_enabled !== false && (user.role === 'para_mloda' || user.role === 'swiadek' || user.is_staff)) {
                    wishesPanelCard.style.display = 'flex';
                    loadWishes();
                } else {
                    wishesPanelCard.style.display = 'none';
                }
            }

            // Section "Panel Pary Młodej" (only for para_mloda)
            const adminPanelCard = document.getElementById('admin-panel-card');
            if (adminPanelCard) {
                if (user.role === 'para_mloda') {
                    adminPanelCard.style.display = 'flex';
                } else {
                    adminPanelCard.style.display = 'none';
                }
            }

            // Section "Zmień Hasło" (only for para_mloda / swiadek)
            const changePasswordCard = document.getElementById('change-password-card');
            if (changePasswordCard) {
                if (user.role === 'para_mloda' || user.role === 'swiadek') {
                    changePasswordCard.style.display = 'flex';
                } else {
                    changePasswordCard.style.display = 'none';
                }
            }

            // Removed Seating Creator panel (coupleToolsContainer) as requested

            if (user.profile_picture) {
                const picUrl = user.profile_picture.startsWith('http') ? user.profile_picture : `http://127.0.0.1:8000${user.profile_picture}`;
                if (userProfilePicture) userProfilePicture.src = picUrl;
            } else {
                if (userProfilePicture) userProfilePicture.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(user.first_name, user.last_name))}&background=EAE0D5&color=000`;
            }
        }
    }


    const editProfilePictureLabel = document.getElementById('edit-profile-picture-label');
    if (editProfilePictureLabel) {
        editProfilePictureLabel.addEventListener('click', () => openCamera('profile'));
    }

    const userTableCard = document.getElementById('user-table-card');
    if (userTableCard) {
        userTableCard.addEventListener('click', async () => {
            let user = null;
            try {
                user = JSON.parse(localStorage.getItem('user'));
            } catch (e) { }

            if (user && user.table_number !== null && user.table_number !== undefined) {
                // Przełącz na zakładkę "Info"
                const infoNav = document.querySelector('.nav-item[data-target="tab-info"]');
                if (infoNav) infoNav.click();

                // Przeskroluj widok do Planu Sali
                const planHeader = document.getElementById('plan-sali-header') || document.querySelector('.venue-map-wrapper');
                if (planHeader) {
                    setTimeout(() => {
                        planHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                }

                // Upewnij się, że dane stolików są załadowane
                if (!tablesData || tablesData.length === 0) {
                    await loadTables();
                }

                // Znajdź stolik użytkownika i otwórz arkusz szczegółów
                const targetTable = tablesData.find(t => t.table_number === user.table_number);
                if (targetTable) {
                    openTableDetails(targetTable);
                }
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            
            // Wyczyść dane z pamięci i zresetuj UI
            backendPhotos = [];
            backendStories = [];
            if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
            if (typeof renderStoryRings === 'function') renderStoryRings();

            // Go to login overlay
            loginOverlay.classList.add('active');
            
            // Switch to first tab in background
            document.querySelector('.nav-item[data-target="tab-couple"]').click();
        });
    }

    // Change Password Modal Hooks & Listeners
    const changePasswordCard = document.getElementById('change-password-card');
    const changePasswordModal = document.getElementById('change-password-modal');
    const changePasswordClose = document.getElementById('change-password-close');
    const changePasswordSubmitBtn = document.getElementById('change-password-submit-btn');
    const newPasswordInput = document.getElementById('new-password-input');
    const confirmPasswordInput = document.getElementById('confirm-password-input');
    const changePasswordError = document.getElementById('change-password-error');

    if (changePasswordCard && changePasswordModal) {
        changePasswordCard.addEventListener('click', () => {
            changePasswordModal.style.display = 'flex';
            newPasswordInput.value = '';
            confirmPasswordInput.value = '';
            changePasswordError.textContent = '';
            changePasswordError.style.color = '#e11d48';
            newPasswordInput.focus();
        });
    }

    if (changePasswordClose && changePasswordModal) {
        changePasswordClose.addEventListener('click', () => {
            changePasswordModal.style.display = 'none';
        });
    }

    if (changePasswordSubmitBtn) {
        changePasswordSubmitBtn.addEventListener('click', async () => {
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            if (!newPassword || newPassword.length < 4) {
                changePasswordError.textContent = 'Hasło musi mieć co najmniej 4 znaki.';
                changePasswordError.style.color = '#e11d48';
                return;
            }
            if (newPassword !== confirmPassword) {
                changePasswordError.textContent = 'Hasła nie są identyczne.';
                changePasswordError.style.color = '#e11d48';
                return;
            }

            try {
                changePasswordSubmitBtn.disabled = true;
                changePasswordSubmitBtn.textContent = 'Zapisywanie...';
                
                const token = localStorage.getItem('access_token');
                const response = await fetch(`${API_URL}/me/`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ password: newPassword })
                });
                
                const data = await response.json();
                if (response.ok) {
                    changePasswordError.textContent = 'Hasło zostało zmienione!';
                    changePasswordError.style.color = '#10b981';
                    setTimeout(() => {
                        changePasswordModal.style.display = 'none';
                    }, 1500);
                } else {
                    changePasswordError.textContent = data.error || 'Nie udało się zmienić hasła.';
                    changePasswordError.style.color = '#e11d48';
                }
            } catch (err) {
                console.error(err);
                changePasswordError.textContent = 'Błąd połączenia z serwerem.';
                changePasswordError.style.color = '#e11d48';
            } finally {
                changePasswordSubmitBtn.disabled = false;
                changePasswordSubmitBtn.textContent = 'Zmień hasło';
            }
        });
    }

    if (newPasswordInput && confirmPasswordInput && changePasswordSubmitBtn) {
        const enterSubmit = (e) => {
            if (e.key === 'Enter') {
                changePasswordSubmitBtn.click();
            }
        };
        newPasswordInput.addEventListener('keypress', enterSubmit);
        confirmPasswordInput.addEventListener('keypress', enterSubmit);
    }

    // Sort Event Listener
    const sortBtn = document.getElementById('sort-btn');
    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            if (sortOrder === 'asc') {
                sortOrder = 'desc';
                sortBtn.innerHTML = '<i class="ph ph-sort-descending"></i>';
            } else {
                sortOrder = 'asc';
                sortBtn.innerHTML = '<i class="ph ph-sort-ascending"></i>';
            }
            applyFiltersAndRender();
        });
    }

    // Filter Event Listeners
    const filterBtn = document.getElementById('filter-btn');
    const activeFilterBanner = document.getElementById('active-filter-banner');
    const activeFilterText = document.getElementById('active-filter-text');
    const clearFilterBtn = document.getElementById('clear-filter-btn');

    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            let user = null;
            try { user = JSON.parse(localStorage.getItem('user')); } catch(e) {}
            if (user && user.table_number !== null && user.table_number !== undefined && user.table_number !== '') {
                if (currentFilter.type === 'table' && currentFilter.value === user.table_number) {
                    clearFilter();
                } else {
                    const tableLabel = getTableName(user.table_number);
                    currentFilter = { type: 'table', value: user.table_number, label: `Twój stolik (${tableLabel})` };
                    updateFilterUI();
                    applyFiltersAndRender();
                }
            } else {
                alert('Nie masz przypisanego stolika.');
            }
        });
    }

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearFilter);
    }

    function clearFilter() {
        currentFilter = { type: null, value: null, label: '' };
        updateFilterUI();
        applyFiltersAndRender();
    }

    function updateFilterUI() {
        if (currentFilter.type) {
            activeFilterText.textContent = `Filtrujesz: ${currentFilter.label}`;
            activeFilterBanner.style.display = 'flex';
        } else {
            activeFilterBanner.style.display = 'none';
        }
    }

    function handleUserFilterClick() {
        const photo = backendPhotos[currentPhotoIndex];
        if (photo) {
            let filterPrefix = photo.guest_prefix ? `${photo.guest_prefix} ` : '';
            currentFilter = { type: 'user', value: photo.guest, label: filterPrefix + (photo.guest_name || 'Gość') };
            updateFilterUI();
            applyFiltersAndRender();
            photoViewerOverlay.classList.remove('active');
            
            // Scroll to Let's party tab top
            document.querySelector('.app-container').scrollTo({top: 0, behavior: 'smooth'});
        }
    }
    
    if (photoViewerName) {
        photoViewerName.style.cursor = 'pointer';
        photoViewerName.addEventListener('click', handleUserFilterClick);
    }
    if (photoViewerAvatar) {
        photoViewerAvatar.style.cursor = 'pointer';
        photoViewerAvatar.addEventListener('click', handleUserFilterClick);
    }

    // --- Live Wedding Countdown Timer ---
    const weddingDate = new Date('2027-06-26T16:00:00+02:00').getTime();
    function updateWeddingCountdown() {
        const now = new Date().getTime();
        const distance = weddingDate - now;

        if (distance < 0) {
            const cdBox = document.querySelector('.wedding-countdown-box');
            if (cdBox) cdBox.innerHTML = '<div style="font-size:1.2rem; font-weight:700; color:#d4af37;">Dzisiaj jest nasz Ślub! 💒🎉</div>';
            const hCdBox = document.getElementById('header-countdown-box');
            if (hCdBox) hCdBox.innerHTML = '<div style="font-size:0.9rem; font-weight:700; color:#d4af37;">Dzisiaj jest nasz Ślub! 💒</div>';
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Main Tab Countdown
        const cdDays = document.getElementById('cd-days');
        const cdHours = document.getElementById('cd-hours');
        const cdMinutes = document.getElementById('cd-minutes');
        const cdSeconds = document.getElementById('cd-seconds');

        if (cdDays) cdDays.textContent = String(days).padStart(2, '0');
        if (cdHours) cdHours.textContent = String(hours).padStart(2, '0');
        if (cdMinutes) cdMinutes.textContent = String(minutes).padStart(2, '0');
        if (cdSeconds) cdSeconds.textContent = String(seconds).padStart(2, '0');

        // Header Countdown Widget
        const hCdDays = document.getElementById('h-cd-days');
        const hCdHours = document.getElementById('h-cd-hours');
        const hCdMinutes = document.getElementById('h-cd-minutes');
        const hCdSeconds = document.getElementById('h-cd-seconds');

        if (hCdDays) hCdDays.textContent = String(days).padStart(2, '0');
        if (hCdHours) hCdHours.textContent = String(hours).padStart(2, '0');
        if (hCdMinutes) hCdMinutes.textContent = String(minutes).padStart(2, '0');
        if (hCdSeconds) hCdSeconds.textContent = String(seconds).padStart(2, '0');
    }
    updateWeddingCountdown();
    setInterval(updateWeddingCountdown, 1000);

    // --- Direct Messages to Couple, Voice Recorder & Video Upload ---
    const openDirectMsgBtn = document.getElementById('open-direct-msg-btn');
    const directMsgModal = document.getElementById('direct-msg-modal');
    const directModalClose = document.getElementById('direct-modal-close');
    const tabDirectText = document.getElementById('tab-direct-text');
    const tabDirectVoice = document.getElementById('tab-direct-voice');
    const tabDirectVideo = document.getElementById('tab-direct-video');
    const panelDirectText = document.getElementById('panel-direct-text');
    const panelDirectVoice = document.getElementById('panel-direct-voice');
    const panelDirectVideo = document.getElementById('panel-direct-video');
    const sendDirectSubmitBtn = document.getElementById('send-direct-submit-btn');

    const voiceRecordBtn = document.getElementById('voice-record-btn');
    const voiceTimer = document.getElementById('voice-timer');
    const voiceStatusText = document.getElementById('voice-status-text');
    const voiceAudioPreview = document.getElementById('voice-audio-preview');

    const directVideoInput = document.getElementById('direct-video-input');
    const directVideoPreview = document.getElementById('direct-video-preview');
    const videoStatusText = document.getElementById('video-status-text');
    const directVideoOpenCameraBtn = document.getElementById('direct-video-open-camera-btn');

    let voiceMediaRecorder = null;
    let audioChunks = [];
    let voiceIsRecording = false;
    let recordStartTime = 0;
    let recordInterval = null;
    let recordedAudioBlob = null;
    let selectedVideoFile = null;

    if (directVideoOpenCameraBtn) {
        directVideoOpenCameraBtn.addEventListener('click', () => {
            openCamera('wish_video');
        });
    }

    function showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        Object.assign(toast.style, {
            position: 'fixed',
            top: 'calc(24px + env(safe-area-inset-top, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '50px',
            fontSize: '0.9rem',
            fontWeight: '600',
            zIndex: '10000',
            opacity: '0',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            pointerEvents: 'none',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            whiteSpace: 'nowrap'
        });
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
        }, 50);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(0)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    if (openDirectMsgBtn) {
        openDirectMsgBtn.addEventListener('click', () => {
            if (openDirectMsgBtn.dataset.locked === 'true') {
                showToast("Na życzenia jeszcze za wcześnie!");
                return;
            }
            if (directMsgModal) directMsgModal.style.display = 'flex';
        });
    }

    if (directModalClose) {
        directModalClose.addEventListener('click', () => {
            stopAudioRecordingIfActive();
            if (directMsgModal) directMsgModal.style.display = 'none';
        });
    }

    if (directMsgModal) {
        directMsgModal.addEventListener('click', (e) => {
            if (e.target === directMsgModal) {
                stopAudioRecordingIfActive();
                directMsgModal.style.display = 'none';
            }
        });
    }

    // Switch mode tabs (Tekst / Głosowo / Wideo)
    [
        { btn: tabDirectText, panel: panelDirectText },
        { btn: tabDirectVoice, panel: panelDirectVoice },
        { btn: tabDirectVideo, panel: panelDirectVideo }
    ].forEach(({ btn, panel }) => {
        if (btn) {
            btn.addEventListener('click', () => {
                [tabDirectText, tabDirectVoice, tabDirectVideo].forEach(b => b && b.classList.remove('active'));
                [panelDirectText, panelDirectVoice, panelDirectVideo].forEach(p => p && (p.style.display = 'none'));

                btn.classList.add('active');
                if (panel) panel.style.display = 'block';

                // Open camera automatically when 🎬 (Wideo) tab is selected
                if (btn === tabDirectVideo) {
                    openCamera('wish_video');
                }
            });
        }
    });

    // Word count calculation & 1000-word limit warning for text wish
    const directTextInput = document.getElementById('direct-text-input');
    const directWordCount = document.getElementById('direct-word-count');
    const wordLimitWarning = document.getElementById('word-limit-warning');

    if (directTextInput) {
        directTextInput.addEventListener('input', () => {
            const text = directTextInput.value;
            const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean) : [];
            const wordCount = words.length;

            if (directWordCount) {
                directWordCount.textContent = `${wordCount} / 1000 słów`;
                if (wordCount > 1000) {
                    directWordCount.style.color = '#e11d48';
                } else {
                    directWordCount.style.color = '#71717a';
                }
            }

            if (wordLimitWarning) {
                wordLimitWarning.style.display = wordCount > 1000 ? 'flex' : 'none';
            }
        });
    }

    if (directVideoInput) {
        directVideoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                selectedVideoFile = file;
                const videoUrl = URL.createObjectURL(file);
                if (directVideoPreview) {
                    directVideoPreview.src = videoUrl;
                    directVideoPreview.style.display = 'block';
                }
                if (videoStatusText) videoStatusText.textContent = `Wybrano film: ${file.name}`;
            }
        });
    }

    if (voiceRecordBtn) {
        voiceRecordBtn.addEventListener('click', async () => {
            if (!voiceIsRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    voiceMediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    voiceMediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) audioChunks.push(e.data);
                    };

                    voiceMediaRecorder.onstop = () => {
                        recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        const audioUrl = URL.createObjectURL(recordedAudioBlob);
                        if (voiceAudioPreview) {
                            voiceAudioPreview.src = audioUrl;
                            voiceAudioPreview.style.display = 'block';
                        }
                        if (voiceStatusText) voiceStatusText.textContent = 'Nagranie gotowe! Możesz je odsłuchać lub nagrać od nowa.';
                    };

                    voiceMediaRecorder.start();
                    voiceIsRecording = true;
                    voiceRecordBtn.classList.add('recording');
                    voiceRecordBtn.innerHTML = '<i class="ph-fill ph-stop"></i>';
                    if (voiceStatusText) voiceStatusText.textContent = 'Nagrywanie... Dotknij kwadratu, aby zakończyć.';
                    
                    recordStartTime = Date.now();
                    recordInterval = setInterval(updateVoiceTimer, 1000);

                } catch (err) {
                    console.error('Mikrofon niedostępny:', err);
                    alert('Nie udało się uzyskać dostępu do mikrofonu w przeglądarce.');
                }
            } else {
                stopAudioRecordingIfActive();
            }
        });
    }

    function updateVoiceTimer() {
        const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        if (voiceTimer) voiceTimer.textContent = `${mins}:${secs}`;
    }

    function stopAudioRecordingIfActive() {
        if (voiceIsRecording && voiceMediaRecorder) {
            voiceMediaRecorder.stop();
            voiceMediaRecorder.stream.getTracks().forEach(track => track.stop());
            voiceIsRecording = false;
            clearInterval(recordInterval);
            if (voiceRecordBtn) {
                voiceRecordBtn.classList.remove('recording');
                voiceRecordBtn.innerHTML = '<i class="ph-fill ph-microphone"></i>';
            }
        }
    }

    if (sendDirectSubmitBtn) {
        sendDirectSubmitBtn.addEventListener('click', async () => {
            const isTextMode = tabDirectText && tabDirectText.classList.contains('active');
            const isVoiceMode = tabDirectVoice && tabDirectVoice.classList.contains('active');
            const isVideoMode = tabDirectVideo && tabDirectVideo.classList.contains('active');

            const textContent = document.getElementById('direct-text-input')?.value.trim();

            const token = localStorage.getItem('access_token');
            if (!token) {
                alert('Musisz być zalogowany, aby wysłać wiadomość.');
                return;
            }

            const formData = new FormData();
            if (isTextMode) {
                if (!textContent) {
                    alert('Wpisz treść wiadomości przed wysłaniem.');
                    return;
                }
                const words = textContent.split(/\s+/).filter(Boolean);
                if (words.length > 1000) {
                    alert('Przekroczono limit 1000 słów! Skróć tekst przed wysłaniem.');
                    return;
                }
                formData.append('text', textContent);
            } else if (isVoiceMode) {
                if (!recordedAudioBlob && !voiceIsRecording) {
                    alert('Nagraj najpierw wiadomość głosową.');
                    return;
                }
                stopAudioRecordingIfActive();
                if (recordedAudioBlob) {
                    formData.append('audio', recordedAudioBlob, `voice_${Date.now()}.webm`);
                }
            } else if (isVideoMode) {
                if (!selectedVideoFile) {
                    alert('Wybierz lub nagraj film wideo przed wysłaniem.');
                    return;
                }
                formData.append('video', selectedVideoFile, selectedVideoFile.name || `video_${Date.now()}.mp4`);
            }

            sendDirectSubmitBtn.disabled = true;
            sendDirectSubmitBtn.textContent = 'Wysyłanie...';

            try {
                const res = await fetch(`${API_URL}/wishes/`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                if (res.status === 401) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user');
                    const loginOverlay = document.getElementById('login-overlay');
                    if (loginOverlay) loginOverlay.classList.add('active');
                    alert('Twój token wygasł lub jesteś niezalogowany. Zaloguj się ponownie swoim kodem z zaproszenia.');
                    return;
                }

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    alert(errData.error || errData.detail || 'Nie udało się wysłać życzeń. Spróbuj ponownie.');
                    return;
                }

                showToast(isVideoMode ? 'Dziękujemy! Nagranie wideo zostało wysłane do Zuzi i Kamila! 🎬❤️' : (isTextMode ? 'Dziękujemy! Twoje życzenia trafiły prosto do Zuzi i Kamila! ❤️' : 'Dziękujemy! Nagranie głosowe zostało wysłane do Zuzi i Kamila! 🎙️❤️'));
                
                if (document.getElementById('direct-text-input')) document.getElementById('direct-text-input').value = '';
                recordedAudioBlob = null;
                selectedVideoFile = null;
                if (directVideoInput) directVideoInput.value = '';
                if (directVideoPreview) { directVideoPreview.style.display = 'none'; directVideoPreview.src = ''; }
                if (voiceAudioPreview) voiceAudioPreview.style.display = 'none';
                if (voiceTimer) voiceTimer.textContent = '00:00';
                if (voiceStatusText) voiceStatusText.textContent = 'Dotknij mikrofonu, aby zacząć nagrywać';
                if (videoStatusText) videoStatusText.textContent = 'Wybierz wideo z telefonu lub nagraj krótki filmik';
                if (directMsgModal) directMsgModal.style.display = 'none';

                try {
                    await loadWishes();
                } catch(e) {
                    console.error('Błąd odświeżania listy życzeń:', e);
                }
            } catch (err) {
                console.error('Błąd połączenia przy wysyłaniu życzeń:', err);
                alert(`Błąd połączenia z serwerem (${err.message || err}). Spróbuj ponownie.`);
            } finally {
                sendDirectSubmitBtn.disabled = false;
                sendDirectSubmitBtn.textContent = 'Wyślij wiadomość prosto do Młodych';
            }
        });
    }

    function createFloatingHeart(x, y) {
        const heart = document.createElement('div');
        heart.innerHTML = '❤️';
        heart.style.position = 'fixed';
        heart.style.left = `${x + (Math.random() * 40 - 20)}px`;
        heart.style.top = `${y + (Math.random() * 20 - 10)}px`;
        heart.style.fontSize = `${Math.random() * 1.2 + 1.2}rem`;
        heart.style.pointerEvents = 'none';
        heart.style.zIndex = '9999';
        heart.style.transition = 'transform 1.2s ease-out, opacity 1.2s ease-out';
        document.body.appendChild(heart);

        requestAnimationFrame(() => {
            heart.style.transform = `translateY(-${Math.random() * 100 + 80}px) scale(${Math.random() * 0.5 + 1})`;
            heart.style.opacity = '0';
        });

        setTimeout(() => {
            if (heart && heart.parentNode) heart.parentNode.removeChild(heart);
        }, 1300);
    }

    // --- Interactive Header Schedule Logic & Test Controller ---
    let SCHEDULE_EVENTS = [
        { id: 1, time: '16:00', label: '16:00 Ślub', title: 'Ceremonia Ślubna', desc: 'Uroczysta msza i przysięga małżeńska w Kościele św. Andrzeja Boboli w Białymstoku.', location: 'Kościół św. Andrzeja Boboli', icon: 'ph-church', startMin: 16 * 60, endMin: 17 * 60 + 30 },
        { id: 2, time: '18:00', label: '18:00 Obiad', title: 'Toast Powitalny i Obiad', desc: 'Powitanie Pary Młodej chlebem i solą, wykwintny obiad w Oranżerii.', location: 'Oranżeria Nowosiółki', icon: 'ph-champagne', startMin: 17 * 60 + 30, endMin: 19 * 60 + 30 },
        { id: 3, time: '19:30', label: '19:30 Taniec', title: 'Pierwszy Taniec i Impreza', desc: 'Pierwszy taniec Zuzii i Kamila oraz huczne otwarcie parkietu!', location: 'Parkiet Główny', icon: 'ph-music-notes', startMin: 19 * 60 + 30, endMin: 22 * 60 },
        { id: 4, time: '22:00', label: '22:00 Tort', title: 'Uroczysty Tort Weselny', desc: 'Serwowanie słodkiego tortu weselnego oraz pokaz sztucznych ogni.', location: 'Sala Główna', icon: 'ph-cake', startMin: 22 * 60, endMin: 24 * 60 },
        { id: 5, time: '00:00', label: '00:00 Oczepiny', title: 'Oczepiny i Zabawy', desc: 'Tradycyjne zabawy oczepinowe, rzucanie welonem i krawatem!', location: 'Parkiet', icon: 'ph-crown', startMin: 24 * 60, endMin: 28 * 60 }
    ];

    let forceScheduleMode = false;
    let simulatedEventIndex = null;

    function renderHeaderSchedule() {
        const container = document.getElementById('schedule-items-container');
        if (!container) return;

        const now = new Date();
        let currentMinutes = (now.getHours() * 60 + now.getMinutes());

        if (simulatedEventIndex !== null && SCHEDULE_EVENTS[simulatedEventIndex]) {
            currentMinutes = SCHEDULE_EVENTS[simulatedEventIndex].startMin + 5;
        }

        container.innerHTML = '';
        let activeNodeEl = null;

        SCHEDULE_EVENTS.forEach((evt, idx) => {
            const node = document.createElement('div');
            node.className = 'schedule-node';

            const isPassed = currentMinutes > evt.endMin;
            const isActive = (currentMinutes >= evt.startMin && currentMinutes <= evt.endMin) || 
                             (simulatedEventIndex === idx) ||
                             (simulatedEventIndex === null && idx === 0 && currentMinutes < evt.startMin);

            if (isActive) {
                node.classList.add('active');
                activeNodeEl = node;
            } else if (isPassed) {
                node.classList.add('passed');
            }

            node.innerHTML = `
                <div class="node-dot"><i class="ph-fill ${evt.icon}"></i></div>
                <div class="node-time">${evt.time}</div>
            `;

            node.addEventListener('click', () => {
                showScheduleModal(evt);
            });

            container.appendChild(node);
        });

        if (activeNodeEl) {
            setTimeout(() => {
                activeNodeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }, 120);
        }
    }

    function showScheduleModal(evt) {
        const modal = document.getElementById('schedule-event-modal');
        if (!modal) return;
        document.getElementById('schedule-modal-badge').textContent = evt.time;
        document.getElementById('schedule-modal-title').textContent = evt.title;
        document.getElementById('schedule-modal-desc').textContent = evt.desc;
        document.getElementById('schedule-modal-location').innerHTML = `<i class="ph-fill ph-map-pin"></i> ${evt.location}`;
        modal.style.display = 'flex';
    }

    const modalClose = document.getElementById('schedule-modal-close');
    const modalOverlay = document.getElementById('schedule-event-modal');
    if (modalClose) modalClose.addEventListener('click', () => modalOverlay.style.display = 'none');
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.style.display = 'none';
    });

    let testHeaderState = 0; // 0: Countdown, 1-5: Schedule Events, 6: Post Wedding

    const toggleBtn = document.getElementById('toggle-header-mode-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            testHeaderState = (testHeaderState + 1) % 7;
            updateHeaderDisplayMode();
        });
    }

    function renderPostWeddingStats() {
        const photosCount = backendPhotos.filter(p => p.media_type !== 'video').length;
        const videosCount = backendPhotos.filter(p => p.media_type === 'video').length;

        const statPhotos = document.getElementById('post-stat-photos');
        const statVideos = document.getElementById('post-stat-videos');

        if (statPhotos) statPhotos.textContent = photosCount;
        if (statVideos) statVideos.textContent = videosCount;
    }

    function updateHeaderDisplayMode() {
        const countdownBox = document.getElementById('header-countdown-box');
        const scheduleBox = document.getElementById('header-schedule-box');
        const postWeddingBox = document.getElementById('header-post-wedding-box');
        const toggleText = document.getElementById('toggle-mode-text');

        const now = new Date().getTime();
        const weddingDate = new Date('2027-06-26T16:00:00+02:00').getTime();
        const weddingEnd = new Date('2027-06-27T06:00:00+02:00').getTime();

        let isBeforeWedding = now < weddingDate;
        let isDuringWedding = now >= weddingDate && now <= weddingEnd;
        let isAfterWedding = now > weddingEnd;

        // Override if using test switcher toggle
        if (testHeaderState === 0) {
            isBeforeWedding = true; isDuringWedding = false; isAfterWedding = false;
            simulatedEventIndex = null;
            if (toggleText) toggleText.textContent = 'Test: Odliczanie';
        } else if (testHeaderState >= 1 && testHeaderState <= 5) {
            isBeforeWedding = false; isDuringWedding = true; isAfterWedding = false;
            simulatedEventIndex = testHeaderState - 1;
            const evt = SCHEDULE_EVENTS[simulatedEventIndex];
            if (toggleText) toggleText.textContent = `Test: ${evt.time}`;
        } else if (testHeaderState === 6) {
            isBeforeWedding = false; isDuringWedding = false; isAfterWedding = true;
            if (toggleText) toggleText.textContent = 'Test: Po Weselu';
        }

        console.log('updateHeaderDisplayMode called. testHeaderState:', testHeaderState, 'isBefore:', isBeforeWedding, 'isDuring:', isDuringWedding, 'isAfter:', isAfterWedding);

        // Update Couple Tab dynamic text
        const coupleStatusText = document.getElementById('couple-status-text');
        if (coupleStatusText) {
            if (isAfterWedding) {
                coupleStatusText.textContent = "Dziękujemy za świetną zabawę!";
            } else if (isDuringWedding) {
                coupleStatusText.textContent = "Dziękujemy, że jesteście z nami!";
            } else {
                coupleStatusText.textContent = "Do zobaczenia na naszym weselu";
            }
        }

        // Render appropriate box
        if (isAfterWedding) {
            if (countdownBox) countdownBox.style.display = 'none';
            if (scheduleBox) scheduleBox.style.display = 'none';
            if (postWeddingBox) postWeddingBox.style.display = 'block';
        } else if (isDuringWedding) {
            if (countdownBox) countdownBox.style.display = 'none';
            if (scheduleBox) scheduleBox.style.display = 'block';
            if (postWeddingBox) postWeddingBox.style.display = 'none';
            renderHeaderSchedule();
        } else {
            if (countdownBox) countdownBox.style.display = 'flex';
            if (scheduleBox) scheduleBox.style.display = 'none';
            if (postWeddingBox) postWeddingBox.style.display = 'none';
        }
    }

    updateHeaderDisplayMode();

    // --- Wishes Management System (Skrzynka Życzeń dla Pary Młodej) ---
    let allWishes = [];
    let filteredWishes = [];
    let sortOrderWishes = 'desc'; // 'desc' (najnowsze) or 'asc' (najstarsze)
    let currentWishesTypeFilter = 'all'; // 'all', 'text', 'voice', 'video'
    let wishesSearchQuery = '';
    let currentFsWishIndex = 0;
    let previousActiveTab = 'tab-you';

    const wishesPanelCard = document.getElementById('wishes-panel-card');
    const tabWishes = document.getElementById('tab-wishes');
    const wishesBackToMainBtn = document.getElementById('wishes-back-to-main-btn');

    const wishesSearchInput = document.getElementById('wishes-search-input');
    const wishesClearSearchBtn = document.getElementById('wishes-clear-search-btn');
    const wishesSortBtn = document.getElementById('wishes-sort-btn');
    const wishesSortIcon = document.getElementById('wishes-sort-icon');
    const wishesSortText = document.getElementById('wishes-sort-text');

    const wishesChipAll = document.getElementById('wishes-chip-all');
    const wishesChipText = document.getElementById('wishes-chip-text');
    const wishesChipVoice = document.getElementById('wishes-chip-voice');
    const wishesChipVideo = document.getElementById('wishes-chip-video');

    const wishesListUnseen = document.getElementById('wishes-list-unseen');
    const wishesListSeen = document.getElementById('wishes-list-seen');
    const wishesSectionUnseen = document.getElementById('wishes-section-unseen');
    const wishesSectionSeen = document.getElementById('wishes-section-seen');
    const wishesSeenSeparator = document.getElementById('wishes-seen-separator');
    const wishesPageEmpty = document.getElementById('wishes-page-empty');

    // Fullscreen viewer elements
    const wishesFsOverlay = document.getElementById('wishes-fullscreen-overlay');
    const wishesFsClose = document.getElementById('wishes-fs-close');
    const wishesFsCounter = document.getElementById('wishes-fs-counter');
    const wishesFsUpBtn = document.getElementById('wishes-fs-up-btn');
    const wishesFsDownBtn = document.getElementById('wishes-fs-down-btn');
    const wishesFsCard = document.getElementById('wishes-fs-card');

    const wishesFsAvatar = document.getElementById('wishes-fs-avatar');
    const wishesFsGuestName = document.getElementById('wishes-fs-guest-name');
    const wishesFsTable = document.getElementById('wishes-fs-table');
    const wishesFsRelationship = document.getElementById('wishes-fs-relationship');
    const wishesFsTime = document.getElementById('wishes-fs-time');

    const wishesFsTextBox = document.getElementById('wishes-fs-text-box');
    const wishesFsTextBody = document.getElementById('wishes-fs-text-body');
    const wishesFsAudioBox = document.getElementById('wishes-fs-audio-box');
    const wishesFsAudioPlayer = document.getElementById('wishes-fs-audio-player');
    const wishesFsAudioPlayBtn = document.getElementById('wishes-fs-audio-play-btn');
    const wishesFsPlayIcon = document.getElementById('wishes-fs-play-icon');
    const wishesFsAudioProgress = document.getElementById('wishes-fs-audio-progress');
    const wishesFsAudioTimer = document.getElementById('wishes-fs-audio-timer');

    const wishesFsVideoBox = document.getElementById('wishes-fs-video-box');
    const wishesFsVideoPlayer = document.getElementById('wishes-fs-video-player');

    const wishesFsDeleteBtn = document.getElementById('wishes-fs-delete-btn');
    const wishesFsThankBtn = document.getElementById('wishes-fs-thank-btn');

    async function loadWishes() {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        try {
            const response = await fetch(`${API_URL}/wishes/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                allWishes = await response.json();
                updateWishesUI();
                applyWishesFeedFilters();
            }
        } catch (err) {
            console.error('Błąd pobierania życzeń:', err);
        }
    }

    function updateWishesUI() {
        const cntAll = allWishes.length;
        const cntText = allWishes.filter(w => w.text && w.text.trim() !== '').length;
        const cntVoice = allWishes.filter(w => w.audio_url).length;
        const cntVideo = allWishes.filter(w => w.video_url).length;
        const cntUnseen = allWishes.filter(w => !w.is_read).length;

        const cntPageAll = document.getElementById('wishes-page-cnt-all');
        const cntPageText = document.getElementById('wishes-page-cnt-text');
        const cntPageVoice = document.getElementById('wishes-page-cnt-voice');
        const cntPageVideo = document.getElementById('wishes-page-cnt-video');
        const cntUnseenLabel = document.getElementById('wishes-unseen-count');
        const wishesCardCount = document.getElementById('wishes-card-count');
        const wishesCardSubtitle = document.getElementById('wishes-card-subtitle');

        if (cntPageAll) cntPageAll.textContent = cntAll;
        if (cntPageText) cntPageText.textContent = cntText;
        if (cntPageVoice) cntPageVoice.textContent = cntVoice;
        if (cntPageVideo) cntPageVideo.textContent = cntVideo;
        if (cntUnseenLabel) cntUnseenLabel.textContent = cntUnseen;
        if (wishesCardCount) wishesCardCount.textContent = cntUnseen > 0 ? `${cntUnseen} nowe` : cntAll;

        const typeFilterMap = {
            'all': { emoji: '📬', count: cntAll, title: 'Pokaż wszystkie życzenia (📬)' },
            'text': { emoji: '📝', count: cntText, title: 'Pokaż życzenia tekstowe (📝)' },
            'voice': { emoji: '🎙️', count: cntVoice, title: 'Pokaż życzenia głosowe (🎙️)' },
            'video': { emoji: '🎬', count: cntVideo, title: 'Pokaż życzenia wideo (🎬)' }
        };
        const curState = typeFilterMap[currentWishesTypeFilter] || typeFilterMap['all'];
        const filterEmojiEl = document.getElementById('wishes-filter-emoji');
        const filterCountEl = document.getElementById('wishes-filter-count');
        const toggleBtn = document.getElementById('wishes-toggle-filter-btn');

        if (filterEmojiEl) filterEmojiEl.textContent = curState.emoji;
        if (filterCountEl) filterCountEl.textContent = curState.count;
        if (toggleBtn) toggleBtn.title = curState.title;

        if (wishesCardSubtitle) {
            if (cntAll === 0) {
                wishesCardSubtitle.textContent = 'Brak życzeń od gości';
            } else if (cntUnseen > 0) {
                wishesCardSubtitle.textContent = `${cntUnseen} ${cntUnseen === 1 ? 'nowe życzenie' : 'nowych życzeń'} do przeczytania!`;
            } else {
                wishesCardSubtitle.textContent = `${cntAll} ${cntAll === 1 ? 'wiadomość' : 'wiadomości'} w skrzynce`;
            }
        }
    }

    function applyWishesFeedFilters() {
        let list = [...allWishes];

        // Type filter
        if (currentWishesTypeFilter === 'text') {
            list = list.filter(w => w.text && w.text.trim() !== '');
        } else if (currentWishesTypeFilter === 'voice') {
            list = list.filter(w => w.audio_url);
        } else if (currentWishesTypeFilter === 'video') {
            list = list.filter(w => w.video_url);
        }

        // Search query filter (person name, prefix, relationship, table, text)
        if (wishesSearchQuery && wishesSearchQuery.trim() !== '') {
            const q = wishesSearchQuery.trim().toLowerCase();
            list = list.filter(w => {
                const nameMatch = (w.guest_name || '').toLowerCase().includes(q);
                const prefixMatch = (w.guest_prefix || '').toLowerCase().includes(q);
                const relMatch = (w.relationship || '').toLowerCase().includes(q);
                const tableName = getTableName(w.table_number);
                const tableMatch = (w.table_number !== null && w.table_number !== undefined && w.table_number !== '')
                    ? tableName.toLowerCase().includes(q) || String(w.table_number).includes(q) 
                    : false;
                const textMatch = (w.text || '').toLowerCase().includes(q);
                return nameMatch || prefixMatch || relMatch || tableMatch || textMatch;
            });
        }

        // Sort order
        if (sortOrderWishes === 'asc') {
            list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        } else {
            list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        filteredWishes = list;

        // Split into unseen and seen
        const unseenList = filteredWishes.filter(w => !w.is_read);
        const seenList = filteredWishes.filter(w => w.is_read);

        if (filteredWishes.length === 0) {
            if (wishesPageEmpty) wishesPageEmpty.style.display = 'block';
            if (wishesListUnseen) wishesListUnseen.style.display = 'none';
            if (wishesListSeen) wishesListSeen.style.display = 'none';
            if (wishesSeenSeparator) wishesSeenSeparator.style.display = 'none';
            return;
        }

        if (wishesPageEmpty) wishesPageEmpty.style.display = 'none';

        renderWishesCardsList(unseenList, wishesListUnseen);
        renderWishesCardsList(seenList, wishesListSeen);

        if (wishesListUnseen) wishesListUnseen.style.display = unseenList.length > 0 ? 'flex' : 'none';
        if (wishesListSeen) wishesListSeen.style.display = seenList.length > 0 ? 'flex' : 'none';
        if (wishesSeenSeparator) wishesSeenSeparator.style.display = (unseenList.length > 0 && seenList.length > 0) ? 'flex' : 'none';
    }

    function renderWishesCardsList(wishes, container) {
        if (!container) return;
        container.innerHTML = '';

        wishes.forEach((wish) => {
            const row = document.createElement('div');
            row.className = wish.is_read ? 'wish-list-row' : 'wish-list-row unseen-wish';

            const avatarSrc = wish.guest_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(wish.guest_name, ''))}&background=EAE0D5&color=000`;
            const guestName = wish.guest_name || 'Gość';
            
            let typeEmoji = '📝';
            if (wish.video_url) {
                typeEmoji = '🎬';
            } else if (wish.audio_url) {
                typeEmoji = '🎙️';
            }

            row.innerHTML = `
                <img src="${avatarSrc}" class="wish-list-avatar" alt="${guestName}">
                <div class="wish-list-info">
                    <span class="wish-list-name">${guestName}</span>
                </div>
                <span class="wish-list-type-emoji">${typeEmoji}</span>
            `;

            row.addEventListener('click', () => {
                const fsIndex = filteredWishes.findIndex(w => w.id === wish.id);
                openWishesFullscreenViewer(fsIndex >= 0 ? fsIndex : 0);
            });

            container.appendChild(row);
        });
    }

    const wishesWriteBtn = document.getElementById('wishes-write-btn');
    if (wishesWriteBtn) {
        wishesWriteBtn.addEventListener('click', () => {
            const directMsgModal = document.getElementById('direct-msg-modal');
            if (directMsgModal) directMsgModal.style.display = 'flex';
        });
    }

    function openWishesPage() {
        previousActiveTab = 'tab-you';
        document.querySelectorAll('.tab-content').forEach(tab => {
            if (tab.classList.contains('active')) previousActiveTab = tab.id;
            tab.classList.remove('active');
        });

        if (tabWishes) {
            tabWishes.classList.add('active');
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadWishes();
    }

    if (wishesBackToMainBtn) {
        wishesBackToMainBtn.addEventListener('click', () => {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            const targetTab = document.getElementById(previousActiveTab) || document.getElementById('tab-you');
            if (targetTab) targetTab.classList.add('active');
        });
    }

    if (wishesPanelCard) {
        wishesPanelCard.addEventListener('click', openWishesPage);
    }

    // Search and Sort Event Listeners
    if (wishesSearchInput) {
        wishesSearchInput.addEventListener('input', (e) => {
            wishesSearchQuery = e.target.value;
            if (wishesClearSearchBtn) {
                wishesClearSearchBtn.style.display = wishesSearchQuery.length > 0 ? 'block' : 'none';
            }
            applyWishesFeedFilters();
        });
    }

    if (wishesClearSearchBtn) {
        wishesClearSearchBtn.addEventListener('click', () => {
            if (wishesSearchInput) wishesSearchInput.value = '';
            wishesSearchQuery = '';
            wishesClearSearchBtn.style.display = 'none';
            applyWishesFeedFilters();
        });
    }

    if (wishesSortBtn) {
        wishesSortBtn.addEventListener('click', () => {
            if (sortOrderWishes === 'desc') {
                sortOrderWishes = 'asc';
                if (wishesSortIcon) wishesSortIcon.className = 'ph ph-sort-ascending';
                if (wishesSortText) wishesSortText.textContent = 'Najstarsze';
            } else {
                sortOrderWishes = 'desc';
                if (wishesSortIcon) wishesSortIcon.className = 'ph ph-sort-descending';
                if (wishesSortText) wishesSortText.textContent = 'Najnowsze';
            }
            applyWishesFeedFilters();
        });
    }

    // Single Type Toggle Button (Cyklicznie: 'all' -> 'text' -> 'voice' -> 'video' -> 'all')
    const wishesToggleFilterBtn = document.getElementById('wishes-toggle-filter-btn');
    if (wishesToggleFilterBtn) {
        wishesToggleFilterBtn.addEventListener('click', () => {
            const states = ['all', 'text', 'voice', 'video'];
            const currentIndex = states.indexOf(currentWishesTypeFilter);
            const nextIndex = (currentIndex + 1) % states.length;
            currentWishesTypeFilter = states[nextIndex];

            updateWishesUI();
            applyWishesFeedFilters();
        });
    }

    // --- Fullscreen Vertical Wish Viewer Logic ---
    function openWishesFullscreenViewer(index) {
        if (filteredWishes.length === 0) return;
        currentFsWishIndex = index;

        if (wishesFsOverlay) {
            wishesFsOverlay.style.display = 'flex';
            wishesFsOverlay.classList.add('active');
        }

        renderFsWish();
    }

    function closeWishesFullscreenViewer() {
        stopWishFsAudio();
        stopWishFsVideo();
        if (wishesFsOverlay) {
            wishesFsOverlay.classList.remove('active');
            setTimeout(() => {
                if (!wishesFsOverlay.classList.contains('active')) {
                    wishesFsOverlay.style.display = 'none';
                }
            }, 300);
        }
    }

    async function markWishAsRead(wishId) {
        const wish = allWishes.find(w => w.id === wishId);
        if (wish && !wish.is_read) {
            wish.is_read = true;
            updateWishesUI();
            applyWishesFeedFilters();

            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    await fetch(`${API_URL}/wishes/${wishId}/`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ is_read: true })
                    });
                } catch(e) {
                    console.error('Błąd oznaczania jako przeczytane:', e);
                }
            }
        }
    }

    function renderFsWish() {
        stopWishFsAudio();
        stopWishFsVideo();

        if (filteredWishes.length === 0) {
            closeWishesFullscreenViewer();
            return;
        }

        const wish = filteredWishes[currentFsWishIndex];

        // Mark as read immediately when viewed
        markWishAsRead(wish.id);

        if (wishesFsCounter) wishesFsCounter.textContent = `${currentFsWishIndex + 1} z ${filteredWishes.length}`;

        if (wishesFsGuestName) wishesFsGuestName.textContent = wish.guest_name || 'Gość';
        if (wishesFsAvatar) {
            wishesFsAvatar.src = wish.guest_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(wish.guest_name, ''))}&background=EAE0D5&color=000`;
        }
        
        if (wishesFsRelationship) {
            updateRoleBadge('wishes-fs-relationship', wish.guest_role, wish.relationship);
        }

        if (wishesFsTime && wish.created_at) {
            try {
                const date = new Date(wish.created_at);
                const now = new Date();
                const diffMinutes = Math.floor((now - date) / (1000 * 60));
                if (diffMinutes < 60) {
                    wishesFsTime.textContent = `${Math.max(1, diffMinutes)} min temu`;
                } else if (diffMinutes < 24 * 60) {
                    wishesFsTime.textContent = `${Math.floor(diffMinutes / 60)} godz. temu`;
                } else {
                    wishesFsTime.textContent = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                }
            } catch(e) {
                wishesFsTime.textContent = '';
            }
        }

        const wishesFsBodyContainer = document.getElementById('wishes-fs-body-container');
        const wishesFsMuteBtn = document.getElementById('wishes-fs-mute-btn');
        const wishesFsMuteIcon = document.getElementById('wishes-fs-mute-icon');

        if (wish.video_url) {
            if (wishesFsBodyContainer) wishesFsBodyContainer.style.display = 'none';
            if (wishesFsVideoPlayer) {
                wishesFsVideoPlayer.src = wish.video_url;
                wishesFsVideoPlayer.style.display = 'block';
                wishesFsVideoPlayer.playbackRate = 1.0;
                wishesFsVideoPlayer.play().catch(() => {});
            }
            if (wishesFsMuteBtn) {
                wishesFsMuteBtn.style.display = 'flex';
                if (wishesFsMuteIcon) wishesFsMuteIcon.className = (wishesFsVideoPlayer && wishesFsVideoPlayer.muted) ? 'ph ph-speaker-slash' : 'ph ph-speaker-high';
            }
        } else {
            if (wishesFsVideoPlayer) {
                wishesFsVideoPlayer.style.display = 'none';
                wishesFsVideoPlayer.pause();
            }
            if (wishesFsBodyContainer) wishesFsBodyContainer.style.display = 'flex';

            // Square box pastel theme styling
            const wishesFsSquareBox = document.getElementById('wishes-fs-square-box');
            const pastelIndex = wish.id ? (wish.id % 6) : (currentFsWishIndex % 6);
            if (wishesFsSquareBox) {
                wishesFsSquareBox.className = `wishes-fs-square-box pastel-${pastelIndex}`;
            }

            // Text body
            if (wish.text && wish.text.trim() !== '') {
                if (wishesFsTextBox) wishesFsTextBox.style.display = 'block';
                if (wishesFsTextBody) wishesFsTextBody.textContent = wish.text;
            } else {
                if (wishesFsTextBox) wishesFsTextBox.style.display = 'none';
            }

            // Voice body
            const wishesFsAudioBox = document.getElementById('wishes-fs-audio-box');
            const wishesFsAudioPlayer = document.getElementById('wishes-fs-audio-player');
            const wishesFsAudioProgress = document.getElementById('wishes-fs-audio-progress');
            const wishesFsAudioTimer = document.getElementById('wishes-fs-audio-timer');
            const wishesFsPlayIcon = document.getElementById('wishes-fs-play-icon');

            if (wish.audio_url) {
                if (wishesFsAudioBox) wishesFsAudioBox.style.display = 'flex';
                if (wishesFsAudioPlayer) {
                    wishesFsAudioPlayer.src = wish.audio_url;
                    wishesFsAudioPlayer.load();
                    wishesFsAudioPlayer.currentTime = 0;

                    // Auto-play voice message
                    wishesFsAudioPlayer.play().then(() => {
                        if (wishesFsPlayIcon) wishesFsPlayIcon.className = 'ph-fill ph-pause';
                    }).catch(() => {
                        if (wishesFsPlayIcon) wishesFsPlayIcon.className = 'ph-fill ph-play';
                    });

                    wishesFsAudioPlayer.ontimeupdate = () => {
                        if (wishesFsAudioPlayer.duration) {
                            const pct = (wishesFsAudioPlayer.currentTime / wishesFsAudioPlayer.duration) * 100;
                            if (wishesFsAudioProgress) wishesFsAudioProgress.style.width = `${pct}%`;
                            const mins = String(Math.floor(wishesFsAudioPlayer.currentTime / 60)).padStart(2, '0');
                            const secs = String(Math.floor(wishesFsAudioPlayer.currentTime % 60)).padStart(2, '0');
                            if (wishesFsAudioTimer) wishesFsAudioTimer.textContent = `${mins}:${secs}`;
                        }
                    };

                    wishesFsAudioPlayer.onended = () => {
                        stopWishFsAudio();
                    };
                }
                if (wishesFsAudioProgress) wishesFsAudioProgress.style.width = '0%';
                if (wishesFsAudioTimer) wishesFsAudioTimer.textContent = '00:00';

                if (wishesFsMuteBtn) {
                    wishesFsMuteBtn.style.display = 'flex';
                    if (wishesFsMuteIcon) wishesFsMuteIcon.className = (wishesFsAudioPlayer && wishesFsAudioPlayer.muted) ? 'ph ph-speaker-slash' : 'ph ph-speaker-high';
                }
            } else {
                if (wishesFsAudioBox) wishesFsAudioBox.style.display = 'none';
                if (wishesFsMuteBtn) wishesFsMuteBtn.style.display = 'none';
            }
        }
    }

    function stopWishFsAudio() {
        const wishesFsAudioPlayer = document.getElementById('wishes-fs-audio-player');
        const wishesFsPlayIcon = document.getElementById('wishes-fs-play-icon');
        const wishesFsAudioProgress = document.getElementById('wishes-fs-audio-progress');

        if (wishesFsAudioPlayer) {
            wishesFsAudioPlayer.pause();
            wishesFsAudioPlayer.currentTime = 0;
        }
        if (wishesFsPlayIcon) wishesFsPlayIcon.className = 'ph-fill ph-play';
        if (wishesFsAudioProgress) wishesFsAudioProgress.style.width = '0%';
    }

    function stopWishFsVideo() {
        const wishesFsMuteBtn = document.getElementById('wishes-fs-mute-btn');
        const wishesFsSpeedIndicator = document.getElementById('wishes-fs-speed-indicator');
        const wishesFsPauseIndicator = document.getElementById('wishes-fs-pause-indicator');

        if (wishesFsMuteBtn) wishesFsMuteBtn.style.display = 'none';
        if (wishesFsSpeedIndicator) wishesFsSpeedIndicator.style.display = 'none';
        if (wishesFsPauseIndicator) wishesFsPauseIndicator.style.display = 'none';

        if (wishesFsVideoPlayer) {
            wishesFsVideoPlayer.pause();
            wishesFsVideoPlayer.playbackRate = 1.0;
            wishesFsVideoPlayer.currentTime = 0;
            wishesFsVideoPlayer.removeAttribute('src');
            wishesFsVideoPlayer.load();
        }
    }

    const wishesFsMuteBtn = document.getElementById('wishes-fs-mute-btn');
    const wishesFsMuteIcon = document.getElementById('wishes-fs-mute-icon');
    const wishesFsSpeedIndicator = document.getElementById('wishes-fs-speed-indicator');
    const wishesFsPauseIndicator = document.getElementById('wishes-fs-pause-indicator');

    if (wishesFsMuteBtn) {
        wishesFsMuteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wishesFsAudioPlayerNode = document.getElementById('wishes-fs-audio-player');
            const wishesFsAudioBoxNode = document.getElementById('wishes-fs-audio-box');

            if (wishesFsAudioBoxNode && wishesFsAudioBoxNode.style.display !== 'none' && wishesFsAudioPlayerNode) {
                wishesFsAudioPlayerNode.muted = !wishesFsAudioPlayerNode.muted;
                if (wishesFsMuteIcon) {
                    wishesFsMuteIcon.className = wishesFsAudioPlayerNode.muted ? 'ph ph-speaker-slash' : 'ph ph-speaker-high';
                }
            } else if (wishesFsVideoPlayer && wishesFsVideoPlayer.style.display !== 'none') {
                wishesFsVideoPlayer.muted = !wishesFsVideoPlayer.muted;
                if (wishesFsMuteIcon) {
                    wishesFsMuteIcon.className = wishesFsVideoPlayer.muted ? 'ph ph-speaker-slash' : 'ph ph-speaker-high';
                }
            }
        });
    }

    // Audio Play/Pause Button Delegate Event Listener
    document.addEventListener('click', (e) => {
        const audioPlayBtn = e.target.closest('#wishes-fs-audio-play-btn');
        if (audioPlayBtn) {
            const player = document.getElementById('wishes-fs-audio-player');
            const icon = document.getElementById('wishes-fs-play-icon');
            if (player) {
                if (player.paused) {
                    player.play().then(() => {
                        if (icon) icon.className = 'ph-fill ph-pause';
                    }).catch(err => console.log('Błąd odtwarzania audio:', err));
                } else {
                    player.pause();
                    if (icon) icon.className = 'ph-fill ph-play';
                }
            }
        }
    });

    let wishVideoHoldTimeout = null;
    let isHoldingWishVideo = false;

    function startWishVideoHold(clientX) {
        if (!wishesFsVideoPlayer || !wishesFsVideoBox || wishesFsVideoBox.style.display === 'none') return;
        isHoldingWishVideo = true;

        wishVideoHoldTimeout = setTimeout(() => {
            if (isHoldingWishVideo) {
                const isLeft = clientX < (window.innerWidth / 2);
                if (isLeft) {
                    wishesFsVideoPlayer.playbackRate = 2.0;
                    if (wishesFsSpeedIndicator) wishesFsSpeedIndicator.style.display = 'flex';
                } else {
                    wishesFsVideoPlayer.pause();
                    if (wishesFsPauseIndicator) wishesFsPauseIndicator.style.display = 'flex';
                }
            }
        }, 150);
    }

    function endWishVideoHold() {
        isHoldingWishVideo = false;
        clearTimeout(wishVideoHoldTimeout);

        if (wishesFsSpeedIndicator) wishesFsSpeedIndicator.style.display = 'none';
        if (wishesFsPauseIndicator) wishesFsPauseIndicator.style.display = 'none';

        if (wishesFsVideoPlayer && wishesFsVideoBox && wishesFsVideoBox.style.display !== 'none') {
            wishesFsVideoPlayer.playbackRate = 1.0;
            if (wishesFsVideoPlayer.paused) {
                wishesFsVideoPlayer.play().catch(() => {});
            }
        }
    }

    if (wishesFsAudioPlayBtn && wishesFsAudioPlayer) {
        wishesFsAudioPlayBtn.addEventListener('click', () => {
            if (wishesFsAudioPlayer.paused) {
                wishesFsAudioPlayer.play();
                if (wishesFsPlayIcon) wishesFsPlayIcon.className = 'ph-fill ph-pause';
            } else {
                wishesFsAudioPlayer.pause();
                if (wishesFsPlayIcon) wishesFsPlayIcon.className = 'ph-fill ph-play';
            }
        });

        wishesFsAudioPlayer.addEventListener('timeupdate', () => {
            if (wishesFsAudioPlayer.duration) {
                const pct = (wishesFsAudioPlayer.currentTime / wishesFsAudioPlayer.duration) * 100;
                if (wishesFsAudioProgress) wishesFsAudioProgress.style.width = `${pct}%`;
                const mins = String(Math.floor(wishesFsAudioPlayer.currentTime / 60)).padStart(2, '0');
                const secs = String(Math.floor(wishesFsAudioPlayer.currentTime % 60)).padStart(2, '0');
                if (wishesFsAudioTimer) wishesFsAudioTimer.textContent = `${mins}:${secs}`;
            }
        });

        wishesFsAudioPlayer.addEventListener('ended', stopWishFsAudio);
    }

    function navigateFsWish(direction) {
        if (filteredWishes.length === 0) return;

        if (direction === 'up' || direction === 'prev') {
            currentFsWishIndex = (currentFsWishIndex - 1 + filteredWishes.length) % filteredWishes.length;
        } else {
            currentFsWishIndex = (currentFsWishIndex + 1) % filteredWishes.length;
        }

        renderFsWish();
    }

    if (wishesFsClose) wishesFsClose.addEventListener('click', closeWishesFullscreenViewer);

    // Real-time 1:1 Mobile Horizontal Slide & Drag Navigation (Instagram Stories / Reels style)
    let isDraggingWish = false;
    let dragStartX = 0;
    let dragCurrentX = 0;
    let dragDeltaX = 0;
    let dragStartTime = 0;

    if (wishesFsOverlay && wishesFsCard) {
        function onDragStart(clientX) {
            startWishVideoHold(clientX);
            if (filteredWishes.length <= 1) return;
            isDraggingWish = true;
            dragStartX = clientX;
            dragCurrentX = clientX;
            dragDeltaX = 0;
            dragStartTime = Date.now();
            wishesFsCard.style.transition = 'none';
        }

        function onDragMove(clientX, e) {
            if (!isDraggingWish) return;
            dragCurrentX = clientX;
            dragDeltaX = dragCurrentX - dragStartX;

            const scale = Math.max(0.93, 1 - Math.abs(dragDeltaX) / 1600);
            const opacity = Math.max(0.35, 1 - Math.abs(dragDeltaX) / 500);

            wishesFsCard.style.transform = `translateX(${dragDeltaX}px) scale(${scale})`;
            wishesFsCard.style.opacity = `${opacity}`;

            if (e && e.cancelable) {
                e.preventDefault();
            }
        }

        function onDragEnd() {
            endWishVideoHold();
            if (!isDraggingWish) return;
            isDraggingWish = false;

            const duration = Date.now() - dragStartTime;
            const velocity = Math.abs(dragDeltaX) / Math.max(duration, 1);
            const threshold = 65;
            const fastFlick = velocity > 0.3 && Math.abs(dragDeltaX) > 20;

            if (dragDeltaX < -threshold || (dragDeltaX < 0 && fastFlick)) {
                // Swipe LEFT -> Next wish
                wishesFsCard.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease';
                wishesFsCard.style.transform = 'translateX(-100vw)';
                wishesFsCard.style.opacity = '0';

                setTimeout(() => {
                    navigateFsWish('down');
                    wishesFsCard.style.transition = 'none';
                    wishesFsCard.style.transform = 'translateX(60vw)';
                    wishesFsCard.style.opacity = '0';

                    requestAnimationFrame(() => {
                        wishesFsCard.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';
                        wishesFsCard.style.transform = 'translateX(0)';
                        wishesFsCard.style.opacity = '1';
                    });
                }, 220);

            } else if (dragDeltaX > threshold || (dragDeltaX > 0 && fastFlick)) {
                // Swipe RIGHT -> Prev wish
                wishesFsCard.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease';
                wishesFsCard.style.transform = 'translateX(100vw)';
                wishesFsCard.style.opacity = '0';

                setTimeout(() => {
                    navigateFsWish('up');
                    wishesFsCard.style.transition = 'none';
                    wishesFsCard.style.transform = 'translateX(-60vw)';
                    wishesFsCard.style.opacity = '0';

                    requestAnimationFrame(() => {
                        wishesFsCard.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';
                        wishesFsCard.style.transform = 'translateX(0)';
                        wishesFsCard.style.opacity = '1';
                    });
                }, 220);

            } else {
                // Spring back
                wishesFsCard.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';
                wishesFsCard.style.transform = 'translateX(0)';
                wishesFsCard.style.opacity = '1';
            }
        }

        // Touch Listeners
        wishesFsCard.addEventListener('touchstart', (e) => {
            if (e.target.closest('button, a, input, audio, .wishes-fs-audio-player-box')) return;
            onDragStart(e.touches[0].clientX);
        }, { passive: true });

        wishesFsCard.addEventListener('touchmove', (e) => {
            if (!isDraggingWish) return;
            onDragMove(e.touches[0].clientX, e);
        }, { passive: false });

        wishesFsCard.addEventListener('touchend', () => {
            onDragEnd();
        }, { passive: true });

        wishesFsCard.addEventListener('touchcancel', () => {
            onDragEnd();
        }, { passive: true });

        // Mouse Drag Listeners (Desktop)
        wishesFsCard.addEventListener('mousedown', (e) => {
            if (e.target.closest('button, a, input, audio, .wishes-fs-audio-player-box')) return;
            onDragStart(e.clientX);
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDraggingWish) return;
            onDragMove(e.clientX, e);
        });

        window.addEventListener('mouseup', () => {
            if (isDraggingWish) onDragEnd();
        });

        // Mouse wheel navigation
        wishesFsOverlay.addEventListener('wheel', (e) => {
            if (e.deltaY > 30 || e.deltaX > 30) {
                navigateFsWish('down');
            } else if (e.deltaY < -30 || e.deltaX < -30) {
                navigateFsWish('up');
            }
        }, { passive: true });
    }

    document.addEventListener('keydown', (e) => {
        if (wishesFsOverlay && wishesFsOverlay.classList.contains('active')) {
            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                navigateFsWish('up');
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                navigateFsWish('down');
            } else if (e.key === 'Escape') {
                closeWishesFullscreenViewer();
            }
        }
    });

    if (wishesFsDeleteBtn) {
        wishesFsDeleteBtn.addEventListener('click', () => {
            if (filteredWishes.length === 0) return;
            const wish = filteredWishes[currentFsWishIndex];
            customConfirm(async () => {
                const token = localStorage.getItem('access_token');
                try {
                    const res = await fetch(`${API_URL}/wishes/${wish.id}/`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        showToast('Życzenie usunięte.');
                        allWishes = allWishes.filter(w => w.id !== wish.id);
                        updateWishesUI();
                        applyWishesFeedFilters();

                        if (filteredWishes.length > 0) {
                            currentFsWishIndex = currentFsWishIndex % filteredWishes.length;
                            renderFsWish();
                        } else {
                            closeWishesFullscreenViewer();
                        }
                    }
                } catch(e) {
                    console.error(e);
                }
            });
        });
    }

    if (wishesFsThankBtn) {
        wishesFsThankBtn.addEventListener('click', (e) => {
            if (filteredWishes.length === 0) return;
            const wish = filteredWishes[currentFsWishIndex];
            const rect = wishesFsThankBtn.getBoundingClientRect();
            for (let i = 0; i < 5; i++) {
                createFloatingHeart(rect.left + rect.width/2, rect.top);
            }
            showToast(`Wysłano podziękowanie i serduszko dla ${wish.guest_name}! ❤️`);
        });
    }

    // --- LUSION.CO CREATIVE STUDIO GSAP SCROLLTRIGGER ENGINE ("PARA MŁODA") ---
    let currentStorySceneIndex = 0;
    let masterScrollTimeline = null;

    function activateScene(index) {
        currentStorySceneIndex = index;
        const wrapper = document.getElementById('scrolly-story-wrapper');
        if (!wrapper) return;

        const scenes = wrapper.querySelectorAll('.scrolly-scene');
        scenes.forEach((sc, i) => {
            if (i === index) {
                sc.classList.add('active');
                sc.style.pointerEvents = 'auto';
                sc.style.zIndex = '12';
            } else {
                sc.classList.remove('active');
                sc.style.pointerEvents = 'none';
                sc.style.zIndex = '5';
            }
        });

        updateActiveSceneNav(index);
    }

    function updateActiveSceneNav(index) {
        const wrapper = document.getElementById('scrolly-story-wrapper');
        if (!wrapper) return;
        const dots = wrapper.querySelectorAll('.timeline-dot-item');

        dots.forEach((dot, i) => {
            if (i === index) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    window.goToStoryScene = function(targetIndex) {
        const wrapper = document.getElementById('scrolly-story-wrapper');
        if (!wrapper) return;
        const scenes = wrapper.querySelectorAll('.scrolly-scene');
        if (!scenes.length) return;

        const validIndex = Math.max(0, Math.min(scenes.length - 1, targetIndex));

        if (masterScrollTimeline && masterScrollTimeline.scrollTrigger) {
            const st = masterScrollTimeline.scrollTrigger;
            const progress = validIndex / (scenes.length - 1);
            const targetScroll = st.start + progress * (st.end - st.start);

            window.scrollTo({ top: targetScroll, behavior: 'smooth' });
        } else {
            scenes.forEach((sc, i) => {
                sc.style.opacity = i === validIndex ? '1' : '0';
            });
            activateScene(validIndex);
        }
    };

    function initCardTiltEffect() {
        const tiltCards = document.querySelectorAll('.lusion-tilt-card');

        tiltCards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = ((y - centerY) / centerY) * -10;
                const rotateY = ((x - centerX) / centerX) * 10;

                card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
                card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            });
        });
    }

    function initLusionParticles() {
        const container = document.getElementById('scrolly-particles');
        if (!container) return;

        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = (canvas.width = container.clientWidth || window.innerWidth);
        let height = (canvas.height = container.clientHeight || window.innerHeight);

        window.addEventListener('resize', () => {
            width = canvas.width = container.clientWidth || window.innerWidth;
            height = canvas.height = container.clientHeight || window.innerHeight;
        });

        const particleCount = window.innerWidth < 768 ? 35 : 75;
        const particles = [];
        const colors = ['rgba(244, 63, 94, ', 'rgba(251, 191, 36, ', 'rgba(99, 102, 241, '];

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 2.5 + 1,
                colorPrefix: colors[Math.floor(Math.random() * colors.length)],
                alpha: Math.random() * 0.5 + 0.2,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                pulseSpeed: Math.random() * 0.02 + 0.01
            });
        }

        let mouseX = width / 2;
        let mouseY = height / 2;

        window.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        }, { passive: true });

        function animate() {
            ctx.clearRect(0, 0, width, height);

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;

                const dx = mouseX - p.x;
                const dy = mouseY - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 180) {
                    const angle = Math.atan2(dy, dx);
                    const force = (180 - dist) / 180;
                    p.x -= Math.cos(angle) * force * 1.2;
                    p.y -= Math.sin(angle) * force * 1.2;
                }

                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                p.alpha += Math.sin(Date.now() * p.pulseSpeed) * 0.005;
                const currentAlpha = Math.max(0.1, Math.min(0.8, p.alpha));

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.colorPrefix + currentAlpha + ')';
                ctx.shadowBlur = 12;
                ctx.shadowColor = p.colorPrefix + '0.8)';
                ctx.fill();
            });

            requestAnimationFrame(animate);
        }

        animate();
    }

    function initLusionScrollytelling() {
        const wrapper = document.getElementById('scrolly-story-wrapper');
        if (!wrapper) return;

        const scenes = wrapper.querySelectorAll('.scrolly-scene');
        const dots = wrapper.querySelectorAll('.timeline-dot-item');
        if (!scenes.length) return;

        initCardTiltEffect();
        initLusionParticles();

        if (typeof gsap === 'undefined') {
            activateScene(0);
            return;
        }

        // --- Build a standalone GSAP timeline (no ScrollTrigger, no pin) ---
        masterScrollTimeline = gsap.timeline({ paused: true });

        // Initial state
        scenes.forEach((sc, i) => {
            gsap.set(sc, {
                opacity: i === 0 ? 1 : 0,
                pointerEvents: i === 0 ? 'auto' : 'none',
                scale: i === 0 ? 1 : 0.9,
                filter: i === 0 ? 'blur(0px)' : 'blur(8px)',
                y: i === 0 ? 0 : 30
            });
        });

        // Scene 0 entrance
        gsap.fromTo('.part-bride',
            { x: -100, opacity: 0, rotate: -6, filter: 'blur(10px)' },
            { x: 0, opacity: 1, rotate: 0, filter: 'blur(0px)', duration: 0.8 }
        );
        gsap.fromTo('.part-groom',
            { x: 100, opacity: 0, rotate: 6, filter: 'blur(10px)' },
            { x: 0, opacity: 1, rotate: 0, filter: 'blur(0px)', duration: 0.8 }
        );

        // Build sequential transitions with HOLD periods
        for (let i = 0; i < scenes.length; i++) {
            masterScrollTimeline.to({}, { duration: 1.2 }); // HOLD

            if (i < scenes.length - 1) {
                const currentScene = scenes[i];
                const nextScene = scenes[i + 1];

                masterScrollTimeline.to(currentScene, {
                    opacity: 0, scale: 0.9, y: -30,
                    filter: 'blur(8px)', pointerEvents: 'none',
                    duration: 0.8, ease: 'power2.inOut'
                });
                masterScrollTimeline.to(nextScene, {
                    opacity: 1, scale: 1, y: 0,
                    filter: 'blur(0px)', pointerEvents: 'auto',
                    duration: 0.8, ease: 'power2.inOut'
                }, "<");

                if (i === 0) {
                    masterScrollTimeline
                        .fromTo('#card-zuzia',
                            { x: '-140%', rotate: -15, scale: 0.8, opacity: 0 },
                            { x: '0%', rotate: 0, scale: 1, opacity: 1, duration: 1, ease: "power2.out" }, "<")
                        .fromTo('#card-kamil',
                            { x: '140%', rotate: 15, scale: 0.8, opacity: 0 },
                            { x: '0%', rotate: 0, scale: 1, opacity: 1, duration: 1, ease: "power2.out" }, "<")
                        .fromTo('#scene-1 .lusion-bio-text',
                            { filter: 'blur(8px)', opacity: 0, y: 15 },
                            { filter: 'blur(0px)', opacity: 1, y: 0, duration: 0.6, stagger: 0.15 }, "-=0.4")
                        .fromTo('#scene-1 .ptag',
                            { scale: 0, opacity: 0 },
                            { scale: 1, opacity: 1, duration: 0.5, stagger: 0.04, ease: "back.out(1.8)" }, "-=0.3")
                        .to('#bg-monogram', { y: -180, scale: 1.3, opacity: 0.08, duration: 1 }, "<")
                        .to('.shape-1', { y: -260, rotate: 180, duration: 1.5 }, "<")
                        .to('.shape-2', { y: -360, x: 120, rotate: -90, duration: 1.5 }, "<");
                } else {
                    const imgFrame = nextScene.querySelector('.story-img-frame');
                    const caption = nextScene.querySelector('.story-caption-text');
                    if (imgFrame) {
                        masterScrollTimeline.fromTo(imgFrame,
                            { scale: 0.88, rotate: (i % 2 === 0 ? -4 : 4) },
                            { scale: 1, rotate: 0, duration: 0.8, ease: "power2.out" }, "<");
                    }
                    if (caption) {
                        masterScrollTimeline.fromTo(caption,
                            { opacity: 0, filter: 'blur(6px)', y: 15 },
                            { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.6 }, "-=0.4");
                    }
                }
            }
        }

        const totalDuration = masterScrollTimeline.totalDuration();

        // --- Scroll / Touch interception ---
        let isInsideSection = false;
        let currentProgress = 0;
        let targetProgress = 0;
        let rafId = null;
        let touchStartY = 0;

        // Detect whether the wrapper is in the viewport center
        function checkIfActive() {
            const rect = wrapper.getBoundingClientRect();
            return rect.top <= window.innerHeight * 0.2 && rect.bottom >= window.innerHeight * 0.5;
        }

        function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

        function renderProgress() {
            currentProgress += (targetProgress - currentProgress) * 0.1;
            masterScrollTimeline.progress(currentProgress);

            const idx = Math.min(
                Math.floor(currentProgress * scenes.length),
                scenes.length - 1
            );
            updateActiveSceneNav(idx);

            if (Math.abs(targetProgress - currentProgress) > 0.0003) {
                rafId = requestAnimationFrame(renderProgress);
            } else {
                currentProgress = targetProgress;
                masterScrollTimeline.progress(currentProgress);
                rafId = null;
            }
        }

        function nudgeProgress(delta) {
            // delta > 0 => forward, delta < 0 => backward
            const step = delta > 0 ? 0.04 : -0.04;
            targetProgress = clamp(targetProgress + step, 0, 1);

            if (targetProgress <= 0 && delta < 0) {
                // Allow page to scroll up when at start
                return false;
            }
            if (targetProgress >= 1 && delta > 0) {
                // Allow page to scroll down when at end
                return false;
            }

            if (!rafId) rafId = requestAnimationFrame(renderProgress);
            return true;
        }

        // Wheel handler
        function onWheel(e) {
            isInsideSection = checkIfActive();
            if (!isInsideSection) return;

            // At start scrolling up: let page scroll up
            if (targetProgress <= 0 && e.deltaY < 0) return;
            // At end scrolling down: let page scroll down
            if (targetProgress >= 1 && e.deltaY > 0) return;

            e.preventDefault();
            e.stopPropagation();
            nudgeProgress(e.deltaY);
        }

        // Touch handler
        function onTouchStart(e) {
            touchStartY = e.touches[0].clientY;
        }

        function onTouchMove(e) {
            isInsideSection = checkIfActive();
            if (!isInsideSection) return;

            const deltaY = touchStartY - e.touches[0].clientY;
            touchStartY = e.touches[0].clientY;

            if (targetProgress <= 0 && deltaY < 0) return;
            if (targetProgress >= 1 && deltaY > 0) return;

            if (Math.abs(deltaY) > 2) {
                e.preventDefault();
                nudgeProgress(deltaY);
            }
        }

        // Scroll into view once, then lock
        function onWindowScroll() {
            const rect = wrapper.getBoundingClientRect();
            if (rect.top <= 0 && rect.bottom > 0 && targetProgress < 1) {
                // Wrapper is at top of viewport - lock scroll position
                window.scrollTo({ top: wrapper.offsetTop });
            }
        }

        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('scroll', onWindowScroll, { passive: true });

        // Timeline Dot Clicks
        dots.forEach((dot) => {
            dot.addEventListener('click', () => {
                const targetIndex = parseInt(dot.getAttribute('data-scene'), 10);
                if (!isNaN(targetIndex)) {
                    targetProgress = clamp(targetIndex / (scenes.length - 1), 0, 1);
                    if (!rafId) rafId = requestAnimationFrame(renderProgress);
                }
            });
        });

        // Global goToStoryScene override for this mode
        window.goToStoryScene = function(targetIndex) {
            const validIndex = Math.max(0, Math.min(scenes.length - 1, targetIndex));
            targetProgress = clamp(validIndex / (scenes.length - 1), 0, 1);
            if (!rafId) rafId = requestAnimationFrame(renderProgress);
        };

        // Initialize Scene 0
        activateScene(0);
    }

    initLusionScrollytelling();

    // ==========================================
    // WEDDING CONFIG & ADMIN PANEL IMPLEMENTATION
    // ==========================================
    let witnessPermissions = {
        can_delete_photos: false,
        can_delete_videos: false,
        can_see_wishes: true
    };

    let coupleStatusTexts = [
        { text: "Do zobaczenia na naszym weselu" }
    ];
    let weddingConfig = {};

    async function loadWeddingConfig() {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        try {
            const res = await fetch(`${API_URL}/wedding-config/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const config = await res.json();
                weddingConfig = config;
                
                // 1. Witness permissions
                if (config.witness_permissions) {
                    witnessPermissions = { ...witnessPermissions, ...config.witness_permissions };
                }

                // Wishes enabled/locked UI handling
                const openWishesBtn = document.getElementById('open-direct-msg-btn');
                if (openWishesBtn) {
                    if (config.wishes_enabled === false) {
                        openWishesBtn.style.display = 'none';
                    } else {
                        openWishesBtn.style.display = 'inline-flex';
                        if (config.wishes_locked === true) {
                            openWishesBtn.disabled = false; // Musi być klikalny, by wywołać toast
                            openWishesBtn.dataset.locked = 'true';
                            openWishesBtn.innerHTML = `<i class="ph-fill ph-chat-circle-dots"></i> Złóż życzenia`;
                            openWishesBtn.style.opacity = '0.5';
                            openWishesBtn.style.background = '#888';
                        } else {
                            openWishesBtn.disabled = false;
                            openWishesBtn.dataset.locked = 'false';
                            openWishesBtn.innerHTML = `<i class="ph-fill ph-chat-circle-dots"></i> Złóż życzenia`;
                            openWishesBtn.style.opacity = '1';
                            openWishesBtn.style.background = '';
                        }
                    }
                }

                // Update wishes panel card visibility for witness if they have permission
                let user = null;
                try { user = JSON.parse(localStorage.getItem('user')); } catch(e){}
                if (user) {
                    const wishesCard = document.getElementById('wishes-panel-card');
                    if (wishesCard) {
                        if (config.wishes_enabled !== false && (user.role === 'para_mloda' || (user.role === 'swiadek' && witnessPermissions.can_see_wishes) || user.is_staff)) {
                            wishesCard.style.display = 'flex';
                        } else {
                            wishesCard.style.display = 'none';
                        }
                    }
                }

                // 2. Status texts (Couple section)
                if (config.status_texts && config.status_texts.length > 0) {
                    coupleStatusTexts = config.status_texts;
                    updateCoupleStatusTextCycling();
                }

                // 3. Info places
                if (config.info_places && config.info_places.length > 0) {
                    renderInfoPlaces(config.info_places, config);
                } else if (config.phone_groom || config.phone_bride) {
                    renderInfoPlaces([], config);
                }

                // 4. Schedule events
                if (config.schedule_events && config.schedule_events.length > 0) {
                    SCHEDULE_EVENTS = config.schedule_events;
                    renderHeaderSchedule();
                }

                // 5. Couple image
                if (config.couple_image) {
                    const coupleHeroBg = document.querySelector('.couple-hero-bg');
                    if (coupleHeroBg) {
                        coupleHeroBg.style.backgroundImage = `url('${config.couple_image}')`;
                    }
                }

                // 6. Header mode settings
                if (config.header_mode_settings) {
                    applyHeaderModeSettings(config.header_mode_settings);
                }
            }
        } catch(e) {
            console.error("Błąd ładowania konfiguracji:", e);
        }
    }

    // Function to render Places in the Info Tab dynamically
    function renderInfoPlaces(places, config = null) {
        const container = document.getElementById('info-places-container');
        if (!container) return;
        container.innerHTML = '';

        // Remove any existing contacts wrapper first to avoid duplicates on re-render
        const oldWrapper = document.getElementById('info-contacts-wrapper-el');
        if (oldWrapper) {
            oldWrapper.remove();
        }

        places.forEach(place => {
            const card = document.createElement('div');
            const width = place.width || '100';
            
            let hasRows = false;
            let rowsHtml = '';
            if (place.rows && Array.isArray(place.rows)) {
                place.rows.forEach(row => {
                    if (row.text) {
                        rowsHtml += `<p class="place-row"><i class="${row.icon || 'ph ph-info'}"></i> ${row.text}</p>`;
                        hasRows = true;
                    }
                });
            } else {
                if (place.time) {
                    rowsHtml += `<p class="place-time"><i class="ph ph-clock"></i> ${place.time}</p>`;
                    hasRows = true;
                }
                if (place.address) {
                    rowsHtml += `<p class="place-address"><i class="ph ph-map-pin"></i> ${place.address}</p>`;
                    hasRows = true;
                }
            }

            card.className = `place-card w-${width}`;

            card.innerHTML = `
                <div class="place-card-main">
                    <div class="place-icon-wrapper"><i class="ph-fill ${place.icon || 'ph-map-pin'}"></i></div>
                    <div class="place-details">
                        <h3>${place.title}</h3>
                        ${rowsHtml}
                    </div>
                </div>
                ${place.nav_url ? `<a href="${place.nav_url}" target="_blank" class="place-nav-btn"><i class="ph-bold ph-navigation-arrow"></i> ${place.nav_text || 'Nawiguj do Miejsca'}</a>` : ''}
            `;
            container.appendChild(card);
        });

        // Render permanent contact buttons if configured in a dedicated section
        if (config && (config.phone_groom || config.phone_bride)) {
            const wrapper = document.createElement('div');
            wrapper.className = 'info-contacts-wrapper';
            wrapper.id = 'info-contacts-wrapper-el';
            
            wrapper.innerHTML = `
                <div class="info-contacts-header">Kontakt do pary młodej</div>
                <div class="info-contacts-container">
                    ${config.phone_groom ? `
                        <div class="contact-card">
                            <div class="contact-card-main">
                                <div class="contact-icon-wrapper"><i class="ph-fill ph-phone"></i></div>
                                <div class="contact-details">
                                    <h3>Pan Młody</h3>
                                    <p class="contact-phone"><i class="ph ph-device-mobile"></i> ${config.phone_groom}</p>
                                </div>
                            </div>
                            <a href="tel:${config.phone_groom.replace(/\s+/g, '')}" class="contact-call-btn"><i class="ph-bold ph-phone"></i> Zadzwoń</a>
                        </div>
                    ` : ''}
                    ${config.phone_bride ? `
                        <div class="contact-card">
                            <div class="contact-card-main">
                                <div class="contact-icon-wrapper"><i class="ph-fill ph-phone"></i></div>
                                <div class="contact-details">
                                    <h3>Panna Młoda</h3>
                                    <p class="contact-phone"><i class="ph ph-device-mobile"></i> ${config.phone_bride}</p>
                                </div>
                            </div>
                            <a href="tel:${config.phone_bride.replace(/\s+/g, '')}" class="contact-call-btn"><i class="ph-bold ph-phone"></i> Zadzwoń</a>
                        </div>
                    ` : ''}
                </div>
            `;
            container.parentNode.appendChild(wrapper);
        }
    }

    // Couple status text cycling logic
    let statusTextIndex = 0;
    let statusInterval = null;

    function updateCoupleStatusTextCycling() {
        const textEl = document.getElementById('couple-status-text');
        const emojiEl = document.getElementById('couple-status-emoji');
        if (!textEl || coupleStatusTexts.length === 0) return;

        if (statusInterval) clearInterval(statusInterval);

        // Filters status texts that should be active based on current time (if specified)
        const getActiveStatusTexts = () => {
            const now = new Date();
            return coupleStatusTexts.filter(item => {
                if (!item.switch_at) return true;
                return now >= new Date(item.switch_at);
            });
        };

        const cycleText = () => {
            const activeTexts = getActiveStatusTexts();
            if (activeTexts.length === 0) return;
            statusTextIndex = (statusTextIndex + 1) % activeTexts.length;
            const currentItem = activeTexts[statusTextIndex];
            textEl.textContent = currentItem.text;
            if (emojiEl) {
                if (currentItem.emoji) {
                    emojiEl.textContent = currentItem.emoji;
                    emojiEl.style.display = 'block';
                } else {
                    emojiEl.style.display = 'none';
                }
            }
        };

        const activeTexts = getActiveStatusTexts();
        if (activeTexts.length > 0) {
            const currentItem = activeTexts[0];
            textEl.textContent = currentItem.text;
            if (emojiEl) {
                if (currentItem.emoji) {
                    emojiEl.textContent = currentItem.emoji;
                    emojiEl.style.display = 'block';
                } else {
                    emojiEl.style.display = 'none';
                }
            }
            if (activeTexts.length > 1) {
                statusInterval = setInterval(cycleText, 5000);
            }
        }
    }

    // Apply header timing and mode settings
    function applyHeaderModeSettings(settings) {
        const header = document.getElementById('header-countdown-box');
        if (!header) return;

        if (settings.header_enabled === false) {
            header.style.display = 'none';
            return;
        }
        header.style.display = 'block';

        // Check date timings to switch mode dynamically
        const now = new Date();
        const countdownEnd = settings.countdown_end ? new Date(settings.countdown_end) : null;
        const scheduleStart = settings.schedule_start ? new Date(settings.schedule_start) : null;
        const thankYouStart = settings.thank_you_start ? new Date(settings.thank_you_start) : null;

        // Custom time-based display switching logic for header widgets
        const countdownLabel = document.querySelector('.header-countdown-label');
        const countdownTimer = document.querySelector('.header-countdown-timer');
        const scheduleWrapper = document.querySelector('.header-schedule-wrapper');
        const postWeddingBox = document.querySelector('.post-wedding-box');

        // Reset all displays
        if (countdownLabel) countdownLabel.style.display = 'none';
        if (countdownTimer) countdownTimer.style.display = 'none';
        if (scheduleWrapper) scheduleWrapper.style.display = 'none';
        if (postWeddingBox) postWeddingBox.style.display = 'none';

        if (thankYouStart && now >= thankYouStart) {
            if (postWeddingBox) postWeddingBox.style.display = 'flex';
        } else if (scheduleStart && now >= scheduleStart) {
            if (scheduleWrapper) scheduleWrapper.style.display = 'block';
        } else {
            if (countdownLabel) countdownLabel.style.display = 'block';
            if (countdownTimer) countdownTimer.style.display = 'flex';
        }
    }

    // --- ADMIN PANEL EVENTS & CRUD IMPLEMENTATION ---
    const adminPanelCard = document.getElementById('admin-panel-card');
    if (adminPanelCard) {
        adminPanelCard.addEventListener('click', () => {
            window.location.href = 'admin.html';
        });
    }

    // --- ENFORCE WITNESS PERMISSIONS ---
    // Modify general checks to utilize loaded configurations
    // Check if the user is allowed to delete photo based on witness permission config
    window.canCurrentUserDeletePhoto = function() {
        let user = null;
        try { user = JSON.parse(localStorage.getItem('user')); } catch(e){}
        if (!user) return false;
        if (user.role === 'para_mloda' || user.is_staff) return true;
        if (user.role === 'swiadek' && witnessPermissions.can_delete_photos) return true;
        return false;
    };

    window.canCurrentUserDeleteVideo = function() {
        let user = null;
        try { user = JSON.parse(localStorage.getItem('user')); } catch(e){}
        if (!user) return false;
        if (user.role === 'para_mloda' || user.is_staff) return true;
        if (user.role === 'swiadek' && witnessPermissions.can_delete_videos) return true;
        return false;
    };

    // Load configurations on initialization
    loadWeddingConfig();





    // --- DEVELOPER / DEV MODE HINTS ---
    function checkDevMode() {
        const isDev = localStorage.getItem('devMode') === 'true';
        const demoCodes = document.getElementById('demo-codes-container');
        const testToggle = document.getElementById('toggle-header-mode-btn');
        if (demoCodes) demoCodes.style.display = isDev ? 'block' : 'none';
        if (testToggle) testToggle.style.display = isDev ? 'inline-block' : 'none';
    }

    Object.defineProperty(window, 'devMode', {
        get() {
            return localStorage.getItem('devMode') === 'true';
        },
        set(value) {
            if (value) {
                localStorage.setItem('devMode', 'true');
                console.log("Tryb testowy włączony! Przeładowuję stronę...");
                location.reload();
            } else {
                localStorage.removeItem('devMode');
                console.log("Tryb testowy wyłączony! Przeładowuję stronę...");
                location.reload();
            }
        },
        configurable: true
    });

    checkDevMode();
});
