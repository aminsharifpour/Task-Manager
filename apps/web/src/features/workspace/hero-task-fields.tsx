import {Alert,FieldError,Label,ListBox,Select} from "@heroui/react";
import type {Request} from "./use-module";
import PredictivePicker from "./predictive-picker";
export function TaskSelect({label,value,onChange,options,disabled=false,required=false}:{label:string;value:string;onChange:(value:string)=>void;options:{id:string;name:string}[];disabled?:boolean;required?:boolean}){
 return <Select className="task-select" fullWidth aria-label={label} value={value||null} onChange={value=>onChange(String(value||""))} isDisabled={disabled} isRequired={required} placeholder="انتخاب کنید"><Label>{label}</Label><Select.Trigger><Select.Value/><Select.Indicator/></Select.Trigger><Select.Popover className="task-popover" dir="rtl"><ListBox items={options}>{row=><ListBox.Item id={row.id} textValue={row.name}><Label>{row.name}</Label><ListBox.ItemIndicator/></ListBox.Item>}</ListBox></Select.Popover><FieldError/></Select>;
}
export function TaskMessage({message,error=false}:{message:string;error?:boolean}){return <Alert status={error?"danger":"success"}><Alert.Indicator/><Alert.Content><Alert.Description>{message}</Alert.Description></Alert.Content></Alert>;}
export function TaskPicker({api,resource,label,value,onChange,projectId="",required=false,disabled=false,selfId="",excludeUserId="",currentLabel="گزینه انتخاب‌شده",selfLabel="خودم"}:{api:Request;resource:"projects"|"members"|"tasks";label:string;value:string;onChange:(value:string)=>void;projectId?:string;required?:boolean;disabled?:boolean;selfId?:string;excludeUserId?:string;currentLabel?:string;selfLabel?:string}){
 return <PredictivePicker api={api} resource={resource} label={label} value={value} onChange={onChange}
   projectId={projectId} required={required} disabled={disabled} selfId={selfId} selfLabel={selfLabel}
   excludeId={excludeUserId} currentLabel={currentLabel}
   hideClosedProjects={resource==="projects"} hideCompletedTasks={resource==="tasks"}/>;
}
