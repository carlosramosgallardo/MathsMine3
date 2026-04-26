'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { normalizeMacroState } from '@/lib/mm3-macro';
import { useI18n } from '@/lib/i18n-context';
import { useDice } from '@/lib/dice-context';

const ACTIVE_WINDOW_MS = 90_000;

function normalizeActiveWallets(rows) { const uniqueWallets=[]; const seen=new Set(); for (const entry of rows||[]) { const wallet=String(entry.wallet||'').toLowerCase(); if(!wallet||seen.has(wallet)) continue; seen.add(wallet); uniqueWallets.push({wallet,source:entry.source||'wallet',last_seen:entry.last_seen||null}); } return uniqueWallets; }
function countAnonFromState(state) { const seen=new Set(); let count=0; for (const entries of Object.values(state||{})) { for (const u of entries) { const id=String(u.anonId||''); if(!id.startsWith('anon:')||seen.has(id)) continue; seen.add(id); count++; } } return count; }

export default function GlobalPulseBar(){
const { language } = useI18n(); const dice=useDice();
const [macro,setMacro]=useState(()=>normalizeMacroState());
const [activeWallets,setActiveWallets]=useState([]);
const [anonCount,setAnonCount]=useState(0);
const [totalWallets,setTotalWallets]=useState(0);

useEffect(()=>{ const load=async()=>{ try{ const {data}=await supabase.from('mm3_macro_state').select('war_percent, nature_percent').eq('id',1).maybeSingle(); setMacro(normalizeMacroState(data)); }catch{} }; load(); const t=setInterval(load,30000); return()=>clearInterval(t); },[]);
useEffect(()=>{ const load=async()=>{ try{ const since=new Date(Date.now()-ACTIVE_WINDOW_MS).toISOString(); const {data}=await supabase.from('mm3_wallet_presence').select('wallet, source, last_seen').gte('last_seen',since).order('last_seen',{ascending:false}); setActiveWallets(normalizeActiveWallets(data)); }catch{ setActiveWallets([]);} }; load(); const t=setInterval(load,10000); const c=supabase.channel('mm3-global-pulse-presence-watch').on('postgres_changes',{event:'*',schema:'public',table:'mm3_wallet_presence'},load).subscribe(); return()=>{clearInterval(t); supabase.removeChannel(c);} },[]);
useEffect(()=>{ const load=async()=>{ try{ const {count}=await supabase.from('player_progress').select('wallet',{count:'exact',head:true}); if(count!=null) setTotalWallets(count);}catch{} }; load(); const t=setInterval(load,60000); return()=>clearInterval(t); },[]);
useEffect(()=>{ const c=supabase.channel('mm3-irc-anon-presence'); c.on('presence',{event:'sync'},()=>setAnonCount(countAnonFromState(c.presenceState()))).subscribe(async(s)=>{ if(s==='SUBSCRIBED'){ await c.track({type:'header'}).catch(()=>{}); setAnonCount(countAnonFromState(c.presenceState())); } }); return()=>supabase.removeChannel(c); },[]);

const isSpanish=language==='es'; const ircConnectedCount=activeWallets.length+anonCount;
const items=[{emoji:'⚔️',value:macro.war_percent,color:'#fb7185'},{emoji:'🌪️',value:macro.nature_percent,color:'#67e8f9'}];
const diceModPct=dice?Math.round(Math.abs(dice.modifier)*100):0; const diceSign=dice?.modifier>=0?'+':'−';

return (<div className="flex items-center gap-1 sm:gap-1.5">
<div className="flex items-center gap-0.5 sm:gap-1">{items.map((item)=><div key={item.emoji} className="flex h-7 sm:h-9 items-center gap-0.5 px-0.5 sm:px-1 font-mono text-[0.66rem] sm:text-[0.68rem] font-black" style={{color:item.color}}><span>{item.emoji}</span><span>{item.value.toFixed(0)}%</span></div>)}{dice&&<div className="flex h-7 sm:h-9 items-center gap-0.5 px-0.5 sm:px-1 font-mono text-[0.66rem] sm:text-[0.68rem] font-black" style={{color:dice.active?dice.color:'#334155'}}><span>🎲</span><span>{dice.active?`${diceSign}${diceModPct}%`:'0%'}</span></div>}</div>
<div className="group relative flex h-7 items-center gap-[3px] px-0.5 sm:px-1 font-mono text-[0.58rem] font-black sm:h-9 sm:text-[0.68rem]" title={isSpanish?`logados: ${activeWallets.length} / wallets: ${totalWallets} · IRC: ${ircConnectedCount}`:`online: ${activeWallets.length} / wallets: ${totalWallets} · IRC: ${ircConnectedCount}`}><span className="text-emerald-400 tabular-nums">{activeWallets.length}</span><span className="text-slate-600 text-[0.48rem]">/</span><span className="text-slate-500 tabular-nums">{totalWallets}</span><span className="text-slate-600 text-[0.44rem]">wallets</span><span className="text-slate-700 mx-[1px]">·</span><span className="text-cyan-700 tabular-nums">{ircConnectedCount}</span><span className="text-cyan-900 text-[0.44rem]">irc</span></div>
</div>);
}
