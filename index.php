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
		<div id="mousepannel" class="hide">
			<div class="subpannel script_pannel hide">
				<div class="person_pannel hide">
					<div class="pannelinput">Picture number<input type="number" min="0" max="255" name="picture" /></div>
					<div class="pannelinput">Talking level
						<select name="heightlevel">
							<option value="0">Always</option>
							<option value="1">Height 0 (Surf)</option>
							<option value="2">Height 1</option>
							<option value="3">Height 2 (Normal)</option>
							<option value="4">Height 3</option>
							<option value="5">Height 4</option>
							<option value="6">Height 5</option>
							<option value="7">Height 6</option>
							<option value="8">Height 7</option>
							<option value="9">Height 8</option>
							<option value="10">Height 9</option>
							<option value="11">Height 10</option>
							<option value="12">Height 11</option>
							<option value="13">Height 12</option>
							<option value="14">Height 13</option>
							<option value="15">Height 14</option>
						</select>
					</div>
					<div class="pannelinput">Movement type
						<select name="movement_type">
							<option value="0">No movement</option>
							<option value="1">Look around</option>
							<option value="2">Walk up and down</option>
							<option value="3">Walk up and down</option>
							<option value="4">Walk left and right</option>
							<option value="5">Walk left and right</option>
							<option value="6">Look up</option>
							<option value="7">Look down</option>
							<option value="8">Look left</option>
							<option value="9">Look right</option>
							<option value="10">-- Not enough data --</option>
							<option value="11">Hidden</option>
							<option value="12">Look up and down</option>
							<option value="13">Look left and right</option>
							<option value="14">Look up and left</option>
							<option value="15">Look down and left</option>
							<option value="16">Look down and right</option>
						</select>
					</div>
					<div class="pannelinput">Movement range<input type="number" min="255" name="movement_radius" /></div>
					<div class="pannelinput">Trainer<select name="is_trainer"><option value="1">Yes</option><option value="0">No</option></select></div>
					<div class="pannelinput">View Radius<input name="range_vision" type="number" min="0" max="65535" /></div>
					<div class="pannelinput">Person ID<input type="text" name="status" /></div>
				</div>
				<div class="pannelinput script">Script Offset<input type="text" name="script" /><button><i class="script"></i>Watch Script</div></button>
				<div class="pannelbar"></div>
			</div>
			<div class="subpannel warp_pannel hide">
				Hola mundo
			</div>
			<div class="subpannel map_pannel hide">
				<div class="panneloption"><i class="script"></i>Visit Warp</div>
				<div class="pannelbar"></div>
			</div>
				<div class="panneloption"><i class="info"></i>Properties</div>
				<div class="panneloption"><i class="delete"></i>Remove</div>
		</div>
		<canvas id="canvashelper" class="hide"></canvas>
		<div id="leftpannel">
			<button id="buttonFile" class="file_button_in">
				<div>SELECT GAME</div>
				<img  class="hide" src="" />
			</button>
			<div id="searchbox">
				<input type="text" autocomplete="off" id="searchInput"placeholder="Search Box">
				<button class="searchbutton"></button>
			</div>
			<div id="rightside_menu">
				<div data-value="hex" class="icon-hex"><span>Hex editor</span></div>
				<div data-value="xse" class="icon-code"><span>Code editor</span></div>
				<div data-value="map" class="icon-map viewer_in"><span>Map editor</span></div>
			</div>
		</div>
		<div id="rightpannel">
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
						<div id="widthMap">
						<h2>Map headers</h2>
					</div>
					</div>
					<div id="map">
						<canvas id="canvas_map"></canvas>
					</div>
					<div id="rightMap">
						<canvas id="blocks_map"></canvas>
					</div>
				</div>
			</div>
		</div>
	</body>
</html>
