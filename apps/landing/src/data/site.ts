/** Outbound destinations. The web app host is not fixed yet — set PUBLIC_APP_URL in the
 *  Cloudflare Pages build environment when it is, and nothing else needs to change. */
export const APP_URL: string = import.meta.env.PUBLIC_APP_URL ?? "http://localhost:3000";

export const SIGNUP_URL = `${APP_URL}/signup`;
export const LOGIN_URL = `${APP_URL}/login`;

/** The app is not open yet. Every "Start free" button on the page points here instead of the
 *  signup route, so a visitor lands on the coming-soon page rather than a login they cannot use. */
export const START_URL = "/soon";

/** Social profiles. Instagram is live. TikTok and YouTube handles are assumed to follow the same
 *  @sentezy.ai pattern — confirm or replace them before launch. */
export const INSTAGRAM_URL = "https://www.instagram.com/sentezy.ai/";
export const TIKTOK_URL = "https://www.tiktok.com/@sentezy.ai";
export const YOUTUBE_URL = "https://www.youtube.com/@sentezy-ai";
