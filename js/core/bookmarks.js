(function(global){
  "use strict";
  class BookmarkStore{
    constructor({key="pokemon-viewer.bookmarks",element,onOpen}={}){this.key=key;this.element=element;this.onOpen=onOpen;this.items=this.load();this.render();}
    load(){try{return JSON.parse(localStorage.getItem(this.key)||"[]");}catch{return[];}}
    save(){localStorage.setItem(this.key,JSON.stringify(this.items));this.render();return this;}
    fields(item={}){return [
      {name:"title",label:"Title",value:item.title||item.target?.title||"Bookmark",required:true,maxLength:80,placeholder:"What do you want to remember?"},
      {name:"description",label:"Description",value:item.description||"",multiline:true,maxLength:240,placeholder:"Optional notes about this location"}
    ];}
    async add(target){
      const values=await AppDialog.form({title:"New bookmark",message:"Save the current editor location for later.",icon:"★",fields:this.fields({target}),submitLabel:"Add bookmark"});
      if(!values)return null;
      const item={id:crypto.randomUUID?.()||`${Date.now()}`,title:values.title,description:values.description,createdAt:new Date().toISOString(),target};
      this.items.unshift(item);this.save();return item;
    }
    async edit(id){
      const item=this.items.find(candidate=>candidate.id===id);if(!item)return null;
      const values=await AppDialog.form({title:"Edit bookmark",message:"The saved editor location will not change.",icon:"✎",fields:this.fields(item),submitLabel:"Save changes"});
      if(!values)return null;
      Object.assign(item,values,{updatedAt:new Date().toISOString()});this.save();return item;
    }
    async remove(id){
      const item=this.items.find(candidate=>candidate.id===id);if(!item)return false;
      const confirmed=await AppDialog.confirm({title:"Remove bookmark?",message:`“${item.title}” will be removed from this browser.`,confirmLabel:"Remove",cancelLabel:"Keep",danger:true});
      if(!confirmed)return false;
      this.items=this.items.filter(candidate=>candidate.id!==id);this.save();return true;
    }
    render(){if(!this.element)return;const list=this.element.querySelector(".bookmark-list"),empty=Dom.create("p",{className:"bookmark-empty",text:"Remember maps, code, events, or offsets here."});list.replaceChildren(...(this.items.length?this.items.map(item=>Dom.create("article",{className:"bookmark-item"},[
      Dom.create("button",{className:"bookmark-open",attributes:{type:"button",title:item.description||item.title},events:{click:()=>this.onOpen?.(item.target)}},[Dom.create("strong",{text:item.title}),item.target?.project?.label?Dom.create("small",{className:"bookmark-project",text:item.target.project.label}):null,item.description?Dom.create("small",{text:item.description}):null].filter(Boolean)),
      Dom.create("div",{className:"bookmark-actions"},[
        Dom.create("button",{className:"bookmark-edit",text:"✎",attributes:{type:"button","aria-label":`Edit ${item.title}`},events:{click:()=>this.edit(item.id)}}),
        Dom.create("button",{className:"bookmark-remove",text:"×",attributes:{type:"button","aria-label":`Remove ${item.title}`},events:{click:()=>this.remove(item.id)}})
      ])
    ])): [empty]));}
  }
  global.BookmarkStore=BookmarkStore;((global.PokemonViewer ||= {}).core ||= {}).BookmarkStore=BookmarkStore;
})(globalThis);
