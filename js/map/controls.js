class MapControls {
  static labels = new Map([
    [0, "Paint blocks"], [1, "Move events"], [2, "Pan map"],
    [3, "Inspect events"], [4, "Enter connected map"],
    [5, "Pick block"], [6, "Fill region"],
    [7, "Zoom out"], [8, "Zoom in"],
    [MapLayerModes.ALL, "Map + events"], [MapLayerModes.MAP, "Map only"],
    [MapLayerModes.EVENTS, "Events focus"], [MapLayerModes.COLLISION, "Collision / height overlay"],
    [13, "Selection"], [14, "Show grid"], [15, "Hide grid"]
  ]);

  constructor(root, onChange, {family="gba",signal,defaultMode=2}={}) {
    this.root = root;
    this.onChange = onChange;
    this.family = family;
    this.signal=signal;
    this.selectDefault(defaultMode);
    this.status = Dom.create("div", {className: "map_tool_status", text: MapControls.labels.get(this.active)});
    root.querySelector(".map_tool")?.parentElement.prepend(this.status);
    this.bindTools();
    this.bindWindows();
    this.onChange?.(this.active);
  }

  selectDefault(mode) {
    const tools=[...this.root.querySelectorAll(".map_tool")];
    const preferred=tools.find(tool=>tool.dataset.type.split("-").map(Number).includes(mode)&&!tool.classList.contains("family-unavailable"));
    const selected=preferred??tools.find(tool=>tool.classList.contains("selected")&&!tool.classList.contains("family-unavailable"))??tools.find(tool=>!tool.classList.contains("family-unavailable"));
    tools.forEach(tool=>tool.classList.toggle("selected",tool===selected));
    if(selected&&selected.dataset.type.split("-").map(Number).includes(mode))selected.dataset.current=String(mode);
    this.active=Number(selected?.dataset.current??mode);
  }

  bindTools() {
    this.root.querySelectorAll(".map_tool").forEach((tool) => {
      tool.setAttribute("role", "button");
      tool.tabIndex = 0;
      const activate = () => this.activate(tool);
      tool.addEventListener("click", activate,{signal:this.signal});
      tool.addEventListener("keydown", (event) => {
        if(event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      },{signal:this.signal});
      this.describe(tool);
    });
  }

  activate(tool) {
    if(tool.classList.contains("selected")) {
      const sequence = tool.dataset.type.split("-").map(Number);
      const current = Number(tool.dataset.current);
      tool.dataset.current = String(sequence[(sequence.indexOf(current) + 1) % sequence.length]);
    } else {
      this.root.querySelector(".map_tool.selected")?.classList.remove("selected");
      tool.classList.add("selected");
    }
    this.active = Number(tool.dataset.current);
    this.root.querySelectorAll(".map_tool").forEach((item) => this.describe(item));
    this.status.textContent = MapControls.labels.get(this.active);
    this.onChange?.(this.active);
  }

  describe(tool) {
    const label = MapControls.labels.get(Number(tool.dataset.current)) ?? "Map tool";
    tool.title = label;
    tool.setAttribute("aria-label", label);
    tool.setAttribute("aria-pressed", String(tool.classList.contains("selected")));
  }

  bindWindows() {
    this.windowManager=MapWindowManager.for(this.root,this.family).enhance(".window",["gba","gb","gen2"]);
  }

  clampWindows() {
    this.windowManager?.clamp();
  }
}
((globalThis.PokemonViewer ||= {}).maps ||= {}).Controls=MapControls;
