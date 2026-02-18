# PineUI - LLM Context Guide

> Use this guide as context when asking LLMs to build applications with PineUI.
> All component types, action names, and examples here are verified against the runtime.

---

## What is PineUI?

PineUI is a Server-Driven UI framework for building dynamic, cross-platform interfaces from JSON schemas. Interfaces are **pure data** — no code, no JSX, no framework. A renderer (React, Flutter, etc.) interprets the schema and builds the UI.

---

## CDN Links

```html
<!-- CSS -->
<link rel="stylesheet" href="https://unpkg.com/@pineui/react@latest/dist/style.css">

<!-- JavaScript (Standalone - includes React) -->
<script src="https://unpkg.com/@pineui/react@latest/dist/pineui.standalone.js"></script>
```

## Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/@pineui/react@latest/dist/style.css">
</head>
<body>
  <div id="app"></div>
  <script src="https://unpkg.com/@pineui/react@latest/dist/pineui.standalone.js"></script>
  <script>
    PineUI.render({
      target: '#app',
      schema: { /* Your schema here */ }
    });
  </script>
</body>
</html>
```

---

## ⚡ Quick Reference

### Valid Component Types

These are the **only** valid component types. Any other type will silently render nothing.

```
text
button.filled  button.text  button.outlined  button.icon  button.fab
layout.column  layout.row  layout.scaffold
card
image
avatar
icon
chip
badge
progress
divider
tabs
grid
table
collection
collection.map
conditionalRender
conditional.render
view
input.text  input.email  input.password  input.number  input.search
component.<yourName>   ← custom components you define in "components"
```

### Valid Action Types

```
action.state.patch
action.http
action.overlay.open
action.overlay.close
action.snackbar.show
action.sequence
action.delay
action.collection.refresh
```

Also valid:
- `{ "intent": "intentName", "param": "val" }` — short syntax to call an intent
- `{ "type": "intent", "name": "intentName", "param": "val" }` — explicit syntax

---

## Schema Structure

Every PineUI app is a single JSON object:

```json
{
  "schemaVersion": "1.0.0",
  "state": { },
  "intents": { },
  "overlays": { },
  "components": { },
  "screen": { }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `schemaVersion` | ✅ | Always `"1.0.0"` |
| `screen` | ✅ | Root component — what is rendered |
| `state` | optional | Initial reactive state values |
| `intents` | optional | Named, reusable action handlers |
| `overlays` | optional | Modals and bottom sheets |
| `components` | optional | Reusable custom component templates |

> **State is initialized once** from `"state"`. Every `action.state.patch` mutates it reactively — bindings re-evaluate automatically.

---

## Data Bindings

Use `{{expression}}` anywhere in a string value. The engine evaluates the expression at render time.

### Context Variables

| Variable | Available in | Description |
|----------|-------------|-------------|
| `state` | Everywhere | Reactive app state |
| `item` | Inside `collection` / `collection.map` `itemTemplate` or `template` | Current item in the loop |
| `index` | Inside `collection` / `collection.map` | 0-based position in list |
| `props` | Inside `components` definition body | Props passed to the component |
| `response` | Inside `collection.data.onSuccess` ONLY | Raw API response (array/object) |
| `event.value` | Inside `onChange` / `onChanged` handlers | Current input field value |
| `tab` | Inside `bottomNav.onTabChange` | Tab id that was clicked |

> ⚠️ `{{response}}` outside `onSuccess` will remain as a literal string — it is intentionally protected.
> ⚠️ `{{event.value}}` is the correct binding for input handlers. `{{value}}` does NOT work.

### Expression Syntax

The engine uses `new Function()` — any valid JavaScript expression works:

```
{{state.counter}}                                    Simple access
{{state.items[0]}}                                   Array index
{{state.user.name}}                                  Nested property
{{state.price * 1.1}}                                Arithmetic
{{state.age >= 18}}                                  Comparison
{{state.isActive ? 'Active' : 'Inactive'}}           Ternary
{{state.firstName + ' ' + state.lastName}}           String concat
{{state.tab == 'home'}}                              Equality
{{!state.loading}}                                   Negation
{{item.badge != null}}                               Null check
{{item.score | timeAgo}}                             Built-in filter
{{state.items.filter(i => i.active)}}                Filter array
{{state.filter == 'all' ? state.items : state.items.filter(i => i.type == state.filter)}}  Conditional filter
{{state.items.slice(0, state.limit)}}                Slice array
{{state.items.sort((a, b) => a.name.localeCompare(b.name))}}  Sort array
{{state.items.map(i => i.title).join(', ')}}         Map + join
```

### Built-in Filters

Use `value | filterName` syntax (pipe):

| Filter | Description | Example |
|--------|-------------|---------|
| `timeAgo` | Formats a date string as relative time | `{{item.createdAt \| timeAgo}}` → `"3h"`, `"2d"` |

---

## Components

### layout.column / layout.row

Vertical or horizontal stack. These are the primary layout containers.

```json
{
  "type": "layout.column",
  "padding": 16,
  "spacing": 8,
  "mainAxisAlignment": "start",
  "crossAxisAlignment": "stretch",
  "children": [
    { "type": "text", "content": "Hello" },
    { "type": "text", "content": "World" }
  ]
}
```

**Props:**
- `padding`: number (all sides) or `{ "top": 0, "bottom": 0, "left": 0, "right": 0 }`
- `spacing`: number (gap between children)
- `mainAxisAlignment`: `"start"` | `"center"` | `"end"` | `"spaceBetween"` | `"spaceAround"`
- `crossAxisAlignment`: `"start"` | `"center"` | `"end"` | `"stretch"`
- `flex`: number — proportional size inside a parent row/column
- `children`: array of component nodes

> Use `layout.column` for vertical stacks, `layout.row` for horizontal stacks.

---

### layout.scaffold

Top-level app shell with optional app bar, bottom navigation, and floating action button.

```json
{
  "type": "layout.scaffold",
  "appBar": {
    "title": "My App",
    "leading": { "type": "button.icon", "icon": "☰", "onPress": { "intent": "menu.open" } },
    "actions": [
      { "type": "button.icon", "icon": "🔍", "onPress": { "intent": "search.open" } }
    ]
  },
  "body": { "type": "layout.column", "children": [...] },
  "bottomNav": {
    "items": [
      { "label": "Home", "icon": "🏠", "tab": "home" },
      { "label": "Search", "icon": "🔍", "tab": "search" },
      { "label": "Profile", "icon": "👤", "tab": "profile" }
    ],
    "activeTab": "{{state.activeTab}}",
    "onTabChange": {
      "type": "action.state.patch",
      "path": "activeTab",
      "value": "{{tab}}"
    }
  },
  "floatingActionButton": {
    "icon": "✏️",
    "onPress": { "type": "action.overlay.open", "overlayId": "composeModal" }
  }
}
```

**Props:**
- `appBar.title`: string
- `appBar.leading`: component (usually `button.icon`)
- `appBar.actions`: array of components
- `body`: single component (the main content)
- `bottomNav.items`: array of `{ label, icon, tab }`
- `bottomNav.activeTab`: binding to state — which tab is active
- `bottomNav.onTabChange`: action triggered when tab changes; use `{{tab}}` for the clicked tab id
- `floatingActionButton.icon`: string
- `floatingActionButton.onPress`: action

---

### text

```json
{
  "type": "text",
  "content": "Hello {{state.user.name}}",
  "style": "titleLarge",
  "color": "#6750A4",
  "align": "center"
}
```

**Props:**
- `content`: string (supports bindings)
- `style`: one of the MD3 text styles below
- `color`: hex color string
- `align`: `"left"` | `"center"` | `"right"`

**Text Styles (Material Design 3):**

| Style | Size | Use case |
|-------|------|----------|
| `headlineLarge` | 32px | Hero titles |
| `headlineMedium` | 28px | Section headers |
| `headlineSmall` | 24px | Sub-headers |
| `titleLarge` | 22px | Screen titles |
| `titleMedium` | 16px | Card titles |
| `titleSmall` | 14px | Small titles |
| `bodyLarge` | 16px | Body copy |
| `bodyMedium` | 14px | Default text |
| `bodySmall` | 12px | Captions |
| `labelLarge` | 14px | Button labels |
| `labelMedium` | 12px | Tag labels |
| `labelSmall` | 11px | Micro labels |

---

### button.filled / button.text / button.outlined / button.icon / button.fab

```json
{
  "type": "button.filled",
  "label": "Save",
  "icon": "💾",
  "disabled": "{{!state.isValid}}",
  "fullWidth": true,
  "onPress": { "intent": "form.submit" }
}
```

**Props:**
- `label`: string — button text (not used by `button.icon`)
- `icon`: string emoji or icon character
- `disabled`: boolean or binding expression
- `fullWidth`: boolean — stretch to parent width
- `onPress`: action (any valid action or intent)

**Button variants:**
| Type | Appearance |
|------|-----------|
| `button.filled` | Filled background — primary action |
| `button.outlined` | Border only — secondary action |
| `button.text` | No background — tertiary/destructive |
| `button.icon` | Icon only, square — toolbar actions |
| `button.fab` | Floating action button |

---

### input.text / input.email / input.password / input.number / input.search

```json
{
  "type": "input.text",
  "label": "Name",
  "placeholder": "Enter your name",
  "value": "{{state.name}}",
  "error": "{{state.nameError}}",
  "onChange": {
    "type": "action.state.patch",
    "path": "name",
    "value": "{{event.value}}"
  }
}
```

**Props:**
- `label`: string — label above the field
- `placeholder`: string
- `value`: binding to state — `"{{state.fieldName}}"`
- `error`: string — error message shown in red below the field
- `multiline`: boolean — turns into a textarea
- `maxLines`: number — textarea height in lines (only with `multiline: true`)
- `maxLength`: number — character limit
- `autofocus`: boolean — focus on mount
- `onChange` or `onChanged`: action; always use `{{event.value}}` to get the typed value

> ⚠️ `input.textarea` does NOT exist. Use `input.text` with `"multiline": true`.
> ⚠️ Always initialize the bound state key. If `value: "{{state.email}}"`, then `"state": { "email": "" }` must exist.
> ⚠️ Use `{{event.value}}` in onChange. `{{value}}` does NOT work.

---

### card

```json
{
  "type": "card",
  "elevation": 1,
  "padding": 16,
  "variant": "elevated",
  "onPress": { "intent": "item.open", "id": "{{item.id}}" },
  "child": {
    "type": "layout.column",
    "children": [...]
  }
}
```

**Props:**
- `elevation`: `0` | `1` — shadow level
- `variant`: `"elevated"` | `"filled"` | `"outlined"`
- `padding`: number
- `onPress`: action — makes card clickable
- `child`: single child component (preferred)
- `children`: array of children (also valid)

> ⚠️ Use `"child"` not `"content"`. The prop is named `child`.

---

### image

```json
{
  "type": "image",
  "src": "{{item.imageUrl}}",
  "borderRadius": 12,
  "aspectRatio": 1.78,
  "style": { "width": "100%", "objectFit": "cover" }
}
```

**Props:**
- `src`: image URL (supports bindings)
- `borderRadius`: number (px)
- `aspectRatio`: number (width/height ratio, e.g. `1.78` for 16:9, `1.0` for square)
- `style`: CSS object — useful for `width`, `height`, `objectFit`

---

### avatar

```json
{
  "type": "avatar",
  "src": "{{state.user.avatar}}",
  "size": 40
}
```

**Props:**
- `src`: image URL
- `size`: number (diameter in px)

---

### icon

```json
{
  "type": "icon",
  "name": "⭐",
  "size": 24,
  "color": "#E91E63"
}
```

---

### chip

Selectable filter chip. Bind `selected` to state to control active appearance.

```json
{
  "type": "chip",
  "label": "Design",
  "selected": "{{state.filter == 'Design'}}",
  "onPress": {
    "type": "action.state.patch",
    "path": "filter",
    "value": "Design"
  }
}
```

**Props:**
- `label`: string
- `selected`: boolean or binding expression — controls filled/outlined style
- `onPress`: action

---

### badge

```json
{
  "type": "badge",
  "label": "New",
  "color": "success"
}
```

**Colors:** `default` | `success` | `warning` | `error` | `info`

---

### progress

Linear progress bar. There is **no** `progress.circular` or `progress.linear`.

```json
{
  "type": "progress",
  "value": "{{state.progress}}",
  "label": "{{state.progress}}% complete",
  "color": "primary"
}
```

**Props:**
- `value`: number 0–100 (percent)
- `label`: string shown next to bar
- `color`: `"primary"` | `"success"` | `"error"`

---

### divider

```json
{ "type": "divider", "spacing": 16 }
```

---

### tabs

```json
{
  "type": "tabs",
  "activeTab": "{{state.activeTab}}",
  "onTabChange": {
    "type": "action.state.patch",
    "path": "activeTab",
    "value": "{{tab}}"
  },
  "tabs": [
    {
      "id": "home",
      "label": "Home",
      "content": { "type": "layout.column", "children": [...] }
    },
    {
      "id": "profile",
      "label": "Profile",
      "content": { "type": "layout.column", "children": [...] }
    }
  ]
}
```

**Props:**
- `activeTab`: binding to state
- `onTabChange`: action; use `{{tab}}` to get the clicked tab id
- `tabs`: array of `{ id, label, content }`

---

### grid

Static grid with fixed children (not from API). For API-driven grids use `collection` with `layout: "grid"`.

```json
{
  "type": "grid",
  "columns": 3,
  "spacing": 16,
  "children": [...]
}
```

---

### table

```json
{
  "type": "table",
  "columns": [
    { "key": "name", "label": "Name" },
    { "key": "email", "label": "Email" },
    { "key": "role", "label": "Role", "width": "120px" }
  ],
  "data": {
    "type": "action.http",
    "method": "GET",
    "url": "/api/users"
  }
}
```

---

### collection — HTTP data source

Fetches data from an API and renders each item. Supports pagination, loading/empty/error states. Reloads automatically when state values used in the URL change.

```json
{
  "type": "collection",
  "layout": "list",
  "spacing": 12,
  "data": {
    "type": "action.http",
    "method": "GET",
    "url": "/api/posts?category={{state.selectedCategory}}",
    "onSuccess": {
      "type": "action.state.patch",
      "path": "postList",
      "value": "{{response}}"
    }
  },
  "itemTemplate": {
    "type": "component.postCard",
    "props": { "post": "{{item}}" }
  },
  "loadingState": { "type": "text", "content": "Loading..." },
  "emptyState": { "type": "text", "content": "No results." },
  "errorState": { "type": "text", "content": "Failed to load." }
}
```

**Props:**
- `layout`: `"list"` | `"grid"` | `"table"`
- `columns`: number (grid only, default 3)
- `spacing`: number (grid gap)
- `itemSpacing`: number (list gap between items)
- `data`: `action.http` object with optional `onSuccess`
- `itemTemplate`: component rendered for each item
- `loadingState`, `emptyState`, `errorState`: fallback components

**Context in `itemTemplate`:**
- `{{item}}` — current item object
- `{{index}}` — 0-based index

**`onSuccess`:** Runs after a successful fetch. Use `{{response}}` to access the returned array. Typically used to save the list to state for reference elsewhere (e.g. navigation by index).

> ⚠️ `{{response}}` is ONLY valid inside `onSuccess`. Do NOT use it anywhere else.

---

### collection.map — static array from state

Renders an array that's already in state — no HTTP call. Supports both `template` and `itemTemplate` as the item key.

```json
{
  "type": "collection.map",
  "data": "{{state.items}}",
  "layout": "list",
  "spacing": 12,
  "template": {
    "type": "card",
    "child": {
      "type": "layout.column",
      "padding": 12,
      "children": [
        { "type": "text", "content": "{{item.title}}", "style": "titleSmall" },
        { "type": "text", "content": "{{item.description}}", "style": "bodySmall" }
      ]
    }
  }
}
```

**Critical: filtering and sorting must be done inside the `data` binding.** The expression re-evaluates on every state change. Full JS array methods work:

```json
"data": "{{state.items.filter(i => i.active)}}"
"data": "{{state.filter == 'all' ? state.items : state.items.filter(i => i.type == state.filter)}}"
"data": "{{state.items.slice(0, state.limit)}}"
"data": "{{state.items.sort((a, b) => a.name.localeCompare(b.name))}}"
```

> ⚠️ If you patch `state.filter` and want `collection.map` to reflect it, the filter MUST be in the `data` expression. A separate state patch cannot tell `collection.map` to re-filter.

**collection vs collection.map:**

| | `collection` | `collection.map` |
|---|---|---|
| Data source | HTTP (action.http) | State (`{{state.xxx}}`) |
| Filtering | URL params | Inline JS in `data` expression |
| Pagination | Yes | No |
| Use when | Data comes from API | Data already in state |

---

### conditionalRender — multiple cases

Show different content based on multiple conditions (like a switch/if-elseif-else).

```json
{
  "type": "conditionalRender",
  "conditions": [
    {
      "when": "{{state.tab == 'home'}}",
      "render": { "type": "text", "content": "Home" }
    },
    {
      "when": "{{state.tab == 'profile'}}",
      "render": { "type": "text", "content": "Profile" }
    }
  ]
}
```

---

### conditional.render — simple show/hide

Show or hide a single child (or array of children) based on one condition.

```json
{
  "type": "conditional.render",
  "condition": "{{state.isLoggedIn}}",
  "child": { "type": "text", "content": "Welcome back!" }
}
```

With multiple children:
```json
{
  "type": "conditional.render",
  "condition": "{{item.progress > 0}}",
  "children": [
    { "type": "text", "content": "In progress" },
    { "type": "progress", "value": "{{item.progress}}" }
  ]
}
```

**Props:**
- `condition`: boolean binding expression
- `child`: single component — shown when condition is true
- `children`: array of components — all shown when condition is true

> ⚠️ `conditional.render` has NO `fallback` prop. For if/else use `conditionalRender` with `conditions`.

---

### view

Embeds a named view defined in the schema's `views` section.

```json
{ "type": "view", "name": "profilePanel", "flex": 1 }
```

---

## Overlays (Modals & Sheets)

Overlays are **always** defined at the top-level `overlays` object. They are never rendered inline.

```json
{
  "overlays": {
    "editModal": {
      "type": "modal",
      "presentation": "modal",
      "dismissible": true,
      "child": {
        "type": "layout.column",
        "padding": 24,
        "spacing": 16,
        "children": [
          { "type": "text", "content": "Edit Item", "style": "titleLarge" },
          {
            "type": "input.text",
            "label": "Name",
            "value": "{{state.editName}}",
            "onChange": {
              "type": "action.state.patch",
              "path": "editName",
              "value": "{{event.value}}"
            }
          },
          {
            "type": "layout.row",
            "mainAxisAlignment": "end",
            "spacing": 8,
            "children": [
              { "type": "button.text", "label": "Cancel",
                "onPress": { "type": "action.overlay.close", "overlayId": "editModal" } },
              { "type": "button.filled", "label": "Save",
                "onPress": { "intent": "item.save" } }
            ]
          }
        ]
      }
    }
  }
}
```

**Presentation modes:**
| Mode | Description |
|------|-------------|
| `"modal"` | Centered modal (default) |
| `"bottomSheet"` | Slides up from bottom |
| `"dialog"` | Small centered dialog (400px max-width) |
| `"fullscreen"` | 95vw × 95vh, rounded corners |

**Open and close:**
```json
{ "type": "action.overlay.open",  "overlayId": "editModal" }
{ "type": "action.overlay.close", "overlayId": "editModal" }
```

> ⚠️ `action.overlay.show` and `action.overlay.hide` do NOT exist.
> ⚠️ The overlay `id` must match the key in the `overlays` object exactly.

---

## Actions

### action.state.patch

Update any value in state. Supports nested paths with dot notation.

```json
{
  "type": "action.state.patch",
  "path": "user.profile.name",
  "value": "{{event.value}}"
}
```

**Path examples:**
- `"path": "tab"` → sets `state.tab`
- `"path": "user.name"` → sets `state.user.name`
- `"path": "composer.text"` → sets `state.composer.text`
- `"path": "loading"` → sets `state.loading`

The value can be any type: string, number, boolean, object, array:
```json
{ "type": "action.state.patch", "path": "loading", "value": true }
{ "type": "action.state.patch", "path": "count", "value": "{{state.count + 1}}" }
{ "type": "action.state.patch", "path": "selected", "value": "{{item}}" }
```

---

### action.http

Make an HTTP request.

```json
{
  "type": "action.http",
  "method": "POST",
  "url": "/api/posts",
  "body": {
    "text": "{{state.composer.text}}",
    "category": "{{state.category}}"
  }
}
```

> ⚠️ The action type is `action.http`, NOT `action.http.request`.

---

### action.snackbar.show

Show a temporary toast notification.

```json
{
  "type": "action.snackbar.show",
  "message": "Item saved: {{state.itemName}}",
  "duration": 3000,
  "action": {
    "label": "Undo",
    "onPress": { "intent": "item.undo" }
  }
}
```

**Props:**
- `message`: string (supports `{{state.xxx}}` bindings)
- `duration`: number (ms, default 3000)
- `action`: optional `{ label, onPress }` — action button in the snackbar

---

### action.sequence

Run multiple actions in order, one after another (awaits each).

```json
{
  "type": "action.sequence",
  "actions": [
    { "type": "action.state.patch", "path": "loading", "value": true },
    { "type": "action.http", "method": "POST", "url": "/api/save", "body": { "text": "{{state.text}}" } },
    { "type": "action.state.patch", "path": "loading", "value": false },
    { "type": "action.snackbar.show", "message": "Saved!" }
  ]
}
```

---

### action.delay

Wait a fixed time in milliseconds. **Must** be used inside `action.sequence`.

```json
{
  "type": "action.sequence",
  "actions": [
    { "type": "action.snackbar.show", "message": "Processing..." },
    { "type": "action.delay", "duration": 1500 },
    { "type": "action.snackbar.show", "message": "Done!" }
  ]
}
```

> ⚠️ `action.delay` has no `"then"` field. Always wrap it in `action.sequence`.

---

## Intents

Named, reusable action handlers. Separates business semantics from UI layout.

**Defining intents:**
```json
{
  "intents": {
    "filter.select": {
      "handler": {
        "type": "action.state.patch",
        "path": "selectedFilter",
        "value": "{{filterValue}}"
      }
    },
    "item.save": {
      "handler": {
        "type": "action.sequence",
        "actions": [
          { "type": "action.state.patch", "path": "loading", "value": true },
          { "type": "action.http", "method": "POST", "url": "/api/items", "body": { "name": "{{state.name}}" } },
          { "type": "action.state.patch", "path": "loading", "value": false },
          { "type": "action.overlay.close", "overlayId": "editModal" },
          { "type": "action.snackbar.show", "message": "Saved!" }
        ]
      }
    }
  }
}
```

**Intent handler can also be an array of actions** (shorthand for sequence):
```json
{
  "intents": {
    "item.delete": {
      "handler": [
        { "type": "action.http", "method": "DELETE", "url": "/api/items/{{itemId}}" },
        { "type": "action.snackbar.show", "message": "Deleted" }
      ]
    }
  }
}
```

**Dispatching intents (preferred — short syntax):**
```json
{
  "intent": "filter.select",
  "filterValue": "Design"
}
```

Parameters alongside `"intent"` are passed directly to the handler and accessible by name (`{{filterValue}}`).

**Alternative explicit syntax:**
```json
{ "type": "intent", "name": "filter.select", "filterValue": "Design" }
```

---

## Custom Components

Define reusable templates with named props. Prefix must be `component.`.

**Defining:**
```json
{
  "components": {
    "component.userRow": {
      "definition": {
        "type": "layout.row",
        "spacing": 12,
        "children": [
          { "type": "avatar", "src": "{{props.user.avatar}}", "size": 40 },
          {
            "type": "layout.column",
            "spacing": 2,
            "children": [
              { "type": "text", "content": "{{props.user.name}}", "style": "titleSmall" },
              { "type": "text", "content": "{{props.user.role}}", "style": "bodySmall" }
            ]
          }
        ]
      }
    }
  }
}
```

**Using:**
```json
{
  "type": "component.userRow",
  "props": { "user": "{{item}}" }
}
```

Inside the definition, access props as `{{props.fieldName.subField}}`.

> ⚠️ Component names MUST start with `component.` — e.g. `component.postCard`, not `pattern.postCard`.
> ⚠️ Props are accessed via `{{props.xxx}}` inside the definition, not `{{item.xxx}}`.

---

## Common Patterns

### Filter chips + filtered list

```json
{
  "state": { "filter": "all", "items": [...] },
  "screen": {
    "type": "layout.column",
    "children": [
      {
        "type": "layout.row",
        "spacing": 8,
        "children": [
          { "type": "chip", "label": "All", "selected": "{{state.filter == 'all'}}", "onPress": { "type": "action.state.patch", "path": "filter", "value": "all" } },
          { "type": "chip", "label": "Active", "selected": "{{state.filter == 'active'}}", "onPress": { "type": "action.state.patch", "path": "filter", "value": "active" } }
        ]
      },
      {
        "type": "collection.map",
        "data": "{{state.filter == 'all' ? state.items : state.items.filter(i => i.status == state.filter)}}",
        "template": {
          "type": "card",
          "child": { "type": "text", "content": "{{item.title}}" }
        }
      }
    ]
  }
}
```

### Form with validation and submit

```json
{
  "state": { "email": "", "password": "", "loading": false, "emailError": "" },
  "intents": {
    "auth.login": {
      "handler": {
        "type": "action.sequence",
        "actions": [
          { "type": "action.state.patch", "path": "loading", "value": true },
          { "type": "action.http", "method": "POST", "url": "/api/login",
            "body": { "email": "{{state.email}}", "password": "{{state.password}}" } },
          { "type": "action.state.patch", "path": "loading", "value": false }
        ]
      }
    }
  },
  "screen": {
    "type": "layout.column",
    "padding": 24,
    "spacing": 16,
    "children": [
      { "type": "text", "content": "Sign In", "style": "headlineMedium" },
      {
        "type": "input.email",
        "label": "Email",
        "value": "{{state.email}}",
        "error": "{{state.emailError}}",
        "onChange": { "type": "action.state.patch", "path": "email", "value": "{{event.value}}" }
      },
      {
        "type": "input.password",
        "label": "Password",
        "value": "{{state.password}}",
        "onChange": { "type": "action.state.patch", "path": "password", "value": "{{event.value}}" }
      },
      {
        "type": "button.filled",
        "label": "Sign In",
        "fullWidth": true,
        "disabled": "{{state.loading}}",
        "onPress": { "intent": "auth.login" }
      }
    ]
  }
}
```

### Bottom nav with tab-based content

```json
{
  "state": { "tab": "home" },
  "screen": {
    "type": "layout.scaffold",
    "body": {
      "type": "conditionalRender",
      "conditions": [
        { "when": "{{state.tab == 'home'}}", "render": { "type": "text", "content": "Home screen" } },
        { "when": "{{state.tab == 'search'}}", "render": { "type": "text", "content": "Search screen" } },
        { "when": "{{state.tab == 'profile'}}", "render": { "type": "text", "content": "Profile screen" } }
      ]
    },
    "bottomNav": {
      "items": [
        { "label": "Home", "icon": "🏠", "tab": "home" },
        { "label": "Search", "icon": "🔍", "tab": "search" },
        { "label": "Profile", "icon": "👤", "tab": "profile" }
      ],
      "activeTab": "{{state.tab}}",
      "onTabChange": { "type": "action.state.patch", "path": "tab", "value": "{{tab}}" }
    }
  }
}
```

### Item detail overlay

```json
{
  "state": { "selected": null },
  "intents": {
    "item.open": {
      "handler": {
        "type": "action.sequence",
        "actions": [
          { "type": "action.state.patch", "path": "selected", "value": "{{itemData}}" },
          { "type": "action.overlay.open", "overlayId": "detailModal" }
        ]
      }
    }
  },
  "overlays": {
    "detailModal": {
      "type": "modal",
      "presentation": "bottomSheet",
      "dismissible": true,
      "child": {
        "type": "layout.column",
        "padding": 24,
        "spacing": 12,
        "children": [
          { "type": "text", "content": "{{state.selected.title}}", "style": "titleLarge" },
          { "type": "text", "content": "{{state.selected.description}}", "style": "bodyMedium" },
          { "type": "button.outlined", "label": "Close",
            "onPress": { "type": "action.overlay.close", "overlayId": "detailModal" } }
        ]
      }
    }
  },
  "screen": {
    "type": "collection",
    "layout": "list",
    "data": {
      "type": "action.http",
      "method": "GET",
      "url": "/api/items"
    },
    "itemTemplate": {
      "type": "card",
      "onPress": { "intent": "item.open", "itemData": "{{item}}" },
      "child": { "type": "text", "content": "{{item.title}}" }
    }
  }
}
```

---

## Complete Example: Course Gallery with Navigation

```json
{
  "schemaVersion": "1.0.0",
  "state": {
    "selectedCategory": "All",
    "courseList": [],
    "selectedCourse": null,
    "selectedCourseIndex": 0
  },
  "intents": {
    "category.select": {
      "handler": {
        "type": "action.state.patch",
        "path": "selectedCategory",
        "value": "{{category}}"
      }
    },
    "course.open": {
      "handler": {
        "type": "action.sequence",
        "actions": [
          { "type": "action.state.patch", "path": "selectedCourse", "value": "{{courseData}}" },
          { "type": "action.state.patch", "path": "selectedCourseIndex", "value": "{{courseIndex}}" },
          { "type": "action.overlay.open", "overlayId": "courseModal" }
        ]
      }
    },
    "course.next": {
      "handler": {
        "type": "action.sequence",
        "actions": [
          {
            "type": "action.state.patch",
            "path": "selectedCourseIndex",
            "value": "{{(state.selectedCourseIndex + 1) % state.courseList.length}}"
          },
          {
            "type": "action.state.patch",
            "path": "selectedCourse",
            "value": "{{state.courseList[(state.selectedCourseIndex + 1) % state.courseList.length]}}"
          }
        ]
      }
    }
  },
  "overlays": {
    "courseModal": {
      "type": "modal",
      "presentation": "fullscreen",
      "dismissible": true,
      "child": {
        "type": "layout.column",
        "children": [
          {
            "type": "layout.row",
            "mainAxisAlignment": "spaceBetween",
            "padding": 16,
            "children": [
              { "type": "text", "content": "{{state.selectedCourse.title}}", "style": "titleLarge" },
              { "type": "button.text", "label": "✕",
                "onPress": { "type": "action.overlay.close", "overlayId": "courseModal" } }
            ]
          },
          { "type": "image", "src": "{{state.selectedCourse.image}}", "style": { "width": "100%" } },
          {
            "type": "layout.column",
            "padding": 16,
            "spacing": 12,
            "children": [
              { "type": "text", "content": "{{state.selectedCourse.instructor}}", "style": "bodyLarge" },
              { "type": "progress", "value": "{{state.selectedCourse.progress}}", "color": "primary" }
            ]
          },
          {
            "type": "layout.row",
            "mainAxisAlignment": "spaceBetween",
            "padding": 16,
            "children": [
              { "type": "button.outlined", "label": "← Prev", "onPress": { "intent": "course.prev" } },
              { "type": "text", "content": "{{state.selectedCourseIndex + 1}} / {{state.courseList.length}}" },
              { "type": "button.outlined", "label": "Next →", "onPress": { "intent": "course.next" } }
            ]
          }
        ]
      }
    }
  },
  "screen": {
    "type": "layout.scaffold",
    "body": {
      "type": "layout.column",
      "padding": 16,
      "spacing": 16,
      "children": [
        { "type": "text", "content": "Courses", "style": "titleLarge" },
        {
          "type": "layout.row",
          "spacing": 8,
          "children": [
            {
              "type": "chip",
              "label": "All",
              "selected": "{{state.selectedCategory == 'All'}}",
              "onPress": { "intent": "category.select", "category": "All" }
            },
            {
              "type": "chip",
              "label": "Design",
              "selected": "{{state.selectedCategory == 'Design'}}",
              "onPress": { "intent": "category.select", "category": "Design" }
            }
          ]
        },
        {
          "type": "collection",
          "layout": "grid",
          "columns": 3,
          "spacing": 16,
          "data": {
            "type": "action.http",
            "method": "GET",
            "url": "/api/courses?category={{state.selectedCategory}}",
            "onSuccess": {
              "type": "action.state.patch",
              "path": "courseList",
              "value": "{{response}}"
            }
          },
          "itemTemplate": {
            "type": "component.courseCard",
            "props": { "course": "{{item}}", "index": "{{index}}" }
          }
        }
      ]
    }
  },
  "components": {
    "component.courseCard": {
      "definition": {
        "type": "card",
        "elevation": 1,
        "padding": 0,
        "onPress": {
          "intent": "course.open",
          "courseData": "{{item}}",
          "courseIndex": "{{index}}"
        },
        "child": {
          "type": "layout.column",
          "spacing": 0,
          "children": [
            { "type": "image", "src": "{{props.course.image}}", "borderRadius": 12, "aspectRatio": 1.33 },
            {
              "type": "layout.column",
              "padding": 12,
              "spacing": 4,
              "children": [
                { "type": "text", "content": "{{props.course.title}}", "style": "titleSmall" },
                { "type": "text", "content": "{{props.course.instructor}}", "style": "bodySmall" }
              ]
            }
          ]
        }
      }
    }
  }
}
```

---

## ✅ Dos and ❌ Don'ts

### Actions

| ✅ Correct | ❌ Wrong |
|-----------|---------|
| `"type": "action.http"` | `"type": "action.http.request"` |
| `"type": "action.overlay.open"` | `"type": "action.overlay.show"` |
| `"type": "action.overlay.close"` | `"type": "action.overlay.hide"` |
| `action.delay` inside `action.sequence` | `action.delay` with `"then": {...}` |
| `"value": "{{state.count + 1}}"` in state.patch | `"value": "state.count + 1"` (no `{{}}`) |

### Components

| ✅ Correct | ❌ Wrong |
|-----------|---------|
| `"type": "progress"` | `"type": "progress.circular"` or `"progress.linear"` |
| `"type": "grid"` | `"type": "layout.grid"` |
| `"type": "input.text"` + `"multiline": true` | `"type": "input.textarea"` |
| `card` with `"child": {...}` | `card` with `"content": {...}` |
| `"type": "component.myCard"` | `"type": "pattern.myCard"` |

### Bindings

| ✅ Correct | ❌ Wrong |
|-----------|---------|
| `{{response}}` in `collection.data.onSuccess` | `{{response.data}}` or `{{response}}` outside onSuccess |
| `{{event.value}}` in `onChange` | `{{value}}` in `onChange` |
| `{{item.field}}` in `itemTemplate` or `template` | `{{item.field}}` outside collection context |
| `{{props.card.title}}` inside `components` definition | `{{item.title}}` as props (use `props.`) |
| `{{tab}}` in `bottomNav.onTabChange` | `{{state.tab}}` in `onTabChange` |

### Overlays

| ✅ Correct | ❌ Wrong |
|-----------|---------|
| Define in top-level `"overlays": { "myModal": {...} }` | `"type": "modal"` inline in screen |
| `overlayId` matches key in `overlays` exactly | Mismatched overlay id |

### Intents

| ✅ Correct | ❌ Wrong |
|-----------|---------|
| `{ "intent": "name", "param": "val" }` | `{ "type": "intent.name" }` (avoid) |
| Intent params accessed by name: `{{paramName}}` | `{{event.paramName}}` inside intent handler |

### State

| ✅ Correct | ❌ Wrong |
|-----------|---------|
| Initialize bound fields: `"state": { "email": "" }` | Bind `{{state.email}}` without initializing it |
| `"path": "user.name"` for nested state | `"path": "user/name"` or `"path": "state.user.name"` |
| Filtering in `collection.map` data binding | Patching state and expecting collection.map to auto-filter |

---

## Resources

- **Live Demos**: https://pineui.github.io/PineUI/
- **Full Documentation**: https://pineui.github.io/PineUI/documentation.html
- **GitHub**: https://github.com/PineUI/PineUI

---

*Created by David Ruiz (wupsbr) — CPTO at Ingresse*
