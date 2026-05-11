import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import { askAiQuestion } from "../services/api";
import { AIResponse } from "../types";

const SUGGESTED_PROMPTS = [
  "What is the total revenue?",
  "Show me the top region by revenue.",
  "Who is the best salesperson?",
  "What is the average quantity sold?",
  "Which product is selling the most?",
  "What is the lowest-performing region?",
  "How many rows are in this dataset?",
  "What columns does this dataset have?",
];

export default function AIChatPage() {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<AIResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const historyEndRef = useRef<HTMLDivElement>(null);

  const resolvedId = fileId || localStorage.getItem("lastDatasetId") || "";

  useEffect(() => {
    if (!fileId) {
      const savedId = localStorage.getItem("lastDatasetId");
      if (savedId) {
        navigate(`/ai-chat/${savedId}`, { replace: true });
      }
    } else {
      localStorage.setItem("lastDatasetId", fileId);
    }
  }, [fileId, navigate]);

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
      setHistory((prev) => [...prev, response.data as AIResponse]);
    } catch {
      setError("Unable to get an answer. Please check the backend and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  };

  if (!resolvedId) {
    return (
      <MainLayout>
        <div className="page-hero">
          <div>
            <p className="eyebrow">AI Copilot</p>
            <h1>No dataset selected</h1>
          </div>
        </div>
        <div className="no-dataset-state">
          <h3>Select a dataset first</h3>
          <p>Go to the Datasets page and open an analysis to enable AI chat.</p>
          <button type="button" className="button button-primary" onClick={() => navigate("/datasets")}>
            Browse datasets
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="page-hero">
        <div>
          <p className="eyebrow">AI Copilot</p>
          <h1>Ask your dataset</h1>
          <p className="section-description">
            Ask business questions in plain English — the AI answers from your actual data.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button button-secondary" onClick={() => navigate(-1)}>
            Back to analysis
          </button>
          {history.length > 0 && (
            <button type="button" className="button button-secondary" onClick={() => setHistory([])}>
              Clear chat
            </button>
          )}
        </div>
      </div>

      <div className="chat-shell">
        <div className="chat-side-panel">
          <p className="chat-sidebar-title">Suggested questions</p>
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              className="chip"
              onClick={() => submitQuestion(prompt)}
              type="button"
              disabled={loading}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="chat-body">
          <div className="input-group">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about revenue, products, regions, salespeople…"
              disabled={loading}
            />
            <button
              type="button"
              className="button button-primary"
              onClick={() => submitQuestion()}
              disabled={loading || !question.trim()}
            >
              {loading ? "Thinking…" : "Ask AI"}
            </button>
          </div>

          {error ? <div className="alert alert-error">{error}</div> : null}

          {history.length === 0 && !loading ? (
            <div className="empty-state-card">
              <p>Ask a business question above to get an instant, data-aware answer.</p>
            </div>
          ) : (
            <div className="chat-history">
              {history.map((item, i) => (
                <div className="answer-card" key={i}>
                  <p className="chat-q">Q: {item.question}</p>
                  <p className="tag">{item.supported ? "Answer" : "Insight summary"}</p>
                  <p className={`answer-text${!item.supported ? " chat-unsupported" : ""}`}>
                    {item.answer}
                  </p>
                  {item.insights && item.insights.length > 0 ? (
                    <div className="insight-list">
                      {item.insights.map((insight, j) => (
                        <p key={j} className="insight-item">• {insight}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              <div ref={historyEndRef} />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
