/**
 * Multi-tenant Theme & Organization Helper for Wesele App
 */
const DEFAULT_ORG_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const THEME_PRESETS = {
    classic_gold: {
        name: 'Klasyczny Złoty',
        color_bg: '#f7f3ee',
        color_text: '#111111',
        color_primary: '#2E2E2E',
        color_primary_light: '#424242',
        color_accent: '#c9a84c',
        color_surface: '#FAF6F0',
        color_border: '#EFEFEF',
        color_beige: '#EAE0D5',
        color_beige_light: '#F5F5DC',
        font_heading: "'Playfair Display', serif",
        font_body: "'Inter', sans-serif",
        font_monogram: "'Safira March', serif",
        qr_code_color: '#000000'
    },
    rustic_green: {
        name: 'Rustykalna Zieleń',
        color_bg: '#f4f6f0',
        color_text: '#1b2a1e',
        color_primary: '#2c4c38',
        color_primary_light: '#3e6b4f',
        color_accent: '#b59352',
        color_surface: '#ffffff',
        color_border: '#e1e8dc',
        color_beige: '#e3ebd8',
        color_beige_light: '#f1f5eb',
        font_heading: "'Playfair Display', serif",
        font_body: "'Inter', sans-serif",
        font_monogram: "'Playfair Display', serif",
        qr_code_color: '#2c4c38'
    },
    romantic_rose: {
        name: 'Romantyczny Róż',
        color_bg: '#fdf7f8',
        color_text: '#2e1c23',
        color_primary: '#6b3044',
        color_primary_light: '#8e445d',
        color_accent: '#d4849a',
        color_surface: '#ffffff',
        color_border: '#f5e4e8',
        color_beige: '#fcedf1',
        color_beige_light: '#fff6f8',
        font_heading: "'Playfair Display', serif",
        font_body: "'Inter', sans-serif",
        font_monogram: "'Playfair Display', serif",
        qr_code_color: '#6b3044'
    },
    black_gold: {
        name: 'Czarno-Złoty (Głęboka Czerń & 24K Złoto)',
        color_bg: '#08080a',
        color_text: '#fcfbf7',
        color_primary: '#d4af37',
        color_primary_light: '#f3d982',
        color_accent: '#d4af37',
        color_surface: '#121215',
        color_border: '#352f20',
        color_beige: '#181714',
        color_beige_light: '#24211a',
        font_heading: "'Outfit', 'Plus Jakarta Sans', sans-serif",
        font_body: "'Plus Jakarta Sans', 'Inter', sans-serif",
        font_monogram: "'Outfit', sans-serif",
        qr_code_color: '#d4af37',
        is_dark: true
    },
    modern_dark: {
        name: 'Nowoczesny Ciemny (Onyx & Złoto)',
        color_bg: '#08080a',
        color_text: '#fcfbf7',
        color_primary: '#d4af37',
        color_primary_light: '#f3d982',
        color_accent: '#d4af37',
        color_surface: '#121215',
        color_border: '#352f20',
        color_beige: '#181714',
        color_beige_light: '#24211a',
        font_heading: "'Outfit', 'Plus Jakarta Sans', sans-serif",
        font_body: "'Plus Jakarta Sans', 'Inter', sans-serif",
        font_monogram: "'Outfit', sans-serif",
        qr_code_color: '#d4af37',
        is_dark: true
    },
    cyber_party: {
        name: 'Klubowy Neon (Dark Cyber & Cyan)',
        color_bg: '#090a10',
        color_text: '#f1f5f9',
        color_primary: '#7c3aed',
        color_primary_light: '#8b5cf6',
        color_accent: '#06b6d4',
        color_surface: '#131524',
        color_border: '#242846',
        color_beige: '#1b1e33',
        color_beige_light: '#282d4c',
        font_heading: "'Outfit', 'Plus Jakarta Sans', sans-serif",
        font_body: "'Plus Jakarta Sans', 'Inter', sans-serif",
        font_monogram: "'Outfit', sans-serif",
        qr_code_color: '#06b6d4',
        is_dark: true
    }
};

/**
 * Get display label for a role key based on organization config.
 */
function getRoleLabel(roleKey, defaultText = null) {
    const config = window.__WEDDING_CONFIG || {};
    const rolesConfig = config.roles_config;
    if (rolesConfig && rolesConfig[roleKey] && rolesConfig[roleKey].label) {
        return rolesConfig[roleKey].label;
    }
    const isSingle = !config.partner2_name || !config.partner2_name.trim();
    if (roleKey === 'para_mloda') return isSingle ? 'Jubilat' : 'Para Młoda';
    if (roleKey === 'swiadek') return isSingle ? 'Moderator' : 'Świadek';
    if (roleKey === 'gosc') return 'Gość';
    return defaultText || roleKey;
}
window.getRoleLabel = getRoleLabel;

/**
 * Check if a role is enabled in current organization.
 */
function isRoleEnabled(roleKey) {
    const config = window.__WEDDING_CONFIG || {};
    const rolesConfig = config.roles_config;
    if (rolesConfig && rolesConfig[roleKey] && rolesConfig[roleKey].enabled !== undefined) {
        return Boolean(rolesConfig[roleKey].enabled);
    }
    return true;
}
window.isRoleEnabled = isRoleEnabled;

/**
 * Check if a hex color is dark based on perceived luminance.
 */
function isDarkColor(color) {
    if (!color || typeof color !== 'string') return false;
    let c = color.trim();
    if (c.startsWith('#')) {
        let hex = c.substring(1);
        if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
        if (hex.length === 6) {
            const num = parseInt(hex, 16);
            if (isNaN(num)) return false;
            const r = (num >> 16) & 255;
            const g = (num >> 8) & 255;
            const b = num & 255;
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return lum < 0.5;
        }
    }
    return false;
}

/**
 * Ensure modern Google Fonts are injected if needed by the theme.
 */
function ensureGoogleFontLoaded(fontFamily) {
    if (!fontFamily) return;
    if ((fontFamily.includes('Outfit') || fontFamily.includes('Plus Jakarta Sans')) && !document.getElementById('font-outfit-pjs')) {
        const link = document.createElement('link');
        link.id = 'font-outfit-pjs';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
        document.head.appendChild(link);
    }
}

/**
 * Detect the organization ID from query params, path, or localStorage.
 */
function detectOrganizationId() {
    // 1. Query parameter: ?org=UUID or ?org_id=UUID
    const urlParams = new URLSearchParams(window.location.search);
    const orgFromParam = urlParams.get('org') || urlParams.get('org_id');
    if (orgFromParam) {
        localStorage.setItem('current_org_id', orgFromParam);
        // Clear stale session if user was logged into a different organization (only on public guest pages, never on admin.html)
        try {
            const userRaw = localStorage.getItem('user');
            if (userRaw && !window.location.pathname.includes('admin.html')) {
                const user = JSON.parse(userRaw);
                if (user && user.organization_id && user.organization_id !== orgFromParam) {
                    console.log('[Theme] Switching organization via URL, clearing stale user credentials:', user.organization_id, '->', orgFromParam);
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    localStorage.removeItem('user');
                }
            }
        } catch(e) {}
        return orgFromParam;
    }

    // 2. Pathname check: /UUID/ or /org/UUID/
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = window.location.pathname.match(uuidRegex);
    if (match) {
        const orgFromPath = match[0];
        localStorage.setItem('current_org_id', orgFromPath);
        return orgFromPath;
    }

    // 3. Authenticated user stored in localStorage (active session defines the tenant)
    try {
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
            const user = JSON.parse(userRaw);
            if (user && user.organization_id) {
                localStorage.setItem('current_org_id', user.organization_id);
                return user.organization_id;
            }
        }
    } catch(e) {}

    // 4. Stored in localStorage
    const storedOrg = localStorage.getItem('current_org_id');
    if (storedOrg) {
        return storedOrg;
    }

    // 5. Default to Org 1
    return DEFAULT_ORG_ID;
}

/**
 * Apply theme styling dynamically to :root and the DOM.
 */
function applyTheme(config) {
    if (!config) return;
    window.__WEDDING_CONFIG = config;

    // Admin panel keeps basic standard design regardless of organization
    if (window.location.pathname.includes('admin.html')) {
        document.documentElement.removeAttribute('data-theme');
        if (document.body) {
            document.body.classList.remove('dark-theme');
        }
        document.documentElement.setAttribute('data-org-ready', 'true');
        return;
    }

    const theme = config.theme || config.theme_settings || {};
    const root = document.documentElement;

    // Detect dark mode
    const isDark = Boolean(
        theme.is_dark ||
        theme.preset_name === 'black_gold' ||
        theme.preset_name === 'modern_dark' ||
        theme.preset_name === 'cyber_party' ||
        isDarkColor(theme.color_bg)
    );

    if (isDark) {
        root.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-theme');
    } else {
        root.removeAttribute('data-theme');
        document.body.classList.remove('dark-theme');
    }

    if (theme.color_bg) root.style.setProperty('--color-bg', theme.color_bg);
    if (theme.color_text) root.style.setProperty('--color-text', theme.color_text);
    if (theme.color_primary) {
        root.style.setProperty('--color-graphite', theme.color_primary);
        root.style.setProperty('--color-primary', theme.color_primary);
    }
    if (theme.color_primary_light) {
        root.style.setProperty('--color-graphite-light', theme.color_primary_light);
    }
    if (theme.color_accent) {
        root.style.setProperty('--color-gold', theme.color_accent);
        root.style.setProperty('--color-accent', theme.color_accent);
    }
    if (theme.color_surface) {
        root.style.setProperty('--color-surface', theme.color_surface);
    }
    if (theme.color_border) {
        root.style.setProperty('--color-border', theme.color_border);
    }
    if (theme.color_beige) {
        root.style.setProperty('--color-beige', theme.color_beige);
    }
    if (theme.color_beige_light) {
        root.style.setProperty('--color-beige-light', theme.color_beige_light);
    }
    if (theme.font_heading) {
        root.style.setProperty('--font-heading', theme.font_heading);
        ensureGoogleFontLoaded(theme.font_heading);
    }
    if (theme.font_body) {
        root.style.setProperty('--font-body', theme.font_body);
        document.body.style.fontFamily = theme.font_body;
        ensureGoogleFontLoaded(theme.font_body);
    }
    if (theme.font_monogram) {
        root.style.setProperty('--font-monogram', theme.font_monogram);
        ensureGoogleFontLoaded(theme.font_monogram);
    }

    // Meta theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme && theme.color_bg) {
        metaTheme.setAttribute('content', theme.color_bg);
    }

    const p1 = config.partner1_name || 'Gospodarz';
    const p2 = (config.partner2_name && config.partner2_name.trim().length > 0) ? config.partner2_name.trim() : null;
    const isSingleHost = !p2;

    const adminPanelTitle = config.admin_panel_title || (isSingleHost ? 'Panel admina' : 'Panel Pary Młodej');
    const contactHeaderLabel = config.contact_label || (isSingleHost ? 'Kontakt do jubilata' : 'Kontakt do pary młodej');
    const defaultStatusText = config.default_status_text || (isSingleHost ? 'Do zobaczenia na imprezie' : 'Do zobaczenia na naszym weselu');

    // Update Page Title
    if (config.wedding_name) {
        const isSeating = window.location.pathname.includes('seating');
        const isAdmin = window.location.pathname.includes('admin');
        if (isAdmin) {
            document.title = `${adminPanelTitle} — ${config.wedding_name}`;
        } else if (isSeating) {
            document.title = `Kreator Planu Sali — ${config.wedding_name}`;
        } else {
            document.title = config.wedding_name;
        }
    }

    // Update Admin Header in admin.html if present
    const adminHeaderTitle = document.getElementById('admin-header-title');
    if (adminHeaderTitle) {
        adminHeaderTitle.textContent = adminPanelTitle;
    }

    // Update Profile Admin Card Label & Subtitle
    const adminPanelCardLabel = document.querySelector('#admin-panel-card .info-card-label');
    if (adminPanelCardLabel) {
        adminPanelCardLabel.textContent = adminPanelTitle;
    }
    const adminPanelCardSubtitle = document.querySelector('#admin-panel-card .info-card-value');
    if (adminPanelCardSubtitle) {
        adminPanelCardSubtitle.textContent = config.custom_labels?.admin_subtitle || (isSingleHost ? 'Zarządzaj ustawieniami imprezy' : 'Zarządzaj ustawieniami wesela');
    }

    // Update Notification Dialog Text for single host
    const notifExplain = document.getElementById('notification-explain-text');
    if (notifExplain && isSingleHost) {
        notifExplain.textContent = `W ten sposób umożliwisz ${p1} szybkie powiadamianie Cię o nowych informacjach odnośnie imprezy.`;
    }

    // Update Hero Celebratory Badge
    const heroBadgeEl = document.getElementById('couple-hero-badge');
    if (heroBadgeEl) {
        const badgeText = config.custom_labels?.hero_badge || (isSingleHost ? `18. URODZINY ${p1.toUpperCase()}` : null);
        if (badgeText) {
            heroBadgeEl.innerHTML = `<i class="ph-fill ph-sparkles"></i> ${badgeText}`;
            heroBadgeEl.style.display = 'inline-flex';
        } else {
            heroBadgeEl.style.display = 'none';
        }
    }

    // Update Contact Header if rendered
    const contactsHeader = document.querySelector('.info-contacts-header');
    if (contactsHeader) {
        contactsHeader.textContent = contactHeaderLabel;
    }

    // Update Initial / Fallback Status Text
    const coupleStatusTextEl = document.getElementById('couple-status-text');
    if (coupleStatusTextEl) {
        coupleStatusTextEl.textContent = defaultStatusText;
    }

    // Update Login Screen
    const loginDateEl = document.querySelector('#login-overlay h2') || document.getElementById('login-date-display');
    if (loginDateEl && config.date_display_text) {
        loginDateEl.textContent = config.date_display_text;
    }

    const loginLogoContainer = document.querySelector('.login-content .login-logo') || document.getElementById('login-logo-container');
    if (loginLogoContainer) {
        if (config.logo_image) {
            loginLogoContainer.innerHTML = `<img src="${config.logo_image}" alt="Logo" class="login-logo" style="max-height: 100px; width: auto; object-fit: contain; filter: drop-shadow(0 4px 18px rgba(212, 175, 55, 0.45));">`;
        } else if (config.monogram_text) {
            const parts = config.monogram_text.split('&');
            if (parts.length === 2) {
                loginLogoContainer.innerHTML = `<span class="logo-letter">${parts[0].trim()}</span><span class="logo-amp">&</span><span class="logo-letter">${parts[1].trim()}</span>`;
            } else {
                loginLogoContainer.innerHTML = `<span class="logo-letter">${config.monogram_text}</span>`;
            }
        } else {
            loginLogoContainer.innerHTML = '';
        }
    }

    // Update Top Header Brand
    const topBrand = document.querySelector('.top-header-brand .logo') || document.getElementById('top-brand-logo');
    if (topBrand) {
        if (config.logo_image) {
            topBrand.innerHTML = `<img src="${config.logo_image}" alt="Logo" style="max-height: 48px; width: auto; object-fit: contain; filter: drop-shadow(0 2px 12px rgba(212, 175, 55, 0.45));">`;
        } else if (config.monogram_text) {
            const parts = config.monogram_text.split('&');
            if (parts.length === 2) {
                topBrand.innerHTML = `<span class="logo-letter">${parts[0].trim()}</span><span class="logo-amp">&</span><span class="logo-letter">${parts[1].trim()}</span>`;
            } else {
                topBrand.innerHTML = `<span class="logo-letter">${config.monogram_text}</span>`;
            }
        } else {
            topBrand.innerHTML = '';
        }
    }

    // Update Countdown Box Label
    const countdownLabel = document.querySelector('.header-countdown-label strong') || document.getElementById('header-countdown-date');
    if (countdownLabel && config.date_display_text) {
        countdownLabel.textContent = config.date_display_text;
    }

    // Update Phone Form Helper
    const loginPhoneHelper = document.getElementById('login-phone-helper');
    if (loginPhoneHelper) {
        loginPhoneHelper.textContent = isSingleHost
            ? `Numer telefonu przyda się ${p1}, gdy zapomnisz potwierdzić swoją obecność ;)`
            : 'Numer telefonu przyda się Parze Młodej, gdy zapomnisz potwierdzić swoją obecność ;)';
    }

    // Update Bottom Nav Item for Tab Couple
    const bottomNavCoupleItem = document.querySelector('.bottom-nav a[data-target="tab-couple"]');
    if (bottomNavCoupleItem) {
        const span = bottomNavCoupleItem.querySelector('span');
        const icon = bottomNavCoupleItem.querySelector('i');
        const tabLabel = config.custom_labels?.couple_tab_label || (isSingleHost ? 'Jubilat' : 'Para młoda');
        if (span) span.textContent = tabLabel;
        if (icon) {
            icon.className = isSingleHost ? 'ph-fill ph-crown' : 'ph ph-users';
        }
    }

    // Update Direct Message Modal Details
    const directModalTitle = document.querySelector('.direct-modal-header h3') || document.getElementById('direct-modal-title');
    if (directModalTitle) {
        directModalTitle.textContent = isSingleHost ? `Wiadomość dla ${p1}` : 'Wiadomość dla Pary Młodej';
    }

    const directAvatarStack = document.querySelector('.direct-avatar-stack') || document.getElementById('direct-avatar-stack');
    if (directAvatarStack) {
        if (isSingleHost) {
            directAvatarStack.innerHTML = `<span class="avatar-ring">${p1.charAt(0)}</span>`;
        } else if (p2) {
            directAvatarStack.innerHTML = `<span class="avatar-ring">${p1.charAt(0)}</span><span class="avatar-ring">${p2.charAt(0)}</span>`;
        } else {
            directAvatarStack.innerHTML = `<span class="avatar-ring">✉️</span>`;
        }
    }

    // Update Wishes Input Placeholder and Submit Button
    const directTextInput = document.getElementById('direct-text-input');
    if (directTextInput) {
        directTextInput.placeholder = isSingleHost ? `Napisz coś pięknego dla ${p1}...` : `Napisz coś pięknego dla ${p1} i ${p2}...`;
    }

    const sendDirectBtnText = document.getElementById('send-direct-btn-text');
    if (sendDirectBtnText) {
        sendDirectBtnText.textContent = isSingleHost ? `Wyślij do ${p1}` : `Wyślij do ${p1} & ${p2}`;
    }

    // Update Hero Button & Wishes feature toggle
    const wishesTriggerBtn = document.getElementById('open-direct-msg-btn');
    if (wishesTriggerBtn) {
        if (config.wishes_enabled === false) {
            wishesTriggerBtn.style.display = 'none';
        } else {
            wishesTriggerBtn.style.display = 'inline-flex';
            wishesTriggerBtn.innerHTML = isSingleHost ? `<i class="ph-fill ph-chat-circle-dots"></i> Złóż życzenia dla ${p1}` : `<i class="ph-fill ph-chat-circle-dots"></i> Złóż życzenia`;
        }
    }

    const wishesCardEl = document.getElementById('wishes-panel-card');
    if (wishesCardEl && config.wishes_enabled === false) {
        wishesCardEl.style.display = 'none';
    }

    // Handle Seating Plan feature toggle
    if (config.seating_enabled === false) {
        const seatingWrapper = document.getElementById('seating-plan-section-wrapper');
        if (seatingWrapper) seatingWrapper.style.display = 'none';
        const seatingHeader = document.getElementById('plan-sali-header');
        if (seatingHeader) seatingHeader.style.display = 'none';
        const userTableCard = document.getElementById('user-table-card');
        if (userTableCard) userTableCard.style.display = 'none';
        const filterBtn = document.getElementById('filter-btn');
        if (filterBtn) filterBtn.style.display = 'none';
    }

    // Update Demo Codes Container
    const demoChipsContainer = document.getElementById('demo-codes-chips') || document.querySelector('#demo-codes-container div');
    const demoCodesContainer = document.getElementById('demo-codes-container');
    if (demoChipsContainer && demoCodesContainer) {
        if (config.organization_id === '18181818-1818-4818-8818-181818181818' || (config.organization_name && config.organization_name.includes('Paweł')) || isSingleHost) {
            demoChipsContainer.innerHTML = `
                <button type="button" class="demo-code-chip" onclick="document.getElementById('login-code-input').value='PAWEL18'; document.getElementById('login-submit-btn').click();">PAWEL18</button>
                <button type="button" class="demo-code-chip" onclick="document.getElementById('login-code-input').value='MAREK18'; document.getElementById('login-submit-btn').click();">MAREK18</button>
                <button type="button" class="demo-code-chip" onclick="document.getElementById('login-code-input').value='KASIA18'; document.getElementById('login-submit-btn').click();">KASIA18</button>
            `;
            demoCodesContainer.style.display = 'block';
        } else {
            demoChipsContainer.innerHTML = `
                <button type="button" class="demo-code-chip" onclick="document.getElementById('login-code-input').value='KAMIL'; document.getElementById('login-submit-btn').click();">KAMIL</button>
                <button type="button" class="demo-code-chip" onclick="document.getElementById('login-code-input').value='FRED'; document.getElementById('login-submit-btn').click();">FRED</button>
                <button type="button" class="demo-code-chip" onclick="document.getElementById('login-code-input').value='8VGP87'; document.getElementById('login-submit-btn').click();">8VGP87</button>
            `;
            demoCodesContainer.style.display = 'block';
        }
    }

    // Update Places dynamically in Info tab if element exists
    const placesContainer = document.getElementById('info-places-container');
    if (placesContainer && config.info_places && Array.isArray(config.info_places) && config.info_places.length > 0) {
        placesContainer.innerHTML = '';
        config.info_places.forEach(place => {
            const card = document.createElement('div');
            const width = place.width || '100';
            let rowsHtml = '';
            if (place.rows && Array.isArray(place.rows)) {
                place.rows.forEach(row => {
                    if (row.text) {
                        rowsHtml += `<p class="place-row"><i class="${row.icon || 'ph ph-info'}"></i> ${row.text}</p>`;
                    }
                });
            } else {
                if (place.time) rowsHtml += `<p class="place-time"><i class="ph ph-clock"></i> ${place.time}</p>`;
                if (place.address) rowsHtml += `<p class="place-address"><i class="ph ph-map-pin"></i> ${place.address}</p>`;
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
            placesContainer.appendChild(card);
        });
    }

    // Update Couple Hero Card image
    const coupleHeroBg = document.querySelector('.couple-hero-bg');
    if (coupleHeroBg) {
        if (config.couple_image) {
            coupleHeroBg.style.backgroundImage = `url('${config.couple_image}')`;
        } else {
            coupleHeroBg.style.backgroundImage = 'none';
        }
        const x = config.couple_image_position_x !== undefined ? config.couple_image_position_x : 50;
        const y = config.couple_image_position_y !== undefined ? config.couple_image_position_y : 50;
        coupleHeroBg.style.backgroundPosition = `${x}% ${y}%`;
    }

    // Mark organization theme and styling as successfully applied
    document.documentElement.setAttribute('data-org-ready', 'true');
}

/**
 * Synchronously preload cached organization theme as early as possible.
 */
(function preloadThemeSynchronously() {
    try {
        if (window.location.pathname.includes('admin.html')) {
            document.documentElement.removeAttribute('data-theme');
            if (document.body) {
                document.body.classList.remove('dark-theme');
            }
            document.documentElement.setAttribute('data-org-ready', 'true');
            return;
        }
        const orgId = detectOrganizationId();
        const cached = localStorage.getItem('wedding_config_' + orgId);
        if (cached) {
            const config = JSON.parse(cached);
            window.__WEDDING_CONFIG = config;
            applyTheme(config);
        }
    } catch(e) {}
})();

/**
 * Fetch public configuration before login, apply theme, and persist cache.
 */
async function initOrganizationTheme(apiUrl) {
    if (window.location.pathname.includes('admin.html')) {
        document.documentElement.removeAttribute('data-theme');
        if (document.body) {
            document.body.classList.remove('dark-theme');
        }
        document.documentElement.setAttribute('data-org-ready', 'true');
        return null;
    }
    const orgId = detectOrganizationId();

    // Safety timeout to ensure body is never permanently hidden if network lags
    const safetyTimer = setTimeout(() => {
        document.documentElement.setAttribute('data-org-ready', 'true');
    }, 600);

    try {
        const res = await fetch(`${apiUrl}/org/${orgId}/config/`);
        if (res.ok) {
            const config = await res.json();
            window.__WEDDING_CONFIG = config;
            try {
                localStorage.setItem('wedding_config_' + orgId, JSON.stringify(config));
            } catch(e) {}
            applyTheme(config);
            clearTimeout(safetyTimer);
            return config;
        }
    } catch (e) {
        console.warn("Could not load organization theme ahead of time:", e);
    }
    document.documentElement.setAttribute('data-org-ready', 'true');
    clearTimeout(safetyTimer);
    return null;
}
