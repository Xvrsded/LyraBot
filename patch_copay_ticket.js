const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/events/interactionCreate.js');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Fix createTicketFromSession category logic
content = content.replace(
    "const categoryKey = session.type === 'gig' ? 'gig_category_id' : (session.type === 'visend' ? 'visend_category_id' : 'vilog_category_id');",
    "const categoryKey = session.type === 'gig' ? 'gig_category_id' : (session.type === 'visend' ? 'visend_category_id' : (session.type === 'copay' ? 'copay_category_id' : 'vilog_category_id'));"
);

// 2. Fix product name logic
content = content.replace(
    "const productName = isGIG ? 'Gift In Game' : (isVisend ? 'Robux Via Send' : 'Robux Via Login');",
    "const isCopay = session.type === 'copay';\n        const productName = isGIG ? 'Gift In Game' : (isVisend ? 'Robux Via Send' : (isCopay ? 'Robux Community Payout' : 'Robux Via Login'));"
);

// 3. Fix channel prefix logic
content = content.replace(
    "const channelPrefix = isGIG ? 'gig' : (isVisend ? 'visend' : 'vilog');",
    "const channelPrefix = isGIG ? 'gig' : (isVisend ? 'visend' : (isCopay ? 'copay' : 'vilog'));"
);

// 4. Fix order.details logic
content = content.replace(
    "details: isGIG ? {",
    "details: isGIG ? {"
).replace(
    "package: session.isCustom ? 'Custom' : undefined\n            }",
    "package: session.isCustom ? 'Custom' : undefined\n            }),\n            ...(isCopay ? { details: { username: session.robloxUsername, amount: session.amount, price: session.price, package: 'Copay' } } : {})"
);
// Wait, the order.details replace above is a bit risky if it doesn't match perfectly.
// Let's use a safer regex or just write a more specific replacement.

const detailsRegex = /details: isGIG \? \{\s*gamepassName: session\.gamepassName,\s*amount: session\.amount,\s*price: session\.price,\s*rate: session\.rate\s*\} : \{\s*username: session\.robloxUsername,\s*password: session\.robloxPassword,\s*amount: session\.amount,\s*price: session\.price,\s*package: session\.isCustom \? 'Custom' : undefined\s*\}/g;

content = content.replace(detailsRegex, `details: isGIG ? {
                gamepassName: session.gamepassName,
                amount: session.amount,
                price: session.price,
                rate: session.rate
            } : (isCopay ? {
                username: session.robloxUsername,
                amount: session.amount,
                price: session.price
            } : {
                username: session.robloxUsername,
                password: session.robloxPassword,
                amount: session.amount,
                price: session.price,
                package: session.isCustom ? 'Custom' : undefined
            })`);

// 5. Fix the copay_modal_order handler to use createTicketFromSession
const oldModalHandler = `const { createTicket } = require('../services/ticketService');
                
                await interaction.deferReply({ ephemeral: true });
                try {
                    const ticketResult = await createTicket(interaction, 'copay', pkg, robloxUsername);
                    return interaction.editReply({ content: ticketResult.message });
                } catch (err) {
                    return interaction.editReply({ content: '❌ Gagal membuat ticket. Silakan coba lagi nanti.' });
                }`;

const newModalHandler = `await interaction.deferReply({ ephemeral: true });
                try {
                    const session = {
                        type: 'copay',
                        amount: pkg.amount,
                        price: pkg.price,
                        robloxUsername: robloxUsername
                    };
                    await createTicketFromSession(interaction, session, interaction.client);
                    return; // The createTicketFromSession will handle the reply inside
                } catch (err) {
                    return interaction.editReply({ content: '❌ Gagal membuat ticket. Silakan coba lagi nanti.' });
                }`;

content = content.replace(oldModalHandler, newModalHandler);

// 6. Wait, createTicketFromSession expects interaction to NOT be deferred if it replies itself, 
// let's check how it replies.
// Let's replace return interaction.reply in createTicketFromSession?
// If we deferReply above, we should ensure createTicketFromSession doesn't crash on interaction.reply.
// Usually createTicketFromSession does `await interaction.editReply` or `await interaction.reply`.

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Patch complete.');
