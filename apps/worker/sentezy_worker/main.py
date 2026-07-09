from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

from .config import load_config
from .db import Db
from .pipeline import process_video
from .providers.elevenlabs import ElevenLabs
from .providers.heygen import HeyGen
from .queue import Queue
from .storage import Storage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("sentezy.worker")


def main() -> None:
    # Dev convenience: load the monorepo root .env (Railway injects env directly).
    root_env = Path(__file__).resolve().parents[3] / ".env"
    if root_env.exists():
        load_dotenv(root_env)

    cfg = load_config()
    db = Db(cfg.database_url)
    storage = Storage(cfg)
    el = ElevenLabs(cfg.elevenlabs_api_key)
    hg = HeyGen(cfg.heygen_api_key, cfg.heygen_test_mode)
    queue = Queue(cfg.redis_url, consumer=os.environ.get("WORKER_NAME", "worker-1"))
    queue.ensure_group()

    log.info("Sentezy worker started — consuming %s", queue.consumer)
    while True:
        for msg_id, fields in queue.read(block_ms=5000):
            video_id: str | None = None
            user_id: str | None = None
            try:
                payload = json.loads(fields["payload"])
                video_id = payload["videoId"]
                user_id = payload.get("userId")
                log.info("processing video %s", video_id)
                process_video(video_id, cfg, db, storage, el, hg)
                log.info("completed video %s", video_id)
            except Exception as e:  # noqa: BLE001 — terminal handling below
                log.exception("failed video %s: %s", video_id, e)
                if video_id:
                    try:
                        db.set_failed(video_id, str(e))
                        if user_id:
                            db.refund_credit(user_id, video_id)
                    except Exception:  # noqa: BLE001
                        log.exception("failed to record failure for %s", video_id)
            finally:
                queue.ack(msg_id)


if __name__ == "__main__":
    main()
