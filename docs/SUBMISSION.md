# Arc Swarm

## Short description
Arc Swarm gives an operator one place to monitor a wallet fleet, plan its USDC reserves and coordinate funded work. Each task has a named worker, a fixed reward, a review deadline and a result commitment. The coordinator approves the completed work before the contract releases payment. Expired tasks return their budget to the coordinator.

## Why Arc
An agent fleet needs both operational visibility and predictable small payments. Arc's native USDC lets the operator express gas reserves, task rewards and escrow limits in one unit. The contract does not require an ERC-20 allowance.

## Working example
Our example consists of 101 operator-controlled wallets: one coordinator and 100 workers with existing Arc transaction history. The fleet demonstrates operational scale; it is not a claim of 101 independent users or customers. Live snapshot and demo receipts are included with the public source.

## Limits
This is an early prototype. Task quality is reviewed by the coordinator, not inferred from a hash. Workers must agree that approval is required before expiry and that unapproved tasks can then be refunded. It is not a third-party freelance arbitration service. Reserve plans are exported for review; autonomous gas funding is not enabled.

## Links
- Source: https://github.com/oriondrayke/arc-swarm
- Demo: https://oriondrayke.github.io/arc-swarm/
- Mainnet contract and receipts: data/deployment.json and data/demo.json
- Builder: https://github.com/oriondrayke

## Verified October 7, 2026
- Contract: https://explorer.arc.io/address/0xEE252502C04cC61B86Cd6A9322e4222D065a6EE7
- Runtime bytecode matched the compiled constructor output; source hash and compiler settings are in data/deployment.json. This is local bytecode verification, not a claim of explorer source verification or an independent audit.
- 101 addresses registered. Mission 1 completed with a 0.0001 USDC reward and zero remaining escrow.
- Payment receipt: https://explorer.arc.io/tx/0x9ee9a56e266975b27df714f80c28b86e0115a2f30f75face18e011c5bc4aee11
- Deployment + live demonstration + internal gas transfer cost approximately 0.07618 USDC in gas.
- Mainnet caps intentionally small for the prototype: 0.1 USDC per task and 1 USDC outstanding.

Submission status: **Submitted and under review**, confirmed in DoraHacks on October 7, 2026 at 16:32 EAT. The existing registered account was used; the user completed the final submission in the shared visible browser. The confirmation states: “Your Build Arc Swarm has been submitted to hackathon Arc Microgrants | Circle and is now under review.” Edits remain possible before judging. No award or payout has been received.

Status page: https://dorahacks.io/hackathon/arc-microgrants/build
