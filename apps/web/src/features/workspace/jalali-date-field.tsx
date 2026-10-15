import {useState} from "react";
import {Button,Calendar,DateField,DatePicker,Description,FieldError,Label} from "@heroui/react";
import {I18nProvider} from "react-aria-components";
import {I18nProvider as HeroLocaleProvider} from "@react-aria/i18n";
import {GregorianCalendar,PersianCalendar,parseDate,toCalendar} from "@internationalized/date";
import {CalendarDays,ChevronLeft,ChevronRight} from "lucide-react";
import {workspaceToday} from "./dates";
import "./jalali-date-field.css";

const persian=new PersianCalendar(),gregorian=new GregorianCalendar();
function dateValue(value?:string){if(!value)return null;try{return toCalendar(parseDate(value.slice(0,10)),persian);}catch{return null;}}
// HeroUI 3.0.2's year picker uses the separate @react-aria/i18n context;
// provide both contexts so its heading and years match the date segments/grid.
export default function JalaliDateField({label,value,onChange,required=false,disabled=false,min,max}:{label:string;value:string;onChange:(value:string)=>void;required?:boolean;disabled?:boolean;min?:string;max?:string}){
 const [open,setOpen]=useState(false),selected=dateValue(value),minimum=dateValue(min),maximum=dateValue(max),today=dateValue(workspaceToday())!;
 const todayUnavailable=Boolean(minimum&&today.compare(minimum)<0||maximum&&today.compare(maximum)>0);
 return <I18nProvider locale="fa-IR-u-ca-persian-nu-arabext"><HeroLocaleProvider locale="fa-IR-u-ca-persian-nu-arabext"><DatePicker className="workspace-date-picker" value={selected} onChange={date=>onChange(date?toCalendar(date,gregorian).toString():"")} isRequired={required} isDisabled={disabled} minValue={minimum||undefined} maxValue={maximum||undefined} placeholderValue={today} granularity="day" shouldForceLeadingZeros validationBehavior="native" isOpen={open} onOpenChange={setOpen}>
  <Label>{label}</Label>
  <DateField.Group fullWidth><DateField.Input>{segment=><DateField.Segment segment={segment}/>}</DateField.Input><DateField.Suffix><DatePicker.Trigger aria-label={"انتخاب "+label}><DatePicker.TriggerIndicator><CalendarDays size={18}/></DatePicker.TriggerIndicator></DatePicker.Trigger></DateField.Suffix></DateField.Group>
  <Description>تقویم هجری شمسی</Description><FieldError>{({validationDetails})=>validationDetails.valueMissing?"تاریخ را انتخاب کنید.":"تاریخ معتبر و در بازه مجاز انتخاب کنید."}</FieldError>
  <DatePicker.Popover className="workspace-date-popover" placement="bottom end"><Calendar aria-label={"تقویم "+label} firstDayOfWeek="sat"><Calendar.Header><Calendar.YearPickerTrigger aria-label="انتخاب سال"><Calendar.YearPickerTriggerHeading/><Calendar.YearPickerTriggerIndicator/></Calendar.YearPickerTrigger><Calendar.NavButton slot="previous" aria-label="ماه قبل"><ChevronRight size={17}/></Calendar.NavButton><Calendar.NavButton slot="next" aria-label="ماه بعد"><ChevronLeft size={17}/></Calendar.NavButton></Calendar.Header><Calendar.Grid weekdayStyle="narrow"><Calendar.GridHeader>{day=><Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader><Calendar.GridBody>{date=><Calendar.Cell date={date}/>}</Calendar.GridBody></Calendar.Grid><Calendar.YearPickerGrid><Calendar.YearPickerGridBody>{({year})=><Calendar.YearPickerCell year={year}/>}</Calendar.YearPickerGridBody></Calendar.YearPickerGrid></Calendar><div className="workspace-date-actions"><Button type="button" size="sm" variant="tertiary" isDisabled={todayUnavailable} onPress={()=>{onChange(workspaceToday());setOpen(false);}}>امروز</Button>{!required&&<Button type="button" size="sm" variant="ghost" isDisabled={!value} onPress={()=>{onChange("");setOpen(false);}}>پاک کردن</Button>}</div></DatePicker.Popover>
 </DatePicker></HeroLocaleProvider></I18nProvider>;
}
