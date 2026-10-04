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

**Payouts go through `gl.evm.contract_interface` ("Payee"), not
`gl.get_contract_at(recipient).emit_transfer(...)`.** Paying a wallet is a
chain-layer operation - GEN balances live on each Intelligent Contract's
own ghost contract there - and `Payee` is the SDK's documented external-
message path for it (confirmed against `genlayer-docs`'
`value-transfers.mdx`/`messages.mdx`). `get_contract_at()` is an
*internal*, GenVM-layer message instead; a plain wallet has no
Intelligent Contract deployed at its address, so that message has
nowhere valid to land, and per the SDK docs the value isn't automatically
returned to the sender when it fails.

**Live-verified end to end 2026-10-02, including a confirmed platform
gap in payout delivery.** A real `genlayer-js` run (`PK`/`PK2` env vars,
not the CLI, which can't attach `value` to a payable call) drove the
full path - `create_campaign` → `add_milestone` → `donate` (0.002 GEN) →
`verify_milestone` → an 11-minute wait for the challenge window →
`claim_milestone_payout` - with 5/5 validator AGREE on every step. The
contract's own bookkeeping is fully self-consistent afterward
(`get_campaign` reports `status: "completed"`, `total_released:
1000000000000000`; `get_milestone` reports `status: "paid"`,
`paid_amount: 1000000000000000`, exactly matching `target_amount`) - but
the recipient's actual on-chain GEN balance never moved, checked
repeatedly over 10+ minutes past the claim transaction. This is the same
acknowledged GenLayer platform gap documented in
[genvm-manager#20](https://github.com/genlayerlabs/genvm-manager/issues/20)
(closed 2026-09-17 as "will stay [broken] on the current deployments you
use" pending a node/consensus fix) - `Payee` is the architecturally
correct primitive per the SDK docs, but the underlying `emit_transfer`
dispatch can still silently fail to deliver value regardless of which
primitive is used, with the calling contract's own bookkeeping committing
regardless since there's no delivery-confirmation callback.

**Fixed proactively the same day**, before any steward caught it here,
matching the pattern [Tote](https://github.com/2TheMoom/tote) and
[Waypoint](https://github.com/2TheMoom/waypoint) were forced to add:
`claim_milestone_payout`/`reclaim_donation` record the owed amount in
`pending_payouts` before firing the transfer, with
`retry_milestone_payout(milestone_id)`/`retry_donation_reclaim(campaign_id,
wallet)` to re-attempt delivery.

**That first version of the fix was itself wrong, caught a day later when
a steward flagged the identical bug on Tote/Waypoint.** `pending_payouts`
was never cleared after a successful delivery, so a recipient whose
payout actually landed could call retry again anyway, firing a second
real transfer and consuming GEN owed to other milestones/donors - an
unbounded drain, not a rare edge case. Fixed with a `pending_floor`
snapshot: the recipient's balance is recorded right before the first
attempt, and retry now compares the recipient's *current* balance against
`floor + amount` before re-sending - if it already landed, the record is
cleared and retry refuses instead of re-firing.
`test_retry_*_blocked_once_balance_confirms_delivery` proves this
directly. 63 tests pass, lint clean. Redeployed:
`0xed2e2535DeC81F6A782569FE524537849d465745`. The specific milestone from
the run documented above is still permanently stuck (that contract
instance predates any retry mechanism at all), but any future payout on
the current deployment can now be recovered if it silently fails to land,
without risking a double payment if it actually succeeded.

**Second fund-safety fix (2026-10-04).** The `pending_floor` retry above
still had two real bugs, the same ones a steward caught on Tote and
Waypoint's resubmissions: (1) the "already delivered" branch cleared
`pending_payouts` and then raised - raising reverts the *entire* call, so
that clear never actually persisted, leaving the exact same balance check
exploitable forever; fixed by returning normally on that path instead of
raising. (2) the balance check alone has no cap - if the recipient's
balance later drops back below the floor (they spend or transfer funds),
the same "not yet delivered" branch fires again, unboundedly; fixed with a
`retry_count` map and a fixed `MAX_RETRIES = 3`, checked before any resend.
`test_retry_*_clears_cleanly_once_balance_confirms_delivery` and
`test_retry_*_bounded_by_max_retries` cover both fixes directly. 65 tests
pass, lint clean, 18,773 bytes. Redeployed:
`0xa34BB437365F428872F88ef4FEBDD843f084C675`.

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
- **Contract:** [`0xa34BB437365F428872F88ef4FEBDD843f084C675`](https://explorer-bradbury.genlayer.com/address/0xa34BB437365F428872F88ef4FEBDD843f084C675)
- **Frontend:** [covenant-frontend-eta.vercel.app](https://covenant-frontend-eta.vercel.app)
- Verified via 63 passing direct-mode tests (`python -m pytest tests/direct/`),
  covering campaign/milestone creation and their full validation surface,
  all three check types (including the decimal-string numeric-parsing
  edge case), donation accounting, the challenge window boundary, both
  dispute verdicts, payout accounting (including the underfunded-campaign
  cap), `reclaim_donation`'s recovery paths, the two retry-payout methods,
  and the dispute prompt genuinely wrapping untrusted input in isolating
  tags.
- Live-verified with a real write, not just a receipt check: a real
  `create_campaign` call confirmed state actually persisted (`get_campaign`
  read back correctly), and `cov-live-1` ("Open Flood-Sensor Network") is
  live on the contract today.
- **Full lifecycle live-verified 2026-10-02** (create → milestone → donate
  → verify → claim, real GEN, 5/5 AGREE at every step) - see "About" above
  for the complete result, including the confirmed payout-delivery gap.

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
