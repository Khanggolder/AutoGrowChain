// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract TYTAgriSupplyChain is AccessControl {

    address public factory;
    bytes32 public immutable companyId;
    address public companyOwner;

    bytes32 public constant PRODUCT_MANAGER_ROLE = keccak256("PRODUCT_MANAGER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    struct Product {
        string productId;
        string productName;
        string description;
        mapping(string batch => string) status;
        mapping(string batch => string processes) batchs;
        bool isActive;
    }

    string[] private productIds;
    mapping(string => Product) public products;
    mapping(string => string[]) listIndexBatchs;

    event ProductAdded(string indexed productId, string productName, bytes32 companyId, string description, uint256 updateAt);
    event UpdatedProcesses(string indexed productId, string _newProcesses, uint256 updateAt);
    event UpdatedProductStatus(string indexed productId, string oldStatus, string newStatus, uint256 updateAt);
    event ProductManagerAdded(address indexed account, address indexed admin);
    event ProductManagerRemoved(address indexed account, address indexed admin);
    event AuditorAdded(address indexed account, address indexed auditor);
    event AuditorRemoved(address indexed account, address indexed auditor);
    event ProductDeactivated(string indexed productId, address indexed deactivatedBy, uint256 deactivatedAt);
    event CompanyOwnerUpdated(address indexed oldOwner, address indexed newOwner, uint256 updatedAt);

    constructor(bytes32 _companyId, address _companyOwner) {
        factory = msg.sender;
        companyId = _companyId;
        companyOwner = _companyOwner;
        _grantRole(DEFAULT_ADMIN_ROLE, factory);
        _grantRole(DEFAULT_ADMIN_ROLE, _companyOwner);
    }

    modifier onlyProductManager() {
        require(hasRole(PRODUCT_MANAGER_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not a product manager");
        _;
    }

    modifier onlyAuditor() {
        require(
            hasRole(AUDITOR_ROLE, msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
            hasRole(PRODUCT_MANAGER_ROLE, msg.sender),
            "Caller is not an auditor"
        );
        _;
    }

    function addProduct(
        string calldata _productId,
        string calldata _productName,
        string calldata _description
    ) public onlyProductManager {
        require(bytes(_productId).length > 0, "Product ID cannot be empty");
        require(!products[_productId].isActive, "Product registed");

        Product storage p = products[_productId];
        p.productId = _productId;
        p.productName = _productName;
        p.description = _description;
        p.isActive = true;

        productIds.push(_productId);

        emit ProductAdded(_productId, _productName, companyId, _description, block.timestamp);
    }

    function updateProductProcesses(string calldata _productId, string calldata batch, string calldata _newProcesses)
        public onlyAuditor
    {
        require(hasProduct(_productId), "Product is not active or not found");
        require(bytes(batch).length > 0, "Batch ID cannot be empty");

        Product storage p = products[_productId];

        if (bytes(p.batchs[batch]).length == 0) {
            listIndexBatchs[_productId].push(batch);
        }

        p.batchs[batch] = _newProcesses;

        emit UpdatedProcesses(_productId, _newProcesses, block.timestamp);
    }

    function updateProductStatus(string calldata _productId, string calldata batch, string calldata _status) public onlyProductManager {
        require(hasProduct(_productId), "Product is not active or not found");
        require(bytes(batch).length > 0, "Batch ID cannot be empty");

        Product storage p = products[_productId];

        if (bytes(p.status[batch]).length == 0 && bytes(p.batchs[batch]).length == 0) {
            listIndexBatchs[_productId].push(batch);
        }

        string memory oldStatus = p.status[batch];
        p.status[batch] = _status;

        emit UpdatedProductStatus(_productId, oldStatus, _status, block.timestamp);
    }

    function hasProduct(string calldata _productId) public view returns (bool) {
        return bytes(products[_productId].productId).length > 0 && products[_productId].isActive;
    }

    function getProductInfo(string calldata _productId) public view returns (
        string memory productId,
        string memory productName,
        string memory description,
        bool isActive
    ) {
        require(bytes(products[_productId].productId).length > 0, "Product not found");
        require(products[_productId].isActive, "Product is not active");
        Product storage product = products[_productId];
        return (
            product.productId,
            product.productName,
            product.description,
            product.isActive
        );
    }

    function getProductByBatch(string memory _productId, string memory batch) external view returns (
        string memory productId,
        string memory productName,
        string memory description,
        string memory status,
        string memory processes,
        bool isActive
    ) {
        require(bytes(products[_productId].productId).length > 0, "Product not found");
        require(products[_productId].isActive, "Product is not active");
        require(bytes(batch).length > 0, "Batch ID cannot be empty");

        Product storage p = products[_productId];
        return(
            p.productId,
            p.productName,
            p.description,
            p.status[batch],
            p.batchs[batch],
            p.isActive
        );
    }

    function getAllProductIds() public view returns (string[] memory) {
        return productIds;
    }

    function getProductBatches(string calldata _productId) external view returns (string[] memory) {
        require(bytes(products[_productId].productId).length > 0, "Product not found");
        require(products[_productId].isActive, "Product is not active");
        return listIndexBatchs[_productId];
    }

    function deactivateProduct(string calldata _productId) external onlyProductManager {
        require(hasProduct(_productId), "Product is not active or not found");
        Product storage p = products[_productId];
        p.isActive = false;
        emit ProductDeactivated(_productId, msg.sender, block.timestamp);
    }

    function reactivateProduct(string calldata _productId) external onlyProductManager {
        require(bytes(products[_productId].productId).length > 0, "Product does not exist");
        require(!products[_productId].isActive, "Product is already active");
        Product storage p = products[_productId];
        p.isActive = true;
        emit ProductAdded(_productId, p.productName, companyId, p.description, block.timestamp);
    }

    function getCompanyOwner() external view returns (address) {
        return companyOwner;
    }

    function updateCompanyOwner(address _newOwner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newOwner != address(0), "Invalid owner address");
        address oldOwner = companyOwner;
        companyOwner = _newOwner;
        emit CompanyOwnerUpdated(oldOwner, _newOwner, block.timestamp);
    }

    function addProductManager(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid user address");
        _grantRole(PRODUCT_MANAGER_ROLE, account);
        emit ProductManagerAdded(account, msg.sender);
    }

    function removeProductManager(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid user address");
        _revokeRole(PRODUCT_MANAGER_ROLE, account);
        emit ProductManagerRemoved(account, msg.sender);
    }

    function addAuditor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid user address");
        _grantRole(AUDITOR_ROLE, account);
        emit AuditorAdded(account, msg.sender);
    }

    function removeAuditor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid user address");
        _revokeRole(AUDITOR_ROLE, account);
        emit AuditorRemoved(account, msg.sender);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
