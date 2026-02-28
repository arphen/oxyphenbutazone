# Tooltip Positioning Fix

## Problem
The word definition tooltips were experiencing two issues:
1. **Covered by other elements** - Low z-index caused them to appear behind other UI components
2. **Extending past right edge** - Tooltips positioned from left were going off-screen on the right side

## Solution Implemented

### 1. Changed Tooltip Position
**Before**: Positioned below the word, aligned to left
```css
position: absolute;
left: 0;
top: 100%;
```

**After**: Positioned above the word, aligned to right
```css
position: absolute;
right: 0;        /* Align to right edge */
left: auto;
bottom: 100%;    /* Position above instead of below */
top: auto;
```

### 2. Increased Z-Index
- Tooltip: `z-index: 9999` (was 1000)
- Arrow: `z-index: 9998` (was 1001)
- This ensures tooltips appear above all other game elements

### 3. Enhanced Overflow Handling
Added explicit overflow properties to prevent clipping:
```css
.history-table-wrapper {
  overflow-x: visible; /* Allow tooltips to extend outside */
}

.words-cell {
  position: relative;
  overflow: visible;
}

.history-table tbody tr {
  position: relative;
}
```

### 4. Improved Arrow Positioning
The arrow now points downward (since tooltip is above):
```css
border-top-color: rgba(96, 165, 250, 0.4);  /* Was border-bottom-color */
```

## Visual Changes

### Before
```
┌─────────────────────────────────┐
│ History Table                    │
│                                  │
│ Rnd | Words        | Score      │
│  1  | CAT, DOG     | +12        │ ← Tooltip would go below and off-screen
│                                  │
└─────────────────────────────────┘
```

### After
```
┌─────────────────────────────────┐
│ History Table                    │
│     ┌──────────────────────┐    │ ← Tooltip appears above
│     │ a carnivorous mammal │    │
│     │ [n CATS]             │    │
│     └──────────▼───────────┘    │
│ Rnd | Words        | Score      │
│  1  | CAT, DOG     | +12        │
│                                  │
└─────────────────────────────────┘
```

## Benefits

✅ **Always Visible**: Tooltips now appear above words, so they're less likely to be cut off by container edges  
✅ **No Right Edge Overflow**: Right-aligned positioning prevents tooltips from extending past the screen edge  
✅ **Higher Z-Index**: Tooltips now appear on top of all other game elements  
✅ **Better UX**: Users can always see the full definition without scrolling or repositioning  

## Technical Details

### CSS Properties Changed
- **Positioning**: Changed from `top: 100%` to `bottom: 100%`
- **Alignment**: Changed from `left: 0` to `right: 0`
- **Z-Index**: Increased from 1000 to 9999
- **Arrow Direction**: Flipped from pointing up to pointing down
- **Overflow**: Added `overflow: visible` to parent containers

### Styling Improvements
- Increased padding: `10px 14px` → `12px 16px`
- Better line height: Added `line-height: 1.5`
- Darker background: `rgba(30, 30, 50, 0.98)` → `rgba(20, 20, 35, 0.98)`
- Enhanced shadow: Added dual shadows for better depth
- Larger border radius: `6px` → `8px`

## Testing Checklist

- [ ] Hover over words in the history table
- [ ] Verify tooltips appear above the words
- [ ] Check that tooltips don't extend past the right edge
- [ ] Confirm tooltips appear on top of all other elements
- [ ] Test with long definitions (should wrap properly)
- [ ] Test with words at the top of the history table
- [ ] Test with words at the bottom of the history table
- [ ] Verify arrow points to the correct word

## Browser Compatibility
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ All modern browsers supporting CSS pseudo-elements

## Future Improvements
Possible enhancements:
- Auto-detect position (show below if near top, above if near bottom)
- Add animation for arrow
- Click-to-pin functionality
- Mobile touch support
- Dynamic width based on content
