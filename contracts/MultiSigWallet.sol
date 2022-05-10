// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

contract MultiSigWallet {
    event Deposit(address indexed sender, uint256 amount);
    event Submit(uint256 indexed txId, address to, uint256 value, bytes data);
    event Aprrove(address indexed owner, uint256 indexed txId);
    event Revoke(address indexed owner, uint256 indexed txId);
    event Execute(uint256 indexed txId, address to, uint256 value, bytes data);

    // Lưu trữ địa chỉ các owner.
    address[] public owners;
    // Kiểm tra xem msg.sender (người gọi hàm) có phải là owner hay không. Nếu đúng là owner thì trả về giá trị true.
    mapping(address => bool) public isOwner;
    // Required là số lượng owner tối thiểu đã approve cho transaction được thực hiện (executed).
    uint256 public required;
    // Tạo mapping kiểm tra xem có bao nhiêu owners đã approve cho transaction TxId.
    mapping(uint256 => uint256) public approvalCount;

    // Tạo struct lưu thông tin của transaction.
    struct Transaction {
        address to; // Địa chỉ nhận token.
        uint256 value; // Số lượng ETH chuyển cho address to.
        bytes data; // Data được gửi đến address to.
        bool executed; // Transaction thực hiện thành công hay không.
    }

    Transaction[] public transactions;

    // Kiểm tra xem owner có địa chỉ (address) đã approve transaction[uint] chưa.
    // Ví dụ transaction thứ 2 sẽ có uint là 1, được address xyz approve.
    mapping(uint256 => mapping(address => bool)) public approved;

    // Modifier kiểm tra xem người gọi hàm có trong danh sách owner hay không.
    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner");
        _;
    }

    // Modifier kiểm tra xem transaction thứ txId có tồn tại không.
    modifier txIdExists(uint256 _txId) {
        require(_txId < transactions.length, "txId not exist");
        _;
    }

    // Modifier kiểm tra xem transaction thứ txId đã được approve chưa.
    modifier notAprroved(uint256 _txId) {
        require(!approved[_txId][msg.sender], "txId aldready approved");
        _;
    }

    // Modifier kiểm tra xem transaction thứ txId đã được executed chưa.
    modifier notExecuted(uint256 _txId) {
        require(!transactions[_txId].executed, "txId aldready executed");
        _;
    }

    // Constructor để nhập danh sách các owner và số lượng required.
    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0, "owners required");
        require(
            _required > _owners.length/2 && _required <= _owners.length,
            "invalid required number of owners"
        );

        for (uint256 i; i < _owners.length; i++) {
            address owner = _owners[i];
            // Không cho owner có địa chỉ bằng 0.
            require(owner != address(0), "invalid owner");
            // Không cho owner trùng lặp.
            // isOwner có giá trị mặc định là false, khi được add vào array thì sẽ có giá trị là true. Như vậy cần kiểm tra xem isOwner có phải true không, nếu là true thì loại, còn false thì được add vào.
            require(!isOwner[owner], "Owner already added");
            isOwner[owner] = true;
            owners.push(owner);
        }
        required = _required;

        // Kiểm tra xem số lượng owner hợp lệ có lớn hơn hoặc bằng required hay không.
        require(
            owners.length >= required,
            "invalid required number of owners(2)"
        );
    }

    // Hàm cho phép contract nhận và gửi ETH.
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    // Hàm để submit transaction để chờ approve.
    function submit(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlyOwner {
        transactions.push(
            Transaction({to: payable(_to), value: _value, data: _data, executed: false})
        );
        emit Submit(transactions.length - 1, _to, _value, _data);
    }

    // Hàm aprrove cho phép msg.sender (owner) approve transaction đã submit.
    function approve(uint256 _txId)
        external
        onlyOwner
        txIdExists(_txId)
        notAprroved(_txId)
        notExecuted(_txId)
    {
        approved[_txId][msg.sender] = true;
        approvalCount[_txId] ++;
        emit Aprrove(msg.sender, _txId);
    }

    // Hàm đếm xem có bao nhiêu owner đã approve transaction.
    function _getApprovalcount(uint256 _txId)
        private
        view
        returns (uint256)
    {
        return approvalCount[_txId];
    }

    // Hàm thực hiện transaction.
    function execute(uint256 _txId) payable
        external
        txIdExists(_txId)
        notExecuted(_txId)
    {
        require(
            approvalCount[_txId] >= required,
            "Number of approvals is less than required"
        );
        Transaction storage transaction = transactions[_txId];

        transaction.executed = true;

        // Đây là câu lệnh chuyển ETH đến address to trong struct transaction, dùng low level transact.
        // Xem lại phía trên struct Transaction có 4 trường: address to, uint value, bytes data, bool executed.
        // Câu lệnh low level call tạo ra 2 output bool và bytes, nhưng ở đây chúng ta chỉ quan tâm bool để xem transaction execute thành công hay không.
        (bool success, ) = payable(transaction.to).call{value: transaction.value}(
            transaction.data
        );
        require(success, "tx failed");

        emit Execute(_txId, transaction.to, transaction.value, transaction.data);
    }

    // Hàm này có chức năng hủy quyết định approve trước đó của chính msg.sender.
    function revoke(uint256 _txId)
        external
        onlyOwner
        txIdExists(_txId)
        notExecuted(_txId)
    {
        require(approved[_txId][msg.sender], "tx not approved yet");
        approved[_txId][msg.sender] = false;
        approvalCount[_txId] --;
        emit Revoke(msg.sender, _txId);
    }

    function getBalance() public view returns(uint256) {
        return address(this).balance;
    }
}
