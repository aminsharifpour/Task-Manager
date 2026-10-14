import {Button,Tooltip} from "@heroui/react";
import type {ReactNode,ComponentProps} from "react";
export default function TableAction({label,onPress,children,disabled=false,variant="ghost"}:{label:string;onPress:()=>void;children:ReactNode;disabled?:boolean;variant?:ComponentProps<typeof Button>["variant"]}){
 return <Tooltip delay={250}><Tooltip.Trigger><Button className="workspace-table-action" size="sm" isIconOnly aria-label={label} onPress={onPress} isDisabled={disabled} variant={variant}>{children}</Button></Tooltip.Trigger><Tooltip.Content className="workspace-table-tooltip" dir="rtl">{label}</Tooltip.Content></Tooltip>;
}
