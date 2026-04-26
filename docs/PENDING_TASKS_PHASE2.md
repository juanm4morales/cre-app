# Pending Tasks - Future Implementation

## Overview

The following items from the project requirements are **not yet implemented** and remain for future development phases.

## Phase 2: Docente Space Selection & Program Management

### Currently Blocker Items

These are architectural changes that require significant backend and frontend modifications:

#### Task 1: Space Selection Workflow for Docentes
**Priority**: High  
**Complexity**: Medium  

**Requirements**:
- Docentes should see only their active assigned curricular spaces
- New dashboard page: `docente/Espacios.tsx` (list of available spaces)
- Ability to select one space to manage its programs and activities
- Store selected space in context or URL parameter
- Filter Programas and Actividades pages by selected space

**Affected Files**:
- `backend/planning/models.py` - Add active assignment filtering
- `backend/planning/viewsets.py` - Filter docente access to assigned spaces
- `frontend/src/pages/docente/Espacios.tsx` - NEW page
- `frontend/src/contexts/` - Space selection context/state
- `frontend/src/pages/docente/Programas.tsx` - Filter by selected space
- `frontend/src/pages/docente/Actividades.tsx` - Filter by selected space

**Backend Work**:
```python
# In planning/models.py
class AsignacionDocente(models.Model):
    def get_active_spaces_for_docente(user):
        """Return only active assigned curricular spaces"""
        # Filter by current date, user, and is_active=True
        pass
```

**Frontend Work**:
```typescript
// SpaceContext needed
interface SpaceContext {
  selectedSpace?: PlanEstudioEC;
  selectSpace: (space: PlanEstudioEC) => void;
  docenticAssignedSpaces: PlanEstudioEC[];
}
```

**Estimated Effort**: 8-12 hours

---

#### Task 2: Auto-Create Program Logic
**Priority**: High  
**Complexity**: High  

**Requirements**:
- Automatically create program for new academic year
- If program exists for previous year, copy activities from it
- Create new program instance with year+1
- Maintain same description and activities

**Affected Files**:
- `backend/planning/models.py` - Add auto-create and copy logic
- `backend/planning/viewsets.py` - Add new endpoint
- `backend/planning/serializers.py` - Validation for program creation
- `frontend/src/pages/docente/Programas.tsx` - Call auto-create on load

**Backend Work Needed**:
```python
# In planning/models.py
class Programa(models.Model):
    @classmethod
    def auto_create_for_year(cls, plan_estudio_ec_id, year):
        """
        Create program for given year if not exists.
        Copy from previous year if available.
        """
        # Check if program exists for this year + plan_ec
        # If not, find previous year program
        # Copy program and all its actividades (deep copy)
        # Return created or existing program
        pass
    
    def copy_from(self, source_program):
        """Copy all activities from source program"""
        # Deep copy actividades with new programa FK
        pass

# In planning/viewsets.py
# Add endpoint: POST /programas/auto-create-year/{plan_ec_id}
def auto_create_year(request, plan_ec_id):
    current_year = timezone.now().year
    programa, created = Programa.auto_create_for_year(
        plan_estudio_ec_id=plan_ec_id,
        year=current_year
    )
    return Response(ProgramaSerializer(programa).data)
```

**Frontend Work Needed**:
```typescript
// In Programas.tsx
useEffect(() => {
  // On page load, auto-create programs for assigned spaces
  ProgramasAsignadas.forEach(async (space) => {
    try {
      const result = await api.post(`/programas/auto-create-year/${space.id}`);
      if (result.data.created) {
        toast.success(`Programa del año ${currentYear} creado automáticamente`);
        refetchProgramas();
      }
    } catch (error) {
      // Handle silently or log
    }
  });
}, []);
```

**Estimated Effort**: 12-16 hours

---

## Phase 3: Enhanced UI Features

### Optional Future Enhancements

#### Feature 1: Bulk Operations
**Priority**: Low
**Complexity**: Medium
- Select multiple items with checkboxes
- Bulk delete with single confirmation
- Bulk export functionality

#### Feature 2: Undo Functionality
**Priority**: Low
**Complexity**: Medium
- Temporary undo for deleted items (5-10 second window)
- Uses toast with action button
- Requires soft delete or trash implementation

#### Feature 3: Dark Mode
**Priority**: Low
**Complexity**: Low
- Extend existing CSS variables
- Add theme toggle to user settings
- Uses localStorage for persistence

#### Feature 4: Keyboard Shortcuts
**Priority**: Low
**Complexity**: Low
- Escape to close dialogs (already supported)
- Enter to confirm dialogs
- Alt+N for new items
- Alt+E for edit
- Alt+D for delete

#### Feature 5: Search & Filter
**Priority**: Medium
**Complexity**: Medium
- Add search input to table headers
- Filter programs by year
- Filter activities by type
- Live search with debounce

---

## Backend Tasks Required

### Models Enhancement

**File**: `backend/planning/models.py`

```python
# 1. Add copy_from method
def copy_from(self, source_programa):
    """Deep copy program with all activities"""
    pass

# 2. Add auto-create method
@classmethod
def auto_create_for_year(cls, plan_estudio_ec_id, year):
    """Create or return existing programa for year"""
    pass

# 3. Add get_previous_year helper
def get_previous_year_programa(self):
    """Get programa from previous academic year"""
    pass
```

### Viewsets Enhancement

**File**: `backend/planning/viewsets.py`

```python
# Add new action
@action(detail=False, methods=['post'])
def auto_create_year(self, request):
    """Auto-create programa for current year"""
    pass

# Add filtering
def get_queryset(self):
    """Filter by assigned spaces for docentes"""
    if self.request.user.groups.filter(name='docentes'):
        # Return only docente's assigned spaces
        pass
    return Programa.objects.all()
```

### Serializers Enhancement

**File**: `backend/planning/serializers.py`

```python
# Add validation
class ProgramaSerializer(serializers.ModelSerializer):
    def validate(self, data):
        """Ensure one programa per plan_ec per year"""
        pass
```

---

## Testing Needs

### Unit Tests Needed

```python
# backend/planning/tests.py

class ProgramaAutoCreateTests(TestCase):
    def test_auto_create_new_program(self):
        """Program created for new year"""
        pass
    
    def test_copy_from_previous_year(self):
        """Activities copied from previous year"""
        pass
    
    def test_idempotent_auto_create(self):
        """Calling twice returns same program"""
        pass

class DocenteSpaceAccessTests(TestCase):
    def test_docente_sees_only_assigned_spaces(self):
        """Docente filtered to assigned spaces"""
        pass
    
    def test_admin_sees_all_spaces(self):
        """Admin can see all curriculum spaces"""
        pass
```

### Frontend Tests Needed

```typescript
// frontend/src/__tests__/Programas.test.tsx

describe('Auto-create program', () => {
  it('should call auto-create on mount', async () => {
    // ...
  });
  
  it('should show toast when program created', async () => {
    // ...
  });
});

describe('Space selection', () => {
  it('should display only assigned spaces', () => {
    // ...
  });
  
  it('should filter programs by selected space', () => {
    // ...
  });
});
```

---

## Database Migrations

### Potential New Migrations

If additional fields needed:

```python
# backend/planning/migrations/0005_programa_copy_parent.py

class Migration(migrations.Migration):
    dependencies = [
        ('planning', '0004_previous_migration'),
    ]
    
    operations = [
        # If adding field to track original program
        migrations.AddField(
            model_name='programa',
            name='copied_from',
            field=models.ForeignKey(null=True, blank=True, ...),
        ),
    ]
```

---

## Implementation Priority

**Phase 2 (Required for Full Functionality)**:
1. ✅ Delete confirmations with modals (DONE)
2. ✅ Icon buttons replacement (DONE)
3. ✅ Dynamic year display (DONE)
4. ✅ Logo branding (DONE)
5. ⏳ Space selection workflow (NOT STARTED)
6. ⏳ Auto-create program logic (NOT STARTED)

**Phase 3 (Nice-to-Have Features)**:
- Bulk operations
- Undo functionality
- Dark mode
- Keyboard shortcuts
- Enhanced search/filter

---

## Estimated Timeline

- **Phase 1** (Completed): ~16 hours ✅
- **Phase 2** (In Progress): ~24 hours (80 remaining)
- **Phase 3** (Future): ~20-30 hours

**Total Remaining Estimated Effort**: 80-100 hours

---

## Getting Started on Phase 2

### Step-by-Step for Next Developer

1. **Start with Space Selection**:
   - Review `academics.models.EspacioCurricular`
   - Plan new `Espacios.tsx` page layout
   - Create context for space selection
   - Add filtering logic to existing pages

2. **Then Auto-Create Logic**:
   - Add copy_from method to Programa model
   - Implement auto_create_year endpoint
   - Add frontend call on Programas mount
   - Test copy functionality with existing programs

3. **Testing & Integration**:
   - Write unit tests for backend logic
   - Test frontend integration
   - Handle edge cases (missing previous year, etc.)
   - Performance test with large datasets

---

## Notes

- All Phase 1 work is production-ready
- Phase 2 is architectural and should not break existing functionality
- Phase 3 features are purely optional enhancements
- Current database schema may need migration for auto-create tracking
- Consider caching for program copy operations if many activities

---

**Document Version**: 1.0  
**Last Updated**: 2026  
**Status**: Planning Phase 2
