// XYNARA REAL - Worker + D1 + Durable Objects - NO DUMMY
export interface Env { DB: D1Database; ROOM: DurableObjectNamespace; ADMIN_PASSWORD: string; ASSETS: Fetcher; }
export class ChatRoom {
  state: DurableObjectState; sessions: Map<any, any>;
  constructor(state: DurableObjectState, env: Env){ this.state=state; this.sessions=new Map(); }
  async fetch(request: Request){
    const url=new URL(request.url);
    if(url.pathname==='/ws'){
      const pair=new WebSocketPair(); const [client,server]=Object.values(pair) as any;
      const username=url.searchParams.get('username')||'anon'; const userId=url.searchParams.get('userId')||'anon'; const room=url.searchParams.get('room')||'general';
      server.accept(); this.sessions.set(server,{userId,username,room});
      this.broadcast({type:'user-joined',username,userId,room},server);
      const users=Array.from(this.sessions.values()).map((s:any)=>({username:s.username,userId:s.userId}));
      server.send(JSON.stringify({type:'room-users',users}));
      server.addEventListener('message',(ev:any)=>{
        try{ const data=JSON.parse(ev.data);
          if(data.to){ for(const [ws,info] of this.sessions){ if(info.username===data.to||info.userId===data.to){ ws.send(JSON.stringify({...data,from:username,fromId:userId})); } } }
          else { this.broadcast({...data,from:username,fromId:userId},server); }
        }catch{}
      });
      server.addEventListener('close',()=>{ const info=this.sessions.get(server); this.sessions.delete(server); if(info) this.broadcast({type:'user-left',username:info.username,userId:info.userId}); });
      return new Response(null,{status:101,webSocket:client});
    }
    return new Response('Room DO');
  }
  broadcast(msg:any,except?:any){ const s=JSON.stringify(msg); for(const ws of this.sessions.keys()){ if(ws!==except){ try{ws.send(s);}catch{} } } }
}
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, x-admin-pass'};
function j(d:any,st=200){ return new Response(JSON.stringify(d),{status:st,headers:{'Content-Type':'application/json',...cors}}); }
async function hashPw(pw:string,salt:string){ const e=new TextEncoder(); const b=await crypto.subtle.digest('SHA-256',e.encode(pw+':'+salt)); return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join(''); }
function badFilter(t:string){ const bad=['fuck','shit','bitch','dick','porn','sex','fucking']; let o=t; let f=false; for(const w of bad){ if(o.toLowerCase().includes(w)){ f=true; o=o.split(new RegExp(w,'gi')).join('***'); } } return {text:o,flagged:f}; }
async function getUser(env:Env,req:Request){ const a=req.headers.get('Authorization')||''; const tok=a.replace('Bearer ',''); if(!tok) return null; const s:any=await env.DB.prepare('SELECT * FROM sessions WHERE token=? AND expires_at>?').bind(tok,Date.now()).first(); if(!s) return null; const u:any=await env.DB.prepare('SELECT id,username,rank,banned,avatar_emoji FROM users WHERE id=?').bind(s.user_id).first(); if(!u||u.banned) return null; return {...u,token:tok}; }
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(request.method==='OPTIONS') return new Response(null,{headers:cors});
  if(url.pathname==='/ws'){ const room=url.searchParams.get('room')||'general'; const id=env.ROOM.idFromName(room); return env.ROOM.get(id).fetch(request); }
  if(url.pathname.startsWith('/api/')){
   const path=url.pathname.replace('/api','');
   if(path==='/health') return j({ok:true,real:true,app:'XYNARA REAL'});
   if(path==='/auth/signup'&&request.method==='POST'){
    const {username,password}=await request.json() as any;
    if(!username||!password||username.length<3||password.length<4) return j({error:'Username min 3, password min 4'},400);
    const clean=username.toLowerCase().trim().replace(/[^a-z0-9_]/g,''); if(clean!==username.toLowerCase()) return j({error:'Only a-z 0-9 _'},400);
    const ex=await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(clean).first(); if(ex) return j({error:'Username already taken'},409);
    const salt=crypto.randomUUID().slice(0,8); const hash=await hashPw(password,salt); const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO users (id,username,password_hash,salt,rank,created_at) VALUES (?,?,?,?,?,?)').bind(id,clean,hash,salt,'MEMBER',Date.now()).run();
    const cnt:any=await env.DB.prepare('SELECT COUNT(*) as c FROM groups').first();
    if(cnt.c===0){ const g1=crypto.randomUUID(),g2=crypto.randomUUID(); await env.DB.prepare('INSERT INTO groups (id,name,description,emoji,owner_id,created_at) VALUES (?,?,?,?,?,?)').bind(g1,'XYNARA HQ','Main HQ - real chat','🪐',id,Date.now()).run(); await env.DB.prepare('INSERT INTO groups (id,name,description,emoji,owner_id,created_at) VALUES (?,?,?,?,?,?)').bind(g2,'Gamers Lounge','Ranked + chaos','🎮',id,Date.now()).run(); for(const g of [g1,g2]){ await env.DB.prepare('INSERT INTO channels (id,group_id,name,type) VALUES (?,?,?,?)').bind(crypto.randomUUID(),g,'general','text').run(); await env.DB.prepare('INSERT INTO channels (id,group_id,name,type) VALUES (?,?,?,?)').bind(crypto.randomUUID(),g,'voice-lounge','voice').run(); } }
    const token=crypto.randomUUID(); await env.DB.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)').bind(token,id,Date.now()+1000*60*60*24*7).run();
    return j({user:{id,username:clean,rank:'MEMBER'},token});
   }
   if(path==='/auth/login'&&request.method==='POST'){
    const {username,password}=await request.json() as any; const clean=username.toLowerCase().trim();
    const user:any=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(clean).first(); if(!user) return j({error:'User not found. Sign up first.'},404);
    if(user.banned) return j({error:'You are BANNED by admin.'},403);
    const hash=await hashPw(password,user.salt); if(hash!==user.password_hash) return j({error:'Wrong password'},401);
    const token=crypto.randomUUID(); await env.DB.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)').bind(token,user.id,Date.now()+1000*60*60*24*7).run();
    return j({user:{id:user.id,username:user.username,rank:user.rank},token});
   }
   if(path==='/me'){ const u=await getUser(env,request); if(!u) return j({error:'Invalid token'},401); return j({user:u}); }
   const me=await getUser(env,request); if(!me) return j({error:'Login required - REAL login'},401);
   if(path==='/users') { const {results}=await env.DB.prepare('SELECT id,username,rank,avatar_emoji,created_at FROM users WHERE banned=0 ORDER BY created_at LIMIT 200').all(); return j({users:results}); }
   if(path==='/follow'&&request.method==='POST'){ const {target}=await request.json() as any; const tu:any=await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(target).first(); if(!tu) return j({error:'User not found'},404); const ex=await env.DB.prepare('SELECT * FROM follows WHERE follower_id=? AND following_id=?').bind(me.id,tu.id).first(); if(ex){ await env.DB.prepare('DELETE FROM follows WHERE follower_id=? AND following_id=?').bind(me.id,tu.id).run(); return j({following:false}); } else { await env.DB.prepare('INSERT INTO follows (follower_id,following_id,created_at) VALUES (?,?,?)').bind(me.id,tu.id,Date.now()).run(); return j({following:true}); } }
   if(path==='/following'){ const {results}=await env.DB.prepare('SELECT u.username FROM follows f JOIN users u ON u.id=f.following_id WHERE f.follower_id=?').bind(me.id).all(); return j({following:results.map((r:any)=>r.username)}); }
   if(path==='/groups'&&request.method==='GET'){ const {results}=await env.DB.prepare('SELECT * FROM groups ORDER BY created_at').all(); return j({groups:results}); }
   if(path==='/groups'&&request.method==='POST'){ const {name,description,emoji}=await request.json() as any; if(!name) return j({error:'Name required'},400); const id=crypto.randomUUID(); await env.DB.prepare('INSERT INTO groups (id,name,description,emoji,owner_id,created_at) VALUES (?,?,?,?,?,?)').bind(id,name,description||'',emoji||'🪐',me.id,Date.now()).run(); await env.DB.prepare('INSERT INTO channels (id,group_id,name,type) VALUES (?,?,?,?)').bind(crypto.randomUUID(),id,'general','text').run(); await env.DB.prepare('INSERT INTO channels (id,group_id,name,type) VALUES (?,?,?,?)').bind(crypto.randomUUID(),id,'voice-lounge','voice').run(); return j({id,name}); }
   if(path.startsWith('/groups/')&&path.endsWith('/channels')){ const gid=path.split('/')[2]; const {results}=await env.DB.prepare('SELECT * FROM channels WHERE group_id=?').bind(gid).all(); return j({channels:results}); }
   if(path==='/messages'&&request.method==='GET'){ const ch=url.searchParams.get('channelId'); const dm=url.searchParams.get('dm'); const after=url.searchParams.get('after')||'0'; let res:any; if(dm){ const key=[me.username,dm].sort().join(':'); res=await env.DB.prepare('SELECT * FROM messages WHERE dm_key=? AND created_at>? ORDER BY created_at ASC LIMIT 200').bind(key,Number(after)).all(); } else if(ch){ res=await env.DB.prepare('SELECT * FROM messages WHERE channel_id=? AND created_at>? ORDER BY created_at ASC LIMIT 200').bind(ch,Number(after)).all(); } else { res=await env.DB.prepare('SELECT * FROM messages WHERE created_at>? ORDER BY created_at ASC LIMIT 200').bind(Number(after)).all(); } return j({messages:res.results}); }
   if(path==='/messages'&&request.method==='POST'){ const {content,channelId,dmTo}=await request.json() as any; if(!content||!content.trim()) return j({error:'Empty'},400); const f=badFilter(content); const id=crypto.randomUUID(); let dmKey=null; if(dmTo) dmKey=[me.username,dmTo].sort().join(':'); await env.DB.prepare('INSERT INTO messages (id,channel_id,dm_key,sender_id,sender_name,content,flagged,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,channelId||null,dmKey,me.id,me.username,f.text,f.flagged?1:0,Date.now()).run(); return j({ok:true,flagged:f.flagged,content:f.text,id}); }
   if(path==='/admin/login'&&request.method==='POST'){ const {password}=await request.json() as any; if(password!==env.ADMIN_PASSWORD) return j({error:'Wrong admin password'},401); return j({ok:true}); }
   if(path==='/admin/users'&&request.method==='GET'){ const pwd=url.searchParams.get('adminPass')||''; if(pwd!==env.ADMIN_PASSWORD) return j({error:'Admin only'},401); const {results}=await env.DB.prepare('SELECT id,username,rank,banned,created_at FROM users ORDER BY created_at').all(); return j({users:results}); }
   if(path==='/admin/action'&&request.method==='POST'){ const {adminPass,action,target,rank}=await request.json() as any; if(adminPass!==env.ADMIN_PASSWORD) return j({error:'Admin only'},401); if(action==='ban') await env.DB.prepare('UPDATE users SET banned=1 WHERE username=?').bind(target).run(); if(action==='unban') await env.DB.prepare('UPDATE users SET banned=0 WHERE username=?').bind(target).run(); if(action==='set_rank') await env.DB.prepare('UPDATE users SET rank=? WHERE username=?').bind(rank,target).run(); if(action==='delete_message') await env.DB.prepare('DELETE FROM messages WHERE id=?').bind(target).run(); return j({ok:true}); }
   if(path==='/admin/all-messages'&&request.method==='GET'){ const pwd=url.searchParams.get('adminPass')||''; if(pwd!==env.ADMIN_PASSWORD) return j({error:'Admin only'},401); const {results}=await env.DB.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 300').all(); return j({messages:results}); }
   return j({error:'Not found'},404);
  }
  try{ return await env.ASSETS.fetch(request); }catch{ return new Response('XYNARA REAL - Deploy public/ folder', {status:404}); }
 }
};
