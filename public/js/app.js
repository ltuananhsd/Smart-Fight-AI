/**
 * Travel Optimization Engine — Chat Application V2.1
 * Features: Stop button, Chat History (LocalStorage), Tab switching, Fee Comparison.
 */

/* ═══════════════════════════════════════════════════════════════════
   Chat History Manager — LocalStorage-based
   ═══════════════════════════════════════════════════════════════════ */
const ChatHistory = {
    STORAGE_KEY: 'travel_chat_history',
    MAX_SESSIONS: 50,

    _getAll() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
        } catch { return {}; }
    },

    _saveAll(data) {
        // Purge oldest if over limit
        const keys = Object.keys(data);
        if (keys.length > this.MAX_SESSIONS) {
            const sorted = keys.sort((a, b) => (data[a].updatedAt || 0) - (data[b].updatedAt || 0));
            for (let i = 0; i < keys.length - this.MAX_SESSIONS; i++) {
                delete data[sorted[i]];
            }
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    },

    /** Save or update a session */
    save(sessionId, title, messages) {
        const all = this._getAll();
        all[sessionId] = {
            title: title || 'Cuộc hội thoại mới',
            messages: messages,
            updatedAt: Date.now(),
            createdAt: all[sessionId]?.createdAt || Date.now(),
        };
        this._saveAll(all);
    },

    /** Load a session's messages */
    load(sessionId) {
        const all = this._getAll();
        return all[sessionId] || null;
    },

    /** Rename a session */
    rename(sessionId, newTitle) {
        const all = this._getAll();
        if (all[sessionId]) {
            all[sessionId].title = newTitle;
            this._saveAll(all);
        }
    },

    /** Delete a session */
    delete(sessionId) {
        const all = this._getAll();
        delete all[sessionId];
        this._saveAll(all);
    },

    /** Get all sessions sorted by updatedAt desc */
    getList() {
        const all = this._getAll();
        return Object.entries(all)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },
};


/* ═══════════════════════════════════════════════════════════════════
   Main Application
   ═══════════════════════════════════════════════════════════════════ */
const App = {
    // State
    sessionId: null,
    isWaiting: false,
    abortController: null,
    messages: [],  // [{role, content}] for current session

    // DOM elements (cached on init)
    els: {},

    init() {
        this.sessionId = localStorage.getItem('travel_session_id') || this._generateId();
        localStorage.setItem('travel_session_id', this.sessionId);

        this.els = {
            chatContainer: document.getElementById('chat-container'),
            messageInput: document.getElementById('message-input'),
            sendBtn: document.getElementById('send-btn'),
            sendIcon: document.getElementById('send-icon'),
            stopIcon: document.getElementById('stop-icon'),
            clearBtn: document.getElementById('clear-btn'),
            typingIndicator: document.getElementById('typing-indicator'),
            statusBar: document.getElementById('status-bar'),
            statusText: document.getElementById('status-text'),
            welcome: document.getElementById('welcome-screen'),
            // Sidebar
            sidebar: document.getElementById('sidebar'),
            sidebarList: document.getElementById('sidebar-list'),
            sidebarOverlay: document.getElementById('sidebar-overlay'),
            sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
            sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
            newChatBtn: document.getElementById('new-chat-btn'),
            // Tabs
            tabChat: document.getElementById('tab-chat'),
            tabCompare: document.getElementById('tab-compare'),
            tabContentChat: document.getElementById('tab-content-chat'),
            tabContentCompare: document.getElementById('tab-content-compare'),
            // Compare
            compareForm: document.getElementById('compare-form'),
            compareFlights: document.getElementById('compare-flights'),
            addFlightBtn: document.getElementById('add-flight-btn'),
            compareResults: document.getElementById('compare-results'),
            compareResultsBody: document.getElementById('compare-results-body'),
            compareInsights: document.getElementById('compare-insights'),
            compareSubmitBtn: document.getElementById('compare-submit-btn'),
        };

        // ── Chat Events ──
        this.els.sendBtn.addEventListener('click', () => this._handleSendStopClick());
        this.els.clearBtn.addEventListener('click', () => this.clearChat());
        this.els.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.els.messageInput.addEventListener('input', () => {
            const el = this.els.messageInput;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
        });

        // Quick prompts
        document.querySelectorAll('.quick-prompt').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.prompt;
                this.els.messageInput.value = text;
                this.sendMessage();
            });
        });

        // ── Sidebar Events ──
        this.els.sidebarToggleBtn.addEventListener('click', () => this._toggleSidebar());
        this.els.sidebarCloseBtn.addEventListener('click', () => this._closeSidebar());
        this.els.sidebarOverlay.addEventListener('click', () => this._closeSidebar());
        this.els.newChatBtn.addEventListener('click', () => this._newChat());

        // ── Tab Events ──
        this.els.tabChat.addEventListener('click', () => this._switchTab('chat'));
        this.els.tabCompare.addEventListener('click', () => this._switchTab('compare'));

        // ── Compare Form Events ──
        this.els.addFlightBtn.addEventListener('click', () => this._addFlightRow());
        this.els.compareForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this._submitCompare();
        });

        // ── Init UI ──
        this._renderSidebar();
        this._loadSession(this.sessionId);
        this.els.messageInput.focus();
        this._checkHealth();
    },

    // ── Send / Stop ─────────────────────────────────────────────────

    _handleSendStopClick() {
        if (this.isWaiting) {
            this.stopResponse();
        } else {
            this.sendMessage();
        }
    },

    async sendMessage() {
        const message = this.els.messageInput.value.trim();
        if (!message || this.isWaiting) return;

        // Hide welcome screen
        if (this.els.welcome) {
            this.els.welcome.style.display = 'none';
        }

        // Show user message
        this._addMessage(message, 'user');
        this.messages.push({ role: 'user', content: message });
        this.els.messageInput.value = '';
        this.els.messageInput.style.height = 'auto';

        // Auto-save to history
        const title = this.messages[0]?.content?.substring(0, 40) || 'Cuộc hội thoại mới';
        ChatHistory.save(this.sessionId, title, this.messages);
        this._renderSidebar();

        // Show typing indicator + stop button
        this._setWaiting(true);
        this.abortController = new AbortController();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    session_id: this.sessionId,
                    stream: true,
                }),
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${response.status}`);
            }

            // Check if streaming
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/plain')) {
                // Streaming response
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let aiMessage = '';
                const msgEl = this._addMessage('', 'ai');
                const contentEl = msgEl.querySelector('.message-content');

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        aiMessage += chunk;
                        contentEl.innerHTML = this._renderMarkdown(aiMessage);
                        this._scrollToBottom();
                    }
                } catch (abortErr) {
                    if (abortErr.name === 'AbortError') {
                        aiMessage += '\n\n⏹ *Đã dừng*';
                        contentEl.innerHTML = this._renderMarkdown(aiMessage);
                    } else {
                        throw abortErr;
                    }
                }

                this.messages.push({ role: 'ai', content: aiMessage });

                // Update session id from header if present
                const newSessionId = response.headers.get('X-Session-Id');
                if (newSessionId) {
                    this.sessionId = newSessionId;
                    localStorage.setItem('travel_session_id', newSessionId);
                }
            } else {
                // JSON response
                const data = await response.json();
                this._addMessage(data.reply, 'ai');
                this.messages.push({ role: 'ai', content: data.reply });
                if (data.session_id) {
                    this.sessionId = data.session_id;
                    localStorage.setItem('travel_session_id', data.session_id);
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                this._addMessage(`❌ Lỗi: ${error.message}`, 'ai');
                this.messages.push({ role: 'ai', content: `❌ Lỗi: ${error.message}` });
            }
        } finally {
            this._setWaiting(false);
            this.abortController = null;
            // Save updated messages
            const title = this.messages[0]?.content?.substring(0, 40) || 'Cuộc hội thoại mới';
            ChatHistory.save(this.sessionId, title, this.messages);
            this._renderSidebar();
        }
    },

    stopResponse() {
        if (this.abortController) {
            this.abortController.abort();
        }
    },

    clearChat() {
        // Clear UI
        this.els.chatContainer.innerHTML = '';
        if (this.els.welcome) {
            this.els.welcome.style.display = 'flex';
            this.els.chatContainer.appendChild(this.els.welcome);
        }
        // Re-add typing indicator
        this.els.chatContainer.appendChild(this.els.typingIndicator);

        // Clear server session
        fetch(`/api/chat/${this.sessionId}`, { method: 'DELETE' }).catch(() => {});

        // New session
        this._newChat();
    },

    // ── Sidebar ─────────────────────────────────────────────────────

    _toggleSidebar() {
        this.els.sidebar.classList.toggle('open');
        this.els.sidebarOverlay.classList.toggle('active');
    },

    _closeSidebar() {
        this.els.sidebar.classList.remove('open');
        this.els.sidebarOverlay.classList.remove('active');
    },

    _newChat() {
        this.sessionId = this._generateId();
        localStorage.setItem('travel_session_id', this.sessionId);
        this.messages = [];

        // Reset UI
        this.els.chatContainer.innerHTML = '';
        if (this.els.welcome) {
            this.els.welcome.style.display = 'flex';
            this.els.chatContainer.appendChild(this.els.welcome);
        }
        this.els.chatContainer.appendChild(this.els.typingIndicator);

        this._renderSidebar();
        this._closeSidebar();
        this._switchTab('chat');
        this.els.messageInput.focus();
    },

    _loadSession(sessionId) {
        const session = ChatHistory.load(sessionId);
        if (!session || !session.messages.length) return;

        this.sessionId = sessionId;
        localStorage.setItem('travel_session_id', sessionId);
        this.messages = session.messages;

        // Clear and rebuild UI
        this.els.chatContainer.innerHTML = '';
        if (this.els.welcome) {
            this.els.welcome.style.display = 'none';
            this.els.chatContainer.appendChild(this.els.welcome);
        }

        session.messages.forEach(msg => {
            this._addMessage(msg.content, msg.role);
        });

        this.els.chatContainer.appendChild(this.els.typingIndicator);
        this._renderSidebar();
        this._scrollToBottom();
    },

    _renderSidebar() {
        const list = ChatHistory.getList();
        const container = this.els.sidebarList;

        if (list.length === 0) {
            container.innerHTML = '<div class="sidebar-empty">Chưa có cuộc hội thoại nào</div>';
            return;
        }

        container.innerHTML = list.map(session => `
            <div class="sidebar-item ${session.id === this.sessionId ? 'active' : ''}" 
                 data-session-id="${session.id}">
                <span class="sidebar-item-text" title="${this._escapeHtml(session.title)}">${this._escapeHtml(session.title)}</span>
                <div class="sidebar-item-actions">
                    <button class="rename-btn" title="Đổi tên" data-action="rename">✏️</button>
                    <button class="delete-btn" title="Xóa" data-action="delete">🗑️</button>
                </div>
            </div>
        `).join('');

        // Event delegation
        container.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset?.action;
                const sid = item.dataset.sessionId;

                if (action === 'rename') {
                    e.stopPropagation();
                    this._startRename(item, sid);
                } else if (action === 'delete') {
                    e.stopPropagation();
                    this._deleteSession(sid);
                } else {
                    this._switchToSession(sid);
                }
            });
        });
    },

    _switchToSession(sid) {
        if (sid === this.sessionId) return;
        this._loadSession(sid);
        this._closeSidebar();
        this._switchTab('chat');
    },

    _startRename(itemEl, sid) {
        const textEl = itemEl.querySelector('.sidebar-item-text');
        const currentTitle = textEl.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'sidebar-rename-input';
        input.value = currentTitle;

        textEl.replaceWith(input);
        input.focus();
        input.select();

        const finish = () => {
            const newTitle = input.value.trim() || currentTitle;
            ChatHistory.rename(sid, newTitle);
            this._renderSidebar();
        };

        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { input.value = currentTitle; input.blur(); }
        });
    },

    _deleteSession(sid) {
        ChatHistory.delete(sid);
        if (sid === this.sessionId) {
            this._newChat();
        } else {
            this._renderSidebar();
        }
    },

    // ── Tabs ─────────────────────────────────────────────────────────

    _switchTab(tab) {
        // Update buttons
        this.els.tabChat.classList.toggle('active', tab === 'chat');
        this.els.tabCompare.classList.toggle('active', tab === 'compare');

        // Update content
        this.els.tabContentChat.classList.toggle('active', tab === 'chat');
        this.els.tabContentCompare.classList.toggle('active', tab === 'compare');

        if (tab === 'chat') {
            this.els.messageInput.focus();
        }
    },

    // ── Fee Comparison ──────────────────────────────────────────────

    _addFlightRow() {
        const container = this.els.compareFlights;
        const count = container.children.length;
        if (count >= 5) return;

        const row = document.createElement('div');
        row.className = 'compare-flight-row';
        row.dataset.index = count;
        row.innerHTML = `
            <span class="flight-row-label">${count + 1}</span>
            <input type="text" class="compare-input" name="airline" placeholder="Hãng bay" required>
            <div class="compare-price-wrapper">
                <span class="currency-prefix">$</span>
                <input type="number" class="compare-input compare-price" name="price" placeholder="Giá vé" min="1" required>
            </div>
        `;
        container.appendChild(row);

        if (count + 1 >= 5) {
            this.els.addFlightBtn.style.display = 'none';
        }
    },

    async _submitCompare() {
        const rows = this.els.compareFlights.querySelectorAll('.compare-flight-row');
        const flights = [];

        rows.forEach(row => {
            const airline = row.querySelector('[name="airline"]').value.trim();
            const price = parseFloat(row.querySelector('[name="price"]').value);
            if (airline && price > 0) {
                flights.push({
                    airline,
                    price,
                    carry_on: document.getElementById('opt-carryon').checked,
                    checked_bags: document.getElementById('opt-checked').checked ? 1 : 0,
                });
            }
        });

        if (flights.length < 2) {
            alert('Vui lòng nhập ít nhất 2 hãng bay để so sánh.');
            return;
        }

        this.els.compareSubmitBtn.disabled = true;
        this.els.compareSubmitBtn.textContent = '⏳ Đang phân tích...';

        try {
            const res = await fetch('/api/compare-fees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flights }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }

            const data = await res.json();
            this._renderCompareResults(data);
        } catch (err) {
            alert(`Lỗi: ${err.message}`);
        } finally {
            this.els.compareSubmitBtn.disabled = false;
            this.els.compareSubmitBtn.textContent = '🔍 So sánh ngay';
        }
    },

    _renderCompareResults(data) {
        const body = this.els.compareResultsBody;
        const insights = this.els.compareInsights;

        // Build table
        let html = `<table>
            <tr>
                <th>Hãng bay</th>
                <th>Giá vé</th>
                <th>Xách tay</th>
                <th>Ký gửi</th>
                <th>Chỗ ngồi</th>
                <th>TRUE Total</th>
            </tr>`;

        data.results.forEach((r, i) => {
            const isCheapest = i === 0;
            html += `<tr class="${isCheapest ? 'cheapest-row' : ''}">
                <td>${this._escapeHtml(r.airline)} ${isCheapest ? '💰' : ''}</td>
                <td>$${r.advertised_price.toFixed(0)}</td>
                <td>${r.carry_on_fee > 0 ? '+$' + r.carry_on_fee.toFixed(0) : '✅ Free'}</td>
                <td>${r.checked_bag_fee > 0 ? '+$' + r.checked_bag_fee.toFixed(0) : '—'}</td>
                <td>${r.seat_fee > 0 ? '+$' + r.seat_fee.toFixed(0) : '✅ Free'}</td>
                <td class="true-total">$${r.true_total.toFixed(0)}</td>
            </tr>`;
        });

        html += '</table>';
        body.innerHTML = html;

        // Build insights
        insights.innerHTML = `
            <div class="insight-card">
                <span class="insight-emoji">💰</span>
                <span>Giá quảng cáo rẻ nhất: <strong>${this._escapeHtml(data.cheapest_advertised)}</strong></span>
            </div>
            <div class="insight-card">
                <span class="insight-emoji">✅</span>
                <span>Chi phí thực rẻ nhất: <strong>${this._escapeHtml(data.cheapest_true)}</strong></span>
            </div>
            <div class="insight-card">
                <span class="insight-emoji">⚠️</span>
                <span>Phí ẩn nhiều nhất: <strong>${this._escapeHtml(data.biggest_hidden_cost)}</strong></span>
            </div>
        `;

        this.els.compareResults.classList.remove('hidden');
    },

    // ── Private helpers ──────────────────────────────────────────

    _addMessage(content, role) {
        const wrapper = document.createElement('div');
        wrapper.className = `message message-${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = role === 'user' ? '👤' : '✈️';

        const bubble = document.createElement('div');
        bubble.className = 'message-content';
        bubble.innerHTML = role === 'ai' ? this._renderMarkdown(content) : this._escapeHtml(content);

        wrapper.appendChild(avatar);
        wrapper.appendChild(bubble);

        // Insert before typing indicator if it exists
        const typing = this.els.typingIndicator;
        if (typing && typing.parentNode === this.els.chatContainer) {
            this.els.chatContainer.insertBefore(wrapper, typing);
        } else {
            this.els.chatContainer.appendChild(wrapper);
        }

        this._scrollToBottom();
        return wrapper;
    },

    _setWaiting(waiting) {
        this.isWaiting = waiting;
        this.els.typingIndicator.classList.toggle('active', waiting);

        // Toggle Send/Stop button appearance
        if (waiting) {
            this.els.sendBtn.classList.add('stopping');
            this.els.sendBtn.disabled = false;
            this.els.sendBtn.title = 'Dừng';
            this.els.sendIcon.classList.add('hidden');
            this.els.stopIcon.classList.remove('hidden');
            this._scrollToBottom();
        } else {
            this.els.sendBtn.classList.remove('stopping');
            this.els.sendBtn.disabled = false;
            this.els.sendBtn.title = 'Gửi';
            this.els.sendIcon.classList.remove('hidden');
            this.els.stopIcon.classList.add('hidden');
        }
    },

    _scrollToBottom() {
        requestAnimationFrame(() => {
            this.els.chatContainer.scrollTop = this.els.chatContainer.scrollHeight;
        });
    },

    _renderMarkdown(text) {
        if (!text) return '';

        // ── BUG-2 FIX: Preserve <div class="ui-box ..."> blocks before escaping ──
        const uiBoxes = [];
        let safeText = text.replace(/<div class="ui-box[^"]*">([\s\S]*?)<\/div>/g, (match) => {
            const placeholder = `__UIBOX_${uiBoxes.length}__`;
            uiBoxes.push(match);
            return placeholder;
        });

        let html = this._escapeHtml(safeText);

        // Code blocks (```...```)
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
            return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Headers
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // Bold and italic
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Unordered lists
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>(\n|$))+/g, (match) => `<ul>${match}</ul>`);

        // Tables (simple markdown tables)
        html = html.replace(/((\|.+\|\n)+)/g, (tableBlock) => {
            const rows = tableBlock.trim().split('\n');
            if (rows.length < 2) return tableBlock;

            let table = '<table>';
            rows.forEach((row, i) => {
                // Skip separator row (|---|---|)
                if (row.match(/^\|[\s-:|]+\|$/)) return;

                const cells = row.split('|').filter(c => c.trim() !== '');
                const tag = i === 0 ? 'th' : 'td';
                table += '<tr>';
                cells.forEach(cell => {
                    table += `<${tag}>${cell.trim()}</${tag}>`;
                });
                table += '</tr>';
            });
            table += '</table>';
            return table;
        });

        // Line breaks (double newline = paragraph)
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        html = `<p>${html}</p>`;

        // Clean up empty paragraphs
        html = html.replace(/<p>\s*<\/p>/g, '');
        html = html.replace(/<p>(<h[1-3]>)/g, '$1');
        html = html.replace(/(<\/h[1-3]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<table>)/g, '$1');
        html = html.replace(/(<\/table>)<\/p>/g, '$1');
        html = html.replace(/<p>(<ul>)/g, '$1');
        html = html.replace(/(<\/ul>)<\/p>/g, '$1');
        html = html.replace(/<p>(<pre>)/g, '$1');
        html = html.replace(/(<\/pre>)<\/p>/g, '$1');

        // ── Restore ui-box blocks (render their inner content as markdown too) ──
        uiBoxes.forEach((box, i) => {
            const innerMatch = box.match(/<div class="(ui-box[^"]*)">(([\s\S]*?))<\/div>/);
            if (innerMatch) {
                const className = innerMatch[1];
                const innerText = innerMatch[2];
                const innerHtml = this._renderMarkdownInner(innerText);
                html = html.replace(`__UIBOX_${i}__`, `<div class="${className}">${innerHtml}</div>`);
            } else {
                html = html.replace(`__UIBOX_${i}__`, box);
            }
        });

        // Clean up paragraphs wrapping ui-boxes
        html = html.replace(/<p>(<div class="ui-box)/g, '$1');
        html = html.replace(/(<\/div>)<\/p>/g, '$1');

        return html;
    },

    /** Render markdown for inner content of ui-box (no ui-box extraction). */
    _renderMarkdownInner(text) {
        if (!text) return '';
        let html = this._escapeHtml(text);

        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
            `<pre><code class="language-${lang}">${code.trim()}</code></pre>`);
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>(\n|$))+/g, (match) => `<ul>${match}</ul>`);

        // Tables
        html = html.replace(/((\|.+\|\n)+)/g, (tableBlock) => {
            const rows = tableBlock.trim().split('\n');
            if (rows.length < 2) return tableBlock;
            let table = '<table>';
            rows.forEach((row, i) => {
                if (row.match(/^\|[\s-:|]+\|$/)) return;
                const cells = row.split('|').filter(c => c.trim() !== '');
                const tag = i === 0 ? 'th' : 'td';
                table += '<tr>';
                cells.forEach(cell => { table += `<${tag}>${cell.trim()}</${tag}>`; });
                table += '</tr>';
            });
            table += '</table>';
            return table;
        });

        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        html = `<p>${html}</p>`;
        html = html.replace(/<p>\s*<\/p>/g, '');
        html = html.replace(/<p>(<h[1-4]>)/g, '$1');
        html = html.replace(/(<\/h[1-4]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<table>)/g, '$1');
        html = html.replace(/(<\/table>)<\/p>/g, '$1');
        html = html.replace(/<p>(<ul>)/g, '$1');
        html = html.replace(/(<\/ul>)<\/p>/g, '$1');
        html = html.replace(/<p>(<pre>)/g, '$1');
        html = html.replace(/(<\/pre>)<\/p>/g, '$1');
        return html;
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    _generateId() {
        return 'ses_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    },

    async _checkHealth() {
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            if (data.apis?.llm === 'missing') {
                this._showStatus('⚠️ LLM API key chưa cấu hình. Thêm LLM_API_KEY vào file .env');
            }
        } catch {
            this._showStatus('⚠️ Không thể kết nối server');
        }
    },

    _showStatus(text) {
        this.els.statusBar.classList.add('active');
        this.els.statusText.textContent = text;
    },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
