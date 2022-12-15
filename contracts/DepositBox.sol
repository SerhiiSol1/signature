// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

error NotBoxOwner();
error ZeroAmount();
error ZeroAddress();
error SignerNotOwner();
error SighExpired();

contract DepositBox is Ownable {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    Counters.Counter private _boxIdCounter;

    // @notice assetType is 0 - ERC20; 1 - ERC721;

    struct Box {
        address owner;
        uint256 nativeAmount;
        uint256[] assetInfo;
        uint8[] assetType;
        address[] assetAddress;
    }

    mapping(uint256 => Box) public depositBoxes;

    event BoxCreated(address owner, uint256 boxId);
    event ERC20Deposit(uint256 boxId, address asset, uint256 amount);
    event ERC721Deposit(uint256 boxId, address asset, uint256 tokenId);
    event NativeDeposit(uint256 boxId, uint256 amount);
    event WithdrawFromBox(uint256 boxId, address withdrawal);

    function createDepositBox() external {
        uint256 boxId = _boxIdCounter.current();
        _boxIdCounter.increment();
        uint256[] memory x;
        uint8[] memory t;
        address[] memory a;
        depositBoxes[boxId] = Box(msg.sender, 0, x, t, a);

        emit BoxCreated(msg.sender, boxId);
    }

    function depositToBox(
        uint256 _boxId,
        address _asset,
        uint8 _assetType,
        uint256 _amountOrId
    ) external payable {
        Box storage box = depositBoxes[_boxId];
        if (box.owner != msg.sender) revert NotBoxOwner();

        if (_assetType == 0) {
            if (_asset == address(0)) revert ZeroAddress();
            if (_amountOrId == 0) revert ZeroAmount();
            IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amountOrId);

            box.assetAddress.push(_asset);
            box.assetType.push(_assetType);
            box.assetInfo.push(_amountOrId);

            emit ERC20Deposit(_boxId, _asset, _amountOrId);
        }
        if (_assetType == 1) {
            if (_asset == address(0)) revert ZeroAddress();
            IERC721(_asset).transferFrom(msg.sender, address(this), _amountOrId);

            box.assetAddress.push(_asset);
            box.assetType.push(_assetType);
            box.assetInfo.push(_amountOrId);

            emit ERC721Deposit(_boxId, _asset, _amountOrId);
        }
        if (msg.value != 0) {
            box.nativeAmount += msg.value;

            emit NativeDeposit(_boxId, msg.value);
        }
    }

    function withdrawFromBox(
        uint256 _boxId,
        uint256 deadline,
        bytes memory signature
    ) public {
        if (deadline < block.timestamp) revert SighExpired();

        Box storage box = depositBoxes[_boxId];

        bytes32 message = keccak256(abi.encodePacked(box.owner, _boxId, deadline));

        bytes32 _hash = hashMessage(message);

        if (ECDSA.recover(_hash, signature) != box.owner) revert SignerNotOwner();

        for (uint256 i = 0; i < box.assetAddress.length; i++) {
            if (box.assetType[i] == 0) {
                IERC20(box.assetAddress[i]).safeTransfer(msg.sender, box.assetInfo[i]);
            } else if (box.assetType[i] == 1) {
                IERC721(box.assetAddress[i]).transferFrom(address(this), msg.sender, box.assetInfo[i]);
            }
        }

        if (box.nativeAmount != 0) payable(msg.sender).transfer(box.nativeAmount);

        emit WithdrawFromBox(_boxId, msg.sender);
    }

    function withdrawView(
        uint256 _boxId,
        uint256 deadline,
        bytes memory signature
    ) public view returns (address) {
        Box storage box = depositBoxes[_boxId];

        bytes32 message = keccak256(abi.encodePacked(box.owner, _boxId, deadline));

        bytes32 _hash = hashMessage(message);
        return ECDSA.recover(_hash, signature);
    }

    function boxInfo(uint256 boxId)
        public
        view
        returns (
            uint256[] memory,
            uint8[] memory,
            address[] memory
        )
    {
        return (depositBoxes[boxId].assetInfo, depositBoxes[boxId].assetType, depositBoxes[boxId].assetAddress);
    }

    function hashMessage(bytes32 message) internal pure returns (bytes32) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        return keccak256(abi.encodePacked(prefix, message));
    }
}
