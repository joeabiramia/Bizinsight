import { useEffect, useRef, useState } from "react";

interface VoiceAssistantProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  readAnswer?: string;
}

// Minimal Web Speech API type declarations for environments where tslib doesn't include them
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

export default function VoiceAssistant({ onTranscript, disabled = false, readAnswer }: VoiceAssistantProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const prevAnswerRef = useRef<string>("");

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  // Auto-read new answers when readAnswer prop changes
  useEffect(() => {
    if (!readAnswer || readAnswer === prevAnswerRef.current) return;
    prevAnswerRef.current = readAnswer;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(readAnswer);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  }, [readAnswer]);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      setInterim(interimText || finalText);
      if (finalText) {
        onTranscript(finalText.trim());
        setInterim("");
        setListening(false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(event.error === "not-allowed" ? "Microphone access denied" : `Error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setError("");
    setInterim("");
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  if (!supported) return null;

  return (
    <div className="voice-assistant" style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {interim && (
        <span
          style={{
            fontSize: 13,
            color: "var(--accent, #6366f1)",
            fontStyle: "italic",
            maxWidth: 200,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          "{interim}…"
        </span>
      )}
      {error && (
        <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>
      )}
      <button
        type="button"
        onClick={listening ? stopListening : startListening}
        disabled={disabled}
        title={listening ? "Stop listening" : "Ask by voice"}
        style={{
          background: listening ? "#ef4444" : "var(--accent, #6366f1)",
          color: "#fff",
          border: "none",
          borderRadius: "50%",
          width: 40,
          height: 40,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          transition: "all 0.2s",
          boxShadow: listening ? "0 0 0 4px rgba(239,68,68,0.3)" : "none",
          flexShrink: 0,
        }}
      >
        {listening ? "⏹" : "🎤"}
      </button>
      {"speechSynthesis" in window && (
        <button
          type="button"
          onClick={stopSpeaking}
          title="Stop reading"
          style={{
            background: "transparent",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: "50%",
            width: 36,
            height: 36,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            color: "var(--text-secondary)",
            flexShrink: 0,
          }}
        >
          🔇
        </button>
      )}
    </div>
  );
}
