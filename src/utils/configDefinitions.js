const { ChannelType } = require('discord.js');

module.exports = {
    general: {
        title: '⚙️ General Settings',
        description: 'Konfigurasi umum bot seperti bahasa respon dan prefix untuk text commands.',
        emoji: '⚙️',
        fields: {
            prefix: {
                name: 'Prefix Bot',
                path: 'general.prefix',
                type: 'string',
                description: 'Karakter pembuka untuk menjalankan commands berbasis teks.',
                placeholder: 'Contoh: !, ?, $',
                default: '!',
                validation: (val) => {
                    if (!val || val.length > 5) return 'Prefix harus berukuran antara 1 hingga 5 karakter.';
                    return true;
                }
            },
            language: {
                name: 'Bahasa Bot',
                path: 'general.language',
                type: 'select',
                description: 'Bahasa respon untuk pesan bot.',
                default: 'id',
                choices: [
                    { label: 'Bahasa Indonesia (ID)', value: 'id', emoji: '🇮🇩' },
                    { label: 'English (EN)', value: 'en', emoji: '🇺🇸' }
                ],
                validation: (val) => {
                    const allowed = ['id', 'en'];
                    if (!allowed.includes(val)) return 'Bahasa hanya boleh bernilai "id" atau "en".';
                    return true;
                }
            }
        }
    },
    channels: {
        title: '📢 Channel Configuration',
        description: 'Tentukan channel untuk berbagai sistem log, welcome, ticket, dan announcement.',
        emoji: '📢',
        fields: {
            welcome: {
                name: 'Channel Welcome',
                path: 'channels.welcome',
                type: 'channel',
                description: 'Channel tempat pesan penyambutan member baru dikirim.',
                channelTypes: [ChannelType.GuildText],
                default: null
            },
            goodbye: {
                name: 'Channel Goodbye',
                path: 'channels.goodbye',
                type: 'channel',
                description: 'Channel tempat pesan perpisahan member keluar dikirim.',
                channelTypes: [ChannelType.GuildText],
                default: null
            },
            logs: {
                name: 'Channel Logs',
                path: 'channels.logs',
                type: 'channel',
                description: 'Channel untuk mencatat aktivitas log mod/moderasi.',
                channelTypes: [ChannelType.GuildText],
                default: null
            },
            tickets: {
                name: 'Channel Tiket',
                path: 'channels.tickets',
                type: 'channel',
                description: 'Channel kategori default untuk pembuatan tiket bantuan.',
                channelTypes: [ChannelType.GuildText, ChannelType.GuildCategory],
                default: null
            },
            announcements: {
                name: 'Channel Pengumuman',
                path: 'channels.announcements',
                type: 'channel',
                description: 'Channel untuk menyiarkan pengumuman server.',
                channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
                default: null
            }
        }
    },
    roles: {
        title: '👥 Role Configuration',
        description: 'Tentukan role jajaran staff admin, moderator, member, dan role mute.',
        emoji: '👥',
        fields: {
            admin: {
                name: 'Role Admin',
                path: 'roles.admin',
                type: 'role',
                description: 'Role yang memiliki otoritas administrasi tinggi.',
                default: null
            },
            moderator: {
                name: 'Role Moderator',
                path: 'roles.moderator',
                type: 'role',
                description: 'Role penegak keamanan dan moderator server.',
                default: null
            },
            staff: {
                name: 'Role Staff',
                path: 'roles.staff',
                type: 'role',
                description: 'Role pembantu umum / staff server.',
                default: null
            },
            member: {
                name: 'Role Member',
                path: 'roles.member',
                type: 'role',
                description: 'Role bawaan untuk seluruh member terverifikasi.',
                default: null
            },
            muted: {
                name: 'Role Muted',
                path: 'roles.muted',
                type: 'role',
                description: 'Role hukuman bagi member yang dibisukan.',
                default: null
            }
        }
    },
    welcome: {
        title: '🎉 Welcome System',
        description: 'Atur sistem penyambutan member otomatis.',
        emoji: '🎉',
        fields: {
            enabled: {
                name: 'Sistem Welcome',
                path: 'welcome.enabled',
                type: 'boolean',
                description: 'Mengaktifkan atau menonaktifkan pesan selamat datang otomatis.',
                default: false
            },
            embed: {
                name: 'Pesan Tipe Embed',
                path: 'welcome.embed',
                type: 'boolean',
                description: 'Kirim pesan dalam bentuk Embed modern jika diaktifkan, teks biasa jika mati.',
                default: true
            },
            message: {
                name: 'Pesan Welcome',
                path: 'welcome.message',
                type: 'string',
                description: 'Teks pesan penyambutan. Gunakan {user} untuk mention, {server} untuk nama server.',
                placeholder: 'Masukkan template pesan welcome...',
                default: '🎉 **Welcome to our community, {user}!**',
                validation: (val) => {
                    if (!val || val.length > 1000) return 'Pesan tidak boleh kosong atau lebih dari 1000 karakter.';
                    return true;
                }
            },
            autoRole: {
                name: 'Auto Role',
                path: 'welcome.autoRole',
                type: 'role',
                description: 'Role yang otomatis diberikan saat member bergabung.',
                default: null
            },
            verificationMode: {
                name: 'Mode Verifikasi',
                path: 'welcome.verificationMode',
                type: 'select',
                description: 'Metode verifikasi bagi anggota baru sebelum onboarding selesai.',
                default: 'None',
                choices: [
                    { label: 'Tanpa Verifikasi (None)', value: 'None', emoji: '🟢' },
                    { label: 'Verifikasi Tombol (Button)', value: 'Button', emoji: '✅' },
                    { label: 'Verifikasi Captcha (Captcha)', value: 'Captcha', emoji: '🧩' }
                ]
            },
            restoreRoles: {
                name: 'Pulihkan Role Rejoin',
                path: 'welcome.restoreRoles',
                type: 'boolean',
                description: 'Pulihkan role yang sebelumnya dimiliki ketika mereka bergabung kembali.',
                default: false
            }
        }
    },
    logs: {
        title: '📜 Logging System',
        description: 'Log aktivitas server secara detail untuk keperluan pengawasan moderasi.',
        emoji: '📜',
        fields: {
            enabled: {
                name: 'Sistem Logging',
                path: 'logs.enabled',
                type: 'boolean',
                description: 'Aktifkan pencatatan log otomatis di channel logs.',
                default: false
            },
            messageDelete: {
                name: 'Log Pesan Dihapus',
                path: 'logs.messageDelete',
                type: 'boolean',
                description: 'Catat aktivitas ketika ada pesan member yang dihapus.',
                default: true
            },
            messageUpdate: {
                name: 'Log Pesan Diubah',
                path: 'logs.messageUpdate',
                type: 'boolean',
                description: 'Catat aktivitas ketika ada pesan member yang disunting.',
                default: true
            },
            memberJoin: {
                name: 'Log Member Masuk',
                path: 'logs.memberJoin',
                type: 'boolean',
                description: 'Catat aktivitas ketika ada member baru bergabung.',
                default: true
            },
            memberLeave: {
                name: 'Log Member Keluar',
                path: 'logs.memberLeave',
                type: 'boolean',
                description: 'Catat aktivitas ketika ada member yang meninggalkan server.',
                default: true
            },
            voiceStateUpdate: {
                name: 'Log Voice Chat',
                path: 'logs.voiceStateUpdate',
                type: 'boolean',
                description: 'Catat aktivitas ketika ada member berpindah/masuk voice channel.',
                default: true
            }
        }
    },
    moderation: {
        title: '🛡️ Moderation System',
        description: 'Pengaturan batas hukuman (warn threshold) dan aksi otomatis.',
        emoji: '🛡️',
        fields: {
            enabled: {
                name: 'Sistem Moderasi',
                path: 'moderation.enabled',
                type: 'boolean',
                description: 'Mengaktifkan filter kata/perilaku dan hukuman otomatis.',
                default: false
            },
            warnThreshold: {
                name: 'Batas Peringatan',
                path: 'moderation.warnThreshold',
                type: 'number',
                description: 'Jumlah peringatan maksimal sebelum member dikenai tindakan hukuman otomatis.',
                placeholder: 'Masukkan angka (misal: 3)',
                default: 3,
                validation: (val) => {
                    const num = Number(val);
                    if (isNaN(num) || num < 1 || num > 10) return 'Batas peringatan harus berupa angka antara 1 dan 10.';
                    return true;
                }
            },
            actionOnThreshold: {
                name: 'Aksi Hukuman',
                path: 'moderation.actionOnThreshold',
                type: 'select',
                description: 'Tindakan otomatis saat batas peringatan terlampaui.',
                default: 'mute',
                choices: [
                    { label: 'Bisu (Mute)', value: 'mute', emoji: '🔇' },
                    { label: 'Keluarkan (Kick)', value: 'kick', emoji: '🚪' },
                    { label: 'Blokir (Ban)', value: 'ban', emoji: '🔨' }
                ],
                validation: (val) => {
                    const allowed = ['mute', 'kick', 'ban'];
                    if (!allowed.includes(val)) return 'Aksi harus berupa: mute, kick, atau ban.';
                    return true;
                }
            }
        }
    },
    owo: {
        title: '⚔️ OwO Assistant',
        description: 'Konfigurasi pembantu bot OwO (log harian, captcha autofill/verify).',
        emoji: '⚔️',
        fields: {
            enabled: {
                name: 'Sistem OwO',
                path: 'owo.enabled',
                type: 'boolean',
                description: 'Mengaktifkan pencatatan log harian/grinding OwO.',
                default: false
            },
            owoLogChannel: {
                name: 'Channel Log OwO',
                path: 'owo.owoLogChannel',
                type: 'channel',
                description: 'Channel tujuan untuk mengirim laporan grinding OwO.',
                channelTypes: [ChannelType.GuildText],
                default: null
            },
            autoVerify: {
                name: 'Auto Verification Alert',
                path: 'owo.autoVerify',
                type: 'boolean',
                description: 'Beri notifikasi peringatan tag jika bot mendeteksi captcha OwO.',
                default: false
            }
        }
    },
    economy: {
        title: '💰 Economy System',
        description: 'Pengaturan sistem ekonomi bot (nama mata uang, klaim koin harian).',
        emoji: '💰',
        fields: {
            enabled: {
                name: 'Sistem Ekonomi',
                path: 'economy.enabled',
                type: 'boolean',
                description: 'Aktifkan fitur koin dan ekonomi lokal server.',
                default: false
            },
            currencyName: {
                name: 'Nama Mata Uang',
                path: 'economy.currencyName',
                type: 'string',
                description: 'Nama mata uang virtual server Anda.',
                placeholder: 'Contoh: Ruby, Point, Coin',
                default: 'Coin',
                validation: (val) => {
                    if (!val || val.length > 20) return 'Nama mata uang tidak boleh kosong atau lebih dari 20 karakter.';
                    return true;
                }
            },
            dailyAmount: {
                name: 'Koin Harian',
                path: 'economy.dailyAmount',
                type: 'number',
                description: 'Jumlah koin yang didapatkan member setiap 24 jam.',
                placeholder: 'Contoh: 100, 500',
                default: 100,
                validation: (val) => {
                    const num = Number(val);
                    if (isNaN(num) || num < 1 || num > 100000) return 'Jumlah harian harus berupa angka positif maksimal 100,000.';
                    return true;
                }
            }
        }
    },
    level: {
        title: '⭐ Leveling System',
        description: 'Sistem xp dan level otomatis berdasarkan keaktifan chat member.',
        emoji: '⭐',
        fields: {
            enabled: {
                name: 'Sistem Leveling',
                path: 'level.enabled',
                type: 'boolean',
                description: 'Aktifkan perolehan XP chat dan kenaikan level.',
                default: false
            },
            xpRate: {
                name: 'XP Multiplier',
                path: 'level.xpRate',
                type: 'number',
                description: 'Faktor pengali XP yang diperoleh per pesan chat.',
                placeholder: 'Contoh: 1 (normal), 1.5, 2 (double)',
                default: 1,
                validation: (val) => {
                    const num = Number(val);
                    if (isNaN(num) || num < 0.1 || num > 5) return 'Faktor pengali harus berupa angka desimal antara 0.1 dan 5.';
                    return true;
                }
            },
            levelUpChannel: {
                name: 'Channel Level Up',
                path: 'level.levelUpChannel',
                type: 'channel',
                description: 'Kirim notifikasi kenaikan level ke channel tertentu. Kosongkan untuk dikirim di tempat chat saat itu.',
                channelTypes: [ChannelType.GuildText],
                default: null
            },
            levelUpMessage: {
                name: 'Pesan Level Up',
                path: 'level.levelUpMessage',
                type: 'string',
                description: 'Teks notifikasi kenaikan level. Gunakan {user} dan {level} sebagai variabel.',
                placeholder: 'Masukkan pesan level up...',
                default: '🌟 **Selamat {user}, kamu naik ke level {level}!** 🌟',
                validation: (val) => {
                    if (!val || val.length > 500) return 'Pesan tidak boleh kosong atau melebihi 500 karakter.';
                    return true;
                }
            }
        }
    },
    quests: {
        title: '🎯 Quest System',
        description: 'Quest harian/mingguan server untuk meramaikan komunitas.',
        emoji: '🎯',
        fields: {
            enabled: {
                name: 'Sistem Quest',
                path: 'quests.enabled',
                type: 'boolean',
                description: 'Aktifkan penerbitan misi/quest bagi member.',
                default: false
            },
            questChannel: {
                name: 'Channel Quest',
                path: 'quests.questChannel',
                type: 'channel',
                description: 'Channel penayangan quest aktif.',
                channelTypes: [ChannelType.GuildText],
                default: null
            }
        }
    },
    events: {
        title: '🏆 Event Logging',
        description: 'Log khusus penayangan jadwal event dan hadiah event server.',
        emoji: '🏆',
        fields: {
            enabled: {
                name: 'Sistem Event',
                path: 'events.enabled',
                type: 'boolean',
                description: 'Aktifkan logging/notifikasi jadwal event.',
                default: false
            },
            eventLogChannel: {
                name: 'Channel Log Event',
                path: 'events.eventLogChannel',
                type: 'channel',
                description: 'Channel penayangan notifikasi detail event.',
                channelTypes: [ChannelType.GuildText],
                default: null
            }
        }
    }
};
