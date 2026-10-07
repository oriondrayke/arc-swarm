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

Submission status: prepared, not submitted. Verify links and deployment evidence before submitting.
