import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Trash2, Database, Send, Sparkles, CheckCircle2, ChevronDown } from "lucide-react";
import ConfirmModal from "../components/ConfirmModal";
import MainLayout from "../components/layout/MainLayout";
import VoiceAssistant from "../components/VoiceAssistant";
import NLChart, { detectChartRequest, buildChartFromResponse, type NLChartData } from "../components/NLChart";
import { askAiQuestion, fetchAiSuggestions, fetchDatasetPreview, listDatasets, fetchChatHistory, clearChatHistoryApi } from "../services/api";
import type { AIResponse, PreviewData } from "../types";

interface Dataset { file_id: string; filename: string; }

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
          borderBottom: "1px solid var(--border)",
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
            background: speakAnswers ? "rgba(99,102,241,0.15)" : "var(--surface-alt)",
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
                background: "var(--surface-alt)",
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
                    background: "var(--surface-alt)",
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

function ChatBubble({ item, index, chartData }: { item: AIResponse; index: number; chartData?: Record<string, Array<{name:string;value:number}>> }) {
  const [chart, setChart] = useState<NLChartData | null>(null);
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    if (detectChartRequest(item.question) && chartData) {
      const c = buildChartFromResponse(item.question, chartData);
      if (c) { setChart(c); setShowChart(true); }
    }
  }, [item.question, chartData]);

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
            flexShrink: 0,
            color: "#a5b4fc",
          }}
        >
          <Bot size={16} />
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
              {item.source && (
                <span className="badge badge-primary" style={{ fontSize: "0.65rem" }}>
                  <Sparkles size={9} /> ChatGPT
                </span>
              )}
              {item.grounded && (
                <span className="badge badge-success" style={{ fontSize: "0.65rem" }}>
                  <CheckCircle2 size={9} /> Grounded
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
                  borderTop: "1px solid var(--border)",
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

            {/* Chart toggle */}
            {chart && (
              <button
                type="button"
                style={{
                  marginTop: 10, padding: "5px 12px", borderRadius: 8,
                  background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                  color: "#a5b4fc", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                }}
                onClick={() => setShowChart(!showChart)}
              >
                📊 {showChart ? "Hide chart" : "Show chart"}
              </button>
            )}
          </div>

          {/* NL Chart */}
          {chart && showChart && (
            <NLChart chart={chart} onClose={() => setShowChart(false)} />
          )}
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

function EmptyChatState({
  onPromptClick,
  suggestions,
}: {
  onPromptClick: (q: string) => void;
  suggestions: string[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ padding: "40px 24px", textAlign: "center" }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 18px",
          boxShadow: "0 0 24px rgba(99,102,241,0.3)",
          color: "white",
        }}
      >
        <Bot size={26} />
      </div>
      <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
        Ask anything about your data
      </h3>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.84rem", margin: "0 0 24px" }}>
        Type a question, click a suggestion, or use your voice
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 8,
          textAlign: "left",
          maxWidth: 520,
          margin: "0 auto",
        }}
      >
        {suggestions.length === 0
          ? /* loading shimmer slots */
            [1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  height: 42,
                  borderRadius: 10,
                  background: "linear-gradient(90deg,rgba(255,255,255,0.04) 25%,var(--border) 50%,rgba(255,255,255,0.04) 75%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmerAnim 1.6s ease-in-out infinite",
                }}
              />
            ))
          : suggestions.map((text) => (
              <motion.button
                key={text}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPromptClick(text)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--surface-alt)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  fontSize: "0.82rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)";
                  e.currentTarget.style.color = "var(--text)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <Sparkles size={12} style={{ color: "var(--primary-light)", flexShrink: 0 }} />
                {text}
              </motion.button>
            ))}
      </div>
    </motion.div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AIChatPage() {
  const { fileId: paramFileId } = useParams();
  const navigate = useNavigate();

  // Dataset list + active selection (persisted in localStorage, not the URL)
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>(
    paramFileId || localStorage.getItem("lastDatasetId") || ""
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  // Chat state
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<AIResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [speakAnswers, setSpeakAnswers] = useState(false);
  const [lastAnswer, setLastAnswer] = useState("");
  const [chartData, setChartData] = useState<Record<string, Array<{name:string;value:number}>> | undefined>(undefined);
  const [confirmClear, setConfirmClear] = useState(false);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load dataset list once; auto-select first if nothing saved
  useEffect(() => {
    listDatasets().then((res) => {
      const ds: Dataset[] = res.data.datasets ?? [];
      setDatasets(ds);
      if (!activeFileId && ds.length > 0) {
        setActiveFileId(ds[0].file_id);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When URL param arrives (e.g. navigating from Analysis page), honour it
  useEffect(() => {
    if (paramFileId && paramFileId !== activeFileId) {
      setActiveFileId(paramFileId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramFileId]);

  // Persist selection + reload dataset data + restore chat history whenever activeFileId changes
  useEffect(() => {
    if (!activeFileId) return;
    localStorage.setItem("lastDatasetId", activeFileId);
    setSuggestions([]);
    setPreview(null);
    setHistory([]);
    setError("");

    // Restore previous conversation from server
    fetchChatHistory(activeFileId)
      .then((res) => {
        const msgs: Array<{ role: string; content: string }> = res.data ?? [];
        // Pair up user + assistant messages into AIResponse objects
        const restored: AIResponse[] = [];
        for (let i = 0; i < msgs.length - 1; i++) {
          if (msgs[i].role === "user" && msgs[i + 1].role === "assistant") {
            restored.push({
              question: msgs[i].content,
              answer: msgs[i + 1].content,
              supported: true,
              source: "history",
            } as AIResponse);
            i++; // skip the assistant message we just consumed
          }
        }
        if (restored.length) setHistory(restored);
      })
      .catch(() => {});

    fetchAiSuggestions(activeFileId)
      .then((res) => setSuggestions(res.data.suggestions ?? []))
      .catch(() => setSuggestions([]));
    fetchDatasetPreview(activeFileId)
      .then((res) => {
        setPreview(res.data);
        if (res.data?.chart_data) setChartData(res.data.chart_data as Record<string, Array<{name:string;value:number}>>);
      })
      .catch(() => {});
  }, [activeFileId]);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const submitQuestion = async (value?: string) => {
    const prompt = (value ?? question).trim();
    if (!prompt || !activeFileId) return;
    setLoading(true);
    setError("");
    if (!value) setQuestion("");
    try {
      const response = await askAiQuestion(activeFileId, prompt);
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

  const handleClearConfirmed = async () => {
    setConfirmClear(false);
    setHistory([]);
    setError("");
    if (activeFileId) clearChatHistoryApi(activeFileId).catch(() => {});
  };

  const activeDataset = datasets.find((d) => d.file_id === activeFileId);

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
        className="page-hero"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <p className="eyebrow">AI Copilot</p>
          <h1>Business Intelligence Chat</h1>
          <p className="section-description">
            Ask plain-English questions about your data and get instant AI-powered answers.
          </p>
        </div>
        <div className="hero-actions">
          {history.length > 0 && (
            <button
              type="button"
              className="button button-secondary button-sm"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={14} /> Clear chat
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Dataset picker bar ─────────────────────────────────────────────── */}
      <div style={{
        marginBottom: 20,
        padding: "12px 18px",
        borderRadius: 14,
        background: "var(--surface-alt)",
        border: "1px solid rgba(148,163,184,0.1)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <Database size={15} style={{ color: "var(--primary-light)", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", flexShrink: 0 }}>Dataset</span>

        {datasets.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>No datasets uploaded yet.</span>
            <button
              type="button"
              className="button button-primary button-sm"
              onClick={() => navigate("/upload")}
            >
              Upload Data
            </button>
          </div>
        ) : (
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: 10, padding: "7px 14px",
                color: "#e2e8f0", fontSize: 13, fontWeight: 600,
                cursor: "pointer", maxWidth: 380,
              }}
            >
              <span style={{
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1, textAlign: "left",
              }}>
                {activeDataset?.filename ?? "Select a dataset…"}
              </span>
              <ChevronDown
                size={14}
                style={{
                  flexShrink: 0, color: "#818cf8",
                  transform: pickerOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                }}
              />
            </button>

            {pickerOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
                  minWidth: 260, maxWidth: 380,
                  background: "#1e293b", border: "1px solid rgba(99,102,241,0.2)",
                  borderRadius: 12, padding: 6,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                }}
              >
                {datasets.map((d) => (
                  <button
                    key={d.file_id}
                    type="button"
                    onClick={() => { setActiveFileId(d.file_id); setPickerOpen(false); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "9px 14px", borderRadius: 8, border: "none",
                      background: d.file_id === activeFileId
                        ? "rgba(99,102,241,0.15)" : "transparent",
                      color: d.file_id === activeFileId ? "#a5b4fc" : "#94a3b8",
                      fontSize: 13, fontWeight: d.file_id === activeFileId ? 700 : 400,
                      cursor: "pointer",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {d.filename}
                  </button>
                ))}
                <div style={{
                  borderTop: "1px solid var(--border)",
                  marginTop: 4, paddingTop: 4,
                }}>
                  <button
                    type="button"
                    onClick={() => { setPickerOpen(false); navigate("/upload"); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "9px 14px", borderRadius: 8,
                      border: "none", background: "transparent",
                      color: "#6366f1", fontSize: 13, fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Upload new dataset
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* ── No dataset selected placeholder ───────────────────────────────── */}
      {!activeFileId ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "60px 24px", textAlign: "center",
            background: "linear-gradient(145deg,rgba(15,23,42,0.8),rgba(22,33,58,0.6))",
            border: "1px solid rgba(148,163,184,0.1)", borderRadius: 20,
          }}
        >
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 18px",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 24px rgba(99,102,241,0.3)", color: "white",
          }}>
            <Bot size={26} />
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>
            Select a dataset to get started
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: "0 0 20px" }}>
            Upload a CSV or Excel file and the AI Copilot will answer questions about your data instantly.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button type="button" className="button button-primary" onClick={() => navigate("/upload")}>
              Upload Data
            </button>
            <button type="button" className="button button-secondary" onClick={() => navigate("/datasets")}>
              <Database size={14} /> Browse Datasets
            </button>
          </div>
        </motion.div>
      ) : (
        <>
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
          <div style={{
            background: "linear-gradient(145deg,rgba(15,23,42,0.8),rgba(22,33,58,0.6))",
            border: "1px solid rgba(148,163,184,0.1)",
            borderRadius: 20, overflow: "hidden",
            backdropFilter: "blur(12px)", display: "flex", flexDirection: "column",
          }}>
            {/* Messages */}
            <div style={{
              minHeight: 360, maxHeight: 520, overflowY: "auto",
              padding: "24px 24px 16px",
              display: "flex", flexDirection: "column", gap: 20,
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(99,102,241,0.3) transparent",
            }}>
              {history.length === 0 && !loading ? (
                <EmptyChatState onPromptClick={(q) => submitQuestion(q)} suggestions={suggestions} />
              ) : (
                <>
                  {history.map((item, i) => (
                    <ChatBubble key={i} item={item} index={i} chartData={chartData} />
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
                    margin: "0 16px", padding: "10px 14px",
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 10, fontSize: 13, color: "#fca5a5",
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input bar */}
            <div style={{
              padding: "16px 20px",
              borderTop: "1px solid var(--border)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
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
                  flex: 1, minWidth: 0, padding: "12px 18px",
                  borderRadius: 14, background: "var(--surface-alt)",
                  border: "1px solid rgba(148,163,184,0.15)",
                  color: "#e2e8f0", fontSize: 14, outline: "none",
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
                  padding: "12px 22px", borderRadius: 14,
                  fontSize: 14, fontWeight: 700,
                  background: loading || !question.trim()
                    ? "rgba(99,102,241,0.3)"
                    : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  color: "#fff", border: "none",
                  cursor: loading || !question.trim() ? "not-allowed" : "pointer",
                  flexShrink: 0, boxShadow: "0 0 12px rgba(99,102,241,0.3)",
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "background 0.2s",
                }}
              >
                {loading ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                      style={{ display: "flex" }}
                    >
                      <Send size={14} />
                    </motion.span>
                    Thinking…
                  </>
                ) : (
                  <><Send size={14} /> Send</>
                )}
              </motion.button>
            </div>
          </div>
        </>
      )}
      <ConfirmModal
        open={confirmClear}
        title="Clear conversation?"
        message="This will permanently delete all messages in this chat. This cannot be undone."
        confirmLabel="Clear chat"
        onConfirm={handleClearConfirmed}
        onCancel={() => setConfirmClear(false)}
      />
    </MainLayout>
  );
}
