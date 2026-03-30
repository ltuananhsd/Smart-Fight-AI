import React, { useState, useEffect, useRef } from "react";
import { ChatHistory } from "./utils/history";
import { renderMarkdown } from "./utils/markdown";

function generateId() {
  return "ses_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export default function App() {
  const [tab, setTab] = useState<"chat" | "compare">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [sessions, setSessions] = useState<{ id: string; title: string; updatedAt: number }[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [isWaiting, setIsWaiting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [statusText, setStatusText] = useState("");
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let currentId = localStorage.getItem("travel_session_id");
    if (!currentId) {
      currentId = generateId();
      localStorage.setItem("travel_session_id", currentId);
    }
    setSessionId(currentId);
    loadSession(currentId);
    updateSessionsList();
    checkHealth();

    const savedTheme = localStorage.getItem("travel_theme") as "light" | "dark" || "dark";
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem("travel_theme", theme);
  }, [theme]);

  const updateSessionsList = () => {
    setSessions(ChatHistory.getList());
  };

  const loadSession = (sid: string) => {
    const session = ChatHistory.load(sid);
    if (session && session.messages) {
      setMessages(session.messages);
    } else {
      setMessages([]);
    }
  };

  const checkHealth = async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (data.apis?.llm === "missing") {
        setStatusText("⚠️ LLM API key chưa cấu hình. Thêm LLM_API_KEY vào file .env");
      }
    } catch {
      setStatusText("⚠️ Không thể kết nối server");
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isWaiting]);

  const handleNewChat = () => {
    const newId = generateId();
    setSessionId(newId);
    localStorage.setItem("travel_session_id", newId);
    setMessages([]);
    setSidebarOpen(false);
    setTab("chat");
  };

  const handleClearChat = () => {
    fetch(`/api/chat/${sessionId}`, { method: "DELETE" }).catch(() => {});
    handleNewChat();
  };

  const sendMessage = async (overrideMessage?: string) => {
    const text = (overrideMessage || inputValue).trim();
    if (!text || isWaiting) return;

    setInputValue("");
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);

    const title = newMessages[0]?.content?.substring(0, 40) || "Cuộc hội thoại mới";
    ChatHistory.save(sessionId, title, newMessages);
    updateSessionsList();

    setIsWaiting(true);
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    let aiMessage = "";
    const aiIndex = newMessages.length;
    setMessages([...newMessages, { role: "ai", content: aiMessage }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          stream: true,
        }),
        signal: abortCtrl.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/plain")) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            aiMessage += decoder.decode(value, { stream: true });
            setMessages((prev) => {
              const updated = [...prev];
              updated[aiIndex] = { role: "ai", content: aiMessage };
              return updated;
            });
          }
        }
      } else {
        const data = await response.json();
        aiMessage = data.reply;
        setMessages((prev) => {
          const updated = [...prev];
          updated[aiIndex] = { role: "ai", content: aiMessage };
          return updated;
        });
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        aiMessage += "\n\n⏹ *Đã dừng*";
      } else {
        aiMessage = `❌ Lỗi: ${error.message}`;
      }
      setMessages((prev) => {
        const updated = [...prev];
        updated[aiIndex] = { role: "ai", content: aiMessage };
        return updated;
      });
    } finally {
      setIsWaiting(false);
      abortControllerRef.current = null;
      ChatHistory.save(sessionId, title, [...newMessages, { role: "ai", content: aiMessage }]);
      updateSessionsList();
    }
  };

  const stopResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // ----- Compare Logic -----
  const [compareRows, setCompareRows] = useState([{ id: 0, airline: "", price: "" }, { id: 1, airline: "", price: "" }]);
  const [compareOpts, setCompareOpts] = useState({ carryOn: true, checked: false });
  const [compareResults, setCompareResults] = useState<any>(null);
  const [isComparing, setIsComparing] = useState(false);

  const addCompareRow = () => {
    if (compareRows.length >= 5) return;
    setCompareRows([...compareRows, { id: Date.now(), airline: "", price: "" }]);
  };

  const updateRow = (index: number, field: string, val: string) => {
    const updated = [...compareRows];
    updated[index] = { ...updated[index], [field]: val };
    setCompareRows(updated);
  };

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    const flights = compareRows
      .filter((r) => r.airline.trim() && parseFloat(r.price) > 0)
      .map((r) => ({
        airline: r.airline.trim(),
        price: parseFloat(r.price),
        carry_on: compareOpts.carryOn,
        checked_bags: compareOpts.checked ? 1 : 0,
      }));

    if (flights.length < 2) {
      alert("Vui lòng nhập ít nhất 2 hãng bay để so sánh.");
      return;
    }

    setIsComparing(true);
    try {
      const res = await fetch("/api/compare-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flights }),
      });
      if (!res.ok) throw new Error("Compare failed");
      const data = await res.json();
      setCompareResults(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} id="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">💬 Lịch sử chat</span>
          <button className="btn-icon sidebar-close" title="Đóng" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <button className="sidebar-new-chat" onClick={handleNewChat}>
          <span>＋</span> Cuộc hội thoại mới
        </button>
        <div className="sidebar-list">
          {sessions.length === 0 ? (
            <div className="sidebar-empty">Chưa có cuộc hội thoại nào</div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className={`sidebar-item ${s.id === sessionId ? "active" : ""}`} onClick={() => {
                setSessionId(s.id);
                localStorage.setItem("travel_session_id", s.id);
                loadSession(s.id);
                setSidebarOpen(false);
                setTab("chat");
              }}>
                <span className="sidebar-item-text">{s.title}</span>
                <div className="sidebar-item-actions">
                  <button onClick={(e) => { e.stopPropagation(); ChatHistory.delete(s.id); updateSessionsList(); if(s.id === sessionId) handleNewChat(); }} title="Xóa">🗑️</button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
      <div className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`} onClick={() => setSidebarOpen(false)}></div>

      {/* Main Content */}
      <div className="app">
        <header className="header">
          <div className="header-left">
            <button className="btn-icon" title="Lịch sử chat" onClick={() => setSidebarOpen(true)}>☰</button>
            <div className="header-brand">
              <span className="header-logo">✈️</span>
              <div>
                <div className="header-title">Travel Optimization Engine</div>
                <div className="header-subtitle">AI-Powered Flight Search</div>
              </div>
            </div>
          </div>
          <div className="header-tabs">
            <button className={`tab-btn ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>💬 Chat</button>
            <button className={`tab-btn ${tab === "compare" ? "active" : ""}`} onClick={() => setTab("compare")}>📊 So sánh phí</button>
          </div>
          <div className="header-actions">
            <button className="btn-icon theme-toggle-btn" title={theme === "dark" ? "Chuyển sang Giao diện Sáng" : "Chuyển sang Giao diện Tối"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button className="btn-icon" title="Xóa cuộc hội thoại" onClick={handleClearChat}>🗑️</button>
          </div>
        </header>

        {statusText && (
          <div className="status-bar" style={{ display: "flex" }}>
            <span>{statusText}</span>
          </div>
        )}

        {/* Chat Tab */}
        <div className={`tab-content ${tab === "chat" ? "active" : ""}`}>
          <div className="chat-container" ref={chatContainerRef}>
            {messages.length === 0 && (
              <div className="welcome">
                <div className="welcome-icon">✈️</div>
                <h2>Xin chào! Tôi là AI Travel Agent</h2>
                <p>Tôi giúp bạn tìm vé máy bay giá tốt nhất, phân tích phí ẩn và tối ưu chi phí. Hãy cho tôi biết bạn muốn bay đi đâu!</p>
                <div className="quick-prompts">
                  <button className="quick-prompt" onClick={() => sendMessage("Tìm vé SGN đi HAN ngày 20/06/2026, 1 người lớn")}>
                    <span className="quick-prompt-icon">🇻🇳</span> Bay nội địa SGN → HAN
                  </button>
                  <button className="quick-prompt" onClick={() => sendMessage("Find cheapest flight from Hanoi to San Francisco in June 2026")}>
                    <span className="quick-prompt-icon">🌏</span> International HAN → SFO
                  </button>
                  <button className="quick-prompt" onClick={() => sendMessage("So sánh giá vé HCM đi Đà Nẵng tuần tới, 2 người lớn 1 trẻ em")}>
                    <span className="quick-prompt-icon">👨‍👩‍👦</span> Gia đình đi Đà Nẵng
                  </button>
                  <button className="quick-prompt" onClick={() => sendMessage("Tôi muốn bay từ SGN đi Bangkok, ngày linh hoạt, tìm giá rẻ nhất")}>
                    <span className="quick-prompt-icon">💰</span> Săn vé rẻ SGN → BKK
                  </button>
                </div>
              </div>
            )}

            {messages.map((m, idx) => (
              <div key={idx} className={`message message-${m.role}`}>
                <div className="message-avatar">{m.role === "user" ? "👤" : "✈️"}</div>
                <div className="message-content" dangerouslySetInnerHTML={{ __html: m.role === "ai" ? renderMarkdown(m.content) : m.content }}></div>
              </div>
            ))}

            <div className={`typing-indicator ${isWaiting ? "active" : ""}`}>
              <div className="message-avatar">✈️</div>
              <div className="typing-dots"><span></span><span></span><span></span></div>
            </div>
          </div>

          <div className="input-area">
            <div className="input-wrapper">
              <textarea
                className="input-field"
                placeholder="Nhập yêu cầu tìm vé máy bay..."
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button className={`btn-send ${isWaiting ? "stopping" : ""}`} onClick={() => (isWaiting ? stopResponse() : sendMessage())}>
                {isWaiting ? "⬛" : "➤"}
              </button>
            </div>
            <div className="input-hint">Nhấn Enter để gửi · Shift + Enter để xuống dòng</div>
          </div>
        </div>

        {/* Compare Tab */}
        <div className={`tab-content ${tab === "compare" ? "active" : ""}`}>
          <div className="compare-container">
            <div className="compare-header">
              <h2>📊 So sánh phí ẩn hãng bay</h2>
              <p>Nhập thông tin 2-3 chuyến bay để so sánh chi phí thực tế (TRUE cost) sau khi tính phí ẩn.</p>
            </div>
            <form className="compare-form" onSubmit={handleCompare}>
              <div className="compare-flights">
                {compareRows.map((r, idx) => (
                  <div key={r.id} className="compare-flight-row">
                    <span className="flight-row-label">{idx + 1}</span>
                    <input type="text" className="compare-input" placeholder="Hãng bay" value={r.airline} onChange={(e) => updateRow(idx, "airline", e.target.value)} required />
                    <div className="compare-price-wrapper">
                      <span className="currency-prefix">$</span>
                      <input type="number" className="compare-input compare-price" placeholder="Giá vé" value={r.price} onChange={(e) => updateRow(idx, "price", e.target.value)} min="1" required />
                    </div>
                  </div>
                ))}
              </div>
              {compareRows.length < 5 && (
                <button type="button" className="compare-add-row" onClick={addCompareRow}>+ Thêm hãng bay</button>
              )}
              <div className="compare-options">
                <label className="compare-checkbox">
                  <input type="checkbox" checked={compareOpts.carryOn} onChange={(e) => setCompareOpts({ ...compareOpts, carryOn: e.target.checked })} />
                  <span>🧳 Hành lý xách tay (7kg)</span>
                </label>
                <label className="compare-checkbox">
                  <input type="checkbox" checked={compareOpts.checked} onChange={(e) => setCompareOpts({ ...compareOpts, checked: e.target.checked })} />
                  <span>🛄 Hành lý ký gửi (20kg)</span>
                </label>
              </div>
              <button type="submit" className="compare-submit-btn" disabled={isComparing}>
                {isComparing ? "⏳ Đang phân tích..." : "🔍 So sánh ngay"}
              </button>
            </form>

            {compareResults && (
              <div className="compare-results">
                <h3>📋 Kết quả so sánh</h3>
                <table>
                  <tbody>
                    <tr><th>Hãng bay</th><th>Giá vé</th><th>Xách tay</th><th>Ký gửi</th><th>Chỗ ngồi</th><th>TRUE Total</th></tr>
                    {compareResults.results.map((r: any, i: number) => (
                      <tr key={i} className={i === 0 ? "cheapest-row" : ""}>
                        <td>{r.airline} {i === 0 ? "💰" : ""}</td>
                        <td>${r.advertised_price.toFixed(0)}</td>
                        <td>{r.carry_on_fee > 0 ? "+$" + r.carry_on_fee.toFixed(0) : "✅ Free"}</td>
                        <td>{r.checked_bag_fee > 0 ? "+$" + r.checked_bag_fee.toFixed(0) : "—"}</td>
                        <td>{r.seat_fee > 0 ? "+$" + r.seat_fee.toFixed(0) : "✅ Free"}</td>
                        <td className="true-total">${r.true_total.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="compare-insights">
                  <div className="insight-card">💰 Giá quảng cáo rẻ nhất: <strong>{compareResults.cheapest_advertised}</strong></div>
                  <div className="insight-card">✅ Chi phí thực rẻ nhất: <strong>{compareResults.cheapest_true}</strong></div>
                  <div className="insight-card">⚠️ Phí ẩn nhiều nhất: <strong>{compareResults.biggest_hidden_cost}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
