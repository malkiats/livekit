"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import LiveMatchStatus from "@/components/LiveMatchStatus";
import { COUNTRY_OPTIONS, getCountryFlag } from "@/lib/countries";

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
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.2),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_28%)]" />
      <div className="absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-sm font-medium text-cyan-200 backdrop-blur-sm">
              Live video chat for instant conversations
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
                VideoLiveChat.live
              </p>
              <h1 className="max-w-2xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Meet someone new in seconds - no signup, just click and connect.
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                Jump straight into a real conversation with people around the world.
                No long setup, no profile building, just a quick start and a human on
                the other side.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-sm font-semibold text-white">Instant access</p>
                <p className="mt-1 text-sm text-slate-300">Start chatting as soon as you enter your details.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-sm font-semibold text-white">Anonymous by design</p>
                <p className="mt-1 text-sm text-slate-300">No signup wall before you can meet someone new.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-sm font-semibold text-white">Global matches</p>
                <p className="mt-1 text-sm text-slate-300">Connect with people across countries in a few clicks.</p>
              </div>
            </div>

            <LiveMatchStatus mode="dashboard" className="max-w-2xl" />
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-slate-900/75 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">
                  Start now
                </p>
                <h2 className="mt-2 text-3xl font-bold text-white">Create your chat profile</h2>
              </div>
              <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                18+ only
              </div>
            </div>

            <p className="mb-8 text-sm leading-6 text-slate-300">
              Pick a display name, add your country, and you are ready to connect.
            </p>

            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Your display name"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">Country</label>
                <div className="relative">
                  <select
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="" disabled className="text-slate-400">
                      Select your country
                    </option>
                    {COUNTRY_OPTIONS.map((option) => (
                      <option key={option.code} value={option.name}>
                        {`${getCountryFlag(option.name)} ${option.name}`}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
                    ▾
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">Age</label>
                <input
                  type="number"
                  required
                  min="18"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Must be 18+"
                />
              </div>

              {error && <p className="text-center text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 cursor-pointer"
              >
                Connect instantly
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
