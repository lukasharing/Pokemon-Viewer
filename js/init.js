$(document).ready(function(){


	const checkFile = (e) => {
    e.stopPropagation();
		e.preventDefault();
		let files;
		currentGame = null;

		// Check if the dataTransfer is a dragged element or uploaded.
		if(Utils.isObject(e.originalEvent.dataTransfer)){
			files = e.originalEvent.dataTransfer.files;
		}else if(Utils.isObject(e.target)){
			files =  e.target.files;
		}

		// Check if the file is a GB or GBA File.
		const gba_regex = (/\.(gba|gbc|gb)$/i);
		if(files.length === 1/* && gba_regex.test(files[0].name.toLowerCase())*/){
			currentGame = files[0];
		}

		if(currentGame != null){
			romEditor.loadROM(currentGame);
		}else{
			console.error("ROMREADER: The file couldn't be accepted.");
		}
		$("#upload_drag").removeClass("hover");
	}

	// LOAD games.json
	let romEditor = new RomReader();
	let pokemonbases = [];
	let currentGame = null;
	$.getJSON("json/games.json").done(function(data){
		for(let machine in data){
			let games = data[machine];
			let html_games = "", total_games = 0;
			for(let title in games){
				let game = games[title];
				pokemonbases[title] = game;
				if(title != "global"){
					total_games++;
					html_games+=`<div class="game_option" data-value="${title}"><img src="css/images/roms/${machine}/boxart/${title}_foreground.jpg"/><h4>Pokémon ${title.replace(/\_/g, ' ')}</h4></div>`;
				}
			}
			if(total_games > 0){
				let msg = [["", "selected"], ["", "hide"]];
				let open = (machine != 'gba_roms')|0;
				$("#overflow_buttons").prepend(`<div class="overflow_button ${msg[0][1-open]}" data-machine="${machine}"><span class='upp'>${machine.replace(/\_/g, '</span> ')}</div>`);
				$("#games_overflow").prepend(`<div id="${machine}" class="${msg[1][open]}" style="width: ${total_games * 212.5}px">${html_games}<div class="clear"></div></div>`);
				romEditor.setGameBases(pokemonbases);
			}
		}
	});

	/* Game manually selected events */
	$("#games_overflow").on("mousemove", function(e){
		let ch = $(this).find("> div:not(.hide)");
		let df = (e.pageX - $(this).offset().left) / $(this).width();
		let dx = ch.width() > $(this).width() ? (df * ($(this).width() - ch.width())) : 0;
		ch.css("transform", "translateX("+ dx +"px)");
	});

	$("#games_overflow").on("click", ".game_option", function(){
		let had = $(this).hasClass("game_selected");
		$(".game_selected").removeClass("game_selected");
		$("#game_language .options div").addClass("hide");
		if(!had){
			let value = $(this).data("value");
			$(this).addClass("game_selected").parent().parent().data("selected", value);
			pokemonbases[value].language.forEach(a=>{ $("#game_language .options div[data-option=" + a + "]").removeClass("hide"); });
		}
		$("#game_language").data("value", "").find(".dropbox_title").html("-- Select the language --");
	});

	$("#system_unknown").on("click", ".overflow_button:not(.selected)", function(){
		$(".overflow_button.selected").removeClass("selected");
		$(this).addClass("selected");
		$("#games_overflow > div:not(.hide)").addClass("hide");
		$("#"+$(this).data("machine")).removeClass("hide");
	});

	$(".dropbox > .options div").on("click", function(){
		let parent = $(this).parent().parent();
		parent.find(".dropbox_title").html($(this).html());
		parent.data("value", $(this).data("option"));
	});

	/* Upload Method */
	$("#upload_drag").on("dragover", function(e){
    e.stopPropagation();
		e.preventDefault();
		$(this).addClass("hover");
	}).on("dragleave", function(e){
    e.stopPropagation();
		e.preventDefault();
		$(this).removeClass("hover");
	}).on("drop", checkFile);

	$("#upload_mini").on("click", ()=>$("#upload_input").click());
	$("#upload_input").on("change", checkFile);


	/*
	--> TODO: Auto upload when dragged / selected
	$("#upload_button").click(function(){
		if(currentGame != null){
			let info;
			if($(".game_option").hasClass("game_selected")){ // The game is selected manually.
				info = {lang: $("#game_language").data("value"), base: $("#games_overflow").data("selected")};
			}
			romEditor.loadROM(currentGame, info);
		}
	});
	*/

	/*
	--> TODO: Change cancel button to close button

	$("#cancel_button").on("click", function(){
		$("#selectLightboxRom").animate({"opacity": 0}, 300, function(){
			$(this).addClass("lightbox_hide");
			$("#cancel_button").removeClass("hide");
		});
	});
	*/

	/*
	--> TODO: Change animation
	$("#new_upload").on("click", function(){
		$("#selectLightboxRom").animate({"opacity": 1}, 300,function(){
			$(this).removeClass("lightbox_hide");
		});
		$("#file_selection").removeClass("hide");
	});
	*/

	$("#rightside_menu > div[data-value]").on("click", function(e){
		e.preventDefault();
		if(romEditor.ReadOnlyMemory != undefined){
			let value = $(this).data("value");
			romEditor.changeWorkspace(value);
		}
	});

	$(".subpannel button").click(function(){
		if($(this).parent().hasClass("warp_pannel")){
			let map = parseInt($(this).parent().find("input[name=map]").val());
			let bank = parseInt($(this).parent().find("input[name=bank]").val());
			romEditor.changeMap(map, bank);
		}else{
			let value = parseInt($(this).parent().find("input[name=script]").val(), 16);
			if(value != 0x0){
				romEditor.codeResult(value);
			}
		}
		$("#mousepannel").addClass("hide");
	});

	$("#searchInput").on("keyup", function(e){
		if(e.keyCode === 13){
			let find = romEditor.findByDictionary($(this).val(), "Text");
			if(find.length > 0){
				romEditor.hexResult(find[0], "hexResult", "hexTranslate");
			}
		}
	});

	/* Window Events */
	$(".window_expand").on("click", function(){
		$(this).parent().parent().find(".window_content").toggleClass("hide");
	});

	$(".window_menu").on("mousedown", function(e){ romEditor.window_dragging = $(this).parent(); });

	/* Creating all events. */
	$("body").on("mousedown", function(e){
		romEditor.map_editor.mouse.down = true;
		romEditor.map_editor.mouse.x = e.pageX;
		romEditor.map_editor.mouse.y = e.pageY;
	});

	$("body").on("mousemove", function(e){
		window_dragging = romEditor.window_dragging;
		if(window_dragging !== undefined){
			let parent = window_dragging.parent();
			let dx = window_dragging.offset().left - parent.offset().left;
			let dy = window_dragging.offset().top - parent.offset().top;
			let click = romEditor.map_editor.mouse;
			window_dragging.css({
				"left": `${Math.max(0, Math.min(parent.width() - window_dragging.width(), dx - (click.x - e.pageX)))}px`,
				"top": `${Math.max(0, Math.min(parent.height() - window_dragging.height(), dy - (click.y - e.pageY)))}px`
			});
			click.x = e.pageX;
			click.y = e.pageY;
		}
	})

	$("body").on("mouseup", function(e){
		romEditor.map_editor.mouse.down = false;
		$(".grabbing").removeClass("grabbing");
		romEditor.map_editor.camera.properties.map = undefined;
		romEditor.window_dragging = undefined;
	});
});
