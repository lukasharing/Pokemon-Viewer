$(document).ready(function(){

	var romEditor = new RomReader();

	// LOAD games.json
	var gamesloaded = [];
	$.getJSON("games/games.json", function(data){
		for(var gameboy in data){
			var titles = data[gameboy];
			for(var title in titles){
				var games = titles[title];
				for(var game in games){
					var rom = games[game];
					gamesloaded[game] = rom;
					gamesloaded.length++;
					$("#games_padding").prepend(
					'<div class="game_option" data-value="' + game + '">'+
						'<img src="' + window.location.pathname + rom.boxart + '" />'+
						'<h4>' + title + ' ' + game.replace(/\_/g, ' ') + '</h4>'+
					'</div>');
				}
			}
		}
		$("#games_padding").css({"width": (gamesloaded.length * 212.5) + "px"});
	});

	$("#games_overflow").mousemove(function(e){
		var ch = $(this).find("#games_padding");
		var df = (e.pageX - $(this).offset().left) / $(this).width();
		var dx = ch.width() > $(this).width() ? (df * ($(this).width() - ch.width())) : 0;
		ch.css("transform", "translateX("+ dx +"px)");
	});

	$("#games_padding").on("click", ".game_option", function(){
		var value = $(this).data("value");
		$(".game_selected").removeClass("game_selected");
		$(this).addClass("game_selected").parent().parent().data("selected", value);
		$("#game_language .options div").addClass("hide");
		var languages = gamesloaded[value].language;
		for(var k = 0; k < languages.length; k++){
			$("#game_language .options div[data-option=" + languages[k] + "]").removeClass("hide");
		}
		$("#game_language").data("value", "").find(".dropbox_title").html("-- Select the language --");
	});

	$(".dropbox > .options div").on("click", function(){
		var parent = $(this).parent().parent();
		parent.find(".dropbox_title").html($(this).html());
		parent.data("value", $(this).data("option"));
	});

	$("#acceptGBA").click(function(){
		var nameRom = $("#games_overflow").data("selected");
		var gamePrp = gamesloaded[nameRom];
		var lang = $("#game_language").data("value");
		if(nameRom != "" && lang != ""){
			var prt = window.location.pathname;
			var ofst = gamePrp.memory[lang];
			romEditor.loadROM(prt + gamePrp.path.replace("$", lang), lang, ofst, function(){
				var button = $("#buttonFile");
				button.attr("class", "room_button_" + nameRom).find("div").addClass("hide");
				button.find("img").removeClass("hide").attr("src", prt + gamePrp.logo.replace("$", lang));
			});
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

	$("#viewerSelection > div[data-value]").on("click", function(){
		var value = $(this).data("value");
		$(".viewer_in").removeClass("viewer_in");
		$(this).addClass("viewer_in");
		romEditor.setArea(value);
		if($(this).hasClass("icon-code")) romEditor.editor.refresh();
	});

	$("#searchInput").on("keydown", function(e){
		var e = e.keyCode || e.which;
		var value = $(this).val();
		if(e === 13){
			var offset = romEditor.currentOffset;
			if(romEditor.currentArea == "hex"){
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
