// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Fixed-budget task escrow for an operator's Arc worker fleet.
/// Result hashes are commitments, not proofs of quality. The owner reviews work.
contract ArcSwarm {
    enum State { Missing, Open, Submitted, Paid, Refunded }
    struct Task {
        address worker;
        uint96 reward;
        uint64 deadline;
        State state;
        bytes32 briefHash;
        bytes32 resultHash;
    }
    address public immutable owner;
    uint256 public immutable maxTaskReward;
    uint256 public immutable maxOutstanding;
    uint256 public outstanding;
    uint256 public taskCount;
    uint256 public workerCount;
    bool public paused;
    bool private entered;
    mapping(address => bool) public workers;
    mapping(uint256 => Task) public tasks;

    event WorkerSet(address indexed worker, bool enabled);
    event TaskCreated(uint256 indexed id, address indexed worker, uint256 reward, uint64 deadline, bytes32 briefHash);
    event ResultSubmitted(uint256 indexed id, bytes32 resultHash);
    event TaskPaid(uint256 indexed id, address indexed worker, uint256 reward);
    event TaskRefunded(uint256 indexed id, uint256 reward);
    event PauseSet(bool paused);
    error Unauthorized();
    error Invalid();
    error WrongState();
    error TransferFailed();

    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    modifier lock() { if (entered) revert WrongState(); entered = true; _; entered = false; }

    constructor(uint256 taskCap, uint256 outstandingCap) {
        if (taskCap == 0 || taskCap > type(uint96).max || outstandingCap < taskCap) revert Invalid();
        owner = msg.sender;
        maxTaskReward = taskCap;
        maxOutstanding = outstandingCap;
    }

    function setWorkers(address[] calldata accounts, bool enabled) external onlyOwner {
        if (accounts.length == 0 || accounts.length > 200) revert Invalid();
        for (uint256 i; i < accounts.length; ++i) {
            address account = accounts[i];
            if (account == address(0) || account == address(this)) revert Invalid();
            if (workers[account] != enabled) {
                workers[account] = enabled;
                if (enabled) ++workerCount; else --workerCount;
                emit WorkerSet(account, enabled);
            }
        }
    }

    function setPaused(bool value) external onlyOwner { paused = value; emit PauseSet(value); }

    /// @dev Native Arc USDC has 18 decimals. No ERC-20 approval is used.
    function createTask(address worker, uint64 deadline, bytes32 briefHash)
        external payable onlyOwner returns (uint256 id)
    {
        if (paused || !workers[worker] || briefHash == bytes32(0) || msg.value == 0 ||
            msg.value > maxTaskReward || outstanding + msg.value > maxOutstanding ||
            deadline <= block.timestamp || deadline > block.timestamp + 30 days) revert Invalid();
        id = ++taskCount;
        outstanding += msg.value;
        tasks[id] = Task(worker, uint96(msg.value), deadline, State.Open, briefHash, bytes32(0));
        emit TaskCreated(id, worker, msg.value, deadline, briefHash);
    }

    function submitResult(uint256 id, bytes32 resultHash) external {
        Task storage task = tasks[id];
        if (msg.sender != task.worker) revert Unauthorized();
        if (task.state != State.Open || block.timestamp >= task.deadline || resultHash == bytes32(0)) revert WrongState();
        task.state = State.Submitted;
        task.resultHash = resultHash;
        emit ResultSubmitted(id, resultHash);
    }

    function approveTask(uint256 id) external onlyOwner lock {
        Task storage task = tasks[id];
        if (paused || task.state != State.Submitted || block.timestamp >= task.deadline) revert WrongState();
        task.state = State.Paid;
        outstanding -= task.reward;
        (bool ok,) = task.worker.call{value: task.reward}("");
        if (!ok) revert TransferFailed();
        emit TaskPaid(id, task.worker, task.reward);
    }

    /// @notice Review must finish before deadline. Expired tasks refund owner,
    /// including submitted work. A worker must accept that rule before working.
    function refundExpired(uint256 id) external onlyOwner lock {
        Task storage task = tasks[id];
        if ((task.state != State.Open && task.state != State.Submitted) || block.timestamp < task.deadline) revert WrongState();
        task.state = State.Refunded;
        outstanding -= task.reward;
        (bool ok,) = owner.call{value: task.reward}("");
        if (!ok) revert TransferFailed();
        emit TaskRefunded(id, task.reward);
    }
}
