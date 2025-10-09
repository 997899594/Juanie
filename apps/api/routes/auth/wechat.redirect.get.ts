import { defineEventHandler, setCookie, sendRedirect } from 'h3';
import { randomUUID } from 'node:crypto';

export default defineEventHandler(async (event) => {
  const state = randomUUID();
  setCookie(event, 'oauth_state', state, { httpOnly: true, sameSite: 'strict', path: '/' });
  const url = new URL('https://open.weixin.qq.com/connect/qrconnect');
  url.searchParams.set('appid', process.env.WECHAT_APP_ID as string);
  url.searchParams.set('redirect_uri', encodeURIComponent(process.env.WECHAT_REDIRECT_URI as string));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'snsapi_login');
  url.searchParams.set('state', state);
  return sendRedirect(event, url.toString(), 302);
});