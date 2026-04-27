/* ============================================================
 * Toast — stacked, auto-dismissing notifications.
 *
 * Replaces the old single-slot `MessageLog` (top-bar text). Multiple
 * toasts can stack; each auto-dismisses after `duration` ms (or
 * `0` for sticky); click-to-dismiss is always enabled.
 *
 * Visual variants (set via `type`):
 *   'info'    — neutral (default)
 *   'success' — green left border, used for wins
 *   'warning' — amber left border, used for all-in / urgent state
 *   'blinds'  — gold left border + subtle gradient, used for blinds-up
 *
 * Container is created on first instantiation and lives in <body>.
 * Position is desktop top-center; portrait mobile bottom-center
 * above the docked action panel (CSS handles this via
 * `body.mobile-portrait #toast-container`).
 * ============================================================ */

const TOAST_DURATIONS = {
    info:    3000,
    success: 3500,
    warning: 3000,
    blinds:  4500
};

export class Toast {
    constructor() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('aria-atomic', 'false');
            document.body.appendChild(container);
        }
        this.container = container;
    }

    /**
     * Show a toast.
     *
     * @param {string} text — display text (already-localized; no t() inside Toast)
     * @param {object} opts
     * @param {'info'|'success'|'warning'|'blinds'} [opts.type='info']
     * @param {number} [opts.duration] — ms before auto-dismiss; 0 = sticky.
     *                                   Defaults to a per-type sensible value.
     * @returns {HTMLElement} the toast element (for manual dismiss / styling tweaks)
     */
    show(text, opts = {}) {
        const type = opts.type || 'info';
        const duration = opts.duration !== undefined
            ? opts.duration
            : (TOAST_DURATIONS[type] ?? 3000);

        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.textContent = text;
        el.setAttribute('role', type === 'warning' || type === 'blinds' ? 'alert' : 'status');
        this.container.appendChild(el);

        // Trigger enter animation on next frame
        requestAnimationFrame(() => el.classList.add('visible'));

        let dismissTimer = null;
        const dismiss = () => {
            if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
            el.classList.remove('visible');
            // Remove from DOM after the exit transition
            setTimeout(() => el.remove(), 350);
        };

        if (duration > 0) {
            dismissTimer = setTimeout(dismiss, duration);
        }
        el.addEventListener('click', dismiss, { once: true });

        return el;
    }

    /** Dismiss every visible toast immediately. */
    clear() {
        Array.from(this.container.children).forEach(el => {
            el.classList.remove('visible');
            setTimeout(() => el.remove(), 350);
        });
    }
}
