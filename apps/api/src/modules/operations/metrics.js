import crypto from "node:crypto";
const buckets=[.01,.025,.05,.1,.25,.5,1,2.5,5,10,30],requests=new Map();
let realtimePolls=0,realtimeErrors=0,realtimeSeconds=0;
export function recordRealtimePoll(seconds,failed=false){realtimePolls++;realtimeSeconds+=seconds;if(failed)realtimeErrors++;}
const category=pathname=>pathname.startsWith("/socket.io")?"socket":pathname.startsWith("/api/organizations/")?"workspace":pathname.startsWith("/api/auth/")?"auth":pathname.startsWith("/api/public/")?"public":pathname.startsWith("/api/")?"api":"web";
export function installMetrics(app){
 app.use((req,res,next)=>{const start=process.hrtime.bigint(),group=category(req.path);res.once("finish",()=>{const seconds=Number(process.hrtime.bigint()-start)/1e9,status=Math.floor(res.statusCode/100)+"xx",key=group+":"+status;let row=requests.get(key);if(!row){row={group,status,count:0,sum:0,buckets:buckets.map(()=>0)};requests.set(key,row);}row.count++;row.sum+=seconds;buckets.forEach((bound,i)=>{if(seconds<=bound)row.buckets[i]++;});});next();});
 app.get("/api/metrics",(req,res)=>{
  const secret=process.env.METRICS_TOKEN;if(!secret||secret.length<32)return res.sendStatus(404);
  const presented=req.get("Authorization")||"",expected="Bearer "+secret;
  const actualHash=crypto.createHash("sha256").update(presented).digest(),expectedHash=crypto.createHash("sha256").update(expected).digest();
  if(!crypto.timingSafeEqual(actualHash,expectedHash))return res.sendStatus(401);
  const lines=["# HELP shekof_http_seconds HTTP request duration without customer identifiers","# TYPE shekof_http_seconds histogram"];
  for(const row of requests.values()){const labels=`category="${row.group}",status="${row.status}"`;buckets.forEach((bound,i)=>lines.push(`shekof_http_seconds_bucket{${labels},le="${bound}"} ${row.buckets[i]}`));lines.push(`shekof_http_seconds_bucket{${labels},le="+Inf"} ${row.count}`,`shekof_http_seconds_count{${labels}} ${row.count}`,`shekof_http_seconds_sum{${labels}} ${row.sum}`);}
  lines.push("# TYPE shekof_realtime_polls_total counter",`shekof_realtime_polls_total ${realtimePolls}`,"# TYPE shekof_realtime_poll_errors_total counter",`shekof_realtime_poll_errors_total ${realtimeErrors}`,"# TYPE shekof_realtime_poll_seconds_total counter",`shekof_realtime_poll_seconds_total ${realtimeSeconds}`,"# TYPE shekof_process_rss_bytes gauge",`shekof_process_rss_bytes ${process.memoryUsage().rss}`,"# TYPE shekof_process_uptime_seconds gauge",`shekof_process_uptime_seconds ${process.uptime()}`);
  res.set("Cache-Control","no-store").type("text/plain; version=0.0.4").send(lines.join("\n")+"\n");
 });
}
