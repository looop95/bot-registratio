const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  Events
} = require('discord.js');
 
const fs   = require('fs');
const path = require('path');
 
// ═══════════════════════════════════════════════════════
//  CLIENT
// ═══════════════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});
 
// ═══════════════════════════════════════════════════════
//  🔑 IDs — حافظنا على نفس IDs ديالك
// ═══════════════════════════════════════════════════════
const ROLES = {
  "1AC":       "1490962093602508821",
  "2AC":       "1490963569385148456",
  "3AC":       "1491147446691172437",
  "REGISTERED":"1490974754113589258"
};
 
const CHANNELS = {
  "1AC": "1491166257930698904",
  "2AC": "1491365145602162738",
  "3AC": "1491365224677376002"
};
 
// ID قناة الإعلانات وقناة اللوج — غيّرهم لخادمك
const ANNOUNCE_CHANNEL_ID = "1490447800582934629";
const LOG_CHANNEL_ID      = "1490494233746997419";
 
// ═══════════════════════════════════════════════════════
//  💾 قاعدة بيانات محلية (JSON)
// ═══════════════════════════════════════════════════════
const DB_FILE = './db.json';
 
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      points:     {},   // { userId: { points, level, name } }
      attendance: {},   // { "YYYY-MM-DD": { userId: true } }
      homework:   {},   // { hwId: { title, deadline, submissions: {userId: text} } }
      quizzes:    {},   // { quizId: { question, answers, correct, results: {userId: score} } }
      scheduled:  []    // [ { time, channelId, message } ]
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
 
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
 
// ═══════════════════════════════════════════════════════
//  🏅 نظام النقاط
// ═══════════════════════════════════════════════════════
function addPoints(db, userId, username, pts, reason) {
  if (!db.points[userId]) db.points[userId] = { points: 0, name: username, badges: [] };
  db.points[userId].points += pts;
  db.points[userId].name    = username;
 
  // شارات تلقائية
  const total = db.points[userId].points;
  const badges = db.points[userId].badges || [];
  if (total >= 50  && !badges.includes('🥉')) { badges.push('🥉'); }
  if (total >= 150 && !badges.includes('🥈')) { badges.push('🥈'); }
  if (total >= 300 && !badges.includes('🥇')) { badges.push('🥇'); }
  if (total >= 500 && !badges.includes('💎')) { badges.push('💎'); }
  db.points[userId].badges = badges;
  return db;
}
 
function getTop10(db) {
  return Object.entries(db.points)
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);
}
 
// ═══════════════════════════════════════════════════════
//  🛠️ مساعد Embed
// ═══════════════════════════════════════════════════════
function baseEmbed(title, color = '#5865F2') {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: '🎓 أكاديمية التعليم الرقمي' });
}
 
async function sendLog(guild, message) {
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setDescription(`\`${new Date().toLocaleString('ar-MA')}\` — ${message}`)
    .setColor('#2b2d31');
  await ch.send({ embeds: [embed] }).catch(() => {});
}
 
// ═══════════════════════════════════════════════════════
//  ✅ READY
// ═══════════════════════════════════════════════════════
client.once('ready', () => {
  console.log(`✅ Bot ready: ${client.user.tag}`);
  scheduleChecker(); // تشغيل فحص الإعلانات المجدولة
});
 
// ═══════════════════════════════════════════════════════
//  📩 MESSAGES
// ═══════════════════════════════════════════════════════
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();
  const args    = content.split(/\s+/);
  const cmd     = args[0].toLowerCase();
 
  // ─────────────────────────────────────────
  //  !levels — لوحة التسجيل
  // ─────────────────────────────────────────
  if (cmd === 'levels') {
    const embed = baseEmbed('🎓 التسجيل في المستويات')
      .setDescription(
        '**اختر مستواك الدراسي للوصول إلى قنواتك** 👇\n\n' +
        '> 🔵 **1AC** — السنة الأولى إعدادي\n' +
        '> 🟢 **2AC** — السنة الثانية إعدادي\n' +
        '> ⚫ **3AC** — السنة الثالثة إعدادي\n\n' +
        '⚠️ الاختيار **نهائي** ولا يمكن تغييره'
      )
      .setThumbnail(message.guild.iconURL());
 
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('level_1AC').setLabel('1AC').setEmoji('🔵').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('level_2AC').setLabel('2AC').setEmoji('🟢').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('level_3AC').setLabel('3AC').setEmoji('⚫').setStyle(ButtonStyle.Secondary)
    );
    await message.channel.send({ embeds: [embed], components: [row] });
  }
 
  // ─────────────────────────────────────────
  //  present — تسجيل الحضور
  // ─────────────────────────────────────────
  else if (cmd === 'present') {
    const db     = loadDB();
    const today  = new Date().toISOString().slice(0, 10);
    const userId = message.author.id;
 
    if (!db.attendance[today]) db.attendance[today] = {};
 
    if (db.attendance[today][userId]) {
      const embed = baseEmbed('✅ الحضور مسجّل', '#FEE75C')
        .setDescription(`${message.author}, سبق وسجّلت حضورك اليوم ✅`);
      return message.reply({ embeds: [embed] });
    }
 
    db.attendance[today][userId] = { name: message.author.username, time: new Date().toLocaleTimeString('ar-MA') };
    addPoints(db, userId, message.author.username, 10, 'حضور');
    saveDB(db);
 
    const total  = db.points[userId]?.points || 0;
    const badges = (db.points[userId]?.badges || []).join(' ') || '—';
 
    const embed = baseEmbed('✅ تم تسجيل حضورك', '#57F287')
      .setDescription(`أهلاً **${message.author.username}**، حضورك اليوم مسجّل 🎉`)
      .addFields(
        { name: '📅 التاريخ', value: today, inline: true },
        { name: '🏅 نقاطك الإجمالية', value: `**${total}** نقطة`, inline: true },
        { name: '🎖️ شاراتك', value: badges, inline: true }
      )
      .setThumbnail(message.author.displayAvatarURL());
    await message.reply({ embeds: [embed] });
    await sendLog(message.guild, `📋 ${message.author.username} سجّل حضوره`);
  }
 
  // ─────────────────────────────────────────
  //  !classement — ترتيب النقاط
  // ─────────────────────────────────────────
  else if (cmd === '!classement') {
    const db  = loadDB();
    const top = getTop10(db);
 
    if (top.length === 0) {
      return message.reply({ embeds: [baseEmbed('📊 لا توجد نقاط بعد', '#FEE75C').setDescription('لم يسجّل أحد نقاطاً بعد.')] });
    }
 
    const medals = ['🥇','🥈','🥉'];
    const desc   = top.map((u, i) => {
      const medal  = medals[i] || `**${i + 1}.**`;
      const badges = (u.badges || []).join('') || '';
      return `${medal} **${u.name}** ${badges} — \`${u.points} نقطة\``;
    }).join('\n');
 
    const embed = baseEmbed('🏆 ترتيب الطلاب', '#FFD700')
      .setDescription(desc)
      .setThumbnail('https://cdn.discordapp.com/emojis/trophy.png')
      .addFields({ name: '🔥 المشاركون', value: `${top.length} طالب`, inline: true });
 
    await message.channel.send({ embeds: [embed] });
  }
 
  // ─────────────────────────────────────────
  //  !points — نقاطي
  // ─────────────────────────────────────────
  else if (cmd === '!points') {
    const db   = loadDB();
    const data = db.points[message.author.id];
 
    if (!data) {
      return message.reply({ embeds: [baseEmbed('🏅 نقاطك', '#FEE75C').setDescription('ليس لديك نقاط بعد. سجّل حضورك وشارك في الدروس!')] });
    }
 
    const rank   = getTop10(db).findIndex(u => u.id === message.author.id) + 1;
    const badges = (data.badges || []).join(' ') || 'لا توجد شارات بعد';
    const level  = data.points >= 300 ? '💎 متميز' : data.points >= 150 ? '🥇 متقدم' : data.points >= 50 ? '🥈 جيد' : '🥉 مبتدئ';
 
    const embed = baseEmbed(`🏅 نقاط ${message.author.username}`, '#5865F2')
      .setThumbnail(message.author.displayAvatarURL())
      .addFields(
        { name: '⭐ النقاط', value: `**${data.points}**`, inline: true },
        { name: '📊 المستوى', value: level, inline: true },
        { name: '🏅 الترتيب', value: rank ? `#${rank}` : 'خارج Top 10', inline: true },
        { name: '🎖️ الشارات', value: badges, inline: false }
      );
    await message.reply({ embeds: [embed] });
  }
 
  // ─────────────────────────────────────────
  //  !واجب — نشر واجب (أستاذ فقط)
  // ─────────────────────────────────────────
  else if (cmd === '!واجب') {
    if (!isTeacher(message.member)) return message.reply('❌ هذا الأمر للأستاذ فقط.');
    // مثال: !واجب | عنوان الواجب | تاريخ التسليم
    const parts = content.split('|').map(s => s.trim());
    if (parts.length < 3) {
      return message.reply({ embeds: [
        baseEmbed('📝 صيغة الأمر', '#FEE75C')
          .setDescription('**الصيغة الصحيحة:**\n```\n!واجب | عنوان الواجب | YYYY-MM-DD\n```\n**مثال:**\n```\n!واجب | تمارين المعادلات | 2025-02-01\n```')
      ]});
    }
 
    const [, title, deadline] = parts;
    const db    = loadDB();
    const hwId  = `hw_${Date.now()}`;
    db.homework[hwId] = { title, deadline, createdBy: message.author.username, submissions: {}, createdAt: new Date().toISOString() };
    saveDB(db);
 
    const embed = baseEmbed(`📝 واجب جديد — ${title}`, '#FEE75C')
      .setDescription('**ارسل إجابتك كرد على هذه الرسالة** ⬇️')
      .addFields(
        { name: '📅 موعد التسليم', value: `\`${deadline}\``, inline: true },
        { name: '👨‍🏫 الأستاذ', value: message.author.username, inline: true },
        { name: '🆔 رقم الواجب', value: `\`${hwId}\``, inline: true }
      );
 
    const hwMsg = await message.channel.send({ embeds: [embed] });
    const thread = await hwMsg.startThread({ name: `💡 إجابات: ${title}`, autoArchiveDuration: 10080 });
    await thread.send({ embeds: [
      baseEmbed('📬 ارفع إجابتك هنا', '#57F287')
        .setDescription(`اكتب إجابتك في هذا الـ Thread\nاستخدم الأمر:\n\`\`\`\n!إجابة ${hwId} | إجابتك هنا\n\`\`\``)
    ]});
 
    await sendLog(message.guild, `📝 واجب جديد: **${title}** | الموعد: ${deadline}`);
  }
 
  // ─────────────────────────────────────────
  //  !إجابة — تسليم واجب
  // ─────────────────────────────────────────
  else if (cmd === '!إجابة') {
    const parts = content.split('|').map(s => s.trim());
    if (parts.length < 3) {
      return message.reply('❌ الصيغة: `!إجابة hwId | نص الإجابة`');
    }
    const [, hwId, answer] = parts;
    const db = loadDB();
 
    if (!db.homework[hwId]) return message.reply('❌ رقم الواجب غير صحيح.');
 
    const already = db.homework[hwId].submissions[message.author.id];
    if (already) return message.reply({ embeds: [
      baseEmbed('⚠️ سبق وأرسلت إجابتك', '#FEE75C')
        .setDescription('يمكنك تحديث إجابتك بإرسال الأمر مرة أخرى.')
    ]});
 
    db.homework[hwId].submissions[message.author.id] = { name: message.author.username, answer, submittedAt: new Date().toISOString() };
    addPoints(db, message.author.id, message.author.username, 5, 'تسليم واجب');
    saveDB(db);
 
    const embed = baseEmbed('✅ تم تسليم إجابتك', '#57F287')
      .addFields(
        { name: '📝 الواجب', value: db.homework[hwId].title, inline: true },
        { name: '⏰ وقت التسليم', value: new Date().toLocaleString('ar-MA'), inline: true },
        { name: '🏅 نقاط مكتسبة', value: '+5 نقاط 🎉', inline: true }
      );
    await message.reply({ embeds: [embed] });
  }
 
  // ─────────────────────────────────────────
  //  !سجل-الواجب — كشف من سلّم ومن لا
  // ─────────────────────────────────────────
  else if (cmd === '!سجل-الواجب') {
    if (!isTeacher(message.member)) return message.reply('❌ للأستاذ فقط.');
    const hwId = args[1];
    const db   = loadDB();
    const hw   = db.homework[hwId];
    if (!hw) return message.reply('❌ رقم الواجب غير موجود.');
 
    const subs   = Object.values(hw.submissions);
    const names  = subs.map((s, i) => `${i+1}. **${s.name}** — ${s.submittedAt.slice(0,10)}`).join('\n') || 'لا توجد إجابات بعد';
 
    const embed = baseEmbed(`📋 سجل الواجب — ${hw.title}`, '#5865F2')
      .addFields(
        { name: `✅ سلّموا (${subs.length})`, value: names, inline: false },
        { name: '📅 موعد التسليم', value: hw.deadline, inline: true }
      );
    await message.channel.send({ embeds: [embed] });
  }
 
  // ─────────────────────────────────────────
  //  !quiz — اختبار (أستاذ فقط)
  //  صيغة: !quiz | السؤال | خيار1 | خيار2 | خيار3 | خيار4 | رقم_الصحيح(1-4)
  // ─────────────────────────────────────────
  else if (cmd === '!quiz') {
    if (!isTeacher(message.member)) return message.reply('❌ للأستاذ فقط.');
    const parts = content.split('|').map(s => s.trim());
    if (parts.length < 7) {
      return message.reply({ embeds: [
        baseEmbed('🧪 صيغة الاختبار', '#FEE75C')
          .setDescription('```\n!quiz | السؤال | خيار1 | خيار2 | خيار3 | خيار4 | رقم_الصحيح\n```\n**مثال:**\n```\n!quiz | كم يساوي 2+2؟ | 3 | 4 | 5 | 6 | 2\n```')
      ]});
    }
 
    const [, question, a1, a2, a3, a4, correctStr] = parts;
    const correct  = parseInt(correctStr);
    const quizId   = `quiz_${Date.now()}`;
    const db       = loadDB();
    db.quizzes[quizId] = { question, answers: [a1,a2,a3,a4], correct, results: {}, createdAt: new Date().toISOString() };
    saveDB(db);
 
    const labels   = ['A','B','C','D'];
    const styles   = [ButtonStyle.Primary, ButtonStyle.Success, ButtonStyle.Secondary, ButtonStyle.Danger];
    const options  = [a1,a2,a3,a4];
 
    const embed = baseEmbed('🧪 اختبار سريع!', '#EB459E')
      .setDescription(`**${question}**\n\nاضغط على الإجابة الصحيحة 👇`)
      .addFields(
        { name: '🅰️ A', value: a1, inline: true },
        { name: '🅱️ B', value: a2, inline: true },
        { name: '🇨 C', value: a3, inline: true },
        { name: '🇩 D', value: a4, inline: true }
      )
      .setFooter({ text: `🆔 ${quizId} • 🎓 أكاديمية التعليم الرقمي` });
 
    const row = new ActionRowBuilder().addComponents(
      ...options.map((opt, i) =>
        new ButtonBuilder()
          .setCustomId(`quiz_${quizId}_${i+1}`)
          .setLabel(labels[i])
          .setStyle(styles[i])
      )
    );
    await message.channel.send({ embeds: [embed], components: [row] });
    await sendLog(message.guild, `🧪 اختبار جديد: **${question}**`);
  }
 
  // ─────────────────────────────────────────
  //  !schedule — جدولة إعلان
  //  !schedule | HH:MM | نص الرسالة
  // ─────────────────────────────────────────
  else if (cmd === '!schedule') {
    if (!isTeacher(message.member)) return message.reply('❌ للأستاذ فقط.');
    const parts = content.split('|').map(s => s.trim());
    if (parts.length < 3) {
      return message.reply({ embeds: [
        baseEmbed('📅 صيغة الجدولة', '#FEE75C')
          .setDescription('```\n!schedule | HH:MM | نص الرسالة\n```\n**مثال:**\n```\n!schedule | 18:00 | 📚 الحصة اليوم الساعة 18:00 — لا تتأخر!\n```')
      ]});
    }
 
    const [, time, msg] = parts;
    const db = loadDB();
    db.scheduled.push({ time, channelId: message.channel.id, message: msg, createdBy: message.author.username });
    saveDB(db);
 
    const embed = baseEmbed('📅 تم جدولة الإعلان', '#57F287')
      .addFields(
        { name: '⏰ الوقت', value: `\`${time}\``, inline: true },
        { name: '📢 القناة', value: `<#${message.channel.id}>`, inline: true },
        { name: '💬 الرسالة', value: msg, inline: false }
      );
    await message.reply({ embeds: [embed] });
    await sendLog(message.guild, `📅 إعلان مجدول: **${msg}** عند ${time}`);
  }
 
  // ─────────────────────────────────────────
  //  !حضور-اليوم — كشف الحضور (أستاذ)
  // ─────────────────────────────────────────
  else if (cmd === '!حضور-اليوم') {
    if (!isTeacher(message.member)) return message.reply('❌ للأستاذ فقط.');
    const db    = loadDB();
    const today = new Date().toISOString().slice(0, 10);
    const list  = db.attendance[today] ? Object.values(db.attendance[today]) : [];
 
    const names = list.map((s, i) => `${i+1}. **${s.name}** — \`${s.time}\``).join('\n') || 'لا أحد سجّل حضوره اليوم بعد.';
 
    const embed = baseEmbed(`📋 كشف الحضور — ${today}`, '#5865F2')
      .addFields({ name: `✅ الحاضرون (${list.length})`, value: names, inline: false });
    await message.channel.send({ embeds: [embed] });
  }
 
  // ─────────────────────────────────────────
  //  !مساعدة
  // ─────────────────────────────────────────
  else if (cmd === '!مساعدة') {
    const teacher = isTeacher(message.member);
    const embed   = baseEmbed('📖 قائمة الأوامر', '#5865F2')
      .setDescription('جميع الأوامر المتاحة في الأكاديمية');
 
    embed.addFields({
      name: '👨‍🎓 أوامر الطلاب',
      value: [
        '`present` — تسجيل الحضور اليومي (+10 نقاط)',
        '`!points` — عرض نقاطك وشاراتك',
        '`!classement` — ترتيب أفضل 10 طلاب',
        '`!إجابة hwId | نصك` — تسليم واجب (+5 نقاط)',
        '`!مساعدة` — هذه القائمة',
      ].join('\n'),
      inline: false
    });
 
    if (teacher) {
      embed.addFields({
        name: '👨‍🏫 أوامر الأستاذ',
        value: [
          '`levels` — إرسال لوحة التسجيل',
          '`!واجب | عنوان | تاريخ` — نشر واجب',
          '`!سجل-الواجب hwId` — كشف التسليمات',
          '`!quiz | سؤال | أ | ب | ج | د | رقم` — اختبار',
          '`!schedule | HH:MM | رسالة` — جدولة إعلان',
          '`!حضور-اليوم` — كشف الحضور',
        ].join('\n'),
        inline: false
      });
    }
    await message.reply({ embeds: [embed] });
  }
});
 
// ═══════════════════════════════════════════════════════
//  🎯 INTERACTIONS (Buttons)
// ═══════════════════════════════════════════════════════
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  const member = interaction.member;
  const id     = interaction.customId;
 
  // ─────────────────────────────────────────
  //  أزرار التسجيل في المستوى
  // ─────────────────────────────────────────
  if (id.startsWith('level_')) {
    if (member.roles.cache.has(ROLES.REGISTERED)) {
      return interaction.reply({ content: '❌ لقد اخترت مستواك مسبقاً ولا يمكن التغيير.', flags: 64 });
    }
 
    const level = id.replace('level_', ''); // 1AC | 2AC | 3AC
    if (!ROLES[level]) return;
 
    if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: '❌ البوت ما عندوش صلاحية Manage Roles', flags: 64 });
    }
 
    try {
      await member.roles.add(ROLES[level]);
      await member.roles.add(ROLES.REGISTERED);
 
      const channel = interaction.guild.channels.cache.get(CHANNELS[level]);
      const db      = loadDB();
      addPoints(db, member.id, member.user.username, 10, 'تسجيل');
      saveDB(db);
 
      const embed = baseEmbed(`✅ تم تسجيلك في ${level}`, '#57F287')
        .setDescription(`مرحباً **${member.user.username}**! تم تفعيل حسابك 🎉`)
        .addFields(
          { name: '🎓 مستواك', value: level, inline: true },
          { name: '📚 قناتك', value: channel ? `<#${channel.id}>` : 'تحقق من القنوات', inline: true },
          { name: '🏅 نقاط البداية', value: '+10 نقاط 🎉', inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL());
 
      await interaction.reply({ embeds: [embed], flags: 64 });
      await sendLog(interaction.guild, `👋 ${member.user.username} سجّل في **${level}**`);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ وقع خطأ، تأكد من الصلاحيات و IDs', flags: 64 });
    }
  }
 
  // ─────────────────────────────────────────
  //  أزرار الاختبار: quiz_quizId_choiceNum
  // ─────────────────────────────────────────
  else if (id.startsWith('quiz_')) {
    const parts   = id.split('_');        // ['quiz', timestamp, choice]
    const choice  = parseInt(parts[parts.length - 1]);
    const quizId  = parts.slice(0, -1).join('_').replace(/^quiz_/, 'quiz_');
 
    const db   = loadDB();
    // إعادة بناء quizId الصحيح
    const realQuizId = Object.keys(db.quizzes).find(k => id.startsWith(`quiz_${k.replace('quiz_','')}_`));
    if (!realQuizId) return interaction.reply({ content: '❌ الاختبار غير موجود.', flags: 64 });
 
    const quiz = db.quizzes[realQuizId];
    if (quiz.results[member.id]) {
      return interaction.reply({ content: '❌ لقد أجبت على هذا السؤال مسبقاً.', flags: 64 });
    }
 
    const correct   = quiz.correct;
    const isCorrect = choice === correct;
    const labels    = ['A','B','C','D'];
 
    quiz.results[member.id] = { name: member.user.username, choice, correct: isCorrect };
    if (isCorrect) addPoints(db, member.id, member.user.username, 20, 'إجابة صحيحة');
    saveDB(db);
 
    const embed = isCorrect
      ? baseEmbed('✅ إجابة صحيحة!', '#57F287')
          .setDescription(`🎉 أحسنت **${member.user.username}**! الجواب الصحيح هو **${labels[correct-1]}: ${quiz.answers[correct-1]}**`)
          .addFields({ name: '🏅 نقاط مكتسبة', value: '+20 نقطة 🔥', inline: true })
      : baseEmbed('❌ إجابة خاطئة', '#ED4245')
          .setDescription(`للأسف، الجواب الصحيح كان **${labels[correct-1]}: ${quiz.answers[correct-1]}**`)
          .addFields({ name: '💪 لا تستسلم!', value: 'راجع الدرس وحاول مرة أخرى في الاختبار القادم', inline: false });
 
    await interaction.reply({ embeds: [embed], flags: 64 });
  }
});
 
// ═══════════════════════════════════════════════════════
//  📅 فحص الإعلانات المجدولة (كل دقيقة)
// ═══════════════════════════════════════════════════════
function scheduleChecker() {
  setInterval(async () => {
    const db      = loadDB();
    const now     = new Date();
    const timeNow = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const toKeep  = [];
 
    for (const item of db.scheduled) {
      if (item.time === timeNow) {
        const ch = client.channels.cache.get(item.channelId);
        if (ch) {
          const embed = baseEmbed('📢 إعلان مجدول', '#5865F2')
            .setDescription(item.message)
            .addFields({ name: '⏰ الوقت', value: timeNow, inline: true });
          await ch.send({ embeds: [embed] }).catch(() => {});
        }
      } else {
        toKeep.push(item);
      }
    }
 
    db.scheduled = toKeep;
    saveDB(db);
  }, 60_000); // كل دقيقة
}
 
// ─────────────────────────────────────────
//  🛡️ هل هو أستاذ؟ (أول دور أو ادمن)
// ─────────────────────────────────────────
function isTeacher(member) {
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
         member.permissions.has(PermissionsBitField.Flags.Administrator);
}
 
// ═══════════════════════════════════════════════════════
//  🔐 LOGIN
// ═══════════════════════════════════════════════════════
client.login(process.env.DISCORD_TOKEN);
