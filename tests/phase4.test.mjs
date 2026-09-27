import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const load = createLoader();
const { renderInquiryEmail } = load("src/lib/server/email/templates.ts");
const { createBrevoProvider } = load("src/lib/server/email/brevo.ts");
const { processEmailDelivery } = load("src/lib/server/email/processor.ts");
const { createEmailHandler } = load("src/lib/server/email/handler.ts");
const id = randomUUID();
const inquiry = {
  id, public_reference: `INQ-${randomUUID()}`, name: '<script>alert("test")</script>',
  email: "client@example.invalid", company: "A & B <partners>", service: "web-applications",
  budget: null, timeline: null, message: '<img src="x" onerror="bad()"> & synthetic message',
};
const config = { from: { email: "sender@example.invalid", name: "Rectasol" }, recipients: ["team@example.invalid"], siteUrl: "https://example.invalid" };
const message = renderInquiryEmail("inquiry_client_v1", inquiry, config);
const key = id;

test("email templates escape user content, include text and keep client content public", () => {
  const client = renderInquiryEmail("inquiry_client_v1", inquiry, config);
  assert.deepEqual(client.to, [inquiry.email]);
  assert.match(client.html, /&lt;script&gt;/);
  assert.doesNotMatch(client.html, /<script>|<img/);
  assert.match(client.text, /web applications/);
  assert.ok(client.text.includes(inquiry.public_reference));
  assert.equal(JSON.stringify(client).includes(inquiry.id), false);
  assert.equal(JSON.stringify(client).includes(inquiry.message), false);
  const admin = renderInquiryEmail("inquiry_admin_v1", inquiry, config);
  assert.deepEqual(admin.to, config.recipients);
  assert.match(admin.html, /&lt;img/);
  assert.doesNotMatch(admin.html, /<img/);
  assert.ok(admin.text.includes(inquiry.message));
  assert.ok(admin.text.includes(`/admin/inquiries/${id}`));
  assert.ok(admin.html.includes("A &amp; B &lt;partners&gt;"));
  assert.match(admin.text, /Budget: Not specified/);
  for (const siteUrl of ["javascript:alert(1)","https://example.invalid/path","https://user:pass@example.invalid"]) {
    assert.throws(() => renderInquiryEmail("inquiry_admin_v1", inquiry, { ...config, siteUrl }));
  }
  assert.throws(() => renderInquiryEmail("arbitrary", inquiry, config));
  assert.throws(() => renderInquiryEmail("inquiry_client_v1", { ...inquiry, email: "x@example.invalid\r\nBcc:other@example.invalid" }, config));
});

test("Brevo adapter uses fixed endpoint, immutable payload, durable key and bounded timeout", async () => {
  let calls = 0;
  const provider = createBrevoProvider("synthetic-key", async (url, options) => {
    calls++;
    assert.equal(url, "https://api.brevo.com/v3/smtp/email");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers["api-key"], "synthetic-key");
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), { sender: message.from, to: message.to.map(email=>({email})),
      subject:message.subject, htmlContent:message.html, textContent:message.text, headers:{idempotencyKey:key} });
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ messageId: "<synthetic-message-id@brevo.com>" });
  });
  assert.deepEqual(await provider.send(message,key), { ok:true, messageId:"<synthetic-message-id@brevo.com>" });
  assert.equal((await provider.send({...message, subject:"bad\r\nheader"},key)).ok,false);
  assert.equal(calls,1);
});

test("provider failures classify retryable 429/5xx and permanent 4xx without leaking bodies", async () => {
  for (const [status,retryable,category] of [[429,true,"rate_limited"],[500,true,"provider_unavailable"],
    [503,true,"provider_unavailable"],[409,false,"provider_rejected"],[422,false,"provider_rejected"],
    [401,false,"provider_rejected"],[403,false,"provider_rejected"]]) {
    const provider = createBrevoProvider("fake", async () => new Response("private provider detail", { status, headers:{"retry-after":"120"} }));
    const result = await provider.send(message,key);
    assert.equal(result.retryable,retryable);
    assert.equal(result.category,category);
    assert.equal(JSON.stringify(result).includes("private"),false);
    if(status===429) assert.equal(result.retryAfter,120);
  }
  const invalidSuccess = createBrevoProvider("fake", async () => Response.json({ unexpected:"private" }));
  assert.equal((await invalidSuccess.send(message,key)).retryable,false);
});

test("provider network errors and actual abort timeout stop for reconciliation", async () => {
  const offline = createBrevoProvider("fake", async () => { throw new Error("private network detail"); });
  assert.deepEqual(await offline.send(message,key),{ok:false,category:"network",retryable:false});
  const timeout = createBrevoProvider("fake", (_url,{signal}) => new Promise((_resolve,reject) => {
    // Keep the test alive; AbortSignal.timeout timers are unref'd by Node.
    const keepAlive = setTimeout(() => reject(new Error("Test timeout failed")),1000);
    signal.addEventListener("abort",()=>{clearTimeout(keepAlive);reject(signal.reason);},{once:true});
  }),5);
  assert.deepEqual(await timeout.send(message,key),{ok:false,category:"timeout",retryable:false});
});

test("provider response reads are bounded and duplicate acknowledgement is ambiguous", async () => {
  const large = createBrevoProvider("fake", async () => new Response("x".repeat(9000)));
  assert.equal((await large.send(message,key)).retryable,false);
  const mismatch = createBrevoProvider("fake", async () => Response.json({code:"duplicate_parameter",message:"private"},{status:409}));
  assert.deepEqual(await mismatch.send(message,key),{ok:false,category:"delivery_uncertain",retryable:false});
});

function workerFixture({ stored = null, result = {ok:true,messageId:"synthetic-id"}, finish = true } = {}) {
  const calls = [];
  const job = { provider:"brevo",id,kind:"inquiry_client_v1",lease_token:randomUUID(),attempts:1,first_attempt_at:new Date().toISOString(),message:stored,inquiry };
  const rpc = async (name,args) => {
    calls.push({name,args});
    if(name==="claim_email_delivery") return job;
    if(name==="prepare_email_delivery") return stored || args.p_message;
    if(name==="finish_email_delivery") return finish;
    assert.fail("Unexpected database operation");
  };
  const provider = {send:async (payload,sendKey)=>{calls.push({name:"send",payload,sendKey});return result;}};
  return {job,rpc,provider,calls};
}

test("worker persists exact message before sending and records successful provider ID", async () => {
  const f=workerFixture();
  assert.deepEqual(await processEmailDelivery(f.rpc,f.provider,config),{outcome:"sent"});
  assert.deepEqual(f.calls.map(c=>c.name),["claim_email_delivery","prepare_email_delivery","send","finish_email_delivery"]);
  assert.equal(f.calls[2].sendKey,key);
  assert.equal(f.calls[3].args.p_message_id,"synthetic-id");
  assert.equal(f.calls[3].args.p_lease,f.job.lease_token);
});

test("worker retry uses saved content despite configuration changes; never sends after lost lease", async () => {
  const stored = {...message,subject:"Frozen subject"};
  const f=workerFixture({stored});
  await processEmailDelivery(f.rpc,f.provider,{...config,from:{email:"changed@example.invalid",name:"Changed"}});
  assert.deepEqual(f.calls[2].payload,stored);
  const lost = workerFixture();
  const rpc = (name,args) => name==="prepare_email_delivery" ? Promise.resolve(null) : lost.rpc(name,args);
  assert.deepEqual(await processEmailDelivery(rpc,lost.provider,config),{outcome:"lease_lost"});
  assert.equal(lost.calls.some(c=>c.name==="send"),false);
  const expired=workerFixture();
  expired.job.first_attempt_at=new Date(Date.now()-24*3600000).toISOString();
  await processEmailDelivery(expired.rpc,expired.provider,config);
  assert.equal(expired.calls.some(c=>c.name==="send"),false);
});

test("failed email attempts persist safe retry instructions without touching accepted inquiry", async () => {
  for (const category of ["network","timeout","rate_limited","provider_unavailable","provider_rejected"]) {
    const f=workerFixture({result:{ok:false,category,retryable:["rate_limited","provider_unavailable"].includes(category),retryAfter:120}});
    const original=structuredClone(inquiry);
    await processEmailDelivery(f.rpc,f.provider,config);
    assert.deepEqual(inquiry,original);
    assert.equal(f.calls.at(-1).args.p_error,category);
    assert.equal(f.calls.at(-1).args.p_retry_after,120);
    assert.equal(f.calls.at(-1).args.p_message_id,null);
  }
  const f=workerFixture({finish:false});
  await assert.rejects(processEmailDelivery(f.rpc,f.provider,config),/Email state unavailable/);
});

test("configuration rejects missing credentials, malformed mailboxes and header injection", () => {
  const names=["BREVO_API_KEY","EMAIL_FROM","EMAIL_FROM_NAME","EMAIL_ADMIN_RECIPIENTS","EMAIL_WORKER_SECRET"];
  const previous=Object.fromEntries(names.map(n=>[n,process.env[n]]));
  const {getEmailConfig,getEmailWorkerSecret}=load("src/lib/server/email/config.ts");
  try {
    for(const n of names) delete process.env[n];
    assert.throws(getEmailConfig,/Email configuration unavailable/);
    assert.throws(getEmailWorkerSecret,/Email processing unavailable/);
    process.env.BREVO_API_KEY="synthetic_"+randomUUID().replaceAll("-","");
    process.env.EMAIL_FROM="sender@example.invalid";
    process.env.EMAIL_FROM_NAME="Rectasol";
    process.env.EMAIL_ADMIN_RECIPIENTS="team@example.invalid,second@example.invalid";
    assert.equal(getEmailConfig().recipients.length,2);
    for(const bad of ["invalid","a@example.invalid\r\nBcc:b@example.invalid","A <a@example.invalid>"]) {
      process.env.EMAIL_FROM=bad;
      assert.throws(getEmailConfig,/Email configuration unavailable/);
    }
  } finally { for(const n of names) { if(previous[n]===undefined)delete process.env[n];else process.env[n]=previous[n]; } }
});

test("missing email configuration never claims a job or calls the provider", async () => {
  const local=createLoader({
    "@/lib/server/email/config":{getEmailConfig:()=>{throw new Error("Email configuration unavailable.");}},
    "@/lib/site-url":{getSiteUrl:()=>"https://example.invalid"},
    "@/lib/server/supabase":{createInquiryClient:()=>assert.fail("Must not claim work")},
    "@/lib/server/email/brevo":{createBrevoProvider:()=>assert.fail("Must not send")},
  });
  await assert.rejects(local("src/lib/server/email/worker.ts").runEmailWorker(),/configuration unavailable/);
});

test("public inquiry acceptance is independent of missing email config and failed email attempts", async () => {
  const persisted=[];
  const local=createLoader({
    "@/lib/server/inquiry-config":{getInquiryConfig:()=>({hashSecret:"synthetic-test-only-".repeat(3)})},
    "@/lib/server/supabase":{createInquiryClient:()=>({rpc:(name,args)=>{
      assert.equal(name,"submit_inquiry");
      persisted.push(structuredClone(args.p_payload));
      return {abortSignal:async()=>({data:{outcome:"created",reference:inquiry.public_reference},error:null})};
    }})},
    "@/lib/server/email/config":{getEmailConfig:()=>assert.fail("Contact submission must not load email config")},
    "@/lib/server/email/brevo":{createBrevoProvider:()=>assert.fail("Contact submission must not call email provider")},
  });
  const post=local("src/lib/server/contact-handler.ts").createContactHandler(local("src/lib/server/inquiries.ts").saveInquiry,"https://example.invalid");
  const response=await post(new Request("https://example.invalid/api/contact",{
    method:"POST",headers:{"content-type":"application/json","idempotency-key":randomUUID()},
    body:JSON.stringify({name:"Synthetic Client",email:"client@example.invalid",service:"web-applications",message:"Synthetic project inquiry for testing."}),
  }));
  assert.equal(response.status,201);
  assert.equal((await response.json()).ok,true);
  const accepted=structuredClone(persisted);
  for(const category of ["timeout","network","rate_limited","provider_unavailable","provider_rejected"]){
    const f=workerFixture({result:{ok:false,category,retryable:category!=="provider_rejected"}});
    await processEmailDelivery(f.rpc,f.provider,config);
    assert.deepEqual(persisted,accepted);
  }
  assert.equal(persisted.length,1);
});

test("worker processes at most one job; empty queue and failed preparation cannot send", async () => {
  let claims=0;
  const idle=await processEmailDelivery(async()=>{claims++;return null;},{send:()=>assert.fail()},config);
  assert.deepEqual(idle,{outcome:"idle"});
  assert.equal(claims,1);
  const f=workerFixture();
  await assert.rejects(processEmailDelivery(async(name,args)=>{
    if(name==="prepare_email_delivery")throw new Error("Database unavailable");
    return f.rpc(name,args);
  },f.provider,config),/Database unavailable/);
  assert.equal(f.calls.some(c=>c.name==="send"),false);
});

test("processing endpoint authenticates, rejects injection and returns no private errors", async () => {
  const secret=randomUUID(); let runs=0;
  const handler=createEmailHandler(()=>secret,async()=>{runs++;});
  const request=(options={})=>new Request("https://example.invalid/api/internal/email/process",{method:"POST",...options});
  assert.equal((await handler(request())).status,401);
  assert.equal((await handler(request({headers:{authorization:"Bearer wrong"}}))).status,401);
  const headers={authorization:`Bearer ${secret}`};
  assert.equal((await handler(request({headers,body:JSON.stringify({to:"attacker@example.invalid"})}))).status,400);
  assert.equal((await handler(new Request("https://example.invalid/api/internal/email/process?job=arbitrary",{method:"POST",headers}))).status,400);
  assert.equal((await handler(request({method:"GET",headers}))).status,400);
  assert.equal((await handler(new Request("https://example.invalid/api/internal/email/process",{method:"POST",headers,body:""}))).status,200);
  assert.equal(runs,1);
  assert.equal((await handler(request({headers}))).status,200);
  assert.equal(runs,2);
  const broken=createEmailHandler(()=>secret,async()=>{throw new Error("private response");});
  const response=await broken(request({headers}));
  assert.equal(response.status,503);
  assert.equal((await response.text()).includes("private"),false);
});

function bodyValidationFixture() {
  let runs=0;
  const handler=createEmailHandler(()=>"synthetic-worker-secret",async()=>{runs++;});
  const request=(body,options={})=>new Request("https://example.invalid/api/internal/email/process",{
    method:"POST",headers:{authorization:"Bearer synthetic-worker-secret"},
    ...(body === undefined ? {} : {body,duplex:"half"}),...options,
  });
  return {handler,request,runs:()=>runs};
}

test("worker accepts absent, empty string and completed empty byte streams",async()=>{
  const f=bodyValidationFixture();
  for(const body of [undefined,"",new ReadableStream({start(c){c.close();}}),
    new ReadableStream({start(c){c.enqueue(new Uint8Array(0));c.close();}})]) {
    assert.equal((await f.handler(f.request(body))).status,200);
  }
  assert.equal(f.runs(),4);
});

test("worker rejects nonempty bytes including BOM, whitespace and NUL",async()=>{
  const f=bodyValidationFixture();
  for(const body of ["{}"," ",new Uint8Array([0]),new Uint8Array([0xef,0xbb,0xbf])]) {
    const response=await f.handler(f.request(body));
    assert.equal(response.status,400);
    assert.deepEqual(await response.json(),{message:"An empty POST request is required."});
  }
  assert.equal(f.runs(),0);
});

test("worker rejects oversized/open streams on their first chunk without waiting for cancellation",{timeout:5000},async()=>{
  for(const size of [1,1024*1024]) {
    const f=bodyValidationFixture();let pulls=0,cancelled=false;
    const stream=new ReadableStream({
      pull(c){pulls++;c.enqueue(new Uint8Array(size));},
      cancel(){cancelled=true;return new Promise(()=>{});},
    },{highWaterMark:0});
    assert.equal((await f.handler(f.request(stream))).status,400);
    assert.equal(pulls,1);
    assert.equal(cancelled,true);
    assert.equal(stream.locked,false);
    assert.equal(f.runs(),0);
  }
});

test("worker bounds slow body reads with a one-second deadline",{timeout:5000},async()=>{
  const f=bodyValidationFixture();let cancelled=false;
  const stream=new ReadableStream({cancel(){cancelled=true;return new Promise(()=>{});}});
  const started=performance.now();
  const response=await f.handler(f.request(stream));
  assert.equal(response.status,400);
  assert.ok(performance.now()-started<3000);
  assert.equal(cancelled,true);
  assert.equal(stream.locked,false);
  assert.equal(f.runs(),0);
});

test("worker bounds an endless sequence of empty chunks",async()=>{
  const f=bodyValidationFixture();let pulls=0;
  const stream=new ReadableStream({pull(c){pulls++;c.enqueue(new Uint8Array(0));}},{highWaterMark:0});
  assert.equal((await f.handler(f.request(stream))).status,400);
  assert.ok(pulls<=16);
  assert.equal(f.runs(),0);
});

test("worker sanitizes failing and locked streams and cancels aborted reads",async()=>{
  const f=bodyValidationFixture();
  const failing=new ReadableStream({pull(c){c.error(new Error("private stream detail"));}},{highWaterMark:0});
  const locked=f.request(new ReadableStream());const reader=locked.body.getReader();
  for(const request of [f.request(failing),locked]) {
    const response=await f.handler(request);
    assert.equal(response.status,400);
    assert.equal(response.headers.get("cache-control"),"no-store");
    assert.deepEqual(await response.json(),{message:"An empty POST request is required."});
  }
  await reader.cancel();reader.releaseLock();
  const controller=new AbortController();
  const pending=f.handler(f.request(new ReadableStream(),{signal:controller.signal}));
  controller.abort();
  assert.equal((await pending).status,400);
  assert.equal(f.runs(),0);
});

test("worker checks authentication, method and query before reading bytes",async()=>{
  const f=bodyValidationFixture();
  for(const kind of ["authorization","method","query"]) {
    let pulls=0;
    const stream=new ReadableStream({pull(){pulls++;}},{highWaterMark:0});
    const request=kind==="query"
      ? new Request("https://example.invalid/api/internal/email/process?job=arbitrary",{
        method:"POST",headers:{authorization:"Bearer synthetic-worker-secret"},body:stream,duplex:"half"})
      : f.request(stream,kind==="method"?{method:"PUT"}:{headers:{authorization:"Bearer wrong"}});
    assert.equal((await f.handler(request)).status,kind==="authorization"?401:400);
    assert.equal(pulls,0);
    assert.equal(request.bodyUsed,false);
    await stream.cancel();
  }
  assert.equal(f.runs(),0);
});

test("admin email status uses the authorized client and only safe delivery columns", async () => {
  const rows=[{kind:"inquiry_client_v1",status:"sent",attempts:1,sent_at:new Date().toISOString()}];
  let allowed=true,reads=0;
  const local=createLoader({"@/lib/server/admin/guard":{requireAdmin:async()=>{
    if(!allowed)throw new Error("Access denied");
    return {client:{from:table=>{
      reads++;assert.equal(table,"email_outbox");
      return {select:columns=>{
        assert.equal(columns,"kind,status,attempts,sent_at");
        return {eq:(column,value)=>{
          assert.equal(column,"inquiry_id");assert.equal(value,id);
          return {order:async()=>({data:rows,error:null})};
        }};
      }};
    }}};
  }}});
  const {getInquiryEmailStatus}=local("src/lib/server/admin/email.ts");
  assert.deepEqual(await getInquiryEmailStatus(id),rows);
  assert.deepEqual(await getInquiryEmailStatus("bad"),[]);
  allowed=false;
  await assert.rejects(getInquiryEmailStatus(id),/Access denied/);
  assert.equal(reads,1);
});

test("Brevo success requires a bounded nonempty messageId; malformed responses never retry", async()=>{
  for(const data of [{messageId:""},{messageId:123},{messageId:"bad\r\nheader"},{messageId:"x".repeat(129)},{}]) {
    const provider=createBrevoProvider("fake",async()=>Response.json(data,{status:201}));
    assert.deepEqual(await provider.send(message,key),{ok:false,category:"delivery_uncertain",retryable:false});
  }
  for(const body of ["invalid JSON",""]) {
    const result=await createBrevoProvider("fake",async()=>new Response(body)).send(message,key);
    assert.equal(result.ok,false);assert.equal(result.retryable,false);
  }
  for(const status of [400,401,403,404,422]) {
    const result=await createBrevoProvider("fake",async()=>new Response("sensitive",{status})).send(message,key);
    assert.deepEqual(result,{ok:false,category:"provider_rejected",retryable:false});
  }
});

test("worker refuses jobs from an unupgraded database before preparing or sending",async()=>{
  const f=workerFixture();delete f.job.provider;
  await assert.rejects(processEmailDelivery(f.rpc,f.provider,config));
  assert.deepEqual(f.calls.map(c=>c.name),["claim_email_delivery"]);
});

test("Brevo maps all configured recipients and bounds Retry-After",async()=>{
  const admin=renderInquiryEmail("inquiry_admin_v1",inquiry,{...config,recipients:["one@example.invalid","two@example.invalid"]});
  const provider=createBrevoProvider("synthetic-key",async(_url,options)=>{
    assert.deepEqual(JSON.parse(options.body).to,[{email:"one@example.invalid"},{email:"two@example.invalid"}]);
    return Response.json({messageId:"<accepted@example.invalid>"},{status:201});
  });
  assert.equal((await provider.send(admin,key)).ok,true);
  for(const [header,expected] of [["99999",3600],["invalid",60],["120",120]]) {
    const result=await createBrevoProvider("fake",async()=>new Response(null,{status:429,headers:{"retry-after":header}})).send(message,key);
    assert.equal(result.retryAfter,expected);
  }
  const result=await createBrevoProvider("fake",async()=>new Response(null,{status:429,headers:{"retry-after":new Date(Date.now()+120000).toUTCString()}})).send(message,key);
  assert.ok(result.retryAfter>=119 && result.retryAfter<=120);
});

test("sender name and key configuration errors are sanitized",()=>{
  const names=["BREVO_API_KEY","EMAIL_FROM","EMAIL_FROM_NAME","EMAIL_ADMIN_RECIPIENTS"];
  const previous=Object.fromEntries(names.map(n=>[n,process.env[n]]));
  const {getEmailConfig}=load("src/lib/server/email/config.ts");
  try {
    Object.assign(process.env,{BREVO_API_KEY:"synthetic-valid-key",EMAIL_FROM:"sender@example.invalid",EMAIL_FROM_NAME:"Rectasol",EMAIL_ADMIN_RECIPIENTS:"team@example.invalid,TEAM@example.invalid"});
    assert.deepEqual(getEmailConfig().from,{email:"sender@example.invalid",name:"Rectasol"});
    assert.equal(getEmailConfig().recipients.length,1);
    for(const name of ["", "Name\r\nBcc: private", "<private>"]) {
      process.env.EMAIL_FROM_NAME=name;
      assert.throws(getEmailConfig,error=>error.message==="Email configuration unavailable.");
    }
    process.env.EMAIL_FROM_NAME="Rectasol";
    process.env.BREVO_API_KEY="private\r\ninjected";
    assert.throws(getEmailConfig,error=>error.message==="Email configuration unavailable.");
  } finally { for(const n of names) { if(previous[n]===undefined)delete process.env[n];else process.env[n]=previous[n]; } }
});
