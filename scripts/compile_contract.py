"""Compile pinned Solidity to reproducible ABI and bytecode (no transactions)."""
import json
from pathlib import Path
import solcx

ROOT = Path(__file__).resolve().parents[1]
VERSION = '0.8.30'

def compile_contract():
    if VERSION not in [str(v) for v in solcx.get_installed_solc_versions()]:
        solcx.install_solc(VERSION)
    settings = {'optimizer': {'enabled': True, 'runs': 200}, 'evmVersion': 'paris',
                'outputSelection': {'*': {'*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']}}}
    result = solcx.compile_standard({'language': 'Solidity', 'sources': {
        'ArcSwarm.sol': {'content': (ROOT/'contracts/ArcSwarm.sol').read_text()}},
        'settings': settings}, solc_version=VERSION)
    c = result['contracts']['ArcSwarm.sol']['ArcSwarm']
    artifact = {'compiler': VERSION, 'settings': settings, 'abi': c['abi'],
                'bytecode': '0x'+c['evm']['bytecode']['object'],
                'runtime': '0x'+c['evm']['deployedBytecode']['object']}
    (ROOT/'data/contract.json').write_text(json.dumps(artifact, indent=2)+'\n')
    return artifact

if __name__ == '__main__':
    artifact = compile_contract()
    print('Compiled ArcSwarm:', (len(artifact['bytecode'])-2)//2, 'bytes')
