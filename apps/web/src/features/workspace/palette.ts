export type Tone="brand"|"blue"|"violet"|"amber"|"coral"|"cyan"|"neutral";
const avatarTones:Tone[]=["blue","violet","cyan","amber","coral","brand"];
/** Stable across tables and chat, so a person's fallback keeps the same color. */
export function identityTone(name:string):Tone{
 let hash=0;for(const character of name.normalize("NFC"))hash=(Math.imul(hash,31)+character.codePointAt(0)!)>>>0;
 return avatarTones[hash%avatarTones.length];
}
export function statusTone(status:string):Tone{
 return ({active:"blue",todo:"neutral",doing:"violet",blocked:"coral",done:"brand",completed:"brand",paused:"amber",archived:"neutral",revoked:"neutral"} as Record<string,Tone>)[status]||"neutral";
}
export function priorityTone(priority:string):Tone{
 return ({urgent:"coral",high:"amber",medium:"blue",low:"neutral"} as Record<string,Tone>)[priority]||"neutral";
}
