import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const load=async family=>{
  const context=vm.createContext({globalThis:null,Object,Set,Number,Math,Error});context.globalThis=context;
  vm.runInContext(await source(`js/map/${family}/movement-profile.js`),context);
  vm.runInContext(await source("js/map/movement.js"),context);
  return context.PokemonViewer.maps.movement;
};

test("GBA movement profile follows Emerald initial facings and mirrors east",async()=>{
  const movement=await load("gba");
  assert.equal(movement.direction({movementType:5},"gba"),"west");
  assert.equal(movement.direction({movementType:6},"gba"),"east");
  assert.deepEqual({...movement.frame("east",false,0,"gba")},{index:2,flipX:true,duration:16});
});

test("Gen I fixed directions decode D0-D3 and right reuses flipped left artwork",async()=>{
  const movement=await load("gbc");
  assert.equal(movement.direction({movement:0xff,rangeOrDirection:0xd2},"gbc"),"west");
  assert.equal(movement.direction({movement:0xff,rangeOrDirection:0xd3},"gbc"),"east");
  assert.deepEqual({...movement.frame("east",false,0,"gbc")},{index:2,flipX:true,duration:4});
});

test("Gen II standing movement IDs retain their own directional contract",async()=>{
  const movement=await load("gen2");
  assert.equal(movement.direction({movement:8},"gen2"),"west");
  assert.equal(movement.direction({movement:9},"gen2"),"east");
  assert.equal(movement.describe({movement:5,radius:0},"gen2").initial,"west");
  assert.deepEqual({...movement.frame("east",false,0,"gen2")},{index:2,flipX:true,duration:4});
});
