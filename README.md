# AutoGrowChain: Smart Agriculture Ecosystem Integrated with Blockchain & AI

AutoGrowChain is an advanced agricultural management platform that transforms traditional farming into a **Farm-as-a-Service (FaaS)** model. By integrating Blockchain for immutable traceability and Multi-Agent AI for operational optimization, it provides a transparent and efficient bridge between urban investors and high-tech agriculture.

## Core Modules

### 1. Blockchain-Powered Marketplace & Traceability
- **Tree Renting via NFT (ERC-721)**: Users can "rent" physical trees in the farm by minting unique NFTs. The transaction is secured via Smart Contracts, granting the holder exclusive monitoring and harvest rights.
- **Immutable Log Hash**: Every agricultural action (watering, fertilizing, pest control) is hashed and recorded on the **PIONE Zero (Local Hardhat Node)** blockchain, preventing any data manipulation.
- **Public Traceability**: Consumers can scan a QR code to access a verified history of the plant's life cycle, ensuring organic integrity and food safety.

### 2. Multi-Agent AI Intelligence
- **AI Strategic Advisor (LLaMA 3.1)**: Analyzes real-time sensor data and live market prices (automatically crawled) to provide harvest recommendations and sales strategies (e.g., "Sell Now" vs "Hold").
- **AI Vision (Faster R-CNN)**: Analyzes images of tomato leaves to detect 9 distinct disease types (e.g., Late Blight, Anthracnose, Blossom End Rot) with specialized treatment suggestions.
- **Audio AI (ResNet18)**: Monitors the farm for specific insect acoustic signatures. Upon detection, it triggers specialized ultrasonic frequencies (Repel Hz) via the hardware speaker to deter pests without chemicals.
- **AI Financial Report**: Automatically processes all database records (expenses, harvests, VIP customers) to generate professional margin analysis and business growth reports.

### 3. IoT & Advanced Robotics
- **Hardware Integration**: Driven by **ESP32** firmware managing a suite of sensors (Soil Moisture, pH, Water Level, Rain detection).
- **Robotic Arm Control (4-DOF)**: Controlled via WebSocket with a "Record & Play" feature, allowing farmers to teach the robot complex harvesting or maintenance movements.
- **WebRTC Live Streaming**: High-performance, low-latency (<0.5s) video feed with integrated sensor overlays for real-time monitoring by tree owners.

## Project Structure

- `/frontend_dashboard`: The administrative and user interface built with React and Vite.
- `/blockchain_contracts`: Solidity Smart Contracts and Hardhat deployment environment.
- `/blockchain_server`: Backend services for blockchain interactions, data logging, and SQLite persistence.
- `/backend_ai`: FastAPI server hosting the Multi-Agent AI logic and machine learning models.
- `/firmware_esp32`: C++/Arduino source code for the IoT hardware and robotics controller.
- `/detect`: Training scripts, datasets, and pre-trained weights for Faster R-CNN and ResNet18 models.

## Technology Stack

- **Frontend**: React, Vanilla CSS, WebRTC.
- **Blockchain Server**: Node.js, Express, Ethers.js, SQLite3.
- **AI Backend**: Python, FastAPI, PyTorch, TorchVision, Torchaudio.
- **Smart Contracts**: Solidity, Hardhat.
- **Hardware**: ESP32, Servo library, AsyncTCP.

## Operational Setup

The system operates across a distributed architecture of 5 independent services:
1. **Supply Chain API** (Port 3000): Blockchain product management.
2. **TPL Data API** (Port 3005): Immutable logging service.
3. **Data API** (Port 3010): Primary database for plants and analytics.
4. **AI Service** (Port 8000): Computer vision and LLM agents.
5. **Frontend Dashboard** (Port 5173): Central control panel.

For detailed installation and startup instructions, please refer to [HOW_TO_RUN.md](HOW_TO_RUN.md).

---
AutoGrowChain - Pioneering the Future of Transparent and Automated Agriculture.
