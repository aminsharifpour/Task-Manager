import {projectVisibility} from "../organizations/service.js";
import {readScoped,DomainError,ensureModule,requireInternal,requireSensitive} from "../shared/scoped.js";
import {visibleTasks} from "../tasks/service.js";
const kinds={tasks:"tasks",projects:null,minutes:"minutes",members:null,transactions:"accounting",hr_profiles:"hr",attendance:"hr"};
function queryFor(c,kind){
 if(kind==="tasks")return {model:"task",where:visibleTasks(c),include:{project:{select:{id:true,name:true}}}};
 if(kind==="projects")return {model:"project",where:{...projectVisibility(c)},select:{id:true,name:true,description:true,ownerId:true,status:true,startDate:true,endDate:true,workflowTemplateSteps:true,customFieldDefinitions:true,version:true}};
 requireInternal(c);
 if(kind==="members")return {model:"organizationMembership",key:"userId",where:{organizationId:c.organizationId,status:"active"},select:{userId:true,role:true,user:{select:{fullName:true,roleTitle:true}}}};
 if(kind==="minutes")return {model:"meetingMinute",where:{organizationId:c.organizationId}};
 if(kind==="transactions"){requireSensitive(c,"canManageAccounting");return {model:"accountingTransaction",where:{organizationId:c.organizationId,userId:c.userId}};}
 if(kind==="hr_profiles"){requireSensitive(c,"canManageHr");return {model:"hrProfile",key:"userId",where:{organizationId:c.organizationId},include:{user:{select:{fullName:true}}}};}
 return {model:"hrAttendanceRecord",where:{organizationId:c.organizationId,...(c.canManageHr?{}:{userId:c.userId})},include:{user:{select:{fullName:true}}}};
}
export async function exportOrganization(req,res){const kind=req.query.kind;if(typeof kind!=="string"||!Object.hasOwn(kinds,kind))throw new DomainError(400,"INVALID_EXPORT","نوع خروجی معتبر نیست.");let cursor,count=0,bytes=0;const limit=128*1024*1024;
 const page=async()=>readScoped(req.organization,kinds[kind],async(tx,c)=>{const session=await tx.authSession.findUnique({where:{id:req.auth.sessionId},include:{user:{select:{isActive:true}}}});if(!session||session.userId!==c.userId||session.revokedAt||session.expiresAt<=new Date()||!session.user.isActive)throw new DomainError(401,"SESSION_REVOKED","نشست بسته شده است.");const {model,key="id",where,...options}=queryFor(c,kind);if(kinds[kind])await ensureModule(c,kinds[kind],tx);const items=await tx[model].findMany({where:{...where,...(cursor?{[key]:{gt:cursor}}:{})},take:100,orderBy:{[key]:"asc"},...options});return {items,key};});
 const first=await page();res.set({"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename="${kind}.ndjson"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"});
 const write=async value=>{const line=JSON.stringify(value)+"\n";bytes+=Buffer.byteLength(line);if(bytes>limit)throw new DomainError(413,"EXPORT_SIZE_LIMIT","خروجی از حد ۱۲۸ مگابایت بیشتر است.");if(!res.write(line))await new Promise((resolve,reject)=>{const clean=()=>{res.off("drain",drain);res.off("close",closed);};const drain=()=>{clean();resolve();},closed=()=>{clean();reject(Error("EXPORT_CLOSED"));};res.once("drain",drain);res.once("close",closed);});};
 try{await write({type:"header",format:"shekof-scoped-export-v1",organizationId:req.organization.organizationId,kind,snapshot:false,createdAt:new Date().toISOString()});let result=first;while(result.items.length){if(count+result.items.length>1000000)throw new DomainError(413,"EXPORT_ROW_LIMIT","خروجی بیش از یک میلیون رکورد است.");for(const row of result.items){if(res.destroyed)return;await write({type:"record",data:row});count++;}cursor=result.items.at(-1)[result.key];if(result.items.length<100)break;result=await page();}await write({type:"complete",count});res.end();}catch(error){if(!res.destroyed){res.write(JSON.stringify({type:"error",code:error.code||"EXPORT_FAILED"})+"\n");res.end();}}
}
