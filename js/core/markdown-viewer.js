(function(global){
  "use strict";
  class MarkdownViewer {
    static async open(file,{title}={}){
      const response=await fetch(file);if(!response.ok)throw new Error(`Documentation could not be loaded: ${file}`);
      const source=await response.text(),dialog=Dom.create("dialog",{className:"app-dialog app-dialog--document"});
      const close=()=>{dialog.close();dialog.remove();};
      const content=Dom.create("article",{className:"markdown-document"});
      content.append(...this.render(source));
      dialog.append(AppDialog.card({title:title||file.split("/").pop().replace(/\.md$/i,"").replaceAll("_"," "),icon:"fa-book-open",onClose:close,body:content}));
      dialog.addEventListener("cancel",event=>{event.preventDefault();close();},{once:true});
      dialog.addEventListener("click",event=>{if(event.target===dialog)close();});
      dialog.addEventListener("click",event=>{const link=event.target.closest("a[data-doc]");if(!link)return;event.preventDefault();this.open(link.dataset.doc).catch(error=>NotificationHandler.pop("Documentation",error.message,NotificationType.ERROR));});
      return AppDialog.mount(dialog,{focus:".app-dialog__close"});
    }
    static inline(text){
      const fragment=document.createDocumentFragment(),pattern=/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]*\))/g;let cursor=0;
      for(const match of text.matchAll(pattern)){if(match.index>cursor)fragment.append(document.createTextNode(text.slice(cursor,match.index)));const token=match[0];if(token.startsWith("**"))fragment.append(Dom.create("strong",{text:token.slice(2,-2)}));else if(token.startsWith("`"))fragment.append(Dom.create("code",{text:token.slice(1,-1)}));else{const [,label,href]=token.match(/^\[([^\]]+)\]\(([^)]*)\)$/)||[];const attributes={href};if(/(^|\/)doc\/.*\.md(?:#.*)?$/i.test(href)||/^[\w-]+\.md$/i.test(href)){attributes.href="#";attributes["data-doc"]=href.replace(/^\.\//,"");}else attributes.target="_blank";fragment.append(Dom.create("a",{text:label,attributes}));}cursor=(match.index||0)+token.length;}
      if(cursor<text.length)fragment.append(document.createTextNode(text.slice(cursor)));return fragment;
    }
    static render(source){
      const lines=source.replace(/\r/g,"").split("\n"),nodes=[];let index=0;
      const paragraph=items=>Dom.create("p",{},this.inline(items.join(" ").trim()));
      while(index<lines.length){const line=lines[index];if(!line.trim()){index++;continue;}
        if(line.startsWith("```")){const language=line.slice(3).trim(),code=[];index++;while(index<lines.length&&!lines[index].startsWith("```"))code.push(lines[index++]);if(index<lines.length)index++;nodes.push(Dom.create("pre",{dataset:{language}},Dom.create("code",{text:code.join("\n")})));continue;}
        const heading=line.match(/^(#{1,6})\s+(.*)$/);if(heading){nodes.push(Dom.create(`h${heading[1].length}`,{},this.inline(heading[2])));index++;continue;}
        if(/^\s*[-*_]{3,}\s*$/.test(line)){nodes.push(Dom.create("hr"));index++;continue;}
        if(line.startsWith("> ")){const quote=[];while(index<lines.length&&lines[index].startsWith("> "))quote.push(lines[index++].slice(2));nodes.push(Dom.create("blockquote",{},paragraph(quote)));continue;}
        if(/^[-*+]\s+/.test(line)){const list=[];while(index<lines.length&&/^[-*+]\s+/.test(lines[index]))list.push(Dom.create("li",{},this.inline(lines[index++].replace(/^[-*+]\s+/,""))));nodes.push(Dom.create("ul",{},list));continue;}
        if(/^\d+\.\s+/.test(line)){const list=[];while(index<lines.length&&/^\d+\.\s+/.test(lines[index]))list.push(Dom.create("li",{},this.inline(lines[index++].replace(/^\d+\.\s+/,""))));nodes.push(Dom.create("ol",{},list));continue;}
        if(line.includes("|")&&/^\s*\|?\s*:?-{3,}/.test(lines[index+1]||"")){const headers=line.split("|").map(cell=>cell.trim()).filter(Boolean),rows=[];index+=2;while(index<lines.length&&lines[index].includes("|")){const cells=lines[index++].split("|").map(cell=>cell.trim()).filter(Boolean);rows.push(Dom.create("tr",{},cells.map(cell=>Dom.create("td",{},this.inline(cell)))));}nodes.push(Dom.create("table",{},[Dom.create("thead",{},Dom.create("tr",{},headers.map(cell=>Dom.create("th",{},this.inline(cell))))),Dom.create("tbody",{},rows)]));continue;}
        const parts=[];while(index<lines.length&&lines[index].trim()&&!/^(#{1,6})\s+|^```|^[-*+]\s+|^\d+\.\s+|^> /.test(lines[index]))parts.push(lines[index++]);nodes.push(paragraph(parts));
      }
      return nodes;
    }
  }
  global.MarkdownViewer=MarkdownViewer;((global.PokemonViewer ||= {}).core ||= {}).MarkdownViewer=MarkdownViewer;
})(globalThis);
