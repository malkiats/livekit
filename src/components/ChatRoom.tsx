"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useTracks,
  VideoTrack,
  useChat,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

interface UserInfo {
  name: string;
  country: string;
  age: number;
}

interface ChatRoomProps {
  userInfo: UserInfo;
  serverUrl: string;
  onStop: () => void;
}

type MatchState = "searching" | "connected";

interface ChatMsg {
  from: string;
  message: string;
  isLocal: boolean;
}

export default function ChatRoom({ userInfo, serverUrl, onStop }: ChatRoomProps) {
  const [token, setToken] = useState("");
  const [matchState, setMatchState] = useState<MatchState>("searching");
  const [error, setError] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const excludeRoomRef = useRef("");
  const searchingRef = useRef(false);
  const mountedRef = useRef(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sendChatRef = useRef<((msg: string) => Promise<void>) | null>(null);

  // Start local camera independently — never tears down on match changes
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const findMatch = useCallback(async () => {
    if (searchingRef.current) return;
    searchingRef.current = true;
    setMatchState("searching");
    setError("");
    setToken("");
    setChatMessages([]);
    sendChatRef.current = null;

    try {
      const res = await fetch("/api/get-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userInfo.name,
          country: userInfo.country,
          age: userInfo.age,
          excludeRoom: excludeRoomRef.current,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to find match");
      }

      const data = await res.json();
      excludeRoomRef.current = data.room;
      setToken(data.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      searchingRef.current = false;
    }
  }, [userInfo.name, userInfo.country, userInfo.age]);

  // Auto-start searching on mount
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      findMatch();
    }
  }, [findMatch]);

  const handleNext = useCallback(() => {
    findMatch();
  }, [findMatch]);

  const handleStop = useCallback(() => {
    setToken("");
    onStop();
  }, [onStop]);

  const handleChatMessage = useCallback((msg: ChatMsg) => {
    setChatMessages((prev) => [...prev, msg]);
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!sendChatRef.current) return;
    try {
      await sendChatRef.current(text);
      setChatMessages((prev) => [...prev, { from: "You", message: text, isLocal: true }]);
    } catch {
      // silently fail
    }
  }, []);

  const isConnected = matchState === "connected";

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      {/* Header — always stable */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800 shrink-0">
        <h1 className="text-lg font-bold">LiveKit GlobalConnect</h1>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              isConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"
            }`}
          />
          <span className="text-sm text-gray-400">
            {isConnected ? "Connected" : "Searching..."}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left: Videos + Controls */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col sm:flex-row gap-2 p-2 min-h-0">
            {/* Local video — always stable, native getUserMedia */}
            <div className="relative flex-1 bg-gray-900 rounded-xl overflow-hidden min-h-[180px]">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <p className="text-xs text-white font-medium">You</p>
                <p className="text-xs text-gray-300">
                  {userInfo.name} · {userInfo.age} · {userInfo.country}
                </p>
              </div>
            </div>

            {/* Remote video — only this panel refreshes on match */}
            <div className="relative flex-1 bg-gray-900 rounded-xl overflow-hidden min-h-[180px]">
              {token ? (
                <LiveKitRoom
                  key={token}
                  token={token}
                  serverUrl={serverUrl}
                  connect={true}
                  video={true}
                  audio={true}
                  onDisconnected={() => {
                    if (matchState === "connected") {
                      findMatch();
                    }
                  }}
                  style={{ width: "100%", height: "100%", position: "relative" }}
                >
                  <RoomInner
                    matchState={matchState}
                    setMatchState={setMatchState}
                    onNext={handleNext}
                    onChatMessage={handleChatMessage}
                    sendChatRef={sendChatRef}
                  />
                  <RoomAudioRenderer />
                </LiveKitRoom>
              ) : (
                <SearchingOverlay error={error} onRetry={findMatch} />
              )}
            </div>
          </div>

          {/* Controls — always visible */}
          <div className="flex items-center justify-center gap-3 px-4 py-3 shrink-0">
            <button
              onClick={handleNext}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white text-sm transition cursor-pointer"
            >
              ⏭ Next
            </button>
            <button
              onClick={handleStop}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-white text-sm transition cursor-pointer"
            >
              ■ Stop
            </button>
          </div>
        </div>

        {/* Right: Chat panel — always visible */}
        <ChatPanel
          messages={chatMessages}
          isConnected={isConnected}
          onSend={handleSendMessage}
        />
      </div>
    </div>
  );
}

/* ─── Searching Overlay (no token yet) ─── */

function SearchingOverlay({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
      <div className="text-center space-y-3">
        <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-sm">Looking for someone...</p>
        {error && (
          <div className="space-y-2">
            <p className="text-red-400 text-xs">{error}</p>
            <button
              onClick={onRetry}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Room Inner (inside LiveKitRoom — remote video + match detection + exposes send) ─── */

interface RoomInnerProps {
  matchState: MatchState;
  setMatchState: (s: MatchState) => void;
  onNext: () => void;
  onChatMessage: (msg: ChatMsg) => void;
  sendChatRef: React.MutableRefObject<((msg: string) => Promise<void>) | null>;
}

function RoomInner({ matchState, setMatchState, onNext, onChatMessage, sendChatRef }: RoomInnerProps) {
  const remoteParticipants = useRemoteParticipants();
  const tracks = useTracks([Track.Source.Camera]);
  const { send, chatMessages } = useChat();
  const prevRemoteCountRef = useRef(0);
  const processedMsgCountRef = useRef(0);

  // Expose send function to parent via ref
  useEffect(() => {
    sendChatRef.current = send
      ? async (msg: string) => {
          await send(msg);
        }
      : null;
    return () => {
      sendChatRef.current = null;
    };
  }, [send, sendChatRef]);

  const remoteCameraTrack = tracks.find(
    (t) => !t.participant.isLocal && t.source === Track.Source.Camera
  );
  const remoteUser = remoteParticipants[0];
  const remoteInfo = remoteUser
    ? (() => {
        try {
          return JSON.parse(remoteUser.metadata || "{}");
        } catch {
          return {};
        }
      })()
    : null;

  // Detect remote participant joining
  useEffect(() => {
    if (remoteParticipants.length > 0 && matchState === "searching") {
      setMatchState("connected");
    }
  }, [remoteParticipants.length, matchState, setMatchState]);

  // Detect remote leaving
  useEffect(() => {
    if (
      prevRemoteCountRef.current > 0 &&
      remoteParticipants.length === 0 &&
      matchState === "connected"
    ) {
      onNext();
    }
    prevRemoteCountRef.current = remoteParticipants.length;
  }, [remoteParticipants.length, matchState, onNext]);

  // Auto-retry quickly if no match within 5s
  useEffect(() => {
    if (matchState === "searching") {
      const t = setTimeout(onNext, 5000);
      return () => clearTimeout(t);
    }
  }, [matchState, onNext]);

  // Forward incoming remote chat messages to parent
  useEffect(() => {
    const newMsgs = chatMessages.slice(processedMsgCountRef.current);
    newMsgs.forEach((msg) => {
      const isLocal = msg.from?.isLocal ?? false;
      if (!isLocal) {
        onChatMessage({
          from: msg.from?.name || "Stranger",
          message: msg.message,
          isLocal: false,
        });
      }
    });
    processedMsgCountRef.current = chatMessages.length;
  }, [chatMessages, onChatMessage]);

  const isConnected = matchState === "connected" && remoteParticipants.length > 0;

  if (!isConnected) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-gray-500">
        <div className="text-center space-y-3">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {remoteCameraTrack ? (
        <VideoTrack
          trackRef={remoteCameraTrack}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-gray-600">
          <p className="text-sm">Camera off</p>
        </div>
      )}
      {remoteUser && (
        <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg z-10">
          <p className="text-xs text-white font-medium">Stranger</p>
          <p className="text-xs text-gray-300">
            {remoteUser.name || "Anonymous"} · {remoteInfo?.age || "?"} ·{" "}
            {remoteInfo?.country || "?"}
          </p>
        </div>
      )}
    </>
  );
}

/* ─── Chat Panel ─── */

interface ChatPanelProps {
  messages: ChatMsg[];
  isConnected: boolean;
  onSend: (text: string) => void;
}

function ChatPanel({ messages, isConnected, onSend }: ChatPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSend(message.trim());
    setMessage("");
  };

  return (
    <div className="lg:w-80 h-56 lg:h-auto flex flex-col border-t lg:border-t-0 lg:border-l border-gray-800 bg-gray-900/50 shrink-0 lg:shrink">
      <div className="px-4 py-2.5 border-b border-gray-800 shrink-0">
        <h2 className="text-sm font-semibold text-gray-300">Chat</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
        {!isConnected && messages.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-8">
            Chat will appear here when connected
          </p>
        )}
        {isConnected && messages.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-8">Say hello! 👋</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="text-sm">
            <span
              className={`font-semibold ${msg.isLocal ? "text-blue-400" : "text-green-400"}`}
            >
              {msg.from}:
            </span>{" "}
            <span className="text-gray-200">{msg.message}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-gray-800 flex gap-2 shrink-0">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={isConnected ? "Type a message..." : "Waiting for connection..."}
          disabled={!isConnected}
          className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!isConnected || !message.trim()}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-lg text-sm font-medium text-white transition cursor-pointer"
        >
          Send
        </button>
      </form>
    </div>
  );
}
