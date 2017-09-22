$(document).ready(function(){
	// LOAD games.json

	let romEditor = new RomReader();
	let pokemonbases = [];
	let currentGame = null;
	$.getJSON("json/games.json", function(data){
		for(let machine in data){
			let games = data[machine];
			let html_games = "", total_games = 0;
			for(let title in games){
				let game = games[title];
				pokemonbases[title] = game;
				if(title != "global"){
					total_games++;
					html_games += '<div class="game_option" data-value="' + title + '">'+
							'<img src="css/images/roms/' + machine + '/boxart/' + title + '_foreground.jpg" />'+
							'<h4>Pokémon '+ title.replace(/\_/g, ' ') + '</h4>'+
						'</div>';
				}
			}
			if(total_games > 0){
				let msg = [["", "selected"], ["", "hide"]];
				let open = (machine != 'gba_roms')|0;
				let final = '<div id="'+ machine +'" class="'+ msg[1][open] +'" style="width: '+ (total_games * 212.5) +'px">' + html_games + '<div class="clear"></div></div>';
				$("#overflow_buttons").append("<div class='overflow_button " + msg[0][1-open] + "' data-machine='" + machine + "'><span class='upp'>" + machine.replace(/\_/g, '</span> ') + "</div>");
				$("#games_overflow").prepend(final);
			}
		}
	});

	$("#games_overflow").on("mousemove", function(e){
		let ch = $(this).find("> div:not(.hide)");
		let df = (e.pageX - $(this).offset().left) / $(this).width();
		let dx = ch.width() > $(this).width() ? (df * ($(this).width() - ch.width())) : 0;
		ch.css("transform", "translateX("+ dx +"px)");
	});

	$("#games_overflow").on("click", ".game_option", function(){
		let value = $(this).data("value");
		$(".game_selected").removeClass("game_selected");
		$(this).addClass("game_selected").parent().parent().data("selected", value);
		$("#game_language .options div").addClass("hide");
		let languages = pokemonbases[value].language;
		for(let k = 0; k < languages.length; k++){
			$("#game_language .options div[data-option=" + languages[k] + "]").removeClass("hide");
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
	$("#upload_button").on("click", function(){ $("#upload_input").click(); });
	$("#upload_input").on("change", function(e){
		let selected = e.target.files[0];
		$("#upload_button").text("Game selected: " + selected.name.toUpperCase());
		currentGame = selected;
		romEditor.setGameBases(pokemonbases);
	});

	$("#upload_checkbox").on("click", function(e){
		e.preventDefault();
		let checkbox = $(this).find("input[type=checkbox]");
		let checked = !checkbox.is(':checked');
		checkbox.prop('checked', checked);
		if(checked){
			$("#system_unknown").addClass("hide");
		}else{
			$("#system_unknown").removeClass("hide");
		}
	});

	$("#acceptGBA").click(function(){
		let checked = $("#upload_checkbox input[type=checkbox]").is(':checked');
		let canLoadGame = true;
		let info = {lang: null, base: null};
		if(!checked){
			// The game is selected manually.
			let base = $("#games_overflow").data("selected");
			let lang = $("#game_language").data("value");
			if(base != "" && lang != ""){
				info.lang = lang;
				info.base = base;
			}else{
				canLoadGame = false;
			}
		}
		if(canLoadGame && currentGame != null){
			romEditor.loadROM(currentGame, info);
		}
	});

	$("#cancelGBA").click(function(){
		$("#buttonFile").removeClass("file_button_in");
		$("#selectLightboxRom").animate({"opacity": 0}, 300, function(){
			$(this).addClass("lightbox_hide");
			$("#cancelGBA").removeClass("hide");
		});
	});

	$("#buttonFile").click(function(){
		$(this).addClass("file_button_in");
		$("#selectLightboxRom").animate({"opacity": 1}, 300,function(){
			$(this).removeClass("lightbox_hide");
		});
	});

	$("#rightside_menu > div[data-value]").on("click", function(){
		let value = $(this).data("value");
		romEditor.changeWorkspace(value);
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
});
