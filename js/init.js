function change_workspace(idx, editor){
	if(RomEditor.ReadOnlyMemory != undefined){
		// Remove navigation button
		let navigation = document.getElementsByClassName("viewer_in");
		if(navigation.length == 1){
			navigation[0].classList.remove("viewer_in");
		}

		document.getElementById("navigation").childNodes[idx].classList.add("viewer_in");

		document.getElementsByClassName("editor_area").forEach(e=>{
			e.classList.add('hide');
		});

		document.getElementById(`${editor}_editor`).classList.remove('hide');
		RomEditor.change_workspace(editor);
	}
}


function checkFile(e){
	document.getElementById("upload_drag").classList.remove("hover");
	try{
		let files;
		currentGame = null;

		// Check if the dataTransfer is a dragged element or uploaded.
		if(Utils.isObject(e.dataTransfer)){
			files = e.dataTransfer.files;
		}else if(Utils.isObject(e.target)){
			files = e.target.files;
		}

		// Check if the file is a GB/C or GBA File.
		const gba_regex = (/\.(gba|gbc|gb)$/i);
		if(files.length === 1 && gba_regex.test(files[0].name.toLowerCase())){
			currentGame = files[0];
		}else{
			throw `The file has a wrong format.`;
		}

		RomEditor.loadROM(currentGame);
	}catch(e){
		NotificationHandler.pop("Error", e, NotificationType.ERROR);
	}
}

$(document).ready(function(){


	// LOAD games.json
	let pokemonbases = [];

	FileHandler.load(["json/games.json"], (results)=>{
		let data = JSON.parse(results[0].result);

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
				RomEditor.setGameBases(pokemonbases);
			}
		}
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

	FileHandler.load(["hex.html", "code.html", "map.html", "sprite.html", "emulator.html"], results=>{
		let menu_result = "";
		let main_result = "";
		for(let i = 0; i < results.length; ++i){
			let shortcut = results[i].path.split('.')[0];
			menu_result += `<a href="#" onclick="change_workspace(${i}, '${shortcut}')" class="icon-${shortcut}"><span>${shortcut} editor</span></a>`;
			main_result += results[i].result;
		}
		document.getElementById("navigation").innerHTML = menu_result;
		document.getElementById("main_result").innerHTML += main_result;
	});
	/*
	--> TODO: Auto upload when dragged / selected
	$("#upload_button").click(function(){
		if(currentGame != null){
			let info;
			if($(".game_option").hasClass("game_selected")){ // The game is selected manually.
				info = {lang: $("#game_language").data("value"), base: $("#games_overflow").data("selected")};
			}
			RomEditor.loadROM(currentGame, info);
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

	NotificationHandler.pop("¡Novedad 2.1!", "Hemos implementado el nuevo sistema de notificaciones, en cualquier momento aparecerá información relevante sobre los cambios que se vayan haciendo... ", NotificationType.NOTIFICATION);
	$(".subpannel button").click(function(){
		if($(this).parent().hasClass("warp_pannel")){
			let map = parseInt($(this).parent().find("input[name=map]").val());
			let bank = parseInt($(this).parent().find("input[name=bank]").val());
			RomEditor.changeMap(map, bank);
		}else{
			let value = parseInt($(this).parent().find("input[name=script]").val(), 16);
			if(value != 0x0){
				RomEditor.codeResult(value);
			}
		}
		$("#mousepannel").addClass("hide");
	});

	/* Window Events */
	$(".window_expand").on("click", function(){
		$(this).parent().parent().find(".window_content").toggleClass("hide");
	});

	$(".window_menu").on("mousedown", function(e){ RomEditor.window_dragging = $(this).parent(); });

	/* Creating all events. */
	$("body").on("mousedown", function(e){
		RomEditor.map_editor.mouse.down = true;
		RomEditor.map_editor.mouse.x = e.pageX;
		RomEditor.map_editor.mouse.y = e.pageY;
	});

	$("body").on("mousemove", function(e){
		window_dragging = RomEditor.window_dragging;
		if(window_dragging !== undefined){
			let parent = window_dragging.parent();
			let dx = window_dragging.offset().left - parent.offset().left;
			let dy = window_dragging.offset().top - parent.offset().top;
			let click = RomEditor.map_editor.mouse;
			window_dragging.css({
				"left": `${Math.max(0, Math.min(parent.width() - window_dragging.width(), dx - (click.x - e.pageX)))}px`,
				"top": `${Math.max(0, Math.min(parent.height() - window_dragging.height(), dy - (click.y - e.pageY)))}px`
			});
			click.x = e.pageX;
			click.y = e.pageY;
		}
	})

	$("body").on("mouseup", function(e){
		RomEditor.map_editor.mouse.down = false;
		$(".grabbing").removeClass("grabbing");
		RomEditor.map_editor.camera.properties.map = undefined;
		RomEditor.window_dragging = undefined;
	});
});
