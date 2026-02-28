# Tooltip Positioning Visual Guide

## Before vs After

### BEFORE (Issues)
```
┌────────────────────────────────────────┐
│  Sidebar                         Edge→ │
│                                        │
│  ┌──────────────────────────────┐     │
│  │ Game History                 │     │
│  │                              │     │
│  │ Rnd | Words    | Score       │     │
│  ├─────┼──────────┼─────────────┤     │
│  │ 1   | CAT, DOG | +12         │     │
│  │       ↓                      │     │
│  │   ┌─[Definition extends here]─────────→ OVERFLOW!
│  │   │ a carnivorous mammal...  │     │
│  │   └──────────────────────    │     │
│  │                              │     │
│  └──────────────────────────────┘     │
│                                        │
│  [Other elements covering tooltip]    │
└────────────────────────────────────────┘
     ↑ PROBLEM: Covered by elements
```

### AFTER (Fixed)
```
┌────────────────────────────────────────┐
│  Sidebar                         Edge→ │
│                                        │
│  ┌──────────────────────────────┐     │
│  │ Game History                 │     │
│  │     ┌──────────────────────┐ │     │
│  │     │ a carnivorous mammal │ │     │ ← Tooltip ABOVE
│  │     │ [n CATS]             │ │     │
│  │     └─────────▼────────────┘ │     │
│  │ Rnd | Words    | Score       │     │
│  ├─────┼──────────┼─────────────┤     │
│  │ 1   | CAT, DOG | +12         │     │
│  │         ↑                    │     │
│  │      Hover here             │     │
│  │                              │     │
│  └──────────────────────────────┘     │
│                                        │
└────────────────────────────────────────┘
   ✓ FIXED: Always visible, aligned right
```

## Positioning Breakdown

### Word Position
```
┌─────────────────────────────────┐
│  Table Cell (words-cell)        │
│  position: relative             │
│  overflow: visible              │
│                                 │
│  ┌───────────────────────┐     │
│  │ QUIZ ← hover target   │     │
│  │ position: relative    │     │
│  └───────────────────────┘     │
│           ↑                     │
│           │                     │
└───────────┼─────────────────────┘
            │
            └── Reference point for tooltip
```

### Tooltip Position
```
        ┌────────────────────────────┐
        │ Definition Tooltip         │
        │ position: absolute         │
        │ right: 0                   │ ← Aligned to right
        │ bottom: 100%               │ ← Above the word
        │ z-index: 9999              │ ← On top of everything
        │ margin-bottom: 10px        │
        └──────────▼─────────────────┘
                   │ Arrow (::before)
                   │ border-top-color
                   │
        ┌──────────┴─────────────────┐
        │ QUIZ (word-with-definition)│
        └────────────────────────────┘
```

## Z-Index Stack

```
Layer 9999: Definition Tooltip (::after)
   ↑
Layer 9998: Tooltip Arrow (::before)
   ↑
Layer 1000-5000: Game UI Elements
   ↑
Layer 100-500: Board, Cards, Buttons
   ↑
Layer 1: Base Layout
```

## Alignment Strategy

### Right Alignment Prevents Overflow
```
Wrong (left: 0):
┌──────────────┐
│ Table        │
│ WORD ──→ ┌───────────────┐
│          │ Definition... │──→ EXTENDS PAST EDGE!
│          └───────────────┘
└──────────────┘

Correct (right: 0):
┌──────────────┐
│ Table        │
│     ┌───────────────┐ ←── WORD
│     │ Definition... │
│     └───────────────┘
└──────────────┘
    ↑ Stays within bounds
```

## Mobile Considerations

### Desktop (Sidebar View)
```
┌──────┬─────────────────────┐
│      │                     │
│ Game │   ┌─────────────┐   │
│ Board│   │ Tooltip     │   │ ← Above word
│      │   └──────▼──────┘   │
│      │   WORD              │
│      │                     │
└──────┴─────────────────────┘
```

### Mobile (Full Screen)
Note: Current implementation is for desktop laptop view.
Mobile may need separate touch-based implementation:
- Tap to show/hide instead of hover
- Different positioning strategy
- Possibly modal-based instead of tooltip

## CSS Specificity

### Targeting
```css
/* Specific selector ensures high priority */
.word-with-definition[title]:hover::after {
  /* Tooltip styles */
}

/* More specific than */
.word-with-definition::after {
  /* Would be overridden */
}
```

## Animation Flow

```
Hover Start
    ↓
opacity: 0, transform: translateY(-5px)
    ↓ (0.2s ease-out)
opacity: 1, transform: translateY(0)
    ↓
Tooltip visible and stable
    ↓
Hover End
    ↓
Tooltip disappears immediately
```

## Responsive Behavior

### Max Width: 280px
```
Short definition:
┌─────────────────────┐
│ a cat [n CATS]      │
└─────────────────────┘

Long definition:
┌──────────────────────────────┐
│ to test the knowledge of by  │
│ asking questions              │
│ [v QUIZZED, QUIZZING, QUIZZES]│
└──────────────────────────────┘
       (wraps text)
```

## Testing Scenarios

1. **Word at top of table**: Tooltip should appear above without clipping
2. **Word at bottom of table**: Tooltip should appear above (may need scroll)
3. **Long definition**: Should wrap to multiple lines
4. **Short definition**: Should not be too narrow (min-width: 200px)
5. **Multiple words in one turn**: Each should show its own tooltip
6. **Invalid words**: Should show "Not in dictionary"

## Known Limitations

⚠️ **Current Limitations:**
- Only works on laptop/desktop view
- Requires CSS pseudo-element support
- No touch device support
- Cannot have interactive content in tooltip (pseudo-elements)
- Tooltip disappears immediately on mouse leave

💡 **Future Solutions:**
- Create Vue component for richer tooltip interactions
- Add click-to-pin functionality
- Implement mobile-specific touch behavior
- Add keyboard navigation support
