/**
 * Pre-hydration white-screen guard.
 *
 * Every earlier fix (ErrorPanel, app/(app)/error.tsx, global-error.tsx) runs INSIDE
 * React, so none of them fire when the entry chunk itself 404s - React never mounts,
 * no error is thrown into any boundary, and the tab sits on a blank document forever.
 * That is the exact state an open tab lands in when the chunk graph is swapped under
 * it (npm run dev takes :4444 from the hub, or the hub rebuilds).
 *
 * This runs as an inline <head> script, so it has no chunk dependency and works even
 * when every /_next/static request fails. Two escalating steps, never a loop:
 *   1. a static chunk fails to load (or nothing booted after BOOT_MS) -> reload once
 *   2. still not booted after MAX tries -> paint a dark panel with a Reload button
 * components/BootBeacon clears the counter as soon as React actually mounts.
 */
export const BOOT_WATCHDOG = `(function(){
var K='stickies:boot-heal',MAX=2,BOOT_MS=8000,done=false;
function n(){try{return parseInt(sessionStorage.getItem(K)||'0',10)||0}catch(e){return 0}}
function set(v){try{sessionStorage.setItem(K,String(v))}catch(e){}}
function panel(){
 var d=document.createElement('div');
 d.setAttribute('style','position:fixed;inset:0;z-index:2147483647;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;font:15px/1.6 -apple-system,BlinkMacSystemFont,sans-serif;padding:24px;text-align:center');
 d.innerHTML='<div><div style="width:56px;height:56px;border-radius:14px;background:#FFCC00;margin:0 auto 18px"></div>'
  +'<div style="font-size:17px;font-weight:700;margin-bottom:6px">Stickies could not start</div>'
  +'<div style="color:#8e8e93;max-width:340px;margin:0 auto 18px">The page assets did not load. This is usually a stale tab after the server restarted.</div>'
  +'<button id="stickies-boot-reload" style="background:#FFCC00;color:#000;border:0;border-radius:9px;padding:10px 20px;font-weight:700;font-size:15px;cursor:pointer">Reload</button></div>';
 document.body.appendChild(d);
 var b=document.getElementById('stickies-boot-reload');
 if(b)b.onclick=function(){try{sessionStorage.removeItem(K)}catch(e){}location.reload()};
}
function heal(){
 if(done||window.__stickiesBooted)return;
 done=true;
 var c=n();
 if(c>=MAX){panel();return}
 set(c+1);
 location.reload();
}
window.addEventListener('error',function(e){
 var t=e&&e.target;
 if(t&&t.tagName==='SCRIPT'&&/\\/_next\\/static\\//.test(t.src||''))heal();
},true);
window.addEventListener('load',function(){setTimeout(function(){if(!window.__stickiesBooted)heal()},BOOT_MS)});
})();`;
