import { prisma, text, optionalText, uuid, deny, DomainError, requireInternal, mutate, readScoped, audit, activeMember, idArray, pageRows, manager, ensureModule } from "../shared/scoped.js";
import { hash } from "../files/common.js";
import { messageInclude, messageView } from "./attachment-policy.js";

export async function conversation(c, id, tx = prisma) {
  requireInternal(c);
  const row = await tx.chatConversation.findFirst({ where: { id, organizationId: c.organizationId, participants: { some: { organizationId: c.organizationId, userId: c.userId } } }, include: { participants: { where: { organizationId: c.organizationId }, select: { userId: true, unreadCount: true,user:{select:{fullName:true,avatarUrl:true}} } } } });
  if (!row) deny();
  return row;
}
export async function list(c, q) {
  return readScoped(c,"chat",async(tx,current)=>{
    requireInternal(current);
    const folder=q.folder||"all", member={organizationId:current.organizationId,userId:current.userId};
    if(!["all","inbox","starred","sent","drafts","archive","trash"].includes(folder))throw new DomainError(400,"INVALID_FOLDER","پوشه معتبر نیست.");
    if(["inbox","archive","trash"].includes(folder))member.inboxFolder=folder;
    if(["starred","sent","drafts"].includes(folder))member.inboxFolder={not:"trash"};
    if(folder==="starred")member.isStarred=true;
    if(q.label)member.inboxLabel=text(q.label,"برچسب",40);
    const where={organizationId:current.organizationId,participants:{some:member}};
    if(folder==="drafts")where.AND=[{OR:[{participants:{some:{...member,draftText:{not:""}}}},{uploadedAttachments:{some:{organizationId:current.organizationId,createdById:current.userId,discardedAt:null,messageLinks:{none:{}}}}}]}];
    if(folder==="sent")where.messages={some:{senderId:current.userId,isDeleted:false}};
    const search=optionalText(typeof q.search==="string"?q.search.trim():q.search,"جستجو",200);
    if(search)where.OR=[{title:{contains:search,mode:"insensitive"}},{participants:{some:{user:{fullName:{contains:search,mode:"insensitive"}}}}},{messages:{some:{isDeleted:false,text:{contains:search,mode:"insensitive"}}}}];
    const result=await pageRows("chatConversation",where,q,{orderBy:[{updatedAt:"desc"},{id:"asc"}],include:{participants:{select:{userId:true,user:{select:{fullName:true,avatarUrl:true}}}},messages:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:1,select:{text:true,isDeleted:true,createdAt:true,senderId:true,attachmentLinks:{select:{attachmentId:true}}}}}},tx);
    const mine=await tx.chatConversationMember.findMany({where:{...member,conversationId:{in:result.items.map(r=>r.id)}}});
    result.items=result.items.map(({messages,...row})=>({...row,inbox:inboxView(mine.find(m=>m.conversationId===row.id)),lastMessage:messages[0]?{text:messages[0].isDeleted?"پیام حذف‌شده":messages[0].text||"پیوست",createdAt:messages[0].createdAt,senderId:messages[0].senderId}:null}));
    return result;
  });
}
const inboxView=row=>({isStarred:row?.isStarred||false,folder:row?.inboxFolder||"inbox",label:row?.inboxLabel||null,draftText:row?.draftText||"",unreadCount:row?.unreadCount||0});
export async function detail(c,id){return readScoped(c,"chat",async(tx,current)=>{const room=await conversation(current,id,tx);const mine=await tx.chatConversationMember.findUnique({where:{conversationId_userId:{conversationId:id,userId:current.userId}}});return {...room,inbox:inboxView(mine)};});}
export async function inboxSummary(c){
 return readScoped(c,"chat",async(tx,current)=>{
  requireInternal(current);
  const rows=await tx.chatConversationMember.findMany({where:{organizationId:current.organizationId,userId:current.userId},select:{conversationId:true,inboxFolder:true,isStarred:true,inboxLabel:true,draftText:true,unreadCount:true}});
  const pending=await tx.chatAttachment.groupBy({by:["conversationId"],where:{organizationId:current.organizationId,createdById:current.userId,discardedAt:null,messageLinks:{none:{}},conversation:{participants:{some:{userId:current.userId,organizationId:current.organizationId}}}}});
  const draftIds=new Set(pending.map(r=>r.conversationId));
  return {unread:rows.filter(r=>r.inboxFolder!=="trash").reduce((n,r)=>n+r.unreadCount,0),inbox:rows.filter(r=>r.inboxFolder==="inbox").length,starred:rows.filter(r=>r.inboxFolder!=="trash"&&r.isStarred).length,drafts:rows.filter(r=>r.inboxFolder!=="trash"&&(r.draftText||draftIds.has(r.conversationId))).length,archive:rows.filter(r=>r.inboxFolder==="archive").length,trash:rows.filter(r=>r.inboxFolder==="trash").length,labels:[...new Set(rows.map(r=>r.inboxLabel).filter(Boolean))].sort()};
 });
}
export async function saveInbox(c,id,b){return mutate(c,"chat",async(tx,current)=>{await conversation(current,id,tx);const data={};if(b.isStarred!==undefined){if(typeof b.isStarred!=="boolean")throw new DomainError(400,"INVALID_STAR","وضعیت ستاره معتبر نیست.");data.isStarred=b.isStarred;}if(b.folder!==undefined){if(!["inbox","archive","trash"].includes(b.folder))throw new DomainError(400,"INVALID_FOLDER","پوشه معتبر نیست.");data.inboxFolder=b.folder;}if(b.label!==undefined)data.inboxLabel=optionalText(typeof b.label==="string"?b.label.trim():b.label,"برچسب",40);if(b.draftText!==undefined){if(typeof b.draftText!=="string"||b.draftText.length>10000)throw new DomainError(400,"INVALID_DRAFT","پیش‌نویس معتبر نیست.");data.draftText=b.draftText;}const row=await tx.chatConversationMember.update({where:{conversationId_userId:{conversationId:id,userId:current.userId}},data});if(b.draftText===undefined)await audit(tx,current,"chat.inbox_changed",id);return inboxView(row);});}
export async function create(c, b) {
  requireInternal(c); const type = b.type || "group";
  if (!["direct", "group"].includes(type)) throw new DomainError(400, "INVALID_TYPE", "نوع گفتگو معتبر نیست.");
  const participantIds = idArray([...new Set([c.userId, ...idArray(b.participantIds || [])])]);
  if (participantIds.length < 2 || type === "direct" && participantIds.length !== 2) throw new DomainError(400, "INVALID_PARTICIPANTS", "تعداد اعضای گفتگو معتبر نیست.");
  const title = type === "group" ? text(b.title, "نام گفتگو") : null;
  return mutate(c, "chat", async (tx, current) => {
    requireInternal(current); for (const userId of participantIds) await activeMember(tx, current, userId);
    if(type==="direct"){
      const existing=await tx.chatConversation.findFirst({where:{organizationId:current.organizationId,type:"direct",AND:participantIds.map(userId=>({participants:{some:{userId}}})),participants:{every:{userId:{in:participantIds}}}}});
      if(existing){await tx.chatConversationMember.update({where:{conversationId_userId:{conversationId:existing.id,userId:current.userId}},data:{inboxFolder:"inbox"}});return existing;}
    }
    const row = await tx.chatConversation.create({ data: { id: uuid(), organizationId: current.organizationId, createdById: current.userId, type, title, participants: { create: participantIds.map(userId => ({ id: uuid(), organizationId: current.organizationId, userId })) } } });
    await audit(tx, current, "chat.created", row.id); return row;
  });
}
export async function update(c, id, b) {
  return mutate(c, "chat", async (tx, current) => {
    const row = await conversation(current, id, tx);
    if (row.type !== "group" || row.createdById !== current.userId && !manager(current)) throw new DomainError(403, "PERMISSION_DENIED", "تغییر این گفتگو مجاز نیست.");
    const data = {}; if (b.title !== undefined) data.title = text(b.title, "نام گفتگو");
    if (b.participantIds !== undefined) {
      const ids = idArray(b.participantIds);
      if (!ids.includes(current.userId) || row.createdById && !ids.includes(row.createdById)) throw new DomainError(400, "CREATOR_REQUIRED", "مدیر گفتگو باید در گفتگو باقی بماند.");
      for (const userId of ids) await activeMember(tx, current, userId);
      await tx.chatConversationMember.deleteMany({ where: { organizationId: current.organizationId, conversationId: id, userId: { notIn: ids } } });
      for (const userId of ids) await tx.chatConversationMember.upsert({ where: { conversationId_userId: { conversationId: id, userId } }, create: { id: uuid(), organizationId: current.organizationId, conversationId: id, userId }, update: {} });
    }
    const updated = await tx.chatConversation.update({ where: { id }, data }); await audit(tx, current, "chat.updated", id); return updated;
  });
}
export async function remove(c, id) {
  return mutate(c, "chat", async (tx, current) => {
    const row = await conversation(current, id, tx);
    if (row.createdById !== current.userId && !manager(current)) throw new DomainError(403, "PERMISSION_DENIED", "حذف گفتگو مجاز نیست.");
    if (await tx.chatAttachment.count({ where: { organizationId: current.organizationId, conversationId: id } })) throw new DomainError(409, "CHAT_HAS_FILES", "گفت‌وگو دارای فایل نگهداری‌شده است؛ حذف دائمی در این مرحله مجاز نیست.");
    await tx.chatConversation.delete({ where: { id } }); await audit(tx, current, "chat.deleted", id); return { ok: true };
  });
}
export async function messages(c, id, q) {
  return mutate(c, "chat", async (tx, current) => {
    await conversation(current, id, tx);
    const result = await pageRows("chatMessage", { organizationId: current.organizationId, conversationId: id }, q, { include: messageInclude }, tx);
    result.items = result.items.map(messageView); return result;
  });
}
export async function send(c, id, b) {
  requireInternal(c);
  if (b.attachments?.length) throw new DomainError(409, "FILES_MIGRATION_PENDING", "پیوست قدیمی باید به فایل خصوصی منتقل شود.");
  const attachmentIds = idArray(b.attachmentIds || []).sort();
  if (attachmentIds.length > 5) throw new DomainError(400, "TOO_MANY_ATTACHMENTS", "حداکثر پنج پیوست برای هر پیام مجاز است.");
  const forwardedFromId = optionalText(b.forwardedFromId, "پیام مبدأ", 100);
  const replyToMessageId = optionalText(b.replyToMessageId, "پیام پاسخ", 100);
  if (forwardedFromId && attachmentIds.length) throw new DomainError(400, "INVALID_FORWARD", "پیام فوروارد با پیوست آماده ترکیب نمی‌شود.");
  const content = forwardedFromId ? null : attachmentIds.length ? optionalText(typeof b.text==="string"?b.text.trim():b.text, "پیام", 10000) : text(b.text, "پیام", 10000);
  const mentions = idArray(b.mentionMemberIds || []).sort();
  const clientRequestId = b.idempotencyKey ? text(b.idempotencyKey, "شناسه ارسال", 100) : null;
  if (attachmentIds.length && !clientRequestId) throw new DomainError(400, "IDEMPOTENCY_REQUIRED", "شناسه ارسال پیام پیوست‌دار لازم است.");
  const requestHash = hash(JSON.stringify({ id, content, attachmentIds, forwardedFromId, replyToMessageId, mentions }));
  return mutate(c, "chat", async (tx, current) => {
    const room = await conversation(current, id, tx);
    if (clientRequestId) {
      const receipt = await tx.chatMessage.findUnique({ where: { organizationId_senderId_clientRequestId: { organizationId: current.organizationId, senderId: current.userId, clientRequestId } }, include: messageInclude });
      if (receipt) {
        if (receipt.requestHash !== requestHash) throw new DomainError(409, "IDEMPOTENCY_CONFLICT", "شناسه ارسال قبلاً برای پیام دیگری استفاده شده است.");
        if (receipt.isDeleted) throw new DomainError(409, "MESSAGE_DELETED", "پیام قبلاً حذف شده است.");
        if (receipt.attachmentLinks.length) await ensureModule(current, "files", tx);
        if(!forwardedFromId)await tx.chatConversationMember.updateMany({where:{organizationId:current.organizationId,conversationId:id,userId:current.userId,draftText:typeof b.text==="string"?b.text:""},data:{draftText:""}});
        return messageView(receipt);
      }
    }
    for (const userId of mentions) if (!room.participants.some(m => m.userId === userId)) deny();
    if (replyToMessageId && !await tx.chatMessage.findFirst({ where: { id: replyToMessageId, organizationId: current.organizationId, conversationId: id, isDeleted: false } })) deny();
    let forwarded = null, links = attachmentIds;
    if (forwardedFromId) {
      forwarded = await tx.chatMessage.findFirst({ where: { id: forwardedFromId, organizationId: current.organizationId, isDeleted: false }, include: messageInclude });
      if (!forwarded) deny(); await conversation(current, forwarded.conversationId, tx);
      if (!forwarded.legacyAttachmentsMigratedAt && Array.isArray(forwarded.attachments) && forwarded.attachments.length) throw new DomainError(409, "FILES_MIGRATION_PENDING", "پیوست قدیمی این پیام هنوز منتقل نشده است.");
      links = forwarded.attachmentLinks.map(link => link.attachmentId);
    }
    if (links.length) await ensureModule(current, "files", tx);
    if (attachmentIds.length) {
      const drafts = await tx.chatAttachment.findMany({ where: { id: { in: attachmentIds }, organizationId: current.organizationId, conversationId: id, createdById: current.userId, discardedAt: null, messageLinks: { none: {} } }, select: { id: true } });
      if (drafts.length !== attachmentIds.length) deny();
    }
    const row = await tx.chatMessage.create({ data: { id: uuid(), organizationId: current.organizationId, conversationId: id, senderId: current.userId, text: forwarded?.text || content, replyToMessageId, forwardedFromId, mentions, readByIds: [current.userId], attachments: [], clientRequestId, requestHash: clientRequestId ? requestHash : null } });
    if(!forwardedFromId)await tx.chatConversationMember.updateMany({where:{organizationId:current.organizationId,conversationId:id,userId:current.userId,draftText:typeof b.text==="string"?b.text:""},data:{draftText:""}});
    if (links.length) await tx.chatMessageAttachment.createMany({ data: links.map(attachmentId => ({ organizationId: current.organizationId, messageId: row.id, attachmentId })) });
    await tx.chatConversationMember.updateMany({ where: { organizationId: current.organizationId, conversationId: id, userId: { not: current.userId } }, data: { unreadCount: { increment: 1 } } });
    await tx.chatConversation.update({ where: { id }, data: { updatedAt: new Date() } }); await audit(tx, current, "chat.message_sent", row.id);
    for (const userId of mentions.filter(v => v !== current.userId)) await tx.notification.create({ data: { id: uuid(), organizationId: current.organizationId, userId, kind: "mention", title: "اشاره در گفتگو", conversationId: id, entityId: row.id, entityType: "chat-message", description: "در گفتگوی شما اشاره‌ای ثبت شد." } });
    return messageView(await tx.chatMessage.findUnique({ where: { id: row.id }, include: messageInclude }));
  });
}
async function message(c, id, tx) {
  const row = await tx.chatMessage.findFirst({ where: { id, organizationId: c.organizationId }, include: messageInclude });
  if (!row) deny(); await conversation(c, row.conversationId, tx); return row;
}
export async function editMessage(c, id, b, remove = false) {
  return mutate(c, "chat", async (tx, current) => {
    const row = await message(current, id, tx);
    if (row.senderId !== current.userId || row.isDeleted || Date.now() - row.createdAt.getTime() > 6 * 60 * 60 * 1000) throw new DomainError(403, "MESSAGE_EDIT_DENIED", "ویرایش یا حذف پیام مجاز نیست.");
    const updated = await tx.chatMessage.update({ where: { id }, data: remove ? { isDeleted: true, text: null, attachments: [] } : { text: row.attachmentLinks.length ? optionalText(typeof b.text==="string"?b.text.trim():b.text, "پیام", 10000) : text(b.text, "پیام", 10000), editedAt: new Date() }, include: messageInclude });
    await audit(tx, current, remove ? "chat.message_deleted" : "chat.message_edited", id); return messageView(updated);
  });
}
export async function react(c, id, b) {
  const emoji = text(b.emoji, "واکنش", 16);
  return mutate(c, "chat", async (tx, current) => {
    const row = await message(current, id, tx); if (row.isDeleted) deny();
    const where = { messageId_userId_emoji: { messageId: id, userId: current.userId, emoji } };
    const existing = await tx.chatMessageReaction.findUnique({ where });
    if (existing) await tx.chatMessageReaction.delete({ where }); else await tx.chatMessageReaction.create({ data: { id: uuid(), organizationId: current.organizationId, messageId: id, userId: current.userId, emoji } }); await audit(tx,current,"chat.message_reaction",id); return { ok: true };
  });
}
export async function markRead(c, id) {
  return mutate(c, "chat", async (tx, current) => {
    await conversation(current, id, tx);
    await tx.chatConversationMember.updateMany({ where: { organizationId: current.organizationId, conversationId: id, userId: current.userId }, data: { unreadCount: 0 } });
    const rows = await tx.chatMessage.findMany({ where: { organizationId: current.organizationId, conversationId: id }, orderBy: { createdAt: "desc" }, take: 100 });
    for (const row of rows) if (!(row.readByIds || []).includes(current.userId)) await tx.chatMessage.update({ where: { id: row.id }, data: { readByIds: [...(row.readByIds || []), current.userId] } }); return { ok: true };
  });
}
