# Covenant Frontend

Next.js frontend for Covenant - a verified-impact grants platform on
GenLayer. Reads and writes the deployed `Covenant` contract on **GenLayer
Bradbury Testnet** (chain ID 4221).

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` file:

```bash
cp .env.example .env.local
```

3. Configure environment variables in `.env.local`:
   - `NEXT_PUBLIC_CONTRACT_ADDRESS` - your deployed Covenant contract address
   - `NEXT_PUBLIC_GENLAYER_RPC_URL` - Bradbury RPC (default: `https://rpc-bradbury.genlayer.com`)
   - `NEXT_PUBLIC_GENLAYER_CHAIN_ID` - must stay `4221` (Bradbury), consistent with the RPC URL above

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page, [http://localhost:3000/app](http://localhost:3000/app) for the app.

## Build

```bash
npm run build
npm start
```

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling
- **genlayer-js** - GenLayer blockchain SDK
- **TanStack Query (React Query)** - Data fetching and caching
- **Radix UI** - Accessible component primitives

## Wallet

Connects via MetaMask (or any injected EIP-1193 provider) and prompts the
user to add/switch to the GenLayer Bradbury Testnet if needed. No private
keys are ever generated, imported, or stored by this app. Only MetaMask is
actually wired up; WalletConnect and Coinbase Wallet are shown in the
connect modal as "coming soon" rather than presented as working options
that silently do nothing.

## Features

- **Landing page** (`/`): marketing page with live stats (total funded,
  campaigns created, live campaigns) pulled from the contract, and a
  preview of live campaigns.
- **App** (`/app`): the functional tool.
  - **Create a campaign**: `create_campaign(...)` opens a campaign with a
    title and description.
  - **Add a milestone**: locked in before the campaign's first donation
    arrives. Supports all three on-chain check types - a merged GitHub
    PR, a live deployment (with an optional marker string), or a
    threshold crossed in a live JSON value.
  - **Donate**: pools real GEN into a campaign's shared pot.
  - **Verify**: permissionless, deterministic - validators independently
    confirm the milestone's check, no LLM.
  - **Challenge / Resolve**: any donor can dispute a verified milestone
    within a 10-minute window; validators weigh the dispute against fresh
    evidence via reasoned judgment only when genuinely escalated.
  - **Release payout**: the campaign recipient claims a verified,
    unchallenged milestone's payout from the pooled funds.
  - **Reclaim donation**: a donor recovers their own donation if the
    campaign never got any verified milestone progress within 24 hours.
