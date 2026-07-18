from __future__ import annotations

import glob
import json
import logging
import os
import shutil
import tempfile
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


def _cleanup_temp(video_id: str | None) -> None:
    """Remove the job's local temp workdir(s) (`/tmp/sentezy-<id>-*`) so the disk doesn't fill
    up over many renders. Runs on both success and failure."""
    if not video_id:
        return
    for d in glob.glob(os.path.join(tempfile.gettempdir(), f"sentezy-{video_id}-*")):
        shutil.rmtree(d, ignore_errors=True)


def main() -> None:
    # Dev convenience: load the monorepo root .env (Railway/Docker inject env
    # directly, and inside the container the tree is too shallow for parents[3]).
    parents = Path(__file__).resolve().parents
    if len(parents) > 3 and (parents[3] / ".env").exists():
        load_dotenv(parents[3] / ".env")

    cfg = load_config()
    db = Db(cfg.database_url)
    storage = Storage(cfg)
    el = ElevenLabs(cfg.elevenlabs_api_key)
    hg = HeyGen(cfg.heygen_api_key)
    queue = Queue(cfg.redis_url, consumer=os.environ.get("WORKER_NAME", "worker-1"))
    queue.ensure_group()

    # Clear temp workdirs left behind by previously-crashed jobs (safe at startup — none in flight).
    for d in glob.glob(os.path.join(tempfile.gettempdir(), "sentezy-*")):
        shutil.rmtree(d, ignore_errors=True)

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
                _cleanup_temp(video_id)
                queue.ack(msg_id)


if __name__ == "__main__":
    main()
