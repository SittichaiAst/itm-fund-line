# วิธีเปิดใช้งาน LINE OA + LIFF (โปรเจกต์กองทุนรุ่น)

คู่มือนี้ครอบคลุมทั้งเส้นสำหรับ **หนึ่งรุ่น (หนึ่ง cohort)** ตาม `docs/DECISIONS.md`:

สร้าง LINE Official Account → Messaging API → **LINE Login + LIFF** → โฮสต์ `index.html` ด้วย **GitHub Pages** → ใส่ค่าในแอปและ Script Properties

อ้างอิงคอนโซล: [LINE Developers Console](https://developers.line.biz/console/)

---

## สิ่งที่ต้องมีก่อนเริ่ม

- บัญชี LINE ที่ใช้ดูแลรุ่นได้
- บัญชี GitHub (สำหรับโฮสต์หน้าเว็บ)
- Google Sheet + Apps Script (`Code.gs`) พร้อม Deploy Web App แล้ว (ได้ URL สำหรับ API)
- อีเมลเหรัญญิกสำหรับแชร์ Sheet/Drive

> เทสต์ flow โดยไม่พึ่ง LINE ได้ก่อน ด้วย  
> `https://<user>.github.io/<repo>/?mock=1&pw=รหัส` หลังตั้ง `MOCK_PASSWORD`

---

## สถาปัตยกรรม channel (สำคัญ)

LINE **ห้าม** เพิ่ม LIFF บน Messaging API channel แล้ว  
ต้องแยกเป็น 2 channel ภายใต้ **Provider เดียวกัน**:

| Channel | ใช้ทำอะไร |
|---|---|
| **LINE Login** | สร้าง LIFF, ได้ LIFF ID, ออก `id_token` |
| **Messaging API** (ผูก OA) | Push ตอน Reject, ให้สมาชิกแอดเพื่อน |

| ค่า | เอาจาก channel ไหน | ใส่ที่ |
|---|---|---|
| LIFF ID | LINE Login → แท็บ LIFF | `index.html` → `APP_CONFIG.liffId` |
| Endpoint URL | GitHub Pages URL | หน้าตั้งค่า LIFF |
| GAS Web App URL | Deploy ของ `Code.gs` | `index.html` → `APP_CONFIG.gasUrl` |
| `LINE_CHANNEL_ID` | **Channel ID ของ LINE Login** | Script Properties |
| `LINE_CHANNEL_ACCESS_TOKEN` | **Messaging API** (long-lived) | Script Properties |

ถ้า Login กับ Messaging API คนละ Provider → `userId` คนละชุด → Reject push จะไม่ถึงคนที่ bind ไว้

เอกสาร LINE: [Create a channel for LIFF](https://developers.line.biz/en/docs/liff/getting-started/)

---

## ขั้นที่ 0 — โฮสต์ `index.html` ด้วย GitHub Pages (วิธีหลัก)

โปรเจกต์นี้เสิร์ฟหน้าเว็บจาก **root ของ repo** (`index.html` อยู่ที่รากโปรเจกต์)

### ถ้า repo พร้อมแล้ว

1. เปิด GitHub → เข้า repo → **Settings → Pages**
2. **Build and deployment → Source**: Deploy from a branch
3. Branch: `main` / Folder: `/ (root)` → **Save**
4. รอ 1–3 นาที แล้วเปิด URL รูป:

```text
https://<github-username>.github.io/<repo-name>/
```

ตัวอย่าง: `https://sittichaiast.github.io/itm-fund-line/`

5. เทสต์ในเบราว์เซอร์ว่าหน้า “โอน & ส่งสลิป” ขึ้น (อาจยัง error เรื่อง LIFF ID / gasUrl จนกว่าจะใส่ config)

### อัปเดตหน้าเว็บทีหลัง

1. แก้ `index.html` (เช่น `APP_CONFIG`)
2. `git add` → `git commit` → `git push`
3. รอ Pages build แล้วรีเฟรช (บางทีต้อง hard refresh)

### สิ่งที่ GitHub Pages **ไม่** ทำ

- ไม่รัน `Code.gs` — API ยังอยู่ที่ Google Apps Script Web App
- อย่าใส่ Channel access token / `MOCK_PASSWORD` ลงใน repo แบบสาธารณะโดยไม่จำเป็น (ใส่ใน Script Properties)

---

## ขั้นที่ 1 — สร้าง LINE Official Account (ถ้ายังไม่มี)

1. ไปที่ [LINE Official Account Manager](https://manager.line.biz/) หรือสร้างผ่าน LINE Developers
2. สร้าง OA สำหรับรุ่นนี้ (เช่น กองทุนรุ่น XX)
3. ตั้งรูปโปรไฟล์ / ข้อความต้อนรับตามต้องการ

หมายเหตุ: **หนึ่งรุ่น = หนึ่งชุด OA/channel (แนะนำแยก)** ตามมติ clone ต่อรุ่น

---

## ขั้นที่ 2 — สร้าง Messaging API Channel

1. เปิด [LINE Developers Console](https://developers.line.biz/console/)
2. สร้างหรือเลือก **Provider**
3. **Create a new channel** → **Messaging API** → ผูก OA
4. แท็บ **Messaging API** → ออก **Channel access token (long-lived)**  
   → เก็บเป็น Script Property `LINE_CHANNEL_ACCESS_TOKEN`
5. Webhook: v1 **ไม่บังคับ** (เหรัญญิกอนุมัติใน Sheet) แต่ต้องมี token สำหรับ Push ตอน Reject

สมาชิกต้อง **แอดเพื่อน OA** ก่อนจึงรับข้อความ Reject ได้

---

## ขั้นที่ 3 — สร้าง LINE Login Channel + LIFF

1. ใน **Provider เดียวกับขั้น 2** → **Create a new channel** → **LINE Login**
2. App types: เลือก **Web app**
3. เปิดแท็บ **LIFF** → **Add**  
   (ถ้าไปเพิ่ม LIFF ใน Messaging API จะเจอข้อความว่าใช้ไม่ได้ — ให้กลับมาที่ LINE Login)
4. กรอกค่า:

| ช่อง | ค่าแนะนำ |
|---|---|
| LIFF app name | เช่น `แจ้งชำระเงินรุ่นXX` (ห้ามมีคำว่า LINE) |
| Size | **Full** |
| Endpoint URL | URL GitHub Pages เช่น `https://<user>.github.io/<repo>/` |
| Scope | **`profile`** + **`openid`** (จำเป็นสำหรับ `liff.getIDToken()`) |
| Add friend option | **On (Aggressive)** หรือ On ปกติ — ผูกกับ OA ของ Messaging API |
| Scan QR | Off ก็ได้ |
| Module mode | Off |

5. บันทึกแล้วคัดลอก **LIFF ID**
6. จาก **Channel basic settings ของ LINE Login** คัดลอก **Channel ID**  
   → Script Property `LINE_CHANNEL_ID` (ใช้ verify `id_token` — **ไม่ใช่** Channel ID ของ Messaging API)

ลิงก์เปิดแอป: `https://liff.line.me/{LIFF_ID}`

---

## ขั้นที่ 4 — ใส่ค่าใน `index.html` แล้ว push

แก้ใน repo:

```js
const APP_CONFIG = {
  liffId: 'YOUR_LIFF_ID',
  gasUrl: 'YOUR_GAS_WEB_APP_URL'
};
```

ตัวอย่าง:

```js
const APP_CONFIG = {
  liffId: '1234567890-abcdefgh',
  gasUrl: 'https://script.google.com/macros/s/XXXX/exec'
};
```

จากนั้น:

```bash
git add index.html
git commit -m "Configure LIFF and GAS URLs"
git push
```

รอ GitHub Pages อัปเดต แล้วตั้ง **Endpoint URL** ใน LIFF ให้ชี้ Pages URL เดียวกัน

---

## ขั้นที่ 5 — Deploy Google Apps Script (API เท่านั้น)

`Code.gs` ทำหน้าที่ API (`doPost`) — **ไม่ต้อง** ใช้ `doGet` เสิร์ฟหน้าเว็บแล้ว เพราะหน้าเว็บอยู่ที่ GitHub Pages

1. เปิด Google Sheet → **Extensions → Apps Script**
2. วางโค้ดจาก `Code.gs`
3. **Project Settings (เฟือง) → Script properties → Add script property**

| Property | ค่า |
|---|---|
| `SHEET_ID` | ID ใน URL สเปรดชีต |
| `DRIVE_FOLDER_ID` | ID โฟลเดอร์สลิป |
| `LINE_CHANNEL_ID` | Channel ID ของ **LINE Login** |
| `LINE_CHANNEL_ACCESS_TOKEN` | Token จาก **Messaging API** |
| `MOCK_PASSWORD` | รหัสสำหรับ `?mock=1` |
| `LIFF_ID` | (ทางเลือก) |

วิธีเปิด Script properties: Apps Script → ไอคอนเฟืองซ้าย → หัวข้อ **Script properties** → **Save script properties**

4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. คัดลอก Web App URL ไปใส่ `APP_CONFIG.gasUrl` แล้ว push `index.html` อีกครั้ง
6. แก้ `Code.gs` ทีหลัง → Deploy ใหม่ (New version)

---

## ขั้นที่ 6 — เปิดใช้งานให้สมาชิก

1. ลิงก์ LIFF: `https://liff.line.me/{LIFF_ID}`
2. หรือ Rich Menu / ปุ่มใน OA
3. หรือ QR จากลิงก์ด้านบน

สมาชิก: login → ผูกบัญชีครั้งแรก → ส่งสลิป → ดูประวัติ  

เหรัญญิก: Sheet (Editor เท่านั้น) → เมนู **กองทุนรุ่น** → อนุมัติ / ปฏิเสธ… / Unbind / Sync Drive share

---

## ขั้นที่ 7 — Checklist ทดสอบ

### A. Mock บน GitHub Pages

```text
https://<user>.github.io/<repo>/?mock=1&pw=รหัส&uid=mock-user-001
```

### B. LIFF จริงบนมือถือ

1. เปิด `https://liff.line.me/{LIFF_ID}` ในแอป LINE
2. ไม่ error เรื่อง LIFF ID / gasUrl / id_token
3. ผูกบัญชี + ส่งสลิป → แถว `Pending` ใน Sheet
4. Reject แล้วได้ข้อความ LINE + เห็นเหตุผลในประวัติ

### C. จุดที่พบบ่อย

| อาการ | สาเหตุที่พบบ่อย |
|---|---|
| เพิ่ม LIFF ใน Messaging API ไม่ได้ | ปกติ — ไปสร้างที่ **LINE Login** แทน |
| หน้า 404 บน github.io | ยังไม่เปิด Pages / branch ไม่ใช่ `main` / รอ build |
| `ยังไม่ได้ตั้ง LIFF ID` | ยังไม่แก้ `APP_CONFIG` หรือยังไม่ push |
| `ไม่ได้รับ LINE ID token` | ลืม scope **`openid`** |
| `LINE verify failed` | ใส่ Channel ID ของ Messaging API แทน Login |
| Reject แล้วไม่ถึง LINE | ยังไม่แอดเพื่อน OA / token ผิด / คนละ Provider |
| เปิด LIFF แล้วหน้าเก่า | รอ Pages deploy หรือ hard refresh |

---

## หลายรุ่น (clone)

1. Sheet + Drive + GAS deployment ใหม่  
2. (แนะนำ) OA / Login+Messaging แยก หรืออย่างน้อย LIFF แยก  
3. ถ้าใช้ repo เดียวกัน: ต้องแยกหน้า/ config ต่อรุ่น (หรือแยก repo)  
4. แชร์ `https://liff.line.me/{LIFF_ID}` คนละอัน

---

## ลำดับที่แนะนำเมื่อเริ่มจากศูนย์

1. สร้าง Sheet จาก `sheets/*.csv` + รายชื่อ + `Config`
2. Deploy `Code.gs` + Script Properties (`MOCK_PASSWORD` ก่อนก็ได้)
3. เปิด GitHub Pages → เทสต์ `?mock=1`
4. สร้าง OA + Messaging API + LINE Login + LIFF (Endpoint = Pages URL)
5. ใส่ `liffId` / `gasUrl` ใน `index.html` แล้ว push
6. เทสต์บนมือถือใน LINE
7. เปิดลิงก์ให้สมาชิก

ดู checklist สั้นใน `docs/DECISIONS.md`
