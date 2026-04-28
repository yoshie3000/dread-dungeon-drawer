# **OSR Map Builder: Specification & Technical Implementation**

This document outlines the research, product specification, and technical roadmap for a web-based Old School Revival (OSR) map-making tool.

## **1\. Research: Competitive Landscape & Inspiration**

### **Dungeon Scrawl**

* **Capabilities**: High-speed procedural dungeon generation and manual drawing. Supports layers, isometric views, and a variety of "styles" (including OSR).  
* **Technology**: Uses a hybrid approach with HTML5 Canvas for high-performance rendering of thousands of geometry points. It handles complex hatching via tiled procedural shaders.  
* **Key Takeaway**: Performance is maintained by limiting the number of active DOM elements. For an SVG-based tool, we must use a flat hierarchy or grouping to keep the DOM manageable.

### **Dyson Logos (The "Dyson Style")**

* **Aesthetics**: Characteristic thick, slightly irregular outer walls; thin, precise interior grid lines; and extensive cross-hatching or "scrumbled" lines filling the negative space (the solid rock) around rooms.  
* **Key Takeaway**: The "hand-drawn" feel comes from line jitter (slight randomness in coordinates) and varying line weights.

## **2\. MVP Specification**

### **Core Features**

1. **Grid System**: A snap-to-grid coordinate system (default 50px squares) that serves as the foundation for all placements.  
2. **Wall Tools**:  
   * **Straight Walls**: Line-segment drawing that snaps to grid intersections.  
   * **Room Primitive**: Rectangle tool that generates four walls. Users can drag corners to resize, snapping to the grid.  
3. **Shadowing & Hatching**:  
   * **Internal Shadowing**: A light grey offset stroke on the interior side of walls.  
   * **Dyson Cross-Hatching**: A procedural SVG pattern applied to the *exterior* of rooms (the "solid rock").  
4. **Asset Placement**:  
   * Basic stamps: Single-door, Double-door, Secret Door (S icon), and Stairs (parallel lines).  
   * Orientation: Assets should snap to wall segments and rotate automatically to align with the wall's angle.  
5. **Export**: Export the current view as a clean, scalable .svg file.

### **Beyond MVP (Future Iterations)**

* **Curved Walls**: Quadratic Bézier curves with control points that snap to grid offsets.  
* **Advanced Hatching**: Multiple styles (stippling, heavy ink, diagonal hatch).  
* **Layers**: Separate layers for "Background/Rock," "Architecture," and "Annotations/Furniture."  
* **Multi-Point Room Modification**: Ability to "split" a wall segment to create L-shaped or T-shaped rooms.

## **3\. Technical Implementation Spec**

### **Technology Stack**

* **Framework**: **React** for UI and State Management.  
* **Rendering Engine**: **SVG (Scalable Vector Graphics)**.  
  * *Why?* SVG is natively scalable, handles "hand-drawn" paths perfectly via filters, and provides the exact output format requested.  
* **State Management**: **Zustand** or **Redux Toolkit** to manage the complex array of wall segments and assets.  
* **Styling**: **Tailwind CSS** for the UI components.  
* **Hand-Drawn Effect**: **Rough.js** (optional) or custom SVG filters (FeTurbulence/FeDisplacementMap) to give perfectly straight lines a "wiggle."

### **SVG Architecture**

The map will be rendered as a single \<svg\> element containing:

1. **\<defs\>**: Contains patterns for cross-hatching and filters for line jitter.  
2. **Grid Layer**: A repeated pattern of thin lines.  
3. **Hatching Layer**: A polygon representing the "outside" of the dungeon, filled with the Dyson-style pattern.  
4. **Wall Layer**: A series of \<path\> elements with thick strokes.  
5. **Decoration Layer**: SVGs for doors and stairs.

### **Coding Logic: The "Dyson Hatch"**

To achieve the cross-hatching without manual drawing:

* **Logic**: Define a large rectangle covering the canvas filled with the hatch pattern. Use a **Mask** or **Clip Path** that is the *inverse* of the room polygons. As rooms are added, they are subtracted from the mask, revealing the hatching in the "void" areas.

### **Performance Strategy**

* **Virtualization**: For extremely large maps, implement a view-box-based culling where only SVG elements within the current zoom/pan window are rendered in the DOM.  
* **Path Merging**: Continuously merge adjacent wall segments into single \<path\> strings to reduce the number of DOM nodes.

## **4\. UI Design (Ref: Image 1\)**

* **Left Sidebar**: Tool selector (Select, Wall, Room, Door, Stair, Hatch).  
* **Right Sidebar**: Property editor (Wall thickness, Shadow opacity, Grid toggle).  
* **Bottom Bar**: Zoom controls, Pan toggle, and Export button.

## **5\. Visual Output Goal (Ref: Image 2\)**

* **Wall Stroke**: 3pt Black, slightly irregular.  
* **Interior Shadow**: 10% opacity Black, 5px offset.  
* **Grid**: 0.5pt Light Grey.  
* **Hatching**: 45-degree diagonal lines, spaced 4px apart, extending 20px from wall exteriors.