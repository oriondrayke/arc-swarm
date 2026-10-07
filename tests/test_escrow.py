import sys
from pathlib import Path
import pytest
from web3 import Web3, EthereumTesterProvider
from eth_tester.exceptions import TransactionFailed
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from compile_contract import compile_contract

@pytest.fixture(scope='session')
def artifact(): return compile_contract()

@pytest.fixture
def env(artifact):
    w=Web3(EthereumTesterProvider()); owner,worker,other=w.eth.accounts[:3]
    factory=w.eth.contract(abi=artifact['abi'],bytecode=artifact['bytecode'])
    receipt=w.eth.wait_for_transaction_receipt(factory.constructor(10**18,3*10**18).transact({'from':owner}))
    c=w.eth.contract(address=receipt.contractAddress,abi=artifact['abi'])
    c.functions.setWorkers([worker],True).transact({'from':owner})
    return w,c,owner,worker,other

def create(env,reward=10**17):
    w,c,o,a,_=env; deadline=w.eth.get_block('latest').timestamp+3600
    c.functions.createTask(a,deadline,Web3.keccak(text='brief')).transact({'from':o,'value':reward})
    return c.functions.taskCount().call(),deadline

def test_review_payment_and_replay(env):
    w,c,o,a,b=env; task,_=create(env)
    with pytest.raises(TransactionFailed): c.functions.submitResult(task,Web3.keccak(text='result')).transact({'from':b})
    c.functions.submitResult(task,Web3.keccak(text='result')).transact({'from':a})
    before=w.eth.get_balance(a)
    with pytest.raises(TransactionFailed): c.functions.approveTask(task).transact({'from':b})
    c.functions.approveTask(task).transact({'from':o})
    assert w.eth.get_balance(a)-before==10**17
    assert c.functions.outstanding().call()==0
    assert c.functions.tasks(task).call()[3]==3
    with pytest.raises(TransactionFailed):c.functions.approveTask(task).transact({'from':o})

def test_caps_and_access(env):
    w,c,o,a,b=env
    with pytest.raises(TransactionFailed):create(env,10**18+1)
    with pytest.raises(TransactionFailed):create(env,0)
    with pytest.raises(TransactionFailed):c.functions.setWorkers([b],True).transact({'from':a})
    for _ in range(3):create(env,10**18)
    with pytest.raises(TransactionFailed):create(env,1)
    assert c.functions.outstanding().call()==3*10**18

@pytest.mark.parametrize('submit',[False,True])
def test_expiry_and_refund(env,submit):
    w,c,o,a,b=env;task,deadline=create(env)
    if submit:c.functions.submitResult(task,Web3.keccak(text='result')).transact({'from':a})
    with pytest.raises(TransactionFailed):c.functions.refundExpired(task).transact({'from':o})
    w.provider.ethereum_tester.time_travel(deadline);w.provider.ethereum_tester.mine_block()
    with pytest.raises(TransactionFailed):c.functions.submitResult(task,Web3.keccak(text='late')).transact({'from':a})
    with pytest.raises(TransactionFailed):c.functions.approveTask(task).transact({'from':o})
    c.functions.refundExpired(task).transact({'from':o})
    assert c.functions.outstanding().call()==0
    assert w.eth.get_balance(c.address)==0
    with pytest.raises(TransactionFailed):c.functions.refundExpired(task).transact({'from':o})

def test_pause_blocks_new_and_payment_but_preserves_exit(env):
    w,c,o,a,b=env;task,deadline=create(env)
    c.functions.setPaused(True).transact({'from':o})
    with pytest.raises(TransactionFailed):create(env)
    c.functions.submitResult(task,Web3.keccak(text='work')).transact({'from':a})
    with pytest.raises(TransactionFailed):c.functions.approveTask(task).transact({'from':o})
    w.provider.ethereum_tester.time_travel(deadline);w.provider.ethereum_tester.mine_block()
    c.functions.refundExpired(task).transact({'from':o})
    assert c.functions.outstanding().call()==0

def test_registration_and_removal(env):
    w,c,o,a,b=env
    c.functions.setWorkers([a,a,b],True).transact({'from':o})
    assert c.functions.workerCount().call()==2
    task,_=create(env)
    c.functions.setWorkers([a],False).transact({'from':o})
    with pytest.raises(TransactionFailed):create(env)
    c.functions.submitResult(task,Web3.keccak(text='existing work')).transact({'from':a})
    c.functions.approveTask(task).transact({'from':o})
    assert c.functions.workerCount().call()==1

def test_invalid_inputs_and_unsubmitted_payment(env):
    w,c,o,a,b=env;task,_=create(env)
    with pytest.raises(TransactionFailed):c.functions.approveTask(task).transact({'from':o})
    with pytest.raises(TransactionFailed):c.functions.submitResult(task,bytes(32)).transact({'from':a})
    with pytest.raises(TransactionFailed):c.functions.setWorkers(['0x'+'0'*40],True).transact({'from':o})
    with pytest.raises(TransactionFailed):c.functions.createTask(a,w.eth.get_block('latest').timestamp+31*86400,Web3.keccak(text='x')).transact({'from':o,'value':1})
    with pytest.raises(TransactionFailed):c.functions.createTask(a,w.eth.get_block('latest').timestamp+100,Web3.keccak(text='x')).transact({'from':b,'value':1})
