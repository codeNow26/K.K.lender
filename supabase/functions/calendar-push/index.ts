import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import webpush from 'npm:web-push@3.6.7';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function allowedEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname;
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' ||
        host === 'web.push.apple.com' || host.endsWith('.push.apple.com'));
  } catch { return false; }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const payload = await req.json();
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    if (payload.action === 'key') return publicKey ? json({ publicKey }) : json({ error: 'Not configured' }, 503);
    const secret = Deno.env.get('CALENDAR_WEBHOOK_SECRET');
    if (!secret || req.headers.get('x-calendar-webhook-secret') !== secret) return json({ error: 'Unauthorized' }, 401);
    if (payload.type !== 'INSERT' || payload.table !== 'events' || payload.schema !== 'public' || !payload.record?.id) return json({ ignored: true });
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('VAPID_SUBJECT');
    if (!publicKey || !privateKey || !subject) return json({ error: 'Not configured' }, 503);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: event, error: eventError } = await db.from('events').select('id,created_by').eq('id', payload.record.id).maybeSingle();
    if (eventError) throw eventError;
    if (!event?.created_by) return json({ ignored: true });
    const { data: members, error: memberError } = await db.from('calendar_members').select('user_id,display_name');
    if (memberError) throw memberError;
    const author = members?.find(m => m.user_id === event.created_by);
    const recipients = members?.filter(m => m.user_id !== event.created_by).map(m => m.user_id) ?? [];
    if (!author || !recipients.length) return json({ ignored: true });
    const { data: subscriptions, error: subError } = await db.from('calendar_push_subscriptions')
      .select('user_id,endpoint,p256dh,auth').in('user_id', recipients);
    if (subError) throw subError;
    const { error: claimError } = await db.from('calendar_push_deliveries').insert({ event_id: event.id });
    if (claimError?.code === '23505') return json({ duplicate: true });
    if (claimError) throw claimError;
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const name = author.display_name === 'Philipp' ? 'Phjelepp' : 'Adrietz';
    const results = await Promise.allSettled((subscriptions ?? []).filter(s => allowedEndpoint(s.endpoint)).map(async s => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ id: event.id, body: name + ' hat einen neuen Inselplan hinzugefügt! 🌿' }),
          { TTL: 3600, timeout: 10000 });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from('calendar_push_subscriptions').delete().eq('user_id', s.user_id).eq('endpoint', s.endpoint);
        } else throw error;
      }
    }));
    return json({ failed: results.filter(r => r.status === 'rejected').length });
  } catch { return json({ error: 'Push delivery failed' }, 500); }
});
