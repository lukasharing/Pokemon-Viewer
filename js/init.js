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
							'<img src="' + window.location.pathname + game.boxart + '" />'+
							'<h4>Pokémon '+ title.replace(/\_/g, ' ') + '</h4>'+
						'</div>';
				}
			}
			let hide = (machine == 'gba_roms') ? '' : 'class="hide"';
			let final = '<div id="'+ machine +'" '+hide+' style="width: '+ (total_games * 212.5) +'px">' + html_games + '<div class="clear"></div></div>';
			$("#games_overflow").append(final);
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

	$("#searchInput").on("keydown", function(e){
		let event = e.keyCode || e.which;
		let value = $(this).val();
		if(event === 13){
			let offset = romEditor.currentOffset;
			if(romEditor.getWorkspaceName() == "hex"){
				if(new RegExp("^([0-9a-fA-F]{2})$").test(value)){
					offset = romEditor.findByHex(value, "Text");
				}else if(new RegExp("0x([0-9a-fA-F]{4}|[0-9a-fA-F]{8})").test(value)){
					offset = romEditor.findByInt(parseInt(value, 16), "Text");
				}else{
					offset = romEditor.findByDiccionary(value, "Text");
				}
				if(offset != undefined){
					romEditor.hexResult(offset[0], "hexResult", "hexTranslate", "Text");
				}
			}else{
				romEditor.codeResult(parseInt(value, 16));
			}
		}
	});
});
