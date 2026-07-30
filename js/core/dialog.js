(function(global){
  "use strict";
  class AppDialog{
    static mount(dialog,{focus="button"}={}){document.body.append(dialog);dialog.showModal();dialog.querySelector(focus)?.focus();return dialog;}
    static card({title="Dialog",icon="?",danger=false,body,footer=[],closable=true,onClose}={}){
      const close=()=>onClose?.();
      const controls=closable?Dom.create("button",{className:"app-dialog__close",attributes:{type:"button","aria-label":"Close dialog",title:"Close"},events:{click:close}},[UiWindow.icon("×")]):null;
      return Dom.create("section",{className:"app-dialog__card"},[
        Dom.create("header",{className:"app-dialog__header"},[Dom.create("span",{className:`app-dialog__icon${danger?" app-dialog__icon--danger":""}`},[UiWindow.icon(icon)]),Dom.create("strong",{text:title}),controls].filter(Boolean)),
        Dom.create("div",{className:"app-dialog__body"},Array.isArray(body)?body:[body]),
        footer.length?Dom.create("footer",{className:"app-dialog__actions"},footer):null
      ].filter(Boolean));
    }
    static choose({title="Choose an action",message="",detail="",danger=false,choices=[],closable=true}={}){
      return new Promise(resolve=>{
        const dialog=Dom.create("dialog",{className:"app-dialog"}),finish=value=>{dialog.close();dialog.remove();resolve(value);};
        dialog.append(this.card({title,icon:danger?"!":"?",danger,closable,onClose:()=>finish(null),body:[message?Dom.create("p",{text:message}):null,detail?Dom.create("small",{text:detail}):null].filter(Boolean),footer:choices.map(choice=>UiWindow.button(choice.label,{className:choice.className||"",onClick:event=>{event.preventDefault();finish(choice.value);}}))}));
        dialog.addEventListener("cancel",event=>{event.preventDefault();finish(null);},{once:true});dialog.addEventListener("click",event=>{if(event.target===dialog)finish(null);});this.mount(dialog);
      });
    }
    static controls(fields=[],{className="app-dialog__fields"}={}){
      const inputs={},rows=fields.map(field=>{const tag=field.multiline?"textarea":field.options?"select":"input",attributes={name:field.name,required:field.required?"":null,minlength:field.minLength??null,maxlength:field.maxLength??null,pattern:field.pattern??null,placeholder:field.placeholder??null,min:field.min??null,max:field.max??null,step:field.step??null,inputmode:field.type==="number"?"numeric":null,type:tag==="input"?(field.type||"text"):null};const input=field.options?Dom.create("select",{attributes},field.options.map(option=>Dom.create("option",{text:option.label,attributes:{value:option.value,selected:String(option.value)===String(field.value)?"":null}}))):Dom.create(tag,{text:tag==="textarea"?(field.value??""):"",attributes:{...attributes,value:tag==="input"&&field.type!=="checkbox"?(field.value??""):null,checked:field.type==="checkbox"&&field.value?"":null}});inputs[field.name]=input;return Dom.create("label",{className:`app-dialog__field${field.fullWidth===false?" app-dialog__field--compact":""}${field.type==="checkbox"?" app-dialog__field--checkbox":""}`},[Dom.create("span",{text:field.label}),input,field.hint?Dom.create("small",{text:field.hint}):null].filter(Boolean));});
      const values=()=>Object.fromEntries(fields.map(field=>{const input=inputs[field.name],raw=field.trim===false?input.value:input.value.trim(),value=field.parse?field.parse(raw,input):field.type==="checkbox"?input.checked:field.type==="number"?input.valueAsNumber:field.valueType==="number"?Number(raw):raw;return[field.name,value];}));return{element:Dom.create("div",{className},rows),inputs,values};
    }
    static form({title="Edit details",message="",detail="",icon="✎",fields=[],preview=null,submitLabel="Save",cancelLabel="Cancel",closable=true}={}){
      return new Promise(resolve=>{const dialog=Dom.create("dialog",{className:"app-dialog app-dialog--form"}),controls=this.controls(fields),finish=value=>{dialog.close();dialog.remove();resolve(value);},submit=event=>{event.preventDefault();const form=dialog.querySelector("form");if(!form.checkValidity()){form.reportValidity();return;}finish(controls.values());};const form=Dom.create("form",{attributes:{method:"dialog"},events:{submit}},[this.card({title,icon,closable,onClose:()=>finish(null),body:[message?Dom.create("p",{text:message}):null,detail?Dom.create("small",{text:detail}):null,preview,controls.element].filter(Boolean),footer:[UiWindow.button(cancelLabel,{onClick:event=>{event.preventDefault();finish(null);}}),UiWindow.button(submitLabel,{className:"ui-button--primary",onClick:submit})]})]);dialog.append(form);dialog.addEventListener("cancel",event=>{event.preventDefault();finish(null);},{once:true});dialog.addEventListener("click",event=>{if(event.target===dialog)finish(null);});this.mount(dialog,{focus:"input, textarea, select"});});
    }
    static confirm({title="Confirm action",message="",detail="",confirmLabel="Continue",cancelLabel="Cancel",danger=false,closable=true}={}){return this.choose({title,message,detail,danger,closable,choices:[{value:false,label:cancelLabel},{value:true,label:confirmLabel,className:danger?"ui-button--danger":"ui-button--primary"}]}).then(value=>value===true);}
  }
  global.AppDialog=AppDialog;((global.PokemonViewer ||= {}).core ||= {}).Dialog=AppDialog;
})(globalThis);
