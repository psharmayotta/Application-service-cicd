# Audit Log Date Filter API Contract

Frontend integration contract for filtering organization audit events by a preset or custom date range.

_Last updated: 2026-08-17_

## Endpoint

| Item | Value |
|---|---|
| Method | `POST` |
| Path | `/Infer/api/audit-log/getdata` |
| Authentication | `Authorization: Bearer <access-token>` |
| Content type | `application/json` |
| Frontend URL constant | `API_URL.AUDIT_LOG_GETDATA` (`/audit-log/getdata`) |

The frontend must pass the plain request object to the shared `initRequest('POST')` client. The shared client adds the bearer token and encrypts/decrypts the transport payload. Do not encrypt the payload in feature code.

Swagger also accepts the plain request object in **Try it out** and encrypts it before sending. Therefore, Swagger's generated curl contains a body shaped like `{ "data": "<ciphertext>" }`; this is expected.

## Logical request body

```ts
type AuditLogDateRange =
    | 'Last 12 hours'
    | 'Last 24 hours'
    | 'Last 1 week'
    | 'Last 1 Month'
    | 'Custom';

type AuditLogRequest = {
    page_number?: number;
    page_size?: number;
    filterOptions: {
        company_id: number;
        module?: string | string[];
        action?: string;
        member_id?: number;
        search?: string;
        sort_order?: 'ASC' | 'DESC';
        date_range?: AuditLogDateRange;
        start_date?: string;
        end_date?: string;
    };
};
```

### Field definitions

| Field | Required | Rules |
|---|---:|---|
| `page_number` | No | One-based page number. Defaults to `1`. |
| `page_size` | No | Number of rows per page. Defaults to `10`. |
| `filterOptions.company_id` | Yes | ID of the currently selected organization. Do not hard-code this value or use the member/user ID. |
| `filterOptions.module` | No | Module name or list of module names. Matching is case-insensitive. |
| `filterOptions.action` | No | Audit action name. Matching is case-insensitive. |
| `filterOptions.member_id` | No | Return events created by this member. |
| `filterOptions.search` | No | Case-insensitive partial match against `description` or `entity_name`. |
| `filterOptions.sort_order` | No | `ASC` or `DESC` by `created_at`. Defaults to `DESC`. |
| `filterOptions.date_range` | No | One of the five values listed below. When omitted, no date restriction is applied. |
| `filterOptions.start_date` | For `Custom` | ISO 8601 timestamp for the inclusive start of the range. |
| `filterOptions.end_date` | For `Custom` | ISO 8601 timestamp for the inclusive end of the range. Must not be before `start_date`. |

## Date-range semantics

Preset ranges are calculated relative to the time the backend receives the request.

| `date_range` value | Applied range |
|---|---|
| `Last 12 hours` | Request time minus 12 hours through request time |
| `Last 24 hours` | Request time minus 24 hours through request time |
| `Last 1 week` | Request time minus 7 days through request time |
| `Last 1 Month` | Request time minus 30 days through request time; this is not a calendar-month calculation |
| `Custom` | Inclusive `start_date` through `end_date` |

For a custom range, convert the `Date` values produced by `DateRangePicker` to UTC ISO strings:

```ts
start_date: customStart.toISOString(),
end_date: customEnd.toISOString(),
```

Do not manually add or subtract the browser timezone offset before calling `toISOString()`.

## Request examples

### Preset range

```json
{
  "page_number": 1,
  "page_size": 10,
  "filterOptions": {
    "company_id": 123,
    "date_range": "Last 24 hours"
  }
}
```

### Custom range

```json
{
  "page_number": 1,
  "page_size": 10,
  "filterOptions": {
    "company_id": 123,
    "date_range": "Custom",
    "start_date": "2026-08-01T02:00:00.000Z",
    "end_date": "2026-08-15T14:00:00.000Z"
  }
}
```

`123` is an example organization ID. The implementation must use `selectedOrganization.id`.

### Combined filters

```json
{
  "page_number": 1,
  "page_size": 10,
  "filterOptions": {
    "company_id": 123,
    "module": ["MODEL", "DEPLOYMENT"],
    "action": "CREATE",
    "member_id": 456,
    "search": "production",
    "sort_order": "DESC",
    "date_range": "Last 1 week"
  }
}
```

All supplied filters are combined with the date restriction. Search still checks either `description` or `entity_name`.

## Successful response

The shared frontend `initRequest` client returns the decrypted `details` value directly:

```ts
type AuditLogResponse = {
    data: AuditLogEvent[];
    pagination: {
        total: number;
        pageSize: number;
        pageNumber: number;
    };
};

type AuditLogEvent = {
    id: number;
    company_id: number;
    member_id: number;
    module: string;
    action: string;
    entity_type: string;
    entity_id: number | null;
    entity_name: string;
    description: string;
    metadata: Record<string, unknown>;
    ip_address: string;
    created_at: string;
    modified_at: string;
    member_name: string;
    member_profile_picture: string | null;
};
```

Example decrypted value returned to feature code:

```json
{
  "data": [
    {
      "id": 101,
      "company_id": 123,
      "member_id": 456,
      "module": "MODEL",
      "action": "Created",
      "entity_type": "model",
      "entity_id": 42,
      "entity_name": "Example Model",
      "description": "Created Example Model",
      "metadata": {},
      "ip_address": "",
      "created_at": "2026-08-14T00:12:21.280Z",
      "modified_at": "2026-08-14T00:12:21.280Z",
      "member_name": "Example User",
      "member_profile_picture": null
    }
  ],
  "pagination": {
    "total": 1,
    "pageSize": 10,
    "pageNumber": 1
  }
}
```

At the HTTP transport layer, the backend wraps this value in its standard success envelope and encrypts `details`. Swagger's response interceptor displays the decrypted form:

```json
{
  "status": "10000",
  "msg": "Audit Log Fetched Successfully",
  "error": null,
  "details": {
    "data": [],
    "pagination": {
      "total": 0,
      "pageSize": 10,
      "pageNumber": 1
    }
  }
}
```

An empty matching range is a successful response with `data: []` and `pagination.total: 0`.

## Validation and errors

| Condition | HTTP status | Error |
|---|---:|---|
| Missing `start_date` or `end_date` when `date_range` is `Custom` | `400` | `start date and end date is required` |
| Invalid timestamp | `400` | `The data provided did not pass validation.` |
| `start_date` is after `end_date` | `400` | `The data provided did not pass validation.` |
| Unsupported `date_range` value | `400` | `The data provided did not pass validation.` |
| Missing, invalid, or expired bearer token | `401` | Authentication error |

## Frontend integration changes

Extend the existing `AuditLogFilters` type in `modules/settings-new/services/auditService.ts`:

```ts
export type AuditLogDateRange =
    | 'Last 12 hours'
    | 'Last 24 hours'
    | 'Last 1 week'
    | 'Last 1 Month'
    | 'Custom';

export type AuditLogFilters = {
    company_id: number;
    member_id?: number;
    module?: string | string[];
    action?: string;
    search?: string;
    page?: number;
    page_size?: number;
    date_range?: AuditLogDateRange;
    start_date?: string;
    end_date?: string;
};
```

The existing `searchAuditLogs` request envelope already passes these fields through `filterOptions`; no new endpoint or HTTP client is required.

When a user applies a date range:

1. Set `date_range` to the exact selected label.
2. For `Custom`, also set `start_date` and `end_date` using `toISOString()`.
3. For a preset, remove any previous custom `start_date` and `end_date` values.
4. Reset `page` to `1` before fetching.
5. Use the selected organization's ID for `company_id`.

## Frontend acceptance checklist

- Each preset returns only events inside its calculated window.
- Custom range includes events exactly on its start and end timestamps.
- Changing the date range resets pagination to page 1.
- Date filtering composes with module, action, member, and search filters.
- Switching organizations sends the new `selectedOrganization.id`.
- A valid range with no matching events renders the normal empty state.
- Custom range cannot be submitted until both dates are selected and the end is not before the start.
- Feature code sends plain JSON through `initRequest`; no token or encryption key is embedded in the UI.
