(function(global){
  "use strict";

  const WORKSPACE_LABELS=Object.freeze({
    hex_editor:"Hex",profile_workspace:"Profile & resources",code_workspace:"Code",
    map_editor:"Map",sprite_editor:"Sprite",battle_editor:"Battle",
    pokedex_editor:"Pokédex",move_editor:"Moves",sound_editor:"Sound",
    animation_editor:"Animation",encounter_editor:"Encounters",item_editor:"Items",
    emulator_editor:"Emulator"
  });
  const hex=value=>Number.isInteger(value)?`0x${value.toString(16).toUpperCase()}`:"—";
  const valueOrDash=value=>value==null||value===""?"—":String(value);
  const percent=(value,total)=>total>0?`${Math.round(value/total*100)}%`:"—";
  const precisePercent=value=>{
    const number=Number(value);
    if(!Number.isFinite(number))return "—";
    const digits=number>=10?1:number>=1?2:number>=0.1?3:4;
    return `${number.toFixed(digits)}%`;
  };
  const formatBytes=value=>{
    const bytes=Number(value);
    if(!Number.isFinite(bytes))return "—";
    if(bytes<1024)return `${bytes} B`;
    if(bytes<1024**2)return `${(bytes/1024).toFixed(1)} KiB`;
    return `${(bytes/1024**2).toFixed(2)} MiB`;
  };
  const stateBadge=capability=>Dom.create("span",{
    className:`profile-state profile-state--${capability.state||"unavailable"}`,
    text:capability.label||"Unavailable"
  });
  const textCell=value=>Dom.create("span",{text:valueOrDash(value)});
  const emptyState=message=>Dom.create("p",{className:"profile-empty",text:message});

  class ProfileWorkspace{
    constructor(reader){
      this.reader=reader;
      this.root=Dom.byId("profile_workspace");
      this.scope=new EventScope();
      this.elements={
        accuracy:Dom.byId("profile_accuracy"),name:Dom.byId("profile_name"),
        summary:Dom.byId("profile_summary"),counts:Dom.byId("profile_counts"),
        tabs:Dom.byId("profile_tabs"),capabilities:Dom.byId("profile_capabilities"),
        resources:Dom.byId("profile_resources"),symbols:Dom.byId("profile_symbols"),
        symbolFilter:Dom.byId("profile_symbol_filter"),identity:Dom.byId("profile_identity"),
        provenance:Dom.byId("profile_provenance"),manifestNote:Dom.byId("profile_manifest_note"),
        exportManifest:Dom.byId("profile_export_manifest"),removeManifest:Dom.byId("profile_remove_manifest")
      };
      this.selectedTab="capabilities";
      this.scope.listen(this.elements.tabs,"click",event=>{
        const button=event.target.closest("[data-profile-tab]");
        if(button)this.selectTab(button.dataset.profileTab);
      });
      this.scope.listen(this.elements.tabs,"keydown",event=>this.onTabKey(event));
      this.scope.listen(this.elements.symbolFilter,"input",()=>this.renderSymbols());
      this.scope.listen(this.elements.exportManifest,"click",()=>this.exportManifest());
      this.scope.listen(this.elements.removeManifest,"click",()=>this.removeManifest());
      this.scope.listen(document,"editorpreferencechange",()=>this.render());
      this.scope.listen(document,"resourcegraphchange",()=>this.render());
      this.scope.listen(document,"profilecapabilitychange",()=>this.render());
      this.render();
    }

    get nerd(){return global.editorPreferences?.experience==="nerd";}
    get profile(){return this.reader.memoryProfile;}
    get provenance(){return this.reader.capabilities?.provenance||{};}

    render(){
      this.renderOverview();
      this.renderIdentity();
      this.renderCapabilities();
      this.renderResources();
      this.renderSymbols();
      this.selectTab(this.selectedTab,{focus:false});
      this.root.dispatchEvent(new CustomEvent("profileviewchange",{bubbles:true,detail:{tab:this.selectedTab}}));
      return this;
    }

    renderOverview(){
      const info=this.reader.romInfo||{},profile=this.profile,provenance=this.provenance;
      const workspaces=CapabilityManifest.WORKSPACES;
      const writable=workspaces.filter(id=>this.reader.capabilities?.get?.(id)?.writable).length;
      const graphCoverage=this.reader.resourceGraph?.coverage?.(this.reader.size)||null;
      const origin=profile?.manifestOrigin==="project"?"Project manifest":profile?.manifestOrigin==="bundled"?"Bundled exact manifest":"Header-selected engine";
      this.elements.accuracy.textContent=profile?.verified?"Verified stock reference":profile?.exact?"Exact project identity":"Engine only";
      this.elements.accuracy.className=`profile-state profile-state--${profile?.verified?"verified":profile?.exact?"partial":"research"}`;
      this.elements.name.textContent=info.name||`${valueOrDash(this.reader.type)} project`;
      this.elements.summary.textContent=`${origin}. Semantic editors remain independently gated by their own operation evidence.`;
      this.elements.counts.replaceChildren(
        this.metric(
          "ROM safely editable",
          graphCoverage?precisePercent(graphCoverage.writablePercent):"—",
          graphCoverage
            ?`${formatBytes(graphCoverage.writableBytes)} of ${formatBytes(graphCoverage.romBytes)} belong to unique, verified semantic write ranges. Raw Hex editing is intentionally excluded.`
            :"No verified semantic writer ranges have been loaded yet. Open an editor to build its exact resource graph."
        ),
        this.metric(
          "ROM understood",
          graphCoverage?precisePercent(graphCoverage.modeledPercent):"—",
          graphCoverage
            ?`${formatBytes(graphCoverage.modeledBytes)} of ${formatBytes(graphCoverage.romBytes)} are covered by unique verified resource or reference ranges.`
            :"No verified resource graph has been loaded yet."
        ),
        this.metric(
          "Writable resources",
          graphCoverage?percent(graphCoverage.writableNodes,graphCoverage.verifiedNodes):"—",
          graphCoverage
            ?`${graphCoverage.writableNodes}/${graphCoverage.verifiedNodes} verified resource nodes expose at least one proven write range or writable reference.`
            :"Load a semantic editor to enumerate resources."
        ),
        this.metric("Writable systems",percent(writable,workspaces.length),`${writable}/${workspaces.length} workspaces authorize at least one verified write path`)
      );
      this.elements.exportManifest.disabled=profile?.manifestOrigin!=="project";
      this.elements.removeManifest.disabled=profile?.manifestOrigin!=="project";
      const note=profile?.manifestOrigin==="project"
        ?"This browser has an exact source manifest for the loaded fingerprint. Removing it reloads the ROM and closes every capability that depended on its symbols."
        :profile?.manifestOrigin==="bundled"
          ?"This exact reference manifest ships with PUSH. It cannot be removed or shadowed by browser project data."
          :"No exact source manifest is active. Import a JSON manifest or .sym/.map file from the File menu to identify semantic resources.";
      this.elements.manifestNote.replaceChildren(Dom.create("h2",{text:"Manifest policy"}),Dom.create("p",{text:note}));
      if(this.nerd&&provenance.reference)this.elements.manifestNote.append(Dom.create("small",{text:`Reference: ${provenance.reference}`}));
    }

    metric(label,value,title){
      return Dom.create("span",{className:"profile-metric",attributes:{title}},[
        Dom.create("strong",{text:value}),Dom.create("small",{text:label})
      ]);
    }

    renderIdentity(){
      const info=this.reader.romInfo||{},profile=this.profile,provenance=this.provenance;
      const identity={
        Game:info.name||this.reader.type,
        Platform:info.platform||this.reader.family,
        Language:String(this.reader.lang||info.lang||"").toUpperCase(),
        Revision:this.reader.version,
        "Engine profile":profile?.engineProfile,
        "ROM size":formatBytes(this.reader.size),
        "Exact source identity":profile?.exact?"Yes":"No",
        "Stock operation audit":profile?.verified?"Yes":"No",
        Fingerprint:this.reader.fingerprint
      };
      const source={
        Origin:profile?.manifestOrigin||"engine selection",
        Repository:provenance.repository,
        Commit:provenance.commit,
        Build:provenance.build,
        "Manifest schema":provenance.manifestVersion,
        Reference:provenance.reference
      };
      this.renderProperties(this.elements.identity,identity,new Set(["Engine profile","ROM size","Fingerprint"]));
      this.renderProperties(this.elements.provenance,source,new Set(["Commit","Build","Manifest schema","Reference"]));
    }

    renderProperties(root,values,advanced){
      root.replaceChildren(...Object.entries(values)
        .filter(([,value])=>value!=null&&value!=="")
        .flatMap(([key,value])=>{
          const attributes=advanced.has(key)?{"data-complexity":"advanced"}:{};
          return[Dom.create("dt",{text:key,attributes}),Dom.create("dd",{text:valueOrDash(value),attributes})];
        }));
    }

    renderCapabilities(){
      const rows=CapabilityManifest.WORKSPACES.map(id=>{
        const capability=this.reader.capabilities?.get?.(id)||{};
        const requirements=capability.resourceRequirements||{};
        const required=requirements.required||[];
        const missing=requirements.missing||[];
        return{
          id,label:WORKSPACE_LABELS[id]||id,state:capability.state||"unavailable",
          capability,writable:Boolean(capability.writable),
          resources:(capability.resources||[]).map(resource=>resource.id),
          required,missing,optional:requirements.missingOptional||[],
          coverage:required.length-required.filter(resource=>missing.includes(resource)).length
        };
      });
      const columns=[
        {id:"label",label:"Editor",sortable:true},
        {id:"state",label:"Status",sortable:true,sortValue:row=>row.capability.state,render:row=>stateBadge(row.capability)},
        {id:"writable",label:"Write",sortable:true,sortValue:row=>Number(row.writable),render:row=>textCell(row.writable?"Enabled":"Read-only")},
        {id:"coverage",label:"Required coverage",sortable:true,sortValue:row=>row.required.length?row.coverage/row.required.length:-1,render:row=>textCell(row.required.length?percent(row.coverage,row.required.length):"No roots required")},
        {id:"resources",label:"Exact resources",sortable:true,sortValue:row=>row.resources.join(" "),render:row=>textCell(row.resources.join(", ")||"None required")},
        {id:"missing",label:"Missing required",sortable:true,sortValue:row=>row.missing.join(" "),render:row=>textCell(row.missing.join(", ")||"—")}
      ];
      if(this.nerd)columns.push({id:"reason",label:"Evidence boundary",sortable:false,render:row=>textCell(row.capability.reason)});
      this.mountTable(this.elements.capabilities,{columns,rows,label:"Editor capabilities",initialSort:{id:"label",direction:"asc"}});
    }

    renderResources(){
      const resources=Object.entries(this.profile?.resources||{}).map(([id,definition])=>{
        const usedBy=CapabilityManifest.WORKSPACES.filter(workspace=>{
          const requirement=this.reader.capabilities?.get?.(workspace)?.resourceRequirements;
          return requirement?.required?.includes(id)||requirement?.optional?.includes(id);
        });
        const symbols=definition.symbols||[];
        return{
          id,coverage:definition.coverage||"Unspecified",symbols,notes:definition.notes||"",usedBy,
          resolved:symbols.filter(name=>Boolean(this.profile?.symbols?.[name])).length
        };
      });
      if(!resources.length){
        this.elements.resources.replaceChildren(emptyState("No exact semantic resources are registered for this ROM fingerprint."));
        return;
      }
      const columns=[
        {id:"id",label:"Resource",sortable:true},
        {id:"coverage",label:"Coverage",sortable:true},
        {id:"resolved",label:"Roots resolved",sortable:true,sortValue:row=>row.symbols.length?row.resolved/row.symbols.length:0,render:row=>textCell(percent(row.resolved,row.symbols.length))},
        {id:"symbols",label:"Symbols",sortable:true,sortValue:row=>row.symbols.length,render:row=>textCell(row.symbols.length)},
        {id:"usedBy",label:"Used by",sortable:true,sortValue:row=>row.usedBy.join(" "),render:row=>textCell(row.usedBy.map(id=>WORKSPACE_LABELS[id]||id).join(", ")||"Not yet connected")}
      ];
      if(this.nerd)columns.push({id:"roots",label:"Source roots",sortable:false,render:row=>textCell(row.symbols.join(", "))});
      this.mountTable(this.elements.resources,{columns,rows:resources,label:"Exact manifest resources",initialSort:{id:"id",direction:"asc"}});
    }

    renderSymbols(){
      const query=this.elements.symbolFilter.value.trim().toLowerCase();
      const memberships=new Map();
      for(const [resource,definition] of Object.entries(this.profile?.resources||{})){
        for(const name of definition.symbols||[]){
          const list=memberships.get(name)||[];list.push(resource);memberships.set(name,list);
        }
      }
      const symbols=Object.entries(this.profile?.symbols||{}).map(([name,symbol])=>({
        name,...symbol,resources:memberships.get(name)||[]
      })).filter(symbol=>!query||[
        symbol.name,symbol.resources.join(" "),symbol.origin||"",symbol.kind||"",hex(symbol.offset),hex(symbol.address),String(symbol.bank??"")
      ].some(value=>value.toLowerCase().includes(query)));
      if(!symbols.length){
        this.elements.symbols.replaceChildren(emptyState(query?"No source symbols match this filter.":"No exact source symbols are registered for this ROM fingerprint."));
        return;
      }
      const columns=[
        {id:"name",label:"Symbol",sortable:true},
        {id:"resources",label:"Resource",sortable:true,sortValue:row=>row.resources.join(" "),render:row=>textCell(row.resources.join(", ")||"Incomplete")},
        {id:"origin",label:"Origin",sortable:true,render:row=>textCell(row.origin==="manual"?"Manual":"Source build")}
      ];
      if(this.nerd)columns.push(
        {id:"offset",label:"ROM offset",sortable:true,sortValue:row=>row.offset,render:row=>textCell(hex(row.offset))},
        {id:"extent",label:"Extent",sortable:true,sortValue:row=>row.extent??-1,render:row=>textCell(Number.isInteger(row.extent)?String(row.extent):"—")},
        {id:"bank",label:"Bank",sortable:true,sortValue:row=>row.bank??-1,render:row=>textCell(Number.isInteger(row.bank)?hex(row.bank):"—")},
        {id:"address",label:"Address",sortable:true,sortValue:row=>row.address??-1,render:row=>textCell(hex(row.address))},
        {id:"kind",label:"Kind",sortable:true},
        {id:"format",label:"Format",sortable:true}
      );
      this.mountTable(this.elements.symbols,{columns,rows:symbols,label:"Exact source symbols",initialSort:{id:"name",direction:"asc"}});
    }

    mountTable(root,options){
      const table=new UiTable({...options,sortable:true,className:"profile-data-table"});
      root.replaceChildren(table.element);
      return table;
    }

    selectTab(id,{focus=true}={}){
      const target=this.root.querySelector(`[data-profile-view="${id}"]`);
      const button=this.elements.tabs.querySelector(`[data-profile-tab="${id}"]`);
      if(!target||!button)return false;
      this.selectedTab=id;
      for(const view of this.root.querySelectorAll("[data-profile-view]"))view.hidden=view!==target;
      for(const tab of this.elements.tabs.querySelectorAll("[data-profile-tab]")){
        const active=tab===button;
        tab.classList.toggle("active",active);
        tab.setAttribute("aria-selected",String(active));
        tab.tabIndex=active?0:-1;
      }
      if(focus)button.focus();
      return true;
    }

    onTabKey(event){
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      const tabs=[...this.elements.tabs.querySelectorAll("[data-profile-tab]")];
      const current=Math.max(0,tabs.indexOf(document.activeElement));
      const next=event.key==="Home"?0:event.key==="End"?tabs.length-1:
        (current+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;
      event.preventDefault();
      this.selectTab(tabs[next].dataset.profileTab);
    }

    exportManifest(){
      const manifest=ProjectManifestRegistry.export(this.reader.fingerprint);
      if(!manifest)throw new Error("Only an imported project manifest can be exported from this workspace.");
      const blob=new Blob([`${JSON.stringify(manifest,null,2)}\n`],{type:"application/json"});
      const url=URL.createObjectURL(blob),anchor=document.createElement("a");
      anchor.href=url;
      anchor.download=`${String(manifest.profile||"push-project").replace(/[^a-z0-9._-]+/gi,"-")}.manifest.json`;
      document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),0);
      NotificationHandler.pop("Manifest exported",`${Object.keys(manifest.symbols).length} exact symbols written to JSON.`,NotificationType.SUCCESS);
    }

    async removeManifest(){
      if(this.profile?.manifestOrigin!=="project")return;
      const confirmed=await AppDialog.confirm({
        title:"Remove this project manifest?",
        message:"The exact source dictionary stored in this browser will be removed for the loaded ROM fingerprint.",
        detail:"The ROM file is not modified. The project reloads and semantic capabilities without independent evidence close safely.",
        confirmLabel:"Remove manifest",cancelLabel:"Keep manifest",danger:true
      });
      if(!confirmed)return;
      if(!await RomExport.confirmDiscard(this.reader,{
        title:"Reload without the project manifest?",
        message:"Reloading closes every open document and discards unapplied or unsaved project changes."
      }))return;
      if(!ProjectManifestRegistry.remove(this.reader.fingerprint))throw new Error("The project manifest is no longer registered.");
      NotificationHandler.pop("Project manifest removed","Reloading with header and bundled evidence only.",NotificationType.SUCCESS);
      await this.reader.reloadROM();
    }

    activate(){this.render();this.root.editorHeader?.render();}
    destroy(){this.scope.destroy();}
  }

  global.ProfileWorkspace=ProfileWorkspace;
  ((global.PokemonViewer||={}).profile||={}).ProfileWorkspace=ProfileWorkspace;
})(globalThis);
