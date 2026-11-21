# วิธีเปิดใช้งาน LINE OA + LIFF (โปรเจกต์กองทุนรุ่น)

คู่มือฉบับเต็มสำหรับ **หนึ่งรุ่น (หนึ่ง cohort)** ตาม `docs/DECISIONS.md`

ลำดับใหญ่:

1. GitHub Pages โฮสต์ `index.html`
2. Google Apps Script (`Code.gs`) เป็น API
3. LINE: OA + Messaging API + **LINE Login** + LIFF
4. ใส่ค่า config แล้วทดสอบ

Repo นี้: https://github.com/SittichaiAst/itm-fund-line  
หน้าเว็บ: https://sittichaiast.github.io/itm-fund-line/  
คอนโซล LINE: https://developers.line.biz/console/

---

## ถ้าเจอข้อความนี้บนหน้าเว็บ

### `ยังไม่ได้ตั้ง LIFF ID ใน APP_CONFIG`

**ตั้งที่ไฟล์ในเครื่อง/repo — ไม่ใช่ใน LINE Console และไม่ใช่ Script Properties**

| รายการ | ค่า |
|---|---|
| ไฟล์ | `index.html` (รากโปรเจกต์ ไม่ได้อยู่ใน `docs/`) |
| ตัวแปร | `APP_CONFIG.liffId` |
| ค่าที่ได้จาก | LINE Developers → **LINE Login** channel → แท็บ **LIFF** → **LIFF ID** |

#### วิธีแก้ทีละขั้น

1. เปิดไฟล์ `index.html` ใน Cursor / VS Code / บน GitHub กด Edit
2. หาบล็อกประมาณนี้ (ใน `<script>`):

```js
const APP_CONFIG = {
  liffId: 'YOUR_LIFF_ID',
  gasUrl: 'YOUR_GAS_WEB_APP_URL'
};
```

3. แทนที่ `'YOUR_LIFF_ID'` ด้วย LIFF ID จริง เช่น `'1234567890-AbCdEfGh'`
4. ถ้ามี GAS URL แล้ว แทนที่ `'YOUR_GAS_WEB_APP_URL'` ด้วย URL ที่ลงท้าย `/exec`
5. บันทึกไฟล์ แล้วอัปขึ้น GitHub:

```bash
git add index.html
git commit -m "Set LIFF ID and GAS URL in APP_CONFIG"
git push
```

6. รอ GitHub Pages 1–3 นาที แล้ว **hard refresh** (`Ctrl+F5`) ที่  
   https://sittichaiast.github.io/itm-fund-line/

> **อย่าสับสน:**  
> - ใส่ LIFF ID ใน `index.html` = ให้หน้าเว็บเรียก `liff.init()` ได้  
> - ใส่ Endpoint URL ใน LINE Console = บอก LINE ว่าจะเปิดหน้าเว็บจาก URL ไหน  
> - สองอย่างคนละที่ ต้องทำทั้งคู่

### `ยังไม่ได้ตั้ง GAS Web App URL ใน APP_CONFIG`

แก้ที่ไฟล์เดียวกัน: `index.html` → `APP_CONFIG.gasUrl`  
ค่ามาจาก Apps Script → **Deploy → Web app** → URL แบบ  
`https://script.google.com/macros/s/XXXX/exec`  
แล้ว `git push` เช่นเดียวกับด้านบน

---

## แผนที่ค่าทั้งหมด (อ่านก่อนลงมือ)

| ค่า | ได้จากที่ไหน | ใส่ที่ไหน |
|---|---|---|
| หน้าเว็บ HTTPS | GitHub Pages | ใช้เป็น LIFF **Endpoint URL** ใน Console |
| `liffId` | LINE Login → LIFF | **`index.html` → `APP_CONFIG.liffId`** แล้ว push |
| `gasUrl` | Apps Script Web App | **`index.html` → `APP_CONFIG.gasUrl`** แล้ว push |
| `LINE_CHANNEL_ID` | Channel ID ของ **LINE Login** | Apps Script → **Script properties** |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API → long-lived token | Apps Script → **Script properties** |
| `SHEET_ID` | ID ใน URL Google Sheet | Script properties |
| `DRIVE_FOLDER_ID` | ID โฟลเดอร์ Drive เก็บสลิป | Script properties |
| `MOCK_PASSWORD` | ตั้งเอง | Script properties |
| `LIFF_ID` | (ทางเลือก สำเนาไว้ดู) | Script properties |

**ห้าม** ใส่ Channel access token / `MOCK_PASSWORD` ลงใน `index.html` หรือ repo ถ้าไม่จำเป็น (repo เป็น public)

---

## สถาปัตยกรรม LINE channel (สำคัญ)

LINE **ห้าม** เพิ่ม LIFF บน Messaging API channel  
ต้องมี 2 channel ภายใต้ **Provider เดียวกัน**:

| Channel | ใช้ทำอะไร |
|---|---|
| **LINE Login** | สร้าง LIFF, ได้ LIFF ID, ออก `id_token` |
| **Messaging API** (ผูก OA) | Push ตอน Reject, ให้สมาชิกแอดเพื่อน |

ถ้า Login กับ Messaging API คนละ Provider → `userId` คนละชุด → Reject push ไม่ถึงคนที่ bind

อ้างอิง: [Create a channel for LIFF](https://developers.line.biz/en/docs/liff/getting-started/)

ข้อความใน Console แบบ *“You can no longer add LIFF apps to a Messaging API channel…”* = ปกติ ให้ไปสร้าง LIFF ที่ **LINE Login** แทน  
(โซนไทยส่วนใหญ่ยังใช้ LIFF บน Login channel ได้ — LINE MINI App อาจสร้างไม่ได้)

---

## ขั้นที่ 0 — GitHub Pages (โฮสต์ `index.html`)

หน้าเว็บอยู่ที่ **root ของ repo** ไฟล์ชื่อ `index.html`

### ของโปรเจกต์นี้ (เปิดไว้แล้ว)

- Repo: https://github.com/SittichaiAst/itm-fund-line  
- Pages: https://sittichaiast.github.io/itm-fund-line/  
- Settings → Pages → Source: branch **`main`**, folder **`/ (root)`**

### ถ้าต้องเปิด Pages ใหม่ใน repo อื่น

1. GitHub → repo → **Settings → Pages**
2. Deploy from a branch → `main` → `/ (root)` → Save
3. รอจนสถานะเป็น built (ถ้าเปิดทันทีอาจ 404 ชั่วคราว)

### อัปเดตหน้าเว็บ

แก้ไฟล์ในเครื่อง → `git add` → `git commit` → `git push` → รอ build → hard refresh

Pages **ไม่รัน** `Code.gs` — API อยู่ที่ Google แยก

---

## ขั้นที่ 1 — สร้าง LINE Official Account

1. [LINE Official Account Manager](https://manager.line.biz/) หรือสร้างผ่าน Developers
2. สร้าง OA สำหรับรุ่น (ชื่อที่สมาชิกรู้จัก)
3. ตั้งรูป / ข้อความต้อนรับตามต้องการ

หนึ่งรุ่นแนะนำแยกชุด OA/channel

---

## ขั้นที่ 2 — Messaging API Channel

1. [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง/เลือก **Provider**
3. **Create channel** → **Messaging API** → ผูก OA
4. แท็บ **Messaging API** → ออก **Channel access token (long-lived)**  
   → เก็บไว้ใส่ Script Property `LINE_CHANNEL_ACCESS_TOKEN`
5. Webhook: v1 ไม่บังคับ (เหรัญญิกใช้เมนูใน Sheet)

สมาชิกต้อง **แอดเพื่อน OA** ก่อนจึงรับข้อความ Reject ได้

---

## ขั้นที่ 3 — LINE Login Channel + สร้าง LIFF (ได้ LIFF ID)

1. ใน **Provider เดียวกับขั้น 2** → **Create channel** → **LINE Login**
2. App types: **Web app**
3. แท็บ **LIFF** → **Add**  
   (อย่าไป Add ใน Messaging API)
4. กรอก:

| ช่อง | ค่าแนะนำ |
|---|---|
| LIFF app name | เช่น `แจ้งชำระเงินรุ่นXX` (ห้ามมีคำว่า LINE) |
| Size | **Full** |
| Endpoint URL | `https://sittichaiast.github.io/itm-fund-line/` |
| Scope | **`profile`** + **`openid`** (จำเป็นต่อ `liff.getIDToken()`) |
| Add friend option | On / On (Aggressive) ผูก OA ของ Messaging API |
| Scan QR | Off ก็ได้ |
| Module mode | Off |

5. **Add / Update** แล้วคัดลอก **LIFF ID** (รูป `1234567890-AbCdEfGh`)
6. ไป **Channel basic settings ของ LINE Login** → คัดลอก **Channel ID**  
   → จะใส่ Script Property `LINE_CHANNEL_ID`  
   (**ไม่ใช่** Channel ID ของ Messaging API)

ลิงก์เปิดแอปหลังตั้งครบ: `https://liff.line.me/{LIFF_ID}`

---

## ขั้นที่ 4 — ใส่ LIFF ID / GAS URL ใน `index.html` แล้ว push

นี่คือจุดที่แก้ error `ยังไม่ได้ตั้ง LIFF ID ใน APP_CONFIG`

### 4.1 แก้ไฟล์

ไฟล์: [`index.html`](../index.html) ที่รากโปรเจกต์

```js
const APP_CONFIG = {
  liffId: 'วาง-LIFF-ID-จากขั้น-3-ที่นี่',
  gasUrl: 'https://script.google.com/macros/s/XXXX/exec'
};
```

- `liffId` = จากขั้น 3  
- `gasUrl` = จากขั้น 5 (ถ้ายังไม่มี Deploy ใส่ทีหลังได้ แต่หน้าเว็บจะฟ้องเรื่อง gasUrl)

### 4.2 Push ขึ้น GitHub

```bash
cd d:\Workspace\itm-fund-line
git add index.html
git commit -m "Set LIFF ID and GAS URL in APP_CONFIG"
git push
```

### 4.3 ตรวจ

1. รอ Pages อัปเดต  
2. เปิด https://sittichaiast.github.io/itm-fund-line/ แบบ hard refresh  
3. ข้อความ “ยังไม่ได้ตั้ง LIFF ID” ต้องหาย  
4. ตรวจว่า Endpoint ใน LIFF Console ยังเป็น Pages URL ด้านบน

---

## ขั้นที่ 5 — Deploy `Code.gs` + Script Properties

`Code.gs` = API (`doPost`) อย่างเดียว ไม่โฮสต์หน้าเว็บ

### 5.1 วางโค้ด

1. เปิด Google Sheet ของรุ่น → **Extensions → Apps Script**
2. วางเนื้อหาจากไฟล์ `Code.gs` ใน repo
3. Save

### 5.2 ตั้ง Script Properties

1. ใน Apps Script คลิกไอคอน **เฟือง (Project Settings)** ด้านซ้าย  
2. เลื่อนไป **Script properties**  
3. **Add script property** ทีละคู่ แล้ว **Save script properties**

| Property | Value |
|---|---|
| `SHEET_ID` | ส่วนใน URL: `docs.google.com/spreadsheets/d/`**`ID_นี้`**`/edit` |
| `DRIVE_FOLDER_ID` | ID โฟลเดอร์ Drive เก็บสลิป |
| `LINE_CHANNEL_ID` | Channel ID ของ **LINE Login** (ขั้น 3) |
| `LINE_CHANNEL_ACCESS_TOKEN` | Token จาก **Messaging API** (ขั้น 2) |
| `MOCK_PASSWORD` | รหัสที่ตั้งเอง สำหรับเทสต์ mock |
| `LIFF_ID` | (ทางเลือก) สำเนา LIFF ID |

ชื่อ Property ต้องสะกดตรงนี้เป๊ะ

### 5.3 Deploy Web App

1. **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy → คัดลอก URL (`.../exec`)
6. กลับไปขั้น 4 ใส่ใน `APP_CONFIG.gasUrl` แล้ว push อีกครั้ง
7. ทุกครั้งที่แก้ `Code.gs` → Deploy ใหม่แบบ **New version บน deployment เดิม** (ดูด้านล่าง)

### ต้องแก้ `gasUrl` ใน git ทุกครั้งที่ Deploy ไหม?

**ไม่ต้อง** — ถ้าอัปเดตโค้ดด้วยวิธีนี้ URL จะเดิม:

1. **Deploy → Manage deployments**
2. กดดินสอที่ Web app เดิม
3. Version: **New version**
4. เก็บ Who has access เป็น **Anyone** แล้ว Deploy

แก้ `index.html` + `git push` **เฉพาะเมื่อ URL เปลี่ยน** เช่น กด **New deployment** แล้วได้ลิงก์ใหม่ หรือลบ deployment เก่าแล้วสร้างใหม่

---

## ขั้นที่ 6 — เปิดให้สมาชิกใช้

1. ลิงก์หลัก: `https://liff.line.me/{LIFF_ID}`
2. หรือปุ่ม / Rich Menu ใน OA
3. หรือ QR จากลิงก์ด้านบน

**สมาชิก:** เปิด LIFF → login → กรอก **รหัสนักศึกษา** → ตรวจสอบ → ยืนยันชื่อแล้วผูก → ส่งสลิป → ดูประวัติ  
(ระบบไม่โชว์รายชื่อทั้งรุ่นให้เลือก)

**เหรัญญิก:** แชร์ Sheet เฉพาะ Editor → เมนู **กองทุนรุ่น**  
Approve / Reject… / Unbind / Sync Drive share  

ตอน Reject ระบบ push LINE (ต้องแอดเพื่อน OA แล้ว)

---

## ขั้นที่ 7 — Checklist ทดสอบ

### A. Mock (ไม่ใช้ LINE login)

ต้องตั้ง `MOCK_PASSWORD` และ `gasUrl` แล้ว

```text
https://sittichaiast.github.io/itm-fund-line/?mock=1&pw=รหัสของคุณ&uid=mock-user-001
```

### B. LIFF จริงบนมือถือ

1. เปิด `https://liff.line.me/{LIFF_ID}` ในแอป LINE  
2. ไม่เจอ error LIFF ID / gasUrl / id_token  
3. ผูกบัญชี + ส่งสลิป → แถว `Pending` ใน Sheet  
4. Reject พร้อมเหตุผล → ได้ข้อความ LINE + เห็นในประวัติ  

### C. ตารางแก้ปัญหา

| อาการ | แก้ที่ |
|---|---|
| `ยังไม่ได้ตั้ง LIFF ID ใน APP_CONFIG` | แก้ `index.html` → `APP_CONFIG.liffId` แล้ว **push** + hard refresh |
| `ยังไม่ได้ตั้ง GAS Web App URL` | แก้ `APP_CONFIG.gasUrl` แล้ว push |
| เพิ่ม LIFF ใน Messaging API ไม่ได้ | ไปสร้างที่ **LINE Login** |
| github.io 404 | รอ Pages build / ตรวจ Settings → Pages |
| แก้แล้วแต่หน้าเก่ายังฟ้อง | ยังไม่ push / cache — รอ build + `Ctrl+F5` |
| `ไม่ได้รับ LINE ID token` | เปิด scope **`openid`** ใน LIFF |
| `LINE verify failed` | `LINE_CHANNEL_ID` ต้องเป็นของ **LINE Login** |
| Reject แล้วไม่ถึง LINE | แอดเพื่อน OA / ตรวจ token / คนละ Provider |
| ส่งสลิปไม่เข้า Sheet | ตรวจ `gasUrl` เป็น `/exec` ล่าสุด และ Script properties |

---

## หลายรุ่น (clone)

1. Sheet + Drive + GAS deployment ใหม่  
2. (แนะนำ) ชุด Login + Messaging แยก หรืออย่างน้อย LIFF แยก  
3. `APP_CONFIG` คนละชุด (`liffId` + `gasUrl`) — ถ้า repo เดียวต้องแยกหน้า/โฟลเดอร์ หรือแยก repo  
4. แชร์ `https://liff.line.me/{LIFF_ID}` คนละอัน  

อย่าใช้ LIFF ID / GAS URL ข้ามรุ่น

---

## ลำดับแนะนำเมื่อเริ่มจากศูนย์

1. สร้าง Sheet จาก `sheets/*.csv` + รายชื่อ + แท็บ `Config`  
2. Deploy `Code.gs` + ตั้ง Script Properties (`MOCK_PASSWORD` ก่อนก็ได้)  
3. เปิด GitHub Pages → เทสต์ `?mock=1` (หลังมี `gasUrl`)  
4. สร้าง OA + Messaging API + LINE Login + LIFF (Endpoint = Pages URL)  
5. **ใส่ `liffId` / `gasUrl` ใน `index.html` แล้ว `git push`**  
6. เทสต์ในแอป LINE  
7. แจกลิงก์ `https://liff.line.me/{LIFF_ID}` ให้สมาชิก  

รายการสั้นเพิ่มใน `docs/DECISIONS.md`
