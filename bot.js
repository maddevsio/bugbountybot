const TelegramBot = require('node-telegram-bot-api');
const Querier = require('./querier');
const Promise = require('bluebird');
const moment = require('moment');
const FirebaseSync = require('./fbsync');
const fetch = require('node-fetch');
fetch.Promise = Promise;

const SECONDS_IN_MINUTE = 60;
const LIMIT_MESSAGES_PER_MINUTE = 10;
const MILLISECONDS_IN_SECOND = 1000;

let bot = null;

function log(...args) {
    console.log(...args);
}

class Bot {
    constructor(firebase, querier, telegramBot, config, process) {
        this.config = config;
        this.lastDiscloseDate = null;
        this.process = process;
        this.firebase = firebase;
        this.querier = querier;
        this.telegramBot = telegramBot;
        this.standardTimeoutInMs = (SECONDS_IN_MINUTE / LIMIT_MESSAGES_PER_MINUTE) * MILLISECONDS_IN_SECOND;
    }

    formatDate(strDate) {
        return moment(strDate).utc().format('YYYY-MM-DD HH:mm:ss UTC+0');
    }

    escapeChars(text) {
        return text.replace(/([\\\`\*\_\{\}\[\]\(\)\#\+\-\.\!])/g, '\\$1');
    }

    createMessage(node) {
        return `_Hacktivity_ from *${this.escapeChars(node.reporter.username)}* 
\`\`\`text \n${this.escapeChars(node.report.title)}\`\`\` 
${node.report.url}
*Disclosed at:* ${this.formatDate(node.report.disclosed_at)}
*Created at:* ${this.formatDate(node.report.created_at)}`
    }

    async go() {
        log('Bot not sleeping!');
        if (!this.lastDiscloseDate) {
            this.lastDiscloseDate = await this.firebase.get('hackerone/last_disclose_date');
        }

        log(`lastDiscloseDate 1: ${this.lastDiscloseDate}`);
        
        const response = await this.querier.queryReports({
            disclosed_at: this.lastDiscloseDate
        });

        if (!response.data) {
            log(`[WARNING] No response data: ${JSON.stringify(response)}`);
            return;
        }
        
        log(`Received: ${response.data.hacktivity_items.edges.length} records`);
        response.data.hacktivity_items.edges.sort(
            (a, b) => ((moment(a.node.report.disclosed_at) > moment(b.node.report.disclosed_at)) ? -1 : ((moment(a.node.report.disclosed_at) < moment(b.node.report.disclosed_at)) ? 1 : 0))            
        );

        const reports = response.data.hacktivity_items.edges.filter(r => r.node.report.disclosed_at !== this.lastDiscloseDate);

        log(`But ${reports.length ? 'found' : 'not found'} new records!`);

        //console.log(JSON.stringify(response, null, 2))

        if (reports.length > 0) {
            this.lastDiscloseDate = reports[0].node.report.disclosed_at;
            await this.firebase.put('hackerone/last_disclose_date', this.lastDiscloseDate);
        }

        await Promise.mapSeries(reports, (report) => {
            return new Promise(async (resolve) => {
                await this.telegramBot.sendMessage(
                    this.config.chatId,
                    this.createMessage(report.node), {
                        parse_mode: 'Markdown'
                    }
                );
                log('[BOT]: ', this.createMessage(report.node));
                Promise.delay(this.standardTimeoutInMs).then(resolve);
            });
        });
    }
}

async function start(config) {
    const querier = new Querier(config);
    const firebase = new FirebaseSync(config);
    const telegramBot = new TelegramBot(config.token, {
        polling: true
    });

    if (!bot) {
        bot = new Bot(
            firebase,
            querier,
            telegramBot,
            config,
            process
        );
    }
    log('-------------------------- running bot loop ------------------------');
    function loop() {
        return bot.go().then(() => setTimeout(loop, 1000 * config.intervalInSeconds));
    }
    await loop();
}

module.exports = {
    start,
};