# 🚀 Hướng dẫn triển khai AutoGrowChain lên AWS EC2

## Mục lục
1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Yêu cầu trước khi bắt đầu](#2-yêu-cầu-trước-khi-bắt-đầu)
3. [Bước 1: Tạo EC2 Instance](#3-bước-1-tạo-ec2-instance)
4. [Bước 2: Cấu hình Security Group](#4-bước-2-cấu-hình-security-group)
5. [Bước 3: Gán Elastic IP](#5-bước-3-gán-elastic-ip)
6. [Bước 4: Cài đặt môi trường Server](#6-bước-4-cài-đặt-môi-trường-server)
7. [Bước 5: Upload và triển khai code](#7-bước-5-upload-và-triển-khai-code)
8. [Bước 6: Cấu hình SSL (HTTPS)](#8-bước-6-cấu-hình-ssl-https)
9. [Bước 7: Cấu hình Backup tự động](#9-bước-7-cấu-hình-backup-tự-động)
10. [Quản lý và vận hành](#10-quản-lý-và-vận-hành)
11. [Xử lý sự cố](#11-xử-lý-sự-cố)

---

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS EC2 Instance                         │
│                      (t3.medium / t3.large)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Docker Compose                        │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │  Frontend   │  │  AI Backend │  │ Blockchain      │  │   │
│  │  │  (Nginx)    │  │  (FastAPI)  │  │ Servers (3x)    │  │   │
│  │  │  Port 80    │  │  Port 8000  │  │ 3000/3005/3010  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Elastic IP: xxx.xxx.xxx.xxx                                    │
│  Domain: autogrowchain.yourdomain.com (optional)                │
└─────────────────────────────────────────────────────────────────┘
```

**Các services:**
| Service | Port | Mô tả |
|---------|------|-------|
| Frontend (Nginx) | 80/443 | Dashboard React + Reverse Proxy |
| AI Backend | 8000 | FastAPI + YOLOv8 Computer Vision |
| Supply Server | 3000 | Blockchain Supply Chain API |
| TPL Server | 3005 | TPL Contract API |
| Data Server | 3010 | SQLite Data API |

---

## 2. Yêu cầu trước khi bắt đầu

### 2.1. Tài khoản AWS
- Tài khoản AWS đã kích hoạt
- Quyền tạo EC2, VPC, Security Group

### 2.2. Chuẩn bị file `.env`
Đảm bảo file `blockchain_server/.env` đã có đầy đủ thông tin:

```env
PRIVATE_KEY="your_wallet_private_key"
EXPLORER_API_KEY="your_explorer_api_key"
SUPPLY_CHAIN_ADDRESS="0x..."
TPL_CONTRACT_ADDRESS="0x..."
GEMINI_API_KEY="your_gemini_api_key"
GROQ_API_KEY="your_groq_api_key"
```

### 2.3. Công cụ cần thiết trên máy local
- Terminal/PowerShell
- SSH client
- (Optional) AWS CLI

---

## 3. Bước 1: Tạo EC2 Instance

### 3.1. Đăng nhập AWS Console
1. Truy cập: https://console.aws.amazon.com
2. Chọn Region gần nhất (ví dụ: `ap-southeast-1` - Singapore)

### 3.2. Tạo Instance
1. Vào **EC2 Dashboard** → **Launch Instance**

2. **Name and tags:**
   ```
   Name: AutoGrowChain-Production
   ```

3. **Application and OS Images:**
   - Chọn **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type**
   - Architecture: **64-bit (x86)**

4. **Instance type:**
   - Khuyến nghị: **t3.medium** (2 vCPU, 4GB RAM) - ~$30/tháng
   - Nếu cần AI mạnh hơn: **t3.large** (2 vCPU, 8GB RAM) - ~$60/tháng

5. **Key pair:**
   - Bấm **Create new key pair**
   - Name: `autogrowchain-key`
   - Type: RSA
   - Format: `.pem` (cho Mac/Linux) hoặc `.ppk` (cho PuTTY/Windows)
   - **Tải về và lưu cẩn thận!**

6. **Network settings:**
   - Bấm **Edit**
   - VPC: default
   - Subnet: Chọn bất kỳ
   - Auto-assign public IP: **Enable**
   - Firewall: **Create security group** (sẽ cấu hình sau)

7. **Configure storage:**
   - Size: **30 GiB** (tối thiểu)
   - Volume type: **gp3**

8. Bấm **Launch Instance**

---

## 4. Bước 2: Cấu hình Security Group

### 4.1. Tìm Security Group
1. Vào **EC2** → **Security Groups**
2. Tìm security group của instance vừa tạo

### 4.2. Cấu hình Inbound Rules
Bấm **Edit inbound rules** và thêm:

| Type | Port Range | Source | Description |
|------|------------|--------|-------------|
| SSH | 22 | My IP | SSH Access |
| HTTP | 80 | 0.0.0.0/0 | Web HTTP |
| HTTPS | 443 | 0.0.0.0/0 | Web HTTPS |
| Custom TCP | 8000 | 0.0.0.0/0 | AI API (optional) |

> ⚠️ **Bảo mật:** Chỉ mở port 22 cho IP của bạn, không mở 0.0.0.0/0

---

## 5. Bước 3: Gán Elastic IP

Elastic IP giúp giữ IP cố định khi restart instance.

1. Vào **EC2** → **Elastic IPs**
2. Bấm **Allocate Elastic IP address**
3. Bấm **Allocate**
4. Chọn IP vừa tạo → **Actions** → **Associate Elastic IP address**
5. Chọn instance `AutoGrowChain-Production`
6. Bấm **Associate**

> 📝 Ghi lại IP này: ``

---

## 6. Bước 4: Cài đặt môi trường Server

### 6.1. SSH vào Server

**Windows (PowerShell):**
```powershell
ssh -i "autogrowchain-key.pem" ubuntu@YOUR_ELASTIC_IP
```

**Mac/Linux:**
```bash
chmod 400 autogrowchain-key.pem
ssh -i "autogrowchain-key.pem" ubuntu@YOUR_ELASTIC_IP
```

### 6.2. Chạy script cài đặt tự động

Copy và chạy lệnh sau trên server:

```bash
curl -fsSL https://raw.githubusercontent.com/your-repo/autogrowchain/main/aws-deployment/scripts/setup-server.sh | sudo bash
```

**Hoặc chạy thủ công từng bước:**

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Cài đặt Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Cài đặt các công cụ hỗ trợ
sudo apt install -y htop unzip git

# Tạo thư mục cho project
mkdir -p ~/autogrowchain
```

**Quan trọng:** Thoát SSH và đăng nhập lại để Docker hoạt động:
```bash
exit
# Sau đó SSH lại
```

### 6.3. Kiểm tra cài đặt
```bash
docker --version
docker-compose --version
```

---

## 7. Bước 5: Upload và triển khai code

### 7.1. Chuẩn bị code trên máy local

**Bước 1:** Mở PowerShell tại thư mục project

**Bước 2:** Chạy script đóng gói:
```powershell
.\aws-deployment\scripts\package-for-deploy.ps1
```

Script sẽ tạo file `autogrowchain-deploy.tar.gz` (đã loại bỏ node_modules, .venv, v.v.)

### 7.2. Upload lên Server

```powershell
scp -i "autogrowchain-key.pem" autogrowchain-deploy.tar.gz ubuntu@YOUR_ELASTIC_IP:~/
```

### 7.3. Triển khai trên Server

SSH vào server và chạy:

```bash
cd ~

# Giải nén
tar -xzvf autogrowchain-deploy.tar.gz

# Vào thư mục project
cd autogrowchain

# Khởi chạy
docker-compose up -d --build
```

### 7.4. Kiểm tra trạng thái

```bash
# Xem các container đang chạy
docker-compose ps

# Xem logs
docker-compose logs -f

# Xem logs của service cụ thể
docker-compose logs -f ai-backend
```

---

## 8. Bước 6: Cấu hình SSL (HTTPS)

### 8.1. Chuẩn bị Domain (nếu có)
1. Trỏ domain về Elastic IP của bạn (A Record)
2. Đợi DNS propagate (5-30 phút)

### 8.2. Cài đặt Certbot và lấy SSL

```bash
# Dừng nginx tạm thời
docker-compose stop frontend

# Cài đặt certbot
sudo apt install -y certbot

# Lấy certificate (thay YOUR_DOMAIN)
sudo certbot certonly --standalone -d YOUR_DOMAIN.com -d www.YOUR_DOMAIN.com

# Copy certificate vào project
sudo cp /etc/letsencrypt/live/YOUR_DOMAIN.com/fullchain.pem ~/autogrowchain/nginx/ssl/
sudo cp /etc/letsencrypt/live/YOUR_DOMAIN.com/privkey.pem ~/autogrowchain/nginx/ssl/
sudo chown -R $USER:$USER ~/autogrowchain/nginx/ssl/
```

### 8.3. Cập nhật Nginx config

Sử dụng file `nginx/default-ssl.conf` đã chuẩn bị sẵn:

```bash
cp ~/autogrowchain/nginx/default-ssl.conf ~/autogrowchain/nginx/default.conf
```

### 8.4. Khởi động lại

```bash
docker-compose up -d --build frontend
```

### 8.5. Tự động gia hạn SSL

```bash
# Thêm cron job
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker-compose -f ~/autogrowchain/docker-compose.yml restart frontend") | crontab -
```

---

## 9. Bước 7: Cấu hình Backup tự động

### 9.1. Backup SQLite Database

```bash
# Tạo thư mục backup
mkdir -p ~/backups

# Thêm cron job backup hàng ngày lúc 2h sáng
(crontab -l 2>/dev/null; echo "0 2 * * * cp ~/autogrowchain/blockchain_server/autogrowchain.db ~/backups/autogrowchain-\$(date +\%Y\%m\%d).db") | crontab -

# Xóa backup cũ hơn 7 ngày
(crontab -l 2>/dev/null; echo "0 3 * * * find ~/backups -name '*.db' -mtime +7 -delete") | crontab -
```

### 9.2. (Optional) Backup lên S3

```bash
# Cài đặt AWS CLI
sudo apt install -y awscli

# Cấu hình AWS credentials
aws configure

# Thêm cron job sync lên S3
(crontab -l 2>/dev/null; echo "0 4 * * * aws s3 sync ~/backups s3://your-bucket-name/autogrowchain-backups/") | crontab -
```

---

## 10. Quản lý và vận hành

### 10.1. Các lệnh thường dùng

```bash
# Xem trạng thái
docker-compose ps

# Xem logs realtime
docker-compose logs -f

# Restart tất cả services
docker-compose restart

# Restart service cụ thể
docker-compose restart ai-backend

# Dừng hệ thống
docker-compose down

# Khởi động lại
docker-compose up -d

# Cập nhật code mới
docker-compose down
docker-compose up -d --build
```

### 10.2. Monitoring

```bash
# Xem tài nguyên hệ thống
htop

# Xem disk usage
df -h

# Xem Docker disk usage
docker system df
```

### 10.3. Dọn dẹp Docker

```bash
# Xóa images không dùng
docker image prune -a

# Xóa tất cả không dùng (cẩn thận!)
docker system prune -a
```

---

## 11. Xử lý sự cố

### 11.1. Container không khởi động

```bash
# Xem logs chi tiết
docker-compose logs ai-backend

# Kiểm tra port đang dùng
sudo netstat -tlnp | grep :80
```

### 11.2. Hết dung lượng disk

```bash
# Kiểm tra
df -h

# Dọn dẹp Docker
docker system prune -a

# Xóa logs cũ
sudo journalctl --vacuum-time=3d
```

### 11.3. AI Backend chậm

- Nâng cấp instance type lên `t3.large` hoặc `t3.xlarge`
- Hoặc sử dụng instance có GPU: `g4dn.xlarge`

### 11.4. Không kết nối được

1. Kiểm tra Security Group đã mở port chưa
2. Kiểm tra instance đang chạy
3. Kiểm tra Elastic IP đã gán chưa

---

## Chi phí ước tính

| Thành phần | Chi phí/tháng |
|------------|---------------|
| EC2 t3.medium | ~$30 |
| Elastic IP (đang dùng) | $0 |
| EBS 30GB gp3 | ~$2.5 |
| Data Transfer (100GB) | ~$9 |
| **Tổng** | **~$42/tháng** |

---

## Hỗ trợ

Nếu gặp vấn đề, hãy kiểm tra:
1. Logs: `docker-compose logs -f`
2. Trạng thái: `docker-compose ps`
3. Tài nguyên: `htop`

---

*Tài liệu được tạo tự động cho dự án AutoGrowChain*
