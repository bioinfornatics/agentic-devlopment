import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const REPO = new URL("../../..", import.meta.url).pathname;
const server = new McpServer({ name: "kg-visualizer", version: "1.0.0" });

server.tool(
  "show_kg_visualizer",
  "Display the Knowledge Graph as interactive Cytoscape.js force graph in a Goose App window",
  { filter: z.string().optional().describe("Filter by entityType e.g. feature, recipe") },
  async ({ filter }) => {
    const mem = await readFile(join(REPO, ".knowledge", "memory.jsonl"), "utf8").catch(() => "");
    const der = await readFile(join(REPO, ".knowledge", "derived.jsonl"), "utf8").catch(() => "");
    const b64 = Buffer.from(mem + der).toString("base64");
    const fStr = filter ? JSON.stringify(filter) : "null";
    const html = buildHTML(b64, fStr);
    return { content: [{ type: "resource" as const, resource: { uri: "kg://visualizer", mimeType: "text/html", text: html } }] };
  }
);

function buildHTML(b64: string, filterJS: string): string {
  const parts: string[] = [];
  parts.push("<!DOCTYPE html><html lang='fr'><head><meta charset='utf-8'><title>Knowledge Graph</title>");
  parts.push("<script src='https://cdn.jsdelivr.net/npm/cytoscape@3.34.0/dist/cytoscape.min.js'></script>");
  parts.push("<script src='https://cdn.jsdelivr.net/npm/cytoscape-fcose@2.2.0/cytoscape-fcose.js'></script>");
  parts.push("<style>body{margin:0;background:#0f1117;color:#e2e8f0;font-family:sans-serif;height:100vh;display:flex;flex-direction:column}");
  parts.push("#hd{padding:8px 16px;background:#1a1f2e;border-bottom:1px solid #2d3748;font-size:12px;color:#90cdf4}");
  parts.push("#cy{flex:1}#info{position:fixed;right:0;top:32px;width:240px;background:#1a1f2e;padding:10px;height:calc(100vh - 32px);overflow:auto;font-size:11px;border-left:1px solid #2d3748}</style></head><body>");
  parts.push("<div id='hd'>Loading KG...</div><div id='cy'></div><div id='info'><em style='color:#718096'>Click a node</em></div>");
  parts.push("<script>cytoscape.use(cytoscapeFcose);");
  parts.push("var COLORS={'harness:recipe':'#4299e1','harness:skill':'#9f7aea','harness:agent':'#48bb78','harness:doc':'#718096','epic':'#f6ad55','feature':'#fc8181','acceptance_criterion':'#68d391','test':'#4fd1c5','code_file':'#b794f4','derived_status':'#e53e3e'};");
  parts.push("var jsonl=atob('" + b64 + "');");
  parts.push("var filter=" + filterJS + ";");
  parts.push("var nodeMap={},rels=[];");
  parts.push("jsonl.split('\n').filter(Boolean).forEach(function(l){try{var d=JSON.parse(l);if(d.type==='entity'&&!nodeMap[d.name])nodeMap[d.name]=d;else if(d.type==='relation')rels.push(d);}catch(e){}});");
  parts.push("var nodes=Object.values(nodeMap).filter(function(n){return !filter||n.entityType===filter;}).map(function(n){return{data:{id:n.name,label:n.name.length>20?n.name.slice(0,18)+'...':n.name,entityType:n.entityType,obs:n.observations,derived:n.derived}};});");
  parts.push("var ids=new Set(nodes.map(function(n){return n.data.id;}));");
  parts.push("var edges=rels.filter(function(r){return ids.has(r.from)&&ids.has(r.to);}).map(function(r,i){return{data:{id:'e'+i,source:r.from,target:r.to,label:r.relationType,derived:r.derived}};});");
  parts.push("document.getElementById('hd').textContent='KG: '+nodes.length+' entities - '+edges.length+' relations';");
  parts.push("var cy=cytoscape({container:document.getElementById('cy'),elements:nodes.concat(edges),");
  parts.push("style:[{selector:'node',style:{'label':'data(label)','font-size':9,'text-valign':'bottom','color':'#a0aec0','background-color':function(n){return COLORS[n.data('entityType')]||'#a0aec0';},'border-width':function(n){return n.data('derived')?2:0;},'border-color':'#f6ad55','border-style':'dashed'}},");
  parts.push("{selector:'edge',style:{'curve-style':'bezier','target-arrow-shape':'triangle','arrow-scale':0.7,'line-color':function(e){return e.data('derived')?'#f6ad55':'#4a5568';},'target-arrow-color':function(e){return e.data('derived')?'#f6ad55':'#4a5568';},'label':'data(label)','font-size':7,'color':'#4a5568','line-style':function(e){return e.data('derived')?'dashed':'solid';}}},");
  parts.push("{selector:':selected',style:{'border-color':'#90cdf4','border-width':3}}],layout:{name:'fcose',quality:'proof',animate:true}});");
  parts.push("cy.on('tap','node',function(e){var d=e.target.data();var obs=(d.obs||[]).map(function(o){return '<div>'+o+'</div>';}).join('');document.getElementById('info').innerHTML='<b style="color:#90cdf4">'+d.id+'</b><br><em style="color:#9f7aea">'+d.entityType+'</em><hr>'+obs;});");
  parts.push("</script></body></html>");
  return parts.join("\n");
}

const transport = new StdioServerTransport();
await server.connect(transport);
