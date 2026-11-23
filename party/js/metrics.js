// frontend/js/metrics.js - Telemetry and Performance Tracker
(function(window) {
    'use strict';

    const MetricsTracker = {
        buffer: [],
        timers: {},
        flushTimeout: null,
        flushIntervalMs: 5000,
        maxBufferSize: 8,
        isFlushing: false,

        init() {
            const flushAll = () => this.flush(true);
            window.addEventListener('beforeunload', flushAll);
            window.addEventListener('pagehide', flushAll);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.flush(true);
                }
            });

            // Automatic initial page load tracker
            if (typeof window !== 'undefined' && window.performance) {
                const measurePageLoad = () => {
                    setTimeout(() => {
                        try {
                            let loadTime = null;
                            if (performance.getEntriesByType) {
                                const nav = performance.getEntriesByType('navigation')[0];
                                if (nav && nav.loadEventEnd > 0) {
                                    loadTime = nav.loadEventEnd - nav.startTime;
                                }
                            }
                            if (!loadTime && performance.timing && performance.timing.loadEventEnd > 0) {
                                loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
                            }
                            if (loadTime && loadTime > 0) {
                                const path = window.location.pathname.toLowerCase();
                                let pageName = 'initial_page';
                                if (path.includes('admin.html')) {
                                    pageName = 'admin_page';
                                } else if (path.includes('seating.html')) {
                                    pageName = 'seating_creator_page';
                                } else if (path.includes('landing.html')) {
                                    pageName = 'landing_page';
                                }
                                this.trackPartLoad(pageName, Math.round(loadTime), {
                                    path: window.location.pathname,
                                    screen_width: window.innerWidth
                                });
                            }
                        } catch (e) {
                            // Non-critical performance measurement
                        }
                    }, 100);
                };

                if (document.readyState === 'complete') {
                    measurePageLoad();
                } else {
                    window.addEventListener('load', measurePageLoad);
                }
            }
        },

        startTimer(timerKey) {
            this.timers[timerKey] = performance.now();
        },

        stopTimer(timerKey) {
            if (this.timers[timerKey] !== undefined) {
                const elapsed = performance.now() - this.timers[timerKey];
                delete this.timers[timerKey];
                return Math.round(elapsed * 10) / 10;
            }
            return null;
        },

        async measure(name, category, asyncFn, metadata = {}) {
            const start = performance.now();
            try {
                const res = await asyncFn();
                const duration = Math.round((performance.now() - start) * 10) / 10;
                this.track({
                    category: category || 'part_load',
                    name: name,
                    duration_ms: duration,
                    metadata: { ...metadata, success: true }
                });
                return res;
            } catch (err) {
                const duration = Math.round((performance.now() - start) * 10) / 10;
                this.track({
                    category: category || 'part_load',
                    name: name,
                    duration_ms: duration,
                    metadata: { ...metadata, success: false, error: String(err) }
                });
                throw err;
            }
        },

        getDeviceContext() {
            let device = 'desktop';
            if (typeof navigator !== 'undefined') {
                const ua = navigator.userAgent || '';
                if (/iPad|Tablet/i.test(ua)) {
                    device = 'tablet';
                } else if (/Mobi|Android|iPhone|iPod/i.test(ua)) {
                    device = 'mobile';
                }
            }
            let conn = 'wifi';
            if (typeof navigator !== 'undefined' && navigator.connection) {
                conn = navigator.connection.effectiveType || navigator.connection.type || 'wifi';
            }
            return {
                device_type: device,
                connection_type: conn
            };
        },

        track(event) {
            if (!event || !event.name) return;
            const devCtx = this.getDeviceContext();
            const rawMeta = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
            const item = {
                category: event.category || 'custom',
                name: String(event.name),
                duration_ms: event.duration_ms !== undefined && event.duration_ms !== null ? Number(event.duration_ms) : null,
                metadata: {
                    device_type: devCtx.device_type,
                    connection_type: devCtx.connection_type,
                    ...rawMeta
                }
            };

            this.buffer.push(item);

            if (this.buffer.length >= this.maxBufferSize) {
                this.flush(false);
            } else if (!this.flushTimeout) {
                this.flushTimeout = setTimeout(() => this.flush(false), this.flushIntervalMs);
            }
        },

        trackPartLoad(partName, durationMs, metadata = {}) {
            this.track({
                category: 'part_load',
                name: partName,
                duration_ms: durationMs,
                metadata: metadata
            });
        },

        trackPartView(partName, metadata = {}) {
            this.track({
                category: 'part_view',
                name: partName,
                duration_ms: null,
                metadata: metadata
            });
        },

        trackUpload(mediaType, durationMs, metadata = {}) {
            this.track({
                category: 'media_upload',
                name: mediaType,
                duration_ms: durationMs,
                metadata: metadata
            });
        },

        trackPost(postType, durationMs, metadata = {}) {
            this.track({
                category: 'post_create',
                name: postType,
                duration_ms: durationMs,
                metadata: metadata
            });
        },

        getEndpoint() {
            let base = (typeof API_URL !== 'undefined' && API_URL) ? API_URL : '';
            if (!base) {
                base = window.location.origin.includes('railway.app') ? window.location.origin + '/api' : 'https://frameworthyparty-dev.up.railway.app/api';
            }
            return `${base}/metrics/track/`;
        },

        getOrgId() {
            if (typeof currentOrgId !== 'undefined' && currentOrgId) {
                return currentOrgId;
            }
            if (typeof detectOrganizationId === 'function') {
                const detected = detectOrganizationId();
                if (detected) return detected;
            }
            const params = new URLSearchParams(window.location.search);
            const urlOrg = params.get('org') || params.get('org_id');
            if (urlOrg) return urlOrg;
            try {
                return localStorage.getItem('current_org_id') || null;
            } catch (e) {
                return null;
            }
        },

        flush(sync = false) {
            if (this.flushTimeout) {
                clearTimeout(this.flushTimeout);
                this.flushTimeout = null;
            }
            if (this.buffer.length === 0 || this.isFlushing) return;

            const itemsToSend = [...this.buffer];
            this.buffer = [];

            const endpoint = this.getEndpoint();
            const orgId = this.getOrgId();

            const payload = JSON.stringify({
                organization_id: orgId,
                events: itemsToSend
            });

            if (sync && navigator.sendBeacon) {
                try {
                    const blob = new Blob([payload], { type: 'application/json' });
                    const sent = navigator.sendBeacon(endpoint, blob);
                    if (sent) return;
                } catch (e) {
                    // Fall back to fetch below
                }
            }

            this.isFlushing = true;
            const headers = { 'Content-Type': 'application/json' };
            if (orgId) {
                headers['X-Organization-Id'] = orgId;
            }
            const token = localStorage.getItem('access_token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: payload,
                keepalive: sync
            }).catch(err => {
                // Silently ignore telemetry transmission errors
            }).finally(() => {
                this.isFlushing = false;
            });
        }
    };

    MetricsTracker.init();
    window.MetricsTracker = MetricsTracker;

})(typeof window !== 'undefined' ? window : this);
