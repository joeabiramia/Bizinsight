import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import MainLayout from "../components/layout/MainLayout";
import VoiceAssistant from "../components/VoiceAssistant";
import { askAiQuestion, fetchAiSuggestions, fetchDatasetPreview } from "../services/api";
import type { AIResponse, PreviewData } from "../types";

// ─── Dataset Intelligence Panel ───────────────────────────────────────────────

const CAPABILITY_ICONS: Record<string, string> = {
  revenue: "💰", sales: "📈", region: "🌍", product: "📦",
  salesperson: "👤", quantity: "📊", customer: "👥", date: "📅",
  price: "💲", margin: "📉", cost: "🏷️", profit: "💵",
};

function getColumnIcon(col: string): string {
  const c = col.toLowerCase();
  for (const [key, icon] of Object.entries(CAPABILITY_ICONS)) {
    if (c.includes(key)) return icon;
  }
  return "◈";
}

function DatasetIntelligencePanel({
  preview,
  suggestions,
  speakAnswers,
  onSpeakToggle,
  onSuggestionClick,
  loading,
}: {
  preview: PreviewData | null;
  suggestions: string[];
  speakAnswers: boolean;
  onSpeakToggle: (v: boolean) => void;
  onSuggestionClick: (q: string) => void;
  loading: boolean;
}) {
  const columns = preview?.columns ?? [];
  const rows = preview?.shape?.rows ?? 0;
  const cols = preview?.shape?.columns ?? 0;

  // Auto-detect context from column names
  const detectedContext = (() => {
    const all = columns.map((c) => c.toLowerCase()).join(" ");
    if (all.includes("booking") || all.includes("trip") || all.includes("destination")) return { label: "Travel & Bookings", icon: "✈️" };
    if (all.includes("sku") || all.includes("inventory") || all.includes("stock")) return { label: "Inventory", icon: "📦" };
    if (all.includes("customer") && all.includes("ltv")) return { label: "E-commerce", icon: "🛒" };
    if (all.includes("salesman") || all.includes("agent") || all.includes("rep")) return { label: "Sales Performance", icon: "📈" };
    if (all.includes("transaction") || all.includes("account")) return { label: "Finance", icon: "🏦" };
    if (all.includes("product") || all.includes("category")) return { label: "Retail", icon: "🏪" };
    return { label: "Business Analytics", icon: "📊" };
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        marginBottom: 20,
        background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 50%, rgba(15,23,42,0.6) 100%)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 20,
        overflow: "hidden",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Top row: identity + meta */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* AI brain icon */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
              boxShadow: "0 0 16px rgba(99,102,241,0.4)",
            }}
          >
            🧠
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.01em" }}>
                Dataset Intelligence
              </span>
              {/* Auto-detect badge */}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: "rgba(34,197,94,0.12)",
                  color: "#4ade80",
                  border: "1px solid rgba(34,197,94,0.25)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Auto-Detected
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              {detectedContext.icon} {detectedContext.label}
              {rows > 0 && (
                <span style={{ marginLeft: 8, color: "#64748b" }}>
                  · {rows.toLocaleString()} rows · {cols} columns
                </span>
              )}
            </div>
          </div>
        </div>

        {/* TTS toggle — compact and right-aligned */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            padding: "6px 14px",
            borderRadius: 99,
            background: speakAnswers ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
            border: speakAnswers ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(148,163,184,0.1)",
            transition: "all 0.2s",
          }}
        >
          <span style={{ fontSize: 14 }}>{speakAnswers ? "🔊" : "🔇"}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: speakAnswers ? "#818cf8" : "#64748b" }}>
            Voice
          </span>
          <input
            type="checkbox"
            checked={speakAnswers}
            onChange={(e) => onSpeakToggle(e.target.checked)}
            style={{ display: "none" }}
          />
          <div
            style={{
              width: 32,
              height: 18,
              borderRadius: 99,
              background: speakAnswers ? "#6366f1" : "rgba(255,255,255,0.1)",
              position: "relative",
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 2,
                left: speakAnswers ? 16 : 2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s",
              }}
            />
          </div>
        </label>
      </div>

      {/* Column chips row */}
      {columns.length > 0 && (
        <div
          style={{
            padding: "12px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginRight: 4 }}>
            Columns
          </span>
          {columns.slice(0, 10).map((col) => (
            <span
              key={col}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 10px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 600,
                background: "rgba(255,255,255,0.05)",
                color: "#94a3b8",
                border: "1px solid rgba(148,163,184,0.1)",
                fontFamily: "monospace",
              }}
            >
              <span style={{ fontSize: 12 }}>{getColumnIcon(col)}</span>
              {col}
            </span>
          ))}
          {columns.length > 10 && (
            <span style={{ fontSize: 11, color: "#475569" }}>+{columns.length - 10} more</span>
          )}
        </div>
      )}

      {/* Suggested questions as AI capabilities */}
      <div style={{ padding: "14px 24px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 10 }}>
          Ask me anything about this dataset
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {suggestions.length === 0
            ? [1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 30,
                    width: 160,
                    borderRadius: 99,
                    background: "rgba(255,255,255,0.04)",
                    animation: "shimmerAnim 1.6s ease-in-out infinite",
                    backgroundSize: "200% 100%",
                  }}
                />
              ))
            : suggestions.map((q) => (
                <motion.button
                  key={q}
                  type="button"
                  onClick={() => onSuggestionClick(q)}
                  disabled={loading}
                  whileHover={{ scale: 1.03, borderColor: "rgba(99,102,241,0.5)" }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: 500,
                    background: "rgba(99,102,241,0.06)",
                    color: "#a5b4fc",
                    border: "1px solid rgba(99,102,241,0.15)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ opacity: 0.7, fontSize: 13 }}>⚡</span>
                  {q}
                </motion.button>
              ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Chat message bubble ───────────────────────────────────────────────────────

function ChatBubble({ item, index }: { item: AIResponse; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      {/* User question */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            maxWidth: "75%",
            padding: "10px 16px",
            borderRadius: "18px 18px 4px 18px",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.5,
            boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
          }}
        >
          {item.question}
        </div>
      </div>

      {/* AI answer */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))",
            border: "1px solid rgba(99,102,241,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          🤖
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "4px 18px 18px 18px",
              background: "linear-gradient(145deg,rgba(30,41,59,0.9),rgba(15,23,42,0.95))",
              border: "1px solid rgba(148,163,184,0.12)",
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Source badges */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {item.source === "rag_openai" && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "rgba(99,102,241,0.15)",
                    color: "#818cf8",
                    border: "1px solid rgba(99,102,241,0.3)",
                  }}
                >
                  🧠 GPT-4o
                </span>
              )}
              {item.source === "structured_query" && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "rgba(34,197,94,0.1)",
                    color: "#4ade80",
                    border: "1px solid rgba(34,197,94,0.25)",
                  }}
                >
                  ⚡ Instant
                </span>
              )}
              {item.grounded && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "rgba(34,197,94,0.08)",
                    color: "#86efac",
                    border: "1px solid rgba(34,197,94,0.15)",
                  }}
                >
                  ✓ Grounded
                </span>
              )}
            </div>

            <p
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: "#e2e8f0",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {item.answer}
            </p>

            {item.insights && item.insights.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {item.insights.map((ins, j) => (
                  <p key={j} style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                    <span style={{ color: "#6366f1", marginRight: 6 }}>•</span>
                    {ins}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Thinking bubble ───────────────────────────────────────────────────────────

function ThinkingBubble() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))",
          border: "1px solid rgba(99,102,241,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        🤖
      </div>
      <div
        style={{
          padding: "16px 20px",
          borderRadius: "4px 18px 18px 18px",
          background: "rgba(30,41,59,0.7)",
          border: "1px solid rgba(99,102,241,0.15)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
            style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1" }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Empty chat state ──────────────────────────────────────────────────────────

function EmptyChatState({ onPromptClick }: { onPromptClick: (q: string) => void }) {
  const STARTER_PROMPTS = [
    { icon: "💰", text: "What is the total revenue?" },
    { icon: "📈", text: "Who is the top performing salesperson?" },
    { icon: "🌍", text: "Which region has the highest sales?" },
    { icon: "📦", text: "What is the best selling product?" },
    { icon: "⚠️", text: "Are there any anomalies in the data?" },
    { icon: "📊", text: "Summarize the dataset for me" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ padding: "40px 24px", textAlign: "center" }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          margin: "0 auto 20px",
          boxShadow: "0 0 32px rgba(99,102,241,0.35)",
        }}
      >
        💬
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Ask anything about your data</h3>
      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 28px" }}>
        Type a question, click a suggestion, or use your voice
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 10,
          textAlign: "left",
          maxWidth: 560,
          margin: "0 auto",
        }}
      >
        {STARTER_PROMPTS.map((p) => (
          <motion.button
            key={p.text}
            type="button"
            whileHover={{ scale: 1.03, borderColor: "rgba(99,102,241,0.4)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPromptClick(p.text)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(30,41,59,0.7)",
              border: "1px solid rgba(148,163,184,0.1)",
              color: "#cbd5e1",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
              backdropFilter: "blur(8px)",
              transition: "border-color 0.15s",
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
            {p.text}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AIChatPage() {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<AIResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [speakAnswers, setSpeakAnswers] = useState(false);
  const [lastAnswer, setLastAnswer] = useState("");
  const historyEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resolvedId = fileId || localStorage.getItem("lastDatasetId") || "";

  useEffect(() => {
    if (!fileId) {
      const savedId = localStorage.getItem("lastDatasetId");
      if (savedId) navigate(`/ai-chat/${savedId}`, { replace: true });
    } else {
      localStorage.setItem("lastDatasetId", fileId);
    }
  }, [fileId, navigate]);

  useEffect(() => {
    if (!resolvedId) return;
    fetchAiSuggestions(resolvedId)
      .then((res) => setSuggestions(res.data.suggestions ?? []))
      .catch(() => setSuggestions([]));
    fetchDatasetPreview(resolvedId)
      .then((res) => setPreview(res.data))
      .catch(() => {});
  }, [resolvedId]);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const submitQuestion = async (value?: string) => {
    const prompt = (value ?? question).trim();
    if (!prompt || !resolvedId) return;
    setLoading(true);
    setError("");
    if (!value) setQuestion("");
    try {
      const response = await askAiQuestion(resolvedId, prompt);
      const item = response.data as AIResponse;
      setHistory((prev) => [...prev, item]);
      if (speakAnswers && item.answer) setLastAnswer(item.answer);
    } catch {
      setError("Unable to get an answer. Please check the connection and try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setQuestion(text);
    submitQuestion(text);
  };

  // ── No dataset ──────────────────────────────────────────────────────────────
  if (!resolvedId) {
    return (
      <MainLayout>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 400,
            gap: 20,
            padding: 48,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              boxShadow: "0 0 32px rgba(99,102,241,0.4)",
            }}
          >
            🤖
          </div>
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>AI Copilot</h2>
            <p style={{ color: "#64748b", margin: "0 0 24px" }}>Select a dataset to start your AI-powered business conversation.</p>
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/datasets")}
              style={{
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "12px 28px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 0 20px rgba(99,102,241,0.35)",
              }}
            >
              Browse Datasets
            </motion.button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ── Main layout ─────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <style>{`
        @keyframes shimmerAnim {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>

      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              boxShadow: "0 0 16px rgba(99,102,241,0.4)",
            }}
          >
            🤖
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6366f1", margin: 0 }}>
              AI Copilot
            </p>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>Business Intelligence Chat</h1>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <motion.button
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(-1)}
            style={{
              padding: "8px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              background: "rgba(255,255,255,0.05)",
              color: "#94a3b8",
              border: "1px solid rgba(148,163,184,0.15)",
              cursor: "pointer",
            }}
          >
            ← Back
          </motion.button>
          {history.length > 0 && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setHistory([])}
              style={{
                padding: "8px 18px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                background: "rgba(255,255,255,0.05)",
                color: "#94a3b8",
                border: "1px solid rgba(148,163,184,0.15)",
                cursor: "pointer",
              }}
            >
              Clear
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Dataset Intelligence Panel */}
      <DatasetIntelligencePanel
        preview={preview}
        suggestions={suggestions}
        speakAnswers={speakAnswers}
        onSpeakToggle={setSpeakAnswers}
        onSuggestionClick={(q) => submitQuestion(q)}
        loading={loading}
      />

      {/* Chat area */}
      <div
        style={{
          background: "linear-gradient(145deg,rgba(15,23,42,0.8),rgba(22,33,58,0.6))",
          border: "1px solid rgba(148,163,184,0.1)",
          borderRadius: 20,
          overflow: "hidden",
          backdropFilter: "blur(12px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Messages */}
        <div
          style={{
            minHeight: 360,
            maxHeight: 520,
            overflowY: "auto",
            padding: "24px 24px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(99,102,241,0.3) transparent",
          }}
        >
          {history.length === 0 && !loading ? (
            <EmptyChatState onPromptClick={(q) => submitQuestion(q)} />
          ) : (
            <>
              {history.map((item, i) => (
                <ChatBubble key={i} item={item} index={i} />
              ))}
              <AnimatePresence>
                {loading && <ThinkingBubble />}
              </AnimatePresence>
            </>
          )}
          <div ref={historyEndRef} />
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                margin: "0 16px",
                padding: "10px 14px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 10,
                fontSize: 13,
                color: "#fca5a5",
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitQuestion();
              }
            }}
            placeholder="Ask about revenue, regions, products, trends…"
            disabled={loading}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "12px 18px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(148,163,184,0.15)",
              color: "#e2e8f0",
              fontSize: 14,
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(148,163,184,0.15)"; }}
          />
          <VoiceAssistant
            onTranscript={handleVoiceTranscript}
            disabled={loading}
            readAnswer={speakAnswers ? lastAnswer : undefined}
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.04, boxShadow: "0 0 20px rgba(99,102,241,0.45)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => submitQuestion()}
            disabled={loading || !question.trim()}
            style={{
              padding: "12px 22px",
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 700,
              background:
                loading || !question.trim()
                  ? "rgba(99,102,241,0.3)"
                  : "linear-gradient(135deg,#6366f1,#8b5cf6)",
              color: "#fff",
              border: "none",
              cursor: loading || !question.trim() ? "not-allowed" : "pointer",
              flexShrink: 0,
              boxShadow: "0 0 12px rgba(99,102,241,0.3)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "background 0.2s",
            }}
          >
            {loading ? (
              <>
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
                  ⟳
                </motion.span>
                Thinking
              </>
            ) : (
              <>Send ↵</>
            )}
          </motion.button>
        </div>
      </div>
    </MainLayout>
  );
}
