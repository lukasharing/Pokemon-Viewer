(function(global){
  "use strict";
  class AppDialog{
    static sequence=0;
    static mount(dialog,{focus="button",returnFocus=document.activeElement}={}){
      const heading=dialog.querySelector(".app-dialog__header strong, .app-dialog__body h1, .app-dialog__body h2, form h2"),description=dialog.querySelector(".app-dialog__body > p");
      dialog.setAttribute("aria-modal","true");
      if(heading){heading.id ||= `app-dialog-title-${++this.sequence}`;dialog.setAttribute("aria-labelledby",heading.id);}
      else if(!dialog.hasAttribute("aria-label"))dialog.setAttribute("aria-label","Dialog");
      if(description){description.id ||= `app-dialog-description-${++this.sequence}`;dialog.setAttribute("aria-describedby",description.id);}
      const restore=()=>queueMicrotask(()=>{if(returnFocus?.isConnected&&typeof returnFocus.focus==="function")returnFocus.focus({preventScroll:true});});
      dialog.addEventListener("close",restore,{once:true});
      document.body.append(dialog);dialog.showModal();
      const target=dialog.querySelector(focus)||dialog.querySelector(".app-dialog__close, button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")||dialog;
      if(target===dialog&&!dialog.hasAttribute("tabindex"))dialog.tabIndex=-1;
      target.focus?.({preventScroll:true});return dialog;
    }
    static unmount(dialog){if(dialog.open)dialog.close();dialog.remove();}
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
        let settled=false;const dialog=Dom.create("dialog",{className:"app-dialog"}),finish=value=>{if(settled)return;settled=true;this.unmount(dialog);resolve(value);};
        dialog.append(this.card({title,icon:danger?"!":"?",danger,closable,onClose:()=>finish(null),body:[message?Dom.create("p",{text:message}):null,detail?Dom.create("small",{text:detail}):null].filter(Boolean),footer:choices.map(choice=>UiWindow.button(choice.label,{className:choice.className||"",onClick:event=>{event.preventDefault();finish(choice.value);}}))}));
        dialog.addEventListener("cancel",event=>{event.preventDefault();finish(null);},{once:true});dialog.addEventListener("click",event=>{if(event.target===dialog)finish(null);});this.mount(dialog);
      });
    }
    static controls(fields=[],{className="app-dialog__fields"}={}){
      const inputs={},rows=fields.map(field=>{const tag=field.multiline?"textarea":field.options?"select":"input",attributes={name:field.name,required:field.required?"":null,minlength:field.minLength??null,maxlength:field.maxLength??null,pattern:field.pattern??null,placeholder:field.placeholder??null,min:field.min??null,max:field.max??null,step:field.step??null,inputmode:field.type==="number"?"numeric":null,type:tag==="input"?(field.type||"text"):null};const input=field.options?Dom.create("select",{attributes},field.options.map(option=>Dom.create("option",{text:option.label,attributes:{value:option.value,selected:String(option.value)===String(field.value)?"":null}}))):Dom.create(tag,{text:tag==="textarea"?(field.value??""):"",attributes:{...attributes,value:tag==="input"&&field.type!=="checkbox"?(field.value??""):null,checked:field.type==="checkbox"&&field.value?"":null}});inputs[field.name]=input;return Dom.create("label",{className:`app-dialog__field${field.fullWidth===false?" app-dialog__field--compact":""}${field.type==="checkbox"?" app-dialog__field--checkbox":""}`},[Dom.create("span",{text:field.label}),input,field.hint?Dom.create("small",{text:field.hint}):null].filter(Boolean));});
      const values=()=>Object.fromEntries(fields.map(field=>{const input=inputs[field.name],raw=field.trim===false?input.value:input.value.trim(),value=field.parse?field.parse(raw,input):field.type==="checkbox"?input.checked:field.type==="number"?input.valueAsNumber:field.valueType==="number"?Number(raw):raw;return[field.name,value];}));return{element:Dom.create("div",{className},rows),inputs,values};
    }
    static form({title="Edit details",message="",detail="",icon="✎",fields=[],preview=null,submitLabel="Save",cancelLabel="Cancel",closable=true,protectDirty=true}={}){
      return new Promise(resolve=>{
        let settled=false,dirty=false,confirming=false;const dialog=Dom.create("dialog",{className:"app-dialog app-dialog--form"}),controls=this.controls(fields),finish=value=>{if(settled)return;settled=true;this.unmount(dialog);resolve(value);};
        const requestCancel=async()=>{if(settled||confirming)return;if(!protectDirty||!dirty){finish(null);return;}confirming=true;const discard=await this.confirm({title:"Discard changes?",message:"Your unsaved changes will be lost.",confirmLabel:"Discard changes",cancelLabel:"Keep editing",danger:true});confirming=false;if(discard)finish(null);};
        const submit=event=>{event.preventDefault();const form=dialog.querySelector("form");if(!form.checkValidity()){form.reportValidity();return;}finish(controls.values());};
        const form=Dom.create("form",{attributes:{method:"dialog"},events:{submit,input:()=>{dirty=true;},change:()=>{dirty=true;}}},[this.card({title,icon,closable,onClose:requestCancel,body:[message?Dom.create("p",{text:message}):null,detail?Dom.create("small",{text:detail}):null,preview,controls.element].filter(Boolean),footer:[UiWindow.button(cancelLabel,{onClick:event=>{event.preventDefault();requestCancel();}}),UiWindow.button(submitLabel,{className:"ui-button--primary",onClick:submit})]})]);
        dialog.append(form);dialog.addEventListener("cancel",event=>{event.preventDefault();requestCancel();});dialog.addEventListener("click",event=>{if(event.target===dialog)requestCancel();});this.mount(dialog,{focus:"input, textarea, select"});
      });
    }
    static confirm({title="Confirm action",message="",detail="",confirmLabel="Continue",cancelLabel="Cancel",danger=false,closable=true}={}){return this.choose({title,message,detail,danger,closable,choices:[{value:false,label:cancelLabel},{value:true,label:confirmLabel,className:danger?"ui-button--danger":"ui-button--primary"}]}).then(value=>value===true);}
  }
  global.AppDialog=AppDialog;((global.PokemonViewer ||= {}).core ||= {}).Dialog=AppDialog;
})(globalThis);
