# Arc Swarm

Fleet health, reserve planning and fixed-budget task escrow on Arc.

**Prototype:** an operator-controlled 101-wallet fleet is the live example. These are not 101 customers or independent agents. A result commitment is not a proof that work is correct. The coordinator reviews the actual deliverable.

## What works

- Public-address fleet view: USDC balances and outgoing transaction counts, pinned to a single block; unavailable reads remain explicitly unknown.
- Reserve planner exports per-wallet shortfalls; it does not move funds or include transfer gas.
- Registered workers, fixed task recipient/reward/deadline, result commitments, coordinator-approved payment and expired-task refunds.
- Immutable task and total escrow ceilings. A pause blocks new tasks and payouts while permitting worker submissions and expired refunds.
- Browser wallet signatures; no keys, seed phrases or token approvals in the application.

Arc native USDC uses 18 decimals. Do not add native and ERC-20 USDC balances together: they represent the same funds.

## Run and test

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/compile_contract.py
.venv/bin/python -m pytest -q
.venv/bin/python scripts/snapshot.py
python3 -m http.server 8766 --directory web
```

Compile uses Solidity 0.8.30, optimizer 200 runs, Paris EVM. The static site uses vendored ethers 6.15.0 (MIT). Run `python scripts/package_web.py` after changing data or compiling. All demo fleet addresses are public; private keys are never included.

## Task lifecycle

1. Coordinator registers worker addresses and creates a funded task with the hash of an agreed brief.
2. Worker completes the work and submits its result hash before the deadline. Deliver the actual content separately.
3. Coordinator checks the content matches its hash and approves before expiry. The contract pays the predetermined worker exactly once.
4. After expiry, any unpaid task is refundable to the coordinator, **even if the worker submitted a result**. The worker must accept this review deadline before starting.

This design is intended for a single operator's agent fleet. It does not offer third-party arbitration, guaranteed fair payment to independent freelancers, or automatic result verification. Disabling a worker stops new assignments but does not cancel its existing tasks. There is no early cancellation or owner replacement. Refunds and payouts require a recipient capable of accepting native USDC. No production security audit has been performed.

## Deployment

See `data/deployment.json` for the actual verified deployment state and transaction receipts; never infer deployment from this README. `docs/SUBMISSION.md` records the grant description. Operational evidence belongs in `data/demo.json` once available.

## License

MIT. Built by Litagatoro MK.
