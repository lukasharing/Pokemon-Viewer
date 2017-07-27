<!DOCTYPE html>
<html lang="es">
	<head>
		<meta charset="utf-8" />
		<title>Pokémon View</title>
		<link href='http://fonts.googleapis.com/css?family=Roboto:300,400' rel='stylesheet' type='text/css'>
		<link rel="stylesheet" href="css/style.css" />

		<!-- CodeMirror CSS -->
		<link rel="stylesheet" href="css/codemirror/codemirror.css" />
		<link rel="stylesheet" href="css/codemirror/3024-day.css" />
		<link rel="stylesheet" href="css/codemirror/show-hint.css" />

		<!-- CodeMirror JS -->
		<script src="js/codemirror/codemirror.js"></script>
		<script src="js/codemirror/codemirror_refresh.js"></script>
		<script src="js/codemirror/active-line.js"></script>
		<script src="js/codemirror/show-hint.js"></script>

		<!-- Global libraries -->
		<script src="js/jquery/jquery.js"></script>

		<!-- My libraries -->
		<script src="js/camera.js"></script>
		<script src="js/utils.js"></script>
		<script src="js/main.js"></script>
		<script src="js/init.js"></script>
	</head>
	<body>
		<canvas id="canvashelper" class="hide"></canvas>
		<header>
			<button id="buttonFile" class="file_button_in">
				<div>SELECT GAME</div>
				<img  class="hide" src="" />
			</button>
			<input id="searchInput" type='text' placeholder="Search hexadecima, string...">
			<div id="viewerSelection">
				<div data-value='hex' class="icon-hex">Hex editor</div>
				<div data-value='xse' class="icon-code">Code editor</div>
				<div data-value='map' class="icon-map viewer_in">Map editor</div>
			</div>
		</header>
		<main>
			<div class="lightbox" id="selectLightboxRom">
				<div id="game_selection">
					<h2>Select which Pokémon game you want to hack.</h2>
					<div id="games_overflow">
						<div id="games_padding">
							<div class="clear"></div>
						</div>
					</div>
					<div id="selection_buttons">
						<div class="dropbox" id="game_language">
							<div class="dropbox_title">-- Select the language --</div>
							<div class="options">
								<div data-option="es" class="hide">Spanish</div>
								<div data-option="en" class="hide">English</div>
								<div data-option="jp" class="hide">Japanese</div>
							</div>
						</div>
						<buttton id="cancelGBA" class="hide">Cancel</buttton>
						<buttton id="acceptGBA">Accept</buttton>
					</div>
				</div>
				<div id="loadingScreen" class="hide">
					<div class="loader"></div>
					<h3>Loading 0%</h3>
				</div>
			</div>
			<div class="editor_area hide" id="hexEditor">
				<div class="clear"></div>
			</div>
			<div class="editor_area hide" id="xseEditor">
				<div id="codeEditor__tabs"><div class="clear"></div></div>
				<div id="codeEditor"></div>
			</div>
			<div class="editor_area" id="mapEditor">
				<div id="map_padding">
					<div id="leftMap">
						<h2>Map headers</h2>
					</div>
					<div id="map">
						<div id="map_layers">
							<div class="layer_input">
								<div class="layer_input_icon icon_sprite"></div>
								<div class="layer_input_options">
									<div class="layer_option icon_minus"></div>
									<input type="text" class="option_number" name="numberOverworld" />
									<div class="layer_option icon_plus"></div>
									<div class="layer_option icon_see"></div>
									<div class="clear"></div>
								</div>
							</div>
							<div class="layer_input">
								<div class="layer_input_icon icon_sign"></div>
								<div class="layer_input_options">
									<div class="layer_option icon_minus"></div>
									<input type="text" class="option_number" name="numberOverworld" />
									<div class="layer_option icon_plus"></div>
									<div class="layer_option icon_see"></div>
									<div class="clear"></div>
								</div>
							</div>
						</div>
						<div id="mapMenu">
							<div class="selected map_option icon_map_menu"> Map </div>
							<div class="map_option icon_hand_menu"> Movement Permission </div>
							<div class="map_option icon_info_menu"> Map Info </div>
							<div class="clear"></div>
						</div>
						<canvas id="canvas_map"></canvas>
					</div>
					<div id="rightMap">
						<canvas id="blocks_map"></canvas>
					</div>
				</div>
			</div>
		</main>
	</body>
</html>
