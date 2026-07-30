/*  _-_      _-_      _-__-_   _-__-__-__-__-__-__-__-_
    _-_      _-_      _-__-_   _-__-_      _-__-_
    _-_      _-_      _-__-__-_   _-_      _-__-_
    _-_      _-_      _-__-__-_   _-__-__-__-__-__-__-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-_      _-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-__-__-__-_
    ***************************************************
    ***************************************************
    This content is written by Lukas Häring.
*/

class RomReader{
	constructor(){
		/* Game Variables */
		this.game_bases = {};
		this.gb_game_bases = {};
		this.gamePath = "";
		this.lang 		= "";
		this.type 		= "";
		this.version	= "";
		this.family = "";
		this.editorProfile = "";
		this.textDictionary = null;
		this.capabilities = null;
		this.memoryProfile = null;
		this.fingerprint = null;
		this.sourceFile = null;
		this.romInfo = null;

		/* Editor Variables */
		this.currentWorkspace = "";

		//* Editor dictionary Variables *//
		this.dictionary = {};

		/* Game Buffers Variables */
		this.memoryOffsets = {};
		this.ReadOnlyMemory;
		this.OriginalMemory;
		this.SavedMemory;
		this.memory = null;
		this.structureRegistry = null;
		this.runtime = null;
		this.projectGeneration = 0;
		this.workspaceLoads = new Map();
		this.loading = false;
		this.project_commands = new CommandStack();
		this.drafts = new DraftRegistry();
		this.validation = new ValidationRegistry();
		this._resourceGraph = null;

		/* Items */
		this.items = [];

		/* Editors */
		this.map_editor = null;
		this.hex_editor = null;
		this.code_editor = null;
		this.sprite_editor = null;
		this.battle_editor = null;
		this.pokedex_editor = null;
		this.move_editor = null;
		this.sound_editor = null;
		this.animation_editor = null;
		this.encounter_editor = null;
		this.item_editor = null;
		this.profile_editor = null;
		this.emulator_editor = null;
		this.hexEventsBound = false;
	};

	/* Global */
	get size(){ return this.memory?.size ?? 0; };
	cursor(offset=0){ if(!this.memory) throw new Error("Load a ROM before reading memory."); return this.memory.cursor(offset); };
	history(owner, options){ return this.project_commands.scope(owner, options); };
	get availableStructures(){ return this.structureRegistry?.list() ?? []; };
	get resourceGraph(){ return this._resourceGraph; };
	set resourceGraph(graph){
		if(graph&&this.memory&&typeof AllocationLedger==="function"){
			const ranges=[];
			for(const node of graph.nodes?.()||[])if(node.accuracy==="verified")ranges.push(...node.ranges);
			for(const edge of graph.edges?.()||[])if(edge.confidence==="verified"&&edge.range)ranges.push(edge.range);
			AllocationLedger.forMemory(this.memory).syncProtected("resource-graph",ranges,{
				owner:"verified resource graph",
				reason:"Exact source-backed node or reference range"
			});
		}
		this._resourceGraph=graph||null;
	};
	readStructure(name, offset, options){
		const Structure = this.structureRegistry?.get(name);
		if(!Structure?.read) throw new Error(`Structure '${name}' is not available for ${this.family || "this ROM"}.`);
		return Structure.read(this.memory, offset, options);
	};

	/* Pokemon Bases */
	setGameBases(n){ this.game_bases = n; };
	setGbGameBases(n){ this.gb_game_bases = n; };
	isFRLG(){ return (this.type == "fire_red" || this.type == "leaf_green"); };

	/* _editor dictionary Methods */
	getDictionary(n){ return this.dictionary[n]; };
	getTextByOffset(dictionary, offset, maxLength = 256){
		if(!this.isROMOffset(offset)) return "";
		const table = dictionary || [];
		let result = "";
		for(let index = 0; index < maxLength && this.isROMOffset(offset + index); index++){
			const byte = this.getByte(offset + index);
			if(byte === 0xff) break;
			result += table[byte] ?? "";
		}
		return result;
	};

	/* Game Buffers Methods */
	getOffset(o)	{ return this.memory instanceof GbaMemory ? this.memory.pointer(o) : null; };
	getShort(o)		{ return this.memory.u16(o); };
	getByte(o)		{ return this.memory.u8(o); };
	isROMOffset(o){ return this.memory?.contains(o) ?? false; };

	async loadROM(file){
		if(this.loading)throw new Error("A ROM is already loading.");
		this.loading=true;
		const loader = document.getElementById("loader_file_container");
		const upload = document.getElementById("upload_game");
		loader.classList.remove("hide");
		upload.classList.add("hide");

		try{
			// File replacement is a project boundary. Tear down every listener and
			// family-specific object before any asynchronous step can fail.
			this.resetLoadedState();
			this.sourceFile = file;
			this.ReadOnlyMemory = new Uint8Array(await file.arrayBuffer());
			this.OriginalMemory = this.ReadOnlyMemory.slice();
			this.SavedMemory = this.ReadOnlyMemory.slice();
			this.gamePath = file.name;
			const detected = await PokemonRomDetector.detect(this.ReadOnlyMemory, file.name);
			const detectedWithSize=Object.freeze({...detected,romSize:this.ReadOnlyMemory.length});
			this.capabilities = CapabilityManifest.resolve(detectedWithSize);
			this.memoryProfile = new MemoryProfile(detectedWithSize,this.capabilities);
			this.fingerprint = detected.fingerprint;
			const info = Object.freeze({...detectedWithSize,capabilities:this.capabilities,workspaces:this.capabilities.enabledWorkspaces});
			await this.loadFamilyRuntime(info);
			this.structureRegistry = this.runtime.registry();
			this.memory = this.structureRegistry.createMemory(this.ReadOnlyMemory);

			this.memoryOffsets = {};
			this.setGameInformation(info);
			this.runtime.configure(this,info);
			await this.loadRuntime(info);
			await this.init();
			window.dispatchEvent(new CustomEvent("romloaded", {detail: info}));

			document.getElementById("selectLightboxRom").classList.add("hide");
			document.getElementById("new_upload").textContent = `${info.name.replace("Pokémon ", "")} · ${info.platform} · ${this.lang.toUpperCase()} · Rev ${info.version}`;
			const selectedBase=info.selection==="user-base";
			const checksumNote = info.checksumValid ? "" : " Header checksum differs from the original.";
			NotificationHandler.pop(selectedBase?"ROM hack base selected":"ROM detected", selectedBase
				?`${info.name} engine selected. Semantic editors remain locked until this build has a verified symbol manifest.`
				:`${info.name} (${info.code}), revision ${info.version}.${checksumNote}`, selectedBase?NotificationType.WARNING:NotificationType.SUCCESS);
		}catch(error){
			this.resetLoadedState();
			loader.classList.add("hide");
			upload.classList.remove("hide");
			NotificationHandler.pop("ROM load failed", error.message || String(error), NotificationType.ERROR);
		}finally{
			this.loading=false;
		}
	};

	async reloadROM(){
		const file=this.sourceFile;
		if(!file)throw new Error("The current ROM file is no longer available. Choose it again.");
		return this.loadROM(file);
	};

	async loadFamilyRuntime(info){
		const runtimeName=info.family==="gba"?"gba":info.editorProfile==="gen2-crystal-intl"?"gen2":"gbc";
		await AssetLoader.loadScripts(["js/structures/memory-reader.js","js/structures/memory.js","js/core/memory-utils.js?v=4","js/core/memory-reference-utils.js?v=1","js/core/binary-codec-utils.js?v=2","js/core/text-table.js?v=3","js/core/edit-utils.js?v=2","js/core/gesture-zoom.js?v=3","js/core/rom-allocator.js?v=3","js/core/relocatable-patch.js?v=5","js/structures/writer.js?v=5","js/core/map-layout-writer.js?v=3",`js/rom/runtime/${runtimeName}.js?v=51`]);
		this.runtime=runtimeName==="gba"?GbaRomRuntime:runtimeName==="gen2"?Gen2RomRuntime:GbcRomRuntime;
		await AssetLoader.loadScripts(this.runtime.structureScripts);
	};

	async loadRuntime(info){
		this.destroyEditors();
		await AssetLoader.loadScripts([
			"js/core/utils.js?v=2",
			"js/hex/editor-hex.js?v=10"
		]);
		if(!this.hexEventsBound){
			document.addEventListener("keydown", hex_keydown);
			this.hexEventsBound = true;
		}

		this.map_editor = null;
		this.code_editor = null;
		this.sprite_editor = null;
		this.battle_editor = null;
		this.pokedex_editor = null;
		this.move_editor = null;
		this.sound_editor = null;
		this.animation_editor = null;
		this.encounter_editor = null;
		this.item_editor = null;
		this.profile_editor = null;
		this.emulator_editor = null;
	};

	destroyEditors(){
		for(const editor of [this.map_editor,this.code_editor,this.sprite_editor,this.battle_editor,this.pokedex_editor,this.move_editor,this.sound_editor,this.animation_editor,this.encounter_editor,this.item_editor,this.profile_editor,this.emulator_editor,this.hex_editor])try{editor?.destroy?.();}catch(error){console.warn("Editor cleanup failed.",error);}
		this.map_editor=this.code_editor=this.sprite_editor=this.battle_editor=this.pokedex_editor=this.move_editor=this.sound_editor=this.animation_editor=this.encounter_editor=this.item_editor=this.profile_editor=this.emulator_editor=this.hex_editor=null;
		this.gbaItemData=this.gen1ItemData=null;
	};

	resetLoadedState(){
		this.projectGeneration++;
		this.project_commands.clear();
		this.drafts.clear();
		this.validation.clear();
		this.workspaceLoads.clear();
		this.destroyEditors();
		this.ReadOnlyMemory=undefined;
		this.OriginalMemory=undefined;
		this.SavedMemory=undefined;
		this.memory=null;
		this.structureRegistry=null;
		this.runtime=null;
		this.memoryOffsets={};
		this.dictionary={};
		this.items=[];
		this.currentWorkspace="";
		this.gamePath="";
		this.lang="";
		this.type="";
		this.version="";
		this.family="";
		this.editorProfile="";
		this.textDictionary=null;
		this.capabilities=null;
		this.memoryProfile=null;
		this.fingerprint=null;
		this.sourceFile=null;
		this.romInfo=null;
		this.resourceGraph=null;
		this.gen1SpeciesData=this.gen1MoveData=this.gen1ProgressionData=this.gen1TrainerData=this.gen1EncounterData=null;
		this.gen2SpeciesData=this.gen2MoveData=this.gen2ProgressionData=this.gen2TrainerData=this.gen2EncounterData=null;
		this.gbaSpeciesData=this.gbaTrainerData=this.gbaEncounterData=null;
		window.dispatchEvent(new CustomEvent("romreset"));
		return this;
	};

	async ensureWorkspace(workspaceId){
		if(!this.runtime)return;
		// The emulator is a persistent dock rather than an editor workspace, while
		// capability manifests retain the historical `emulator_editor` identifier.
		// Resolve that public capability without leaking the old name into runtimes.
		const capabilityId=workspaceId==="emulator"?"emulator_editor":workspaceId;
		const capability=this.capabilities?.get?.(capabilityId);
		if(capability&&!capability.ordinary){
			throw new Error(`${capability.label}: ${capability.reason}`);
		}
		const existing=this.workspaceLoads.get(workspaceId);if(existing)return existing;
		const generation=this.projectGeneration,runtime=this.runtime;
		const pending=Promise.resolve().then(async()=>{
			if(workspaceId!=="profile_workspace")return runtime.ensureWorkspace(this,workspaceId,generation);
			if(this.profile_editor)return this.profile_editor;
			await AssetLoader.loadScripts(["js/profile/editor.js?v=1"]);
			if(!this.isProjectGeneration(generation))return null;
			this.profile_editor=new ProfileWorkspace(this);
			return this.profile_editor;
		}).finally(()=>{
			if(this.workspaceLoads.get(workspaceId)===pending)this.workspaceLoads.delete(workspaceId);
		});
		this.workspaceLoads.set(workspaceId,pending);return pending;
	};

	isProjectGeneration(generation){return generation===this.projectGeneration;}

	//* Search Methods *//
	findByInt(chain, start, end){
		end = end || this.size;
		let result = [];
		let last = chain[0];
		for(let k = start || 0, c = 0, equal = 0; (k + equal) < end; k++){
			if(last == this.getByte(k) || last < 0){
				equal++;
				if(equal == chain.length){ // found
					equal = 0;
					result.push(k-chain.length+1);
					c++;
					k += chain.length-1;
				}
			}else{
				equal = 0;
			}
			last = chain[equal];
		}
		return result;
	};

	findByHex(hex, start, end){
		if(hex.length % 2 == 0){
			return this.findByInt(hex.match(/.{1,2}/g).map((a)=>{return (~a.indexOf("X") ? -1 : parseInt(a, 16))}), start, end);
		}else{
			console.error("ROMREADER: Hexadecimal chains have to be even.");
			return null;
		}
	};

	findByDictionary(chain, name, start, end){
		let dictionary = this.getDictionary(name);
		let text2hex = [...chain].map(e=>{ return(dictionary == null?e.charCodeAt(0):dictionary.indexOf(e))});
		return this.findByInt(text2hex, start, end);
	};

	/* Memory Manipulation */
  write_hex_memory(p = 0x000000, hex = 0x00){
		if(!this.hex_editor)throw new Error("Hex Editor is not initialized.");
		const value=typeof hex==="string"?parseInt(hex.replace(/^0x/i,""),16):Number(hex);
		return this.hex_editor.writeByte(p,value,"Edit byte");
  };

  write_char_memory(p = 0x000000, char = ' '){
		if(!this.hex_editor)throw new Error("Hex Editor is not initialized.");
		const previous=this.hex_editor.head;this.hex_editor.head=p;
		try{return this.hex_editor.writeText(String(char).charAt(0));}finally{this.hex_editor.head=previous;}
  };

	getTableSize(o, e = this.size){
		let c = 0;
		while(this.isROMOffset(this.getOffset(o)) && o < e){ o += 4; c++; }
		return c;
	};

	loadItemsFromMemory(){
		if(this.family !== "gba" || !this.isROMOffset(this.memoryOffsets.item_header)) return [];
		const decodeText = (offset, length) => this.getTextByOffset(this.getDictionary("Text"), offset, length);
		const catalog = this.structureRegistry.createItemCatalog(this.memory, {
			tableOffset: this.memoryOffsets.item_header,
			count: Math.floor((this.size - this.memoryOffsets.item_header) / GbaItem.SIZE),
			decodeText
		});
		this.items = [];
		for(let index = 0; index < catalog.count; index++){
			const item = catalog.get(index);
			if(!item.name) break;
			this.items.push(item);
		}
		return this.items;
	};
	/* Main Methods. */
	setGameInformation(info){
		this.lang = info.lang === "intl" ? "en" : info.lang;
		this.type = info.base;
		this.version = info.version;
		this.family = info.family;
		this.editorProfile = info.editorProfile || info.family;
		this.textDictionary = info.family === "gba" ? "text_table_en" : null;
		this.romInfo = info;
	};

	async init(){
		const dictionaryPaths = this.runtime?.dictionaryPaths || [];

		if(dictionaryPaths.length){
			const results = await FileHandler.load(dictionaryPaths);
			results.forEach(r=>{
				let json = JSON.parse(r.result);
				let dictionary = new Array(256);
				for(let key in json){
					dictionary[parseInt(key, 16)] = json[key];
				}
				this.dictionary[r.path.split("/")[2].split(".")[0]] = dictionary;
			});
		}

		this.hex_editor = new EHex(this);
		this.hex_editor.go(0x000000);

	};
};
