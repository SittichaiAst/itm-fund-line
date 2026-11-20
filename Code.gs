/**
 * Cohort Payment & Slip Submission — Google Apps Script backend
 * Aligns with docs/DECISIONS.md (overrides original SRS where noted).
 *
 * Deploy: Web App → Execute as: Me → Who has access: Anyone
 * Secrets: File → Project properties → Script properties
 */

var PROP = {
  SHEET_ID: 'SHEET_ID',
  DRIVE_FOLDER_ID: 'DRIVE_FOLDER_ID',
  LINE_CHANNEL_ID: 'LINE_CHANNEL_ID',
  LINE_CHANNEL_ACCESS_TOKEN: 'LINE_CHANNEL_ACCESS_TOKEN',
  MOCK_PASSWORD: 'MOCK_PASSWORD',
  LIFF_ID: 'LIFF_ID'
};

var SHEET = {
  MEMBERS: 'Members',
  TRANSACTIONS: 'Transactions',
  CONFIG: 'Config'
};

var STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected'
};

// --- Web entrypoints -------------------------------------------------------

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      service: 'cohort-payment',
      hint: 'POST text/plain JSON with action'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    var action = body.action;
    var result;

    switch (action) {
      case 'checkUser':
        result = apiCheckUser(body);
        break;
      case 'lookupMember':
        result = apiLookupMember(body);
        break;
      case 'bindUser':
        result = apiBindUser(body);
        break;
      case 'submitPayment':
        result = apiSubmitPayment(body);
        break;
      case 'getMyTransactions':
        result = apiGetMyTransactions(body);
        break;
      default:
        result = { status: 'error', message: 'Unknown action' };
    }

    return jsonOutput(result);
  } catch (err) {
    return jsonOutput({ status: 'error', message: String(err.message || err) });
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Sheet menu (treasurer) ------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('กองทุนรุ่น')
    .addItem('อนุมัติรายการที่เลือก', 'menuApproveSelected')
    .addItem('ปฏิเสธรายการที่เลือก…', 'menuRejectSelected')
    .addSeparator()
    .addItem('Unbind สมาชิกที่เลือก', 'menuUnbindSelected')
    .addItem('Sync Drive share', 'menuSyncDriveShare')
    .addToUi();
}

function menuApproveSelected() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var row = getSelectedTransactionRow_();
    var tx = readTransactionRow_(row);
    if (tx.status !== STATUS.PENDING) {
      throw new Error('รายการนี้ไม่ได้อยู่ในสถานะ Pending');
    }
    var ui = SpreadsheetApp.getUi();
    var reviewedBy = Session.getActiveUser().getEmail() || 'treasurer';
    var now = new Date();

    writeTransactionReview_(row, STATUS.APPROVED, '', now, reviewedBy);
    recomputeMemberTotalPaid_(tx.member_id);

    ui.alert('อนุมัติแล้ว: ' + tx.transaction_id);
  } finally {
    lock.releaseLock();
  }
}

function menuRejectSelected() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'ปฏิเสธรายการ',
    'กรอกเหตุผล (บังคับ) — จะถูกส่งเข้า LINE ของสมาชิก',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  var reason = String(response.getResponseText() || '').trim();
  if (!reason) {
    ui.alert('ต้องระบุเหตุผล');
    return;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var row = getSelectedTransactionRow_();
    var tx = readTransactionRow_(row);
    if (tx.status !== STATUS.PENDING) {
      throw new Error('รายการนี้ไม่ได้อยู่ในสถานะ Pending');
    }
    var reviewedBy = Session.getActiveUser().getEmail() || 'treasurer';
    var now = new Date();

    writeTransactionReview_(row, STATUS.REJECTED, reason, now, reviewedBy);
    recomputeMemberTotalPaid_(tx.member_id);
    pushRejectMessage_(tx, reason);

    ui.alert('ปฏิเสธแล้วและพยายามแจ้ง LINE แล้ว: ' + tx.transaction_id);
  } finally {
    lock.releaseLock();
  }
}

function menuUnbindSelected() {
  var ui = SpreadsheetApp.getUi();
  var sheet = getMembersSheet_();
  var range = sheet.getActiveRange();
  if (!range) {
    ui.alert('เลือกแถวสมาชิกในชีต Members ก่อน');
    return;
  }
  var row = range.getRow();
  if (row < 2) {
    ui.alert('เลือกแถวข้อมูลสมาชิก (ไม่ใช่หัวตาราง)');
    return;
  }

  var memberId = String(sheet.getRange(row, 1).getValue() || '');
  var name = String(sheet.getRange(row, 2).getValue() || '');
  var confirm = ui.alert(
    'Unbind สมาชิก',
    'ยืนยันยกเลิกการผูก LINE ของ ' + memberId + ' ' + name + '?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) {
    return;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    sheet.getRange(row, 4, row, 6).setValues([['', '', '']]);
    ui.alert('Unbind แล้ว — สมาชิกผูกใหม่ได้จาก LIFF');
  } finally {
    lock.releaseLock();
  }
}

function menuSyncDriveShare() {
  var emails = getTreasurerEmails_();
  if (!emails.length) {
    SpreadsheetApp.getUi().alert('ไม่พบ treasurer_emails ใน Config');
    return;
  }
  var folder = DriveApp.getFolderById(requireProp_(PROP.DRIVE_FOLDER_ID));
  folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);

  var files = folder.getFiles();
  var count = 0;
  while (files.hasNext()) {
    var file = files.next();
    ensurePrivateSharedWith_(file, emails);
    count++;
  }
  // Also ensure folder viewers
  emails.forEach(function (email) {
    try {
      folder.addViewer(email);
    } catch (err) {
      // ignore already-shared / invalid
    }
  });
  SpreadsheetApp.getUi().alert('Sync แล้ว ' + count + ' ไฟล์ → ' + emails.join(', '));
}

// --- Member API ------------------------------------------------------------

function apiCheckUser(body) {
  var lineUserId = authenticateLineUser_(body);
  var member = findMemberByLineUserId_(lineUserId);
  var config = getPublicConfig_();

  if (member) {
    return {
      status: 'bound',
      member: publicMember_(member),
      bank: config
    };
  }

  return {
    status: 'unbound',
    bank: config
  };
}

/** Lookup by member_id only — does not return the full unbound roster. */
function apiLookupMember(body) {
  authenticateLineUser_(body);
  var memberId = String(body.member_id || '').trim();
  if (!memberId) {
    throw new Error('กรุณากรอกรหัสสมาชิก');
  }

  var member = findMemberByMemberId_(memberId);
  if (!member) {
    throw new Error('ไม่พบรหัสสมาชิกนี้');
  }
  if (member.line_user_id) {
    throw new Error('รหัสนี้ถูกผูกบัญชีไปแล้ว');
  }

  return {
    status: 'ok',
    member: {
      member_id: member.member_id,
      full_name: member.full_name,
      nickname: member.nickname
    }
  };
}

function apiBindUser(body) {
  var lineUserId = authenticateLineUser_(body);
  var memberId = String(body.member_id || '').trim();
  var displayName = String(body.line_display_name || '').trim();
  if (!memberId) {
    throw new Error('member_id จำเป็น');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var existing = findMemberByLineUserId_(lineUserId);
    if (existing) {
      throw new Error('บัญชี LINE นี้ผูกกับสมาชิกอื่นแล้ว');
    }

    var sheet = getMembersSheet_();
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === memberId) {
        rowIndex = i + 1;
        var boundId = String(data[i][3] || '');
        if (boundId) {
          throw new Error('สมาชิกคนนี้ถูกผูกบัญชีไปแล้ว');
        }
        break;
      }
    }
    if (rowIndex < 0) {
      throw new Error('ไม่พบ member_id');
    }

    var now = new Date();
    sheet.getRange(rowIndex, 4, rowIndex, 6).setValues([[lineUserId, displayName, now]]);

    var member = findMemberByLineUserId_(lineUserId);
    return { status: 'success', member: publicMember_(member), bank: getPublicConfig_() };
  } finally {
    lock.releaseLock();
  }
}

function apiSubmitPayment(body) {
  var lineUserId = authenticateLineUser_(body);
  var member = findMemberByLineUserId_(lineUserId);
  if (!member) {
    throw new Error('ยังไม่ได้ผูกบัญชี');
  }

  var amount = Number(body.amount);
  if (!(amount > 0)) {
    throw new Error('จำนวนเงินต้องมากกว่า 0');
  }
  var transferDatetime = String(body.transfer_datetime || '').trim();
  if (!transferDatetime) {
    throw new Error('ต้องระบุวันเวลาที่โอน');
  }
  var fileBase64 = String(body.file_base64 || '');
  if (!fileBase64) {
    throw new Error('ต้องแนบสลิป');
  }
  var mime = String(body.file_mime_type || 'image/jpeg');
  var note = String(body.note || '');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var slipUrl = saveSlipToDrive_(member.member_id, amount, fileBase64, mime);
    var txId = nextTransactionId_();
    var now = new Date();
    var txSheet = getTransactionsSheet_();
    txSheet.appendRow([
      txId,
      member.member_id,
      member.full_name,
      lineUserId,
      transferDatetime,
      amount,
      slipUrl,
      note,
      STATUS.PENDING,
      now,
      '',
      '',
      ''
    ]);

    return {
      status: 'success',
      transaction_id: txId,
      slip_url: slipUrl
    };
  } finally {
    lock.releaseLock();
  }
}

function apiGetMyTransactions(body) {
  var lineUserId = authenticateLineUser_(body);
  var member = findMemberByLineUserId_(lineUserId);
  if (!member) {
    throw new Error('ยังไม่ได้ผูกบัญชี');
  }

  var sheet = getTransactionsSheet_();
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== member.member_id) {
      continue;
    }
    list.push({
      transaction_id: String(data[i][0] || ''),
      transfer_datetime: formatCellDate_(data[i][4]),
      amount: Number(data[i][5] || 0),
      note: String(data[i][7] || ''),
      status: String(data[i][8] || ''),
      submitted_at: formatCellDate_(data[i][9]),
      reject_reason: String(data[i][10] || ''),
      reviewed_at: formatCellDate_(data[i][11])
    });
  }
  list.reverse();
  return {
    status: 'success',
    member: publicMember_(member),
    transactions: list
  };
}

// --- Auth ------------------------------------------------------------------

function authenticateLineUser_(body) {
  if (body.mock === true || body.mock === 'true') {
    var expected = PropertiesService.getScriptProperties().getProperty(PROP.MOCK_PASSWORD);
    if (!expected) {
      throw new Error('โหมด mock ยังไม่ได้ตั้ง MOCK_PASSWORD');
    }
    if (String(body.mock_password || '') !== expected) {
      throw new Error('รหัส mock ไม่ถูกต้อง');
    }
    var mockId = String(body.line_user_id || '').trim();
    if (!mockId) {
      throw new Error('mock ต้องส่ง line_user_id');
    }
    return mockId;
  }

  var idToken = String(body.id_token || '').trim();
  if (!idToken) {
    throw new Error('ต้องส่ง id_token');
  }
  var verified = verifyLineIdToken_(idToken);
  var sub = String(verified.sub || '');
  if (!sub) {
    throw new Error('ตรวจสอบ LINE ID token ไม่ผ่าน');
  }
  if (body.line_user_id && String(body.line_user_id) !== sub) {
    throw new Error('line_user_id ไม่ตรงกับ token');
  }
  return sub;
}

function verifyLineIdToken_(idToken) {
  var channelId = requireProp_(PROP.LINE_CHANNEL_ID);
  var resp = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'post',
    payload: {
      id_token: idToken,
      client_id: channelId
    },
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code !== 200) {
    throw new Error('LINE verify failed: ' + text);
  }
  return JSON.parse(text);
}

// --- Members / config helpers ----------------------------------------------

function getSpreadsheet_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }
  var id = PropertiesService.getScriptProperties().getProperty(PROP.SHEET_ID);
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  throw new Error('ไม่พบ Spreadsheet — ผูกสคริปต์กับชีต หรือตั้ง SHEET_ID');
}

function getMembersSheet_() {
  return getSpreadsheet_().getSheetByName(SHEET.MEMBERS);
}

function getTransactionsSheet_() {
  return getSpreadsheet_().getSheetByName(SHEET.TRANSACTIONS);
}

function getConfigSheet_() {
  return getSpreadsheet_().getSheetByName(SHEET.CONFIG);
}

function requireProp_(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) {
    throw new Error('ขาด Script Property: ' + key);
  }
  return v;
}

function getConfigMap_() {
  var sheet = getConfigSheet_();
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0] || '').trim();
    if (!key) continue;
    map[key] = String(data[i][1] || '').trim();
  }
  return map;
}

function getPublicConfig_() {
  var map = getConfigMap_();
  return {
    bank_name: map.bank_name || '',
    account_no: map.account_no || '',
    account_name: map.account_name || ''
  };
}

function getTreasurerEmails_() {
  var map = getConfigMap_();
  return String(map.treasurer_emails || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return !!s; });
}

function findMemberByLineUserId_(lineUserId) {
  var sheet = getMembersSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][3] || '') === lineUserId) {
      return memberFromRow_(data[i], i + 1);
    }
  }
  return null;
}

function findMemberByMemberId_(memberId) {
  var sheet = getMembersSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '') === String(memberId)) {
      return memberFromRow_(data[i], i + 1);
    }
  }
  return null;
}

function memberFromRow_(row, rowNumber) {
  return {
    row: rowNumber,
    member_id: String(row[0] || ''),
    full_name: String(row[1] || ''),
    nickname: String(row[2] || ''),
    line_user_id: String(row[3] || ''),
    line_display_name: String(row[4] || ''),
    bound_at: row[5],
    total_paid: Number(row[6] || 0)
  };
}

function publicMember_(member) {
  return {
    member_id: member.member_id,
    full_name: member.full_name,
    nickname: member.nickname,
    total_paid: Number(member.total_paid || 0)
  };
}

function recomputeMemberTotalPaid_(memberId) {
  var txSheet = getTransactionsSheet_();
  var data = txSheet.getDataRange().getValues();
  var sum = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== String(memberId)) continue;
    if (String(data[i][8]) !== STATUS.APPROVED) continue;
    sum += Number(data[i][5] || 0);
  }

  var mSheet = getMembersSheet_();
  var mData = mSheet.getDataRange().getValues();
  for (var r = 1; r < mData.length; r++) {
    if (String(mData[r][0]) === String(memberId)) {
      mSheet.getRange(r + 1, 7).setValue(sum);
      return;
    }
  }
}

// --- Transactions / Drive / LINE -------------------------------------------

function getSelectedTransactionRow_() {
  var sheet = getTransactionsSheet_();
  var ss = getSpreadsheet_();
  if (ss.getActiveSheet().getName() !== SHEET.TRANSACTIONS) {
    throw new Error('ให้เลือกแถวในชีต Transactions ก่อน');
  }
  var range = sheet.getActiveRange();
  if (!range) {
    throw new Error('ยังไม่ได้เลือกแถว');
  }
  var row = range.getRow();
  if (row < 2) {
    throw new Error('เลือกแถวรายการ (ไม่ใช่หัวตาราง)');
  }
  return row;
}

function readTransactionRow_(row) {
  var sheet = getTransactionsSheet_();
  var values = sheet.getRange(row, 1, row, 13).getValues()[0];
  return {
    row: row,
    transaction_id: String(values[0] || ''),
    member_id: String(values[1] || ''),
    full_name: String(values[2] || ''),
    line_user_id: String(values[3] || ''),
    transfer_datetime: values[4],
    amount: Number(values[5] || 0),
    slip_url: String(values[6] || ''),
    note: String(values[7] || ''),
    status: String(values[8] || ''),
    submitted_at: values[9],
    reject_reason: String(values[10] || ''),
    reviewed_at: values[11],
    reviewed_by: String(values[12] || '')
  };
}

function writeTransactionReview_(row, status, reason, reviewedAt, reviewedBy) {
  var sheet = getTransactionsSheet_();
  sheet.getRange(row, 9).setValue(status);       // I status
  sheet.getRange(row, 11).setValue(reason);      // K reject_reason
  sheet.getRange(row, 12).setValue(reviewedAt);  // L reviewed_at
  sheet.getRange(row, 13).setValue(reviewedBy);  // M reviewed_by
}

function nextTransactionId_() {
  var sheet = getTransactionsSheet_();
  var last = sheet.getLastRow();
  var seq = Math.max(1, last); // header + rows → rough sequence
  var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  var stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  var n = ('000' + seq).slice(-3);
  return 'TXN-' + stamp + '-' + n;
}

function saveSlipToDrive_(memberId, amount, fileBase64, mime) {
  var clean = fileBase64.replace(/^data:[^;]+;base64,/, '');
  var bytes = Utilities.base64Decode(clean);
  var blob = Utilities.newBlob(bytes, mime || 'image/jpeg');
  var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  var name = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss')
    + '_' + memberId + '_' + amount + '.jpg';
  blob.setName(name);

  var folder = DriveApp.getFolderById(requireProp_(PROP.DRIVE_FOLDER_ID));
  var file = folder.createFile(blob);
  ensurePrivateSharedWith_(file, getTreasurerEmails_());
  return file.getUrl();
}

function ensurePrivateSharedWith_(file, emails) {
  try {
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  } catch (err) {
    // some accounts already private
  }
  (emails || []).forEach(function (email) {
    try {
      file.addViewer(email);
    } catch (e2) {
      // skip invalid / already added
    }
  });
}

function pushRejectMessage_(tx, reason) {
  var token = PropertiesService.getScriptProperties().getProperty(PROP.LINE_CHANNEL_ACCESS_TOKEN);
  if (!token) {
    throw new Error('ตั้ง LINE_CHANNEL_ACCESS_TOKEN ก่อนแจ้ง Reject');
  }
  if (!tx.line_user_id) {
    throw new Error('รายการไม่มี line_user_id');
  }

  var text = 'รายการ ' + tx.transaction_id
    + ' ถูกปฏิเสธ\nยอด ' + Number(tx.amount).toFixed(2) + ' บาท'
    + '\nเหตุผล: ' + reason
    + '\nเปิด LIFF เพื่อส่งใหม่หรือดูประวัติ';

  var payload = {
    to: tx.line_user_id,
    messages: [{ type: 'text', text: text }]
  };

  var resp = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) {
    throw new Error('Push LINE ไม่สำเร็จ: ' + resp.getContentText());
  }
}

function formatCellDate_(value) {
  if (value instanceof Date) {
    var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
    return Utilities.formatDate(value, tz, "yyyy-MM-dd'T'HH:mm:ss");
  }
  return value == null ? '' : String(value);
}
