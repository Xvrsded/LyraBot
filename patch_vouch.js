const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/events/interactionCreate.js');
let content = fs.readFileSync(targetPath, 'utf8');

if (!content.includes('const ReviewStats = require')) {
    content = content.replace(
        "const Order = require('../models/Order');",
        "const Order = require('../models/Order');\nconst ReviewStats = require('../models/ReviewStats');"
    );
}

// 1. We want to build the review panel for both robux_deliver and order_deliver.
// A common function at the top of interactionCreate or inline is fine.
// We'll inject a function at the top after imports.
if (!content.includes('function buildReviewPanel')) {
    content = content.replace(
        "const activeClosures = new Set();",
        "const activeClosures = new Set();\n\nfunction buildReviewPanel(orderId) {\n    const row = new ActionRowBuilder().addComponents(\n        new ButtonBuilder().setCustomId(`vouch_star_1_${orderId}`).setLabel('⭐').setStyle(ButtonStyle.Secondary),\n        new ButtonBuilder().setCustomId(`vouch_star_2_${orderId}`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),\n        new ButtonBuilder().setCustomId(`vouch_star_3_${orderId}`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),\n        new ButtonBuilder().setCustomId(`vouch_star_4_${orderId}`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),\n        new ButtonBuilder().setCustomId(`vouch_star_5_${orderId}`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary)\n    );\n    const embed = new EmbedBuilder()\n        .setTitle('⭐ Berikan Penilaian')\n        .setDescription('Bagaimana pengalaman Anda berbelanja di LyraBlox?\\n\\nSilakan berikan rating Anda di bawah ini! 💖')\n        .setColor('#ffd700');\n    return { embeds: [embed], components: [row] };\n}"
    );
}

// 2. Inject sending review panel in robux_deliver block
// Find where it says: await interaction.channel.send('✅ **Pesanan telah selesai diproses.**\n\nTicket ini akan ditutup otomatis dalam 60 detik.');
// We will replace it with sending the ticket message AND the review panel.
const successMsgRegex = /await interaction\.channel\.send\('✅ \*\*Pesanan telah selesai diproses\.\*\*\\n\\nTicket ini akan ditutup otomatis dalam 60 detik\.'\);/g;

content = content.replace(successMsgRegex, `await interaction.channel.send('✅ **Pesanan telah selesai diproses.**\\n\\nTicket ini akan ditutup otomatis dalam 60 detik.');\n                        const reviewPanel = buildReviewPanel(order.orderId);\n                        await interaction.channel.send(reviewPanel);\n                        try { const c = await client.users.fetch(order.userId); if(c) await c.send(reviewPanel).catch(()=>{}); } catch(e) {}`);


// 3. Inject Component Handler for vouch_star_
const vouchStarHandler = `
            if (customId.startsWith('vouch_star_')) {
                const parts = customId.split('_');
                const rating = parseInt(parts[2]);
                const orderId = parts.slice(3).join('_');
                
                const order = await Order.findOne({ orderId });
                if (!order) return interaction.reply({ content: '❌ Pesanan tidak ditemukan.', ephemeral: true });
                if (order.status !== 'success') return interaction.reply({ content: '❌ Anda hanya dapat memberikan ulasan untuk pesanan yang telah sukses.', ephemeral: true });
                if (order.reviewGiven) return interaction.reply({ content: '❌ Anda sudah memberikan ulasan untuk pesanan ini.', ephemeral: true });

                const modal = new ModalBuilder()
                    .setCustomId(\`vouch_modal_\${rating}_\${orderId}\`)
                    .setTitle(\`Ulasan (\${rating} Bintang)\`);
                
                const commentInput = new TextInputBuilder()
                    .setCustomId('review_comment')
                    .setLabel('💬 Ulasan Anda (Opsional)')
                    .setPlaceholder('Bagikan pengalaman Anda bersama LyraBlox...')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(300)
                    .setRequired(false);
                
                modal.addComponents(new ActionRowBuilder().addComponents(commentInput));
                return await interaction.showModal(modal);
            }
`;

if (!content.includes("customId.startsWith('vouch_star_')")) {
    content = content.replace(
        "if (customId.startsWith('robux_deliver_') || customId.startsWith('vilog_deliver_')) {",
        vouchStarHandler + "\n            if (customId.startsWith('robux_deliver_') || customId.startsWith('vilog_deliver_')) {"
    );
}

// 4. Inject Modal Handler for vouch_modal_
const vouchModalHandler = `
            if (customId.startsWith('vouch_modal_')) {
                const parts = customId.split('_');
                const rating = parseInt(parts[2]);
                const orderId = parts.slice(3).join('_');
                
                await interaction.deferReply({ ephemeral: true });

                const order = await Order.findOne({ orderId });
                if (!order || order.status !== 'success' || order.reviewGiven) {
                    return interaction.editReply('❌ Terjadi kesalahan atau Anda sudah pernah memberikan ulasan untuk pesanan ini.');
                }

                let comment = interaction.fields.getTextInputValue('review_comment');
                if (!comment || comment.trim() === '') comment = 'Tidak memberikan komentar.';

                order.reviewGiven = true;
                order.rating = rating;
                order.comment = comment;
                order.reviewDate = new Date();
                await order.save();

                let stats = await ReviewStats.findOne({ id: 'global' });
                if (!stats) {
                    stats = new ReviewStats();
                }
                stats.totalReviews += 1;
                stats.stars[rating] += 1;
                
                // Recalculate average
                let totalScore = 0;
                for (let i = 1; i <= 5; i++) {
                    totalScore += (stats.stars[i] * i);
                }
                stats.averageRating = totalScore / stats.totalReviews;
                
                await stats.save();

                // Send to Vouch Channel
                const VOUCH_CHANNEL_ID = '1534629812629409952';
                const vouchChannel = await interaction.client.channels.fetch(VOUCH_CHANNEL_ID).catch(()=>null);
                
                if (vouchChannel) {
                    const starsStr = '⭐'.repeat(rating);
                    const embed = new EmbedBuilder()
                        .setTitle('⭐ LYRABLOX CUSTOMER REVIEW')
                        .setDescription('━━━━━━━━━━━━━━━━━━━━━━')
                        .addFields(
                            { name: '👤 Customer', value: \`<@\${order.userId}>\`, inline: true },
                            { name: '⭐ Rating', value: starsStr, inline: true },
                            { name: '📦 Produk', value: order.productName, inline: true },
                            { name: '💰 Total Pembelian', value: \`Rp \${order.price.toLocaleString('id-ID')}\`, inline: true },
                            { name: '💬 Ulasan', value: comment, inline: false }
                        )
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .setFooter({ text: 'Terima kasih telah mempercayai LyraBlox ❤️' })
                        .setTimestamp();
                    
                    await vouchChannel.send({ embeds: [embed] }).catch(()=>{});
                }

                // If sent from ticket, try to disable buttons in the review panel message
                if (interaction.message && interaction.message.components) {
                    try {
                        const newRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('x1').setLabel('Review Dikirim!').setStyle(ButtonStyle.Success).setDisabled(true)
                        );
                        await interaction.message.edit({ components: [newRow] });
                    } catch(e) {}
                }

                return interaction.editReply('✅ Terima kasih! Review Anda telah berhasil dikirim.');
            }
`;

if (!content.includes("customId.startsWith('vouch_modal_')")) {
    content = content.replace(
        "if (customId.startsWith('vilog_modal_order:')",
        vouchModalHandler + "\n            if (customId.startsWith('vilog_modal_order:')"
    );
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Patch complete.');
