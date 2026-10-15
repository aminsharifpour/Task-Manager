import jalaali from "jalaali-js";
const {toJalaali,toGregorian,jalaaliMonthLength,isValidJalaaliDate}=jalaali;
export const dayMs=86400000;
export const faNumber=(n:number)=>new Intl.NumberFormat("fa-IR",{useGrouping:false}).format(n);
export const dayIndex=(value:string)=>Math.floor(new Date(value.slice(0,10)+"T00:00:00Z").getTime()/dayMs);
export const dayISO=(n:number)=>new Date(n*dayMs).toISOString().slice(0,10);
export const jalaliParts=(n:number)=>{const date=new Date(n*dayMs);return toJalaali(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate());};
export function jalaliDate(value?:string|null,long=false){if(!value)return "—";const date=new Date(value.slice(0,10)+"T00:00:00Z");if(Number.isNaN(date.getTime()))return "—";return new Intl.DateTimeFormat("fa-IR",{calendar:"persian",timeZone:"UTC",year:"numeric",month:long?"long":"2-digit",day:"2-digit"}).format(date);}
export const jalaliMonthLabel=(n:number)=>new Intl.DateTimeFormat("fa-IR",{calendar:"persian",timeZone:"UTC",month:"long",year:"numeric"}).format(new Date(n*dayMs));
export function monthStart(year:number,month:number){const g=toGregorian(year,month,1);return Math.floor(Date.UTC(g.gy,g.gm-1,g.gd)/dayMs);}
export function shiftJalaliMonth(n:number,delta:number){const j=jalaliParts(n),i=j.jy*12+j.jm-1+delta,year=Math.floor(i/12),month=((i%12)+12)%12+1;return monthStart(year,month);}
export function parseJalali(value:string){const normalized=value.trim().replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)),match=normalized.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);if(!match)return null;const [,year,month,day]=match.map(Number);if(!isValidJalaaliDate(year,month,day))return null;const g=toGregorian(year,month,day);return new Date(Date.UTC(g.gy,g.gm-1,g.gd)).toISOString().slice(0,10);}
export function inputJalali(value:string){if(!value)return "";const j=jalaliParts(dayIndex(value));return `${j.jy}/${String(j.jm).padStart(2,"0")}/${String(j.jd).padStart(2,"0")}`.replace(/\d/g,digit=>"۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);}
export {jalaaliMonthLength};
