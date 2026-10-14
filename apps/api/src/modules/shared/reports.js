import {Prisma} from "@prisma/client";
import {date,DomainError} from "./scoped.js";
export function reportRange(q){const where={};let from,to;if(q.from)from=date(q.from);if(q.to)to=date(q.to);if(from&&to&&to<from)throw new DomainError(400,"INVALID_DATE_RANGE","بازه معتبر نیست.");if(from)where.gte=from;if(to)where.lt=new Date(to.getTime()+86400000);return where;}
export function rangeSQL(q,column){const range=reportRange(q);return Prisma.sql`${range.gte?Prisma.sql`AND ${column}>=${range.gte}`:Prisma.empty} ${range.lt?Prisma.sql`AND ${column}<${range.lt}`:Prisma.empty}`;}
