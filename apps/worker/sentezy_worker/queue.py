from __future__ import annotations

from redis import Redis
from redis.exceptions import ResponseError

# Must match packages/types (REDIS_STREAM / REDIS_GROUP) on the TS producer side.
STREAM = "sentezy:videos"
GROUP = "worker"


class Queue:
    def __init__(self, url: str, consumer: str = "worker-1"):
        self.r = Redis.from_url(url, decode_responses=True)
        self.consumer = consumer

    def ensure_group(self) -> None:
        try:
            self.r.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
        except ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise

    def read(self, block_ms: int = 5000, count: int = 1) -> list[tuple[str, dict]]:
        res = self.r.xreadgroup(GROUP, self.consumer, {STREAM: ">"}, count=count, block=block_ms)
        out: list[tuple[str, dict]] = []
        for _stream, entries in res or []:
            for msg_id, fields in entries:
                out.append((msg_id, fields))
        return out

    def ack(self, msg_id: str) -> None:
        self.r.xack(STREAM, GROUP, msg_id)
