const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});


// 🔑 عدّل IDs ديالك هنا
const ROLES = {
  "1AC": "1490962093602508821",
  "2AC": "1490963569385148456",
  "3AC": "1491147446691172437",
  "REGISTERED": "1490974754113589258"
};

const CHANNELS = {
  "1AC": "CHANNEL_ID_1AC",
  "2AC": "CHANNEL_ID_2AC",
  "3AC": "CHANNEL_ID_3AC"
};


// 🎯 عند تشغيل البوت
client.once('ready', () => {
  console.log(`✅ Bot ready: ${client.user.tag}`);
});


// 📩 أمر !levels
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === 'levels') {

    const embed = new EmbedBuilder()
      .setTitle('🎓 التسجيل في المستويات')
      .setDescription('اختار مستواك (مرة واحدة فقط) 👇')
      .setColor('#5865F2');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('level_1AC')
        .setLabel('1AC')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('level_2AC')
        .setLabel('2AC')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId('level_3AC')
        .setLabel('3AC')
        .setStyle(ButtonStyle.Secondary)
    );

    await message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
});


// 🎯 الأزرار
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const member = interaction.member;

  // ❌ إذا سجل مسبقاً
  if (member.roles.cache.has(ROLES.REGISTERED)) {
    return interaction.reply({
      content: '❌ لقد اخترت مستواك مسبقاً',
      flags: 64
    });
  }

  let level = null;

  if (interaction.customId === 'level_1AC') level = "1AC";
  if (interaction.customId === 'level_2AC') level = "2AC";
  if (interaction.customId === 'level_3AC') level = "3AC";

  if (!level) return;

  // 🛡️ تحقق من الصلاحيات ديال البوت
  if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return interaction.reply({
      content: '❌ البوت ما عندوش صلاحية Manage Roles',
      flags: 64
    });
  }

  try {
    // 🎓 إعطاء Role ديال المستوى
    await member.roles.add(ROLES[level]);

    // 🔒 Role التسجيل
    await member.roles.add(ROLES.REGISTERED);

    // 📍 القناة
    const channel = interaction.guild.channels.cache.get(CHANNELS[level]);

    await interaction.reply({
      content: `✅ تم تسجيلك في ${level}\n📚 توجه إلى: ${channel}`,
      flags: 64
    });

  } catch (err) {
    console.error(err);

    await interaction.reply({
      content: '❌ وقع خطأ، تأكد من الصلاحيات و IDs',
      flags: 64
    });
  }
});


// 🔐 تسجيل الدخول (حط التوكن ديالك هنا)
client.login(process.env.DISCORD_TOKEN);
   