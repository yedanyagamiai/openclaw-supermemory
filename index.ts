/**
 * openclaw-supermemory — Free, Open-Source Memory Plugin
 * Zero external API dependencies. Uses local SQLite + FTS5.
 * Author: Yedan Yagami | License: MIT
 */
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import Database from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  session_key: string;
  created_at: string;
  metadata: string;
}
const MEMORY_CATEGORIES = [
  "preference","fact","decision","entity","other",
] as const;
type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];
const configSchema = Type.Object({
  dbPath: Type.Optional(Type.String()),
  autoRecall: Type.Optional(Type.Boolean({default:true})),
  autoCapture: Type.Optional(Type.Boolean({default:true})),
  maxRecallResults: Type.Optional(Type.Number({default:5})),
  debug: Type.Optional(Type.Boolean({default:false})),
});
interface PluginConfig {
  dbPath:string; autoRecall:boolean;
  autoCapture:boolean; maxRecallResults:number; debug:boolean;
}
function parseConfig(raw:Record<string,unknown>):PluginConfig {
  const home=process.env.HOME||process.env.USERPROFILE||"/tmp";
  return {
    dbPath:(raw.dbPath as string)||join(home,".openclaw","supermemory","memories.db"),
    autoRecall:raw.autoRecall!==false,
    autoCapture:raw.autoCapture!==false,
    maxRecallResults:Number(raw.maxRecallResults)||5,
    debug:Boolean(raw.debug),
  };
}
function detectCategory(text:string):MemoryCategory {
  const l=text.toLowerCase();
  if(/\bprefer|like|love|hate|want|enjoy|dislike|favorite\b/.test(l)) return "preference";
  if(/\bdecided|will use|going with|chose|picked|switched to\b/.test(l)) return "decision";
  if(/\+\d{10,}|@[\w.-]+\.\w+|is called|named|lives in|works at\b/.test(l)) return "entity";
  if(/\bis\b|\bare\b|\bhas\b|\bhave\b|\bwas\b|\bwere\b/.test(l)) return "fact";
  return "other";
}
class LocalMemoryStore {
  private db:InstanceType<typeof Database>;
  constructor(dbPath:string) {
    const dir=dbPath.substring(0,dbPath.lastIndexOf("/"));
    if(dir&&!existsSync(dir)){mkdirSync(dir,{recursive:true});}
    this.db=new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.init();
  }
  private init():void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        session_key TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        metadata TEXT NOT NULL DEFAULT '{}'
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content, content=memories, content_rowid=rowid
      );
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid,content) VALUES(new.rowid,new.content);
      END;
      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts,rowid,content) VALUES('delete',old.rowid,old.content);
      END;
      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts,rowid,content) VALUES('delete',old.rowid,old.content);
        INSERT INTO memories_fts(rowid,content) VALUES(new.rowid,new.content);
      END;
      CREATE INDEX IF NOT EXISTS idx_cat ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_sess ON memories(session_key);
      CREATE INDEX IF NOT EXISTS idx_time ON memories(created_at);
    `);
  }
  store(content:string,category:MemoryCategory,sessionKey:string,metadata:Record<string,unknown>={}):Memory {
    const id=`mem_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now=new Date().toISOString();
    const metaJson=JSON.stringify(metadata);
    this.db.prepare(
      `INSERT INTO memories(id,content,category,session_key,created_at,metadata) VALUES(?,?,?,?,?,?)`
    ).run(id,content,category,sessionKey,now,metaJson);
    return {id,content,category,session_key:sessionKey,created_at:now,metadata:metaJson};
  }
  search(query:string,limit:number=5):Memory[] {
    if(!query.trim()) return [];
    const ftsQ=query.replace(/[^\w\s]/g," ").split(/\s+/)
      .filter((w)=>w.length>1).map((w)=>"\""+w+"\"").join(" OR ");
    if(!ftsQ) return [];
    try {
      return this.db.prepare(
        `SELECT m.id,m.content,m.category,m.session_key,m.created_at,m.metadata
         FROM memories m JOIN memories_fts fts ON m.rowid=fts.rowid
         WHERE memories_fts MATCH ? ORDER BY rank LIMIT ?`
      ).all(ftsQ,limit) as Memory[];
    } catch {
      return this.db.prepare(
        `SELECT id,content,category,session_key,created_at,metadata
         FROM memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?`
      ).all("%"+query+"%",limit) as Memory[];
    }
  }
  close(): void { this.db.close(); }
}
function extractMemorableContent(text:string):string[] {
  const memories:string[]=[];
  const cleaned=text
    .replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>/g,"")
    .replace(/<s>[\s\S]*?<\/system>/g,"").trim();
  if(!cleaned||cleaned.length<20) return memories;
  const sentences=cleaned.split(/[.!?\n]+/)
    .map(s=>s.trim()).filter(s=>s.length>15&&s.length<500);
  const patterns=[
    /\b(?:my|i|we|our)\b.*\b(?:name|live|work|born|prefer|like|use|decided|chose|favorite|email|phone|project|team|company)\b/i,
    /\b(?:always|never|usually|every)\b/i,
    /\b(?:remember|note|important|key|critical)\b/i,
    /\b(?:is called|works at|lives in|born in|graduated from)\b/i,
    /\b(?:prefer|enjoy|dislike|love|hate)\b.*\b(?:to|ing)\b/i,
    /\b(?:switched to|started using|stopped using|migrated to)\b/i,
    /\b(?:deadline|due|scheduled|meeting|appointment)\b/i,
  ];
  for(const s of sentences){
    if(patterns.some(p=>p.test(s))){memories.push(s);}
  }
  return [...new Set(memories)].slice(0,5);
}
const superMemoryPlugin = {
  id:"openclaw-supermemory",
  name:"SuperMemory",
  description:"Free, open-source memory plugin for OpenClaw. Local SQLite — no API keys, no paid plans.",
  kind:"memory" as const,
  configSchema,
  register(api:OpenClawPluginApi) {
    const cfg=parseConfig(api.pluginConfig??{});
    const store=new LocalMemoryStore(cfg.dbPath);
    let currentSessionKey="";
    const getSessionKey=()=>currentSessionKey;
    const log={
      info:(msg:string)=>api.logger.info(`supermemory: ${msg}`),
      warn:(msg:string)=>api.logger.warn(`supermemory: ${msg}`),
      error:(msg:string,err?:unknown)=>{
        const d=err instanceof Error?err.message:err?String(err):"";
        api.logger.error(`supermemory: ${msg}${d?` — ${d}`:""}`);
      },
      debug:(msg:string)=>{if(cfg.debug)api.logger.info(`supermemory [debug]: ${msg}`);},
    };
    api.registerTool(()=>[
      {
        name:"memory_search",
        description:"Search your local memory store for relevant information.",
        parameters:{type:"object",properties:{
          query:{type:"string",description:"Search query"},
          limit:{type:"number",description:"Max results (default:5)"}
        },required:["query"]},
        async execute({query,limit}:{query:string;limit?:number}){
          log.debug(`search: "${query}"`);
          const results=store.search(query,limit||cfg.maxRecallResults);
          return {results:results.map(m=>({id:m.id,content:m.content,category:m.category,created_at:m.created_at})),total:results.length,query};
        },
      },
      {
        name:"memory_store",
        description:"Store information in your local memory.",
        parameters:{type:"object",properties:{
          content:{type:"string",description:"The information to remember"},
          category:{type:"string",enum:[...MEMORY_CATEGORIES],description:"Category"}
        },required:["content"]},
        async execute({content,category}:{content:string;category?:MemoryCategory}){
          const cat=category||detectCategory(content);
          const mem=store.store(content,cat,getSessionKey());
          return {success:true,id:mem.id,category:cat};
        },
      },
      {
        name:"memory_forget",
        description:"Delete memories by ID or keyword.",
        parameters:{type:"object",properties:{
          target:{type:"string",description:"Memory ID or keyword"}
        },required:["target"]},
        async execute({target}:{target:string}){
          const deleted=store.forget(target);
          return {success:deleted>0,deleted};
        },
      },
      {
        name:"memory_profile",
        description:"Show memory stats: total, categories, DB size.",
        parameters:{type:"object",properties:{}},
        async execute(){
          const p=store.profile();
          return {total:p.total,categories:p.byCategory,dbSizeKB:p.dbSizeKB,
            recent:p.recent.map(m=>({id:m.id,content:m.content.slice(0,120),category:m.category,created_at:m.created_at}))};
        },
      },
    ],{names:["memory_search","memory_store","memory_forget","memory_profile"]});
    if(cfg.autoRecall){
      api.on("before_agent_start",
        (event:Record<string,unknown>,
         ctx:Record<string,unknown>)=>{
        if(ctx.sessionKey)
          currentSessionKey=ctx.sessionKey as string;
        try{
          const msgs=event.messages as
            Array<{role:string;content:string}>|undefined;
          if(!msgs||msgs.length===0) return event;
          const last=[...msgs].reverse()
            .find(m=>m.role==="user");
          if(!last?.content) return event;
          const q=typeof last.content==="string"
            ?last.content.slice(0,200):"";
          if(!q.trim()) return event;
          const results=store.search(q,cfg.maxRecallResults);
          if(results.length===0) return event;
          const block=results.map(m=>
            `- [${m.category}] ${m.content}`
          ).join("\n");
          const inj=`<supermemory-context>\n${block}\n</supermemory-context>`;
          if(msgs[0]?.role==="system"){
            msgs[0].content+=`\n\n${inj}`;
          }else{
            msgs.unshift({role:"system",content:inj});
          }
          return {...event,messages:msgs};
        }catch(err){
          log.error("recall failed",err);
          return event;
        }
      });
    }
    if(cfg.autoCapture){
      api.on("agent_end",(event:Record<string,unknown>)=>{
        try{
          const msgs=event.messages as
            Array<{role:string;content:string}>|undefined;
          if(!msgs||msgs.length===0) return;
          const txt=msgs
            .filter(m=>m.role==="user"||m.role==="assistant")
            .map(m=>typeof m.content==="string"?m.content:"")
            .join("\n");
          const items=extractMemorableContent(txt);
          for(const item of items){
            const cat=detectCategory(item);
            const existing=store.search(item,1);
            if(existing.length>0&&
              existing[0].content.toLowerCase()===item.toLowerCase())
              continue;
            store.store(item,cat,getSessionKey());
          }
        }catch(err){log.error("capture failed",err);}
      });
    }
    api.registerService({
      id:"openclaw-supermemory",
      start:()=>{
        const p=store.profile();
        log.info(`initialized (${p.total} memories, ${p.dbSizeKB}KB)`);
      },
      stop:()=>{store.close();log.info("stopped");},
    });
  },
};

export default superMemoryPlugin;
