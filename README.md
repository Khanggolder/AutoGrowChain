# AUTOGROWCHAIN: HE THONG NONG NGHIEP THONG MINH TICH HOP BLOCKCHAIN VA AI

AutoGrowChain la mot nen tang quan ly nong nghiep hien dai, chuyen doi mo hinh trang trai truyen thong sang Farm-as-a-Service (Dich vu cho thue trang trai). He thong ket hop suc manh cua cong nghe Blockchain de truy xuat nguon goc bat bien va Agent AI de toi uu hoa quy trinh canh tac.

## CAC CONG NGHE COT LOI

1. BLOCKCHAIN (PIONE Zero / Hardhat Node)
- Smart Contracts: Solidity (ERC-721 cho NFT cay trong va Supply Chain).
- Truy xuat nguon goc: Toan bo nhat ky cham soc duoc bam (hash) va luu tru vinh vien tren mang luoi.
- Marketplace: Cho phep thue cay thong qua NFT Rent-a-Tree.

2. TRI TUE NHAN TAO (AI MULTI-AGENT)
- AI Strategic Advisor: Su dung LLaMA 3.1 du bao thu hoach va tu van ban hang dua tren du lieu thi truong real-time.
- AI Vision (Faster R-CNN): Nhan dien 9 loai benh ly tren cay ca chua tu hinh anh.
- Audio AI (ResNet18): Phan tich am thanh con trung va tu dong kich hoat song sieu am xua duoi (Repel Hz).
- AI Financial Report: Tu dong phan tich du lieu tai chinh va viet bao cao loi nhuan.

3. INTERNET OF THINGS (IOT) & ROBOTICS
- Firmware: ESP32 (C++/Arduino).
- Sensors: Theo doi do am dat, pH, muc nuoc, cam bien mua va khoang cach sieu am.
- Robotics: Dieu khien canh tay robot 4 DOF qua WebSocket voi tinh nang Record & Play (day robot thu hoach).
- Live Stream: WebRTC stream video do tre thap voi giao dien chuyen dung cho chu so huu cay.

## CAU TRUC DU AN

- /frontend_dashboard: Giao dien dieu khien (ReactJS, Vite).
- /blockchain_contracts: Ma nguon Smart Contracts (Solidity, Hardhat).
- /blockchain_server: Backend xu ly giao dich va du lieu Blockchain (Node.js, Express, SQLite).
- /backend_ai: Backend xu ly cac mo hinh AI (Python, FastAPI, PyTorch).
- /firmware_esp32: Ma nguon cho thiet bi phan cung ESP32.
- /detect: Du lieu train va cac model AI (Faster R-CNN, ResNet18).

## HUONG DAN CAI DAT

Vui long doc file HOW_TO_RUN.md de biet chi tiet cac buoc khoi chay he thong.

## MO HINH VAN HANH

He thong hoat dong dua tren 5 server doc lap:
1. Supply Chain API (Port 3000)
2. TPL Data API (Port 3005)
3. Data API - SQLite (Port 3010)
4. AI Service (Port 8000)
5. Frontend Dashboard (Port 5173)

---
AutoGrowChain - Innovative Smart Farming Ecosystem.
