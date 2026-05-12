# HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG AUTOGROWCHAIN

## CÁCH NHANH: Chạy 1 lệnh duy nhất

Right-click start.ps1 -> Run with PowerShell, hoặc gõ trong Terminal:
```powershell
.\start.ps1
```
Kết quả: Tự động khởi động 4 server + mở trình duyệt. Bấm Enter để tắt tất cả.

Lưu ý: Lần đầu tiên cần chạy npm install trong 2 thư mục blockchain_server và frontend_dashboard trước.

---

## CÁCH THỦ CÔNG: Từng bước (nếu cần debug)

## BƯỚC 0: Cấu hình (Làm 1 lần duy nhất)

Mở 2 file .env và điền Private Key của ví điện tử:
1. blockchain_contracts/.env -> PRIVATE_KEY="chuỗi_ký_tự_ví_của_bạn"
2. blockchain_server/.env -> PRIVATE_KEY="chuỗi_ký_tự_ví_của_bạn"

---

## BƯỚC 1: Biên dịch Smart Contract (Terminal 1)

```bash
cd blockchain_contracts
npm install
npx hardhat compile
```
Trạng thái: Compiled X Solidity files successfully là xong.

(Tùy chọn) Deploy Contract mới lên Blockchain:
```bash
npx hardhat run scripts/deploy.js --network pioneZero
```
Kết quả: Sau khi deploy xong, copy 2 địa chỉ mới hiện ra dán vào file blockchain_server/.env.

---

## BƯỚC 2: Chạy Blockchain API Servers (Terminal 1 + Terminal 2)

Terminal 1 - Supply Chain Server (Port 3000):
```bash
cd blockchain_server
npm install
npm run supply
```
Xác nhận: Supply Chain Server ready on port 3000.

Terminal 2 - TPL Data Server (Port 3005):
```bash
cd blockchain_server
npm run tpl
```
Xác nhận: Listening at http://localhost:3005.

---

## BƯỚC 3: Chạy Data API Server - SQLite (Terminal 3)

```bash
cd blockchain_server
npm run data
```
Xác nhận: Data API Server ready on port 3010.

Lưu ý: Lần chạy đầu tiên sẽ tự tạo file autogrowchain.db và seed dữ liệu mẫu (3 cây, thu hoạch, hoạt động, khách hàng, chi phí). Dữ liệu được lưu trữ vĩnh viễn trong file SQLite, không mất khi tắt server.

---

## BƯỚC 4: Chạy AI Vision Server (Terminal 4)

```bash
cd backend_ai
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```
Xác nhận: Application startup complete.

---

## BƯỚC 5: Chạy Frontend Dashboard (Terminal 5)

```bash
cd frontend_dashboard
npm install
npm run dev
```
Xác nhận: Local: http://localhost:5173/ -> Mở link này trên trình duyệt để xem Dashboard.

---

## BƯỚC 6: Nạp code ESP32

1. Mở Arduino IDE.
2. Copy code từ firmware_esp32/main.cpp dán vào.
3. Cắm ESP32 và bấm Upload.
4. Kết nối WiFi AutoGrowChain_AP (pass: 88888888).

---

## (Tùy chọn) Chạy Automation - Tự động lưu sensor lên Blockchain

Mở thêm Terminal, gõ:
```bash
cd blockchain_server
npm run auto
```
Xác nhận: Hệ thống sẽ tự động đọc cảm biến từ ESP32 và lưu lên Blockchain mỗi 30 giây.

---

## Tổng hợp các Port

| Service | Port | URL | Chức năng |
|---------|------|-----|-----------|
| ESP32 API | :80 | http://192.168.4.1 | Đọc sensor, điều khiển servo/pump |
| AI Vision | :8000 | http://localhost:8000/docs | YOLO detect, phân tích bệnh cây |
| Supply Chain API | :3000 | http://localhost:3000 | CRUD sản phẩm Blockchain |
| TPL Data API | :3005 | http://localhost:3005 | Lưu/đọc dữ liệu Blockchain |
| Data API (SQLite) | :3010 | http://localhost:3010 | Plants, harvests, analytics, CRM |
| Dashboard | :5173 | http://localhost:5173 | Giao diện người dùng |

---

## Cấu trúc Database (SQLite)

File: blockchain_server/autogrowchain.db

| Bảng | Mô tả | Endpoints |
|------|-------|-----------|
| plants | Thông tin 3 cây trồng | GET/PUT /api/plants |
| sensor_history | Lịch sử sensor (auto-log từ ESP32) | POST /api/sensors/log |
| activities | Nhật ký hoạt động (tưới, bón, kiểm tra) | POST/GET /api/activities |
| harvests | Ghi nhận thu hoạch (trọng lượng, số quả) | POST/GET /api/harvests |
| water_usage | Lượng nước tưới theo ngày | POST/GET /api/water |
| expenses | Chi phí (phân bón, thuốc, thiết bị) | POST/GET /api/expenses |
| customers | Khách hàng (regular + potential) | POST/GET /api/customers |

API Analytics tự động tính:
- GET /api/analytics/summary -> Tổng sản lượng, doanh thu ước tính, chi phí, biểu đồ theo tháng
