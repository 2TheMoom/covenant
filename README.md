# Covenant
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/license/mit/)
[![Discord](https://img.shields.io/badge/Discord-Join%20us-5865F2?logo=discord&logoColor=white)](https://discord.gg/8Jm4v89VAu)
[![Telegram](https://img.shields.io/badge/Telegram--T.svg?style=social&logo=telegram)](https://t.me/genlayer)
[![Twitter](https://img.shields.io/twitter/url/https/twitter.com/yeagerai.svg?style=social&label=Follow%20%40GenLayer)](https://x.com/GenLayer)

## About
Covenant is a **verified-impact grants platform**. Donors pool funds into a
campaign; each milestone pays the recipient independently, only once
validators deterministically confirm it via one of three check types - a
merged GitHub PR, a live deployment (with an optional marker string), or
a threshold crossed in a live JSON value.

`create_campaign(campaign_id, title, description)` opens a campaign.
`add_milestone(...)` locks in a milestone's description, payout amount,
and check before a single donation arrives - milestones lock once the
campaign has its first donor, so a recipient can't add new, easier
targets after the money is already pooled. `donate(campaign_id)` -
payable - pools GEN openly on-chain.

`verify_milestone(milestone_id)` is fully deterministic: validators
independently run the milestone's check (fetch the GitHub API, fetch the
deployment URL, or fetch and compare a JSON value against a scaled
threshold) with no LLM involved. A deterministic pass isn't the same as
being right, so any donor has a 10-minute window after verification to
`challenge_milestone` it with a reason. Only a genuine dispute escalates
to `gl.nondet.exec_prompt` - validators re-fetch the evidence and weigh
the objection against it, and only the verdict (uphold/overturn) is
consensus-critical. `claim_milestone_payout(milestone_id)` then pays the
recipient once the challenge window closes unchallenged, or once a
challenge is upheld.

A campaign that never gets any verified milestone progress doesn't lock
donations forever: `reclaim_donation(campaign_id)` lets a donor recover
their own donation once 24 hours have passed with nothing verified.

**Payouts go through `gl.get_contract_at(recipient).emit_transfer(value=
amount)`, called with no method name - not `gl.evm.contract_interface`
("Payee").** The two are not interchangeable: `gl.evm.contract_interface`
compiles to an `EthSend` message, a bridge to a *separate external EVM
chain* - confirmed by reading GenVM's own source
(`genlayer/_internal/on_chain/eth.py`) - which is the right tool for
paying out on a different chain and the wrong one here, since this
contract only ever moves the same native GEN it already pooled via
`gl.message.value`. `.emit_transfer()` on a `get_contract_at()` proxy
with no method name compiles to `PostMessage` instead, GenVM's own
same-consensus transfer, which the SDK documents as working for an
address with no contract deployed at it precisely because it dispatches
no method.

**Aggressive minification was necessary, not stylistic.** The contract
combines three check types, a donor-challenge/LLM-adjudication
subsystem, and seven view methods - Bradbury's hard, undocumented
16,777,216 gas/tx cap meant the first attempt (30,488 bytes) failed to
deploy outright, and even real structural simplification only got to
21,485 bytes, still over the line. Every private helper/parameter name
shortened, a `_bad(cond, msg)` one-line-raise helper replacing every `if
...: raise` pair, dataclass fields shortened internally while every
public view method's dict keys stayed untouched, every docstring and
section-divider comment removed, got it to 17,825 bytes - cleared on the
next deploy attempt.

## Live deployment
Deployed on **GenLayer Bradbury Testnet** (chain ID 4221):
- **Contract:** [`0xb153413D77aE11d93bC6C085f0A95966abaCb202`](https://explorer-bradbury.genlayer.com/address/0xb153413D77aE11d93bC6C085f0A95966abaCb202)
- **Frontend:** [covenant-frontend-eta.vercel.app](https://covenant-frontend-eta.vercel.app)
- Verified via 57 passing direct-mode tests (`python -m pytest tests/direct/`),
  covering campaign/milestone creation and their full validation surface,
  all three check types (including the decimal-string numeric-parsing
  edge case), donation accounting, the challenge window boundary, both
  dispute verdicts, payout accounting (including the underfunded-campaign
  cap), `reclaim_donation`'s recovery paths, and the dispute prompt
  genuinely wrapping untrusted input in isolating tags.
- Live-verified with a real write, not just a receipt check: a real
  `create_campaign` call confirmed state actually persisted (`get_campaign`
  read back correctly), and `cov-live-1` ("Open Flood-Sensor Network") is
  live on the contract today.

## What's included
- `contracts/covenant.py` — the Covenant Intelligent Contract
- `tests/direct/test_covenant.py` — direct-mode tests (in-memory, mocked web/LLM)
- A Next.js 16 frontend (TypeScript, TanStack Query, Radix UI) — a warm,
  two-hands-clasped mark, a marketing landing page with live stats, and
  the functional app (create/donate/verify/challenge/claim/reclaim)
- Configuration file template and deployment scripts

## Requirements
- Python >= 3.12
- [GenLayer CLI](https://github.com/genlayerlabs/genlayer-cli) globally installed: `npm install -g genlayer`
- GenLayer Studio (for integration tests and deployment): Install from [Docs](https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup#using-the-genlayer-studio) or use the hosted [GenLayer Studio](https://studio.genlayer.com/)

## Project Structure

```
contracts/              # Python intelligent contracts
  covenant.py              # Covenant
tests/
  direct/                 # Fast in-memory tests (no Studio required)
    test_covenant.py
frontend/                # Next.js 16 app (TypeScript, TanStack Query, Radix UI)
deploy/                 # TypeScript deployment scripts
gltest.config.yaml       # Test runner network configuration
pyproject.toml           # Python/pytest configuration
```

## Quick Start

### 1. Set up Python environment

```shell
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Lint the contract

```shell
genvm-lint check contracts/covenant.py
```

### 3. Run direct mode tests

```shell
python -m pytest tests/direct/ -v
```

Use `python -m pytest`, not bare `pytest` - depending on your installed
pytest version, running the bare command can fail to put the project
root on `sys.path`, breaking test discovery with
`ModuleNotFoundError: No module named 'tests'`.

### 4. Deploy the contract

1. Choose your network: `genlayer network`
2. Deploy: `genlayer deploy` (runs the script in `/deploy/deployScript.ts`)

### 5. Set up the frontend

1. Copy `frontend/.env.example` to `frontend/.env.local`
2. Add your deployed contract address as `NEXT_PUBLIC_CONTRACT_ADDRESS`
3. Run:

```shell
cd frontend
npm install
npm run dev
```

The landing page is at http://localhost:3000/, the app at http://localhost:3000/app.

## How Covenant Works

1. **`create_campaign(campaign_id, title, description)`** — opens a
   campaign. Anyone can create one; the creator becomes its recipient.
2. **`add_milestone(campaign_id, milestone_id, description,
   target_amount, check_type, check_params)`** — recipient-only, locks
   once the campaign has its first donation. `check_type` is one of
   `github_merged`, `deployment_live`, `threshold`.
3. **`donate(campaign_id)`** — payable. Anyone can donate; donations pool
   per-campaign, not per-milestone.
4. **`verify_milestone(milestone_id)`** — permissionless, deterministic.
5. **`challenge_milestone(milestone_id, reason)`** — any donor to that
   campaign, within a 10-minute window after verification.
6. **`resolve_challenge(milestone_id)`** — permissionless. Validators
   weigh the dispute against fresh evidence via `gl.nondet.exec_prompt`;
   uphold keeps it verified, overturn marks it failed.
7. **`claim_milestone_payout(milestone_id)`** — recipient-only, once
   verified and the challenge window has closed. Capped at whatever the
   campaign has actually raised minus what's already been released.
8. **`reclaim_donation(campaign_id)`** — a donor recovers their own
   donation once 24 hours have passed with no verified milestone progress.
9. **`get_campaign`** / **`get_milestone`** / **`get_all_campaign_ids`** /
   **`get_campaign_milestone_ids`** / **`get_donation`** / **`get_donors`**
   / **`has_reclaimed`** — read back a campaign's full state, its
   milestones, its donors, and a wallet's position.

## Testing Strategy

| Test Type | Command | Speed | Requires Studio |
|-----------|---------|-------|-----------------|
| **Lint** | `genvm-lint check contracts/covenant.py` | ~250ms | No |
| **Direct** | `python -m pytest tests/direct/ -v` | ~ms/test | No |

## Community
- **[Discord](https://discord.gg/8Jm4v89VAu)**: Discussions, support, and announcements
- **[Telegram](https://t.me/genlayer)**: Informal chats and quick updates

## Documentation
For detailed information, see our [documentation](https://docs.genlayer.com/).

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
