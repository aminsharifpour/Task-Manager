import {S3Client,PutObjectCommand,GetObjectCommand,HeadBucketCommand,DeleteObjectCommand,ListObjectsV2Command} from "@aws-sdk/client-s3";
const pattern=/^[0-9a-f]{64}\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i;
export function s3Storage(env=process.env){
 const bucket=env.S3_BUCKET,region=env.S3_REGION||"us-east-1",prefix=(env.S3_PREFIX||"workspace").replace(/\/$/,"");
 if(!bucket||! /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)||! /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(prefix))throw Error("INVALID_S3_CONFIGURATION");
 let endpoint;if(env.S3_ENDPOINT){try{endpoint=new URL(env.S3_ENDPOINT);}catch{throw Error("INVALID_S3_ENDPOINT");}if(endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=="/"||!["https:","http:"].includes(endpoint.protocol))throw Error("INVALID_S3_ENDPOINT");if(endpoint.protocol!=="https:"&&(env.NODE_ENV==="production"||!["127.0.0.1","localhost","[::1]"].includes(endpoint.hostname)))throw Error("S3_HTTPS_REQUIRED");}
 if(Boolean(env.S3_ACCESS_KEY_ID)!==Boolean(env.S3_SECRET_ACCESS_KEY))throw Error("S3_CREDENTIAL_PAIR_REQUIRED");
 const client=new S3Client({region,endpoint:endpoint?.href,forcePathStyle:env.S3_FORCE_PATH_STYLE==="true",maxAttempts:3,requestChecksumCalculation:"WHEN_REQUIRED",...(env.S3_ACCESS_KEY_ID?{credentials:{accessKeyId:env.S3_ACCESS_KEY_ID,secretAccessKey:env.S3_SECRET_ACCESS_KEY}}:{})});
 const keyFor=key=>{if(!pattern.test(key))throw Error("INVALID_STORAGE_KEY");return prefix+"/"+key;};
 const send=command=>client.send(command,{abortSignal:AbortSignal.timeout(30000)});
 return {driver:"s3",
  async health(){await send(new HeadBucketCommand({Bucket:bucket}));},
  async put(key,bytes){const objectKey=keyFor(key);try{await send(new PutObjectCommand({Bucket:bucket,Key:objectKey,Body:bytes,ContentLength:bytes.length,ContentType:"application/octet-stream",IfNoneMatch:"*"}));}catch(error){if(error.$metadata?.httpStatusCode===412){const existing=Error("OBJECT_EXISTS");existing.code="EEXIST";throw existing;}throw Error("S3_WRITE_FAILED");}},
  async get(key,expectedSize){if(!Number.isInteger(expectedSize)||expectedSize<1||expectedSize>20971520)throw Error("FILE_INTEGRITY_ERROR");const object=await send(new GetObjectCommand({Bucket:bucket,Key:keyFor(key)}));if(object.ContentLength!==expectedSize){object.Body?.destroy?.();throw Error("FILE_INTEGRITY_ERROR");}const bytes=Buffer.from(await object.Body.transformToByteArray());if(bytes.length!==expectedSize)throw Error("FILE_INTEGRITY_ERROR");return bytes;},
  async remove(key){await send(new DeleteObjectCommand({Bucket:bucket,Key:keyFor(key)}));},
  async *list(){let continuation;do{const result=await send(new ListObjectsV2Command({Bucket:bucket,Prefix:prefix+"/",ContinuationToken:continuation}));for(const object of result.Contents||[]){const key=object.Key.slice(prefix.length+1);yield {key,byteSize:object.Size,lastModified:object.LastModified,valid:pattern.test(key)};}continuation=result.IsTruncated?result.NextContinuationToken:undefined;if(result.IsTruncated&&!continuation)throw Error("S3_LIST_INCOMPLETE");}while(continuation);},
  close(){client.destroy();}
 };
}
