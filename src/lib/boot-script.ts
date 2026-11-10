import { SEASONS } from "./season";
import { MODE_STORAGE_KEY } from "./mode";
import { THEME_STORAGE_KEY } from "./theme";

// Runs inline in <head>, before first paint, so the page never flashes the wrong theme or season.
// It cannot import anything, so the calendar rule from season.ts is restated here; season.test.ts
// runs this source against seasonOf for every day of the year to keep the two in step.
//
//   data-theme   the stored choice, else the system preference, else dark. `?theme=` previews one.
//   data-season  the season in India today. `?season=` previews one.
//   data-mode    "ai" or "site": the query, else the stored choice, else site.
export const BOOT_SCRIPT = `(function(){var d=document.documentElement,q=new URLSearchParams(location.search),S=${JSON.stringify(SEASONS)};
var t=q.get("theme");if(t!=="light"&&t!=="dark"){try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}}
if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";
d.dataset.theme=t;
var s=q.get("season");if(S.indexOf(s)<0){var n=new Date(Date.now()+19800000),m=n.getUTCMonth()+1,i=Math.floor((m+9)%12/2);
s=S[m%2===0||n.getUTCDate()>=15?i:(i+5)%6]}
d.dataset.season=s;
var m=q.get("mode");if(m!=="ai"&&m!=="site"){try{m=localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)})}catch(e){}}
d.dataset.mode=m==="ai"?"ai":"site"})()`;
