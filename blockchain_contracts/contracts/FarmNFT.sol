// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FarmNFT is ERC721, Ownable {
    uint256 public mintPrice = 0.01 ether;

    struct CareEvent {
        uint256 timestamp;
        string action;
    }

    mapping(uint256 => CareEvent[]) private _careHistory;
    mapping(uint256 => bool) public plantMinted;

    event TreeRented(address indexed renter, uint256 indexed plantId, uint256 timestamp);
    event CareLogged(uint256 indexed plantId, string action, uint256 timestamp);

    constructor() ERC721("AutoGrowChain Tree", "TREE") Ownable(msg.sender) {}

    function mintTree(uint256 plantId) external payable {
        require(!plantMinted[plantId], "Tree already rented");
        require(msg.value >= mintPrice, "Insufficient payment");

        _safeMint(msg.sender, plantId);
        plantMinted[plantId] = true;

        emit TreeRented(msg.sender, plantId, block.timestamp);
    }

    function logCare(uint256 plantId, string calldata action) external onlyOwner {
        _careHistory[plantId].push(CareEvent({
            timestamp: block.timestamp,
            action: action
        }));
        emit CareLogged(plantId, action, block.timestamp);
    }

    function getCareHistory(uint256 plantId) external view returns (CareEvent[] memory) {
        return _careHistory[plantId];
    }

    function getCareCount(uint256 plantId) external view returns (uint256) {
        return _careHistory[plantId].length;
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }
}
