import {BrowserProvider,JsonRpcProvider,Contract,formatEther,parseEther,keccak256,toUtf8Bytes,isAddress} from './vendor/ethers.min.js';
const $=id=>document.getElementById(id), RPC='https://rpc.mainnet.arc.io', CHAIN=5042;
const provider=new JsonRpcProvider(RPC,undefined,{batchMaxCount:1});
let snapshot,fleet,artifact,deployment,contract,signer,account,selected,busy=false;
const say=message=>{$('notice').textContent=message;};
const money=wei=>Number(formatEther(BigInt(wei))).toLocaleString(undefined,{maximumFractionDigits:6});
const short=a=>a.slice(0,6)+'…'+a.slice(-4);
const download=(name,data)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
async function json(path){const response=await fetch(path);if(!response.ok)throw Error(`Cannot load ${path}`);return response.json();}
function target(){const value=$('reserve').value;if(!/^\d+(\.\d{1,6})?$/.test(value)||Number(value)>1000)throw Error('Reserve must be 0–1000 USDC, with at most six decimals.');return parseEther(value);}
function fundingPlan(){const reserve=target(),known=snapshot.wallets.filter(w=>w.status==='verified');return {chainId:CHAIN,observedAt:snapshot.observedAt,blockNumber:snapshot.blockNumber,targetReserveWei:reserve.toString(),unavailableWallets:snapshot.wallets.length-known.length,transfers:known.filter(w=>BigInt(w.balanceWei)<reserve).map(w=>({address:w.address,label:w.label,amountWei:(reserve-BigInt(w.balanceWei)).toString()})),note:'Review against fresh balances. This file sends no transactions and excludes gas fees.'};}
function renderFleet(){
 const plan=fundingPlan(),known=snapshot.wallets.filter(w=>w.status==='verified'),q=$('search').value.toLowerCase();
 $('wallet-count').textContent=snapshot.wallets.length;$('verified-count').textContent=`${known.length} balances verified`;
 $('balance').textContent=money(known.reduce((s,w)=>s+BigInt(w.balanceWei),0n));$('low').textContent=plan.transfers.length;
 $('shortfall').textContent=money(plan.transfers.reduce((s,w)=>s+BigInt(w.amountWei),0n));
 $('plan-summary').textContent=`${plan.transfers.length} wallets below target. ${plan.unavailableWallets} unavailable and excluded. Transfer gas is additional. This is an export-only plan.`;
 $('snapshot-meta').textContent=`Observed ${new Date(snapshot.observedAt).toLocaleString()} · Arc block ${snapshot.blockNumber.toLocaleString()} · green: at target · amber: below target · gray: unavailable`;
 $('chain-status').textContent=`Arc · block ${snapshot.blockNumber.toLocaleString()}`;
 $('grid').replaceChildren();
 snapshot.wallets.forEach((w,i)=>{if(!`${w.label} ${w.address}`.toLowerCase().includes(q))return;const b=document.createElement('button');b.className='worker-dot '+(w.status!=='verified'?'unknown':BigInt(w.balanceWei)<target()?'low':'')+(selected===w.address?' active':'');b.textContent=i===0?'C':i;b.title=`${w.label}: ${w.status==='verified'?money(w.balanceWei)+' USDC':'unavailable'}`;b.setAttribute('aria-label',b.title);b.onclick=()=>select(w.address);$('grid').append(b);});
}
function select(address){selected=address;const w=snapshot.wallets.find(w=>w.address===address);$('selected').textContent=`${w.label} · ${w.address}\n${w.status==='verified'?money(w.balanceWei)+' USDC · '+w.nonce+' outgoing transactions at snapshot':'RPC read unavailable'}`;$('worker').value=address;renderFleet();}
async function refreshFleet(){
 $('refresh').disabled=true;say('Reading all wallet balances at one Arc block…');
 try {if(Number((await provider.getNetwork()).chainId)!==CHAIN)throw Error('RPC chain mismatch');const block=await provider.getBlockNumber(),rows=[];
  for(let i=0;i<fleet.length;i+=4){rows.push(...await Promise.all(fleet.slice(i,i+4).map(async w=>{try{return {...w,status:'verified',balanceWei:(await provider.getBalance(w.address,block)).toString(),nonce:await provider.getTransactionCount(w.address,block)};}catch{return {...w,status:'unavailable'};}})));}
  snapshot={chainId:CHAIN,blockNumber:block,observedAt:new Date().toISOString(),wallets:rows};renderFleet();say(`Refreshed ${rows.filter(w=>w.status==='verified').length}/${rows.length} wallets. Unavailable reads are excluded from totals.`);
 }catch(e){say('Live refresh failed. Retaining the dated snapshot: '+e.message);}finally{$('refresh').disabled=false;}
}
async function connect(){
 if(!window.ethereum)throw Error('Install an EVM browser wallet to sign transactions. All read-only features work without it.');
 const bp=new BrowserProvider(window.ethereum);await bp.send('eth_requestAccounts',[]);
 if(Number((await bp.getNetwork()).chainId)!==CHAIN){await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x13b2'}]});}
 const active=new BrowserProvider(window.ethereum);if(Number((await active.getNetwork()).chainId)!==CHAIN)throw Error('Switch your wallet to Arc mainnet (5042).');
 signer=await active.getSigner();account=await signer.getAddress();$('connect').textContent=short(account);await renderTasks();say('Wallet connected. Every action requires a transaction review and wallet signature.');
}
async function review(text){$('review-text').textContent=text;const d=$('review');d.returnValue='cancel';d.showModal();return new Promise(resolve=>d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true}));}
async function transact(label,details,method,args=[],value=0n){
 if(busy)throw Error('Wait for the pending transaction.');if(!contract)throw Error('Contract is not deployed.');if(!signer)await connect();
 if(!await review(`${label}\nNetwork: Arc mainnet (5042)\nContract: ${deployment.address}\n${details}\nAttached USDC: ${formatEther(value)}`))return;
 busy=true;
 try{const live=new BrowserProvider(window.ethereum);if(Number((await live.getNetwork()).chainId)!==CHAIN)throw Error('Wallet network changed.');const current=await live.getSigner();if((await current.getAddress())!==account)throw Error('Wallet account changed. Reconnect.');const c=contract.connect(current);await c[method].staticCall(...args,{value});const tx=await c[method](...args,{value});say('Submitted '+tx.hash+' — waiting for receipt. Do not repeat this action.');download('arc-swarm-pending-transaction.json',{chainId:CHAIN,hash:tx.hash,contract:deployment.address,action:label});await tx.wait();say('Confirmed: '+tx.hash);await renderTasks();}finally{busy=false;}
}
async function renderTasks(){
 $('tasks').replaceChildren();if(!contract){$('task-count').textContent='—';$('escrow-status').textContent='Deployment pending';$('tasks').textContent='Mainnet contract deployment is pending. Fleet monitoring and budget export are available.';return;}
 const [count,total,owner,cap,maximum,paused]=await Promise.all([contract.taskCount(),contract.outstanding(),contract.owner(),contract.maxTaskReward(),contract.maxOutstanding(),contract.paused()]);
 $('task-count').textContent=count.toString();$('escrow-status').textContent=`${money(total)} USDC in escrow${paused?' · paused':''}`;
 $('owner-note').textContent=`Coordinator: ${owner}. Only this address can fund or approve tasks.`;$('caps').textContent=`Task cap ${money(cap)} USDC · total escrow cap ${money(maximum)} USDC${paused?' · new tasks and payments paused':''}`;
 if(count===0n){$('tasks').textContent='No missions yet. Fund a task from the coordinator wallet to begin.';return;}
 const start=Math.max(1,Number(count)-19);for(let id=Number(count);id>=start;id--){const t=await contract.tasks(id),el=document.createElement('article');el.className='task';const heading=document.createElement('h3');heading.textContent=`Mission ${id} · ${money(t.reward)} USDC`;const badge=document.createElement('span');badge.className='pill';badge.textContent=['Missing','Assigned','Awaiting review','Paid','Refunded'][Number(t.state)];heading.append(badge);el.append(heading);const p=document.createElement('p');p.textContent=`Worker ${t.worker}\nReview deadline ${new Date(Number(t.deadline)*1000).toLocaleString()}\nBrief ${t.briefHash}\nResult ${t.resultHash}`;p.style.whiteSpace='pre-line';el.append(p);
 const action=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.className='quiet';b.onclick=()=>fn().catch(e=>say(e.shortMessage||e.message));el.append(b);};
 if(Number(t.state)===1&&account?.toLowerCase()===t.worker.toLowerCase()){const input=document.createElement('textarea');input.placeholder='Paste the exact completed result content to commit its hash';input.setAttribute('aria-label',`Result content for mission ${id}`);el.append(input);action('Commit result',async()=>{if(!input.value.trim())throw Error('Provide result content first.');const hash=keccak256(toUtf8Bytes(input.value));download(`mission-${id}-result.json`,{taskId:id,content:input.value,hash});await transact('Commit result',`Mission ${id}\nResult hash: ${hash}`,'submitResult',[id,hash]);});}
 if(account?.toLowerCase()===owner.toLowerCase()){if(Number(t.state)===2)action('Approve payment',()=>transact('Approve payment',`Mission ${id}\nPay ${money(t.reward)} USDC to ${t.worker}\nConfirm you reviewed the actual work.`,'approveTask',[id]));if([1,2].includes(Number(t.state)))action('Refund if expired',()=>transact('Refund expired task',`Mission ${id}\nReturn ${money(t.reward)} USDC to coordinator.`,'refundExpired',[id]));}
 $('tasks').append(el);}
}
async function init(){
 [fleet,snapshot,artifact,deployment]=await Promise.all(['fleet.json','snapshot.json','contract.json','deployment.json'].map(x=>json('data/'+x)));
 fleet.forEach(w=>{const o=document.createElement('option');o.value=w.address;o.textContent=`${w.label} · ${short(w.address)}`;$('worker').append(o);});
 if(deployment.address&&isAddress(deployment.address)){contract=new Contract(deployment.address,artifact.abi,provider);$('contract-link').href='https://explorer.arc.io/address/'+deployment.address;$('contract-link').textContent='Inspect deployed contract ↗';}
 renderFleet();select(fleet[1].address);say('Showing a dated, on-chain fleet snapshot. Refresh to check current balances.');await renderTasks();
}
const guard=fn=>()=>Promise.resolve().then(fn).catch(e=>say(e.shortMessage||e.message));
$('refresh').onclick=guard(refreshFleet);$('connect').onclick=guard(connect);$('refresh-tasks').onclick=guard(renderTasks);$('search').oninput=()=>renderFleet();$('reserve').oninput=guard(()=>renderFleet());$('worker').onchange=()=>select($('worker').value);$('export').onclick=guard(()=>download('arc-swarm-funding-plan.json',fundingPlan()));
$('task-form').onsubmit=async e=>{e.preventDefault();try{const brief=$('brief').value.trim(),worker=$('worker').value,hours=Number($('hours').value);if(!brief||!Number.isFinite(hours)||hours<1||hours>720)throw Error('Provide a brief and review window of 1–720 hours.');const reward=parseEther($('reward').value);if(reward<=0n)throw Error('Reward must be positive.');const latest=await provider.getBlock('latest'),deadline=latest.timestamp+Math.floor(hours*3600),hash=keccak256(toUtf8Bytes(brief));download('arc-swarm-task-brief.json',{worker,brief,briefHash:hash,rewardWei:reward.toString(),deadline});await transact('Create funded task',`Worker: ${worker}\nReward: ${formatEther(reward)} USDC\nReview by: ${new Date(deadline*1000).toISOString()}\nBrief hash: ${hash}`,'createTask',[worker,deadline,hash],reward);}catch(e){say(e.shortMessage||e.message);}};
window.ethereum?.on?.('accountsChanged',()=>{signer=null;account=null;$('connect').textContent='Connect wallet';renderTasks().catch(()=>{});});window.ethereum?.on?.('chainChanged',()=>{signer=null;account=null;$('connect').textContent='Connect wallet';say('Wallet network changed. Reconnect before signing.');});
init().catch(e=>say('Startup failed: '+e.message));
