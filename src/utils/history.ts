export const ChatHistory = {
  STORAGE_KEY: "travel_chat_history",
  MAX_SESSIONS: 50,

  _getAll(): Record<string, any> {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  },

  _saveAll(data: Record<string, any>) {
    const keys = Object.keys(data);
    if (keys.length > this.MAX_SESSIONS) {
      const sorted = keys.sort(
        (a, b) => (data[a].updatedAt || 0) - (data[b].updatedAt || 0)
      );
      for (let i = 0; i < keys.length - this.MAX_SESSIONS; i++) {
        delete data[sorted[i]];
      }
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  save(sessionId: string, title: string, messages: any[]) {
    const all = this._getAll();
    all[sessionId] = {
      title: title || "Cuộc hội thoại mới",
      messages: messages,
      updatedAt: Date.now(),
      createdAt: all[sessionId]?.createdAt || Date.now(),
    };
    this._saveAll(all);
  },

  load(sessionId: string) {
    const all = this._getAll();
    return all[sessionId] || null;
  },

  rename(sessionId: string, newTitle: string) {
    const all = this._getAll();
    if (all[sessionId]) {
      all[sessionId].title = newTitle;
      this._saveAll(all);
    }
  },

  delete(sessionId: string) {
    const all = this._getAll();
    delete all[sessionId];
    this._saveAll(all);
  },

  getList() {
    const all = this._getAll();
    return Object.entries(all)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
};
