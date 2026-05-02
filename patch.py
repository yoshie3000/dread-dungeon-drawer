import re

with open('src/components/Canvas.tsx', 'r') as f:
    content = f.read()

# Find the start of Layer 1 and end of Layer 7
start_layer1 = '        {/* Layer 1: Dyson Hatch (All sides) */}'
end_layer7 = '        {/* Current Drawing Overlay */}'

start_idx = content.find(start_layer1)
end_idx = content.find(end_layer7)

if start_idx == -1 or end_idx == -1:
    print("Could not find start or end index.")
    exit(1)

old_layers = content[start_idx:end_idx]

new_layers = """        {[0, 1, 2, 3].map(layerIndex => {
          if (!layerVisibility[layerIndex]) return null;
          const layerRenderedElements = renderedElements.filter(el => (el.layer ?? 0) === layerIndex);

          return (
            <g key={`layer-${layerIndex}`} className={`map-layer-${layerIndex}`}>
              <defs>
                <mask id={`room-mask-${layerIndex}`}>
                  <rect x="-10000" y="-10000" width="20000" height="20000" fill="black" />
                  {layerRenderedElements.map((el: MapElement) => {
                    if (el.type === 'room' || el.type === 'interior') {
                      const w = el.points[1].x - el.points[0].x;
                      const h = el.points[1].y - el.points[0].y;
                      return <rect key={`mask-${el.id}`} x={el.points[0].x} y={el.points[0].y} width={w} height={h} fill="white" />;
                    }
                    return null;
                  })}
                </mask>

                <mask id={`fill-mask-${layerIndex}`}>
                  <rect x="-10000" y="-10000" width="20000" height="20000" fill="black" />
                  {layerRenderedElements.map((el: MapElement) => {
                    if (el.type === 'fill' || el.type === 'unfill') {
                      const w = el.points[1].x - el.points[0].x;
                      const h = el.points[1].y - el.points[0].y;
                      return <rect key={`fill-mask-${el.id}`} x={el.points[0].x} y={el.points[0].y} width={w} height={h} fill={el.type === 'fill' ? "white" : "black"} />;
                    }
                    return null;
                  })}
                </mask>
              </defs>

"""

modified_old_layers = old_layers.replace('renderedElements', 'layerRenderedElements')
modified_old_layers = modified_old_layers.replace('mergedLines', 'layerMergedLines[layerIndex]')
modified_old_layers = modified_old_layers.replace('organicMaskElements', 'layerOrganicMaskElements[layerIndex]')
modified_old_layers = modified_old_layers.replace('mergedRoughPaths', 'layerMergedRoughPaths[layerIndex]')
modified_old_layers = modified_old_layers.replace('"url(#room-mask)"', '`url(#room-mask-${layerIndex})`')
modified_old_layers = modified_old_layers.replace('"url(#fill-mask)"', '`url(#fill-mask-${layerIndex})`')

indented_layers = '\n'.join(['  ' + line if line else line for line in modified_old_layers.split('\n')])

# IMPORTANT: old_layers ends with `        </g>\n\n`.
# We want to append `            </g>\n          );\n        })}\n\n`
new_layers += indented_layers
# Because indented_layers already contains the </g> for Layer 7, we just append the closing brackets for the map.
new_layers += """            </g>
          );
        })}

"""

content = content[:start_idx] + new_layers + content[end_idx:]

with open('src/components/Canvas.tsx', 'w') as f:
    f.write(content)
print("Canvas.tsx patched successfully!")
