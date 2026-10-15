import {Button} from "@heroui/react";
import {useState} from "react";
import jalaali from "jalaali-js";
const {jalaaliMonthLength,toGregorian,toJalaali}=jalaali;
import {workspaceToday} from "./dates";
import {jalaliDate} from "./jalali-timeline";
export type TimelineTask={id:string;title:string;startDate:string|null;executionDate:string|null;version:number;status:string};
export function Calendar({tasks,onOpen}:{tasks:TimelineTask[];onOpen?:(task:TimelineTask)=>void}){
 const firstDue=tasks.find(task=>task.executionDate)?.executionDate?.slice(0,10),[anchor,setAnchor]=useState(firstDue||workspaceToday());
 const date=new Date(anchor+"T00:00:00Z"),j=toJalaali(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate());
 const year=j.jy,month=j.jm,g=toGregorian(year,month,1),start=new Date(Date.UTC(g.gy,g.gm-1,g.gd));
 const days=jalaaliMonthLength(year,month),offset=(start.getUTCDay()+1)%7,today=workspaceToday(),number=new Intl.NumberFormat("fa");
 const dayAt=(day:number)=>new Date(Date.UTC(g.gy,g.gm-1,g.gd+day-1)),iso=(day:number)=>dayAt(day).toISOString().slice(0,10),first=iso(1),last=iso(days);
 const outside=tasks.filter(task=>task.executionDate&&(task.executionDate.slice(0,10)<first||task.executionDate.slice(0,10)>last)).length,undated=tasks.filter(task=>!task.executionDate).length;
 const move=(delta:number)=>{const index=year*12+month-1+delta,nextYear=Math.floor(index/12),nextMonth=((index%12)+12)%12+1,next=toGregorian(nextYear,nextMonth,1);setAnchor(new Date(Date.UTC(next.gy,next.gm-1,next.gd)).toISOString().slice(0,10));};
 const monthLabel=new Intl.DateTimeFormat("fa-IR",{calendar:"persian",timeZone:"UTC",year:"numeric",month:"long"}).format(start);
 return <section className="workspace-panel module-create"><div className="module-toolbar"><h3>تقویم موعدها · {monthLabel}</h3><div className="module-actions"><Button type="button" size="sm" variant="outline" onPress={()=>move(-1)}>ماه قبل</Button><Button type="button" size="sm" variant="outline" onPress={()=>setAnchor(today)}>ماه جاری</Button><Button type="button" size="sm" variant="outline" onPress={()=>move(1)}>ماه بعد</Button></div></div><p className="workspace-caption">تسک‌های همین صفحه و فیلتر؛ موعد بدون ساعت با تغییر منطقه زمانی جابه‌جا نمی‌شود.</p><div className="module-calendar-scroll"><table className="module-calendar-month"><caption className="sr-only">{monthLabel}</caption><thead><tr>{["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"].map(day=><th scope="col" key={day}>{day}</th>)}</tr></thead><tbody>{Array.from({length:6},(_,week)=><tr key={week}>{Array.from({length:7},(_,column)=>{const day=week*7+column-offset+1;if(day<1||day>days)return <td key={column} className="module-calendar-empty"/>;const code=iso(day),items=tasks.filter(task=>task.executionDate?.slice(0,10)===code);return <td key={column} className={code===today?"module-calendar-today":""}><time dateTime={code} aria-label={jalaliDate(iso(day),true)}>{number.format(day)}</time>{items.map(task=>onOpen?<Button type="button" variant="ghost" size="sm" className="module-calendar-task" key={task.id} onPress={()=>onOpen(task)}>{task.title}</Button>:<p key={task.id}>{task.title}</p>)}</td>;})}</tr>)}</tbody></table></div>{outside>0&&<p>{number.format(outside)} موعد در ماه‌های دیگر این صفحه است. {firstDue&&<Button type="button" size="sm" variant="ghost" onPress={()=>setAnchor(firstDue)}>ماه اولین موعد</Button>}</p>}{undated>0&&<details><summary>{number.format(undated)} تسک بدون موعد</summary>{tasks.filter(task=>!task.executionDate).map(task=><p key={task.id}>{task.title}</p>)}</details>}</section>;
}
