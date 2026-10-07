"""Build a reproducible fleet report and unsigned worker commitment.

No private key, signature or transaction is created. Copy result.txt exactly
into the worker's result form. The coordinator verifies the same content.
"""
import argparse
import json
from pathlib import Path
from web3 import Web3

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--snapshot',type=Path,required=True)
parser.add_argument('--task-id',type=int,required=True)
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args()
if args.task_id<1:parser.error('task-id must be positive')
raw=args.snapshot.read_bytes();snapshot=json.loads(raw)
if snapshot['chainId']!=5042:raise SystemExit('Snapshot is not Arc mainnet')
rows=snapshot['wallets'];addresses=[w['address'].lower() for w in rows]
if len(addresses)!=len(set(addresses)) or not all(Web3.is_address(a) for a in addresses):raise SystemExit('Invalid or duplicate wallet addresses')
verified=[w for w in rows if w['status']=='verified']
report={'taskId':args.task_id,'blockNumber':snapshot['blockNumber'],'observedAt':snapshot['observedAt'],
        'walletCount':len(rows),'verified':len(verified),'missingReads':len(rows)-len(verified),
        'totalBalanceWei':str(sum(int(w['balanceWei']) for w in verified)),
        'snapshotHash':Web3.to_hex(Web3.keccak(raw)),
        'note':'Single-operator fleet; missing reads excluded. This is a balance report, not a security audit.'}
content=json.dumps(report,sort_keys=True,separators=(',',':'))
args.out.mkdir(parents=True,exist_ok=True)
(args.out/'result.txt').write_text(content)
(args.out/'commitment.json').write_text(json.dumps({'taskId':args.task_id,'resultHash':Web3.to_hex(Web3.keccak(text=content)),'transactionSent':False},indent=2)+'\n')
print('Prepared result.txt and commitment.json; no transaction sent.')
