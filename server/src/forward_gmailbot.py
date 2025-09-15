# server/src/forward_gmailbot.py

from telethon import TelegramClient, events
import requests
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# === CONFIGURATION(from .env) ===
API_ID = int(os.getenv("TELEGRAM_API_ID"))
API_HASH = os.getenv("TELEGRAM_API_HASH")
SESSION_NAME = "gmailbot_forwarder"  # session file name (will be created once after login)
BOT_USERNAME = "GmailBot"  # official Gmail bot username
FORWARD_URL = os.getenv("TELEGRAM_FORWARD_URL") # my app's endpoint


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