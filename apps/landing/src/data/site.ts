/** Outbound destinations. The web app host is not fixed yet — set PUBLIC_APP_URL in the
 *  Cloudflare Pages build environment when it is, and nothing else needs to change. */
export const APP_URL: string = import.meta.env.PUBLIC_APP_URL ?? "http://localhost:3000";

export const SIGNUP_URL = `${APP_URL}/signup`;
export const LOGIN_URL = `${APP_URL}/login`;
export const INSTAGRAM_URL = "https://www.instagram.com/sentezy.ai/";
