from __future__ import annotations

from typing import Any
from urllib.parse import unquote

import psycopg
from psycopg.rows import dict_row


def _parse_pg_url(url: str) -> dict[str, Any]:
    """Parse a Postgres URI into psycopg keyword params.

    The Supabase pooler password can contain characters (`@`, `[`, `>`, …) that
    break libpq's URI parser (splits on the first `@`) and urllib (`[` → IPv6).
    Parsing by hand and passing keyword args sidesteps both, so the worker
    connects whether the injected URL's password is raw or percent-encoded.
    """
    for scheme in ("postgresql://", "postgres://"):
        if url.startswith(scheme):
            url = url[len(scheme):]
            break
    userinfo, _, hostpart = url.rpartition("@")  # rpartition: password may itself contain '@'
    hostport, _, dbpart = hostpart.partition("/")
    host, _, port = hostport.partition(":")
    user, _, password = userinfo.partition(":")
    return {
        "host": host,
        "port": int(port) if port else 5432,
        "user": unquote(user),
        "password": unquote(password),
        "dbname": dbpart.split("?", 1)[0] or "postgres",
    }


class Db:
    """Direct Postgres access for the worker (status/progress writes bypass RLS via
    the connection role). The TS side uses Prisma; the worker uses psycopg."""

    def __init__(self, url: str):
        self._conn_kwargs = _parse_pg_url(url)

    def _conn(self) -> psycopg.Connection:
        return psycopg.connect(row_factory=dict_row, autocommit=True, **self._conn_kwargs)

    def _one(self, sql: str, *params: Any) -> dict | None:
        with self._conn() as c, c.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()

    def _exec(self, sql: str, *params: Any) -> None:
        with self._conn() as c, c.cursor() as cur:
            cur.execute(sql, params)

    # ── reads ──
    def get_video(self, video_id: str) -> dict | None:
        return self._one("select * from public.videos where id = %s", video_id)

    def get_presenter(self, presenter_id: str) -> dict | None:
        return self._one("select * from public.presenters where id = %s", presenter_id)

    def get_voice(self, voice_id: str) -> dict | None:
        return self._one("select * from public.voices where id = %s", voice_id)

    # ── writes ──
    def set_stage(self, video_id: str, stage: str, progress: int) -> None:
        self._exec(
            "update public.videos set status='processing'::video_status, "
            "stage=%s::video_stage, progress=%s where id=%s",
            stage, progress, video_id,
        )

    def set_ready(self, video_id: str, output_key: str, thumbnail_image_id: str, duration_s: float) -> None:
        self._exec(
            "update public.videos set status='ready'::video_status, stage='done'::video_stage, "
            "progress=100, output_key=%s, thumbnail_image_id=%s, duration_s=%s, error=null where id=%s",
            output_key, thumbnail_image_id, duration_s, video_id,
        )

    def set_failed(self, video_id: str, error: str) -> None:
        self._exec(
            "update public.videos set status='failed'::video_status, error=%s where id=%s",
            error[:1000], video_id,
        )

    def set_presenter_heygen(self, presenter_id: str, talking_photo_id: str, status: str = "ready") -> None:
        self._exec(
            "update public.presenters set heygen_talking_photo_id=%s, status=%s::presenter_status where id=%s",
            talking_photo_id, status, presenter_id,
        )

    def refund_credit(self, user_id: str, video_id: str, amount: int = 1) -> None:
        with self._conn() as c, c.cursor() as cur:
            cur.execute("update public.profiles set credits = credits + %s where id=%s", (amount, user_id))
            cur.execute(
                "insert into public.credit_ledger (user_id, delta, reason, video_id) values (%s,%s,%s,%s)",
                (user_id, amount, "video_failed_refund", video_id),
            )
