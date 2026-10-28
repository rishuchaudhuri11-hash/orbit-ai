import "./style.css";

const app = document.querySelector("#app");
const icons = {
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  bot: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M9 13h.01M15 13h.01M9 17h6"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>'
};

let messages = [];
let busy = false;
let sidebarOpen = false;

app.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><div class="brand-mark">${icons.spark}</div><span>orbit<span class="brand-light">.ai</span></span></div>
      <button class="new-chat" id="new-chat">${icons.plus}<span>New chat</span><kbd>⌘ K</kbd></button>
      <div class="side-label">YOUR SPACE</div>
      <div class="side-item active">${icons.spark}<span>AI Assistant</span><span class="live-dot"></span></div>
      <div class="side-bottom">
        <div class="status-card"><span class="status-pulse"></span><div><strong>Groq engine</strong><small>Fast AI responses</small></div><span class="status-ok">●</span></div>
        <div class="profile"><div class="avatar user-avatar">Y</div><div class="profile-copy"><strong>Your workspace</strong><small>Personal plan</small></div><button class="icon-button small" id="clear-chat" title="Clear conversation" aria-label="Clear conversation">${icons.trash}</button></div>
      </div>
    </aside>
    <div class="mobile-backdrop" id="backdrop"></div>
    <main class="main">
      <header class="topbar">
        <button class="icon-button menu-button" id="menu-toggle" aria-label="Toggle menu">${icons.menu}</button>
        <div class="breadcrumb"><span>Workspace</span><span class="crumb-slash">/</span><strong>AI Assistant</strong></div>
        <div class="top-right"><span class="model-pill"><span class="model-dot"></span> Groq-powered</span><button class="top-avatar" title="Your workspace">Y</button></div>
      </header>
      <section class="conversation" id="conversation">
        <div class="welcome" id="welcome">
          <div class="welcome-icon">${icons.spark}</div>
          <div class="eyebrow"><span></span> YOUR AI, AT YOUR PACE</div>
          <h1>Ideas start<br>with a <em>question.</em></h1>
          <p class="welcome-subtitle">A little curiosity can take you anywhere.<br>What would you like to explore today?</p>
          <div class="suggestions">
            <button class="suggestion" data-prompt="Explain a complex topic in simple words"><span class="suggestion-icon violet">✳</span><span><strong>Learn something new</strong><small>Make a complex topic simple</small></span><span class="suggestion-arrow">↗</span></button>
            <button class="suggestion" data-prompt="Help me brainstorm a unique startup idea"><span class="suggestion-icon amber">◇</span><span><strong>Brainstorm ideas</strong><small>Turn a thought into a plan</small></span><span class="suggestion-arrow">↗</span></button>
            <button class="suggestion" data-prompt="Help me write a clear and engaging piece of content"><span class="suggestion-icon blue">✎</span><span><strong>Write something</strong><small>Find the right words</small></span><span class="suggestion-arrow">↗</span></button>
            <button class="suggestion" data-prompt="Give me a step-by-step plan to learn a new skill"><span class="suggestion-icon green">⌁</span><span><strong>Build a roadmap</strong><small>Make progress, one step at a time</small></span><span class="suggestion-arrow">↗</span></button>
          </div>
        </div>
        <div class="messages" id="messages" aria-live="polite"></div>
      </section>
      <footer class="composer-area">
        <form class="composer" id="chat-form">
          <textarea id="prompt" rows="1" placeholder="Message Orbit..." aria-label="Message Orbit" maxlength="12000"></textarea>
          <div class="composer-bottom"><span class="composer-hint"><span class="hint-dot"></span> AI can make mistakes. Verify important information.</span><button class="send-button" id="send-button" type="submit" aria-label="Send message">${icons.send}</button></div>
        </form>
        <div class="footer-note">Made for curious minds <span>✦</span></div>
      </footer>
    </main>
  </div>
  <div class="toast" id="toast" role="status"></div>
`;

const conversation = document.querySelector("#conversation");
const messagesEl = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const promptEl = document.querySelector("#prompt");
const form = document.querySelector("#chat-form");
const sendButton = document.querySelector("#send-button");
const sidebar = document.querySelector("#sidebar");
const backdrop = document.querySelector("#backdrop");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 2800);
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}

// Lightweight formatting for paragraphs, code blocks, bold and inline code.
function formatMessage(text) {
  const escaped = escapeHtml(text);
  const codeBlocks = [];
  let safe = escaped.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
    const token = `@@CODE${codeBlocks.length}@@`;
    codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
    return token;
  });
  safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
  safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  safe = safe.split(/\n{2,}/).map((p) => {
    if (/^@@CODE\d+@@$/.test(p.trim())) return p.trim();
    if (/^(?:[-*] .+(?:\n|$))+/m.test(p)) {
      const items = p.split("\n").filter(Boolean).map((line) => `<li>${line.replace(/^[-*]\s+/, "")}</li>`).join("");
      return `<ul>${items}</ul>`;
    }
    return `<p>${p.replace(/\n/g, "<br>")}</p>`;
  }).join("");
  return safe.replace(/@@CODE(\d+)@@/g, (_m, i) => codeBlocks[Number(i)] || "");
}

function scrollToBottom() {
  conversation.scrollTop = conversation.scrollHeight;
}

function renderMessages() {
  welcome.hidden = messages.length > 0;
  messagesEl.innerHTML = messages.map((m, index) => `
    <article class="message ${m.role === "user" ? "user-message" : "assistant-message"}">
      <div class="message-avatar ${m.role === "user" ? "user-avatar" : "bot-avatar"}">${m.role === "user" ? "Y" : icons.bot}</div>
      <div class="message-body">
        <div class="message-heading"><strong>${m.role === "user" ? "You" : "Orbit AI"}</strong><span>${m.role === "assistant" ? "AI assistant" : "You"}</span></div>
        <div class="message-content">${formatMessage(m.content)}</div>
        ${m.role === "assistant" ? `<button class="copy-button" data-copy="${index}" title="Copy response">${icons.copy}<span>Copy</span></button>` : ""}
      </div>
    </article>
  `).join("");
  messagesEl.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const message = messages[Number(button.dataset.copy)];
      try {
        await navigator.clipboard.writeText(message.content);
        showToast("Response copied");
      } catch {
        showToast("Copy isn't available in this browser");
      }
    });
  });
  scrollToBottom();
}

function setBusy(value) {
  busy = value;
  sendButton.disabled = value;
  sendButton.innerHTML = value
    ? '<span class="spinner"></span>'
    : icons.send;
  promptEl.disabled = value;
  if (value) {
    messagesEl.insertAdjacentHTML("beforeend", `<div class="typing-row" id="typing"><div class="message-avatar bot-avatar">${icons.bot}</div><div class="typing-bubble"><span></span><span></span><span></span></div><small>Orbit is thinking</small></div>`);
    scrollToBottom();
  } else {
    document.querySelector("#typing")?.remove();
    promptEl.focus();
  }
}

async function sendMessage(text) {
  const content = text.trim();
  if (!content || busy) return;
  messages.push({ role: "user", content });
  renderMessages();
  promptEl.value = "";
  autoResize();
  setBusy(true);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    messages.push({ role: "assistant", content: data.reply });
    renderMessages();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reach the server.";
    messages.push({ role: "assistant", content: `Sorry, I couldn't get a response. ${message}` });
    renderMessages();
  } finally {
    setBusy(false);
  }
}

function autoResize() {
  promptEl.style.height = "auto";
  promptEl.style.height = `${Math.min(promptEl.scrollHeight, 160)}px`;
}
promptEl.addEventListener("input", autoResize);
promptEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(promptEl.value);
});
document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt));
});
function newChat() {
  messages = [];
  renderMessages();
  promptEl.value = "";
  autoResize();
  closeSidebar();
  promptEl.focus();
}
document.querySelector("#new-chat").addEventListener("click", newChat);
document.querySelector("#clear-chat").addEventListener("click", () => {
  if (messages.length && !confirm("Clear this conversation?")) return;
  newChat();
  showToast("Conversation cleared");
});
function openSidebar() {
  sidebarOpen = true;
  sidebar.classList.add("open");
  backdrop.classList.add("visible");
}
function closeSidebar() {
  sidebarOpen = false;
  sidebar.classList.remove("open");
  backdrop.classList.remove("visible");
}
document.querySelector("#menu-toggle").addEventListener("click", () => sidebarOpen ? closeSidebar() : openSidebar());
backdrop.addEventListener("click", closeSidebar);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    newChat();
  }
});
