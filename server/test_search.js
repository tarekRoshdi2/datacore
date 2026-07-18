import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram";
import fs from "fs";

async function test() {
    const settings = JSON.parse(fs.readFileSync('telegram_settings.json'));
    const API_ID = parseInt(settings.api_id);
    const API_HASH = settings.api_hash;

    const accounts = JSON.parse(fs.readFileSync('telegram_accounts.json'));
    const acc = accounts[0];
    const client = new TelegramClient(new StringSession(acc.sessionString), API_ID, API_HASH, { connectionRetries: 5 });
    await client.connect();

    console.log("Connected");
    const result = await client.invoke(new Api.contacts.Search({
        q: "تسويق",
        limit: 10
    }));

    console.log(`Found ${result.chats.length} chats`);
    result.chats.forEach(c => {
        console.log(`- ${c.className}: ${c.title} (megagroup: ${c.megagroup}, broadcast: ${c.broadcast}, participantsCount: ${c.participantsCount})`);
    });
    process.exit(0);
}

test();
