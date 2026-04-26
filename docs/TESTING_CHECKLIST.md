# 🧪 Testing Checklist - Frontend UI Improvements

## Manual Testing Guide

Use this checklist to verify all features are working correctly.

---

## 📋 Test Cases by Feature

### Feature 1: Delete Confirmations

#### Test Case 1.1: Program Delete Confirmation
```
Location: Docente → Programas
Steps:
  1. Click trash icon on any program row
  2. Verify modal appears with:
     - Title: "Confirmar eliminación"
     - Message about deletion
     - "Cancelar" and "Eliminar" buttons
  3. Click "Cancelar" → Modal closes, program still exists
  4. Click trash again, then "Eliminar"
     → Modal closes + Toast appears: "Programa eliminado"
     → Program removed from list

Expected: Dialog prevents accidental deletion
Status: _____ (Pass/Fail)
```

#### Test Case 1.2: Activity Delete Confirmation
```
Location: Docente → Actividades
Steps:
  1. Click trash icon on any activity row
  2. Verify modal appears with proper text
  3. Test cancel → Modal closes, activity exists
  4. Test confirm → Activity deleted + Toast shown
  5. Verify activity no longer in list

Expected: Dialog works similarly to programs
Status: _____ (Pass/Fail)
```

#### Test Case 1.3: User Delete Confirmation
```
Location: Admin → Usuarios
Steps:
  1. Click trash icon on any active user
  2. Verify modal: "Confirmar baja"
  3. Test cancel → Modal closes, user still active
  4. Test confirm → Toast: "Usuario dado de baja"
  5. Verify user status changed to Inactivo

Expected: User deactivation confirmed
Status: _____ (Pass/Fail)
```

#### Test Case 1.4: Activity Type Delete Confirmation
```
Location: Admin → TiposActividad
Steps:
  1. Click trash icon on any type
  2. Verify modal appears
  3. Test cancel flow → Modal closed
  4. Click trash again, then confirm
     → Toast: "Tipo de actividad eliminado"
     → Item removed from list

Expected: Consistent dialog experience
Status: _____ (Pass/Fail)
```

---

### Feature 2: Icon Buttons

#### Test Case 2.1: Icon Visibility
```
Locations: All CRUD pages (Programas, Actividades, Usuarios, TiposActividad)
Steps:
  1. Open each page
  2. Look at action column (rightmost)
  3. Verify icons appear instead of text:
     - Eye icon (view/info)
     - Pencil icon (edit)
     - Trash icon (delete)
     - Toggle icon (for users only)

Expected: All icons visible and correctly sized
Status: _____ (Pass/Fail)
```

#### Test Case 2.2: Icon Tooltips
```
Locations: Any page with icon buttons
Steps:
  1. Hover over Eye icon → Tooltip: "Ver"
  2. Hover over Pencil icon → Tooltip: "Editar"
  3. Hover over Trash icon → Tooltip: "Eliminar"
  4. Hover over Toggle icon → Tooltip: "Activar/Desactivar"

Expected: Tooltips appear on hover
Status: _____ (Pass/Fail)
```

#### Test Case 2.3: Icon Styling
```
Steps:
  1. Look at icon buttons (36x36px circular)
  2. Verify hover state:
     - Background changes
     - Border changes to accent color
     - Icon color changes to accent
  3. Verify icons are properly centered

Expected: Professional styling with smooth transitions
Status: _____ (Pass/Fail)
```

---

### Feature 3: Dynamic Year Display

#### Test Case 3.1: Year Display
```
Location: Topbar (top-right)
Steps:
  1. Login to application
  2. Look at topbar
  3. Find "Periodo XXXX" indicator
  4. Verify year = current year (2026)

Expected: Shows "Periodo 2026"
Status: _____ (Pass/Fail)
```

#### Test Case 3.2: Year Consistency
```
Steps:
  1. Check year in multiple places:
     - Topbar
     - LoginPage (if visible)
     - Other pages
  2. Verify all show same year

Expected: Consistent year display across app
Status: _____ (Pass/Fail)
```

---

### Feature 4: Logo Integration

#### Test Case 4.1: Sidebar Logo
```
Location: Sidebar (left panel)
Steps:
  1. Login as docente or admin
  2. Look at sidebar top
  3. Verify UNCuyo logo appears:
     - Above "CRE APP" text
     - Properly sized (34px)
     - Not distorted
     - Good quality

Expected: Logo visible and professional looking
Status: _____ (Pass/Fail)
```

#### Test Case 4.2: Login Page Logo
```
Location: LoginPage
Steps:
  1. Logout or open login page
  2. Look at login card
  3. Verify UNCuyo logo appears:
     - At top of card
     - Properly sized (48px, larger than sidebar)
     - Centered
     - Good quality

Expected: Logo enhances login visual hierarchy
Status: _____ (Pass/Fail)
```

#### Test Case 4.3: Logo Loading
```
Steps:
  1. Hard refresh page (Ctrl+F5)
  2. Verify logo loads correctly
  3. Check network tab for 404 errors
  4. Verify logo URL loads independently

Expected: Logo loads from CDN without errors
Status: _____ (Pass/Fail)
```

---

### Feature 5: Toast Notifications

#### Test Case 5.1: Delete Success Toast
```
Steps:
  1. Go to any CRUD page
  2. Delete an item (confirm dialog)
  3. Watch for toast notification:
     - Position: Top-right of screen
     - Color: Green
     - Text: "Eliminado" or appropriate message
     - Duration: Auto-closes after ~3 seconds

Expected: Green success notification appears and disappears
Status: _____ (Pass/Fail)
```

#### Test Case 5.2: Delete Error Toast
```
Steps:
  1. Simulate API error (using browser dev tools)
  2. Try to delete an item
  3. Watch for toast notification:
     - Color: Red
     - Text: "Error al eliminar"
     - Position: Top-right
     - Duration: Auto-closes

Expected: Red error notification shown
Status: _____ (Pass/Fail)
```

#### Test Case 5.3: Toast Muitiples
```
Steps:
  1. Open ConsoleCheck tab in browser devtools
  2. Delete multiple items in quick succession
  3. Verify multiple toasts stack properly
  4. No overlapping or hidden messages

Expected: Multiple notifications visible
Status: _____ (Pass/Fail)
```

---

## 🌐 Cross-Browser Testing

### Test Case 6.1: Chrome/Chromium
```
Browser: Chrome/Edge 90+
Steps:
  1. Test all features above
  2. Check responsive behavior
  3. Verify icons render correctly
  4. Check modal positioning

Expected: All features work perfectly
Status: _____ (Pass/Fail)
```

### Test Case 6.2: Firefox
```
Browser: Firefox 85+
Steps:
  1. Test all features above
  2. Verify CSS transitions smooth
  3. Check modal backdrop rendering
  4. Verify toast positioning

Expected: All features work correctly
Status: _____ (Pass/Fail)
```

### Test Case 6.3: Safari
```
Browser: Safari 14+
Steps:
  1. Test all features above
  2. Verify icon rendering (some icon issues possible)
  3. Check modal and toast display
  4. Verify responsive behavior

Expected: All features work
Status: _____ (Pass/Fail)
```

---

## 📱 Responsive Testing

### Test Case 7.1: Desktop (1920px+)
```
Steps:
  1. Open app at 1920px width
  2. Verify all buttons readable
  3. Check logo sizing
  4. Modal should be well-proportioned

Expected: Professional layout on large screens
Status: _____ (Pass/Fail)
```

### Test Case 7.2: Tablet (768px - 1024px)
```
Steps:
  1. Open app at 900px width
  2. Verify icon buttons still clickable
  3. Check modal sizing
  4. Sidebar should adapt

Expected: Layout adapts well
Status: _____ (Pass/Fail)
```

### Test Case 7.3: Mobile (375px)
```
Steps:
  1. Open app on mobile or 375px width
  2. Icon buttons should have adequate spacing
  3. Modal should fit screen
  4. No horizontal scroll

Expected: Mobile-friendly layout
Status: _____ (Pass/Fail)
```

---

## 🔍 Accessibility Testing

### Test Case 8.1: Keyboard Navigation
```
Steps:
  1. Tab through buttons - should be focusable
  2. Enter key should trigger button actions
  3. Escape key should close modal
  4. Modal focus trap - Tab should cycle within modal

Expected: Keyboard navigation works
Status: _____ (Pass/Fail)
```

### Test Case 8.2: Screen Reader (NVDA/JAWS)
```
Steps:
  1. Enable screen reader
  2. Navigate modal
  3. Verify modal announced as "dialog"
  4. Verify buttons are readable

Expected: Screen reader announces elements correctly
Status: _____ (Pass/Fail)
```

### Test Case 8.3: Color Contrast
```
Steps:
  1. Check color contrast with accessibility tool
  2. Icons should be visible against background
  3. Toast text should be readable
  4. Modal text should meet WCAG AA standard

Expected: Good contrast on all elements
Status: _____ (Pass/Fail)
```

---

## ⚡ Performance Testing

### Test Case 9.1: Page Load Time
```
Steps:
  1. Open Chrome DevTools
  2. Go to Performance tab
  3. Load a CRUD page
  4. Check load time

Expected: Load time < 3 seconds
Status: _____ (Pass/Fail)
```

### Test Case 9.2: Modal Opening Speed
```
Steps:
  1. Click delete button
  2. Modal should appear instantly
  3. No lag or delay

Expected: Modal opens within 100ms
Status: _____ (Pass/Fail)
```

### Test Case 9.3: Toast Display Speed
```
Steps:
  1. Perform delete action
  2. Toast should appear instantly
  3. No lag or jank

Expected: Toast appears within 50ms
Status: _____ (Pass/Fail)
```

---

## 🐛 Error Scenarios

### Test Case 10.1: API Failure
```
Steps:
  1. Block API endpoint in browser (DevTools)
  2. Try to delete item
  3. Verify error toast appears
  4. Modal closes

Expected: Error handled gracefully
Status: _____ (Pass/Fail)
```

### Test Case 10.2: Rapid Clicking
```
Steps:
  1. Click delete multiple times rapidly
  2. Should not create multiple API calls
  3. Modal should not duplicate

Expected: No race conditions
Status: _____ (Pass/Fail)
```

### Test Case 10.3: Network Timeout
```
Steps:
  1. Simulate slow network (DevTools throttling)
  2. Try to delete item
  3. Verify behavior with delay
  4. Modal and toast should still work

Expected: Handles timeouts gracefully
Status: _____ (Pass/Fail)
```

---

## 📊 Test Results Summary

| Feature | Test Cases | Pass | Fail | Notes |
|---------|-----------|------|------|-------|
| Delete Confirmations | 4 | ___ | ___ | |
| Icon Buttons | 3 | ___ | ___ | |
| Dynamic Year | 2 | ___ | ___ | |
| Logo Display | 3 | ___ | ___ | |
| Toast Notifications | 3 | ___ | ___ | |
| Desktop Responsive | 1 | ___ | ___ | |
| Tablet Responsive | 1 | ___ | ___ | |
| Mobile Responsive | 1 | ___ | ___ | |
| Accessibility | 3 | ___ | ___ | |
| Performance | 3 | ___ | ___ | |
| Error Scenarios | 3 | ___ | ___ | |
| **TOTAL** | **31** | ___ | ___ | |

---

## ✅ Sign-Off Checklist

- [ ] All 31 test cases passed
- [ ] No console errors
- [ ] No performance issues
- [ ] Accessibility requirements met
- [ ] Cross-browser compatibility confirmed
- [ ] Mobile responsive verified
- [ ] Error handling tested
- [ ] Ready for production deployment

---

## 📝 Issue Report Template

If you find an issue, report it using this template:

```
Test Case: [Number and name]
Browser: [Chrome/Firefox/Safari/Mobile]
Expected: [What should happen]
Actual: [What actually happened]
Steps to Reproduce:
  1. [Step 1]
  2. [Step 2]
  3. [Step 3]
Screenshot: [Attach screenshot]
Severity: [Critical/High/Medium/Low]
```

---

## 🎯 Test Environment Requirements

- Node.js 16+ (for frontend dev server)
- Modern browser (Chrome, Firefox, Safari, Edge)
- Network connection (for API calls)
- Mouse/keyboard for interaction testing
- Screen reader (optional, for accessibility testing)

---

## 📅 Testing Timeline

- **Phase 1 Testing**: ~2 hours (unit & integration)
- **Phase 2 Testing**: ~1 hour (feature verification)
- **Phase 3 Testing**: ~1 hour (edge cases & performance)
- **Phase 4 Testing**: ~1 hour (accessibility & mobile)

**Total Estimated Time**: ~5 hours

---

## 🚀 Pre-Production Checklist

Before deploying:

- [ ] All test cases passed
- [ ] No known bugs
- [ ] Performance acceptable
- [ ] Accessibility requirements met
- [ ] Documentation complete
- [ ] Code review approved
- [ ] Deployment procedure ready

---

**Testing Version**: 1.0  
**Date**: 2026  
**Status**: Ready for testing

*Use this checklist during QA and before each release.*
