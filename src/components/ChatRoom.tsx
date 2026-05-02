"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LiveMatchStatus from "@/components/LiveMatchStatus";
import { getCountryFlag } from "@/lib/countries";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useTracks,
  VideoTrack,
  useChat,
  useLocalParticipant,
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

type ConnectionBadgeState = "searching" | "connected" | "disconnected";

interface MediaControlsRef {
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
}

function ParticipantBadge({
  label,
  name,
  age,
  country,
  align = "left",
}: {
  label: string;
  name: string;
  age: number | string;
  country: string;
  align?: "left" | "right";
}) {
  const isRightAligned = align === "right";
  const flag = getCountryFlag(country);

  return (
    <div
      className={`absolute bottom-3 z-10 max-w-[calc(100%-1.5rem)] rounded-2xl border border-white/10 bg-black/72 px-4 py-3 shadow-lg backdrop-blur-md ${
        isRightAligned ? "right-3 text-right" : "left-3"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{name}</p>
      <div className={`mt-2 flex flex-wrap gap-2 ${isRightAligned ? "justify-end" : "justify-start"}`}>
        <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-200">
          Age {age}
        </span>
        <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-200">
          <span className="mr-1.5">{flag}</span>
          {country}
        </span>
      </div>
    </div>
  );
}

function ConnectionStatusBadge({
  status,
  detail,
}: {
  status: ConnectionBadgeState;
  detail: string;
}) {
  const styles = {
    searching: {
      label: "🟡 Searching",
      className: "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
      detailClassName: "text-yellow-100/75",
    },
    connected: {
      label: "🟢 Connected",
      className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
      detailClassName: "text-emerald-100/75",
    },
    disconnected: {
      label: "🔴 Disconnected",
      className: "border-red-400/25 bg-red-400/10 text-red-100",
      detailClassName: "text-red-100/75",
    },
  } satisfies Record<
    ConnectionBadgeState,
    { label: string; className: string; detailClassName: string }
  >;

  const config = styles[status];

  return (
    <div
      className={`rounded-2xl border px-4 py-2.5 text-right shadow-lg backdrop-blur-md ${config.className}`}
    >
      <p className="text-sm font-semibold tracking-[0.08em] uppercase">{config.label}</p>
      <p className={`mt-1 text-xs ${config.detailClassName}`}>{detail}</p>
    </div>
  );
}

function playConnectedChime() {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextCtor = window.AudioContext || (window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  const audioContext = new AudioContextCtor();
  const gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);
  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);

  const notes = [523.25, 659.25];
  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const noteStart = audioContext.currentTime + index * 0.12;
    const noteEnd = noteStart + 0.28;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    oscillator.connect(gainNode);

    gainNode.gain.linearRampToValueAtTime(0.035, noteStart + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.start(noteStart);
    oscillator.stop(noteEnd);
  });

  window.setTimeout(() => {
    void audioContext.close().catch(() => {
      // Ignore teardown failures for short-lived cue audio.
    });
  }, 700);
}

export default function ChatRoom({ userInfo, serverUrl, onStop }: ChatRoomProps) {
  const [token, setToken] = useState("");
  const [matchState, setMatchState] = useState<MatchState>("searching");
  const [error, setError] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [showConnectedCue, setShowConnectedCue] = useState(false);
  const excludeRoomRef = useRef("");
  const searchingRef = useRef(false);
  const mountedRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sendChatRef = useRef<((msg: string) => Promise<void>) | null>(null);
  const mediaControlsRef = useRef<MediaControlsRef | null>(null);

  // Start local media independently so camera and mic default to on.
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
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

  useEffect(() => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = isCameraEnabled;
    });
  }, [isCameraEnabled]);

  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = isMicrophoneEnabled;
    });
  }, [isMicrophoneEnabled]);

  useEffect(() => {
    if (matchState !== "searching") {
      setSearchSeconds(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setSearchSeconds((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [matchState, token]);

  const findMatch = useCallback(async () => {
    if (searchingRef.current) return;
    searchingRef.current = true;
    setMatchState("searching");
    setSearchSeconds(0);
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

  const handleMediaStateChange = useCallback(
    ({
      isMicrophoneEnabled: nextMicState,
      isCameraEnabled: nextCameraState,
    }: {
      isMicrophoneEnabled: boolean;
      isCameraEnabled: boolean;
    }) => {
      setIsMicrophoneEnabled(nextMicState);
      setIsCameraEnabled(nextCameraState);
    },
    []
  );

  const handleToggleMicrophone = useCallback(async () => {
    const nextState = !isMicrophoneEnabled;
    setIsMicrophoneEnabled(nextState);

    if (!mediaControlsRef.current) {
      return;
    }

    try {
      await mediaControlsRef.current.setMicrophoneEnabled(nextState);
    } catch {
      setIsMicrophoneEnabled(!nextState);
      setError("Could not update microphone state");
    }
  }, [isMicrophoneEnabled]);

  const handleToggleCamera = useCallback(async () => {
    const nextState = !isCameraEnabled;
    setIsCameraEnabled(nextState);

    if (!mediaControlsRef.current) {
      return;
    }

    try {
      await mediaControlsRef.current.setCameraEnabled(nextState);
    } catch {
      setIsCameraEnabled(!nextState);
      setError("Could not update camera state");
    }
  }, [isCameraEnabled]);

  const isConnected = matchState === "connected";
  const headerStatus: ConnectionBadgeState = error
    ? "disconnected"
    : isConnected
      ? "connected"
      : "searching";
  const headerDetail = error
    ? error
    : isConnected
      ? "You are now in a live conversation"
      : `Searching for ${searchSeconds}s...`;

  useEffect(() => {
    let timeoutId: number | undefined;

    if (isConnected && !wasConnectedRef.current) {
      playConnectedChime();
      setShowConnectedCue(true);
      timeoutId = window.setTimeout(() => {
        setShowConnectedCue(false);
      }, 2200);
    }

    if (!isConnected) {
      setShowConnectedCue(false);
    }

    wasConnectedRef.current = isConnected;

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isConnected]);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      {showConnectedCue && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-50 -translate-x-1/2">
          <div className="rounded-full border border-emerald-400/35 bg-emerald-400/12 px-5 py-3 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl animate-pulse">
            <p className="text-sm font-semibold text-emerald-100">Connected to a new person</p>
            <p className="mt-1 text-xs text-emerald-100/80">Your match is live now</p>
          </div>
        </div>
      )}

      {/* Header — always stable */}
      <header className="flex items-center justify-between gap-4 px-4 py-3 bg-gray-900/80 border-b border-gray-800 shrink-0">
        <div className="min-w-0">
          <p className="text-lg font-bold text-white">VideoLiveChat.live</p>
          <p className="text-xs text-slate-400">Instant anonymous video chat</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
              18+ only
            </span>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
              Stay respectful
            </span>
          </div>
        </div>
        <ConnectionStatusBadge status={headerStatus} detail={headerDetail} />
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
              {!isCameraEnabled && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                    <p className="text-lg">📷</p>
                    <p className="mt-1 text-sm font-medium text-white">Camera is off</p>
                  </div>
                </div>
              )}
              <ParticipantBadge
                label="You"
                name={userInfo.name}
                age={userInfo.age}
                country={userInfo.country}
              />
            </div>

            {/* Remote video — only this panel refreshes on match */}
            <div className="relative flex-1 bg-gray-900 rounded-xl overflow-hidden min-h-[180px]">
              {token ? (
                <LiveKitRoom
                  key={token}
                  token={token}
                  serverUrl={serverUrl}
                  connect={true}
                  video={isCameraEnabled}
                  audio={isMicrophoneEnabled}
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
                    searchSeconds={searchSeconds}
                    mediaControlsRef={mediaControlsRef}
                    onMediaStateChange={handleMediaStateChange}
                  />
                  <RoomAudioRenderer />
                </LiveKitRoom>
              ) : (
                <SearchingOverlay error={error} onRetry={findMatch} searchSeconds={searchSeconds} />
              )}
            </div>
          </div>

          <div className="px-2 pb-2">
            <LiveMatchStatus mode={isConnected ? "connected" : "searching"} secondsWaiting={searchSeconds} />
          </div>

          {/* Controls — always visible */}
          <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-3 shrink-0">
            <button
              type="button"
              onClick={handleToggleMicrophone}
              className={`min-w-36 rounded-xl px-5 py-3 text-sm font-semibold transition cursor-pointer ${
                isMicrophoneEnabled
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-slate-800 text-slate-100 hover:bg-slate-700"
              }`}
            >
              {isMicrophoneEnabled ? "🎤 Mute" : "🎤 Unmute"}
            </button>
            <button
              type="button"
              onClick={handleToggleCamera}
              className={`min-w-36 rounded-xl px-5 py-3 text-sm font-semibold transition cursor-pointer ${
                isCameraEnabled
                  ? "bg-violet-600 text-white hover:bg-violet-500"
                  : "bg-slate-800 text-slate-100 hover:bg-slate-700"
              }`}
            >
              {isCameraEnabled ? "📷 Camera Off" : "📷 Camera On"}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="min-w-32 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 cursor-pointer"
            >
              ⏭ Next
            </button>
            <button
              type="button"
              onClick={handleStop}
              className="min-w-32 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 cursor-pointer"
            >
              ⏹ Stop
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

function SearchingOverlay({
  error,
  onRetry,
  searchSeconds,
}: {
  error: string;
  onRetry: () => void;
  searchSeconds: number;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 p-4 text-gray-500 backdrop-blur-sm">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
        <LiveMatchStatus mode="searching" secondsWaiting={searchSeconds} />
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
  searchSeconds: number;
  mediaControlsRef: React.MutableRefObject<MediaControlsRef | null>;
  onMediaStateChange: (state: {
    isMicrophoneEnabled: boolean;
    isCameraEnabled: boolean;
  }) => void;
}

function RoomInner({
  matchState,
  setMatchState,
  onNext,
  onChatMessage,
  sendChatRef,
  searchSeconds,
  mediaControlsRef,
  onMediaStateChange,
}: RoomInnerProps) {
  const remoteParticipants = useRemoteParticipants();
  const tracks = useTracks([Track.Source.Camera]);
  const { send, chatMessages } = useChat();
  const { localParticipant } = useLocalParticipant();
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

  useEffect(() => {
    mediaControlsRef.current = {
      setMicrophoneEnabled: async (enabled: boolean) => {
        await localParticipant.setMicrophoneEnabled(enabled);
      },
      setCameraEnabled: async (enabled: boolean) => {
        await localParticipant.setCameraEnabled(enabled);
      },
    };

    onMediaStateChange({
      isMicrophoneEnabled: localParticipant.isMicrophoneEnabled,
      isCameraEnabled: localParticipant.isCameraEnabled,
    });

    return () => {
      mediaControlsRef.current = null;
    };
  }, [localParticipant, mediaControlsRef, onMediaStateChange]);

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
      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 p-4 text-gray-500 backdrop-blur-sm">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <LiveMatchStatus mode="searching" secondsWaiting={searchSeconds} />
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
        <ParticipantBadge
          label="Stranger"
          name={remoteUser.name || "Anonymous"}
          age={remoteInfo?.age || "?"}
          country={remoteInfo?.country || "Unknown"}
          align="right"
        />
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
