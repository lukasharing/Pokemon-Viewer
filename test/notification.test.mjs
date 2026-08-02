import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("NotificationCenter pauses and resumes one remaining timeout",async()=>{
  let now=1000,nextHandle=0;const cleared=[];
  const context=vm.createContext({globalThis:null,NotificationType:{ERROR:1,NOTIFICATION:3},Date:{now:()=>now},setTimeout:()=>++nextHandle,clearTimeout:handle=>cleared.push(handle),document:{}});context.globalThis=context;
  vm.runInContext(await read("js/notification/handler.js"),context);
  const center=new context.NotificationCenter({duration:1000}),notice={id:"notice",persistent:false};center.notifications.push(notice);
  center.schedule(notice,1000);now=1400;
  assert.equal(center.pause(notice.id),true);assert.equal(center.timers.get(notice.id).remaining,600);assert.deepEqual(cleared,[1]);
  assert.equal(center.pause(notice.id),false);
  assert.equal(center.resume(notice.id),true);assert.equal(center.timers.get(notice.id).deadline,2000);
  assert.equal(center.resume(notice.id),false);
});

test("notifications expose independent live semantics and durable problem history",async()=>{
  const notice=await read("js/notification/notification.js"),handler=await read("js/notification/handler.js"),html=await read("index.html"),styles=await read("scss/components/_notifications.scss");
  assert.match(notice,/role:this\.type===NotificationType\.ERROR\?"alert":"status"/);
  assert.match(notice,/aria-live/);assert.match(notice,/datetime:this\.date\.toISOString/);
  assert.match(handler,/this\.history\.push\(notice\)/);assert.match(handler,/pointerenter/);assert.match(handler,/focusin/);
  assert.match(handler,/openProblems\(\)/);assert.match(handler,/clearProblems\(\)/);
  assert.match(html,/notification-problems-button/);assert.match(styles,/\.notification-problems/);
  assert.doesNotMatch(html,/id="notification-area"[^>]+aria-live/);
});
