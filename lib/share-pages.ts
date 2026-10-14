/**
 * Pure HTML builder for the public share flow (no React, no DB): the reveal a
 * shared note plays right after a correct passcode. Ported from Flows
 * (src/components/UnlockReveal.jsx), in plain script because the note is a
 * server-rendered document, not a React tree.
 */

const DURATION = 3000;
const COUNT = 1000;

/**
 * Injected into a shared note's <head> when it arrives from the passcode gate
 * (&unlocked=1): the note starts frosted, the frost wipes away top to bottom
 * over 3 s, and 1000 single-pixel blue fireflies scatter across the page while
 * it does, brightest at the moving edge. Runs once, removes itself and the
 * ?unlocked flag. Reduced motion skips straight to the note.
 *
 * The note page is sandboxed to an opaque origin, so everything here is inline
 * and self-contained; history.replaceState may throw there and is best-effort.
 */
export function unlockReveal(isDark: boolean): string {
    // Dark notes get light points screened over them; on a white note screen
    // blending is invisible, so the flies draw as saturated blue instead.
    const frost = isDark ? "rgba(15,15,15,0.28)" : "rgba(255,255,255,0.35)";
    const blend = isDark ? "screen" : "normal";
    const colors = isDark ? ["170,215,255", "255,255,255"] : ["70,150,255", "125,195,255"];
    return `<style>#stickiesReveal{position:fixed;inset:0;z-index:2147483647;pointer-events:none}
#stickiesReveal .frost{position:absolute;inset:0;background:${frost};-webkit-backdrop-filter:blur(22px) saturate(1.1);backdrop-filter:blur(22px) saturate(1.1)}
#stickiesReveal canvas{position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:${blend}}</style>
<script>(function(){
  if(!/[?&]unlocked=1(&|$)/.test(location.search))return;
  try{var u=new URL(location.href);u.searchParams.delete("unlocked");history.replaceState(history.state,"",u)}catch(e){}
  if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  var DURATION=${DURATION},COUNT=${COUNT},COLORS=${JSON.stringify(colors)};
  function go(){
    var root=document.createElement("div");root.id="stickiesReveal";root.setAttribute("aria-hidden","true");
    var veil=document.createElement("div");veil.className="frost";
    var cv=document.createElement("canvas");root.appendChild(veil);root.appendChild(cv);document.body.appendChild(root);
    var ctx=cv.getContext("2d");if(!ctx){root.remove();return}
    var dpr=window.devicePixelRatio||1,W=window.innerWidth,H=window.innerHeight;
    cv.width=W*dpr;cv.height=H*dpr;ctx.scale(dpr,dpr);
    var flies=[];for(var i=0;i<COUNT;i++)flies.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*60,vy:(Math.random()-.5)*60-10,tw:Math.random()*Math.PI*2,sp:4+Math.random()*8,c:Math.random()<.7?COLORS[0]:COLORS[1]});
    var t0=performance.now();
    function frame(now){
      var t=Math.min(1,(now-t0)/DURATION);
      var ease=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
      var edge=-20+ease*140;
      var mask="linear-gradient(to bottom, transparent "+edge+"%, #000 "+(edge+20)+"%)";
      veil.style.maskImage=mask;veil.style.webkitMaskImage=mask;
      ctx.clearRect(0,0,W,H);
      var dt=1/60,front=(edge+10)/100*H;
      for(var i=0;i<flies.length;i++){var f=flies[i];f.x+=f.vx*dt;f.y+=f.vy*dt;
        var near=Math.max(0,1-Math.abs(f.y-front)/(H*.35));
        var a=(.25+.75*near)*(.55+.45*Math.sin(f.tw+now/1000*f.sp))*(t<.85?1:(1-t)/.15);
        if(a<=.02)continue;
        ctx.fillStyle="rgba("+f.c+","+(a*.25).toFixed(3)+")";ctx.fillRect(f.x-1.5,f.y-1.5,4,4);
        ctx.fillStyle="rgba("+f.c+","+a.toFixed(3)+")";ctx.fillRect(f.x,f.y,1,1);}
      if(t<1)requestAnimationFrame(frame);else root.remove();
    }
    requestAnimationFrame(frame);
  }
  if(document.body)go();else document.addEventListener("DOMContentLoaded",go);
})();</script>`;
}
