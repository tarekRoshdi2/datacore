import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const accountsFile = path.join(__dirname, 'telegram_accounts.json');
const settingsFile = path.join(__dirname, 'telegram_settings.json');
const foldersDir = path.join(__dirname, 'scraped_folders');
const tasksFile = path.join(__dirname, 'telegram_tasks.json');

if (!fs.existsSync(foldersDir)) {
    fs.mkdirSync(foldersDir);
}

// Default API keys (from Telegram Desktop)
let API_ID = 2040; 
let API_HASH = 'b18441a1ff607e10a989891a5462e627'; 

function loadSettings() {
    if (fs.existsSync(settingsFile)) {
        try {
            const settings = JSON.parse(fs.readFileSync(settingsFile));
            if (settings.api_id) API_ID = parseInt(settings.api_id);
            if (settings.api_hash) API_HASH = settings.api_hash;
        } catch (e) {
            console.error("Error reading settings", e);
        }
    }
}
loadSettings();

export function updateSettings(api_id, api_hash) {
    API_ID = parseInt(api_id);
    API_HASH = api_hash;
    fs.writeFileSync(settingsFile, JSON.stringify({ api_id: API_ID, api_hash: API_HASH }));
}

export function getSettings() {
    return { api_id: API_ID, api_hash: API_HASH };
}

let clients = {}; 
let pendingRequests = {}; 

function loadAccounts() {
    if (!fs.existsSync(accountsFile)) {
        return [];
    }
    try {
        return JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveAccounts(accounts) {
    fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2));
}

export async function initClients() {
    const accounts = loadAccounts();
    for (const acc of accounts) {
        try {
            const session = new StringSession(acc.sessionString);
            const { api_id, api_hash } = getSettings();
            const client = new TelegramClient(new StringSession(acc.sessionString), api_id, api_hash, {
                connectionRetries: 5,
            });
            await client.connect();
            clients[acc.phone] = client;
            console.log(`[Telegram] Client initialized for ${acc.phone}`);
        } catch (e) {
            console.error(`[Telegram] Failed to initialize client for ${acc.phone}`, e.message);
        }
    }
}

export async function sendCode(phone) {
    const stringSession = new StringSession(""); 
    const { api_id, api_hash } = getSettings();
    const client = new TelegramClient(stringSession, api_id, api_hash, {
        connectionRetries: 5,
    });
    
    await client.connect();
    
    try {
        const result = await client.sendCode(
            { apiId: API_ID, apiHash: API_HASH },
            phone
        );
        pendingRequests[phone] = { client, phoneCodeHash: result.phoneCodeHash };
        return { success: true, phoneCodeHash: result.phoneCodeHash };
    } catch (error) {
        console.error("sendCode error", error);
        return { success: false, error: error.message };
    }
}

export async function verifyCode(phone, code) {
    const pending = pendingRequests[phone];
    if (!pending) return { success: false, error: "لا يوجد طلب تسجيل دخول قيد الانتظار لهذا الرقم." };
    
    try {
        await pending.client.invoke(new Api.auth.SignIn({
            phoneNumber: phone,
            phoneCodeHash: pending.phoneCodeHash,
            phoneCode: code
        }));
        
        const sessionString = pending.client.session.save();
        
        const accounts = loadAccounts();
        const existing = accounts.find(a => a.phone === phone);
        if (existing) {
            existing.sessionString = sessionString;
        } else {
            accounts.push({ 
                phone, 
                sessionString, 
                status: 'active',
                stats: { addedToday: 0, failedToday: 0, floodWaitUntil: null }
            });
        }
        saveAccounts(accounts);
        
        clients[phone] = pending.client;
        delete pendingRequests[phone];
        
        return { success: true };
    } catch (error) {
        console.error("verifyCode error", error);
        return { success: false, error: error.message };
    }
}

export function getAccounts() {
    const accounts = loadAccounts();
    return accounts.map(a => ({ 
        phone: a.phone, 
        status: clients[a.phone] ? 'متصل' : 'غير متصل',
        stats: a.stats || { addedToday: 0, failedToday: 0, floodWaitUntil: null }
    }));
}

export async function removeAccount(phone) {
    let accounts = loadAccounts();
    accounts = accounts.filter(a => a.phone !== phone);
    saveAccounts(accounts);
    if (clients[phone]) {
        await clients[phone].disconnect();
        delete clients[phone];
    }
    return { success: true };
}

export async function scrapeGroup(phone, groupUrl, metadata) {
    const client = clients[phone];
    if (!client) return { success: false, error: "الحساب غير متصل." };

    try {
        let entity;
        if (groupUrl.includes('t.me/joinchat/')) {
            const hash = groupUrl.split('joinchat/')[1];
            const invite = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
            entity = invite.chat;
        } else {
            const username = groupUrl.split('/').pop();
            entity = await client.getEntity(username);
        }

        // Check if members are hidden before trying to scrape
        if (entity.className === 'Channel') {
            const full = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }));
            if (full.fullChat && full.fullChat.participantsHidden) {
                return { success: false, error: "لا يمكن سحب الأعضاء: قام أدمن الجروب بتفعيل ميزة (إخفاء الأعضاء) لحماية خصوصيتهم." };
            }
        }

        const participants = await client.getParticipants(entity, { limit: 10000 }); 
        
        const extracted = participants.map(p => ({
            id: p.id ? p.id.toString() : "",
            username: p.username || "",
            firstName: p.firstName || "",
            lastName: p.lastName || "",
            phone: p.phone || "",
            accessHash: p.accessHash ? p.accessHash.toString() : ""
        })).filter(p => p.username || p.phone); // only keep useful users

        const groupName = entity.title || entity.username || "Group";
        const keyword = metadata && metadata.keyword ? metadata.keyword : 'سحب_مباشر';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Sanitize folder ID for valid filename
        const safeKeyword = keyword.replace(/[\/\\?%*:|"<>]/g, '_');
        const safeGroupName = groupName.replace(/[\/\\?%*:|"<>]/g, '_');
        const folderId = `${safeKeyword}_${safeGroupName}_${timestamp}`;
        
        const folderData = {
            id: folderId,
            keyword,
            channelName: groupName,
            url: groupUrl,
            date: new Date().toISOString(),
            members: extracted
        };
        
        fs.writeFileSync(path.join(foldersDir, `${folderId}.json`), JSON.stringify(folderData, null, 2));

        return { success: true, members: extracted, groupName, folderId };
    } catch (error) {
        console.error("scrapeGroup error", error);
        return { success: false, error: error.message };
    }
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

export let additionTasks = {};

export function loadTasks() {
    try {
        if (fs.existsSync(tasksFile)) {
            const data = fs.readFileSync(tasksFile, 'utf8');
            additionTasks = JSON.parse(data);
            // Any tasks that were 'running' when the server crashed should be marked as 'paused' so they can be resumed manually.
            for (const taskId in additionTasks) {
                if (additionTasks[taskId].status === 'running') {
                    additionTasks[taskId].status = 'paused';
                    additionTasks[taskId].logs.unshift(`[System] تم إيقاف المهمة تلقائياً بسبب إعادة تشغيل السيرفر.`);
                }
            }
            saveTasks();
        }
    } catch (e) {
        console.error("Error loading tasks", e);
    }
}

export function saveTasks() {
    try {
        fs.writeFileSync(tasksFile, JSON.stringify(additionTasks, null, 2));
    } catch (e) {
        console.error("Error saving tasks", e);
    }
}

// Load tasks on startup
loadTasks();

export function getTaskStatus(taskId) {
    return additionTasks[taskId] || null;
}

export function getActiveTask() {
    // Find the most recent task that is either running or paused
    const taskIds = Object.keys(additionTasks).sort((a, b) => b.localeCompare(a)); // Descending sort
    
    const activeTaskId = taskIds.find(id => ['running', 'paused'].includes(additionTasks[id].status));
    if (activeTaskId) {
        return { id: activeTaskId, ...additionTasks[activeTaskId] };
    }
    return null;
}

export function getAllTasks() {
    return Object.keys(additionTasks).map(id => ({
        id,
        ...additionTasks[id]
    })).sort((a, b) => b.startTime - a.startTime); // Descending sort
}

export async function startAddMembersTask(targetGroupUrl, members, delaySeconds) {
    const activePhones = Object.keys(clients);
    if (activePhones.length === 0) return { success: false, error: "لا يوجد حسابات متصلة." };

    const taskId = 'task_' + Date.now();
    additionTasks[taskId] = {
        status: 'running',
        targetGroupUrl,
        delaySeconds,
        total: members.length,
        added: 0,
        failed: 0,
        remaining: members.length,
        remainingMembersList: [...members], // store remaining for persistence
        processedMembers: [], // store detailed reports
        logs: [],
        startTime: Date.now()
    };
    saveTasks();

    _runAdditionLoop(taskId);
    return { success: true, taskId };
}

export function pauseTask(taskId) {
    if (additionTasks[taskId] && additionTasks[taskId].status === 'running') {
        additionTasks[taskId].status = 'paused';
        const time = new Date().toLocaleTimeString('ar-EG', { hour12: false });
        additionTasks[taskId].logs.unshift(`[${time}] ⏸️ تم إيقاف العملية مؤقتاً.`);
        saveTasks();
        return true;
    }
    return false;
}

export function resumeTask(taskId) {
    if (additionTasks[taskId] && additionTasks[taskId].status === 'paused') {
        additionTasks[taskId].status = 'running';
        const time = new Date().toLocaleTimeString('ar-EG', { hour12: false });
        additionTasks[taskId].logs.unshift(`[${time}] ▶️ تم استكمال العملية.`);
        saveTasks();
        _runAdditionLoop(taskId);
        return true;
    }
    return false;
}

export function cancelTask(taskId) {
    if (additionTasks[taskId] && ['running', 'paused'].includes(additionTasks[taskId].status)) {
        additionTasks[taskId].status = 'cancelled';
        const time = new Date().toLocaleTimeString('ar-EG', { hour12: false });
        additionTasks[taskId].logs.unshift(`[${time}] ⏹️ تم إلغاء العملية بالكامل.`);
        saveTasks();
        return true;
    }
    return false;
}

async function _joinAndGetTargetEntities(targetGroupUrl) {
    const activePhones = Object.keys(clients);
    if (activePhones.length === 0) return null;

    let targetEntities = {};
    for (const phone of activePhones) {
         try {
             let entity;
             if (targetGroupUrl.includes('joinchat/')) {
                 const hash = targetGroupUrl.split('joinchat/')[1];
                 const invite = await clients[phone].invoke(new Api.messages.CheckChatInvite({ hash }));
                 await clients[phone].invoke(new Api.messages.ImportChatInvite({ hash }));
                 entity = invite.chat;
             } else if (targetGroupUrl.includes('t.me/+')) {
                 const hash = targetGroupUrl.split('t.me/+')[1];
                 const invite = await clients[phone].invoke(new Api.messages.CheckChatInvite({ hash }));
                 await clients[phone].invoke(new Api.messages.ImportChatInvite({ hash }));
                 entity = invite.chat;
             } else {
                 const username = targetGroupUrl.split('/').pop();
                 await clients[phone].invoke(new Api.channels.JoinChannel({ channel: username }));
                 entity = await clients[phone].getEntity(username);
             }
             targetEntities[phone] = entity;
         } catch(e) {
             console.log(`Failed to join target group with ${phone}:`, e.message);
         }
    }

    return Object.keys(targetEntities).length > 0 ? targetEntities : null;
}

async function _runAdditionLoop(taskId) {
    const task = additionTasks[taskId];
    if (!task) return;

    const addLog = (msg) => {
        const time = new Date().toLocaleTimeString('ar-EG', { hour12: false });
        task.logs.unshift(`[${time}] ${msg}`);
        if (task.logs.length > 50) task.logs.pop(); // keep last 50
    };

    addLog(`بدء الاتصال بالجروب الهدف...`);
    const targetEntities = await _joinAndGetTargetEntities(task.targetGroupUrl);
    
    if (!targetEntities) {
         task.status = 'error';
         addLog(`خطأ: تعذر العثور على الجروب الهدف. تأكد من صحة الرابط.`);
         saveTasks();
         return;
    }

    addLog(`تم الانضمام للجروب الهدف. بدء إضافة الأعضاء...`);
    saveTasks();
    
    while (task.remainingMembersList.length > 0 && task.status === 'running') {
        const accountsList = loadAccounts();
        const activePhones = Object.keys(clients).filter(phone => {
            const acc = accountsList.find(a => a.phone === phone);
            if (!acc || !acc.stats || !acc.stats.floodWaitUntil) return true;
            return acc.stats.floodWaitUntil < Date.now();
        });

        if (activePhones.length === 0) {
            task.status = 'error';
            addLog(`خطأ: لا يوجد حسابات صالحة للعمل (جميعها إما غير متصلة أو محظورة مؤقتاً).`);
            saveTasks();
            return;
        }

        const batch = task.remainingMembersList.splice(0, activePhones.length);
        
        const promises = batch.map((member, index) => {
            const phone = activePhones[index];
            const client = clients[phone];
            return (async () => {
                try {
                    let userEntity;
                    let displayId = member.username ? `@${member.username}` : member.id;
                    if (member.firstName) displayId += ` (${member.firstName})`;
                    if (member.username) {
                        userEntity = member.username; 
                    } else if (member.id && member.accessHash) {
                        userEntity = new Api.InputUser({
                            userId: BigInt(member.id),
                            accessHash: BigInt(member.accessHash)
                        });
                    } else {
                        return { success: false, displayId, error: 'بيانات ناقصة' };
                    }

                    if (!targetEntities[phone]) {
                        return { success: false, displayId, error: 'هذا الحساب لم يتمكن من الانضمام للجروب الهدف' };
                    }

                    await client.invoke(new Api.channels.InviteToChannel({
                        channel: targetEntities[phone],
                        users: [userEntity]
                    }));
                    return { success: true, displayId, member };
                } catch (error) {
                    return { success: false, displayId: member.username ? `@${member.username}` : member.id, error: error.message, member };
                }
            })();
        });

        const results = await Promise.all(promises);
        
        let accountsListToUpdate = loadAccounts();
        results.forEach((res, index) => {
            const phone = activePhones[index];
            const acc = accountsListToUpdate.find(a => a.phone === phone);
            if (acc && !acc.stats) acc.stats = { addedToday: 0, failedToday: 0, floodWaitUntil: null };

            if (res.success) {
                task.added++;
                if (acc) acc.stats.addedToday++;
                task.processedMembers.push({ ...res.member, status: 'تمت الإضافة', error: null, date: new Date().toISOString() });
                addLog(`✅ تم إضافة ${res.displayId} بنجاح`);
            } else {
                task.failed++;
                if (acc) {
                    acc.stats.failedToday++;
                    if (res.error && res.error.includes('A wait of')) {
                        const match = res.error.match(/A wait of (\d+) seconds/);
                        if (match && match[1]) {
                            const seconds = parseInt(match[1]);
                            acc.stats.floodWaitUntil = Date.now() + (seconds * 1000);
                            addLog(`🚫 تم استبعاد الحساب ${phone} تلقائياً لأنه تلقى حظراً لمدة ${seconds} ثانية.`);
                        }
                    }
                }
                task.processedMembers.push({ ...res.member, status: 'فشل', error: res.error, date: new Date().toISOString() });
                addLog(`❌ فشل إضافة ${res.displayId} (${res.error})`);
            }
        });
        saveAccounts(accountsListToUpdate);

        task.remaining = task.remainingMembersList.length;
        saveTasks();

        if (task.remainingMembersList.length > 0 && task.status === 'running') {
            await delay(task.delaySeconds * 1000);
        }
    }

    if (task.status === 'running' && task.remainingMembersList.length === 0) {
        task.status = 'completed';
        addLog(`🎉 اكتملت العملية بنجاح!`);
        saveTasks();
    }
}

export async function searchGroups(phone, query) {
    const client = clients[phone];
    if (!client) return { success: false, error: "الحساب غير متصل." };

    try {
        // Split query by English and Arabic commas
        const keywords = query.split(/[,،]/).map(k => k.trim()).filter(k => k.length > 0);
        // If they didn't use commas but used spaces, we could optionally split by spaces, but let's stick to commas.
        let allGroups = new Map();

        for (const kw of keywords) {
            try {
                const result = await client.invoke(new Api.contacts.Search({
                    q: kw,
                    limit: 30
                }));

                for (const chat of result.chats) {
                    // Include channels but mark them as broadcast so UI can disable scraping
                    const groupId = chat.id.toString();
                    if (!allGroups.has(groupId)) {
                        allGroups.set(groupId, {
                            id: groupId,
                            title: chat.title || "بدون اسم",
                            username: chat.username ? `https://t.me/${chat.username}` : "",
                            participantsCount: chat.participantsCount || 0,
                            isMegagroup: chat.megagroup,
                            isBroadcast: chat.broadcast
                        });
                    }
                }
            } catch (e) {
                console.error(`Error searching for ${kw}:`, e);
            }
            // Small delay to avoid flooding API
            await new Promise(r => setTimeout(r, 300));
        }

        let groups = Array.from(allGroups.values());

        // Sort by participants descending
        groups.sort((a, b) => b.participantsCount - a.participantsCount);

        return { success: true, groups };
    } catch (error) {
        console.error("searchGroups error", error);
        return { success: false, error: error.message };
    }
}

export function getFolders() {
    if (!fs.existsSync(foldersDir)) return [];
    const files = fs.readdirSync(foldersDir).filter(f => f.endsWith('.json'));
    const folders = [];
    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(foldersDir, file)));
            folders.push({
                id: data.id,
                keyword: data.keyword,
                channelName: data.channelName,
                url: data.url,
                date: data.date,
                membersCount: data.members ? data.members.length : 0
            });
        } catch (e) {
            console.error('Error reading folder', file);
        }
    }
    folders.sort((a, b) => new Date(b.date) - new Date(a.date));
    return folders;
}

export function getFolderData(id) {
    const filePath = path.join(foldersDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath));
        } catch (e) {
            return null;
        }
    }
    return null;
}
