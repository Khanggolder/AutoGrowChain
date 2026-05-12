// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract TPLContract {

    address public owner;

    struct DataRecord {
        address sender;
        string data;
        uint256 timestamp;
    }

    DataRecord[] public contributions;
    DataRecord[] public iotDataList;
    DataRecord[] public collectionDataList;
    DataRecord[] public backupDataList;
    DataRecord[] public primaryDataList;

    event ContributionAdded(address indexed sender, uint256 index, uint256 timestamp);
    event IoTDataAdded(address indexed sender, uint256 index, uint256 timestamp);
    event CollectionDataAdded(address indexed sender, uint256 index, uint256 timestamp);
    event BackupDataAdded(address indexed sender, uint256 index, uint256 timestamp);
    event PrimaryDataAdded(address indexed sender, uint256 index, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    function submitContribution(string memory _cid) external {
        contributions.push(DataRecord(msg.sender, _cid, block.timestamp));
        emit ContributionAdded(msg.sender, contributions.length - 1, block.timestamp);
    }

    function addIoTData(string memory _dataString) external {
        iotDataList.push(DataRecord(msg.sender, _dataString, block.timestamp));
        emit IoTDataAdded(msg.sender, iotDataList.length - 1, block.timestamp);
    }

    function addCollectionData(string memory _dataString) external {
        collectionDataList.push(DataRecord(msg.sender, _dataString, block.timestamp));
        emit CollectionDataAdded(msg.sender, collectionDataList.length - 1, block.timestamp);
    }

    function addBackupData(string memory _dataString) external {
        backupDataList.push(DataRecord(msg.sender, _dataString, block.timestamp));
        emit BackupDataAdded(msg.sender, backupDataList.length - 1, block.timestamp);
    }

    function addPrimaryData(string memory _dataString) external {
        primaryDataList.push(DataRecord(msg.sender, _dataString, block.timestamp));
        emit PrimaryDataAdded(msg.sender, primaryDataList.length - 1, block.timestamp);
    }

    function getDataCounts() external view returns (uint256 contrib, uint256 iot, uint256 col, uint256 back, uint256 pri) {
        return (
            contributions.length,
            iotDataList.length,
            collectionDataList.length,
            backupDataList.length,
            primaryDataList.length
        );
    }

    function getContribution(uint256 _index) external view returns (string memory data, uint256 timestamp, address sender) {
        DataRecord memory record = contributions[_index];
        return (record.data, record.timestamp, record.sender);
    }

    function getIoTData(uint256 _index) external view returns (string memory data, uint256 timestamp, address sender) {
        DataRecord memory record = iotDataList[_index];
        return (record.data, record.timestamp, record.sender);
    }

    function getCollectionData(uint256 _index) external view returns (string memory data, uint256 timestamp, address sender) {
        DataRecord memory record = collectionDataList[_index];
        return (record.data, record.timestamp, record.sender);
    }

    function getBackupData(uint256 _index) external view returns (string memory data, uint256 timestamp, address sender) {
        DataRecord memory record = backupDataList[_index];
        return (record.data, record.timestamp, record.sender);
    }

    function getPrimaryData(uint256 _index) external view returns (string memory data, uint256 timestamp, address sender) {
        DataRecord memory record = primaryDataList[_index];
        return (record.data, record.timestamp, record.sender);
    }
}
