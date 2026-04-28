import random
import math

random.seed(42)

path = []

def add_bundle(cx, cy, length, angle, num_lines, spread):
    dx = math.cos(angle) * length / 2
    dy = math.sin(angle) * length / 2
    
    nx = math.cos(angle + math.pi/2) * spread
    ny = math.sin(angle + math.pi/2) * spread
    
    start_offset = -(num_lines - 1) / 2
    
    for i in range(num_lines):
        offset = start_offset + i
        
        # Add some jitter to length and position
        jitter_len = random.uniform(-length*0.1, length*0.1)
        jitter_x = random.uniform(-2, 2)
        jitter_y = random.uniform(-2, 2)
        
        sx = cx - dx + nx * offset + jitter_x
        sy = cy - dy + ny * offset + jitter_y
        ex = cx + dx + nx * offset + jitter_x + (math.cos(angle)*jitter_len)
        ey = cy + dy + ny * offset + jitter_y + (math.sin(angle)*jitter_len)
        
        path.append(f"M {sx:.1f} {sy:.1f} L {ex:.1f} {ey:.1f}")

# For each 50x50 block, add about 6 bundles
for blockY in range(5):
    y_offset = blockY * 50
    for _ in range(7):
        cx = random.uniform(5, 45)
        cy = y_offset + random.uniform(5, 45)
        length = random.uniform(20, 35)
        # Angles mostly axis-aligned or 45 deg
        angle = random.choice([0, math.pi/2, math.pi/4, -math.pi/4]) + random.uniform(-0.1, 0.1)
        num_lines = random.choice([3, 4, 5])
        spread = random.uniform(3, 4.5)
        add_bundle(cx, cy, length, angle, num_lines, spread)

print(" ".join(path))
