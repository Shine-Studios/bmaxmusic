const { Client, Util, MessageEmbed } = require("discord.js");
const YouTube = require("simple-youtube-api");
const ytdl = require("ytdl-core");

const bot = new Client({
    disableMentions: "all"
});

const PREFIX = process.env.PREFIX;
const youtube = new YouTube(process.env.YTAPI_KEY);
const queue = new Map();

bot.on("ready", () => console.log(`Bot ${bot.user.tag} iniciado correctamente!`));
bot.on("warn", console.warn);
bot.on("error", console.error);
bot.on("shardDisconnect", (event, id) => console.log(`La Id ${id} ha sido desconectada (${event.code}) ${event}, intenta reconectarlos...`));
bot.on("shardReconnecting", (id) => console.log(`Reconectando la id ${id}`));

bot.on("message", async (message) => { // eslint-disable-line
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.split(" ");
    const searchString = args.slice(1).join(" ");
    const url = args[1] ? args[1].replace(/<(.+)>/g, "$1") : "";
    const serverQueue = queue.get(message.guild.id);

    let command = message.content.toLowerCase().split(" ")[0];
    command = command.slice(PREFIX.length);

    if (command === "ayuda" || command === "comandos") {
        const helpembed = new MessageEmbed()
            .setColor("BLUE")
            .setAuthor(bot.user.tag, bot.user.displayAvatarURL())
            .setDescription(`
:notes: __**Command list**__
> \`play\` > **\`play [title/url]\`**
> \`buscar\` > **\`buscar [title]\`**
> \`saltear\`, \`parar\`,  \`pausa\`, \`resumir\`
> \`rpa\`, \`lista\`, \`volumen\`, \`loop\``)
            .setFooter("Creado Por bMax Team!");
        message.channel.send(helpembed);
    }
    if (command === "play" || command === "p") {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.channel.send({embed: {color: "RED", description: "Lo siento, pero debes estar en un canal de voz para reproducir musica!"}});
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has("CONNECT")) {
            return message.channel.send({embed: {color: "RED", description: "Lo siento, pero necesito el permiso **`CONNECT`** para reproducir la cancion!"}});
        }
        if (!permissions.has("SPEAK")) {
            return message.channel.send({embed: {color: "RED", description: "Lo siento, pero necesito el permiso **`SPEAK`** para reproducir la cancion!"}});
        }
        if (!url || !searchString) return message.channel.send({embed: {color: "RED", description: "Por favor pon el link o el titulo de la cancion que quieras escuchar!"}});
        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                await handleVideo(video2, message, voiceChannel, true); // eslint-disable-line no-await-in-loop
            }
            return message.channel.send({embed: {
                    color: "GREEN",
                    description: `:notes:  **|**  Playlist: **\`${playlist.title}\`** fue añadida a la lista!`
            }});
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 10);
                    var video = await youtube.getVideoByID(videos[0].id);
                    if (!video) return message.channel.send({embed: {color: "RED", description: ":notes:  **|**  No encuentro resultados"}});
                } catch (err) {
                    console.error(err);
                    return message.channel.send({embed: {color: "RED", description: ":notes:  **|**  No encuentro resultados"}});
                }
            }
            return handleVideo(video, message, voiceChannel);
        }
    }
    if (command === "buscar" || command === "b") {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.channel.send({embed: {color: "RED", description: "Lo siento, pero debes estar en un canal de voz para reproducir música.!"}});
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has("CONNECT")) {
            return message.channel.send({embed: {color: "RED", description: "Lo siento, pero necesito el permiso **`CONNECT`** para reproducir la cancion"}});
        }
        if (!permissions.has("SPEAK")) {
            return message.channel.send({embed: {color: "RED", description: "Lo siento, pero necesito el permiso **`SPEAK`** para reproducir la cancion!"}});
        }
        if (!url || !searchString) return message.channel.send({embed: {color: "RED", description: ":notes:  **|**  No encuentro resultados"}});
        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                await handleVideo(video2, message, voiceChannel, true); // eslint-disable-line no-await-in-loop
            }
            return message.channel.send({embed: {
                color: "GREEN",
                description: `:notes:  **|**  Playlist: **\`${playlist.title}\`** fue añadida a la lista!`
            }});
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 10);
                    let index = 0;
                    let embedPlay = new MessageEmbed()
                        .setColor("BLUE")
                        .setAuthor("Buscando Resultados", message.author.displayAvatarURL())
                        .setDescription(`${videos.map(video2 => `**\`${++index}\`  |**  ${video2.title}`).join("\n")}`)
                        .setFooter("Elija uno de los siguientes 10 resultados, esta inserción se eliminará automáticamente en 15 segundos");
                    // eslint-disable-next-line max-depth
                    message.channel.send(embedPlay).then(m => m.delete({
                        timeout: 15000
                    }))
                    try {
                        var response = await message.channel.awaitMessages(message2 => message2.content > 0 && message2.content < 11, {
                            max: 1,
                            time: 15000,
                            errors: ["time"]
                        });
                    } catch (err) {
                        console.error(err);
                        return message.channel.send({embed: {
                            color: "RED",
                            description: "El tiempo de selección de la canción ha expirado en 15 segundos, la solicitud ha sido cancelada."
                        }});
                    }
                    const videoIndex = parseInt(response.first().content);
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
                } catch (err) {
                    console.error(err);
                    return message.channel.send({embed: {color: "RED", description: ":notes:  **|**  No encontre resultados!."}});
                }
            }
            response.delete();
            return handleVideo(video, message, voiceChannel);
        }

    } else if (command === "saltear") {
        if (!message.member.voice.channel) return message.channel.send({embed: {color: "RED", description: "Lo siento, pero debes estar en un canal de voz para omitir una música!."}});
        if (!serverQueue) return message.channel.send({embed: {color: "RED", description: "No hay nada reproduciendo que pueda saltar por ti"}});
        serverQueue.connection.dispatcher.end("[runCmd] Skip command has been used");
        return message.channel.send({embed: {color: "GREEN", description: ":notes:  **|**  He salteado la cancion por ti"}});

    } else if (command === "parar") {
        if (!message.member.voice.channel) return message.channel.send({embed: {color: "RED", description: "Lo siento, pero debes estar en un canal de voz para parar una música!."}});
        if (!serverQueue) return message.channel.send({embed: {color: "RED", description: "No hay nada reproduciendo que pueda parar por ti"}});
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end("[runCmd] Stop command has been used");
        return message.channel.send({embed: {color: "GREEN", description: ":x:  **|**  Eliminando canciones y saliendo del canal..."}});

    } else if (command === "volumen" || command === "vol") {
        if (!message.member.voice.channel) return message.channel.send({embed: {color: "RED", description: "Lo siento, pero debes estar en un canal de voz para ajustar el volumen!."}});
        if (!serverQueue) return message.channel.send({embed: {color: "RED", description: ":notes: **|** No se esta reproduiendo ninguna cancion!."}});
        if (!args[1]) return message.channel.send({embed: {color: "BLUE", description: `:loud_sound: Volumen actuall: **\`${serverQueue.volume}%\`**`}});
        if (isNaN(args[1]) || args[1] > 100) return message.channel.send({embed: {color: "RED", description: "Volume only can be set in a range of **\`1\`** - **\`100\`**"}});
        serverQueue.volume = args[1];
        serverQueue.connection.dispatcher.setVolume(args[1] / 100);
        return message.channel.send({embed: {color: "GREEN", description: `:loud_sound: He establecido el volumen a: **\`${args[1]}%\`**`}});

    } else if (command === "reproduciendo ahora" || command === "rpa") {
        if (!serverQueue) return message.channel.send({embed: {color: "RED", description: "Nada se esta reproduciendo"}});
        return message.channel.send({embed: {color: "BLUE", description: `:musical_note:  **|**  Actualmente esta sonando: **\`${serverQueue.songs[0].title}\`**`}});

    } else if (command === "lista" || command === "l") {
        if (!serverQueue) return message.channel.send({embed: {color: "RED", description: "Ninguna cancion hay en la lista actualmente"}});
        let embedQueue = new MessageEmbed()
            .setColor("BLUE")
            .setAuthor("Lista De Canciones", message.author.displayAvatarURL())
            .setDescription(`${serverQueue.songs.map(song => `**-** ${song.title}`).join("\n")}`)
            .setFooter(`• Sonando Actualmente: ${serverQueue.songs[0].title}`);
        return message.channel.send(embedQueue);

    } else if (command === "pausar") {
        if (serverQueue && serverQueue.playing) {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return message.channel.send({embed: {color: "GREEN", description: ":pause_button:  **|**  Musica Pausada Con Exito!"}});
        }
        return message.channel.send({embed: {color: "RED", description: "No se esta reproduciendo ninguna cancion!."}});

    } else if (command === "resumir") {
        if (serverQueue && !serverQueue.playing) {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return message.channel.send({embed: {color: "GREEN", description: "▶  **|**  Cancion resumida!."}});
        }
        return message.channel.send({embed: {color: "RED", description: "No se esta reproduciendo ninguna cancion!."}});
    } else if (command === "loop") {
        if (serverQueue) {
            serverQueue.loop = !serverQueue.loop;
            return message.channel.send({embed: {color: "GREEN", description: `:repeat_one:  **|**  Modo De Loop **\`${serverQueue.loop === true ? "Activado" : "Desactivado"}\`**`}});
        };
        return message.channel.send({embed: {color: "RED", description: "No se esta reproduciendo ninguna cancion!."}});
    }
});

async function handleVideo(video, message, voiceChannel, playlist = false) {
    const serverQueue = queue.get(message.guild.id);
    const song = {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    };
    if (!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 100,
            playing: true,
            loop: false
        };
        queue.set(message.guild.id, queueConstruct);
        queueConstruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(message.guild, queueConstruct.songs[0]);
        } catch (error) {
            console.error(`[ERROR] No pude unirme al canal de voz, porque: ${error}`);
            queue.delete(message.guild.id);
            return message.channel.send({embed: {color: "RED", description: `No pude unirme al canal de voz, porque: **\`${error}\`**`}});
        }
    } else {
        serverQueue.songs.push(song);
        if (playlist) return;
        else return message.channel.send({embed: {color: "GREEN", description: `:asterisk:  **|**  **\`${song.title}\`** fue añadida a la lista!.`}});
    }
    return;
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.voiceChannel.leave();
        return queue.delete(guild.id);
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
        .on("finish", () => {
            const shiffed = serverQueue.songs.shift();
            if (serverQueue.loop === true) {
                serverQueue.songs.push(shiffed);
            };
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolume(serverQueue.volume / 100);

    serverQueue.textChannel.send({
        embed: {
            color: "BLUE",
            description: `:arrow_forward:  **|**  Iniciando La Cancion: **\`${song.title}\`**`
        }
    });
}

bot.login(process.env.BOT_TOKEN);
