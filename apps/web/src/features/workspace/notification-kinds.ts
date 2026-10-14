import {AtSign,Bell,CheckCircle2,FolderKanban,MessageSquare,ShieldCheck} from "lucide-react";
import type {LucideIcon} from "lucide-react";
import type {Tone} from "./palette";
export const notificationKinds:Record<string,{label:string;tone:Tone;icon:LucideIcon}>={task:{label:"تسک‌ها",tone:"violet",icon:CheckCircle2},project:{label:"پروژه‌ها",tone:"blue",icon:FolderKanban},chat:{label:"گفت‌وگو",tone:"cyan",icon:MessageSquare},mention:{label:"اشاره به من",tone:"coral",icon:AtSign},approval:{label:"تأییدها",tone:"amber",icon:ShieldCheck},system:{label:"سیستم",tone:"neutral",icon:Bell}};
