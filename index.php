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
			<input type="hidden" name="index" />
			<input type="hidden" name="type" />
			<div class="subpannel showAlways hide">
				<div class="pannelinput">Talk level
					<select name="heightlevel" autocomplete="off">
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
			</div>
			<div class="subpannel person_pannel hide">
				<div class="pannelinput">Picture number<input type="number" min="0" max="255" name="picture" autocomplete="off" /></div>
				<div class="pannelinput" autocomplete="off">Movement type
					<select name="movement_type">
						<option value="0">No movement</option>
						<option value="1">Look around</option>
						<option value="2">Walk around</option>
						<option value="3">Walk up and down</option>
						<option value="4">Walk up and down</option>
						<option value="5">Walk left and right</option>
						<option value="6">Walk left and right</option>
						<option value="7">Look up</option>
						<option value="8">Look down</option>
						<option value="9">Look left</option>
						<option value="10">Look right</option>
						<option value="11">-- Not enough data --</option>
						<option value="12">Hidden</option>
						<option value="13">Look up and down</option>
						<option value="14">Look left and right</option>
						<option value="15">Look up and left</option>
						<option value="16">Look down and left</option>
						<option value="17">Look down and right</option>
						<option value="18">Look up, down and left</option>
						<option value="19">Look up, down and right</option>
						<option value="20">Look up, left and right</option>
						<option value="21">Look down, left and right</option>
						<option value="22">Look around counterclockwise</option>
						<option value="23">Look around clockwise</option>
						<option value="24">Run up and down</option>
						<option value="25">Run up and down</option>
						<option value="26">Run left and right</option>
						<option value="27">Run left and right</option>
						<option value="28">Run up, right, left and down</option>
						<option value="29">Run right, left, down and up</option>
						<option value="30">Run down, up, right and left</option>
						<option value="31">Run left, down, up and right</option>
						<option value="32">Run up, left, right and down</option>
						<option value="33">Run left, right, down and up</option>
						<option value="34">Run down, up, left and right</option>
						<option value="35">Run right, down, up and left</option>
						<option value="36">Run left, up, down and right</option>
						<option value="37">Run up, down, right and left</option>
						<option value="38">Run right, left, up and down</option>
						<option value="39">Run down, right, left and up</option>
						<option value="40">Run right, up, down and left</option>
						<option value="41">Run up, down, left and right</option>
						<option value="42">Run left, right, up and down</option>
						<option value="43">Run down, left, right and up</option>
						<option value="44">Run around counterclockwise</option>
						<option value="45">Run around counterclockwise</option>
						<option value="46">Run around counterclockwise</option>
						<option value="47">Run around counterclockwise</option>
						<option value="48">Run around counterclockwise</option>
						<option value="49">Run around clockwise</option>
						<option value="50">Run around clockwise</option>
						<option value="51">Run around clockwise</option>
						<option value="52">Copy Player</option>
						<option value="53">Mirror Player</option>
						<option value="54">Mirror Player</option>
						<option value="55">Mirror Player</option>
						<option value="56">Tree wall disguise</option>
						<option value="57">Rock wall disguise</option>
						<option value="58">Mirror player (standing)</option>
						<option value="59">Copy player (standing)</option>
						<option value="60">Mirror player (standing)</option>
						<option value="61">Mirror player (standing)</option>
						<option value="62">Hidden</option>
						<option value="63">Walk on the spot (Down)</option>
						<option value="64">Walk on the spot (Up)</option>
						<option value="65">Walk on the spot (Left)</option>
						<option value="66">Walk on the spot (Right)</option>
						<option value="67">Jog on the spot (Down)</option>
						<option value="68">Jog on the spot (Up)</option>
						<option value="69">Jog on the spot (Left)</option>
						<option value="70">Jog on the spot (Right)</option>
						<option value="71">Run on the spot (Down)</option>
						<option value="72">Run on the spot (Up)</option>
						<option value="73">Run on the spot (Left)</option>
						<option value="74">Run on the spot (Right)</option>
						<option value="75">Hidden</option>
						<option value="76">Walk on the spot (Down)</option>
						<option value="77">Walk on the spot (Up)</option>
						<option value="78">Walk on the spot (Left)</option>
						<option value="79">Walk on the spot (Right)</option>
					</select>
				</div>
				<div class="pannelinput">Movement range<input type="number" min="0" max="255" name="movement_radius" autocomplete="off" /></div>
				<div class="halfpannelinput">
					<div class="pannelinput">Trainer<select name="is_trainer"><option value="1">Yes</option><option value="0">No</option></select></div>
					<div class="pannelinput">View Radius<input name="range_vision" type="number" min="0" max="65535" autocomplete="off" /></div>
					<div class="clear"></div>
				</div>
				<div class="pannelinput">Person ID<input type="text" name="status" autocomplete="off" /></div>
			</div>
			<div class="subpannel sign_pannel hide">
				<div class="pannelinput">Signpost type
					<select name="type" autocomplete="off">
						<option value="0">Script</option>
						<option value="1">Script, if hero is facing top</option>
						<option value="2">Script, if hero is facing down</option>
						<option value="3">Script, if hero is facing right</option>
						<option value="4">Script, if hero is facing left</option>
						<option value="5">Hidden item</option>
						<option value="6">Hidden item</option>
						<option value="7">Hidden item</option>
						<option value="8">Secret base (Only R/S/E)</option>
					</select>
				</div>
				<div class="item_pannel signtype_pannel hide">
					<div class="pannelinput">Item name
						<select name="item" class="selectItems" autocomplete="off"></select>
					</div>
					<div class="pannelinput">Hidden ID
						<input type="text" name="hiddenId" autocomplete="off" />
					</div>
					<div class="pannelinput">Amount
						<input type="number" min="0" max="255" name="amount" autocomplete="off" />
					</div>
				</div>
				<div class="base_pannel signtype_pannel hide">
					<div class="pannelinput">Secret base ID
						<input type="number" min="0" max="255" name="base" autocomplete="off" />
					</div>
				</div>
			</div>
			<div class="subpannel warp_pannel hide">
				<div class="pannelinput">Map<input type="number" min="0" max="255" name="map" autocomplete="off" /></div>
				<div class="pannelinput">Bank<input type="number" min="0" max="255" name="bank" autocomplete="off" /></div>
				<div class="pannelinput">Warp<input type="number" min="0" max="255" name="warp" autocomplete="off" /></div>
				<div class="clear"></div>
				<button>Visit map</button>
				<div class="pannelbar"></div>
			</div>
			<div class="subpannel special_pannel person_pannel script_pannel hide">
				<div class="pannelinput script">Script Offset<input type="text" name="script" maxlength="6" autocomplete="off" /><button>Watch Script</button></div>
				<div class="pannelbar"></div>
			</div>
			<div class="panneloption delete_event scriptoption"><i class="delete"></i>Remove</div>
			<div class="panneloption add_event">Add Event</div>
			<div class="pannel">
				<div class="dropbox" id="addevent">
					<div class="dropbox_title">-- Event --</div>
					<div class="options">
						<div data-option="0">Person</div>
						<div data-option="1">Warp</div>
						<div data-option="2">Script</div>
						<div data-option="3">Sign</div>
					</div>
				</div>
			</div>
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
