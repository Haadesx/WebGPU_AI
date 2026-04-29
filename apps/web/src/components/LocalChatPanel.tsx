import React, { useEffect, useRef, useState } from "react";
import type { ChatMessage, EdgeModelOption, GenerationSettings, ModelLoadProgress } from "../types";
import type { EdgeEngine } from "../lib/edge-engine";

interface Props {
  engine: EdgeEngine;
  models: EdgeModelOption[];
  selectedModel: string;
  onSelectModel: (id: string) => void;
  onLoadModel: () => Promise<void> | void;
  onUnloadModel: () => Promise<void> | void;
  isLoaded: boolean;
  isLoading: boolean;
  loadProgress: ModelLoadProgress | null;
  gpuSupported: boolean;
  gpuError: string;
}

interface ChatBubble extends ChatMessage {
  id: string;
}

const defaultSettings: GenerationSettings = {
  temperature: 0.7,
  top_p: 0.9,
  max_new_tokens: 256,
};

const starterPrompts = [
  "Summarize what this project proves about local WebGPU models.",
  "Write a short privacy-first assistant reply for an on-device chatbot.",
  "Compare Qwen 2.5 1.5B and Llama 3.1 8B for fast local inference.",
];

const systemPrompt =
  "You are a helpful local AI assistant running inside the browser. Keep answers concise, clear, and practical.";

const LocalChatPanel: React.FC<Props> = ({
  engine,
  models,
  selectedModel,
  onSelectModel,
  onLoadModel,
  onUnloadModel,
  isLoaded,
  isLoading,
  loadProgress,
  gpuSupported,
  gpuError,
}) => {
  const [messages, setMessages] = useState<ChatBubble[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Load a local model to start chatting entirely in the browser.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = messagesRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  async function sendMessage(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || !isLoaded || isSending) return;

    const userMessage: ChatBubble = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: ChatBubble = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    const nextMessages = [...messages, userMessage];
    setMessages([...nextMessages, assistantMessage]);
    setDraft("");
    setError("");
    setIsSending(true);

    try {
      await engine.chat(
        [
          { role: "system", content: systemPrompt },
          ...nextMessages.map(({ role, content }) => ({ role, content })),
        ],
        defaultSettings,
        (token) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + token }
                : message
            )
          );
        }
      );
    } catch (err: any) {
      setError(err.message || "Failed to generate a response.");
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: "The local model failed to answer. Try reloading the model and sending again.",
              }
            : message
        )
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <aside className="dash-chat-panel">
      <div className="dash-chat-head">
        <div>
          <span className="dash-chat-kicker">New</span>
          <h3>Local Model Chat</h3>
          <p>Talk directly to the browser-loaded model instead of only running benchmarks.</p>
        </div>
        <span className={`badge ${isLoaded ? "badge-ok" : "badge-warn"}`}>
          {isLoaded ? "Model Ready" : "Model Offline"}
        </span>
      </div>

      {!gpuSupported && (
        <div className="dash-chat-alert">
          WebGPU is required for local chat. {gpuError || "This browser/device is not supported."}
        </div>
      )}

      <div className="dash-chat-controls">
        <label className="dash-chat-label">
          Local Model
          <select
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            disabled={isLoading || isLoaded}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label} ({model.sizeHint})
              </option>
            ))}
          </select>
        </label>

        <div className="dash-chat-actions">
          {!isLoaded ? (
            <button
              className="btn-primary"
              onClick={() => onLoadModel()}
              disabled={!gpuSupported || isLoading}
            >
              {isLoading ? "Loading…" : "Load Local Model"}
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => onUnloadModel()} disabled={isSending}>
              Unload Model
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={() =>
              setMessages([
                {
                  id: "welcome-reset",
                  role: "assistant",
                  content: "Chat cleared. Ask the local model anything.",
                },
              ])
            }
            disabled={isSending}
          >
            Clear Chat
          </button>
        </div>

        {isLoading && loadProgress && (
          <div>
            <div className="text-sm text-secondary">{loadProgress.text}</div>
            <div className="progress-container mt-4">
              <div
                className="progress-bar"
                style={{ width: `${Math.round(loadProgress.progress * 100)}%` }}
              />
            </div>
            <div className="text-xs text-muted mt-4">
              {Math.round(loadProgress.progress * 100)}%
            </div>
          </div>
        )}
      </div>

      <div className="dash-chat-starters">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt}
            className="dash-chat-starter"
            onClick={() => sendMessage(prompt)}
            disabled={!isLoaded || isSending}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div ref={messagesRef} className="dash-chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`chat-bubble ${message.role}`}>
            <span>{message.role === "user" ? "You" : "Local Model"}</span>
            <p>{message.content || (isSending && message.role === "assistant" ? "Thinking…" : "")}</p>
          </div>
        ))}
      </div>

      <div className="dash-chat-compose">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={isLoaded ? "Ask the local model something…" : "Load a local model to begin chatting"}
          rows={4}
          disabled={!isLoaded || isSending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(draft);
            }
          }}
        />
        <button
          className="btn-primary"
          onClick={() => sendMessage(draft)}
          disabled={!isLoaded || isSending || !draft.trim()}
        >
          {isSending ? "Generating…" : "Send"}
        </button>
      </div>

      {error && <div className="dash-chat-error">{error}</div>}
    </aside>
  );
};

export default LocalChatPanel;
