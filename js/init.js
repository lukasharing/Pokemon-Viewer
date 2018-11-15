/*
 Globals
*/
// Pokemon Games information

/*


*/

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
	}
}

// Load games info
function game_option_click(item){
	if(!item.classList.contains("game_selected")){
		document.querySelector("#games_overflow .game_selected").classList.remove("game_selected");
		item.classList.add("game_selected");

		item.parentNode.parentNode.dataset.selected = item.dataset.value;

		let game_language = document.getElementById("game_language");
		let game_language_languages = game_language.childNodes[3];
		game_language.childNodes[1].innerHTML = "-- Select the language --";
		game_language.dataset.value = "";
	}
};

function checkFile(e){
	document.getElementById("upload_drag").classList.remove("hover");
	try{
		// Check if the dataTransfer is a dragged element or uploaded.
		let files;
		if(Utils.isObject(e.dataTransfer)){
			files = e.dataTransfer.files;
		}else if(Utils.isObject(e.target)){
			files = e.target.files;
		}

		// Check if the file is a GB/C or GBA File.
		const gba_regex = (/\.(gba|gbc|gb)$/i);
		if(files.length === 1 && gba_regex.test(files[0].name.toLowerCase())){
			RomEditor.loadROM(files[0]);
		}else{
			throw `The file has a wrong format.`;
		}
	}catch(e){
		NotificationHandler.pop("Error", e, NotificationType.ERROR);
	}
}

let RomEditor = null;
window.onload = ()=>{

	document.getElementsByClassName("dropbox--label").forEach((dropbox) => {
		let parent = dropbox.childNodes[3];
		parent.childNodes.forEach((option) => {
			if(option instanceof HTMLLIElement){
				option.addEventListener("click", function(e){
					parent.parentNode.childNodes[1].innerHTML = this.innerHTML;
					parent.parentNode.childNodes[1].dataset.value = this.dataset.option;
				});
			}
		});
	});


	let pokemon_bases = new Array();
	// Load each tab
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
		RomEditor = new RomReader();
		FileHandler.load(["json/games.json"], (results)=>{
			let data = JSON.parse(results[0].result);

			let system_unknown_menu = "";
			let system_unknown_system = "";
			let total_system = 0;
			for(let machine in data){
				let games = data[machine];
				let html_games = "", total_games = 0;
				for(let title in games){
					let game = games[title];
					pokemon_bases[title] = game;
					if(title != "global"){
						html_games += `<div class="game_option ${total_games === 0 ? "game_selected" : ""}" onclick="game_option_click(this)" data-value="${title}">` +
						                 `<img src="css/images/roms/${machine}/boxart/${title}_foreground.jpg"/>` +
														 `<h4>Pokémon ${title.replace(/\_/g, ' ')}</h4>`+
													`</div>`;
						++total_games;
					}
				}
				if(total_games > 0){
					// Menu
					system_unknown_menu += `<div class="overflow_button ${total_system === 0 ? "selected" : ""}" data-machine="${machine}">` +
					                          `<span class='upp'>${machine.replace(/\_/g, "</span> ")}` +
																 `</div>`;

					// Slider
					system_unknown_system += `<div id="${machine}" class="${total_system > 0 ? "hide" : ""}" style="width: ${total_games * 212.5}px; display: flex;">${html_games}</div>`;
					//RomEditor.setGameBases(pokemon_bases);
				}
				++total_system;
			}

			document.getElementById("overflow_buttons").innerHTML = system_unknown_menu;
			document.getElementById("games_overflow").innerHTML = system_unknown_system;
		});
	});

	NotificationHandler.pop("¡Novedad 2.1!", "Hemos implementado el nuevo sistema de notificaciones, en cualquier momento aparecerá información relevante sobre los cambios que se vayan haciendo... ", NotificationType.NOTIFICATION);

	// Calls this events depending on the visible tab.
	document.getElementsByTagName("body")[0].addEventListener("mousedown", function(e){
		if(RomEditor != null){

		}
	});

	document.getElementsByTagName("body")[0].addEventListener("mouseup", function(e){
		if(RomEditor != null){

		}
	});

	document.getElementsByTagName("body")[0].addEventListener("mousemove", (e) => {
		if(RomEditor != null){

		}
	});

}
