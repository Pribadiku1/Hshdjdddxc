const { Telegraf } = require("telegraf");
const fs = require('fs');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    downloadContentFromMessage,
    generateWAMessageContent,
    generateWAMessage,
    makeInMemoryStore,
    prepareWAMessageMedia,
    fetchLatestBaileysVersion,
    generateWAMessageFromContent,
    DisconnectReason,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const crypto = require('crypto');
const chalk = require('chalk');
const { tokenBot, ownerID } = require("./zepsettings/zepconfig");
const moment = require('moment-timezone');

const question = (query) => new Promise((resolve) => {
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
    });
});

async function getGitHubData(path) {
    const octokit = await loadOctokit();
    try {
        const response = await octokit.repos.getContent({
            owner,
            repo,
            path,
        });
        const content = Buffer.from(response.data.content, 'base64').toString();
        return { data: JSON.parse(content), sha: response.data.sha };
    } catch (error) {
        console.error("Error fetching :", error);
        return { data: null, sha: null };
    }
}

async function updateGitHubData(path, content, sha) {
    const octokit = await loadOctokit();
    try {
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message: `Update`,
            content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
            sha,
        });
        console.log(`updated successfully.`);
    } catch (error) {
        console.error("Error updating data on GitHub:", error);
    }
}

const fsaluran = { key : {
remoteJid: '0@s.whatsapp.net',
participant : '0@s.whatsapp.net'
},
message: {
newsletterAdminInviteMessage: {
newsletterJid: '120363210705976689@newsletter',
    newsletterName: '',
    caption: 'Zephyrine'
}}}

// ========================= [ BOT INITIALIZATION ] =========================

const bot = new Telegraf(tokenBot);
let zep = null;
let isWhatsAppConnected = false;
let linkedWhatsAppNumber = '';
const usePairingCode = true;

// ========================= [ UTILITY FUNCTIONS ] =========================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


// ========================= [ PREMIUM USER MANAGEMENT ] =========================

const premiumFile = './データベース/premiumvip.json';

const loadPremiumUsers = () => {
    try {
        const data = fs.readFileSync(premiumFile);
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
};

const savePremiumUsers = (users) => {
    fs.writeFileSync(premiumFile, JSON.stringify(users, null, 2));
};

const addPremiumUser = (userId, duration) => {
    const premiumUsers = loadPremiumUsers();
    const expiryDate = moment().add(duration, 'days').tz('Asia/Jakarta').format('DD-MM-YYYY');
    premiumUsers[userId] = expiryDate;
    savePremiumUsers(premiumUsers);
    return expiryDate;
};

const removePremiumUser = (userId) => {
    const premiumUsers = loadPremiumUsers();
    delete premiumUsers[userId];
    savePremiumUsers(premiumUsers);
};

const isPremiumUser = (userId) => {
    const premiumUsers = loadPremiumUsers();
    if (premiumUsers[userId]) {
        const expiryDate = moment(premiumUsers[userId], 'DD-MM-YYYY');
        if (moment().isBefore(expiryDate)) {
            return true;
        } else {
            removePremiumUser(userId);
            return false;
        }
    }
    return false;
};

// ========================= [ BAILEYS CONNECTION ] =========================

const startSesi = async () => {
    const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const connectionOptions = {
        version,
        keepAliveIntervalMs: 30000,
        printQRInTerminal: !usePairingCode,
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ['Mac OS', 'Safari', '10.15.7'],
        getMessage: async (key) => ({
            conversation: 'Succes Connected',
        }),
    };

    zep = makeWASocket(connectionOptions);
    
    zep.ev.on("messages.upsert", async (m) => {
        try {
            if (!m || !m.messages || !m.messages[0]) {
                console.log("⚠️ Tidak ada pesan masuk.");
                return;
            }

            const msg = m.messages[0]; 
            const chatId = msg.key.remoteJid || "Tidak Diketahui";

            console.log(`ID SALURAN : ${chatId}`);
        } catch (error) {
            console.error("❌ Error membaca pesan:", error);
        }
    });
    
    if (usePairingCode && !zep.authState.creds.registered) {
        console.clear();
        let phoneNumber = await question(chalk.bold.white(`\nINPUT YOUR NUMBER SENDER !\n`));
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        const code = await zep.requestPairingCode(phoneNumber.trim());
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(chalk.bold.white(`YOUR CODE `), chalk.bold.white(formattedCode));
    }

    zep.ev.on('creds.update', saveCreds);
    store.bind(zep.ev);
    
    global.idch = "120363405397839812@newsletter"

    zep.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
        zep.newsletterFollow(global.idch)  
            console.clear();
            isWhatsAppConnected = true;
            const currentTime = moment().tz('Asia/Jakarta').format('HH:mm:ss');
            console.log(chalk.bold.white(`
Script: VOID STORM INC
Versi: 12.0
Status: `) + chalk.bold.green('Terhubung') + chalk.bold.white(`
Developer: Zephyrine
Telegram: @cursezep
Waktu: ${currentTime} WIB`));
        }

                 if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(
                chalk.red('Koneksi WhatsApp terputus.'),
                shouldReconnect ? 'Mencoba untuk menghubungkan ulang...' : 'Silakan login ulang.'
            );
            if (shouldReconnect) {
                startSesi();
            }
            isWhatsAppConnected = false;
        }
    });
};

startSesi();


// ========================= [ GROUP MANAGEMENT FUNCTIONS ] =========================

const groupFile = './データベース/group_list.json';

const loadGroups = () => {
    try {
        const data = fs.readFileSync(groupFile);
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

const saveGroups = (groups) => {
    fs.writeFileSync(groupFile, JSON.stringify(groups, null, 2));
};

const addGroup = (groupId) => {
    const groups = loadGroups();
    if (!groups.includes(groupId)) {
        groups.push(groupId);
        saveGroups(groups);
        return true;
    }
    return false;
};

const removeGroup = (groupId) => {
    const groups = loadGroups();
    const index = groups.indexOf(groupId);
    if (index > -1) {
        groups.splice(index, 1);
        saveGroups(groups);
        return true;
    }
    return false;
};

const isGroupRegistered = (groupId) => {
    return loadGroups().includes(groupId);
};

// ========================= [ MIDDLEWARE ] =========================

const checkWhatsAppConnection = (ctx, next) => {
    if (!isWhatsAppConnected) {
        ctx.reply("Nomor sender tidak di temukan atau tidak terhubung");
        return;
    }
    next();
};

const checkPremium = (ctx, next) => {
    if (!isPremiumUser(ctx.from.id)) {
        ctx.reply("❌ Maaf, fitur ini hanya untuk pengguna premium.");
        return;
    }
    next();
};

// ========================= [ TOKEN MANAGEMENT COMMANDS (Only for Developers) ] =========================

// ========================= [ GROUP MANAGEMENT COMMANDS ] =========================

// /addgrup → hanya owner, otomatis ambil chat.id
bot.command('addgrup', (ctx) => {
    if (ctx.from.id != ownerID) {
        return ctx.reply("❌ Maaf, hanya owner yang bisa menggunakan perintah ini.");
    }
    if (!ctx.chat || !ctx.chat.type.endsWith('group')) {
        return ctx.reply("❌ Perintah ini hanya bisa digunakan di dalam grup.");
    }
    const groupId = String(ctx.chat.id);
    if (addGroup(groupId)) {
        ctx.reply(`✅ Grup ini berhasil ditambahkan ke daftar.\n🆔 ID: ${groupId}`);
    } else {
        ctx.reply(`⚠️ Grup ini sudah terdaftar.\n🆔 ID: ${groupId}`);
    }
});

// /delgrup → hanya owner, otomatis ambil chat.id
bot.command('delgrup', (ctx) => {
    if (ctx.from.id != ownerID) {
        return ctx.reply("❌ Maaf, hanya owner yang bisa menggunakan perintah ini.");
    }
    if (!ctx.chat || !ctx.chat.type.endsWith('group')) {
        return ctx.reply("❌ Perintah ini hanya bisa digunakan di dalam grup.");
    }
    const groupId = String(ctx.chat.id);
    if (removeGroup(groupId)) {
        ctx.reply(`✅ Grup ini berhasil dihapus dari daftar.\n🆔 ID: ${groupId}`);
    } else {
        ctx.reply(`⚠️ Grup ini tidak ada di daftar.`);
    }
});

// /listgrup → hanya owner
bot.command('listgrup', (ctx) => {
    if (ctx.from.id != ownerID) {
        return ctx.reply("❌ Maaf, hanya owner yang bisa menggunakan perintah ini.");
    }
    const groups = loadGroups();
    if (groups.length === 0) {
        return ctx.reply("📭 Tidak ada grup yang terdaftar.");
    }
    let message = "<b>📋 Daftar Grup Terdaftar:</b>\n";
    groups.forEach((g, i) => {
        message += `${i + 1}. ${g}\n`;
    });
    ctx.reply(message, { parse_mode: 'HTML' });
});
// Middleware cek grup terdaftar
const checkGroupRegistered = (ctx, next) => {
    if (ctx.chat && ctx.chat.type.endsWith('group')) {
        if (!isGroupRegistered(String(ctx.chat.id))) {
            ctx.reply("❌ Grup ini belum terdaftar di bot.");
            return;
        }
    } else {
        ctx.reply("❌ Perintah ini hanya bisa digunakan di dalam grup.");
        return;
    }
    next();
};

// Command /akses
bot.command('akses', checkGroupRegistered, (ctx) => {
    ctx.reply(
        `<b>🔑 AKSES TEAM</b>\n\nGunakan PIN berikut untuk login:\n<code>TeamYanz8</code>`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🌐 Buka Akses", url: "https://akses.mazyanz.top" }]
                ]
            }
        }
    );
});

//