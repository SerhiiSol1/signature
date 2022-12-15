// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

error ZeroAmount();
error ZeroAddress();
error SignerNotOwner();
error SighExpired();
error WrongAssetType();
error WrongValue();
error LockPeriod();

contract DepositBox is Ownable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using Counters for Counters.Counter;

    Counters.Counter private _boxIdCounter;

    enum AssetType {
        ERC20, // 0
        ERC721, // 1
        Native // 2
    }

    struct Box {
        address owner;
        address assetAddress;
        uint256 amountOrId;
        uint256 lockPeriod;
        AssetType assetType;
    }

    mapping(uint256 => Box) public depositBoxes;

    event BoxCreated(
        address owner,
        uint256 boxId,
        address asset,
        uint256 amountOrId,
        uint256 lockPeriod,
        AssetType assetType
    );
    event WithdrawFromBox(uint256 boxId, address withdrawal);

    function createDepositBox(
        address _asset,
        uint256 _amountOrId,
        AssetType _assetType,
        uint256 _lockPeriod
    ) external payable {
        uint256 boxId = _boxIdCounter.current();
        _boxIdCounter.increment();

        if (_assetType == AssetType.ERC20) {
            if (_asset == address(0)) revert ZeroAddress();
            if (_amountOrId == 0) revert ZeroAmount();
            IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amountOrId);
        } else if (_assetType == AssetType.ERC721) {
            if (_asset == address(0)) revert ZeroAddress();
            IERC721(_asset).transferFrom(msg.sender, address(this), _amountOrId);
        } else {
            if (_amountOrId != msg.value) revert WrongValue();
        }

        depositBoxes[boxId] = Box(msg.sender, _asset, _amountOrId, block.timestamp + _lockPeriod, _assetType);

        emit BoxCreated(msg.sender, boxId, _asset, _amountOrId, block.timestamp + _lockPeriod, _assetType);
    }

    function withdrawFromBox(
        uint256 _boxId,
        uint256 deadline,
        bytes memory signature
    ) public {
        if (deadline < block.timestamp) revert SighExpired();

        Box storage box = depositBoxes[_boxId];

        if (box.lockPeriod > block.timestamp) revert LockPeriod();

        bytes32 message = keccak256(abi.encodePacked(box.owner, _boxId, deadline));

        bytes32 _hash = hashMessage(message);

        if (ECDSA.recover(_hash, signature) != box.owner) revert SignerNotOwner();

        if (box.assetType == AssetType.ERC20) {
            IERC20(box.assetAddress).safeTransfer(msg.sender, box.amountOrId);
        } else if (box.assetType == AssetType.ERC721) {
            IERC721(box.assetAddress).transferFrom(address(this), msg.sender, box.amountOrId);
        } else if (box.assetType == AssetType.Native) {
            payable(msg.sender).transfer(box.amountOrId);
        } else {
            revert WrongAssetType();
        }

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

    function hashMessage(bytes32 message) internal pure returns (bytes32) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        return keccak256(abi.encodePacked(prefix, message));
    }
}
