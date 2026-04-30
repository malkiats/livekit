"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const LiveVideo = dynamic(() => import("@/components/LiveVideo"), {
  ssr: false,
});

export default function Home() {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [age, setAge] = useState("");
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setConnecting(true);

    try {
      const res = await fetch("/api/get-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, country, age: parseInt(age) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get token");
      }

      const data = await res.json();
      setToken(data.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setConnecting(false);
    }
  }

  if (token) {
    return (
      <LiveVideo
        token={token}
        serverUrl={serverUrl}
        onDisconnected={() => {
          setToken("");
          setConnecting(false);
        }}
      />
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="w-full max-w-md p-8 rounded-2xl bg-gray-900 shadow-xl">
        <h1 className="text-3xl font-bold text-center mb-2">
          LiveKit GlobalConnect
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Anonymous video chat — meet someone new
        </p>

        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your display name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Country</label>
            <input
              type="text"
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your country"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Age</label>
            <input
              type="number"
              required
              min="18"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Must be 18+"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={connecting}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-semibold transition"
          >
            {connecting ? "Connecting..." : "Connect"}
          </button>
        </form>
      </div>
    </main>
  );
}
