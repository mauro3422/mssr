# Input System Specification - Coral Engine v0.5.0

## Overview

Refactor del sistema de input para soportar:
- Contextos de input (Object Mode, Edit Mode, etc.)
- Key combos (Ctrl+S, Shift+Click, Alt+Drag)
- Action system con metadata y categorías
- Input profiles (Blender-style como inicial)
- Persistencia en SQLite

---

## 1. Data Structures

### 1.1 Input Context

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Default)]
pub enum InputContext {
    #[default]
    ViewMode,      // navegación libre (default actual)
    ObjectMode,   // selección de objetos
    EditMode,     // edición de vértices/aristas/faces
    PaintMode,    // pintura de texturas
}

impl InputContext {
    pub fn all() -> &'static [InputContext] {
        &[
            InputContext::ViewMode,
            InputContext::ObjectMode,
            InputContext::EditMode,
            InputContext::PaintMode,
        ]
    }
    
    pub fn name(&self) -> &'static str {
        match self {
            InputContext::ViewMode => "View",
            InputContext::ObjectMode => "Object",
            InputContext::EditMode => "Edit",
            InputContext::PaintMode => "Paint",
        }
    }
}
```

### 1.2 Key Modifiers

```rust
use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Default)]
pub struct KeyModifiers {
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
    pub logo: bool,  // Windows key / Command on Mac
}

impl KeyModifiers {
    pub fn none() -> Self { Self::default() }
    
    pub fn ctrl() -> Self { Self { ctrl: true, ..Default::default() } }
    pub fn shift() -> Self { Self { shift: true, ..Default::default() } }
    pub fn alt() -> Self { Self { alt: true, ..Default::default() } }
    
    pub fn is_empty(&self) -> bool {
        !self.ctrl && !self.shift && !self.alt && !self.logo
    }
    
    pub fn has_any(&self) -> bool {
        self.ctrl || self.shift || self.alt || self.logo
    }
}

impl fmt::Display for KeyModifiers {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut parts = Vec::new();
        if self.ctrl { parts.push("Ctrl"); }
        if self.shift { parts.push("Shift"); }
        if self.alt { parts.push("Alt"); }
        if self.logo { parts.push("Logo"); }
        
        if parts.is_empty() {
            write!(f, "None")
        } else {
            write!(f, "{}", parts.join("+"))
        }
    }
}
```

### 1.3 Key Combo

```rust
use winit::keyboard::KeyCode;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct KeyCombo {
    pub modifiers: KeyModifiers,
    pub key: KeyCode,
}

impl KeyCombo {
    pub fn from_key(key: KeyCode) -> Self {
        Self {
            modifiers: KeyModifiers::none(),
            key,
        }
    }
    
    pub fn with_ctrl(key: KeyCode) -> Self {
        Self {
            modifiers: KeyModifiers::ctrl(),
            key,
        }
    }
    
    pub fn with_shift(key: KeyCode) -> Self {
        Self {
            modifiers: KeyModifiers::shift(),
            key,
        }
    }
    
    pub fn with_alt(key: KeyCode) -> Self {
        Self {
            modifiers: KeyModifiers::alt(),
            key,
        }
    }
    
    pub fn with_modifiers(modifiers: KeyModifiers, key: KeyCode) -> Self {
        Self { modifiers, key }
    }
}

impl fmt::Display for KeyCombo {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut parts = Vec::new();
        
        if self.modifiers.ctrl { parts.push("Ctrl"); }
        if self.modifiers.shift { parts.push("Shift"); }
        if self.modifiers.alt { parts.push("Alt"); }
        if self.modifiers.logo { parts.push("Logo"); }
        
        // Add key name
        let key_name = match self.key {
            KeyCode::KeyW => "W",
            KeyCode::KeyA => "A",
            KeyCode::KeyS => "S",
            KeyCode::KeyD => "D",
            KeyCode::KeyQ => "Q",
            KeyCode::KeyE => "E",
            KeyCode::Space => "Space",
            KeyCode::ShiftLeft => "ShiftL",
            KeyCode::ShiftRight => "ShiftR",
            KeyCode::ControlLeft => "CtrlL",
            KeyCode::ControlRight => "CtrlR",
            KeyCode::Escape => "Esc",
            KeyCode::Enter => "Enter",
            KeyCode::Tab => "Tab",
            _ => "???",
        };
        parts.push(key_name);
        
        write!(f, "{}", parts.join("+"))
    }
}
```

### 1.4 Action Category

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ActionCategory {
    Navigation,
    Selection,
    Transform,
    View,
    Edit,
    File,
    Help,
}

impl ActionCategory {
    pub fn all() -> &'static [ActionCategory] {
        &[
            ActionCategory::Navigation,
            ActionCategory::Selection,
            ActionCategory::Transform,
            ActionCategory::View,
            ActionCategory::Edit,
            ActionCategory::File,
            ActionCategory::Help,
        ]
    }
    
    pub fn name(&self) -> &'static str {
        match self {
            ActionCategory::Navigation => "Navigation",
            ActionCategory::Selection => "Selection",
            ActionCategory::Transform => "Transform",
            ActionCategory::View => "View",
            ActionCategory::Edit => "Edit",
            ActionCategory::File => "File",
            ActionCategory::Help => "Help",
        }
    }
}
```

### 1.5 Input Action

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum InputAction {
    // Navigation
    MoveForward,
    MoveBackward,
    MoveLeft,
    MoveRight,
    MoveUp,
    MoveDown,
    CameraRotate,
    CameraZoom,
    
    // Speed modifiers
    SpeedBoost,
    SpeedSlow,
    
    // Selection
    Select,
    SelectAll,
    Deselect,
    AddToSelection,
    RemoveFromSelection,
    
    // Transform
    Grab,
    Rotate,
    Scale,
    
    // View
    ViewTop,
    ViewBottom,
    ViewFront,
    ViewBack,
    ViewLeft,
    ViewRight,
    ViewPerspective,
    ViewOrthographic,
    ToggleViewClipping,
    
    // Edit modes
    EnterEditMode,
    ExitEditMode,
    EditModeVertex,
    EditModeEdge,
    EditModeFace,
    
    // File
    NewScene,
    OpenScene,
    SaveScene,
    SaveSceneAs,
    Export,
    
    // UI
    ToggleUI,
    TogglePanel,
    Undo,
    Redo,
    
    // Game
    Pause,
    Play,
    Interact,
    
    // Context switching
    SwitchToViewMode,
    SwitchToObjectMode,
    SwitchToEditMode,
    SwitchToPaintMode,
}
```

### 1.6 Action Metadata

```rust
pub struct ActionMetadata {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub category: ActionCategory,
    pub default_context: InputContext,
}

impl ActionMetadata {
    pub fn from_action(action: InputAction) -> Self {
        match action {
            InputAction::MoveForward => Self {
                id: "move_forward",
                name: "Move Forward",
                description: "Move camera/selection forward",
                category: ActionCategory::Navigation,
                default_context: InputContext::ViewMode,
            },
            _ => Self {
                id: "unknown",
                name: "Unknown",
                description: "Unknown action",
                category: ActionCategory::Navigation,
                default_context: InputContext::ViewMode,
            },
        }
    }
}
```

---

## 2. Action Map System

### 2.1 Context Action Map

```rust
pub struct ContextActionMap {
    maps: std::collections::HashMap<InputContext, ActionMap>,
    active: InputContext,
}

impl Default for ContextActionMap {
    fn default() -> Self {
        Self::blender_style()
    }
}

impl ContextActionMap {
    pub fn new() -> Self {
        let mut maps = std::collections::HashMap::new();
        
        // Initialize all contexts with empty maps
        for context in InputContext::all() {
            maps.insert(*context, ActionMap::new());
        }
        
        Self {
            maps,
            active: InputContext::ViewMode,
        }
    }
    
    /// Create a Blender-style keymap (default)
    pub fn blender_style() -> Self {
        let mut this = Self::new();
        
        // === VIEW MODE (navegación) ===
        let view_map = this.maps.get_mut(&InputContext::ViewMode).unwrap();
        
        // Navigation
        view_map.bind(KeyCombo::from_key(KeyCode::KeyW), InputAction::MoveForward);
        view_map.bind(KeyCombo::from_key(KeyCode::KeyS), InputAction::MoveBackward);
        view_map.bind(KeyCombo::from_key(KeyCode::KeyA), InputAction::MoveLeft);
        view_map.bind(KeyCombo::from_key(KeyCode::KeyD), InputAction::MoveRight);
        view_map.bind(KeyCombo::from_key(KeyCode::Space), InputAction::MoveUp);
        view_map.bind(KeyCombo::from_key(KeyCode::ShiftLeft), InputAction::MoveDown);
        
        // Speed modifiers
        view_map.bind(KeyCombo::from_key(KeyCode::KeyQ), InputAction::SpeedBoost);
        view_map.bind(KeyCombo::from_key(KeyCode::KeyE), InputAction::SpeedSlow);
        
        // View shortcuts (Blender-style: Numpad)
        view_map.bind(KeyCombo::from_key(KeyCode::Numpad7), InputAction::ViewTop);
        view_map.bind(KeyCombo::from_key(KeyCode::Numpad1), InputAction::ViewFront);
        view_map.bind(KeyCombo::from_key(KeyCode::Numpad3), InputAction::ViewRight);
        view_map.bind(KeyCombo::from_key(KeyCode::Numpad5), InputAction::ViewPerspective);
        
        // Context switching (Tab to toggle)
        view_map.bind(KeyCombo::from_key(KeyCode::Tab), InputAction::SwitchToObjectMode);
        
        // File (Ctrl...)
        view_map.bind(KeyCombo::with_ctrl(KeyCode::KeyS), InputAction::SaveScene);
        view_map.bind(KeyCombo::with_ctrl(KeyCode::KeyO), InputAction::OpenScene);
        view_map.bind(KeyCombo::with_ctrl(KeyCode::KeyN), InputAction::NewScene);
        
        // UI
        view_map.bind(KeyCombo::with_ctrl(KeyCode::KeyZ), InputAction::Undo);
        view_map.bind(KeyCombo::with_ctrl(KeyCode::KeyY), InputAction::Redo);
        
        // === OBJECT MODE ===
        let object_map = this.maps.get_mut(&InputContext::ObjectMode).unwrap();
        
        object_map.bind(KeyCombo::from_key(KeyCode::KeyG), InputAction::Grab);
        object_map.bind(KeyCombo::from_key(KeyCode::KeyR), InputAction::Rotate);
        object_map.bind(KeyCombo::from_key(KeyCode::KeyS), InputAction::Scale);
        object_map.bind(KeyCombo::from_key(KeyCode::Tab), InputAction::SwitchToEditMode);
        object_map.bind(KeyCombo::from_key(KeyCode::KeyA), InputAction::SelectAll);
        
        // === EDIT MODE ===
        let edit_map = this.maps.get_mut(&InputContext::EditMode).unwrap();
        
        edit_map.bind(KeyCombo::from_key(KeyCode::Tab), InputAction::SwitchToObjectMode);
        edit_map.bind(KeyCombo::from_key(KeyCode::Key1), InputAction::EditModeVertex);
        edit_map.bind(KeyCombo::from_key(KeyCode::Key2), InputAction::EditModeEdge);
        edit_map.bind(KeyCombo::from_key(KeyCode::Key3), InputAction::EditModeFace);
        
        this
    }
    
    pub fn active_context(&self) -> InputContext {
        self.active
    }
    
    pub fn set_active_context(&mut self, context: InputContext) {
        self.active = context;
    }
    
    pub fn get_active_map(&self) -> &ActionMap {
        self.maps.get(&self.active).unwrap()
    }
    
    pub fn get_active_map_mut(&mut self) -> &mut ActionMap {
        self.maps.get_mut(&self.active).unwrap()
    }
    
    pub fn get_map(&self, context: InputContext) -> &ActionMap {
        self.maps.get(&context).unwrap()
    }
    
    pub fn get_map_mut(&mut self, context: InputContext) -> &mut ActionMap {
        self.maps.get_mut(&context).unwrap()
    }
}
```

### 2.2 Action Map (per context)

```rust
pub struct ActionMap {
    bindings: std::collections::HashMap<KeyCombo, InputAction>,
    inverse: std::collections::HashMap<InputAction, KeyCombo>,
}

impl Default for ActionMap {
    fn default() -> Self { Self::new() }
}

impl ActionMap {
    pub fn new() -> Self {
        Self {
            bindings: std::collections::HashMap::new(),
            inverse: std::collections::HashMap::new(),
        }
    }
    
    pub fn bind(&mut self, combo: KeyCombo, action: InputAction) {
        self.bindings.insert(combo, action);
        self.inverse.insert(action, combo);
    }
    
    pub fn unbind(&mut self, combo: &KeyCombo) {
        if let Some(action) = self.bindings.remove(combo) {
            self.inverse.remove(&action);
        }
    }
    
    pub fn unbind_action(&mut self, action: InputAction) {
        if let Some(combo) = self.inverse.remove(&action) {
            self.bindings.remove(&combo);
        }
    }
    
    pub fn action_for(&self, combo: &KeyCombo) -> Option<InputAction> {
        self.bindings.get(combo).copied()
    }
    
    pub fn combo_for(&self, action: InputAction) -> Option<KeyCombo> {
        self.inverse.get(&action).copied()
    }
    
    pub fn is_bound(&self, combo: &KeyCombo) -> bool {
        self.bindings.contains_key(combo)
    }
    
    pub fn all_bindings(&self) -> impl Iterator<Item = (&KeyCombo, &InputAction)> {
        self.bindings.iter()
    }
    
    pub fn clear(&mut self) {
        self.bindings.clear();
        self.inverse.clear();
    }
}
```

---

## 3. Action State Tracking

### 3.1 Action Event

```rust
#[derive(Clone, Debug)]
pub enum ActionEventType {
    Pressed,
    Released,
    Repeat,  // held down, repeated
}

#[derive(Clone, Debug)]
pub struct ActionEvent {
    pub action: InputAction,
    pub event_type: ActionEventType,
    pub context: InputContext,
    pub timestamp: std::time::Instant,
}

impl ActionEvent {
    pub fn pressed(action: InputAction, context: InputContext) -> Self {
        Self {
            action,
            event_type: ActionEventType::Pressed,
            context,
            timestamp: std::time::Instant::now(),
        }
    }
    
    pub fn released(action: InputAction, context: InputContext) -> Self {
        Self {
            action,
            event_type: ActionEventType::Released,
            context,
            timestamp: std::time::Instant::now(),
        }
    }
}
```

### 3.2 Action State

```rust
#[derive(Clone, Debug, Default)]
pub struct ActionState {
    active: std::collections::HashSet<InputAction>,
    just_pressed: std::collections::HashSet<InputAction>,
    just_released: std::collections::HashSet<InputAction>,
}

impl ActionState {
    pub fn new() -> Self {
        Self::default()
    }
    
    pub fn press(&mut self, action: InputAction) {
        if self.active.insert(action) {
            self.just_pressed.insert(action);
        }
    }
    
    pub fn release(&mut self, action: InputAction) {
        if self.active.remove(&action) {
            self.just_released.insert(action);
        }
    }
    
    pub fn is_active(&self, action: InputAction) -> bool {
        self.active.contains(&action)
    }
    
    pub fn is_just_pressed(&self, action: InputAction) -> bool {
        self.just_pressed.contains(&action)
    }
    
    pub fn is_just_released(&self, action: InputAction) -> bool {
        self.just_released.contains(&action)
    }
    
    pub fn active_actions(&self) -> impl Iterator<Item = &InputAction> {
        self.active.iter()
    }
    
    pub fn clear_frame(&mut self) {
        self.just_pressed.clear();
        self.just_released.clear();
    }
}
```

---

## 4. Input Manager (Main Interface)

```rust
use winit::event::{MouseButton, MouseScrollDelta};

pub struct InputManager {
    keys_pressed: std::collections::HashSet<KeyCode>,
    modifiers: KeyModifiers,
    context_map: ContextActionMap,
    action_state: ActionState,
    mouse_delta: (f64, f64),
    mouse_captured: bool,
    cursor_pos: Option<(f64, f64)>,
    prev_cursor_pos: Option<(f64, f64)>,
    mouse_buttons: std::collections::HashSet<MouseButton>,
    active_context: InputContext,
}

impl InputManager {
    pub fn new() -> Self {
        Self {
            keys_pressed: std::collections::HashSet::new(),
            modifiers: KeyModifiers::none(),
            context_map: ContextActionMap::blender_style(),
            action_state: ActionState::new(),
            mouse_delta: (0.0, 0.0),
            mouse_captured: false,
            cursor_pos: None,
            prev_cursor_pos: None,
            mouse_buttons: std::collections::HashSet::new(),
            active_context: InputContext::ViewMode,
        }
    }
    
    // === Context Management ===
    pub fn active_context(&self) -> InputContext { self.active_context }
    pub fn set_context(&mut self, context: InputContext) {
        self.active_context = context;
        self.context_map.set_active_context(context);
    }
    
    // === Key Handling ===
    pub fn key_down(&mut self, key: KeyCode) {
        self.keys_pressed.insert(key);
        self.update_modifiers();
        let combo = KeyCombo::with_modifiers(self.modifiers, key);
        if let Some(action) = self.context_map.get_active_map().action_for(&combo) {
            self.action_state.press(action);
        }
    }
    
    pub fn key_up(&mut self, key: KeyCode) {
        self.keys_pressed.remove(&key);
        self.update_modifiers();
        let combo = KeyCombo::with_modifiers(self.modifiers, key);
        if let Some(action) = self.context_map.get_active_map().action_for(&combo) {
            self.action_state.release(action);
        }
    }
    
    fn update_modifiers(&mut self) {
        self.modifiers = KeyModifiers {
            ctrl: self.keys_pressed.contains(&KeyCode::ControlLeft)
                || self.keys_pressed.contains(&KeyCode::ControlRight),
            shift: self.keys_pressed.contains(&KeyCode::ShiftLeft)
                || self.keys_pressed.contains(&KeyCode::ShiftRight),
            alt: self.keys_pressed.contains(&KeyCode::AltLeft)
                || self.keys_pressed.contains(&KeyCode::AltRight),
            logo: false,
        };
    }
    
    // === Mouse Handling ===
    pub fn mouse_button_down(&mut self, button: MouseButton) {
        self.mouse_buttons.insert(button);
    }
    
    pub fn mouse_button_up(&mut self, button: MouseButton) {
        self.mouse_buttons.remove(&button);
    }
    
    pub fn update_cursor(&mut self, pos: (f64, f64)) {
        if self.mouse_captured {
            if let Some(prev) = self.prev_cursor_pos {
                self.mouse_delta.0 += pos.0 - prev.0;
                self.mouse_delta.1 += pos.1 - prev.1;
            }
            self.prev_cursor_pos = Some(pos);
        }
        self.cursor_pos = Some(pos);
    }
    
    pub fn set_mouse_captured(&mut self, captured: bool) {
        self.mouse_captured = captured;
        if !captured {
            self.mouse_delta = (0.0, 0.0);
            self.prev_cursor_pos = None;
        }
    }
    
    // === Action Queries ===
    pub fn is_action_active(&self, action: InputAction) -> bool {
        self.action_state.is_active(action)
    }
    
    pub fn is_action_just_pressed(&self, action: InputAction) -> bool {
        self.action_state.is_just_pressed(action)
    }
    
    pub fn is_action_just_released(&self, action: InputAction) -> bool {
        self.action_state.is_just_released(action)
    }
    
    // === Frame Management ===
    pub fn clear_frame(&mut self) {
        self.action_state.clear_frame();
        self.mouse_delta = (0.0, 0.0);
    }
    
    pub fn get_mouse_delta(&self) -> (f64, f64) { self.mouse_delta }
    
    // === Keymap Management ===
    pub fn get_context_map(&self) -> &ContextActionMap { &self.context_map }
    pub fn get_context_map_mut(&mut self) -> &mut ContextActionMap { &mut self.context_map }
    pub fn rebind(&mut self, combo: KeyCombo, action: InputAction) {
        self.context_map.get_active_map_mut().bind(combo, action);
    }
}
```

---

## 5. Persistence (SQLite)

```sql
CREATE TABLE IF NOT EXISTS keymaps (
    id INTEGER PRIMARY KEY,
    profile_name TEXT NOT NULL UNIQUE,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keymap_bindings (
    id INTEGER PRIMARY KEY,
    keymap_id INTEGER NOT NULL,
    context TEXT NOT NULL,
    combo_key_code INTEGER NOT NULL,
    combo_modifiers INTEGER NOT NULL,
    action TEXT NOT NULL,
    FOREIGN KEY (keymap_id) REFERENCES keymaps(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS input_prefs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

---

## 6. Implementation Priority

### Phase 1a: Core Infrastructure
- [ ] KeyModifiers struct
- [ ] KeyCombo struct  
- [ ] InputContext enum expansion
- [ ] ActionCategory enum
- [ ] InputAction enum expansion

### Phase 1b: Action System
- [ ] ActionMap with combo support
- [ ] ContextActionMap with Blender-style defaults
- [ ] ActionState with just_pressed/just_released
- [ ] InputManager replacing InputState

### Phase 1c: Integration
- [ ] Update coordinator.rs to use InputManager
- [ ] Test all current functionality

### Phase 1d: Persistence
- [ ] SQLite schema for keymaps
- [ ] Save/load keymaps
- [ ] Keymap editor UI panel

---

## 7. Migration Path

```rust
// OLD
self.input.is_key_pressed(KeyCode::KeyW)

// NEW
self.input.is_action_active(InputAction::MoveForward)
```