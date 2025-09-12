# server/src/forward_gmailbot.py

from telethon import TelegramClient, events
import requests

# === CONFIGURATION ===
API_ID = 20377359
API_HASH = "30faa790f8b055d5668472bf7b71a91e"
SESSION_NAME = "gmailbot_forwarder"  # session file name (will be created once after login)
BOT_USERNAME = "GmailBot"  # official Gmail bot username
FORWARD_URL = "http://localhost:8001/notifications/telegram"  # my app's endpoint


# === TELEGRAM CLIENT ===
client = TelegramClient(SESSION_NAME, API_ID, API_HASH)

@client.on(events.NewMessage(from_users=BOT_USERNAME))
async def handler(event):
    msg = event.message.message
    print(f"📩 New Gmail message:\n{msg}")

    try:
        response = requests.post(FORWARD_URL, json={"message": msg})
        print(f"✅ Forwarded to server, status {response.status_code}")
    except Exception as e:
        print(f"❌ Error forwarding: {e}")

def main():
    print("🚀 Starting GmailBot forwarder...")
    client.start()  # Uses saved session, no re-login needed
    client.run_until_disconnected()

if __name__ == "__main__":
    main()