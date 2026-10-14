import {io} from "socket.io-client";
import type {Socket} from "socket.io-client";
let current:Socket|undefined;let audio:AudioContext|undefined;
export async function testNotificationSound(){try{audio ||= new AudioContext();await audio.resume();const source=audio.createOscillator(),gain=audio.createGain();source.connect(gain);gain.connect(audio.destination);gain.gain.value=0.04;source.frequency.value=660;source.start();source.stop(audio.currentTime+0.12);}catch{/* Browser sound permission is optional. */}}
export function connectWorkspace(token:string,organizationId:string){
 const socket=io((import.meta.env.VITE_API_BASE||window.location.origin)+"/organizations",{auth:{token,organizationId},transports:["websocket"],reconnection:true,reconnectionDelay:2000});current=socket;
 socket.on("workspace:changed",payload=>{if(payload.sound&&audio?.state==="running")void testNotificationSound();window.dispatchEvent(new CustomEvent(payload.scope==="typing"?"shekof-typing":"shekof-realtime",{detail:{...payload,organizationId}}));});
 socket.on("connect",()=>window.dispatchEvent(new CustomEvent("shekof-realtime",{detail:{scope:"workspace",organizationId}})));
 socket.on("disconnect",()=>window.dispatchEvent(new Event("shekof-realtime-disconnected")));
 return()=>{socket.disconnect();if(current===socket)current=undefined;};
}
export function sendTyping(conversationId:string,isTyping:boolean){if(current?.connected)current.emit("chat:typing",{conversationId,isTyping});}

export function requestPresence(conversationId:string,onResult:(users:{userId:string;status:string;fullName?:string}[])=>void){if(!current?.connected){onResult([]);return;}current.timeout(4000).emit("chat:presence",{conversationId},(error:Error|null,result:{ok:boolean;users:{userId:string;status:string;fullName?:string}[]})=>onResult(error||!result?.ok?[]:result.users));}
export function setPresence(status:string){current?.emit("presence:set",{status});}
