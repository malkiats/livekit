"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const ChatRoom = dynamic(() => import("@/components/ChatRoom"), {
  ssr: false,
});

interface UserInfo {
  name: string;
  country: string;
  age: number;
}

export default function Home() {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [age, setAge] = useState("");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [error, setError] = useState("");

  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 18) {
      setError("You must be 18 or older");
      return;
    }

    setUserInfo({ name: name.trim(), country: country.trim(), age: ageNum });
  }

  if (userInfo) {
    return (
      <ChatRoom
        userInfo={userInfo}
        serverUrl={serverUrl}
        onStop={() => setUserInfo(null)}
      />
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="w-full max-w-md p-8 rounded-2xl bg-gray-900 shadow-xl">
        <h1 className="text-3xl font-bold text-center mb-2">
          VideoLiveChat.live
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
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold transition cursor-pointer"
          >
            Connect
          </button>
        </form>
      </div>
    </main>
  );
}
