# livekit

Context: I am building a real-time anonymous video chat application called "LiveKit GlobalConnect" using Next.js (App Router) and LiveKit Cloud. The app must be deployable to Vercel and use Serverless Functions for token generation.

Requirements:

No Database: Use LiveKit's server-side room management to handle the "waiting room" logic.

Onboarding: A landing page with a form to collect name, country, and age.

The Logic:

Create a Next.js API route /api/token using the livekit-server-sdk.

When a user clicks "Connect," the API should check for an existing room with only 1 participant.

If a room with 1 person exists, join it. If not, create a new room with a unique ID.

Ensure rooms have a maxParticipants: 2 limit and an emptyTimeout of 60 seconds.

The UI: Use @livekit/components-react to build a simple two-pane video layout (Local and Remote).

Anonymity: Ensure user identities are masked in the room using the name provided, but use a random UUID for the identity.

Task:

Write the /api/token route (Node.js).

Write the React VideoChat component that handles the connection lifecycle using LiveKitRoom.

Key Technical Details to Guide the AI
Since you mentioned running this on Vercel, keep these "DevOps" constraints in mind as the code is generated:

1. The Room "Matching" Hack (No DB)
Without a database, the hardest part is knowing if a room is "waiting" for a second person.

The Solution: Use the LiveKit RoomServiceClient within your Vercel function to listRooms().

Logic: Filter for rooms where numParticipants == 1. If found, return that room name. If not, generate a uuid() and start a new room.

2. Environment Variables
Copilot will likely use placeholders. You'll need these in your Vercel dashboard:

LIVEKIT_API_KEY

LIVEKIT_API_SECRET

LIVEKIT_URL (e.g., wss://your-project.livekit.cloud)

3. Automatic Cleanup
Since you don't want to manage state, tell the AI to set the emptyTimeout in the AccessToken grant. This ensures that once both users leave, LiveKit kills the room automatically, so you aren't paying for "ghost" rooms.

Recommended Project Structure
If you want Copilot to generate the whole folder structure, add this to the prompt:

"Please provide the code in a standard Next.js structure:

app/api/get-token/route.ts

components/LiveVideo.tsx

app/page.tsx"

A Quick Reality Check (Senior to Senior)
Since this is for "Adults" and is "Anonymous":

Vercel's Bandwidth: While the video is P2P (via LiveKit), the signaling and initial metadata go through your functions. With high traffic, watch your Vercel "Function Invocations" limit.

Safety: Without a DB, you can't easily "ban" users. You might want to eventually add a Redis (Upstash) layer (which works great with Vercel) just to store a list of banned IP hashes.
