# Viewport & Layout System Specification - Coral Engine v0.5.0

## Overview

Sistema de layout estilo Blender con:
- Panels redimensionables con splitters
- Floating windows (dockables)
- Multi-viewport support
- Persistencia en SQLite
- Animaciones en resize/dock

---

## 1. Layout Model

### 1.1 Layout Node

```rust
pub enum LayoutNode {
    Panel(PanelNode),
    Split(SplitNode),
    Floating(FloatingNode),
    Viewport(ViewportNode),
}

pub enum SplitDirection {
    Horizontal,  // left/right
    Vertical,    // top/bottom
}

pub struct SplitNode {
    pub direction: SplitDirection,
    pub ratio: f32,           // 0.0 - 1.0
    pub min_ratio: f32,      // minimum size constraint
    pub children: [Box<LayoutNode>; 2],
    pub grip_size: f32,      // width of drag handle
    pub collapsible: bool,   // can collapse to 0
}
```

### 1.2 Panel Node

```rust
pub enum PanelRegion {
    Left,
    Right,
    Top,
    Bottom,
    Center,  // viewport principal
}

pub enum PanelContent {
    SceneOutliner,
    Properties,
    OceanConfig,
    Stats,
    Controls,
    Custom(&'static str),  // panel identifier
}

pub struct PanelNode {
    pub id: PanelId,
    pub region: PanelRegion,
    pub title: String,
    pub min_size: f32,
    pub max_size: f32,
    pub collapsed: bool,
    pub content: PanelContent,
}

pub type PanelId = &'static str;

// Predefined panel IDs
pub const PANEL_OUTLINER: PanelId = "outliner";
pub const PANEL_PROPERTIES: PanelId = "properties";
pub const PANEL_OCEAN_CONFIG: PanelId = "ocean_config";
pub const PANEL_STATS: PanelId = "stats";
pub const PANEL_CONTROLS: PanelId = "controls";
```

### 1.3 Floating Node

```rust
pub struct FloatingNode {
    pub id: FloatingId,
    pub parent_panel: Option<PanelId>,
    pub position: Pos2,
    pub size: Vec2,
    pub title: String,
    pub dockable: bool,
    pub minimizeable: bool,
    pub maximizeable: bool,
    pub content: PanelContent,
}

pub type FloatingId = u64;
```

### 1.4 Viewport Node

```rust
pub enum ViewportType {
    Perspective3D,
    TopDown,
    Front,
    Side,
    UVEditor,
    GraphEditor,
}

pub struct ViewportNode {
    pub id: ViewportId,
    pub viewport_type: ViewportType,
    pub camera: CameraState,
    pub show_grid: bool,
    pub show_axes: bool,
    pub background_color: Color,
}

pub type ViewportId = u64;
```

---

## 2. Layout State

```rust
pub struct LayoutState {
    pub root: Box<LayoutNode>,
    pub floating: Vec<FloatingNode>,
    pub active_panel: Option<PanelId>,
    pub active_viewport: ViewportId,
    pub layouts: HashMap<String, Box<LayoutNode>>,
    pub default_layout: String,
}

impl Default for LayoutState {
    fn default() -> Self {
        Self::blender_default()
    }
}

impl LayoutState {
    /// Default Blender-style layout
    pub fn blender_default() -> Self {
        // Left: Outliner (200px)
        // Center: Viewport
        // Right: Properties (280px) + Stats stacked
        // Bottom: Controls (collapsed)
        
        let left_panel = PanelNode {
            id: PANEL_OUTLINER,
            region: PanelRegion::Left,
            title: "Outliner".to_string(),
            min_size: 150.0,
            max_size: 400.0,
            collapsed: false,
            content: PanelContent::SceneOutliner,
        };
        
        let right_split = SplitNode {
            direction: SplitDirection::Vertical,
            ratio: 0.7,
            min_ratio: 0.3,
            children: [
                Box::new(LayoutNode::Panel(PanelNode {
                    id: PANEL_PROPERTIES,
                    region: PanelRegion::Right,
                    title: "Properties".to_string(),
                    min_size: 200.0,
                    max_size: 500.0,
                    collapsed: false,
                    content: PanelContent::Properties,
                })),
                Box::new(LayoutNode::Panel(PanelNode {
                    id: PANEL_STATS,
                    region: PanelRegion::Right,
                    title: "Statistics".to_string(),
                    min_size: 100.0,
                    max_size: 300.0,
                    collapsed: false,
                    content: PanelContent::Stats,
                })),
            ],
            grip_size: 4.0,
            collapsible: true,
        };
        
        let main_split = SplitNode {
            direction: SplitDirection::Horizontal,
            ratio: 0.2,  // left panel width
            min_ratio: 0.1,
            children: [
                Box::new(LayoutNode::Panel(left_panel)),
                Box::new(LayoutNode::Split(right_split)),
            ],
            grip_size: 4.0,
            collapsible: false,
        };
        
        let mut layouts = HashMap::new();
        layouts.insert("default".to_string(), Box::new(LayoutNode::Split(main_split)));
        
        Self {
            root: Box::new(LayoutNode::Split(main_split)),
            floating: Vec::new(),
            active_panel: None,
            active_viewport: 1,
            layouts,
            default_layout: "default".to_string(),
        }
    }
    
    // === Layout Management ===
    pub fn load_layout(&mut self, name: &str) -> bool {
        if let Some(root) = self.layouts.remove(name) {
            self.root = root;
            true
        } else {
            false
        }
    }
    
    pub fn save_layout(&mut self, name: String) {
        // Clone current root into layouts
        self.layouts.insert(name, self.root.clone());
    }
    
    pub fn reset_to_default(&mut self) {
        self.load_layout(&self.default_layout);
    }
    
    // === Panel Operations ===
    pub fn add_panel(&mut self, region: PanelRegion, content: PanelContent, title: &str) -> PanelId {
        let id = generate_panel_id();
        
        let panel = PanelNode {
            id,
            region,
            title: title.to_string(),
            min_size: 150.0,
            max_size: 500.0,
            collapsed: false,
            content,
        };
        
        // Insert into layout (simplified - adds to region)
        // Full implementation would find correct spot in tree
        self.root = Box::new(LayoutNode::Panel(panel));
        
        id
    }
    
    pub fn remove_panel(&mut self, id: PanelId) {
        // Remove panel from layout tree
        // This would recursively search and remove
    }
    
    pub fn collapse_panel(&mut self, id: PanelId) {
        // Toggle collapsed state
    }
    
    // === Floating Operations ===
    pub fn create_floating(&mut self, content: PanelContent, title: &str, position: Pos2, size: Vec2) -> FloatingId {
        let id = self.floating.len() as FloatingId;
        
        let floating = FloatingNode {
            id,
            parent_panel: None,
            position,
            size,
            title: title.to_string(),
            dockable: true,
            minimizeable: true,
            maximizeable: true,
            content,
        };
        
        self.floating.push(floating);
        id
    }
    
    pub fn dock_floating(&mut self, floating_id: FloatingId, region: PanelRegion) {
        // Convert floating to docked panel
    }
    
    pub fn close_floating(&mut self, floating_id: FloatingId) {
        self.floating.retain(|f| f.id != floating_id);
    }
}
```

---

## 3. Resize System

### 3.1 Splitter State

```rust
pub struct SplitterState {
    pub split_id: usize,
    pub is_dragging: bool,
    pub drag_start: Option<f32>,
    pub current_ratio: f32,
}

impl SplitterState {
    pub fn hit_test(&self, pos: Pos2, splitter_rect: Rect) -> bool {
        // Check if cursor is over splitter
        splitter_rect.contains(pos)
    }
    
    pub fn start_drag(&mut self, pos: Pos2, current_ratio: f32) {
        self.is_dragging = true;
        self.drag_start = Some(current_ratio);
        self.current_ratio = current_ratio;
    }
    
    pub fn update_drag(&mut self, delta: f32, total_size: f32, min_ratio: f32, max_ratio: f32) {
        if self.is_dragging {
            let delta_ratio = delta / total_size;
            self.current_ratio = (self.current_ratio + delta_ratio).clamp(min_ratio, max_ratio);
        }
    }
    
    pub fn end_drag(&mut self) {
        self.is_dragging = false;
        self.drag_start = None;
    }
}
```

### 3.2 Animation State

```rust
pub struct PanelAnimation {
    pub panel_id: PanelId,
    pub animation_type: PanelAnimationType,
    pub progress: f32,  // 0.0 - 1.0
    pub duration_ms: u32,
    pub start_time: std::time::Instant,
    pub target_value: f32,
    pub start_value: f32,
}

pub enum PanelAnimationType {
    Resize { axis: ResizeAxis },
    Collapse { target_collapsed: bool },
    Dock { target_region: PanelRegion },
    Float { target_position: Pos2 },
}

pub enum ResizeAxis {
    Width,
    Height,
}

impl PanelAnimation {
    pub fn new_resize(panel_id: PanelId, from: f32, to: f32, duration_ms: u32) -> Self {
        Self {
            panel_id,
            animation_type: PanelAnimationType::Resize { axis: ResizeAxis::Width },
            progress: 0.0,
            duration_ms,
            start_time: std::time::Instant::now(),
            target_value: to,
            start_value: from,
        }
    }
    
    pub fn update(&mut self) -> bool {
        let elapsed = self.start_time.elapsed().as_millis() as f32;
        self.progress = (elapsed / self.duration_ms as f32).min(1.0);
        
        // Easing: ease-out cubic
        let eased = 1.0 - (1.0 - self.progress).powi(3);
        
        // Check if complete
        self.progress >= 1.0
    }
    
    pub fn current_value(&self) -> f32 {
        let eased = 1.0 - (1.0 - self.progress).powi(3);
        self.start_value + (self.target_value - self.start_value) * eased
    }
}
```

---

## 4. Viewport Manager

### 4.1 Viewport State

```rust
pub struct ViewportManager {
    viewports: HashMap<ViewportId, ViewportState>,
    active: ViewportId,
    next_id: ViewportId,
}

impl Default for ViewportManager {
    fn default() -> Self {
        let mut viewports = HashMap::new();
        
        // Create main viewport
        let main = ViewportState {
            id: 1,
            viewport_type: ViewportType::Perspective3D,
            camera: CameraState::default(),
            show_grid: true,
            show_axes: true,
            background_color: Color::from_rgb(0.4, 0.6, 0.9),
        };
        
        viewports.insert(1, main);
        
        Self {
            viewports,
            active: 1,
            next_id: 2,
        }
    }
}

impl ViewportManager {
    pub fn create_viewport(&mut self, viewport_type: ViewportType) -> ViewportId {
        let id = self.next_id;
        self.next_id += 1;
        
        let viewport = ViewportState {
            id,
            viewport_type,
            camera: CameraState::default(),
            show_grid: true,
            show_axes: true,
            background_color: Color::from_rgb(0.4, 0.6, 0.9),
        };
        
        self.viewports.insert(id, viewport);
        id
    }
    
    pub fn set_active(&mut self, id: ViewportId) {
        if self.viewports.contains_key(&id) {
            self.active = id;
        }
    }
    
    pub fn close_viewport(&mut self, id: ViewportId) {
        if id != 1 && self.viewports.contains_key(&id) {
            self.viewports.remove(&id);
            if self.active == id {
                self.active = 1;
            }
        }
    }
    
    pub fn sync_cameras(&mut self, source: ViewportId, target: ViewportId) {
        if let (Some(src), Some(tgt)) = (
            self.viewports.get(&source),
            self.viewports.get_mut(&target),
        ) {
            tgt.camera = src.camera.clone();
        }
    }
    
    pub fn get_active(&self) -> &ViewportState {
        self.viewports.get(&self.active).unwrap()
    }
    
    pub fn get_active_mut(&mut self) -> &mut ViewportState {
        self.viewports.get_mut(&self.active).unwrap()
    }
}
```

---

## 5. Panel Registry (Trait-based)

### 5.1 Panel Content Trait

```rust
pub trait PanelContentTrait: Send {
    fn title(&self) -> String;
    fn render(&mut self, ui: &mut egui::Ui);
    fn min_size(&self) -> Vec2;
    fn supports_floating(&self) -> bool { true }
    fn on_open(&mut self) {}
    fn on_close(&mut self) {}
}

pub struct PanelRegistry {
    panels: HashMap<PanelId, Box<dyn PanelContentTrait>>,
}

impl PanelRegistry {
    pub fn new() -> Self {
        let mut registry = Self { panels: HashMap::new() };
        registry.register_default_panels();
        registry
    }
    
    fn register_default_panels(&mut self) {
        // Register built-in panels
        self.panels.insert(PANEL_OUTLINER, Box::new(OutlinerPanel));
        self.panels.insert(PANEL_PROPERTIES, Box::new(PropertiesPanel));
        self.panels.insert(PANEL_OCEAN_CONFIG, Box::new(OceanConfigPanel));
        self.panels.insert(PANEL_STATS, Box::new(StatsPanel));
        self.panels.insert(PANEL_CONTROLS, Box::new(ControlsPanel));
    }
    
    pub fn register<T: PanelContentTrait + 'static>(&mut self, id: PanelId, panel: T) {
        self.panels.insert(id, Box::new(panel));
    }
    
    pub fn get(&self, id: PanelId) -> Option<&dyn PanelContentTrait> {
        self.panels.get(id).map(|p| p.as_ref())
    }
    
    pub fn get_mut(&mut self, id: PanelId) -> Option<&mut dyn PanelContentTrait> {
        self.panels.get_mut(id).map(|p| p.as_mut())
    }
}
```

### 5.2 Built-in Panel Implementations

```rust
pub struct OutlinerPanel;
impl PanelContentTrait for OutlinerPanel {
    fn title(&self) -> String { "Outliner".to_string() }
    fn render(&mut self, ui: &mut egui::Ui) { /* render scene tree */ }
    fn min_size(&self) -> Vec2 { vec2(150.0, 200.0) }
}

pub struct PropertiesPanel;
impl PanelContentTrait for PropertiesPanel {
    fn title(&self) -> String { "Properties".to_string() }
    fn render(&mut self, ui: &mut egui::Ui) { /* render object props */ }
    fn min_size(&self) -> Vec2 { vec2(200.0, 300.0) }
}

pub struct OceanConfigPanel;
impl PanelContentTrait for OceanConfigPanel {
    fn title(&self) -> String { "Ocean Config".to_string() }
    fn render(&mut self, ui: &mut egui::Ui) { /* render ocean settings */ }
    fn min_size(&self) -> Vec2 { vec2(250.0, 400.0) }
}

pub struct StatsPanel;
impl PanelContentTrait for StatsPanel {
    fn title(&self) -> String { "Statistics".to_string() }
    fn render(&mut self, ui: &mut egui::Ui) { /* render stats */ }
    fn min_size(&self) -> Vec2 { vec2(150.0, 100.0) }
}

pub struct ControlsPanel;
impl PanelContentTrait for ControlsPanel {
    fn title(&self) -> String { "Controls".to_string() }
    fn render(&mut self, ui: &mut egui::Ui) { /* render controls help */ }
    fn min_size(&self) -> Vec2 { vec2(200.0, 150.0) }
    fn supports_floating(&self) -> bool { false }
}
```

---

## 6. Persistence (SQLite)

### 6.1 Schema

```sql
-- Layouts
CREATE TABLE IF NOT EXISTS layouts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_default INTEGER DEFAULT 0,
    data BLOB NOT NULL,  -- serialized LayoutNode tree
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL
);

-- Floating window positions
CREATE TABLE IF NOT EXISTS floating_windows (
    id INTEGER PRIMARY KEY,
    layout_name TEXT NOT NULL,
    panel_id TEXT NOT NULL,
    pos_x REAL NOT NULL,
    pos_y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    FOREIGN KEY (layout_name) REFERENCES layouts(name)
);

-- Viewport configurations
CREATE TABLE IF NOT EXISTS viewport_configs (
    id INTEGER PRIMARY KEY,
    layout_name TEXT NOT NULL,
    viewport_type TEXT NOT NULL,
    camera_pos_x REAL, camera_pos_y REAL, camera_pos_z REAL,
    camera_rot_x REAL, camera_rot_y REAL,
    show_grid INTEGER, show_axes INTEGER,
    FOREIGN KEY (layout_name) REFERENCES layouts(name)
);
```

---

## 7. Implementation Priority

### Phase 2a: Layout Core (Week 3)
- [ ] LayoutNode enum with Panel, Split, Floating
- [ ] LayoutState with blender_default()
- [ ] Basic panel rendering

### Phase 2b: Resize System (Week 3-4)
- [ ] Splitter drag detection
- [ ] Size calculation from ratios
- [ ] Min/max constraints

### Phase 2c: Animation System (Week 4)
- [ ] PanelAnimation struct
- [ ] Easing functions
- [ ] Animation queue and update

### Phase 2d: Multi-Viewport (Week 5-6)
- [ ] ViewportManager
- [ ] Viewport creation/deletion
- [ ] Camera sync

### Phase 2e: Panel Registry (Week 7-8)
- [ ] PanelContentTrait
- [ ] Built-in panel implementations
- [ ] Drag & drop dock system

---

## 8. Integration with Coordinator

```rust
pub struct EngineCoordinator {
    // ... existing fields
    pub layout_state: LayoutState,
    pub panel_registry: PanelRegistry,
    pub viewport_manager: ViewportManager,
    pub animations: Vec<PanelAnimation>,
}

impl EngineCoordinator {
    fn tick(&mut self) {
        // Update animations
        self.animations.retain(|a| !a.update());
        
        // Handle splitter interactions
        // Render layout
    }
    
    fn render_layout(&mut self, ctx: &egui::Context) {
        render_layout_tree(ctx, &mut self.layout_state, &self.panel_registry);
        
        // Render floating windows
        for floating in &self.layout_state.floating {
            render_floating(ctx, floating, &self.panel_registry);
        }
    }
}
```

---

## 9. UI Panel for Layout Settings

```rust
pub fn render_layout_settings(ctx: &egui::Context, layout: &mut LayoutState) {
    egui::Window::new("Layout Settings")
        .anchor(egui::Align2::RIGHT_TOP, (-10.0, 10.0))
        .show(ctx, |ui| {
            ui.heading("Layouts");
            
            // Layout selector
            let layout_names: Vec<_> = layout.layouts.keys().collect();
            // ... dropdown to select layout
            
            ui.separator();
            
            // Save/Load buttons
            ui.horizontal(|ui| {
                if ui.button("Save").clicked() {
                    // Save current layout
                }
                if ui.button("Reset").clicked() {
                    layout.reset_to_default();
                }
            });
            
            ui.separator();
            
            // Add panel
            ui.heading("Add Panel");
            // ... buttons to add panels
        });
}
```