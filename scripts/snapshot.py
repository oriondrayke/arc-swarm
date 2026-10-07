"""Read-only snapshot: public addresses only; all reads pinned to one block."""
import concurrent.futures
from datetime import datetime, timezone
from pathlib import Path
import json
import requests

ROOT = Path(__file__).resolve().parents[1]
RPC = 'https://rpc.mainnet.arc.io'

def rpc(method, params):
    response = requests.post(RPC, json={'jsonrpc':'2.0','id':1,'method':method,'params':params}, timeout=25)
    response.raise_for_status()
    result = response.json()
    if 'error' in result:
        raise RuntimeError(result['error'].get('message','RPC error'))
    return result['result']

def snapshot():
    if int(rpc('eth_chainId',[]),16) != 5042:
        raise RuntimeError('Wrong chain')
    block = rpc('eth_blockNumber',[])
    def read(wallet):
        try:
            return dict(wallet, status='verified', balanceWei=str(int(rpc('eth_getBalance',[wallet['address'],block]),16)),
                        nonce=int(rpc('eth_getTransactionCount',[wallet['address'],block]),16))
        except Exception as exc:
            return dict(wallet, status='unavailable', error=type(exc).__name__)
    wallets = json.loads((ROOT/'data/fleet.json').read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(read,wallets))
    result = {'chainId':5042,'blockNumber':int(block,16),'observedAt':datetime.now(timezone.utc).isoformat(),'wallets':rows}
    (ROOT/'data/snapshot.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'wallets':len(rows),'verified':sum(w['status']=='verified' for w in rows),
                      'totalUSDC':sum(int(w.get('balanceWei',0)) for w in rows)/1e18,
                      'coordinatorUSDC':int(rows[0].get('balanceWei',0))/1e18,'block':int(block,16)}))
    return result

if __name__ == '__main__': snapshot()
