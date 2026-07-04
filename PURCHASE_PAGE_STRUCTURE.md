# Purchase Management Page Structure

Source route: `https://reliable.s.frappe.cloud/app/purchase`  
Page title: `Purchase`  
Primary heading: `Purchase Management`  
Captured: 2026-07-03

## Scope

This document describes the page shell, navigation, controls, tab structure, table schemas, form structure, and workflows. It intentionally excludes:

- Existing vendor, material, project, company, order, stock, and request records
- Contact details and other user-entered values
- Login credentials
- Record counts

## Page Hierarchy

```text
Frappe application shell
├── Global top navigation
│   ├── App logo → ERP Dashboard
│   ├── Global command search
│   ├── Notifications
│   └── User menu
├── Left workspace sidebar
│   ├── Sidebar toggle
│   ├── Workspace label: Reliable ERP
│   └── Public navigation section
│       ├── ERP Dashboard
│       ├── Reliable Homes
│       ├── Purchase
│       ├── Site Engineer
│       ├── Sales and Marketing
│       ├── Business
│       ├── Finance
│       └── User Management
└── Main content
    ├── Heading: Purchase Management
    ├── Listing toolbar
    │   ├── Search
    │   ├── Export
    │   └── Add
    ├── Module tabs
    │   ├── Vendors
    │   ├── Materials
    │   ├── RFQ
    │   ├── Purchase Orders
    │   ├── Stock
    │   ├── Work Orders
    │   └── Material Requests
    └── Active-tab data table
```

## Global Application Shell

### Top Navigation

| Element | Type | Purpose |
|---|---|---|
| App Logo | Link/image | Returns to `/app/erp-dashboard` |
| Global Search | Command-search combobox | Searches or runs a command; displays the shortcut `⌘ + G` |
| Notifications | Button | Opens unseen notifications |
| User Menu | Button | Opens the signed-in user's account menu |

### Left Sidebar

- Can be collapsed or expanded with `Toggle Sidebar`.
- Displays the workspace identity `Reliable ERP`.
- Contains a skip link labeled `Navigate to main content`.
- Uses an expandable `Public` navigation group.
- The Purchase link points to `/app/purchase`.
- Some navigation items have adjacent unlabeled buttons, likely submenu/expand controls.

## Shared Purchase Listing Layout

Every Purchase tab reuses the same main toolbar and tab strip.

### Toolbar

| Control | Type | Notes |
|---|---|---|
| Search | Textbox with placeholder `Search...` | Positioned before the action buttons; intended to filter the active listing |
| Export | Button | Present on every tab; its download action was not triggered during inspection |
| Add | Button | Opens a new document form appropriate to the active tab |

### Tab Strip

The seven module tabs are implemented as buttons. Switching tabs changes the table inside the same Purchase Management page.

### Standard Listing Pattern

- Semantic HTML table with a header row and body rows.
- Most listings end with an `Actions` column.
- Standard row actions are icon buttons with accessible names:
  - `View`
  - `Edit`
  - `Delete`
- Material Requests uses workflow actions instead of the standard action set.
- No pagination control was visible in the inspected page state.

## Vendors

### Listing Table

| Column | Purpose |
|---|---|
| Vendor Name | Vendor identity |
| Vendor Code | Internal/vendor classification code |
| Contact Person | Main contact |
| Mobile | Contact number |
| Actions | View, Edit, Delete |

### Add Action

Opens a Frappe document form titled `New Vendor`.

### Vendor Form

| Section | Field | Control | Required / Notes |
|---|---|---|---|
| Main | Vendor Name | Textbox | Required |
| Main | Vendor Code | Textbox | Optional |
| Main | GSTIN | Textbox | Optional |
| Main | Contact Person | Textbox | Optional |
| Main | Mobile | Textbox | Optional |
| Main | Email | Textbox | Optional |
| Main | Address | Multiline textbox | Optional |
| Payment Terms | Credit Days | Numeric textbox | Helper: number of credit days extended by the vendor |
| Payment Terms | Payment Terms Description | Textbox | Optional |
| Main | Notes | Multiline textbox | Optional |

Form chrome:

- Breadcrumb: `Purchase / New Vendor`
- Status indicator: `Not Saved`
- Primary action: `Save`
- Comment/reply area at the bottom

## Materials

### Listing Table

| Column | Purpose |
|---|---|
| Material Name | Material identity |
| Code | Material code |
| Category | Material category |
| UOM | Unit of measure |
| Last Price (₹) | Most recent price, formatted in rupees |
| Actions | View, Edit, Delete |

### Add Action

Opens a Frappe document form titled `New Material Master`.

### Material Form

| Field | Control | Required / Notes |
|---|---|---|
| Material Name | Textbox | Required |
| Material Code | Textbox | Optional |
| Category | Select | Optional |
| Unit of Measure | Select | Defaults to `Nos` |
| Reorder Level | Numeric textbox | Alerts when project stock falls below the entered quantity |
| Description / Specifications | Rich-text editor | Optional |
| Notes | Multiline textbox | Optional |

Category options:

- Plumbing
- Electrical
- Civil
- Sanitary
- Woodwork
- Painting
- Flooring
- Roofing
- Hardware
- Miscellaneous

Unit-of-measure options:

- Nos
- Mtr
- Kg
- Ltr
- Sqft
- Cft
- Cum
- Set
- Pair
- Bag
- Box
- Roll
- Sheet
- Length

The rich-text editor supports headings, font sizes, bold, italic, underline, strike-through, block quotes, code blocks, text direction, links, images, ordered/bulleted/check lists, indentation, and tables.

## RFQ

RFQ means Request for Quotation.

### Listing Table

| Column | Purpose |
|---|---|
| RFQ Date | Request date |
| Project | Related project |
| Material Type | Requested material category/type |
| Company | Related company |
| Status | RFQ workflow state |
| Actions | View, Edit, Delete |

### Add Action

Opens a Frappe document form titled `New Material RFQ`.

### RFQ Form

#### Request Details

| Field | Control | Required / Notes |
|---|---|---|
| RFQ Date | Date textbox/date picker | Required; initialized to the current date |
| Project | Link/autocomplete combobox | Required |
| Company | Link/autocomplete combobox | Required |
| Material Type / Category | Textbox | Helper example: Plumbing, Electrical, Civil |
| Status | Select | Defaults to Draft |
| Quote Valid Until | Date textbox/date picker | Optional |

Status options:

- Draft
- Sent
- Quotes Received
- Closed

#### Items Required

Editable child table with an `Add Row` button.

| Child-table Column | Required / Notes |
|---|---|
| Material | Linked material |
| Material Name | Display/name field |
| Quantity | Required |
| Unit | Unit of measure |
| Unit Price | Quoted or estimated unit price |

#### Vendors Contacted

Editable child table with an `Add Row` button.

| Child-table Column | Purpose |
|---|---|
| Vendor Name | Vendor |
| Mobile | Contact number |
| Sent Date | Date the RFQ was sent |
| Status | Vendor/RFQ response state |

#### Closing / Contact Details

- Notes / Delivery Instructions: rich-text editor
- Print Template area is present

## Purchase Orders

### Listing Table

| Column | Purpose |
|---|---|
| PO Date | Purchase-order date |
| Project | Related project |
| Vendor | Selected vendor |
| Company | Ordering company |
| Status | Order approval/workflow state |
| Payment Status | Payment state |
| Actions | View, Edit, Delete |

### Add Action

Opens a Frappe document form titled `New Project Purchase Order`.

### Purchase Order Form Chrome

- Breadcrumb: `Purchase / New Project Purchase Order`
- Status indicator: `Not Saved`
- Workflow/status badge: `Pending Approval`
- Top actions:
  - `Actions`
  - Overflow `Menu`
  - `Save`
- Two internal tabs:
  - Details
  - Approval

### Details Tab

#### Order Details

| Field | Control | Required / Notes |
|---|---|---|
| PO Date | Date textbox/date picker | Required; initialized to the current date |
| Project | Link/autocomplete combobox | Required |
| Company | Link/autocomplete combobox | Required |
| Material Type | Textbox | Optional |
| Status | Display/read-only value | Initially Pending Approval |
| Delivery Date | Date textbox/date picker | Optional |
| Payment Status | Display/read-only value | Initially Outstanding |

#### Vendor & Delivery

| Field | Control | Required / Notes |
|---|---|---|
| Vendor | Link/autocomplete combobox | Required |
| Supplier Quotation Ref | Link/autocomplete combobox | Optional |
| Credit Days | Numeric textbox | Optional |
| Delivery Address | Multiline textbox | Optional |

#### Items

Editable child table with an `Add Row` button.

| Child-table Column | Required / Notes |
|---|---|
| Material | Required |
| Description | Optional |
| Quantity | Required |
| Unit | Unit of measure |
| Rate | Required |

#### Totals

| Field | Control | Required / Notes |
|---|---|---|
| GST % | Numeric textbox | Initialized to 18.000 |
| GST Type | Select | Inclusive or Exclusive; defaults to Inclusive |
| Freight / Other Charges | Numeric textbox | Optional |

#### Contact Information

| Field | Control | Required / Notes |
|---|---|---|
| Order Contact (Purchase) | Link/autocomplete combobox | Defaults to the logged-in user |
| Order Contact Name | Display/read-only value | Derived from Order Contact |
| Order Contact Phone | Textbox | Optional |
| Delivery Contact (Site Engineer) | Link/autocomplete combobox | Site contact for delivery queries |
| Delivery Contact Phone | Textbox | Optional |

#### Terms and Notes

- Additional Terms: rich-text editor
- Notes: rich-text editor

#### Payment Records

Editable child table with an `Add Row` button.

| Child-table Column | Required / Notes |
|---|---|
| Payment Date | Required |
| Amount Paid | Required |
| Payment Mode | Optional |
| Reference / Cheque No | Optional |

### Approval Tab

| Field | Control | Notes |
|---|---|---|
| Approval Status | Display/read-only value | Initially Draft |
| Admin Notes / Comments | Rich-text editor | Administrative approval notes |

## Stock

### Listing Table

| Column | Purpose |
|---|---|
| Project | Related project |
| Material | Stocked material |
| Current Stock | Current available quantity |
| Unit | Unit of measure |
| Last Updated | Last stock-update date |
| Actions | View, Edit, Delete |

### Add Action

Opens a Frappe document form titled `New Project Stock`.

### Stock Form

| Field | Control | Required / Notes |
|---|---|---|
| Project | Link/autocomplete combobox | Required |
| Material | Link/autocomplete combobox | Required |
| Material Name | Textbox | Likely populated from the selected material |
| Unit | Textbox | Likely populated from the selected material |
| Current Stock | Numeric textbox | Optional |
| Reorder Level | Numeric textbox | Alert is triggered at or below this value |
| Last Updated | Date textbox/date picker | Optional |
| Last PO | Link/autocomplete combobox | References the latest purchase order |

## Work Orders

### Listing Table

| Column | Purpose |
|---|---|
| Title | Work-order title |
| Date | Work-order date |
| Project | Related project |
| Contractor | Assigned contractor |
| Company | Related company |
| Actions | View, Edit, Delete |

### Add Action

Opens a Frappe document form titled `New Work Order`.

### Work Order Form Chrome

- Breadcrumb: `Purchase / New Work Order`
- Status indicator: `Not Saved`
- Top actions:
  - `Preview & Edit`
  - Overflow `Menu`
  - `Save`

### Work Order Form

| Section | Field / Area | Control | Required / Notes |
|---|---|---|---|
| Header | Title | Textbox | Required |
| Header | Project | Link/autocomplete combobox | Optional |
| Header | Company | Link/autocomplete combobox | Optional |
| Header | Date | Date textbox/date picker | Required |
| Header | Load from Template | Link/autocomplete combobox | Loads a reusable work-order template |
| Contractor Details | Contractor Details | Section | Empty-form controls were not exposed until a project/template is selected |
| Project Details | Project Details | Section | Empty-form controls were not exposed until a project/template is selected |
| Body | Work Description | Document body/editor area | Required |
| Body | Terms of Payment | Document body/editor area | Required |
| Body | Terms & Conditions | Rich-text editor area | Optional |
| Body | Additional Work | Rich-text editor area | Optional |
| Body | Bank Details | Section | Present in the document body |
| Footer | Notes | Multiline textbox | Optional |

## Material Requests

This tab represents material requirements originating from the Site Engineer workflow.

### Listing Table

| Column | Purpose |
|---|---|
| Date | Request date |
| Project | Related project |
| Material | Requested material |
| Qty | Requested quantity |
| Before | Required-by date |
| Actions | Workflow actions |

### Row Workflow Actions

This tab does not use the standard View/Edit/Delete action set.

| Action | Purpose |
|---|---|
| View CMR | Opens the source Client and Material Request |
| → RFQ | Creates or transitions the request into an RFQ workflow |
| → PO | Creates or transitions the request into a Purchase Order workflow |

### Add Action

The Add button crosses module boundaries:

- Opens `New Client and Material Request`
- Uses the route family `/app/client-and-material-request/...`
- Breadcrumb points to `Site Engineer`, not Purchase

### Client and Material Request Form

#### Main Details

| Field | Control | Required / Notes |
|---|---|---|
| Date | Date textbox/date picker | Required; initialized to the current date |
| Plant Description | Textbox | Optional |
| Project | Link/autocomplete combobox | Optional |
| Total No. of Days | Numeric textbox | Optional |
| Engineer Name | Display/read-only value | Derived from the logged-in user |

#### Client Requirements

Editable child table with an `Add Row` button.

| Child-table Column | Required / Notes |
|---|---|
| Client Requirement | Required |
| On or Before | Required-by date |

#### Material Requirements

Editable child table with an `Add Row` button.

| Child-table Column | Purpose |
|---|---|
| Material | Linked material |
| Description / Specification | Requested specification |
| Total Quantity | Required quantity |
| On or Before | Required-by date |

#### Footer

- Notes: multiline textbox
- Comment/reply area

## Shared Document-Form Patterns

Forms opened from the Add button follow standard Frappe document conventions:

- Breadcrumb back to the originating workspace
- `Not Saved` status for new documents
- Primary `Save` button
- Required fields marked with `*`
- Link/autocomplete fields with a result-status region
- Date fields backed by a calendar picker
- Child tables with:
  - Row-selection checkbox
  - Number column
  - Empty-state illustration
  - `No Data` message
  - `Add Row` button
- Rich-text fields with formatting and table-insertion controls
- Bottom comment/reply area
- Application footer

## Interaction Map

```text
Purchase Management
├── Vendors
│   └── Add → New Vendor
├── Materials
│   └── Add → New Material Master
├── RFQ
│   └── Add → New Material RFQ
├── Purchase Orders
│   └── Add → New Project Purchase Order
│       ├── Details
│       └── Approval
├── Stock
│   └── Add → New Project Stock
├── Work Orders
│   └── Add → New Work Order
└── Material Requests
    ├── View CMR
    ├── Convert/open RFQ workflow
    ├── Convert/open PO workflow
    └── Add → New Client and Material Request
```

## Inspection Notes

- Add forms were opened only to inspect their empty structure.
- No form was saved.
- No existing record was edited or deleted.
- Export was not triggered.
- Business-record values were deliberately excluded from this document.
