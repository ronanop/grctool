"""
Delete any existing user(s) with the given username.
Usage: from backend folder: python -m scripts.delete_user_by_username hr
"""
import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(dotenv_path=backend_dir / ".env")

from app.database import db


async def main():
    username = (sys.argv[1] if len(sys.argv) > 1 else "hr").strip()
    if not username:
        print("Usage: python -m scripts.delete_user_by_username <username>")
        return

    result = await db.users.delete_many({"username": username})
    if result.deleted_count == 0:
        print(f"No user with username '{username}' found.")
    else:
        print(f"Deleted {result.deleted_count} user(s) with username '{username}'.")


if __name__ == "__main__":
    asyncio.run(main())
