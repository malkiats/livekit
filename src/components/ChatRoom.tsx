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

export default function ChatRoom({
  userInfo,
  serverUrl,
  onStop,
}: ChatRoomProps) {
  const [token, setToken] = useState("");
  const [matchState, setMatchState] = useState<MatchState>("searching");
  const [error, setError] = useState("");
  const excludeRoomRef = useRef("");
  const searchingRef = useRef(false);
  const mountedRef = useRef(false);

  const findMatch = useCallback(async () => {
    if (searchingRef.current) return;
    searchingRef.current = true;
    setMatchState("searching");
    setError("");
    setToken("");

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

  // Loading state while fetching token
  if (!token) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-950 text-white">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-lg">Finding someone to chat with...</p>
          {error && (
            <div className="space-y-2">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={() => findMatch()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
              >
                Retry
              </button>
            </div>
          )}
          <button
            onClick={handleStop}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition"
          >
            ■ Stop
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={true}
      audio={true}
      onDisconnected={() => {
        if (!searchingRef.current) {
          setToken("");
        }
      }}
      style={{ height: "100vh" }}
    >
      <RoomContent
        userInfo={userInfo}
        matchState={matchState}
        setMatchState={setMatchState}
        onNext={handleNext}
        onStop={handleStop}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

interface RoomContentProps {
  userInfo: UserInfo;
  matchState: MatchState;
  setMatchState: (state: MatchState) => void;
  onNext: () => void;
  onStop: () => void;
}

function RoomContent({
  userInfo,
  matchState,
  setMatchState,
  onNext,
  onStop,
}: RoomContentProps) {
  const remoteParticipants = useRemoteParticipants();
  const tracks = useTracks([Track.Source.Camera]);
  const { send, chatMessages } = useChat();
  const [message, setMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevRemoteCountRef = useRef(0);

  const localCameraTrack = tracks.find(
    (t) => t.participant.isLocal && t.source === Track.Source.Camera
  );
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

  // Detect when remote participant joins
  useEffect(() => {
    if (remoteParticipants.length > 0 && matchState === "searching") {
      setMatchState("connected");
    }
  }, [remoteParticipants.length, matchState, setMatchState]);

  // Detect when remote participant leaves (was connected, now alone)
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

  // Auto-retry if no match found within 12 seconds
  useEffect(() => {
    if (matchState === "searching") {
      const timeout = setTimeout(() => {
        onNext();
      }, 12000);
      return () => clearTimeout(timeout);
    }
  }, [matchState, onNext]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !send) return;
    try {
      await send(message.trim());
      setMessage("");
    } catch {
      // Message send failed silently
    }
  };

  const isConnected =
    matchState === "connected" && remoteParticipants.length > 0;

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800 shrink-0">
        <h1 className="text-lg font-bold text-white">
          LiveKit GlobalConnect
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              isConnected
                ? "bg-green-500"
                : "bg-yellow-500 animate-pulse"
            }`}
          />
          <span className="text-sm text-gray-400">
            {isConnected ? "Connected" : "Searching..."}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Videos + Controls */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Video grid */}
          <div className="flex-1 flex flex-col sm:flex-row gap-2 p-2 min-h-0">
            {/* Local video */}
            <div className="relative flex-1 bg-gray-900 rounded-xl overflow-hidden min-h-[180px]">
              {localCameraTrack ? (
                <VideoTrack
                  trackRef={localCameraTrack}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📷</div>
                    <p className="text-sm">Camera off</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <p className="text-xs text-white font-medium">You</p>
                <p className="text-xs text-gray-300">
                  {userInfo.name} · {userInfo.age} · {userInfo.country}
                </p>
              </div>
            </div>

            {/* Remote video */}
            <div className="relative flex-1 bg-gray-900 rounded-xl overflow-hidden min-h-[180px]">
              {isConnected && remoteCameraTrack ? (
                <VideoTrack
                  trackRef={remoteCameraTrack}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  <div className="text-center space-y-3">
                    <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
                    <p className="text-sm">Looking for someone...</p>
                  </div>
                </div>
              )}
              {isConnected && remoteUser && (
                <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                  <p className="text-xs text-white font-medium">Stranger</p>
                  <p className="text-xs text-gray-300">
                    {remoteUser.name || "Anonymous"} ·{" "}
                    {remoteInfo?.age || "?"} · {remoteInfo?.country || "?"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 px-4 py-3 shrink-0">
            <button
              onClick={onNext}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white text-sm transition cursor-pointer"
            >
              ⏭ Next
            </button>
            <button
              onClick={onStop}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-white text-sm transition cursor-pointer"
            >
              ■ Stop
            </button>
          </div>
        </div>

        {/* Chat panel */}
        <div className="lg:w-80 h-56 lg:h-auto flex flex-col border-t lg:border-t-0 lg:border-l border-gray-800 bg-gray-900/50 shrink-0 lg:shrink">
          <div className="px-4 py-2.5 border-b border-gray-800 shrink-0">
            <h2 className="text-sm font-semibold text-gray-300">Chat</h2>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
            {!isConnected && chatMessages.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-8">
                Chat will appear here when connected
              </p>
            )}
            {isConnected && chatMessages.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-8">
                Say hello! 👋
              </p>
            )}
            {chatMessages.map((msg, i) => {
              const isLocal = msg.from?.isLocal ?? false;
              return (
                <div key={i} className="text-sm">
                  <span
                    className={`font-semibold ${
                      isLocal ? "text-blue-400" : "text-green-400"
                    }`}
                  >
                    {isLocal ? "You" : msg.from?.name || "Stranger"}:
                  </span>{" "}
                  <span className="text-gray-200">{msg.message}</span>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Message input */}
          <form
            onSubmit={handleSendMessage}
            className="p-2 border-t border-gray-800 flex gap-2 shrink-0"
          >
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                isConnected ? "Type a message..." : "Waiting for connection..."
              }
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
      </div>
    </div>
  );
}
